import SwiftUI
import UIKit
import Observation
import PULSCore

/// Sheets des nativen Ernährungs-Tabs (immer nur eines gleichzeitig).
enum NutritionSheet: Identifiable, Equatable {
    case search
    case product(ProductRef)
    case entry(String)
    case waterGoal
    case microGoals
    /// P2-Vorbereitung: Barcode-Scanner bzw. Nährwertfoto (nur bei gemeldeter P2-Schnittstelle).
    case barcode
    case label
    /// P2: eigene Werte (`product.save` kind custom).
    case custom

    var id: String {
        switch self {
        case .search: return "search"
        case .product(let ref): return "product:" + ref.key
        case .entry(let id): return "entry:" + id
        case .waterGoal: return "waterGoal"
        case .microGoals: return "microGoals"
        case .barcode: return "barcode"
        case .label: return "label"
        case .custom: return "custom"
        }
    }
}

/// Ein natives Löschen, das per `food.restore` rückgängig gemacht werden kann (unabhängig vom Web-Undo).
struct NutritionUndo: Identifiable, Equatable {
    let id = UUID()
    let detail: NutritionEntryDetail
    let deleteCommandId: String
}

/// M7/P1: native Ernährung (docs/native/NATIVE-BRIDGE-PROTOCOL.md §12).
///
/// - Liest die Projektion `nutrition` und Query-Antworten `nutritionResult`; keine eigenen Ernährungsformeln.
/// - Schreibt ausschließlich die neun P1-Ops über die persistente Outbox. Erwartungen stammen aus den Detailqueries
///   (`product`, `entry`) bzw. dem verlustfreien Profil, nie aus der gekürzten Projektion.
/// - Queries tragen eine eindeutige `requestId`, werden vor dem Senden im Store registriert und nur für denselben
///   Nutzer/dasselbe Dokument angenommen. Eine abgelöste Suche bleibt ohne Antwort und wird aufgegeben.
/// - P2-Abläufe (OFF, Barcode, Etikett speichern, Rezepte bearbeiten, Import, Plan-Ziele) führen ins Web, bis das
///   Web sie meldet und die native Speicherung angebunden ist (`NutritionP2`).
@Observable
@MainActor
final class NutritionCoordinator {
    static let screen = ProfileStore.nutritionScreen

    let store: ProfileStore
    @ObservationIgnored private let bridge: StateBridge

    var sheet: NutritionSheet?
    /// Startbereich der Suche beim nächsten Öffnen (z. B. „Meine Rezepte“); die Suche übernimmt und leert ihn.
    var searchScopeRequest: NutritionSearchScope?
    var notice: TrainingNotice?
    /// Neueste zuletzt; das Banner zeigt das letzte Löschen.
    var undoStack: [NutritionUndo] = []
    /// Einträge, deren Löschen läuft bzw. gerade gelöscht wurde (bis die Projektion sie nicht mehr enthält).
    var hiddenEntryIds: Set<String> = []
    /// Einträge, für die gerade die `entry`-Query vor dem Löschen läuft.
    var deletingEntryIds: Set<String> = []

    /// Shell: Web-Ausweg ausführen (native Ansicht verdecken, WebView zeigen). Vor `install` gesetzt.
    @ObservationIgnored var onOpenWeb: ((NavigationTarget) -> Void)?
    /// Shell: Essen-Tab wählen (z. B. „Essen eintragen“ aus der Übersicht).
    @ObservationIgnored var onSelectFoodTab: (() -> Void)?

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

    /// Das Web meldet die native Ernährung (Hello, P1-Ops, geklärte Zuordnung). Die Projektion kommt erst nach Interesse.
    var isOffered: Bool { store.webOffersNutrition }

    var message: NutritionProjectionMessage? { store.currentNutrition }
    var projection: NutritionProjection? { message?.nutrition }
    var capabilities: NutritionCapabilities? { store.nutritionCapabilities }

    /// Schreibende Ops möglich (keine Vorschau/Recovery/Upload-Sperre).
    var canWrite: Bool {
        isOffered && !store.isReadOnly && message?.flags.isReadOnly != true
    }

    var text: OverviewText {
        OverviewText(language: projection?.language ?? store.document["language"]?.stringValue, locale: projection?.locale)
    }

    /// Datenstand für Query-Ansichten: neuer Snapshot, neues Dokument oder Nutzerwechsel laden neu.
    var dataRevision: String { "\(store.nutritionGeneration)|\(store.seq)" }

    var supportsSearch: Bool { capabilities?.supports(.search) == true }
    var supportsProduct: Bool { capabilities?.supports(.product) == true }
    var supportsEntry: Bool { capabilities?.supports(.entry) == true }
    var supportsRecipe: Bool { capabilities?.supports(.recipe) == true }

    /// P2: native Abläufe nur, wenn das Web sie meldet **und** die native Speicherung angebunden ist.
    var nativeBarcode: Bool { NutritionP2.barcodeEnabled(capabilities: capabilities, ops: store.documentHello?.ops ?? []) }
    var nativeLabel: Bool { NutritionP2.labelEnabled(capabilities: capabilities, ops: store.documentHello?.ops ?? []) }
    /// P2: eigene Werte, OFF-/Barcode-Review und Etikett nativ speichern.
    var nativeProductSave: Bool { NutritionP2.canSaveProducts(capabilities: capabilities, ops: store.documentHello?.ops ?? []) }

    /// Tagebuchzeilen ohne gerade gelöschte.
    var visibleEntries: [NutritionEntry] {
        (projection?.entries ?? []).filter { !hiddenEntryIds.contains($0.id) }
    }

    /// Wassereintrag(e) für den angezeigten Tag unterwegs.
    var pendingWaterCount: Int {
        guard let date = projection?.date else { return 0 }
        return store.unconfirmedNutrition.filter { $0.op == NutritionOps.waterAdd && $0.args["date"]?.stringValue == date }.count
    }

    /// Tagesabschluss wie angezeigt: ein unterwegs befindlicher Zielwert vor dem Projektionswert.
    var dayCompleteDisplayed: Bool {
        guard let projection else { return false }
        if let pending = store.unconfirmedNutrition.last(where: {
            $0.op == NutritionOps.dayComplete && $0.args["date"]?.stringValue == projection.date
        }), let done = pending.args["done"]?.boolValue {
            return done
        }
        return projection.foodLogCompleted
    }

    var isDayCompletePending: Bool {
        guard let date = projection?.date else { return false }
        return store.hasUnconfirmedNutrition(NutritionOps.dayComplete) { $0["date"]?.stringValue == date }
    }

    // MARK: Queries

    /// Registriert, sendet und wartet auf die passende Antwort (höchstens `timeout`). Abbruch der aufrufenden Task
    /// (Ansicht weg oder neue Eingabe) gibt die Anfrage auf; eine späte Antwort wird dann verworfen.
    func fetch(timeout: Duration = .seconds(6), _ build: (String) -> NutritionQueryRequest?) async -> LoadPhase<NutritionResultMessage> {
        queryCounter += 1
        let requestId = "nutrition-\(queryCounter)-" + UUID().uuidString.prefix(8).lowercased()
        guard let request = build(requestId), capabilities?.supports(request.kind) == true else { return .failed }
        store.registerNutritionQuery(request)
        let bridge = bridge
        let sent = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            bridge.nutritionQuery(request) { continuation.resume(returning: $0) }
        }
        guard sent, !Task.isCancelled else {
            store.forgetNutritionQuery(requestId)
            return .failed
        }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        while !Task.isCancelled {
            if let result = store.nutritionResult(requestId) {
                store.forgetNutritionQuery(requestId)
                if result.ok { return .loaded(result) }
                return result.isGone ? .gone : .failed
            }
            // Verworfen (anderer Nutzer/Dokument, ownerPending) oder Zeitlimit.
            guard store.isNutritionQueryPending(requestId), clock.now < deadline else { break }
            try? await Task.sleep(for: .milliseconds(40))
        }
        store.forgetNutritionQuery(requestId)
        return .failed
    }

    func productDetail(_ ref: ProductRef) async -> LoadPhase<NutritionProductDetail> {
        // P2: Barcode-Lookup (OFF bis 12 s) und Quellportionen antworten asynchron.
        switch await fetch(timeout: .seconds(15), { NutritionQueryRequest.product(ref, requestId: $0) }) {
        case .loaded(let message):
            if case .product(let detail)? = message.result { return .loaded(detail) }
            return .failed
        case .gone: return .gone
        default: return .failed
        }
    }

    func entryDetail(_ id: String) async -> LoadPhase<NutritionEntryDetail> {
        switch await fetch({ NutritionQueryRequest.detail(.entry, id: id, requestId: $0) }) {
        case .loaded(let message):
            if case .entry(let detail)? = message.result { return .loaded(detail) }
            return .failed
        case .gone: return .gone
        default: return .failed
        }
    }

    func recipeDetail(_ id: String) async -> LoadPhase<NutritionRecipeDetail> {
        switch await fetch({ NutritionQueryRequest.detail(.recipe, id: id, requestId: $0) }) {
        case .loaded(let message):
            if case .recipe(let detail)? = message.result { return .loaded(detail) }
            return .failed
        case .gone: return .gone
        default: return .failed
        }
    }

    /// P2-Suche: dieselbe `requestId` kann zuerst lokal, dann mit OFF antworten. `update` erhält jeden neuen Stand
    /// (ganzer Ergebnisstand ersetzt den bisherigen); Ende bei `complete`, Abbruch, Verwerfen oder Zeitlimit.
    func search(_ build: (String) -> NutritionQueryRequest?, timeout: Duration = .seconds(26),
                update: (NutritionSearchResult) -> Void) async -> Bool {
        queryCounter += 1
        let requestId = "nutrition-\(queryCounter)-" + UUID().uuidString.prefix(8).lowercased()
        guard let request = build(requestId), capabilities?.supports(request.kind) == true else { return false }
        store.registerNutritionQuery(request)
        defer { store.forgetNutritionQuery(requestId) }
        let bridge = bridge
        let sent = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            bridge.nutritionQuery(request) { continuation.resume(returning: $0) }
        }
        guard sent else { return false }
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: timeout)
        var last: NutritionResultMessage?
        var answered = false
        while !Task.isCancelled {
            if let message = store.nutritionResult(requestId), message != last {
                last = message
                guard message.ok, case .search(let result)? = message.result else { return answered }
                answered = true
                update(result)
                if result.isFinal { return true }
            }
            guard store.isNutritionQueryPending(requestId), clock.now < deadline else { break }
            try? await Task.sleep(for: .milliseconds(40))
        }
        return answered
    }

    /// P2: `product.save`; Ergebnis kommt als Ack (`recentAcks`), die Ansicht wartet über `ackOutcome`.
    func saveProduct(_ command: Command) -> String? {
        do {
            return try store.performNutrition(command, asUser: store.userId).id
        } catch {
            notice = TrainingNotice(text: describe(error))
            return nil
        }
    }

    /// Letztes Ack eines eigenen Befehls (für Speichern-Abläufe mit Warnungsbestätigung).
    func ackOutcome(_ commandId: String) -> AckEvent? {
        store.recentAcks.last { $0.commandId == commandId }
    }

    /// Geparkten bzw. gehaltenen eigenen Befehl verwerfen (z. B. nach `conflict` wegen Warnungen, vor erneutem Senden).
    func discardOwn(_ commandId: String) {
        try? store.discardCommand(id: commandId)
    }

    // MARK: Ops

    func addWater() {
        guard let date = projection?.date, let command = NutritionCommands.water(id: NutritionOps.makeID(), date: date) else { return }
        if perform(command) { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    }

    func setDayComplete(_ done: Bool) {
        guard let date = projection?.date, !isDayCompletePending,
              let command = NutritionCommands.completeDay(date: date, done: done) else { return }
        perform(command)
    }

    @discardableResult
    func setWaterGoal(_ ml: Int) -> Bool {
        guard let command = NutritionCommands.waterGoal(ml: ml) else {
            notice = TrainingNotice(text: text("Wasserziel 0 bis 10 000 ml.", "Water goal 0 to 10,000 ml."))
            return false
        }
        return perform(command)
    }

    /// Ganzes Formular (alle bekannten Mikros, `0` = kein eigenes Ziel).
    @discardableResult
    func setMicroGoals(_ goals: [String: Double]) -> Bool {
        guard let command = NutritionCommands.microGoals(goals) else {
            notice = TrainingNotice(text: text("Ziele 0 bis 1 000 000.", "Goals 0 to 1,000,000."))
            return false
        }
        return perform(command)
    }

    /// `true`, wenn der Eintrag eingereiht wurde.
    @discardableResult
    func add(_ detail: NutritionProductDetail, amount: Double, unit: NutritionUnit) -> Bool {
        guard let date = projection?.date else { return false }
        let productId = detail.newCatalogProduct ? NutritionOps.makeID() : nil
        guard let command = NutritionCommands.add(entryId: NutritionOps.makeID(), detail: detail, amount: amount, unit: unit,
                                                  date: date, productId: productId,
                                                  includePortionSnapshot: capabilities?.isAtLeastP2 == true) else {
            notice = TrainingNotice(text: text("Menge 0,1 bis 10 000 g bzw. ml.", "Amount 0.1 to 10,000 g or ml."))
            return false
        }
        let ok = perform(command)
        if ok { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        return ok
    }

    @discardableResult
    func update(_ detail: NutritionEntryDetail, amount: Double) -> Bool {
        guard let command = NutritionCommands.update(detail: detail, amount: amount) else {
            notice = TrainingNotice(text: text("Menge 0,1 bis 10 000.", "Amount 0.1 to 10,000."))
            return false
        }
        return perform(command)
    }

    func setFavorite(_ detail: NutritionProductDetail, favorite: Bool) {
        guard let command = NutritionCommands.favorite(detail: detail, favorite: favorite) else { return }
        perform(command)
    }

    /// Wischen zum Löschen: vollständigen Eintrag holen (Erwartung und Undo-Snapshot), dann `food.delete`.
    func delete(_ entry: NutritionEntry) async {
        guard canWrite, supportsEntry, !deletingEntryIds.contains(entry.id) else {
            if !canWrite { notice = TrainingNotice(text: describe(ProfileStoreError.readOnly)) }
            return
        }
        deletingEntryIds.insert(entry.id)
        hiddenEntryIds.insert(entry.id)
        defer { deletingEntryIds.remove(entry.id) }
        switch await entryDetail(entry.id) {
        case .loaded(let detail):
            _ = delete(detail)
        case .gone:
            // Schon weg (z. B. im Web gelöscht): die nächste Projektion zeigt den Stand.
            break
        default:
            hiddenEntryIds.remove(entry.id)
            notice = TrainingNotice(text: text("Konnte nicht gelöscht werden. Bitte erneut versuchen.", "Could not delete. Please try again."))
        }
    }

    /// Löschen mit bereits geholtem Eintrag (auch aus dem Bearbeiten-Sheet). Zu große Snapshots nur im Web.
    @discardableResult
    func delete(_ detail: NutritionEntryDetail) -> Bool {
        guard let command = NutritionCommands.delete(detail: detail) else {
            hiddenEntryIds.remove(detail.id)
            notice = TrainingNotice(text: text("Dieser Eintrag ist zu groß für natives Rückgängig. Bitte im Web löschen.",
                                               "This entry is too large for native undo. Please delete it in the web view."))
            return false
        }
        hiddenEntryIds.insert(detail.id)
        do {
            let apply = try store.performNutrition(command, asUser: store.userId)
            undoStack.append(NutritionUndo(detail: detail, deleteCommandId: apply.id))
            if undoStack.count > 10 { undoStack.removeFirst(undoStack.count - 10) }
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            return true
        } catch {
            hiddenEntryIds.remove(detail.id)
            notice = TrainingNotice(text: describe(error))
            return false
        }
    }

    /// Rückgängig: ein nachweislich nie gesendetes Löschen verwerfen, sonst den alten Snapshot per `food.restore`.
    func undo(_ item: NutritionUndo) {
        undoStack.removeAll { $0.id == item.id }
        if store.isUnsent(commandId: item.deleteCommandId), (try? store.discardCommand(id: item.deleteCommandId)) != nil {
            hiddenEntryIds.remove(item.detail.id)
            return
        }
        guard let command = NutritionCommands.restore(detail: item.detail) else { return }
        if perform(command) {
            hiddenEntryIds.remove(item.detail.id)
        }
    }

    func dismissUndo(_ item: NutritionUndo) {
        undoStack.removeAll { $0.id == item.id }
    }

    @discardableResult
    private func perform(_ command: Command) -> Bool {
        do {
            try store.performNutrition(command, asUser: store.userId)
            return true
        } catch {
            notice = TrainingNotice(text: describe(error))
            return false
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

    func present(_ sheet: NutritionSheet) {
        self.sheet = sheet
    }

    /// Web-Ausweg: eigenes Sheet vorher schließen, dann die gemeinsame WebView zeigen.
    func openWeb(_ target: NavigationTarget?) {
        guard let target else { return }
        sheet = nil
        onOpenWeb?(target)
    }

    /// Vollständiges Web-Tagebuch (`navigation` der Projektion).
    func openWebDiary() {
        openWeb(projection?.navigation ?? NavigationTarget(page: "food", web: true))
    }

    /// Web-Essensdialog mit Suche/Barcode/Foto/Rezepten/Eigenen Werten (P2-Abläufe bis zur nativen Freigabe).
    func openWebAdd() {
        openWeb(NavigationTarget(action: "addFood"))
    }

    func openWebEdit(_ id: String) {
        openWeb(NavigationTarget(action: "editFood", id: id))
    }

    /// Übersichts-Einstiege nativ: „Essen eintragen“ öffnet die native Suche, „Bearbeiten“ das native Mengenblatt.
    func handleOverviewAction(_ action: String, id: String?) -> Bool {
        guard isOffered, supportsSearch, supportsProduct else { return false }
        switch action {
        case "addFood":
            onSelectFoodTab?()
            sheet = .search
            return true
        case "editFood":
            guard let id, supportsEntry else { return false }
            onSelectFoodTab?()
            sheet = .entry(id)
            return true
        default:
            return false
        }
    }

    // MARK: Konflikte

    var conflicts: [OutboxEntry] { store.nutritionConflicts }

    func discardConflict(id: String) {
        do { try store.discardNutritionConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    func reapplyConflict(id: String) {
        do { try store.reapplyNutritionConflict(id: id, asUser: store.userId) } catch { notice = TrainingNotice(text: describe(error)) }
    }

    func conflictTitle(_ entry: OutboxEntry) -> String {
        switch entry.command.op {
        case NutritionOps.foodAdd: return text("Eintrag hinzufügen", "Add entry")
        case NutritionOps.foodUpdate: return text("Menge ändern", "Change amount")
        case NutritionOps.foodDelete: return text("Eintrag löschen", "Delete entry")
        case NutritionOps.foodRestore: return text("Löschen rückgängig", "Undo delete")
        case NutritionOps.waterAdd: return text("Wasser hinzufügen", "Add water")
        case NutritionOps.dayComplete: return text("Tagesabschluss", "Day completion")
        case NutritionOps.microGoalsSet: return text("Mikronährstoffziele", "Micronutrient goals")
        case NutritionOps.waterGoalSet: return text("Wasserziel", "Water goal")
        case NutritionOps.productFavorite: return text("Favorit", "Favourite")
        default: return entry.command.op
        }
    }

    // MARK: Beobachtung

    private func observeStore() {
        withObservationTracking {
            processAcks()
            resetOnGenerationChange()
            pruneHidden()
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observeStore() }
        }
    }

    /// Neues Dokument, ownerPending oder Kontowechsel: Sheets und Undo schließen, nie Daten eines anderen Kontos zeigen.
    private func resetOnGenerationChange() {
        let generation = store.nutritionGeneration
        defer { seenGeneration = generation }
        guard let seen = seenGeneration, seen != generation else { return }
        sheet = nil
        notice = nil
        undoStack = []
        hiddenEntryIds = []
        deletingEntryIds = []
    }

    /// Ausgeblendete Einträge wieder freigeben, sobald die Projektion sie nicht mehr enthält und kein Löschen läuft.
    private func pruneHidden() {
        guard let entries = projection?.entries, !hiddenEntryIds.isEmpty else { return }
        let present = Set(entries.map(\.id))
        let running = Set(store.unconfirmedNutrition.filter { $0.op == NutritionOps.foodDelete }.compactMap { $0.args["id"]?.stringValue })
        let undoable = Set(undoStack.map(\.detail.id))
        let keep = hiddenEntryIds.filter {
            present.contains($0) && (running.contains($0) || deletingEntryIds.contains($0) || undoable.contains($0))
        }
        if keep != hiddenEntryIds { hiddenEntryIds = keep }
    }

    /// Fehler eigener Befehle melden. `busy`/`persist_failed`/`readonly`/`not_ready` bleiben in der Outbox und werden
    /// später erneut gesendet; `conflict` zeigt die Konfliktliste. Abgelehntes Löschen zeigt den Eintrag wieder.
    private func processAcks() {
        let events = store.recentAcks.filter { $0.serial > handledAckSerial }
        guard let last = events.last else { return }
        handledAckSerial = last.serial
        for event in events where NutritionOps.isNutrition(event.op) {
            if !event.ok, event.op == NutritionOps.foodDelete, let id = event.args["id"]?.stringValue, let code = event.code,
               [AckErrorCode.invalid, .gone, .conflict, .wrongUser, .unknownOp].contains(code) {
                hiddenEntryIds.remove(id)
                undoStack.removeAll { $0.deleteCommandId == event.commandId }
            }
            // `product.save`-Fehler zeigt der Speichern-Ablauf selbst (Warnungsbestätigung).
            guard !event.ok, event.op != NutritionOps.productSave else { continue }
            switch event.code {
            case .busy?, .readonly?, .persistFailed?, .notReady?:
                continue
            case .conflict?:
                notice = TrainingNotice(text: text("Der Stand hat sich inzwischen geändert. Bitte unten prüfen.",
                                                   "This changed in the meantime. Please check below."))
            case .gone?:
                notice = TrainingNotice(text: text("Das gibt es nicht mehr. Die Anzeige ist aktualisiert.",
                                                   "This no longer exists. The view has been updated."))
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

/// P2-Freigaben (§12.5): nur, wenn das aktuelle Hello Stufe P2, die Query-Art und `product.save` meldet. Native liefert
/// ausschließlich Barcode-String bzw. geordnete Vision-Textzeilen; Parsing, Warnungen, Normalisierung und Speichern
/// bleiben Web. Ohne Meldung führen dieselben Einstiege in den Web-Dialog (kein toter Knopf).
enum NutritionP2 {
    static func canSaveProducts(capabilities: NutritionCapabilities?, ops: [String]) -> Bool {
        guard let capabilities, capabilities.isAtLeastP2 else { return false }
        return ops.contains(NutritionOps.productSave) && capabilities.supports(.product)
    }

    static func barcodeEnabled(capabilities: NutritionCapabilities?, ops: [String]) -> Bool {
        canSaveProducts(capabilities: capabilities, ops: ops)
    }

    static func labelEnabled(capabilities: NutritionCapabilities?, ops: [String]) -> Bool {
        canSaveProducts(capabilities: capabilities, ops: ops) && capabilities?.supports(.labelParse) == true
    }
}