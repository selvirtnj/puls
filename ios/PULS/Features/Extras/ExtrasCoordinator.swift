import SwiftUI
import UIKit
import Observation
import PULSCore

/// Antwort einer `pulsNativeQuery`, vom Aufrufer auszuwerten.
enum NativeFetch: Equatable {
    case ok(JSONValue)
    case gone
    /// Cursor verfallen: Teilmenge verwerfen und neu beginnen.
    case stale
    /// Provider fehlt in diesem Dokument.
    case unavailable
    /// Nicht gesendet bzw. vom Web ohne Antwort abgelehnt (ungültige Form), Zeitlimit oder sonstiger Fehler.
    case failed
}

/// Ergebnis eines einzelnen Durchlaufs durch alle Abschnitte.
enum AssembleOutcome: Equatable {
    case loaded(AssembledContent)
    case gone
    case stale
    case failed
}

/// Vollständig zusammengesetzter Inhalt (`encoding`: `text` oder `json`) mit den Metadaten des ersten Abschnitts.
struct AssembledContent: Equatable {
    let text: String
    let parsed: JSONValue?
    let meta: JSONValue?
}

/// Lokale Datei für das Teilen-Blatt; wird nach dem Schließen gelöscht.
struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}

/// Text für das Teilen-Blatt.
struct ShareText: Identifiable {
    let id = UUID()
    let text: String
}

/// N1 (docs/native/NATIVE-BRIDGE-PROTOCOL.md §15): gemeinsame Query, Abschnitte, Abschlüsse, Export und Teilen.
///
/// - Alles nur, wenn das aktuelle Dokument Feature und Query meldet (`offers`); sonst bleibt der bisherige Web-Weg.
/// - Queries sind kein Wirkungsnachweis, Cursor nie dauerhaft. `stale_cursor` beginnt neu.
/// - Abschlüsse: Der Store hält sie dauerhaft; hier nur die Darstellung. XP nur anzeigen, nie berechnen.
@Observable
@MainActor
final class ExtrasCoordinator {
    let store: ProfileStore
    @ObservationIgnored private let bridge: StateBridge
    @ObservationIgnored private weak var host: UIViewController?
    @ObservationIgnored private weak var completionController: UIViewController?

    /// Hell/Dunkel wie die Shell bzw. die Web-App.
    @ObservationIgnored var styleProvider: (() -> UIUserInterfaceStyle)?
    /// `false`, solange ein Vollbild-Ablauf noch schließt (eine Präsentation darauf würde mit ihm verschwinden).
    @ObservationIgnored var canPresentCompletion: (() -> Bool)?
    /// Hinweis zu Übungseinstellungen bzw. Route (Anzeige im jeweiligen Bereich).
    @ObservationIgnored var onSettingsNotice: ((String) -> Void)?
    @ObservationIgnored var onRouteNotice: ((String) -> Void)?

    @ObservationIgnored private var queryCounter = 0
    @ObservationIgnored private var handledAckSerial = 0
    @ObservationIgnored private var presentationLoop = false
    /// Gerade gezeigter Abschluss samt Besitzer.
    @ObservationIgnored private var shownCompletion: CompletionRecord?

    init(store: ProfileStore, bridge: StateBridge, host: UIViewController) {
        self.store = store
        self.bridge = bridge
        self.host = host
        handledAckSerial = store.recentAcks.last?.serial ?? 0
        observeStore()
    }

    // MARK: Zustand

    func offers(_ kind: NativeQueryRequest.Kind) -> Bool { store.offersExtras(kind) }

    /// Datenstand für Listen und Diagramme: neuer Snapshot oder Dokument-/Nutzerwechsel lädt neu.
    var dataRevision: String { "\(store.extrasGeneration)|\(store.seq)" }

    var language: String? { store.document["language"]?.stringValue }
    var text: OverviewText { OverviewText(language: language, locale: nil) }

    // MARK: Query

    func fetch(timeout: Duration = .seconds(8), _ build: (String) -> NativeQueryRequest?) async -> NativeFetch {
        queryCounter += 1
        let requestId = "extras-\(queryCounter)-" + UUID().uuidString.prefix(8).lowercased()
        guard let request = build(requestId) else { return .failed }
        store.registerNativeQuery(request)
        let bridge = bridge
        let sent = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            bridge.nativeQuery(request) { continuation.resume(returning: $0) }
        }
        guard sent else {
            store.forgetNativeQuery(requestId)
            return .failed
        }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while !Task.isCancelled {
            if let message = store.nativeResult(requestId) {
                store.forgetNativeQuery(requestId)
                if message.ok, let result = message.result { return .ok(result) }
                if message.isStaleCursor { return .stale }
                if message.isUnavailable { return .unavailable }
                return message.isGone ? .gone : .failed
            }
            guard store.isNativeQueryPending(requestId), clock.now < deadline else { break }
            try? await Task.sleep(for: .milliseconds(30))
        }
        store.forgetNativeQuery(requestId)
        return .failed
    }

    /// Ein Durchlauf durch alle Abschnitte. `build(cursor, requestId)` baut die Anfrage; `first` ist ein bereits erhaltener
    /// erster Abschnitt. Verfällt ein Cursor, meldet das `.stale`: Der Aufrufer entscheidet über den Neuanfang.
    func assembleOnce(first: NativeChunk? = nil, _ build: (String?, String) -> NativeQueryRequest?) async -> AssembleOutcome {
        var assembler = ChunkAssembler()
        var next = first
        var cursor: String?
        var started = false
        while !Task.isCancelled {
            if let chunk = next {
                next = nil
                guard assembler.append(chunk) else { return .stale }
                started = true
                cursor = chunk.nextCursor
                if cursor == nil { break }
            }
            let current = cursor
            switch await fetch({ build(current, $0) }) {
            case .ok(let result):
                guard let chunk = NativeChunk(json: result) else { return .failed }
                next = chunk
            case .gone:
                return .gone
            case .stale:
                return .stale
            case .unavailable, .failed:
                return .failed
            }
        }
        guard !Task.isCancelled, started, assembler.isComplete else { return .failed }
        return .loaded(AssembledContent(text: assembler.text, parsed: assembler.parsed(), meta: assembler.meta))
    }

    /// Eigenständiger Inhalt (Abschluss, Indexchart, Export, Teilen): Verfällt ein Cursor, beginnt er neu, höchstens dreimal.
    func assemble(_ build: (String?, String) -> NativeQueryRequest?) async -> LoadPhase<AssembledContent> {
        for _ in 0..<3 {
            switch await assembleOnce(build) {
            case .loaded(let content): return .loaded(content)
            case .gone: return .gone
            case .failed: return .failed
            case .stale: continue
            }
        }
        return .failed
    }

    // MARK: Export und Teilen

    /// Ordner der Exportkopie: Sie gehört nur dem Teilen-Blatt und wird in jedem Pfad gelöscht.
    nonisolated static var exportFolder: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("puls-export", isDirectory: true)
    }

    nonisolated static func removeExportFiles() {
        try? FileManager.default.removeItem(at: exportFolder)
    }

    /// Export als lokale Datei; Dateiname und Inhalt stammen unverändert aus dem Web. Abgebrochen entsteht keine Datei.
    func exportFile(csv: NativeCSVKind?) async -> URL? {
        let result = await assemble { cursor, requestId in
            NativeQueryRequest.export(csv: csv, cursor: cursor, requestId: requestId)
        }
        guard case .loaded(let content) = result, !Task.isCancelled else { return nil }
        let rawName = content.meta?["name"]?.stringValue ?? "puls-export.txt"
        let name = (rawName as NSString).lastPathComponent
        let folder = Self.exportFolder
        let url = folder.appendingPathComponent(name.isEmpty ? "puls-export.txt" : name)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try Data(content.text.utf8).write(to: url, options: [.atomic, .completeFileProtection])
            return url
        } catch {
            Self.removeExportFiles()
            return nil
        }
    }

    /// Fertiger Web-Text; bei Läufen eine Darstellung aus den gelieferten Daten (keine eigene Formel).
    func shareText(collection: String, id: String) async -> String? {
        let result = await assemble { cursor, requestId in
            NativeQueryRequest.share(collection: collection, id: id, cursor: cursor, requestId: requestId)
        }
        guard case .loaded(let content) = result, let share = NativeShare(json: content.parsed) else { return nil }
        if let text = share.text { return text }
        guard let run = share.run else { return nil }
        return Self.runText(run, text: ActivityText(language: language, locale: nil))
    }

    private static func runText(_ detail: StoredActivityDetail, text: ActivityText) -> String {
        let entry = detail.entry
        var lines = ["PULS", entry.name.isEmpty ? text("Aktivität", "Activity") : entry.name]
        if let startedAt = entry.startedAt {
            lines.append(text.startDate(startedAt))
        } else if let date = entry.date {
            lines.append(date)
        }
        if let km = entry.distanceKm, km > 0 { lines.append(text.km(km) + " km") }
        if let seconds = entry.durationSeconds { lines.append(text("Dauer", "Duration") + " " + text.clock(seconds)) }
        if let pace = entry.paceText, (entry.distanceKm ?? 0) > 0 { lines.append("Pace " + pace) }
        if let gain = detail.elevationGain { lines.append(text("Höhenmeter", "Elevation gain") + " " + text.number(gain, digits: 0) + " m") }
        if !detail.note.isEmpty { lines.append(detail.note) }
        return lines.joined(separator: "\n")
    }

    // MARK: Ops

    /// `exercise.settings.set`; `expect` = beim Öffnen gesehene Rohzeile.
    @discardableResult
    func saveExerciseSettings(_ command: Command) -> Bool {
        perform(command) { [weak self] message in self?.onSettingsNotice?(message) }
    }

    /// `route.fromRun`: die Routen-ID entsteht hier und bleibt mit dem Befehl in der Outbox.
    @discardableResult
    func saveRoute(runId: String, name: String) -> Bool {
        guard let command = ExtrasCommands.routeFromRun(runId: runId, routeId: UUID().uuidString.lowercased(), name: name) else {
            return false
        }
        return perform(command) { [weak self] message in self?.onRouteNotice?(message) }
    }

    private func perform(_ command: Command, report: (String) -> Void) -> Bool {
        do {
            try store.performExtras(command, asUser: store.userId)
            return true
        } catch {
            report(text("Die Änderung wurde nicht übernommen.", "The change was not applied."))
            return false
        }
    }

    // MARK: Beobachtung

    private func observeStore() {
        withObservationTracking {
            processAcks()
            hideForeignCompletion()
            if store.currentCompletion != nil { startPresentationLoop() }
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observeStore() }
        }
    }

    private static let heldCodes: Set<AckErrorCode> = [.busy, .readonly, .persistFailed, .notReady]

    /// Einstellungen und Route haben keine eigene Konfliktliste: ein Konflikt wird verworfen und gemeldet (es gilt der
    /// aktuelle Stand, die Ansicht lädt neu).
    private func processAcks() {
        let events = store.recentAcks.filter { $0.serial > handledAckSerial }
        guard let last = events.last else { return }
        handledAckSerial = last.serial
        for event in events where event.op == ExtrasOps.exerciseSettingsSet || event.op == ExtrasOps.routeFromRun {
            let isRoute = event.op == ExtrasOps.routeFromRun
            let report = isRoute ? onRouteNotice : onSettingsNotice
            if event.ok {
                if isRoute { report?(text("Route gesichert.", "Route saved.")) }
                continue
            }
            if let code = event.code, Self.heldCodes.contains(code) { continue }
            if event.code == .conflict {
                let id = event.commandId
                // Außerhalb der Beobachtung ändern.
                Task { @MainActor [weak self] in try? self?.store.discardCommand(id: id) }
                report?(text("Inzwischen anders gespeichert. Es gilt der aktuelle Stand.", "Saved differently in the meantime. The current state applies."))
            } else {
                report?(text("Nicht gespeichert", "Not saved") + (event.message.map { ": \($0)" } ?? "."))
            }
        }
    }

    // MARK: Abschluss zeigen

    /// Versucht es, bis der Abschluss sichtbar ist: nach dem Speichern schließen sich Session bzw. Aktivität erst noch.
    private func startPresentationLoop() {
        guard !presentationLoop, completionController == nil else { return }
        presentationLoop = true
        Task { @MainActor [weak self] in
            while let self, self.completionController == nil, let record = self.store.currentCompletion {
                if self.present(record) { break }
                try? await Task.sleep(for: .milliseconds(400))
            }
            self?.presentationLoop = false
        }
    }

    private func present(_ record: CompletionRecord) -> Bool {
        guard let host, host.viewIfLoaded?.window != nil, host.presentedViewController == nil, !host.isBeingDismissed,
              canPresentCompletion?() != false else { return false }
        guard let completion = NativeCompletion(json: record.completion) else {
            // Nicht lesbar (künftiger Web-Stand): nicht immer wieder versuchen.
            store.dismissCompletion(record)
            return false
        }
        let view = CompletionHost(coordinator: self, record: record, completion: completion)
        let controller = UIHostingController(rootView: view)
        controller.modalPresentationStyle = .overFullScreen
        controller.modalPresentationCapturesStatusBarAppearance = true
        let bridge = bridge
        NativeAppearance.apply(to: controller, store: store, fallback: styleProvider?() ?? .dark) { bridge.readWebScheme($0) }
        controller.view.backgroundColor = .systemBackground
        completionController = controller
        shownCompletion = record
        host.present(controller, animated: true)
        return true
    }

    /// Kontowechsel oder ungeklärter Besitzer: Abschluss schließen, ohne ihn als gesehen zu werten. Er bleibt seinem Konto
    /// erhalten und erscheint dort wieder.
    private func hideForeignCompletion() {
        guard let shown = shownCompletion, !store.completionIsVisible(shown) else { return }
        shownCompletion = nil
        removeCompletionController()
    }

    /// Bewusst schließen: erst jetzt bestätigt Native über die Outbox (`completion.dismiss`), und zwar für das Konto des
    /// Abschlusses. Eine bereits verdeckte Ansicht bestätigt nichts mehr.
    func closeCompletion(_ record: CompletionRecord) {
        guard let shown = shownCompletion, shown.id == record.id, shown.userId == record.userId else { return }
        shownCompletion = nil
        store.dismissCompletion(record)
        removeCompletionController()
    }

    /// Vollständig nachgeladenen Inhalt dauerhaft sichern.
    func storeFullCompletion(_ record: CompletionRecord, completion: JSONValue) {
        guard let shown = shownCompletion, shown.id == record.id, shown.userId == record.userId else { return }
        store.storeFullCompletion(record, completion: completion)
    }

    private func removeCompletionController() {
        guard let controller = completionController else { return }
        controller.dismiss(animated: true) { [weak self] in
            self?.completionController = nil
            self?.startPresentationLoop()
        }
    }
}
