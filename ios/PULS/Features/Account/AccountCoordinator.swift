import SwiftUI
import UIKit
import Observation
import PULSCore

/// Unterseiten des nativen Kontos; Schlüssel wie die Web-`accountSections` (Header-Titel aus `OverviewText`).
enum AccountRoute: String, Hashable, CaseIterable, Identifiable {
    case plan, body, adaptive, design, sounds, manage

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .plan: return "target"
        case .body: return "figure.arms.open"
        case .adaptive: return "chart.line.uptrend.xyaxis"
        case .design: return "circle.lefthalf.filled"
        case .sounds: return "speaker.wave.2"
        case .manage: return "person.badge.key"
        }
    }
}

/// Sheets des Kontos (immer nur eines gleichzeitig).
enum AccountSheet: Identifiable, Equatable {
    case identity
    case profile
    case plan
    /// Messung eines Tages (neu: heute).
    case measurement(String?)

    var id: String {
        switch self {
        case .identity: return "identity"
        case .profile: return "profile"
        case .plan: return "plan"
        case .measurement(let date): return "measurement:" + (date ?? "new")
        }
    }
}

/// Web-Ausweg aus dem Konto: feste Aktion (§13.5) oder vorhandene Web-Unterseite.
enum AccountWebExit: Equatable {
    case action(AccountNavigation)
    case section(String)
    /// Web-Kontoübersicht (z. B. solange keine Projektion vorliegt).
    case overview
}

/// Konto und Dokument beim Beginn einer Bearbeitung. Ein Befehl wird nur unter genau diesem Konto eingereiht.
struct AccountEditSession: Equatable {
    let userId: String?
    let generation: Int
}

/// Ergebnis einer nativen Bearbeitung (für Hinweise direkt im Formular).
enum AccountOutcome: Equatable {
    case queued
    case failed(String)
    /// Planner-Kontext/Args über 24 Ki: nur im Web-Plan bearbeitbar.
    case tooLarge
}

/// M8/S: natives Konto und Profil (docs/native/NATIVE-BRIDGE-PROTOCOL.md §13), weiterhin Phase A.
///
/// - Liest die Projektion `account`, den verlustfreien Spiegel (Rohwerte für Erwartungen) und den Planner-Kontext.
/// - Schreibt nur die gemeldeten Konto-Ops über die persistente Outbox; keine eigene Energie-, Prognose-, Navy- oder
///   Kalibrierungsrechnung.
/// - Anmeldung, Abmeldung, Konfliktwahl, Import, Reset, Löschen, Recovery und Export laufen ausschließlich über die festen
///   Web-Ausstiege; Native zeigt nur Status (ohne E-Mail, ohne Tokens).
@Observable
@MainActor
final class AccountCoordinator {
    static let screen = ProfileStore.accountScreen

    let store: ProfileStore
    @ObservationIgnored private let bridge: StateBridge

    var path: [AccountRoute] = []
    var sheet: AccountSheet?
    var notice: TrainingNotice? {
        // Jeder neue Hinweis beginnt ohne Web-Knopf; wer einen anbietet, setzt ihn danach.
        didSet { noticeWebAction = nil }
    }
    /// Fester Web-Ausstieg, den der aktuelle Hinweis zusätzlich anbietet (z. B. `accountPlan`).
    var noticeWebAction: String?
    /// Zuletzt geladener Planner-Kontext (nur für die nächste Op; verworfen bei Dokument-/Nutzerwechsel).
    var planner: AccountPlannerResult?

    /// Shell: Web-Ausweg ausführen (native Ansicht verdecken, WebView zeigen).
    @ObservationIgnored var onOpenWeb: ((AccountWebExit) -> Void)?
    /// Shell: M2-Körperbereich (Gewicht) öffnen.
    @ObservationIgnored var onOpenBody: (() -> Void)?
    /// Shell: Konto-Tab wählen (z. B. nach `openNative{screen:'account'}`).
    @ObservationIgnored var onSelectAccountTab: (() -> Void)?
    /// N1: vollständige Listen und Export. Vor `install` gesetzt.
    @ObservationIgnored var extras: ExtrasCoordinator?

    @ObservationIgnored private var queryCounter = 0
    @ObservationIgnored private var handledAckSerial = 0
    @ObservationIgnored private var seenGeneration: Int?

    init(store: ProfileStore, bridge: StateBridge) {
        self.store = store
        self.bridge = bridge
        handledAckSerial = store.recentAcks.last?.serial ?? 0
        observeStore()
    }

    // MARK: Zustand

    var isOffered: Bool { store.webOffersAccount }
    var message: AccountProjectionMessage? { store.currentAccount }
    var projection: AccountProjection? { message?.account }
    var capabilities: AccountCapabilities? { store.accountCapabilities }

    /// Sichtbare Unterseite für den gemeinsamen Seitenkopf.
    var visibleSection: String? { path.last?.rawValue }

    var text: OverviewText {
        OverviewText(language: projection?.language ?? store.document["language"]?.stringValue, locale: projection?.locale)
    }

    var isPreview: Bool { message?.flags.preview == true || store.flags.preview }

    /// Schreibende Ops möglich (keine Vorschau/Recovery/Upload-Sperre).
    var canWrite: Bool { isOffered && !store.isReadOnly && message?.flags.isReadOnly != true }

    func can(_ op: String) -> Bool { canWrite && store.supportsOp(op) }

    var supportsPlanner: Bool { capabilities?.supportsPlanner == true }
    var canEditProfile: Bool { can(AccountOps.profileSet) && supportsPlanner }
    /// `plan.set`/`adaptive.set` meldet das Web nur mit M7 (`nativeNutrition`).
    var canEditPlan: Bool { can(AccountOps.planSet) && supportsPlanner }
    var canEditAdaptive: Bool { can(AccountOps.adaptiveSet) && supportsPlanner }

    func offers(_ action: String) -> Bool {
        capabilities?.supports(action) == true && projection?.offers(action) != false
    }

    /// Avatar aus dem verlustfreien Spiegel (auch größer als die 24-Ki-Projektion), sonst aus der Projektion.
    var avatarData: Data? {
        AccountAvatar.imageData(store.document["avatarImage"]?.stringValue) ?? AccountAvatar.imageData(projection?.identity.avatarImage)
    }

    var avatarOmittedWithoutImage: Bool { projection?.identity.avatarOmitted == true && avatarData == nil }

    /// Name wie angezeigt (Spiegel mit offenen Befehlen vor der Projektion).
    var displayName: String {
        if let name = store.document["displayName"]?.stringValue { return JSString.trim(name) }
        return projection?.identity.displayName ?? ""
    }

    /// Messungen aus dem verlustfreien Spiegel, neueste zuerst (alle, nicht nur die 20 der Projektion).
    var measurementRows: [JSONValue] {
        AccountOps.measurements(store.document.root)
            .filter { $0["id"]?.stringValue?.isEmpty == false && $0["date"]?.stringValue != nil }
            .sorted { ($0["date"]?.stringValue ?? "") > ($1["date"]?.stringValue ?? "") }
    }

    var soundDisplayed: (enabled: Bool, volume: Double?) {
        let sound = AccountOps.sound(store.document.root)
        return (sound.enabled, sound.volume.doubleValue)
    }

    var languageDisplayed: String { AccountOps.language(store.document.root) }

    var schemeDisplayed: AccountScheme { store.displayedScheme ?? projection?.appearance.scheme ?? .system }

    var isAppearancePending: Bool { store.hasUnconfirmedAccount(AccountOps.appearanceSet) }
    var isSoundPending: Bool { store.hasUnconfirmedAccount(AccountOps.soundSet) }
    var isPlannerPending: Bool {
        store.unconfirmedAccount.contains { [AccountOps.profileSet, AccountOps.planSet, AccountOps.adaptiveSet].contains($0.op) }
    }

    // MARK: Planner-Query

    /// Holt den vollständigen Planner-Kontext (höchstens `timeout`). `nil` = nicht verfügbar (dann Web-Ausweg).
    func loadPlanner(timeout: Duration = .seconds(6)) async -> AccountPlannerResult? {
        guard isOffered, supportsPlanner else { return nil }
        queryCounter += 1
        let requestId = "account-\(queryCounter)-" + UUID().uuidString.prefix(8).lowercased()
        guard let request = AccountQueryRequest.planner(requestId: requestId) else { return nil }
        store.registerAccountQuery(request)
        defer { store.forgetAccountQuery(requestId) }
        let bridge = bridge
        let sent = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            bridge.accountQuery(request) { continuation.resume(returning: $0) }
        }
        guard sent else { return nil }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while !Task.isCancelled {
            if let result = store.accountResult(requestId) {
                guard result.ok, let planner = result.planner else { return nil }
                self.planner = planner
                return planner
            }
            guard store.isAccountQueryPending(requestId), clock.now < deadline else { break }
            try? await Task.sleep(for: .milliseconds(40))
        }
        return nil
    }

    // MARK: Ops

    /// Konto und Dokument beim **Beginn** einer Bearbeitung festhalten (vor jedem `await`).
    func beginEdit() -> AccountEditSession {
        AccountEditSession(userId: store.userId, generation: store.accountGeneration)
    }

    /// Bearbeitung gehört noch zum aktuellen Konto und Dokument.
    func isCurrent(_ session: AccountEditSession) -> Bool {
        store.userId == session.userId && store.accountGeneration == session.generation
    }

    /// `expect` = beim Öffnen gesehener Rohname.
    @discardableResult
    func setName(_ name: String, expect: JSONValue, session: AccountEditSession) -> AccountOutcome {
        guard let command = AccountCommands.name(name, expect: expect) else {
            return .failed(text("Name mit 1 bis 40 Zeichen.", "Name with 1 to 40 characters."))
        }
        return perform(command, session: session)
    }

    /// Eingangsbild (JPEG ≤ 512 Ki Zeichen, nativ verkleinert); 160-px-Zuschnitt und Speichern im Web.
    /// `expect` = beim Öffnen gesehenes gespeichertes Bild.
    @discardableResult
    func setAvatar(dataUrl: String?, expect: JSONValue, session: AccountEditSession) -> AccountOutcome {
        guard var command = AccountCommands.avatar(dataUrl) else {
            return .failed(text("Dieses Bild ist zu groß oder ungültig.", "This image is too large or invalid."))
        }
        command.args["expect"] = expect
        return perform(command, session: session)
    }

    @discardableResult
    func saveProfile(_ fields: [String: JSONValue], context: PlannerContext, session: AccountEditSession) -> AccountOutcome {
        guard AccountCommands.plannerFits(context) else { return .tooLarge }
        guard let command = AccountCommands.profile(fields, context: context) else { return .tooLarge }
        return perform(command, session: session)
    }

    @discardableResult
    func savePlan(_ plan: [String: JSONValue], goals: [String: Double], context: PlannerContext,
                  session: AccountEditSession) -> AccountOutcome {
        guard AccountCommands.plannerFits(context) else { return .tooLarge }
        guard let command = AccountCommands.plan(plan, goals: goals, context: context) else {
            return .failed(text("Kalorien 1–20 000, Makros 0–2000 g.", "Calories 1–20,000, macros 0–2,000 g."))
        }
        return perform(command, session: session)
    }

    /// Lädt den Kontext frisch und sendet nur die zwei Automatik-Felder. Zu großer Kontext → Web-Plan.
    func setAdaptive(adaptive: Bool, learnTdee: Bool) async {
        guard canEditAdaptive else { return }
        let session = beginEdit()
        guard let planner = await loadPlanner(), isCurrent(session) else {
            notice = TrainingNotice(text: text("Konnte nicht geladen werden. Bitte erneut versuchen oder im Web einstellen.",
                                               "Could not load. Please try again or change it in the web view."))
            noticeWebAction = offers("accountPlan") ? "accountPlan" : nil
            return
        }
        guard AccountCommands.plannerFits(planner.context),
              let command = AccountCommands.adaptive(adaptive: adaptive, learnTdee: learnTdee, context: planner.context) else {
            notice = TrainingNotice(text: text("Der Plan ist zu umfangreich für die App. Bitte im Web einstellen.",
                                               "The plan is too large for the app. Please change it in the web view."))
            noticeWebAction = offers("accountPlan") ? "accountPlan" : nil
            return
        }
        if case .failed(let message) = perform(command, session: session) { notice = TrainingNotice(text: message) }
    }

    /// `existing` = beim Befüllen gesehener Rohrecord des Tages; nur tatsächlich bearbeitete Felder in `values`.
    @discardableResult
    func saveMeasurement(date: String, values: [String: Double], existing: JSONValue?, session: AccountEditSession) -> AccountOutcome {
        guard let projection, let today = projection.today,
              let command = AccountCommands.saveMeasurement(date: date, values: values, fields: projection.body.fields,
                                                            existing: existing, document: store.document, today: today) else {
            return .failed(text("Bitte gültige Werte im angezeigten Bereich eintragen (Tag bis heute).",
                                "Please enter valid values within the shown range (day up to today)."))
        }
        return perform(command, session: session)
    }

    /// `row` = der Rohrecord, dessen Löschen der Nutzer bestätigt hat.
    func deleteMeasurement(row: JSONValue, session: AccountEditSession) {
        guard let command = AccountCommands.deleteMeasurement(row: row) else { return }
        switch perform(command, session: session) {
        case .queued: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .failed(let message): notice = TrainingNotice(text: message)
        case .tooLarge: break
        }
    }

    /// `expect` = aktueller Gerätewunsch (Snapshot) und Sprache (Spiegel) zum Zeitpunkt der Auswahl.
    func setAppearance(scheme: AccountScheme? = nil, language: String? = nil) {
        guard can(AccountOps.appearanceSet), !isAppearancePending else { return }
        let current = store.deviceScheme.flatMap(AccountScheme.init(rawValue:)) ?? projection?.appearance.scheme ?? .system
        guard let command = AccountCommands.appearance(scheme: scheme, language: language,
                                                       expect: (current, AccountOps.language(store.document.root))) else { return }
        if case .failed(let message) = perform(command, session: beginEdit()) { notice = TrainingNotice(text: message) }
    }

    func setSound(enabled: Bool, volume: Double) {
        guard can(AccountOps.soundSet), let command = AccountCommands.sound(enabled: enabled, volume: volume) else { return }
        if case .failed(let message) = perform(command, session: beginEdit()) { notice = TrainingNotice(text: message) }
    }

    /// Immer unter dem Konto des Bearbeitungsbeginns (`asUser`); ein inzwischen gewechseltes Konto/Dokument wird abgelehnt.
    private func perform(_ command: Command, session: AccountEditSession) -> AccountOutcome {
        guard isCurrent(session) else { return .failed(describe(TrainingCommandError.userChanged)) }
        do {
            try store.performAccount(command, asUser: session.userId)
            return .queued
        } catch {
            return .failed(describe(error))
        }
    }

    func describe(_ error: Error) -> String {
        switch error as? ProfileStoreError {
        case .preview?: return text("Vorschau: nur zur Ansicht.", "Preview: view only.")
        case .readOnly?: return text("Gerade nur lesbar. Wähle zuerst in PULS den gewünschten Stand.",
                                     "Read only right now. Choose the version in PULS first.")
        case .webNotReady?: return text("PULS lädt noch. Bitte gleich noch einmal.", "PULS is still loading. Please try again.")
        case .unsupportedOp?: return text("Diese PULS-Version unterstützt das gerade nicht.", "This PULS version does not support this right now.")
        case .persistence?: return text("Konnte nicht gespeichert werden.", "Could not be saved.")
        default:
            if (error as? TrainingCommandError) == .userChanged {
                return text("Das Konto hat gewechselt. Bitte erneut auswählen.", "The account changed. Please choose again.")
            }
            return text("Die Änderung wurde nicht übernommen.", "The change was not applied.")
        }
    }

    // MARK: Navigation

    func open(_ route: AccountRoute) {
        path = [route]
    }

    /// `openNative{screen:'account', section}`: Konto-Tab wählen und Unterseite zeigen.
    func openFromWeb(section: String?) {
        sheet = nil
        onSelectAccountTab?()
        if let section, let route = AccountRoute(rawValue: section) {
            path = [route]
        } else {
            path = []
        }
    }

    /// Fester Web-Ausweg; eigenes Sheet vorher schließen.
    func openWeb(_ action: String) {
        guard let target = AccountNavigation(action: action) else { return }
        sheet = nil
        onOpenWeb?(.action(target))
    }

    /// Vorhandene Web-Unterseite (z. B. ausgelassene Verlaufszeilen).
    func openWebSection(_ route: AccountRoute) {
        sheet = nil
        onOpenWeb?(.section(route.rawValue))
    }

    func openBody() {
        sheet = nil
        onOpenBody?()
    }

    // MARK: Konflikte

    var conflicts: [OutboxEntry] { store.accountConflicts }
    var parkedCommands: [OutboxEntry] { store.accountParked }

    func discard(id: String) {
        do { try store.discardAccountCommand(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    func reapply(id: String) {
        do { try store.reapplyAccountConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    func commandTitle(_ entry: OutboxEntry) -> String {
        switch entry.command.op {
        case AccountOps.nameSet: return text("Name", "Name")
        case AccountOps.avatarSet: return text("Profilbild", "Profile picture")
        case AccountOps.profileSet: return text("Körperprofil", "Body profile")
        case AccountOps.planSet: return text("Plan und Ziele", "Plan and targets")
        case AccountOps.adaptiveSet: return text("Adaptiver Erhalt", "Adaptive maintenance")
        case AccountOps.measurementsSave: return text("Messung speichern", "Save measurement")
        case AccountOps.measurementsDelete: return text("Messung löschen", "Delete measurement")
        case AccountOps.appearanceSet: return text("Darstellung", "Appearance")
        case AccountOps.soundSet: return text("Klänge", "Sounds")
        default: return entry.command.op
        }
    }

    // MARK: Beobachtung

    private func observeStore() {
        withObservationTracking {
            processAcks()
            resetOnGenerationChange()
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observeStore() }
        }
    }

    /// Neues Dokument, ownerPending oder Kontowechsel: Sheets und Planner-Kontext verwerfen.
    private func resetOnGenerationChange() {
        let generation = store.accountGeneration
        defer { seenGeneration = generation }
        guard let seen = seenGeneration, seen != generation else { return }
        sheet = nil
        notice = nil
        planner = nil
    }

    private func processAcks() {
        let events = store.recentAcks.filter { $0.serial > handledAckSerial }
        guard let last = events.last else { return }
        handledAckSerial = last.serial
        for event in events where AccountOps.isAccount(event.op) {
            if event.ok {
                // Neuer Stand: alter Planner-Kontext ist keine gültige Erwartung mehr.
                if [AccountOps.profileSet, AccountOps.planSet, AccountOps.adaptiveSet].contains(event.op) { planner = nil }
                continue
            }
            switch event.code {
            case .busy?, .readonly?, .persistFailed?, .notReady?:
                continue
            case .conflict?:
                planner = nil
                notice = TrainingNotice(text: text("Der Stand hat sich inzwischen geändert. Bitte unten prüfen.",
                                                   "This changed in the meantime. Please check below."))
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
