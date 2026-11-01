import SwiftUI
import PULSCore

// Produktdetail (Menge, Einheit, Portionen), Eintrag bearbeiten, Wasser- und Mikroziele. Einheiten und Faktoren kommen
// ausschließlich aus der Web-`product`-Query (`ffUnits`): g↔ml nur, wenn das Web sie mit bekannter Dichte liefert.
// Native zeigt keine eigene Nährwert-Vorschau für die Menge; die gespeicherten Werte bildet allein das Web.

// MARK: - Produkt

struct NutritionProductView: View {
    let coordinator: NutritionCoordinator
    let ref: ProductRef
    /// Nach erfolgreichem Eintragen (schließt das Such-Sheet).
    var onAdded: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var phase: LoadPhase<NutritionProductDetail> = .loading
    @State private var recipe: NutritionRecipeDetail?
    @State private var amountText = ""
    @State private var unitKey: String?
    @FocusState private var amountFocused: Bool

    var body: some View {
        let text = coordinator.text
        content(text)
            .navigationTitle(phase.value?.product.name ?? text("Lebensmittel", "Food"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if onAdded == nil {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(text("Schließen", "Close")) { dismiss() }
                    }
                }
                if let detail = phase.value, detail.canFavorite, coordinator.canWrite {
                    ToolbarItem(placement: .primaryAction) {
                        let pending = coordinator.store.hasUnconfirmedNutrition(NutritionOps.productFavorite) {
                            ProductRef(json: $0["product"]) == ref
                        }
                        Button {
                            coordinator.setFavorite(detail, favorite: !detail.product.favorite)
                        } label: {
                            Image(systemName: detail.product.favorite ? "star.fill" : "star")
                        }
                        .disabled(pending)
                        .accessibilityLabel(detail.product.favorite ? text("Aus Favoriten entfernen", "Remove from favourites")
                                                                    : text("Zu Favoriten", "Add to favourites"))
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(text("Fertig", "Done")) { amountFocused = false }
                }
            }
            .task(id: "\(ref.key)|\(coordinator.dataRevision)") { await load() }
    }

    @ViewBuilder
    private func content(_ text: OverviewText) -> some View {
        switch phase {
        case .loading where phase.value == nil:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .loaded(let detail):
            if needsReview(detail), coordinator.nativeProductSave {
                // P2: Barcode-/OFF-Entwurf erst prüfen und speichern, dann wie ein lokales Produkt eintragen.
                NutritionProductEditor(coordinator: coordinator, mode: .review(detail), onDone: onAdded ?? { dismiss() })
            } else {
                form(detail, text: text)
            }
        case .gone:
            ContentUnavailableView {
                Label(text("Nicht mehr vorhanden", "No longer available"), systemImage: "questionmark.circle")
            } description: {
                Text(text("Bitte erneut suchen.", "Please search again."))
            }
        default:
            ContentUnavailableView {
                Label(text("Konnte nicht geladen werden", "Could not be loaded"), systemImage: "exclamationmark.triangle")
            } actions: {
                Button(text("Erneut versuchen", "Try again")) { Task { await load() } }
                    .buttonStyle(.borderedProminent)
                Button(text("Im Web-Dialog öffnen", "Open in the web dialog")) { coordinator.openWebAdd() }
            }
        }
    }

    /// Ungeprüfter Entwurf (OFF/Barcode) bzw. noch nicht freigegebenes Barcode-Produkt.
    private func needsReview(_ detail: NutritionProductDetail) -> Bool {
        if case .barcode = detail.product.ref { return !detail.canAdd || detail.product.reviewRequired }
        return detail.draft != nil
    }

    private func load() async {
        let result = await coordinator.productDetail(ref)
        guard !Task.isCancelled else { return }
        // Ein Fehler beim Nachladen (z. B. nach Favorit) ersetzt keine bereits gezeigten Daten.
        if case .failed = result, phase.value != nil { return }
        phase = result
        if let detail = result.value {
            if unitKey == nil || detail.unit(unitKey ?? "") == nil {
                unitKey = detail.defaultUnit?.key
            }
            if amountText.isEmpty {
                let start = detail.defaultAmount.flatMap { $0 > 0 ? $0 : nil } ?? 100
                amountText = NutritionInput.text(start, locale: coordinator.text.locale)
            }
            if case .recipeId(let id) = detail.product.ref, recipe == nil, coordinator.supportsRecipe {
                recipe = await coordinator.recipeDetail(id).value
            }
        }
    }

    private func form(_ detail: NutritionProductDetail, text: OverviewText) -> some View {
        let unit = unitKey.flatMap(detail.unit) ?? detail.defaultUnit
        let amount = NutritionInput.number(amountText, locale: text.locale)
        let canonical = unit.flatMap { u in amount.flatMap { NutritionOps.canonicalAmount($0, factor: u.factor) } }
        return Form {
            Section {
                LabeledContent(text("Quelle", "Source"), value: detail.product.source.isEmpty ? "–" : detail.product.source)
                if !detail.product.brand.isEmpty {
                    LabeledContent(text("Marke", "Brand"), value: detail.product.brand)
                }
                macroRow(text("Energie", "Energy"), detail.product.kcal, unit: "kcal", text: text)
                macroRow(text.macroLabel("p"), detail.product.p, unit: "g", text: text)
                macroRow(text.macroLabel("c"), detail.product.c, unit: "g", text: text)
                macroRow(text.macroLabel("f"), detail.product.f, unit: "g", text: text)
            } header: {
                Text(text("Je 100 \(detail.base)", "Per 100 \(detail.base)"))
            } footer: {
                if detail.product.reviewRequired {
                    Text(text("Ungeprüfte Community-Daten. Bitte Werte prüfen.", "Unreviewed community data. Please check the values."))
                }
            }

            if !detail.warnings.isEmpty {
                Section {
                    ForEach(detail.warnings, id: \.self) { warning in
                        Label(warning, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.orange)
                    }
                }
            }

            if let recipe, !recipe.ingredients.isEmpty {
                Section {
                    ForEach(recipe.ingredients) { ingredient in
                        LabeledContent(ingredient.name.isEmpty ? text("Zutat", "Ingredient") : ingredient.name,
                                       value: ingredient.amount.map { "\(text.number($0)) \(ingredient.unit)" } ?? "–")
                    }
                    if let yield = recipe.yield {
                        LabeledContent(text("Fertiges Gesamtgewicht", "Cooked total weight"), value: "\(text.number(yield)) g")
                    }
                } header: {
                    Text(text("Zutaten", "Ingredients"))
                }
            }

            if detail.canAdd, detail.product.complete {
                Section {
                    HStack {
                        TextField(text("Menge", "Amount"), text: $amountText)
                            .keyboardType(.decimalPad)
                            .focused($amountFocused)
                            .monospacedDigit()
                            .accessibilityLabel(text("Menge", "Amount"))
                        Picker(text("Einheit", "Unit"), selection: Binding(get: { unit?.key ?? "" }, set: { unitKey = $0 })) {
                            ForEach(detail.units) { option in
                                Text(option.label).tag(option.key)
                            }
                        }
                        .labelsHidden()
                    }
                    if let unit, unit.key != detail.base, let canonical {
                        Text(text("Entspricht \(text.number(canonical)) \(detail.base)", "Equals \(text.number(canonical)) \(detail.base)"))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text(text("Menge", "Amount"))
                } footer: {
                    if amount != nil, canonical == nil {
                        Text(text("Menge 0,1 bis 10 000 \(detail.base).", "Amount 0.1 to 10,000 \(detail.base)."))
                            .foregroundStyle(.red)
                    }
                }
                Section {
                    Button {
                        guard let unit, let amount, coordinator.add(detail, amount: amount, unit: unit) else { return }
                        if let onAdded { onAdded() } else { dismiss() }
                    } label: {
                        Text(text("Eintragen", "Add"))
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(canonical == nil || !coordinator.canWrite)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            } else {
                Section {
                    Text(detail.product.complete
                         ? text("Dieses Produkt muss zuerst geprüft und gespeichert werden.", "This product must be reviewed and saved first.")
                         : text("Fehlende Nährwerte bitte im Web prüfen.", "Please check missing nutrients in the web view."))
                        .foregroundStyle(.secondary)
                    Button(text("Im Web-Dialog öffnen", "Open in the web dialog")) { coordinator.openWebAdd() }
                }
            }
        }
    }

    private func macroRow(_ label: String, _ value: Double?, unit: String, text: OverviewText) -> some View {
        LabeledContent(label, value: value.map { "\(text.number($0)) \(unit)" } ?? text("unbekannt", "unknown"))
            .monospacedDigit()
    }
}

/// Zahleneingabe: Komma oder Punkt, Vorbelegung ohne Tausendertrennung.
enum NutritionInput {
    static func text(_ value: Double, locale: Locale) -> String {
        value.formatted(.number.precision(.fractionLength(0...3)).grouping(.never).locale(locale))
    }

    static func number(_ text: String, locale: Locale) -> Double? {
        GoalInput.number(text, locale: locale)
    }
}

// MARK: - Eintrag bearbeiten

struct NutritionEntrySheet: View {
    let coordinator: NutritionCoordinator
    let entryId: String
    @Environment(\.dismiss) private var dismiss
    @State private var phase: LoadPhase<NutritionEntryDetail> = .loading
    @State private var amountText = ""
    @State private var confirmsDelete = false
    @FocusState private var focused: Bool

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            Group {
                switch phase {
                case .loading:
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                case .loaded(let detail):
                    form(detail, text: text)
                case .gone:
                    ContentUnavailableView(text("Eintrag nicht mehr vorhanden", "Entry no longer exists"), systemImage: "questionmark.circle")
                case .failed:
                    ContentUnavailableView {
                        Label(text("Konnte nicht geladen werden", "Could not be loaded"), systemImage: "exclamationmark.triangle")
                    } actions: {
                        Button(text("Erneut versuchen", "Try again")) { Task { await load() } }
                            .buttonStyle(.borderedProminent)
                        Button(text("Im Web bearbeiten", "Edit in the web view")) { coordinator.openWebEdit(entryId) }
                    }
                }
            }
            .navigationTitle(phase.value?.name ?? text("Eintrag", "Entry"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) { save() }
                        .disabled(newAmount == nil || !coordinator.canWrite)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .task { await load() }
    }

    private var newAmount: Double? {
        guard let value = NutritionInput.number(amountText, locale: coordinator.text.locale),
              value >= 0.1, value <= 10_000 else { return nil }
        return value
    }

    private func load() async {
        phase = .loading
        let result = await coordinator.entryDetail(entryId)
        guard !Task.isCancelled else { return }
        phase = result
        if let grams = result.value?.grams { amountText = NutritionInput.text(grams, locale: coordinator.text.locale) }
    }

    private func save() {
        guard let detail = phase.value, let amount = newAmount else { return }
        if amount == detail.grams {
            dismiss()
            return
        }
        if coordinator.update(detail, amount: amount) { dismiss() }
    }

    private func form(_ detail: NutritionEntryDetail, text: OverviewText) -> some View {
        Form {
            Section {
                HStack {
                    TextField(text("Menge", "Amount"), text: $amountText)
                        .keyboardType(.decimalPad)
                        .focused($focused)
                        .monospacedDigit()
                    Text(detail.base).foregroundStyle(.secondary)
                }
            } header: {
                Text(text("Menge", "Amount"))
            } footer: {
                Text(text("Nährwerte werden aus dem gespeicherten Eintrag anteilig angepasst, nicht aus dem aktuellen Produkt.",
                          "Nutrients are scaled from the saved entry, not from the current product."))
            }
            Section {
                if detail.canRestore {
                    Button(text("Eintrag löschen", "Delete entry"), role: .destructive) { confirmsDelete = true }
                        .disabled(!coordinator.canWrite)
                } else {
                    Button(text("Im Web löschen", "Delete in the web view")) { coordinator.openWebEdit(detail.id) }
                }
            } footer: {
                if !detail.canRestore {
                    Text(text("Dieser Eintrag ist zu groß für natives Rückgängig.", "This entry is too large for native undo."))
                }
            }
        }
        .confirmationDialog(text("Eintrag löschen?", "Delete entry?"), isPresented: $confirmsDelete, titleVisibility: .visible) {
            Button(text("Löschen", "Delete"), role: .destructive) {
                if coordinator.delete(detail) { dismiss() }
            }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        } message: {
            Text(text("Du kannst das Löschen danach rückgängig machen.", "You can undo the deletion afterwards."))
        }
    }
}

// MARK: - Wasserziel

struct NutritionWaterGoalSheet: View {
    let coordinator: NutritionCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var mlText = ""
    /// Beim Befüllen gesehener Rohwert: Erwartung des Befehls (ein inzwischen geänderter Stand → `conflict`).
    @State private var origin: JSONValue?

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField(text("Tagesziel", "Daily goal"), text: $mlText)
                            .keyboardType(.numberPad)
                            .monospacedDigit()
                        Text("ml").foregroundStyle(.secondary)
                    }
                } footer: {
                    Text(text("Eigenes Tagesziel in ml, 0 = ohne Ziel.", "Your daily goal in ml, 0 = no goal."))
                }
            }
            .navigationTitle(text("Dein Wasserziel", "Your water goal"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        if let ml = value, let origin, coordinator.setWaterGoal(ml, expect: origin) { dismiss() }
                    }
                    .disabled(value == nil)
                }
            }
        }
        .presentationDetents([.medium])
        .onAppear {
            guard origin == nil else { return }
            let raw = NutritionOps.waterGoalExpect(coordinator.store.document.root)
            origin = raw
            mlText = NutritionInput.text(raw.doubleValue ?? 0, locale: coordinator.text.locale)
        }
    }

    /// Ganze ml 0–10 000 (Web `waterGoalForm`).
    private var value: Int? {
        guard let number = NutritionInput.number(mlText, locale: coordinator.text.locale), number == number.rounded(),
              number >= 0, number <= 10_000 else { return nil }
        return Int(number)
    }
}

// MARK: - Mikroziele

struct NutritionMicroGoalsSheet: View {
    let coordinator: NutritionCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var values: [String: String] = [:]
    /// Beim Befüllen gesehenes rohes `microGoals` (Erwartung des Befehls).
    @State private var origin: JSONValue?

    var body: some View {
        let text = coordinator.text
        let micros = coordinator.projection?.micros ?? []
        NavigationStack {
            Form {
                Section {
                    ForEach(micros) { micro in
                        HStack {
                            Text(NutritionFormat.microLabel(micro, text: text))
                            Spacer(minLength: 8)
                            TextField(placeholder(micro, text: text), text: binding(micro.key))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .monospacedDigit()
                                .frame(maxWidth: 140)
                                .accessibilityLabel(NutritionFormat.microLabel(micro, text: text))
                            Text(micro.unit ?? "").foregroundStyle(.secondary).frame(minWidth: 28, alignment: .leading)
                        }
                    }
                } footer: {
                    Text(text("Leer oder 0 = Referenzwert verwenden.", "Empty or 0 = use the reference value."))
                }
            }
            .navigationTitle(text("Mikronährstoffziele", "Micronutrient goals"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        if let goals = goals(micros), let origin, coordinator.setMicroGoals(goals, expect: origin) { dismiss() }
                    }
                    .disabled(goals(micros) == nil)
                }
            }
        }
        .onAppear {
            guard origin == nil else { return }
            let raw = NutritionOps.microGoalsExpect(coordinator.store.document.root)
            origin = raw
            for micro in micros {
                if let value = raw[micro.key]?.doubleValue, value > 0 {
                    values[micro.key] = NutritionInput.text(value, locale: coordinator.text.locale)
                }
            }
        }
    }

    private func binding(_ key: String) -> Binding<String> {
        Binding(get: { values[key] ?? "" }, set: { values[key] = $0 })
    }

    private func placeholder(_ micro: NutritionMicro, text: OverviewText) -> String {
        micro.targetSource == "reference" ? micro.target.map { text.number($0) } ?? "" : ""
    }

    /// Ganzes Formular: jeder bekannte Schlüssel, leer = 0 (Ziel entfernen); ungültig → `nil`.
    private func goals(_ micros: [NutritionMicro]) -> [String: Double]? {
        var result: [String: Double] = [:]
        for micro in micros {
            let raw = (values[micro.key] ?? "").trimmingCharacters(in: .whitespaces)
            if raw.isEmpty {
                result[micro.key] = 0
                continue
            }
            guard let value = NutritionInput.number(raw, locale: coordinator.text.locale), value >= 0, value <= 1_000_000 else {
                return nil
            }
            result[micro.key] = value
        }
        return result.isEmpty ? nil : result
    }
}
