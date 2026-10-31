import SwiftUI
import UIKit
import Observation
import PULSCore

/// Kurzer Hinweis in den Trainingsbildschirmen (verschwindet von selbst bzw. per Tippen).
struct TrainingNotice: Equatable, Identifiable {
    let id = UUID()
    let text: String
    var isWarning = true
}

/// M4: native Routinen und Kraftsession (docs/native/NATIVE-BRIDGE-PROTOCOL.md §9).
///
/// - Bestätigt `pulsNativeSetTraining(true)` erst, wenn eine gültige `training`-Projektion desselben Nutzers da ist
///   und schreibend gearbeitet werden kann; lehnt das Web ab (offener Web-Ablauf), folgt der nächste Versuch nach
///   einer neuen `chrome`-Meldung ohne Sperre. Jedes Hello bzw. neue Dokument verlangt eine neue Bestätigung.
/// - Zeigt die laufende Session als Vollbild (`overFullScreen`: die WebView bleibt in der Hierarchie und läuft
///   weiter). Kann sie nicht gezeigt werden: `pulsNativeSetTraining(false)` + `resumeWorkout` mit `web:true`.
/// - Schreibt nur über Ops. Pausen-Mitteilung/Live-Aktivität bleiben beim Web (`pulsNative`), hier nie direkt.
/// - Nach `workout.finish` zeigt das Web seine Abschlussansicht; der native Trainings-Tab bleibt bis zum Ende
///   dieses Web-Ablaufs verdeckt.
@Observable
@MainActor
final class TrainingCoordinator {
    static let screen = ProfileStore.trainingScreen

    let store: ProfileStore
    @ObservationIgnored private let bridge: StateBridge
    @ObservationIgnored private weak var host: UIViewController?
    @ObservationIgnored private weak var sessionController: UIViewController?

    /// Workout der gerade gezeigten nativen Session (`nil` = keine).
    private(set) var sessionWorkoutId: String?
    /// Nach `workout.finish`: WebView mit der Web-Abschlussansicht zeigen, nicht den nativen Tab.
    private(set) var awaitingWebCompletion = false
    /// Laufende eigene Aktionen (Start, Abschluss, Verwerfen, Routine speichern …) für Fortschrittsanzeigen.
    private(set) var busyActions: Set<String> = []
    var notice: TrainingNotice?
    /// Freies Training aus der Übersicht/dem Plus-Menü angefordert: Namensabfrage im Trainings-Tab zeigen.
    var requestsEmptyStart = false

    /// Wählt den nativen Trainings-Tab (Shell).
    @ObservationIgnored var onSelectWorkoutTab: (() -> Void)?
    /// Zeigt die Web-Trainingsseite (Kalender, Rekorde, Rückblick bleiben in M4 Web).
    @ObservationIgnored var onShowWebWorkout: (() -> Void)?
    /// Hell/Dunkel wie die Shell bzw. die Web-App.
    @ObservationIgnored var styleProvider: (() -> UIUserInterfaceStyle)?

    @ObservationIgnored private var confirmedHello: Int?
    @ObservationIgnored private var confirming = false
    @ObservationIgnored private var rejectedAtChrome: Int?
    @ObservationIgnored private var suppressedHello: Int?
    @ObservationIgnored private var suppressionSawBlocking = false
    @ObservationIgnored private var handledAckSerial = 0
    /// Befehls-ID → Aktion, auf deren Ack die Oberfläche wartet.
    @ObservationIgnored private var waiting: [String: Waiting] = [:]
    @ObservationIgnored private var sessionShownAt = Date.distantPast
    @ObservationIgnored private var completionSawSession = false
    @ObservationIgnored private var completionToken = 0
    @ObservationIgnored private var searchCounter = 0
    /// Nach `workout.start`: Session zeigen, sobald Snapshot/Projektion das neue Workout kennen.
    @ObservationIgnored private var pendingPresent: String?

    private enum Waiting {
        case start
        case finish(String)
        case discard(String)
        case routine(String, completion: (Bool) -> Void)
        case createExercise(completion: (String?) -> Void)
        case other(String)
    }

    init(store: ProfileStore, bridge: StateBridge, host: UIViewController) {
        self.store = store
        self.bridge = bridge
        self.host = host
        handledAckSerial = store.recentAcks.last?.serial ?? 0
        observeStore()
    }

    // MARK: Zustand

    /// Native Trainingsbildschirme darstellbar (gültige Projektion dieses Nutzers).
    var isAvailable: Bool { store.currentTraining != nil }

    /// Schreibende Aktionen möglich (keine Vorschau/Recovery/Upload-Sperre).
    var canWrite: Bool { isAvailable && !store.isReadOnly && store.currentTraining?.flags.isReadOnly != true }

    var training: TrainingProjection? { store.currentTraining?.training }

    var text: TrainingText {
        TrainingText(projection: training, fallbackLanguage: store.document["language"]?.stringValue)
    }

    func isBusy(_ action: String) -> Bool { busyActions.contains(action) }

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
        presentPendingIfReady()
        checkSession()
        checkCompletion()
    }

    private func updateConfirmation() {
        let helloCount = store.helloCount
        let blocking = store.webBlocksNavigation
        _ = store.chromeCount
        // Neues Dokument bzw. jedes Hello widerruft die Bestätigung im Web.
        if store.documentHello == nil || (confirmedHello != nil && confirmedHello != helloCount) {
            confirmedHello = nil
            rejectedAtChrome = nil
        }
        if let suppressed = suppressedHello {
            if suppressed != helloCount {
                suppressedHello = nil
            } else if blocking {
                suppressionSawBlocking = true
            } else if suppressionSawBlocking {
                // Die Web-Session des Auswegs ist beendet: wieder native Session anbieten.
                suppressedHello = nil
            }
        }
        let ready = store.documentHello != nil && canWrite
        guard ready, suppressedHello == nil else {
            if confirmedHello != nil {
                confirmedHello = nil
                bridge.setTraining(false)
            }
            return
        }
        guard confirmedHello == nil, !confirming, !blocking else { return }
        if let rejected = rejectedAtChrome, rejected == store.chromeCount { return }
        confirming = true
        bridge.setTraining(true) { [weak self] accepted in
            guard let self else { return }
            self.confirming = false
            if accepted, self.store.helloCount == helloCount {
                self.confirmedHello = helloCount
                self.rejectedAtChrome = nil
            } else {
                // Erneut erst nach der nächsten `chrome`-Meldung ohne Sperre bzw. nach neuem Hello.
                self.rejectedAtChrome = self.store.chromeCount
            }
        }
    }

    private func processAcks() {
        let events = store.recentAcks.filter { $0.serial > handledAckSerial }
        guard let last = events.last else { return }
        handledAckSerial = last.serial
        for event in events where TrainingOps.isTraining(event.op) {
            handle(event)
        }
    }

    private func handle(_ event: AckEvent) {
        let action = waiting[event.commandId]
        let pendingCode: Bool = event.code == .busy || event.code == .readonly || event.code == .persistFailed || event.code == .notReady
        if !pendingCode { waiting[event.commandId] = nil }
        switch action {
        case .start?:
            guard !pendingCode else { return }
            busyActions.remove("start")
            if event.ok, let id = event.result?["workoutId"]?.stringValue {
                schedulePresentation(workoutId: id)
            } else if !event.ok {
                show(event)
            }
        case .finish(let workoutId)?:
            guard !pendingCode else { return }
            busyActions.remove("finish")
            if event.ok {
                // Das Web zeigt jetzt seine Abschlussansicht (`chrome.reason:'session'`).
                beginWebCompletion()
                closeSession(workoutId: workoutId)
            } else if event.code == .gone {
                closeSession(workoutId: workoutId)
                show(event)
            } else if event.code != .conflict {
                show(event)
            }
        case .discard(let workoutId)?:
            guard !pendingCode else { return }
            busyActions.remove("discard")
            if event.ok || event.code == .gone {
                closeSession(workoutId: workoutId)
            } else {
                show(event)
            }
        case .routine(let key, let completion)?:
            guard !pendingCode else { return }
            busyActions.remove(key)
            completion(event.ok)
            if !event.ok, event.code != .conflict { show(event) }
        case .createExercise(let completion)?:
            guard !pendingCode else { return }
            busyActions.remove("createExercise")
            completion(event.ok ? event.result?["libraryId"]?.stringValue : nil)
            if !event.ok { show(event) }
        case .other(let key)?:
            if !pendingCode { busyActions.remove(key) }
            if !event.ok, !pendingCode, event.code != .conflict { show(event) }
        case nil:
            // Befehle der Session ohne eigene Wartestelle: Fehler kurz anzeigen; Konflikte zeigt die Liste.
            if !event.ok, !pendingCode, event.code != .conflict { show(event) }
        }
        if event.code == .gone, let workoutId = event.args["workoutId"]?.stringValue, workoutId == sessionWorkoutId,
           !isOpen(workoutId: workoutId) {
            closeSession(workoutId: workoutId)
        }
    }

    private func show(_ event: AckEvent) {
        notice = TrainingNotice(text: text.failure(event.code, message: event.message))
    }

    /// Workout im Spiegel noch offen.
    private func isOpen(workoutId: String) -> Bool {
        guard let raw = TrainingOps.workout(store.document.root, workoutId) else {
            return training?.active?.id == workoutId
        }
        return raw["finished"]?.boolValue != true
    }

    /// Session schließen, wenn das Workout anderswo beendet/verworfen wurde (5 h, anderes Gerät, Web).
    private func checkSession() {
        guard let id = sessionWorkoutId else { return }
        if store.ownerPending {
            closeSession(workoutId: id)
            return
        }
        let waitsForFinish = waiting.values.contains { if case .finish(let wid) = $0 { return wid == id }; return false }
        guard !waitsForFinish else { return }
        let raw = TrainingOps.workout(store.document.root, id)
        if let raw, raw["finished"]?.boolValue == true {
            notice = TrainingNotice(text: raw["autoFinished"]?.boolValue == true
                ? text("Das Training wurde nach 5 Stunden automatisch beendet.", "The workout was finished automatically after 5 hours.")
                : text("Das Training wurde beendet.", "The workout was finished."), isWarning: false)
            closeSession(workoutId: id)
        } else if raw == nil, let training, training.active?.id != id, Date().timeIntervalSince(sessionShownAt) > 3 {
            notice = TrainingNotice(text: text("Das Training ist nicht mehr aktiv.", "The workout is no longer active."))
            closeSession(workoutId: id)
        }
    }

    // MARK: Web-Abschlussansicht

    private func beginWebCompletion() {
        awaitingWebCompletion = true
        completionSawSession = false
        completionToken += 1
        let token = completionToken
        // Kommt keine Session-Meldung (z. B. bereits beendet), zeigt Native wieder seinen Trainings-Tab.
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

    // MARK: Einstiege

    /// `openNative{screen:'training', workoutId}` aus dem Web: immer etwas zeigen.
    func openFromWeb(workoutId: String?) {
        _ = store.consumeScreenRequest()
        let requested = store.consumeWorkoutRequest() ?? workoutId
        openSession(workoutId: requested)
    }

    /// Laufende Session zeigen (Fortsetzen); ohne aktives Workout den Trainings-Tab.
    func openSession(workoutId: String?) {
        guard let id = workoutId ?? training?.active?.id else {
            onSelectWorkoutTab?()
            return
        }
        presentSession(workoutId: id)
    }

    /// Einstiege der nativen Übersicht. `true` = nativ erledigt, sonst bleibt der Web-Ablauf zuständig.
    func handleOverviewAction(_ action: String, id: String?) -> Bool {
        guard isAvailable else { return false }
        switch action {
        case "resumeWorkout":
            guard let id else { return false }
            presentSession(workoutId: id)
            return true
        case "startRoutine":
            guard canWrite, let id, training?.routine(id: id) != nil else { return false }
            start(routineId: id)
            return true
        case "startWorkout":
            guard canWrite else { return false }
            onSelectWorkoutTab?()
            if let active = training?.active {
                presentSession(workoutId: active.id)
            } else {
                requestsEmptyStart = true
            }
            return true
        case "routines":
            onSelectWorkoutTab?()
            return true
        default:
            return false
        }
    }

    // MARK: Session zeigen

    /// Das Ack kommt vor dem Snapshot: kurz warten, bis die Session darstellbar ist (höchstens 3 s, dann Ausweg).
    private func schedulePresentation(workoutId: String) {
        pendingPresent = workoutId
        presentPendingIfReady()
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, self.pendingPresent == workoutId else { return }
            self.pendingPresent = nil
            self.presentSession(workoutId: workoutId)
        }
    }

    private func presentPendingIfReady() {
        guard let id = pendingPresent, canPresent(workoutId: id) else { return }
        pendingPresent = nil
        presentSession(workoutId: id)
    }

    private func presentSession(workoutId: String) {
        if sessionWorkoutId == workoutId, let controller = sessionController, controller.presentingViewController != nil {
            return
        }
        guard canPresent(workoutId: workoutId) else {
            fallBackToWeb(workoutId: workoutId)
            return
        }
        // Eine andere Session ist noch offen (nur kurzzeitig denkbar): erst schließen, dann zeigen.
        if let previous = sessionController, previous.presentingViewController != nil {
            sessionController = nil
            sessionWorkoutId = nil
            previous.dismiss(animated: false) { [weak self] in self?.presentSession(workoutId: workoutId) }
            return
        }
        guard let presenter = topPresenter() else {
            fallBackToWeb(workoutId: workoutId)
            return
        }
        sessionWorkoutId = workoutId
        sessionShownAt = Date()
        let root = TrainingSessionHost(coordinator: self, workoutId: workoutId)
        let controller = UIHostingController(rootView: root)
        controller.modalPresentationStyle = .overFullScreen
        controller.modalPresentationCapturesStatusBarAppearance = true
        controller.overrideUserInterfaceStyle = styleProvider?() ?? .dark
        controller.view.backgroundColor = .systemGroupedBackground
        sessionController = controller
        presenter.present(controller, animated: true)
        bridge.readWebScheme { [weak controller] scheme in
            guard let scheme else { return }
            controller?.overrideUserInterfaceStyle = scheme == "light" ? .light : .dark
        }
    }

    /// Nur mit aktueller Projektion, lesbaren Werten und laufendem Workout.
    private func canPresent(workoutId: String) -> Bool {
        guard isAvailable, let session = store.trainingSession(workoutId: workoutId) else { return false }
        return session.isComplete && !session.finished
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

    /// Ausweg: Web-Session für genau dieses Workout; danach öffnen Web-Einstiege wieder die Web-Session,
    /// bis diese beendet ist.
    func fallBackToWeb(workoutId: String) {
        dismissSessionController(animated: true)
        sessionWorkoutId = nil
        suppressedHello = store.helloCount
        suppressionSawBlocking = false
        confirmedHello = nil
        let bridge = bridge
        bridge.setTraining(false) { _ in
            bridge.resumeWorkoutInWeb(id: workoutId)
        }
        // Öffnet sich keine Web-Session (z. B. Workout schon beendet), nach kurzer Zeit wieder nativ anbieten.
        let hello = store.helloCount
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(4))
            guard let self, self.suppressedHello == hello, !self.suppressionSawBlocking else { return }
            self.suppressedHello = nil
            self.applyStoreState()
        }
    }

    /// Minimieren: Session schließen, Workout läuft weiter (Banner im Trainings-Tab, Web-Dock, Übersicht).
    func minimize() {
        dismissSessionController(animated: true)
        sessionWorkoutId = nil
    }

    private func closeSession(workoutId: String) {
        guard sessionWorkoutId == workoutId else { return }
        dismissSessionController(animated: true)
        sessionWorkoutId = nil
    }

    private func dismissSessionController(animated: Bool) {
        guard let controller = sessionController else { return }
        sessionController = nil
        if controller.presentingViewController != nil {
            controller.dismiss(animated: animated)
        }
    }

    // MARK: Befehle

    /// Sendet einen Trainingsbefehl. Fehler (Vorschau, Schreibschutz, Outbox) als Hinweis; `nil` = nicht gesendet.
    @discardableResult
    func perform(_ command: Command, busyKey: String? = nil) -> ApplyCommand? {
        do {
            let apply = try store.performTraining(command, asUser: store.userId)
            if let busyKey {
                busyActions.insert(busyKey)
                waiting[apply.id] = .other(busyKey)
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

    func start(routineId: String) {
        if let active = training?.active {
            presentSession(workoutId: active.id)
            return
        }
        guard !isBusy("start"), let apply = perform(TrainingCommands.start(routineId: routineId)) else { return }
        busyActions.insert("start")
        waiting[apply.id] = .start
    }

    func startEmpty(name: String) {
        if let active = training?.active {
            presentSession(workoutId: active.id)
            return
        }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 80, !isBusy("start"),
              let apply = perform(TrainingCommands.startEmpty(name: trimmed)) else { return }
        busyActions.insert("start")
        waiting[apply.id] = .start
    }

    func finish(workoutId: String, bodyweight: Double?, confirmUnfinished: Bool) {
        guard !isBusy("finish"),
              let apply = perform(TrainingCommands.finish(workoutId: workoutId, bodyweight: bodyweight,
                                                          confirmUnfinished: confirmUnfinished)) else { return }
        busyActions.insert("finish")
        waiting[apply.id] = .finish(workoutId)
    }

    func discard(workoutId: String) {
        guard !isBusy("discard"), let apply = perform(TrainingCommands.discard(workoutId: workoutId)) else { return }
        busyActions.insert("discard")
        waiting[apply.id] = .discard(workoutId)
    }

    /// Routine speichern; `completion(true)` nach Bestätigung durch das Web.
    func saveRoutine(_ draft: RoutineDraft, completion: @escaping (Bool) -> Void) {
        let key = "routine:" + draft.id
        guard !isBusy(key), let apply = perform(TrainingCommands.saveRoutine(draft.routineJSON, expect: draft.expect)) else {
            return
        }
        busyActions.insert(key)
        waiting[apply.id] = .routine(key, completion: completion)
    }

    func deleteRoutine(id: String) {
        perform(TrainingCommands.deleteRoutine(id: id), busyKey: "delete:" + id)
    }

    /// Eigene Übung anlegen (bzw. gleichnamige wiederverwenden); `completion(libraryId)` nach dem Ack.
    func createExercise(name: String, completion: @escaping (String?) -> Void) {
        guard let apply = perform(TrainingCommands.createExercise(name: name)) else {
            completion(nil)
            return
        }
        busyActions.insert("createExercise")
        waiting[apply.id] = .createExercise(completion: completion)
    }

    // MARK: Übungssuche

    /// Startet eine Suche; `nil`, wenn das Web sie nicht annimmt (dann lokal in der Bibliothek suchen).
    func searchExercises(query: String, equipment: String, completion: @escaping (String?) -> Void) {
        searchCounter += 1
        let request = ExerciseSearchRequest(requestId: "search-\(searchCounter)", query: query, equipment: equipment)
        bridge.searchExercises(request) { sent in
            completion(sent ? request.requestId : nil)
        }
    }

    // MARK: Konflikte

    func discardConflict(id: String) {
        do {
            try store.discardTrainingConflict(id: id, asUser: store.userId)
        } catch {
            notice = TrainingNotice(text: describe(error))
        }
    }

    func reapplyConflict(id: String) {
        do {
            try store.reapplyTrainingConflict(id: id, asUser: store.userId)
        } catch {
            notice = TrainingNotice(text: describe(error))
        }
    }

    func showWebWorkout() {
        onShowWebWorkout?()
    }
}
