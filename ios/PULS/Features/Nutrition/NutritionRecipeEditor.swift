import SwiftUI
import UIKit
import PULSCore

// §12.5: Rezept anlegen, bearbeiten und importieren. Native sammelt Zutaten, Mengen und das gewogene Endgewicht; Prüfung,
// Summen und je-100-Werte macht allein das Web. Es gibt keine Vorschau der Nährwerte des Entwurfs: Dafür fehlt eine Query, und
// eine eigene Rechnung gäbe es nur doppelt. Nach dem Speichern zeigt die Produktansicht die Web-Werte.

/// Auswahl einer Zutat; `line` = Importzeile, zu der sie gehört.
private struct RecipePickRequest: Identifiable {
    let id = UUID()
    let line: Int?
    let query: String
    let amount: Double?
    let matches: [NutritionRecipeImport.Match]
}

struct NutritionRecipeEditor: View {
    let coordinator: NutritionCoordinator
    /// Import: Quelle, Vorschläge und Bestätigungspflicht.
    let source: NutritionRecipeImport?
    let onDone: () -> Void
    @State private var draft: RecipeDraft
    @State private var yieldText: String
    @State private var amounts: [UUID: String]
    @State private var picking: RecipePickRequest?
    /// Importzeilen, die übernommen oder bewusst übersprungen sind.
    @State private var handled: Set<Int> = []
    /// Die Bestätigung gilt nur für genau diesen Stand; jede Änderung hebt sie auf.
    @State private var confirmedFor: RecipeDraft?
    @State private var commandId: String?
    @State private var status: String?
    @FocusState private var focused: Bool

    init(coordinator: NutritionCoordinator, draft: RecipeDraft, source: NutritionRecipeImport? = nil, onDone: @escaping () -> Void) {
        self.coordinator = coordinator
        self.source = source
        self.onDone = onDone
        let locale = coordinator.text.locale
        _draft = State(initialValue: draft)
        _yieldText = State(initialValue: draft.yieldGrams.map { NutritionInput.text($0, locale: locale) } ?? "")
        var texts: [UUID: String] = [:]
        for ingredient in draft.ingredients {
            texts[ingredient.id] = ingredient.amount.map { NutritionInput.text($0, locale: locale) } ?? ""
        }
        _amounts = State(initialValue: texts)
    }

    private func number(_ value: String) -> Double? {
        NutritionInput.number(value, locale: coordinator.text.locale)
    }

    /// Entwurf mit den aktuellen Eingaben.
    private var currentDraft: RecipeDraft {
        var result = draft
        result.yieldGrams = number(yieldText)
        for index in result.ingredients.indices {
            result.ingredients[index].amount = number(amounts[result.ingredients[index].id] ?? "")
        }
        return result
    }

    private var isConfirmed: Bool { confirmedFor == currentDraft }

    private var command: Command? {
        if let source {
            return NutritionCommands.saveImportedRecipe(currentDraft, source: source, confirmed: isConfirmed)
        }
        return NutritionCommands.saveRecipe(currentDraft)
    }

    var body: some View {
        let text = coordinator.text
        Form {
            Section {
                TextField(text("Rezeptname", "Recipe name"), text: $draft.name)
                    .focused($focused)
            }
            if let source { importSection(source, text: text) }
            ingredientsSection(text)
            Section {
                HStack {
                    TextField(text("Gesamtgewicht", "Total weight"), text: $yieldText)
                        .keyboardType(.decimalPad)
                        .focused($focused)
                        .monospacedDigit()
                        .accessibilityLabel(text("Gesamtgewicht nach dem Kochen in Gramm", "Total weight after cooking in grams"))
                    Text("g").foregroundStyle(.secondary)
                }
            } header: {
                Text(text("Fertiges Gericht wiegen", "Weigh the finished dish"))
            } footer: {
                Text(text("Ohne Topf, nach dem Kochen. Nudelwasser erhöht das Gewicht, Verdampfen verringert es. Nicht einfach die Rohgewichte addieren. Die Werte je 100 g berechnet PULS beim Speichern.",
                          "Without the pot, after cooking. Pasta water adds weight, evaporation reduces it. Do not simply add up the raw weights. PULS calculates the values per 100 g when saving."))
            }
            if source != nil {
                Section {
                    Toggle(text("Zutaten und Mengen geprüft", "Ingredients and amounts checked"),
                           isOn: Binding(get: { isConfirmed }, set: { confirmedFor = $0 ? currentDraft : nil }))
                } footer: {
                    Text(text("Website-Nährwerte werden nicht übernommen. Es zählen nur die gewählten Zutaten.",
                              "Website nutrition values are not used. Only the chosen ingredients count."))
                }
            }
            Section {
                if let status {
                    Text(status).font(.subheadline).foregroundStyle(.secondary)
                }
                Button {
                    save()
                } label: {
                    HStack {
                        Spacer()
                        if commandId != nil { ProgressView().padding(.trailing, 6) }
                        Text(text("Rezept speichern", "Save recipe")).font(.headline)
                        Spacer()
                    }
                    .frame(minHeight: 36)
                }
                .buttonStyle(.borderedProminent)
                .disabled(command == nil || commandId != nil || !coordinator.canWrite)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
        }
        .navigationTitle(source != nil ? text("Rezept importieren", "Import recipe")
                                       : draft.expect == nil ? text("Neues Rezept", "New recipe") : text("Rezept bearbeiten", "Edit recipe"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button(text("Fertig", "Done")) { focused = false }
            }
        }
        .sheet(item: $picking) { request in
            RecipeIngredientPicker(coordinator: coordinator, query: request.query, amount: request.amount, matches: request.matches,
                                   canSkip: request.line != nil,
                                   onPick: { ingredient in add(ingredient, line: request.line) },
                                   onSkip: { if let line = request.line { handled.insert(line) } })
        }
        .task(id: commandId) { await awaitAck() }
    }

    @ViewBuilder
    private func importSection(_ source: NutritionRecipeImport, text: OverviewText) -> some View {
        Section {
            ForEach(source.suggestions) { suggestion in
                Button {
                    picking = RecipePickRequest(line: suggestion.id, query: suggestion.query, amount: suggestion.amount, matches: suggestion.matches)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: handled.contains(suggestion.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(handled.contains(suggestion.id) ? Color.green : Color.secondary)
                            .accessibilityHidden(true)
                        Text(suggestion.line).foregroundStyle(.primary)
                    }
                }
                .accessibilityValue(handled.contains(suggestion.id) ? text("erledigt", "done") : text("offen", "open"))
            }
        } header: {
            Text(text("Importierte Zeilen", "Imported lines"))
        } footer: {
            VStack(alignment: .leading, spacing: 4) {
                Text(text("Tippe eine Zeile an und wähle die passende Zutat. Nichts wird automatisch übernommen.",
                          "Tap a line and choose the matching ingredient. Nothing is added automatically."))
                if source.omitted > 0 {
                    Text(text("\(source.omitted) weitere Zeilen passen nicht in diese Ansicht; ergänze sie unten selbst.",
                              "\(source.omitted) more lines do not fit this view; add them below yourself."))
                }
            }
        }
    }

    private func ingredientsSection(_ text: OverviewText) -> some View {
        Section {
            ForEach(draft.ingredients) { ingredient in
                VStack(alignment: .leading, spacing: 6) {
                    Text(ingredient.name)
                    if let kcal = ingredient.kcal {
                        Text("\(text.number(kcal)) kcal / 100 \(ingredient.unit)")
                            .font(.footnote)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        TextField(text("Menge", "Amount"), text: amountBinding(ingredient.id))
                            .keyboardType(.decimalPad)
                            .focused($focused)
                            .monospacedDigit()
                            .accessibilityLabel(text("Menge von \(ingredient.name)", "Amount of \(ingredient.name)"))
                        Text(ingredient.unit).foregroundStyle(.secondary)
                    }
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        remove(ingredient)
                    } label: {
                        Label(text("Entfernen", "Remove"), systemImage: "trash")
                    }
                }
                .accessibilityAction(named: Text(text("Entfernen", "Remove"))) { remove(ingredient) }
            }
            Button {
                picking = RecipePickRequest(line: nil, query: "", amount: 100, matches: [])
            } label: {
                Label(text("Zutat hinzufügen", "Add ingredient"), systemImage: "plus")
            }
            .disabled(draft.ingredients.count >= 100)
        } header: {
            Text(text("Alle Zutaten", "All ingredients"))
        } footer: {
            Text(text("Auch Öl, Käse und Sauce. Roh- und Trockenmengen mit Roh- und Trockenwerten kombinieren. Zum Entfernen nach links wischen.",
                      "Include oil, cheese and sauce. Combine raw and dry amounts with raw and dry values. Swipe left to remove."))
        }
    }

    private func amountBinding(_ id: UUID) -> Binding<String> {
        Binding(get: { amounts[id] ?? "" }, set: { amounts[id] = $0 })
    }

    private func remove(_ ingredient: RecipeIngredient) {
        draft.ingredients.removeAll { $0.id == ingredient.id }
        amounts[ingredient.id] = nil
    }

    private func add(_ ingredient: RecipeIngredient, line: Int?) {
        guard draft.ingredients.count < 100 else { return }
        draft.ingredients.append(ingredient)
        amounts[ingredient.id] = ingredient.amount.map { NutritionInput.text($0, locale: coordinator.text.locale) } ?? ""
        if let line { handled.insert(line) }
    }

    private func save() {
        guard let command else { return }
        focused = false
        status = nil
        commandId = coordinator.saveProduct(command)
    }

    /// Wartet auf das Ack: `invalid` nennt den Web-Grund (z. B. Nährwertgrenze), `conflict` heißt, das Rezept wurde anderswo geändert.
    private func awaitAck() async {
        guard let commandId else { return }
        let text = coordinator.text
        while !Task.isCancelled {
            if let event = coordinator.ackOutcome(commandId) {
                if event.ok {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    self.commandId = nil
                    onDone()
                    return
                }
                switch event.code {
                case .busy?, .persistFailed?, .readonly?, .notReady?:
                    status = text("Wird gespeichert, sobald PULS bereit ist.", "Will be saved as soon as PULS is ready.")
                case .conflict?:
                    coordinator.discardOwn(commandId)
                    status = text("Das Rezept wurde inzwischen geändert. Bitte neu öffnen.", "The recipe changed in the meantime. Please open it again.")
                    self.commandId = nil
                    return
                default:
                    status = text("Nicht gespeichert", "Not saved") + (event.message.map { ": \($0)" } ?? ".")
                    self.commandId = nil
                    return
                }
            }
            try? await Task.sleep(for: .milliseconds(80))
        }
    }
}

// MARK: - Zutat wählen

private struct RecipeIngredientPicker: View {
    let coordinator: NutritionCoordinator
    let amount: Double?
    let matches: [NutritionRecipeImport.Match]
    let canSkip: Bool
    let onPick: (RecipeIngredient) -> Void
    let onSkip: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query: String
    @State private var items: [NutritionProduct] = []
    @State private var searching = false

    init(coordinator: NutritionCoordinator, query: String, amount: Double?, matches: [NutritionRecipeImport.Match], canSkip: Bool,
         onPick: @escaping (RecipeIngredient) -> Void, onSkip: @escaping () -> Void) {
        self.coordinator = coordinator
        self.amount = amount
        self.matches = matches
        self.canSkip = canSkip
        self.onPick = onPick
        self.onSkip = onSkip
        _query = State(initialValue: query)
    }

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            List {
                if !matches.isEmpty {
                    Section(text("Vorschläge", "Suggestions")) {
                        ForEach(matches) { match in
                            Button {
                                pick(RecipeIngredient(raw: match.ingredient, amount: match.ingredient["amount"]?.doubleValue))
                            } label: {
                                Text(match.name).foregroundStyle(.primary)
                            }
                        }
                    }
                }
                Section {
                    ForEach(items) { product in
                        Button {
                            if let ingredient = RecipeIngredient(product: product, amount: amount) { pick(ingredient) }
                        } label: {
                            NutritionProductRow(product: product, text: text)
                                .foregroundStyle(.primary)
                        }
                    }
                    if searching, items.isEmpty {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    } else if items.isEmpty {
                        Text(text("Keine passende Zutat.", "No matching ingredient.")).foregroundStyle(.secondary)
                    }
                } header: {
                    Text(text("Lebensmittel", "Foods"))
                } footer: {
                    Text(text("Nur geprüfte Lebensmittel mit vollständigen Werten. Barcode-Produkte vorher speichern.",
                              "Only reviewed foods with complete values. Save barcode products first."))
                }
                Section {
                    NavigationLink {
                        RecipeOwnIngredientForm(coordinator: coordinator, amount: amount) { pick($0) }
                    } label: {
                        Label(text("Eigene Zutatenwerte eingeben", "Enter own ingredient values"), systemImage: "square.and.pencil")
                    }
                    if canSkip {
                        Button(text("Zeile überspringen", "Skip this line")) {
                            onSkip()
                            dismiss()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: text("Lebensmittel suchen", "Search foods"))
            .navigationTitle(text("Zutat hinzufügen", "Add ingredient"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
            }
        }
        .environment(\.locale, text.locale)
        .tint(.blue)
        .task(id: query) { await search() }
    }

    private func pick(_ ingredient: RecipeIngredient) {
        onPick(ingredient)
        dismiss()
    }

    /// Lokale Web-Suche; OFF-Treffer bleiben außen vor, sie wären ungeprüft.
    private func search() async {
        var trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        while trimmed.utf16.count > 100 { trimmed.removeLast() }
        if !trimmed.isEmpty {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
        }
        searching = true
        defer { if !Task.isCancelled { searching = false } }
        let term = trimmed
        _ = await coordinator.search({
            NutritionQueryRequest.search(term, filter: .all, limit: 60, requestId: $0)
        }) { result in
            guard !Task.isCancelled else { return }
            items = result.items.filter { $0.complete && $0.unitKnown && !$0.reviewRequired }
        }
    }
}

/// Eigene Etikettwerte wie `recipeOwnIngredient`; leere Felder sind ungültig, nie 0.
private struct RecipeOwnIngredientForm: View {
    let coordinator: NutritionCoordinator
    let onAdd: (RecipeIngredient) -> Void
    @State private var name = ""
    @State private var unit = "g"
    @State private var kcal = ""
    @State private var p = ""
    @State private var c = ""
    @State private var f = ""
    @State private var amountText: String

    init(coordinator: NutritionCoordinator, amount: Double?, onAdd: @escaping (RecipeIngredient) -> Void) {
        self.coordinator = coordinator
        self.onAdd = onAdd
        _amountText = State(initialValue: amount.map { NutritionInput.text($0, locale: coordinator.text.locale) } ?? "")
    }

    private func number(_ value: String) -> Double? {
        NutritionInput.number(value, locale: coordinator.text.locale)
    }

    private var ingredient: RecipeIngredient? {
        guard let amount = number(amountText), amount >= 0.1, amount <= 100_000, let kcal = number(kcal), let p = number(p),
              let c = number(c), let f = number(f) else { return nil }
        return RecipeIngredient(name: name, unit: unit, amount: amount, kcal: kcal, p: p, c: c, f: f)
    }

    var body: some View {
        let text = coordinator.text
        Form {
            Section {
                TextField(text("Zutatenname, z. B. Hackfleisch, roh", "Ingredient name, e.g. minced meat, raw"), text: $name)
                Picker(text("Werte beziehen sich auf", "Values refer to"), selection: $unit) {
                    Text("100 g").tag("g")
                    Text("100 ml").tag("ml")
                }
            }
            Section {
                field(text("Energie (kcal)", "Energy (kcal)"), $kcal)
                field(text.macroLabel("p") + " (g)", $p)
                field(text.macroLabel("c") + " (g)", $c)
                field(text.macroLabel("f") + " (g)", $f)
            } footer: {
                Text(text("Kalorien bis 1000, Makros bis 100 je 100 \(unit).", "Calories up to 1000, macros up to 100 per 100 \(unit)."))
            }
            Section {
                field(text("Verwendete Menge (\(unit))", "Amount used (\(unit))"), $amountText)
            }
            Section {
                Button(text("Zum Rezept hinzufügen", "Add to recipe")) {
                    if let ingredient { onAdd(ingredient) }
                }
                .disabled(ingredient == nil)
            }
        }
        .navigationTitle(text("Eigene Zutat", "Own ingredient"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func field(_ title: String, _ value: Binding<String>) -> some View {
        LabeledContent(title) {
            TextField("", text: value)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .accessibilityLabel(title)
        }
    }
}

// MARK: - Import

/// Rezept importieren: Adresse oder eingefügter Text. Laden und Lesen macht das Web, Prüfen geschieht im Editor.
struct NutritionRecipeImportView: View {
    let coordinator: NutritionCoordinator
    let onDone: () -> Void
    @State private var url = ""
    @State private var pasted = ""
    @State private var isLoading = false
    @State private var failure: String?
    @State private var imported: NutritionRecipeImport?

    init(coordinator: NutritionCoordinator, onDone: @escaping () -> Void) {
        self.coordinator = coordinator
        self.onDone = onDone
    }

    var body: some View {
        if let imported {
            NutritionRecipeEditor(coordinator: coordinator, draft: RecipeDraft(id: NutritionOps.makeID(), name: imported.name),
                                  source: imported, onDone: onDone)
        } else {
            form(coordinator.text)
        }
    }

    private func form(_ text: OverviewText) -> some View {
        Form {
            Section {
                TextField("https://…", text: $url)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel(text("Rezept-Adresse", "Recipe address"))
                Button(text("Von Adresse laden", "Load from address")) {
                    let address = url.trimmingCharacters(in: .whitespacesAndNewlines)
                    run { NutritionQueryRequest.recipeImport(url: address, requestId: $0) }
                }
                .disabled(url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
            } header: {
                Text(text("Rezept-Adresse", "Recipe address"))
            } footer: {
                Text(text("Die Website muss den Zugriff erlauben und Rezeptdaten anbieten. Sonst den Text unten einfügen.",
                          "The website must allow access and offer recipe data. Otherwise paste the text below."))
            }
            Section {
                TextEditor(text: $pasted)
                    .frame(minHeight: 140)
                    .accessibilityLabel(text("Rezeptdaten oder Zutatenliste", "Recipe data or ingredient list"))
                Button(text("Import prüfen", "Check import")) {
                    let content = pasted
                    run { NutritionQueryRequest.recipeImport(text: content, requestId: $0) }
                }
                .disabled(pasted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
            } header: {
                Text(text("Recipe JSON-LD oder Zutatenliste", "Recipe JSON-LD or ingredient list"))
            }
            if isLoading || failure != nil {
                Section {
                    if isLoading { ProgressView().frame(maxWidth: .infinity) }
                    if let failure { Text(failure).foregroundStyle(.secondary) }
                }
            }
        }
        .navigationTitle(text("Rezept importieren", "Import recipe"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func run(_ build: @escaping (String) -> NutritionQueryRequest?) {
        guard !isLoading else { return }
        isLoading = true
        failure = nil
        Task { @MainActor in
            let result = await coordinator.recipeImport(build)
            isLoading = false
            if let result {
                imported = result
            } else {
                let text = coordinator.text
                failure = coordinator.lastQueryError ?? text("Konnte nicht gelesen werden. Füge die Rezeptdaten oder die Zutatenliste ein.",
                                                             "Could not be read. Paste the recipe data or the ingredient list.")
            }
        }
    }
}
