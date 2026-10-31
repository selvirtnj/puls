import SwiftUI
import UIKit
import Observation
import PULSCore

/// Ablauf der nativen Aktivitätsansicht. Live/Abschluss folgen allein der Projektion (`.active`).
enum ActivityStage: Equatable {
    /// Artwahl (Startansicht).
    case start
    /// Nativer Countdown bis `endsAt` (10 s, verlängerbar, abbrechbar).
    case countdown(endsAt: Date)
    /// `run.start` gesendet, Bestätigung des Webs steht aus.
    case starting
    /// Aktive Aktivität: Live-Ansicht bzw. Abschluss nach `run.finish`.
    case active
}

/// Eingaben der Abschlussansicht (gehören zur Aktivität `key`).
struct ActivitySummaryForm: Equatable {
    var key: Double
    var feeling: Int?
    var terrain: String?
    var note: String
    var manualKmText: String
}

/// Detailansicht einer gespeicherten Aktivität (Sheet im Trainings-Tab).
struct ActivityDetailRequest: Identifiable, Equatable {
    let id: String
    let title: String
}

/// M6: native Aktivitäten (docs/native/NATIVE-BRIDGE-PROTOCOL.md §11).
///
/// - `pulsNativeSetActivity(true)` erst bei schreibbarem, zugeordnetem Dokument mit `activity`-Angebot. Lehnt das Web ab
///   (offener Web-Ablauf), folgt der nächste Versuch nach einer neuen `chrome`-Meldung. Eine reine Web-Live-/Startansicht
///   (nach Neuladen) minimiert das Web dabei selbst; Native zeigt dann seine Live-Ansicht.
/// - Vollbild (`overFullScreen`), die WebView bleibt darunter in der Hierarchie: GPS (`RunTracker`), Live-Aktivität und
///   km-Mitteilungen laufen unverändert über die Web-Nachrichten weiter. Native ruft `RunTracker`/`RunActivityCoordinator`
///   nie direkt.
/// - Schreibt nur über Ops; Uhren laufen lokal aus den Zeitbasen, alle Werte kommen aus Projektion/Query.
/// - Nach `run.summary.save` zeigt das Web seinen Endscreen; der native Trainings-Tab bleibt bis dahin verdeckt.
@Observable
@MainActor
final class ActivityCoordinator {
    static let screen = ProfileStore.activityScreen

    let store: ProfileStore
    @ObservationIgnored private let bridge: StateBridge
    @ObservationIgnored private weak var host: UIViewController?
    @ObservationIgnored private weak var flowController: UIViewController?

    /// Vollbild-Ablauf sichtbar.
    private(set) var isPresented = false
    var stage: ActivityStage = .start
    /// Gewählte Art; `nil` = `settings.lastType`.
    var selectedType: String?
    /// Gewählte Route (nur GPS-Arten).
    var selectedRouteId: String?
    /// Runden-Entwurf (MMA); `nil` = gespeicherte Einstellungen.
    var draftRounds: RoundSettings?
    /// Native Bildschirmsperre der Live-Ansicht (reine UI, kein Op).
    var isLocked = false
    var notice: TrainingNotice?
    /// Laufende eigene Aktionen (`start`, `pause`, `resume`, `lap`, `finish`, `save`, `discard`, `edit:<id>` …).
    private(set) var busyActions: Set<String> = []
    /// Nach `run.summary.save`: WebView mit dem Web-Endscreen zeigen, nicht den nativen Tab.
    private(set) var awaitingWebCompletion = false
    /// `run.finish` wartet mehrfach auf GPS-Punkte (`busy`): Knopf „Erneut versuchen“ anbieten.
    private(set) var finishStalled = false
    /// Ein eigener Befehl wird vom Web gehalten (`persist_failed`, `readonly`, `not_ready`, `busy`): Hinweis plus
    /// Ausweg (erneut senden mit derselben Befehls-ID, Abbrechen bzw. Minimieren). Schlüssel `start` bzw. `save`.
    private(set) var heldActions: Set<String> = []
    var summaryForm: ActivitySummaryForm?
    /// Entwurf mit Strecke/Splits/Runden (Query `summary`) für die Aktivität `key`.
    private(set) var summaryDetails: ActivitySummaryDraft?
    /// Routenliste als Sheet im Trainings-Tab.
    var showsRoutes = false
    /// Detail einer gespeicherten Aktivität als Sheet im Trainings-Tab.
    var detail: ActivityDetailRequest?
    /// Seit Öffnen ohne darstellbare Projektion: nach 3 s Web-Ausweg anbieten.
    private(set) var offersWebFallback = false
    /// Steigt bei Nutzer-/Dokumentwechsel; offene Query-Ansichten laden neu.
    var dataRevision: String { "\(store.activityGeneration)|\(store.seq)" }

    /// Shell: Web-Ausweg (Routenplaner, Web-Detail) nach dem Schließen nativer Ansichten.
    @ObservationIgnored var onOpenWeb: ((ActivityNavigation) -> Void)?
    @ObservationIgnored var styleProvider: (() -> UIUserInterfaceStyle)?

    @ObservationIgnored private var confirmedHello: Int?
    @ObservationIgnored private var confirming = false
    @ObservationIgnored private var rejectedAtChrome: Int?
    @ObservationIgnored private var suppressedHello: Int?
    @ObservationIgnored private var suppressionSawBlocking = false
    @ObservationIgnored private var handledAckSerial = 0
    /// Befehls-ID → Aktionsschlüssel, auf deren Ack die Oberfläche wartet.
    @ObservationIgnored private var waiting: [String: String] = [:]
    @ObservationIgnored private var countdownToken = 0
    @ObservationIgnored private var activeSince = Date.distantPast
    @ObservationIgnored private var finishRetries = 0
    @ObservationIgnored private var refinishedFor: Double?
    @ObservationIgnored private var completionSawSession = false
    @ObservationIgnored private var completionToken = 0
    @ObservationIgnored private var fallbackToken = 0
    @ObservationIgnored private var queryCounter = 0
    @ObservationIgnored private var summaryQueryKey: Double?
    @ObservationIgnored private var discardingConflicts: Set<String> = []
    /// Befehls-ID je Aktionsschlüssel (für Wiederholen/Abbrechen gehaltener Befehle).
    @ObservationIgnored private var commandIds: [String: String] = [:]
    /// Vom Web vorgewählte Route, deren Art erst mit der Projektion aufgelöst werden kann.
    @ObservationIgnored private var pendingRouteSelection: String?

    init(store: ProfileStore, bridge: StateBridge, host: UIViewController) {
        self.store = store
        self.bridge = bridge
        self.host = host
        handledAckSerial = store.recentAcks.last?.serial ?? 0
        observeStore()
    }

    // MARK: Zustand

    /// Das Web bietet native Aktivitäten an (Hello, Ops, geklärte Zuordnung, keine Vorschau).
    var isOffered: Bool { store.webOffersActivity }

    var projection: ActivityProjection? { store.currentActivity?.activity }

    var active: ActiveActivity? { projection?.active }

    /// Schreibende Aktionen möglich (keine Recovery/Upload-Sperre).
    var canWrite: Bool { isOffered && !store.isReadOnly && store.currentActivity?.flags.isReadOnly != true }

    var text: ActivityText {
        ActivityText(language: projection?.language ?? store.document["language"]?.stringValue, locale: projection?.locale)
    }

    func isBusy(_ action: String) -> Bool { busyActions.contains(action) }

    /// Die Projektion wird gebraucht (Interesse `activity`): Vollbild, Routen oder Detail offen.
    var needsProjection: Bool { isPresented || showsRoutes || detail != nil }

    /// Gewählte Art (Startansicht): eigene Wahl, sonst zuletzt genutzte, sonst die erste.
    var currentType: ActivityTypeInfo? {
        guard let projection else { return nil }
        return projection.type(selectedType) ?? projection.type(projection.settings.lastType) ?? projection.types.first
    }

    var currentRounds: RoundSettings { draftRounds ?? projection?.settings.rounds ?? .standard }

    /// Route nur für GPS-Arten und nur, wenn sie noch existiert.
    var currentRoute: ActivityRouteRow? {
        guard currentType?.gps == true else { return nil }
        return projection?.route(selectedRouteId)
    }

    // MARK: Beobachtung

    private func observeStore() {
        withObservationTracking {
            applyStoreState()
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observeStore() }
        }
    }

    private func applyStoreState() {
        updateConfirmation()
        processAcks()
        dropLiveConflicts()
        if pendingRouteSelection != nil, store.currentActivity != nil { resolvePendingRoute() }
        checkPresentation()
        checkCompletion()
    }

    private func updateConfirmation() {
        let helloCount = store.helloCount
        let chrome = store.webChrome
        _ = store.chromeCount
        if store.documentHello == nil || (confirmedHello != nil && confirmedHello != helloCount) {
            confirmedHello = nil
            rejectedAtChrome = nil
        }
        let blocking = chrome?.blocking == true
        if let suppressed = suppressedHello {
            if suppressed != helloCount {
                suppressedHello = nil
            } else if blocking {
                suppressionSawBlocking = true
            } else if suppressionSawBlocking {
                // Der Web-Ablauf des Auswegs ist beendet: wieder nativ anbieten.
                suppressedHello = nil
            }
        }
        let ready = store.documentHello != nil && canWrite
        guard ready, suppressedHello == nil else {
            if confirmedHello != nil {
                confirmedHello = nil
                bridge.setActivity(false)
            }
            return
        }
        // Eine reine Web-Live-/Startansicht (`reason:'run'`) darf das Web selbst minimieren; sonst nicht bei Sperre.
        let webRunView = chrome?.reason == "run"
        guard confirmedHello == nil, !confirming, !blocking || webRunView else { return }
        if let rejected = rejectedAtChrome, rejected == store.chromeCount { return }
        confirming = true
        bridge.setActivity(true) { [weak self] accepted in
            guard let self else { return }
            self.confirming = false
            if accepted, self.store.helloCount == helloCount {
                self.confirmedHello = helloCount
                self.rejectedAtChrome = nil
                // Das Web hatte seine Live-Ansicht selbst geöffnet (z. B. nach Neuladen): nativ weiterführen.
                if webRunView, self.store.currentActivity?.activity.active != nil || self.store.document["activeRun"]?.objectValue != nil {
                    self.open(stage: .active)
                }
            } else {
                self.rejectedAtChrome = self.store.chromeCount
            }
        }
    }

    private func checkPresentation() {
        if store.ownerPending, isPresented {
            close()
            return
        }
        guard isPresented else { return }
        // Nur echte Änderungen zuweisen: jede Zuweisung meldet eine Änderung und löst diese Prüfung erneut aus.
        let current = store.currentActivity
        if current != nil, offersWebFallback { offersWebFallback = false }
        // Inzwischen (z. B. auf einem anderen Gerät oder per Web) gestartet: Live-Ansicht statt Artwahl.
        if stage == .start, current?.activity.active != nil {
            stage = .active
            activeSince = Date()
        }
        guard stage == .active, let projection = current?.activity else { return }
        if let active = projection.active {
            activeSince = Date()
            // Abschluss sichtbar: Eingaben übernehmen (Web-Entwurf, z. B. nach Neuladen) und Details laden.
            if let summary = projection.currentSummary {
                if summaryForm?.key != summary.key {
                    summaryForm = ActivitySummaryForm(key: summary.key, feeling: summary.feeling, terrain: summary.terrain,
                                                      note: summary.note, manualKmText: ManualKmInput.text(summary.manualKm, locale: text.locale))
                }
                if busyActions.contains("finish") { busyActions.remove("finish") }
                if finishStalled { finishStalled = false }
                loadSummaryDetails(key: summary.key)
            } else if !active.paused, summaryDetails != nil || summaryQueryKey != nil {
                summaryDetails = nil
                summaryQueryKey = nil
            }
        } else if !isBusy("start"), !isBusy("save"), !isBusy("discard"), Date().timeIntervalSince(activeSince) > 3 {
            // Anderswo beendet, gespeichert oder verworfen: zurück zur Artwahl.
            stage = .start
            isLocked = false
            summaryForm = nil
            summaryDetails = nil
            notice = TrainingNotice(text: text("Die Aktivität ist nicht mehr aktiv.", "The activity is no longer active."), isWarning: false)
        }
    }

    /// Erneut prüfen (z. B. nach einer Wartezeit ohne neue Projektion).
    func reconcile() {
        checkPresentation()
    }

    // MARK: Einstiege

    /// `openNative{screen:'activity', startedAt, routeId}`: immer etwas zeigen. Eine mitgesendete Route
    /// („Diese Route nehmen“ im Web) wird in der Startansicht vorgewählt.
    func openFromWeb(startedAt: Double?, routeId: String?) {
        _ = store.consumeScreenRequest()
        let request = store.consumeActivityRequest()
        let requested = request.startedAt ?? startedAt
        if let route = request.routeId ?? routeId, ActivityIDs.isValid(route) { preselect(route: route) }
        let hasActive = requested != nil || active != nil || store.document["activeRun"]?.objectValue != nil
        open(stage: hasActive ? .active : .start)
    }

    /// Fortsetzen (Übersicht „Aktivität läuft“, Karte): `false`, wenn nativ nicht möglich.
    func resume() -> Bool {
        guard isOffered else { return false }
        open(stage: .active)
        return true
    }

    /// Startansicht bzw. laufende Aktivität öffnen.
    func openStart() {
        open(stage: active != nil ? .active : .start)
    }

    /// Route übernehmen und die Startansicht zeigen (wie Web `runSelectRoute`).
    func useRoute(_ id: String) {
        preselect(route: id)
        guard active == nil else {
            showsRoutes = false
            return
        }
        if showsRoutes {
            // Erst das Routen-Sheet schließen lassen, sonst würde die Vollbildansicht mit ihm verschwinden.
            showsRoutes = false
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(500))
                self?.open(stage: .start)
            }
        } else {
            open(stage: .start)
        }
    }

    /// Route vorwählen; eine Route gilt nur für GPS-Arten, daher ggf. die erste GPS-Art wählen (nicht gespeichert,
    /// erst die bewusste Artwahl speichert `lastType`).
    /// Kommt die Wahl vor der ersten Projektion (z. B. `openNative{routeId}` direkt nach dem Öffnen), wird die Art
    /// beim Eintreffen der Projektion aufgelöst (`resolvePendingRoute`).
    func preselect(route id: String) {
        selectedRouteId = id
        pendingRouteSelection = id
        resolvePendingRoute()
    }

    private func resolvePendingRoute() {
        guard let id = pendingRouteSelection, let projection else { return }
        pendingRouteSelection = nil
        guard selectedRouteId == id else { return }
        if let type = projection.gpsType(preferring: selectedType ?? projection.settings.lastType), selectedType != type.id,
           currentType?.gps != true {
            selectedType = type.id
        }
    }

    func open(stage requested: ActivityStage) {
        if active != nil || requested == .active {
            stage = .active
            activeSince = Date()
        } else if case .countdown = stage {
            // Laufender Countdown bleibt.
        } else if stage != .starting {
            stage = .start
        }
        if isPresented, let controller = flowController, controller.presentingViewController != nil { return }
        guard let presenter = topPresenter() else {
            fallBackToWeb()
            return
        }
        isPresented = true
        startFallbackTimer()
        let controller = UIHostingController(rootView: ActivityFlowHost(coordinator: self))
        controller.modalPresentationStyle = .overFullScreen
        controller.modalPresentationCapturesStatusBarAppearance = true
        controller.overrideUserInterfaceStyle = styleProvider?() ?? .dark
        controller.view.backgroundColor = .systemBackground
        flowController = controller
        presenter.present(controller, animated: true)
        bridge.readWebScheme { [weak controller] scheme in
            guard let scheme else { return }
            controller?.overrideUserInterfaceStyle = scheme == "light" ? .light : .dark
        }
    }

    private func startFallbackTimer() {
        offersWebFallback = false
        fallbackToken += 1
        let token = fallbackToken
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, self.fallbackToken == token, self.isPresented, self.store.currentActivity == nil else { return }
            self.offersWebFallback = true
        }
    }

    /// Minimieren: Ansicht schließen, die Aktivität läuft weiter (Karte, Übersicht, Live-Aktivität).
    func close() {
        isLocked = false
        isPresented = false
        countdownToken += 1
        if case .countdown = stage { stage = .start }
        guard let controller = flowController else { return }
        flowController = nil
        if controller.presentingViewController != nil { controller.dismiss(animated: true) }
    }

    private func topPresenter() -> UIViewController? {
        guard let host, host.viewIfLoaded?.window != nil else { return nil }
        var top: UIViewController = host
        while let presented = top.presentedViewController {
            if presented.isBeingDismissed { break }
            top = presented
        }
        if top is UIAlertController || top.isBeingDismissed { return nil }
        return top
    }

    /// Ausweg: Web-Aktivitätsansicht für genau diesen Aufruf (`{action:'activity', web:true}`); danach öffnen
    /// Web-Einstiege wieder die Web-Ansicht, bis dieser Web-Ablauf endet.
    func fallBackToWeb() {
        close()
        suppressedHello = store.helloCount
        suppressionSawBlocking = false
        confirmedHello = nil
        let bridge = bridge
        bridge.setActivity(false) { _ in
            if let target = ActivityNavigation(action: "activity") { bridge.navigateActivity(target) }
        }
        let hello = store.helloCount
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard let self, self.suppressedHello == hello, !self.suppressionSawBlocking else { return }
            self.suppressedHello = nil
            self.applyStoreState()
        }
    }

    /// Web-Auswege (Routenplaner, Web-Detail mit Karte/„Als Route sichern“): eigene Ansichten vorher schließen.
    func openWeb(_ target: ActivityNavigation?) {
        guard let target else { return }
        showsRoutes = false
        detail = nil
        if isPresented { close() }
        onOpenWeb?(target)
    }

    // MARK: Start

    /// Art wählen (wie `runChooseType`: wird gespeichert; Route nur bei GPS-Arten).
    func choose(type: ActivityTypeInfo) {
        selectedType = type.id
        if !type.gps { selectedRouteId = nil }
        let stored = store.document["runSettings"]?["lastType"]?.stringValue
        guard canWrite, stored != type.id, let command = ActivityCommands.settings(lastType: type.id) else { return }
        perform(command, busyKey: nil)
    }

    /// Runden übernehmen (wie `runRoundsSave`).
    func applyRounds(_ rounds: RoundSettings) {
        guard rounds.isValid else { return }
        draftRounds = rounds
        guard canWrite, let command = ActivityCommands.settings(rounds: rounds) else { return }
        perform(command, busyKey: nil)
    }

    func beginCountdown() {
        guard canWrite, currentType != nil else {
            notice = TrainingNotice(text: describe(ProfileStoreError.readOnly))
            return
        }
        let seconds = projection?.settings.countdownSeconds ?? 10
        scheduleCountdown(endsAt: Date().addingTimeInterval(TimeInterval(seconds)))
    }

    /// „+10 Sekunden“.
    func extendCountdown() {
        guard case .countdown(let endsAt) = stage else { return }
        scheduleCountdown(endsAt: endsAt.addingTimeInterval(10))
    }

    func cancelCountdown() {
        countdownToken += 1
        if case .countdown = stage { stage = .start }
    }

    private func scheduleCountdown(endsAt: Date) {
        stage = .countdown(endsAt: endsAt)
        countdownToken += 1
        let token = countdownToken
        Task { @MainActor [weak self] in
            let wait = endsAt.timeIntervalSinceNow
            if wait > 0 { try? await Task.sleep(for: .milliseconds(Int(wait * 1000))) }
            guard let self, self.countdownToken == token, case .countdown = self.stage else { return }
            self.startNow()
        }
    }

    /// Countdown bei 0 oder „Jetzt starten“: `run.start` (dort exakt der Web-Startpfad inkl. GPS/Live-Aktivität).
    func startNow() {
        countdownToken += 1
        if let active {
            stage = .active
            activeSince = Date()
            _ = active
            return
        }
        guard let type = currentType else {
            stage = .start
            return
        }
        let route = type.gps ? currentRoute?.id : nil
        let rounds = type.id == "mma" ? currentRounds : nil
        guard let command = ActivityCommands.start(type: type.id, routeId: route, rounds: rounds),
              perform(command, busyKey: "start") != nil else {
            stage = .start
            return
        }
        stage = .starting
    }

    // MARK: Live-Steuerung

    func pause() {
        guard let active, active.controlsEnabled, !active.paused, let command = ActivityCommands.pause(startedAt: active.startedAt) else { return }
        perform(command, busyKey: "pause")
    }

    func resumeRun() {
        guard let active, active.controlsEnabled, active.paused, let command = ActivityCommands.resume(startedAt: active.startedAt) else { return }
        perform(command, busyKey: "resume")
    }

    func lap() {
        guard let active, active.controlsEnabled, !active.paused, let command = ActivityCommands.lap(startedAt: active.startedAt) else { return }
        perform(command, busyKey: "lap")
    }

    func finish() {
        guard let active, active.controlsEnabled, let command = ActivityCommands.finish(startedAt: active.startedAt) else { return }
        finishRetries = 0
        finishStalled = false
        isLocked = false
        perform(command, busyKey: "finish")
    }

    /// `run.finish` wartet noch auf GPS-Punkte: erneut senden (die Pause und alle Punkte bleiben im Web erhalten).
    func retryFinish() {
        finishStalled = false
        finishRetries = 0
        if store.hasUnconfirmedActivity({ $0.op == ActivityOps.runFinish }) {
            busyActions.insert("finish")
            store.retryPending()
        } else {
            finish()
        }
    }

    // MARK: Abschluss

    func saveSummary() {
        guard let active, active.paused, let form = summaryForm, form.key == active.startedAt else { return }
        guard let manual = ManualKmInput.parse(form.manualKmText) else {
            notice = TrainingNotice(text: text("Bitte eine gültige Distanz eingeben (0 bis 1000 km).", "Please enter a valid distance (0 to 1000 km)."))
            return
        }
        let allowed = projection?.currentSummary?.manualDistanceAllowed == true
        let pausedAt = store.document["activeRun"]?["pausedAt"]?.doubleValue ?? active.pausedAt
        guard let pausedAt,
              let command = ActivityCommands.saveSummary(startedAt: active.startedAt, pausedAt: pausedAt, feeling: form.feeling,
                                                         terrain: terrainAllowed ? form.terrain : nil, note: form.note,
                                                         manualKm: allowed ? manual : ManualDistance.none) else { return }
        perform(command, busyKey: "save")
    }

    /// Untergrund wie im Web nur für Lauf-/Geh-Arten.
    var terrainAllowed: Bool {
        guard let active else { return false }
        return projection?.type(active.type)?.category != "other"
    }

    func discard() {
        guard let active, active.controlsEnabled, let command = ActivityCommands.discard(startedAt: active.startedAt) else { return }
        perform(command, busyKey: "discard")
    }

    private func loadSummaryDetails(key: Double) {
        guard summaryQueryKey != key else { return }
        summaryQueryKey = key
        Task { @MainActor [weak self] in
            guard let self else { return }
            let phase = await self.fetch { ActivityQueryRequest.summary(requestId: $0) }
            guard self.summaryQueryKey == key, case .loaded(let message) = phase, case .summary(let draft)? = message.result,
                  draft.key == key else { return }
            self.summaryDetails = draft
        }
    }

    // MARK: Gespeicherte Aktivitäten und Routen

    func edit(id: String, type: String, feeling: Int?, terrain: String?, note: String, expect: ActivityEdit?) -> Bool {
        guard let command = ActivityCommands.edit(id: id, type: type, feeling: feeling, terrain: terrain, note: note, expect: expect) else {
            return false
        }
        return perform(command, busyKey: "edit:" + id) != nil
    }

    func delete(id: String, expect: ActivityEdit?) -> Bool {
        guard let command = ActivityCommands.delete(id: id, expect: expect) else { return false }
        return perform(command, busyKey: "delete:" + id) != nil
    }

    func deleteRoute(id: String) {
        guard let command = ActivityCommands.deleteRoute(id: id) else { return }
        if selectedRouteId == id { selectedRouteId = nil }
        perform(command, busyKey: "route:" + id)
    }

    // MARK: Queries

    /// Registriert, sendet und wartet auf die passende Antwort (höchstens `timeout`). Abbruch der Task gibt sie auf.
    func fetch(timeout: Duration = .seconds(6), _ build: (String) -> ActivityQueryRequest?) async -> LoadPhase<ActivityResultMessage> {
        queryCounter += 1
        let requestId = "activity-\(queryCounter)-" + UUID().uuidString.prefix(8).lowercased()
        guard let request = build(requestId) else { return .failed }
        store.registerActivityQuery(request)
        let bridge = bridge
        let sent = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            bridge.activityQuery(request) { continuation.resume(returning: $0) }
        }
        guard sent else {
            store.forgetActivityQuery(requestId)
            return .failed
        }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while !Task.isCancelled {
            if let result = store.activityResult(requestId) {
                if result.ok { return .loaded(result) }
                return result.isGone ? .gone : .failed
            }
            guard store.isActivityQueryPending(requestId), clock.now < deadline else { break }
            try? await Task.sleep(for: .milliseconds(40))
        }
        store.forgetActivityQuery(requestId)
        return .failed
    }

    // MARK: Befehle

    @discardableResult
    private func perform(_ command: Command, busyKey: String?) -> ApplyCommand? {
        do {
            let apply = try store.performActivity(command, asUser: store.userId)
            if let busyKey {
                busyActions.insert(busyKey)
                heldActions.remove(busyKey)
                waiting[apply.id] = busyKey
                commandIds[busyKey] = apply.id
            }
            return apply
        } catch {
            notice = TrainingNotice(text: describe(error))
            return nil
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

    // MARK: Acks

    private func processAcks() {
        let events = store.recentAcks.filter { $0.serial > handledAckSerial }
        guard let last = events.last else { return }
        handledAckSerial = last.serial
        for event in events where ActivityOps.isActivity(event.op) {
            handle(event)
        }
    }

    private static let heldCodes: Set<AckErrorCode> = [.busy, .readonly, .persistFailed, .notReady]

    private func handle(_ event: AckEvent) {
        let key = waiting[event.commandId]
        let held = event.code.map(Self.heldCodes.contains) ?? false
        if !held {
            waiting[event.commandId] = nil
            if let key {
                busyActions.remove(key)
                heldActions.remove(key)
            }
        } else {
            noteHeld(event, key: key)
        }
        if event.code == .conflict, ActivityOps.liveControl.contains(event.op) {
            // Koordinator-Entscheidung: nicht parken, den neuen Stand zeigen und die Aktion neu anbieten.
            discardLiveConflict(id: event.commandId)
        }
        switch event.op {
        case ActivityOps.runStart:
            handleStart(event, held: held)
        case ActivityOps.runFinish:
            handleFinish(event, held: held)
        case ActivityOps.summarySave:
            handleSave(event)
        case ActivityOps.runDiscard:
            if event.ok || event.code == .gone {
                stage = .start
                summaryForm = nil
                summaryDetails = nil
                if key != nil, isPresented { close() }
            } else if !held, event.code != .conflict {
                show(event)
            }
        case ActivityOps.runPause, ActivityOps.runResume, ActivityOps.runLap:
            if event.code == .conflict {
                notice = TrainingNotice(text: text("Die Aktivität wurde inzwischen geändert. Die Anzeige zeigt den aktuellen Stand.",
                                                   "The activity changed in the meantime. The view shows the current state."))
            } else if !event.ok, !held {
                show(event)
            }
        case ActivityOps.settingsSet:
            if event.code == .conflict {
                notice = TrainingNotice(text: text("Die Einstellungen wurden inzwischen geändert.", "The settings changed in the meantime."),
                                        isWarning: false)
            } else if !event.ok, !held {
                show(event)
            }
        default:
            // Bearbeiten/Löschen/Routen: Konflikte bleiben geparkt und erscheinen in der Liste.
            if !event.ok, !held, event.code != .conflict { show(event) }
        }
    }

    /// Gehaltene Befehle (§6: in der Outbox, später erneut): nie ein Warte-Zustand ohne Ausweg. Start und Speichern
    /// zeigen Hinweis plus „Erneut senden“ (dieselbe Befehls-ID); Steuerknöpfe werden wieder bedienbar (eine
    /// Wiederholung ist im Web ein Noop: gleicher `expect`).
    private func noteHeld(_ event: AckEvent, key: String?) {
        let reason: String
        switch event.code {
        case .persistFailed?: reason = text("PULS konnte gerade nicht speichern.", "PULS could not save right now.")
        case .readonly?: reason = text("PULS ist gerade nur lesbar.", "PULS is read only right now.")
        case .notReady?: reason = text("PULS ist noch nicht bereit.", "PULS is not ready yet.")
        default: reason = text("In PULS ist gerade ein anderer Ablauf offen.", "Another flow is open in PULS right now.")
        }
        switch event.op {
        case ActivityOps.runStart:
            heldActions.insert("start")
            notice = TrainingNotice(text: reason + " " + text("Der Start ist noch nicht bestätigt.", "The start is not confirmed yet."))
        case ActivityOps.summarySave:
            heldActions.insert("save")
            notice = TrainingNotice(text: reason + " " + text("Die Aktivität ist noch nicht gespeichert.", "The activity is not saved yet."))
        case ActivityOps.runFinish where event.code != .busy:
            finishStalled = true
            notice = TrainingNotice(text: reason)
        case ActivityOps.runPause, ActivityOps.runResume, ActivityOps.runLap:
            if let key { busyActions.remove(key) }
            notice = TrainingNotice(text: reason + " " + text("Wird erneut gesendet.", "Will be sent again."))
        default:
            break
        }
    }

    /// Gehaltenen Befehl (`start` bzw. `save`) mit derselben Befehls-ID erneut senden.
    func retryHeld(_ key: String) {
        heldActions.remove(key)
        guard let id = commandIds[key], store.hasUnconfirmedActivity({ $0.id == id }) else {
            busyActions.remove(key)
            if key == "start", stage == .starting { stage = .start }
            return
        }
        store.retryPending()
    }

    /// Noch nicht ausgeführten Start verwerfen (gehalten oder ohne Antwort) und zur Artwahl zurück.
    func cancelPendingStart() {
        if let id = commandIds["start"], store.pending.contains(where: { $0.command.id == id }) {
            do { try store.discardCommand(id: id) } catch { notice = TrainingNotice(text: describe(error)) }
        }
        busyActions.remove("start")
        heldActions.remove("start")
        if stage == .starting { stage = .start }
    }

    private func handleStart(_ event: AckEvent, held: Bool) {
        guard !held else { return }
        if event.ok {
            stage = .active
            activeSince = Date()
            if event.result?["started"]?.boolValue == false {
                notice = TrainingNotice(text: text("Es läuft bereits eine Aktivität.", "An activity is already in progress."), isWarning: false)
            }
        } else if stage == .starting || isPresented {
            stage = .start
            switch event.code {
            case .conflict?:
                notice = TrainingNotice(text: text("Inzwischen wurde eine Aktivität gespeichert (z. B. auf einem anderen Gerät). Bitte erneut starten.",
                                                   "An activity was saved in the meantime (for example on another device). Please start again."))
            case .gone?:
                selectedRouteId = nil
                notice = TrainingNotice(text: text("Die Route ist nicht mehr verfügbar.", "The route is no longer available."))
            default:
                show(event)
            }
        }
    }

    private func handleFinish(_ event: AckEvent, held: Bool) {
        if event.ok {
            finishStalled = false
            // Die Projektion bringt den Entwurf; bis dahin bleibt „GPS wird abgeschlossen“ sichtbar.
            busyActions.insert("finish")
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .seconds(4))
                self?.busyActions.remove("finish")
            }
            return
        }
        if event.code == .busy {
            // GPS-Punkte fehlen noch: die Pause bleibt im Web; einige Male selbst erneut senden.
            finishRetries += 1
            if finishRetries <= 3 {
                Task { @MainActor [weak self] in
                    try? await Task.sleep(for: .milliseconds(1500))
                    guard let self, self.store.hasUnconfirmedActivity({ $0.id == event.commandId }) else { return }
                    self.store.retryPending()
                }
            } else {
                finishStalled = true
            }
            return
        }
        guard !held else { return }
        finishStalled = false
        switch event.code {
        case .conflict?:
            notice = TrainingNotice(text: text("Die Aktivität wurde inzwischen fortgesetzt.", "The activity was resumed in the meantime."))
        case .gone?:
            notice = TrainingNotice(text: text("Die Aktivität ist nicht mehr aktiv.", "The activity is no longer active."))
        default:
            show(event)
        }
    }

    private func handleSave(_ event: AckEvent) {
        if event.ok {
            // Das Web zeigt jetzt seinen Endscreen (`chrome.reason:'session'`).
            summaryForm = nil
            summaryDetails = nil
            summaryQueryKey = nil
            stage = .start
            selectedRouteId = nil
            beginWebCompletion()
            close()
            return
        }
        switch event.code {
        case .gone?:
            restoreSummary(from: event)
        case .conflict?:
            notice = TrainingNotice(text: text("Die Aktivität wurde inzwischen fortgesetzt oder anders gespeichert.",
                                               "The activity was resumed or saved differently in the meantime."))
        case .busy?, .readonly?, .persistFailed?, .notReady?:
            break
        default:
            show(event)
        }
    }

    /// `run.summary.save` → `gone` (Web-Entwurf fehlt, z. B. Replay nach App-Neustart): Eingaben aus dem abgelehnten
    /// Befehl wiederherstellen (an `startedAt` gebunden), einmal erneut `run.finish` senden; der frische Entwurf wird
    /// dann mit diesen Eingaben vorbelegt (`checkPresentation` behält ein Formular mit passendem `key`).
    private func restoreSummary(from event: AckEvent) {
        guard let inputs = ActivityCommands.summaryInputs(from: event.args) else {
            show(event)
            return
        }
        let raw = store.document["activeRun"]
        guard raw?["startedAt"]?.doubleValue == inputs.startedAt else {
            notice = TrainingNotice(text: text("Die Aktivität ist nicht mehr aktiv.", "The activity is no longer active."))
            return
        }
        summaryForm = ActivitySummaryForm(key: inputs.startedAt, feeling: inputs.feeling, terrain: inputs.terrain, note: inputs.note,
                                          manualKmText: ManualKmInput.text(inputs.manualKm, locale: text.locale))
        if refinishedFor != inputs.startedAt, let command = ActivityCommands.finish(startedAt: inputs.startedAt) {
            refinishedFor = inputs.startedAt
            finishRetries = 0
            finishStalled = false
            perform(command, busyKey: "finish")
        }
        notice = TrainingNotice(text: text("Bitte noch einmal speichern. Deine Eingaben bleiben erhalten.",
                                           "Please save again. Your entries are kept."), isWarning: false)
        if !isPresented { open(stage: .active) }
    }

    private func show(_ event: AckEvent) {
        notice = TrainingNotice(text: text.failure(event.code, message: event.message))
    }

    /// Geparkte Konflikte der Live-Steuerung (auch aus früheren App-Sitzungen) nicht stehen lassen.
    private func dropLiveConflicts() {
        let stale = store.activityConflicts.filter { ActivityOps.liveControl.contains($0.command.op) }
        for entry in stale { discardLiveConflict(id: entry.command.id) }
    }

    private func discardLiveConflict(id: String) {
        guard !discardingConflicts.contains(id) else { return }
        discardingConflicts.insert(id)
        // Außerhalb der Beobachtung ändern.
        Task { @MainActor [weak self] in
            guard let self else { return }
            try? self.store.discardActivityConflict(id: id, asUser: self.store.userId)
            self.discardingConflicts.remove(id)
        }
    }

    // MARK: Konflikte (Bearbeiten, Löschen, Routen)

    var conflicts: [OutboxEntry] {
        store.activityConflicts.filter { !ActivityOps.liveControl.contains($0.command.op) }
    }

    func discardConflict(id: String) {
        do { try store.discardActivityConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    func reapplyConflict(id: String) {
        do { try store.reapplyActivityConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    // MARK: Web-Endscreen

    private func beginWebCompletion() {
        awaitingWebCompletion = true
        completionSawSession = false
        completionToken += 1
        let token = completionToken
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, self.completionToken == token, !self.completionSawSession else { return }
            self.awaitingWebCompletion = false
        }
    }

    private func checkCompletion() {
        let chrome = store.webChrome
        guard awaitingWebCompletion else { return }
        if chrome?.blocking == true {
            completionSawSession = true
        } else if completionSawSession {
            awaitingWebCompletion = false
            completionSawSession = false
        }
    }
}
