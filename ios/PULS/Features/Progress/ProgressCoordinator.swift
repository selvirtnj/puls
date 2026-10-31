import SwiftUI
import Observation
import PULSCore

/// Bereiche des nativen Trainings-Tabs, wie die Web-Unterseiten `trainTab` (Workout/Routinen | Kalender | Fortschritt).
enum WorkoutSegment: String, CaseIterable, Hashable {
    case training, calendar, progress
}

/// Unterseiten des Trainings-Tabs (NavigationStack). Nur IDs; Inhalte kommen per Query aus dem Web.
enum ProgressRoute: Hashable {
    case workout(id: String, name: String)
    case run(id: String, name: String)
    case exercise(id: String, name: String)
}

/// Ladezustand einer Query-Ansicht.
enum LoadPhase<Value: Equatable>: Equatable {
    case loading
    case loaded(Value)
    /// Ziel gibt es nicht mehr (`gone`).
    case gone
    /// Nicht gesendet, Zeitlimit oder Web-Fehler: erneut versuchen oder im Web öffnen.
    case failed

    var value: Value? {
        if case .loaded(let value) = self { return value }
        return nil
    }
}

/// M5: nativer Kalender und Fortschritt (docs/native/NATIVE-BRIDGE-PROTOCOL.md §10).
///
/// - Liest nur Projektion `progress` und `progressResult`; keine Kennzahlformeln in Swift.
/// - Queries tragen eine eindeutige `requestId`, werden vor dem Senden im Store registriert und nur für denselben
///   Nutzer/dasselbe Dokument angenommen. Eine Ansicht, die ihr Ziel wechselt oder verschwindet, gibt ihre Anfrage auf.
/// - Schreibt ausschließlich die drei Einstellungs-Ops über die Outbox (`expect` aus dem Spiegel).
/// - Alles Weitere (Bearbeiten, Löschen, Teilen, Karten) über feste Web-Auswege mit `web:true`.
@Observable
@MainActor
final class ProgressCoordinator {
    let store: ProfileStore
    @ObservationIgnored private let bridge: StateBridge

    /// Gewählter Bereich im Trainings-Tab.
    var segment: WorkoutSegment = .training
    /// Pfad des NavigationStacks im Trainings-Tab (Workout-Rückblick, Aktivität, Übungsverlauf).
    var path: [ProgressRoute] = []
    var notice: TrainingNotice?
    /// Angezeigter Kalendermonat (`YYYY-MM`); `nil` = Monat von heute.
    var calendarMonth: String?
    /// Ausgewählter Kalendertag.
    var calendarDay: String?

    /// Steigt, sobald der native Trainings-Tab nach einem Web-Ablauf/Tabwechsel wieder sichtbar wird.
    var refreshToken = 0

    /// Datenstand für Query-Ansichten: jeder neue Profilsnapshot (Änderung im Web, Sync, Import) und jede Rückkehr
    /// aus dem Web lädt sichtbare Monate/Details neu; ein Dokument-/Nutzerwechsel ebenfalls (`progressGeneration`).
    var dataRevision: String {
        "\(store.progressGeneration)|\(store.seq)|\(refreshToken)"
    }

    /// Shell: Web-Ausweg ausführen (WebView zeigen, native Leiste/Detail entsprechend). Vor `install` gesetzt.
    @ObservationIgnored var onOpenWeb: ((ProgressNavigation) -> Void)?

    @ObservationIgnored private var queryCounter = 0
    @ObservationIgnored private var handledAckSerial = 0

    init(store: ProfileStore, bridge: StateBridge) {
        self.store = store
        self.bridge = bridge
        handledAckSerial = store.recentAcks.last?.serial ?? 0
        observeAcks()
    }

    // MARK: Zustand

    /// Das Web meldet Kalender bzw. Fortschritt nativ (Hello, Ops, geklärte Zuordnung). Die Projektion selbst kommt
    /// erst, wenn Native Interesse meldet; bis dahin zeigt die Ansicht ihren Ladezustand.
    var offersCalendar: Bool { store.webOffersCalendar }
    var offersProgress: Bool { store.webOffersProgress }
    var offersAny: Bool { offersCalendar || offersProgress }

    var projection: ProgressProjection? { store.currentProgress?.progress }

    /// Schreibende Einstellungen möglich (keine Vorschau/Recovery/Upload-Sperre).
    var canWrite: Bool {
        offersProgress && !store.isReadOnly && store.currentProgress?.flags.isReadOnly != true
    }

    var text: ProgressText {
        ProgressText(language: projection?.language ?? store.document["language"]?.stringValue, locale: projection?.locale)
    }

    /// Gezeigter Bereich: ein nicht mehr angebotener Bereich fällt auf Training zurück.
    var effectiveSegment: WorkoutSegment {
        switch segment {
        case .calendar where offersCalendar: return .calendar
        case .progress where offersProgress: return .progress
        default: return .training
        }
    }

    /// Kalender oder Fortschritt ist gewählt (für `pulsNativeSetInterest`).
    var needsProgressProjection: Bool { effectiveSegment != .training || !path.isEmpty }

    /// Heutiger Web-Tag (Projektion), sonst Gerätetag.
    var today: String { projection?.today ?? WeightDay.string(from: Date()) }

    var visibleMonth: String { calendarMonth ?? CalendarMonth.of(day: today) ?? String(today.prefix(7)) }

    // MARK: Queries

    /// Registriert, sendet und wartet auf die passende Antwort (höchstens `timeout`). Abbruch der aufrufenden Task
    /// (Ansicht weg oder neues Ziel) gibt die Anfrage auf; eine späte Antwort wird dann verworfen.
    func fetch(timeout: Duration = .seconds(6), _ build: (String) -> ProgressQueryRequest?) async -> LoadPhase<ProgressResultMessage> {
        queryCounter += 1
        let requestId = "native-\(queryCounter)-" + UUID().uuidString.prefix(8).lowercased()
        guard let request = build(requestId) else { return .failed }
        store.registerProgressQuery(request)
        let bridge = bridge
        let sent = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            bridge.progressQuery(request) { continuation.resume(returning: $0) }
        }
        guard sent else {
            store.forgetProgressQuery(requestId)
            return .failed
        }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while !Task.isCancelled {
            if let result = store.progressResult(requestId) {
                if result.ok { return .loaded(result) }
                return result.isGone ? .gone : .failed
            }
            // Verworfen (anderer Nutzer/Dokument, ownerPending) oder Zeitlimit.
            guard store.isProgressQueryPending(requestId), clock.now < deadline else { break }
            try? await Task.sleep(for: .milliseconds(40))
        }
        store.forgetProgressQuery(requestId)
        return .failed
    }

    // MARK: Navigation

    func show(_ route: ProgressRoute) {
        path.append(route)
    }

    /// Web-Ausweg (§10.5): eigene Detailansicht vorher schließen, dann die gemeinsame WebView zeigen.
    func openWeb(_ target: ProgressNavigation?) {
        guard let target else { return }
        if !path.isEmpty { path.removeLast() }
        onOpenWeb?(target)
    }

    func openWeb(action: String, id: String? = nil) {
        openWeb(ProgressNavigation(action: action, id: id))
    }

    // MARK: Einstellungen (Ops)

    func setView(key: String, value: String) {
        guard let command = ProgressCommands.setView(key: key, value: value) else { return }
        perform(command)
    }

    func setChart(period: String? = nil, lines: [String: Bool]? = nil) {
        guard let command = ProgressCommands.setChart(period: period, lines: lines) else { return }
        perform(command)
    }

    /// `true`, wenn der Befehl eingereiht wurde.
    @discardableResult
    func setGoals(weeklyGoalKm: Double?, weekMinutesGoal: Int) -> Bool {
        guard let command = ProgressCommands.setGoals(weeklyGoalKm: weeklyGoalKm, weekMinutesGoal: weekMinutesGoal) else {
            notice = TrainingNotice(text: text("Ungültiges Wochenziel.", "Invalid weekly goal."))
            return false
        }
        return perform(command)
    }

    /// Ein Einstellungsbefehl wartet noch auf den Snapshot; Bedienelemente bis dahin nicht erneut ändern.
    var isApplying: Bool { store.hasUnconfirmedProgress() }

    @discardableResult
    private func perform(_ command: Command) -> Bool {
        do {
            try store.performProgress(command, asUser: store.userId)
            return true
        } catch {
            notice = TrainingNotice(text: describe(error))
            return false
        }
    }

    private func describe(_ error: Error) -> String {
        switch error as? ProfileStoreError {
        case .preview?: return text("Vorschau: nur zur Ansicht.", "Preview: view only.")
        case .readOnly?: return text("Gerade nur lesbar. Wähle zuerst in PULS den gewünschten Stand.",
                                     "Read only right now. Choose the version in PULS first.")
        case .webNotReady?: return text("PULS lädt noch. Bitte gleich noch einmal.", "PULS is still loading. Please try again.")
        case .unsupportedOp?: return text("Diese PULS-Version unterstützt das gerade nicht.", "This PULS version does not support this right now.")
        case .persistence?: return text("Konnte nicht gespeichert werden.", "Could not be saved.")
        default: return text("Die Änderung wurde nicht übernommen.", "The change was not applied.")
        }
    }

    // MARK: Konflikte

    var conflicts: [OutboxEntry] { store.progressConflicts }

    func discardConflict(id: String) {
        do { try store.discardProgressConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    func reapplyConflict(id: String) {
        do { try store.reapplyProgressConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    // MARK: Acks

    private func observeAcks() {
        withObservationTracking {
            processAcks()
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observeAcks() }
        }
    }

    /// Fehler eigener Einstellungsbefehle kurz melden. `busy`/`persist_failed`/`readonly`/`not_ready` bleiben in der
    /// Outbox und werden später erneut gesendet; `conflict` zeigt die Konfliktliste.
    private func processAcks() {
        let events = store.recentAcks.filter { $0.serial > handledAckSerial }
        guard let last = events.last else { return }
        handledAckSerial = last.serial
        for event in events where ProgressOps.isProgress(event.op) && !event.ok {
            switch event.code {
            case .busy?, .readonly?, .persistFailed?, .notReady?, .conflict?:
                continue
            case .invalid?:
                notice = TrainingNotice(text: text("Nicht gespeichert", "Not saved") + (event.message.map { ": \($0)" } ?? "."))
            case .wrongUser?:
                notice = TrainingNotice(text: text("Die Änderung gehört zu einem anderen Konto und wurde zurückgehalten.",
                                                   "The change belongs to another account and was held back."))
            default:
                notice = TrainingNotice(text: text("Die Änderung wurde nicht übernommen.", "The change was not applied."))
            }
        }
    }
}
