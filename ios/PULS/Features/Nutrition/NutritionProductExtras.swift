import SwiftUI
import PULSCore

// P2 (§12.5): Portionen, Produktzusätze und Rezeptverwaltung in der Produktansicht. Eingaben werden nur an Grenzen des
// Vertrags geprüft; Ergebnis, Einheiten und Umrechnungen bildet allein das Web. Erwartung ist immer das Rohobjekt der
// letzten Query. Solange eine Änderung unterwegs ist, bleiben weitere gesperrt (sonst wäre deren Erwartung veraltet).

// MARK: - Portionen

private struct PortionDraft: Identifiable {
    let id = UUID()
    let name: String
    let amountText: String
    let isNew: Bool
    /// Hinweis, wenn die alte Menge in einer anderen Einheit steht und deshalb neu einzugeben ist.
    let note: String?
}

/// Gespeicherte Portionen des Produkts: antippen ändert die Menge, wischen löscht, unten neue anlegen.
struct NutritionPortionsSection: View {
    let coordinator: NutritionCoordinator
    let detail: NutritionProductDetail
    let text: OverviewText
    @State private var draft: PortionDraft?
    @State private var deleting: NutritionPortion?

    init(coordinator: NutritionCoordinator, detail: NutritionProductDetail, text: OverviewText) {
        self.coordinator = coordinator
        self.detail = detail
        self.text = text
    }

    private var canSave: Bool {
        coordinator.canWrite && coordinator.supportsOp(NutritionOps.portionSave) && !coordinator.isManaging(detail.product.ref)
    }

    private var canDelete: Bool {
        coordinator.canWrite && coordinator.supportsOp(NutritionOps.portionDelete) && !coordinator.isManaging(detail.product.ref)
    }

    var body: some View {
        Section {
            ForEach(detail.portions) { portion in
                Button {
                    draft = editDraft(portion)
                } label: {
                    LabeledContent {
                        Text(amountLabel(portion)).monospacedDigit()
                    } label: {
                        Text(portion.name).foregroundStyle(.primary)
                    }
                }
                .disabled(!canSave)
                .accessibilityHint(text("Menge ändern", "Change amount"))
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if canDelete {
                        Button(role: .destructive) {
                            deleting = portion
                        } label: {
                            Label(text("Löschen", "Delete"), systemImage: "trash")
                        }
                    }
                }
            }
            Button {
                draft = PortionDraft(name: "", amountText: "", isNew: true, note: nil)
            } label: {
                HStack {
                    Label(text("Portion hinzufügen", "Add portion"), systemImage: "plus")
                    if coordinator.isManaging(detail.product.ref) {
                        Spacer()
                        ProgressView().accessibilityLabel(text("Wird gespeichert", "Saving"))
                    }
                }
            }
            .disabled(!canSave)
            .sheet(item: $draft) { draft in
                PortionEditorSheet(coordinator: coordinator, detail: detail, draft: draft, text: text)
            }
            .confirmationDialog(
                text("Portion löschen?", "Delete portion?"),
                isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                titleVisibility: .visible,
                presenting: deleting
            ) { portion in
                Button(text("Löschen", "Delete"), role: .destructive) {
                    coordinator.deletePortion(detail, name: portion.name)
                }
                Button(text("Abbrechen", "Cancel"), role: .cancel) {}
            } message: { portion in
                Text(text("„\(portion.name)“ wird aus dem Produkt entfernt. Bereits eingetragene Mengen bleiben unverändert.",
                          "“\(portion.name)” is removed from the product. Logged amounts stay unchanged."))
            }
        } header: {
            Text(text("Portionen", "Portions"))
        } footer: {
            Text(text("Nur gewogene oder belegte Mengen. Zum Löschen nach links wischen.",
                      "Only weighed or documented amounts. Swipe left to delete."))
        }
    }

    private func amountLabel(_ portion: NutritionPortion) -> String {
        portion.amount.map { "\(text.number($0)) \(portion.unit ?? "")" } ?? "–"
    }

    /// Das Web speichert jede Menge in der Produktbasis. Eine Portion in anderer Einheit (z. B. 30 ml bei g-Produkt ohne
    /// Dichte) wird nicht vorbelegt: Unverändert sichern würde sonst 30 g speichern. Die neue Menge gibt der Nutzer ein.
    private func editDraft(_ portion: NutritionPortion) -> PortionDraft {
        guard portion.matches(base: detail.base) else {
            let note = text("Bisher \(amountLabel(portion)). Bitte die Menge in \(detail.base) neu eingeben.",
                            "Previously \(amountLabel(portion)). Please enter the amount in \(detail.base) again.")
            return PortionDraft(name: portion.name, amountText: "", isNew: false, note: note)
        }
        return PortionDraft(name: portion.name, amountText: portion.amount.map { NutritionInput.text($0, locale: text.locale) } ?? "",
                            isNew: false, note: nil)
    }
}

private struct PortionEditorSheet: View {
    let coordinator: NutritionCoordinator
    let detail: NutritionProductDetail
    let isNew: Bool
    let note: String?
    let text: OverviewText
    @Environment(\.dismiss) private var dismiss
    // Einmalige Startwerte aus dem Entwurf; danach gehört die Eingabe dem Blatt.
    @State private var name: String
    @State private var amountText: String

    init(coordinator: NutritionCoordinator, detail: NutritionProductDetail, draft: PortionDraft, text: OverviewText) {
        self.coordinator = coordinator
        self.detail = detail
        self.isNew = draft.isNew
        self.note = draft.note
        self.text = text
        _name = State(initialValue: draft.name)
        _amountText = State(initialValue: draft.amountText)
    }

    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var amount: Double? {
        guard let value = NutritionInput.number(amountText, locale: text.locale), value >= 0.1, value <= 10_000 else { return nil }
        return value
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(text("Bezeichnung, z. B. Messlöffel", "Name, e.g. scoop"), text: $name)
                        .disabled(!isNew)
                        .accessibilityLabel(text("Bezeichnung", "Name"))
                    HStack {
                        TextField(text("Menge", "Amount"), text: $amountText)
                            .keyboardType(.decimalPad)
                            .monospacedDigit()
                            .accessibilityLabel(text("Menge", "Amount"))
                        Text(detail.base).foregroundStyle(.secondary)
                    }
                } footer: {
                    VStack(alignment: .leading, spacing: 4) {
                        if let note { Text(note) }
                        Text(text("Menge 0,1 bis 10 000 \(detail.base). Stückgewichte werden nicht geschätzt.",
                                  "Amount 0.1 to 10,000 \(detail.base). Piece weights are never estimated."))
                    }
                }
            }
            .navigationTitle(isNew ? text("Neue Portion", "New portion") : text("Portion ändern", "Change portion"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        if let amount, coordinator.savePortion(detail, name: trimmedName, amount: amount) { dismiss() }
                    }
                    .disabled(amount == nil || trimmedName.isEmpty || trimmedName.utf16.count > 80)
                }
            }
        }
        .presentationDetents([.medium])
        .environment(\.locale, text.locale)
        .tint(.blue)
    }
}

// MARK: - Produktzusätze

/// Dichte und (nur bei ml-Produkten) Wasseranteil. Fehlende Werte bleiben unbekannt.
struct NutritionExtrasSection: View {
    let coordinator: NutritionCoordinator
    let detail: NutritionProductDetail
    let text: OverviewText
    @State private var editing = false

    init(coordinator: NutritionCoordinator, detail: NutritionProductDetail, text: OverviewText) {
        self.coordinator = coordinator
        self.detail = detail
        self.text = text
    }

    private var canEdit: Bool {
        coordinator.canWrite && coordinator.supportsOp(NutritionOps.productExtrasSet) && !coordinator.isManaging(detail.product.ref)
    }

    var body: some View {
        Section {
            Button {
                editing = true
            } label: {
                VStack(spacing: 8) {
                    LabeledContent(text("Dichte", "Density")) {
                        Text(detail.storedDensity.map { NutritionInput.text($0, locale: text.locale) + " g/ml" } ?? text("unbekannt", "unknown"))
                            .monospacedDigit()
                    }
                    if detail.base == "ml" {
                        LabeledContent(text("Wasseranteil", "Water share")) {
                            Text(detail.storedWater.map { NutritionInput.text($0, locale: text.locale) + " ml / 100 ml" } ?? text("unbekannt", "unknown"))
                                .monospacedDigit()
                        }
                    }
                }
                .foregroundStyle(.primary)
            }
            .disabled(!canEdit)
            .accessibilityHint(text("Werte ändern", "Change values"))
            .sheet(isPresented: $editing) {
                ProductExtrasSheet(coordinator: coordinator, detail: detail, text: text)
            }
        } header: {
            Text(text("Produktzusätze", "Product details"))
        } footer: {
            Text(text("Nur bekannte Werte eintragen. Die Dichte erlaubt das Umrechnen zwischen g und ml.",
                      "Only enter known values. Density allows converting between g and ml."))
        }
    }
}

private struct ProductExtrasSheet: View {
    let coordinator: NutritionCoordinator
    let detail: NutritionProductDetail
    let text: OverviewText
    @Environment(\.dismiss) private var dismiss
    // Einmalige Startwerte aus dem Rohprodukt; leeres Feld = Wert entfernen.
    @State private var densityText: String
    @State private var waterText: String

    init(coordinator: NutritionCoordinator, detail: NutritionProductDetail, text: OverviewText) {
        self.coordinator = coordinator
        self.detail = detail
        self.text = text
        _densityText = State(initialValue: detail.storedDensity.map { NutritionInput.text($0, locale: text.locale) } ?? "")
        _waterText = State(initialValue: detail.storedWater.map { NutritionInput.text($0, locale: text.locale) } ?? "")
    }

    /// `nil` = ungültige Eingabe.
    private func change(_ input: String, stored: Double?, range: ClosedRange<Double>) -> NutritionCommands.ExtraChange? {
        let trimmed = input.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return stored == nil ? .keep : .remove }
        guard let value = NutritionInput.number(trimmed, locale: text.locale), range.contains(value) else { return nil }
        // Vorbelegung unverändert (auch nach Rundung der Anzeige): gespeicherten Wert nicht antasten.
        if let stored, trimmed == NutritionInput.text(stored, locale: text.locale) { return .keep }
        return .set(value)
    }

    private var densityChange: NutritionCommands.ExtraChange? {
        change(densityText, stored: detail.storedDensity, range: 0.01...20)
    }

    private var waterChange: NutritionCommands.ExtraChange? {
        guard detail.base == "ml" else { return .keep }
        return change(waterText, stored: detail.storedWater, range: 0...100)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField(text("unbekannt", "unknown"), text: $densityText)
                            .keyboardType(.decimalPad)
                            .monospacedDigit()
                            .accessibilityLabel(text("Dichte", "Density"))
                        Text("g/ml").foregroundStyle(.secondary)
                    }
                } header: {
                    Text(text("Dichte", "Density"))
                } footer: {
                    Text(text("0,01 bis 20 g/ml. Leer lassen, wenn sie nicht bekannt ist.", "0.01 to 20 g/ml. Leave empty if unknown."))
                }
                if detail.base == "ml" {
                    Section {
                        HStack {
                            TextField(text("unbekannt", "unknown"), text: $waterText)
                                .keyboardType(.decimalPad)
                                .monospacedDigit()
                                .accessibilityLabel(text("Wasseranteil", "Water share"))
                            Text("ml / 100 ml").foregroundStyle(.secondary)
                        }
                    } header: {
                        Text(text("Wasseranteil", "Water share"))
                    } footer: {
                        Text(text("Nur einen bekannten Wert eintragen, 0 bis 100.", "Only enter a known value, 0 to 100."))
                    }
                }
            }
            .navigationTitle(text("Produktzusätze", "Product details"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        guard let density = densityChange, let water = waterChange else { return }
                        if density == .keep, water == .keep {
                            dismiss()
                        } else if coordinator.setExtras(detail, density: density, water: water) {
                            dismiss()
                        }
                    }
                    .disabled(densityChange == nil || waterChange == nil)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .environment(\.locale, text.locale)
        .tint(.blue)
    }
}

// MARK: - Rezeptverwaltung

/// Rezept kopieren und löschen. Bereits eingetragene Portionen im Tagebuch bleiben unverändert.
struct NutritionRecipeActionsSection: View {
    let coordinator: NutritionCoordinator
    let recipe: NutritionRecipeDetail
    let text: OverviewText
    /// Nach dem Einreihen: zurück zur Rezeptliste bzw. Blatt schließen.
    let onDone: () -> Void
    @State private var confirmsDelete = false

    init(coordinator: NutritionCoordinator, recipe: NutritionRecipeDetail, text: OverviewText, onDone: @escaping () -> Void) {
        self.coordinator = coordinator
        self.recipe = recipe
        self.text = text
        self.onDone = onDone
    }

    private var isEnabled: Bool {
        coordinator.canWrite && !coordinator.isRecipeChangePending(id: recipe.recipe["id"]?.stringValue)
    }

    var body: some View {
        Section {
            if coordinator.supportsOp(NutritionOps.recipeCopy) {
                Button {
                    if coordinator.copyRecipe(recipe) { onDone() }
                } label: {
                    Label(text("Rezept kopieren", "Copy recipe"), systemImage: "doc.on.doc")
                }
                .disabled(!isEnabled)
            }
            if coordinator.supportsOp(NutritionOps.recipeDelete) {
                Button(role: .destructive) {
                    confirmsDelete = true
                } label: {
                    Label(text("Rezept löschen", "Delete recipe"), systemImage: "trash")
                }
                .disabled(!isEnabled)
                .confirmationDialog(text("Rezept löschen?", "Delete recipe?"), isPresented: $confirmsDelete, titleVisibility: .visible) {
                    Button(text("Löschen", "Delete"), role: .destructive) {
                        if coordinator.deleteRecipe(recipe) { onDone() }
                    }
                    Button(text("Abbrechen", "Cancel"), role: .cancel) {}
                } message: {
                    Text(text("Bereits eingetragene Portionen bleiben im Tagebuch.", "Portions already logged stay in your diary."))
                }
            }
        } footer: {
            Text(text("Rezepte anlegen, bearbeiten und importieren im Web-Dialog.",
                      "Create, edit and import recipes in the web dialog."))
        }
    }
}
