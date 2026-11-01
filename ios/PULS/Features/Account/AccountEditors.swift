import SwiftUI
import PhotosUI
import PULSCore

// Bearbeitungsblätter des Kontos. Alle Eingaben gehen als Ops ans Web; das Web prüft und berechnet erneut
// (Plan-/Profilfehler kommen als Hinweis zurück). Gewicht wird hier nie eingetragen (M2).

// MARK: - Name & Profilbild

struct AccountIdentitySheet: View {
    @Environment(\.dismiss) private var dismiss
    let coordinator: AccountCoordinator
    @State private var name = ""
    @State private var pick: PhotosPickerItem?
    @State private var preparing = false

    var body: some View {
        let text = coordinator.text
        let trimmed = JSString.trim(name)
        let nameValid = (1...40).contains(JSString.length(trimmed))
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        AccountAvatarView(data: coordinator.avatarData, name: trimmed.isEmpty ? coordinator.displayName : trimmed, size: 96)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
                if coordinator.can(AccountOps.nameSet) {
                    Section {
                        TextField(text("Name", "Name"), text: $name)
                            .textContentType(.nickname)
                            .submitLabel(.done)
                    } header: {
                        Text(text("Name", "Name"))
                    } footer: {
                        Text(text("1 bis 40 Zeichen.", "1 to 40 characters."))
                    }
                }
                if coordinator.can(AccountOps.avatarSet) {
                    Section {
                        PhotosPicker(selection: $pick, matching: .images, photoLibrary: .shared()) {
                            Label(text("Foto auswählen", "Choose photo"), systemImage: "photo.on.rectangle")
                        }
                        .disabled(preparing)
                        if preparing {
                            HStack { ProgressView(); Text(text("Bild wird vorbereitet …", "Preparing picture …")) }
                        }
                        if coordinator.avatarData != nil || coordinator.projection?.identity.avatarOmitted == true {
                            Button(text("Profilbild entfernen", "Remove picture"), role: .destructive) {
                                if coordinator.setAvatar(dataUrl: nil) { dismiss() }
                            }
                            .disabled(preparing)
                        }
                    } header: {
                        Text(text("Profilbild", "Profile picture"))
                    } footer: {
                        Text(text("PULS schneidet das Bild quadratisch zu und speichert es klein.", "PULS crops the picture to a square and stores it small."))
                    }
                }
            }
            .navigationTitle(text("Name & Profilbild", "Name & picture"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        if trimmed == coordinator.displayName || coordinator.setName(name) { dismiss() }
                    }
                    .disabled(!nameValid || preparing || !coordinator.can(AccountOps.nameSet))
                }
            }
        }
        .onAppear { name = coordinator.displayName }
        .onChange(of: pick) { _, item in
            guard let item else { return }
            preparing = true
            Task {
                let data = try? await item.loadTransferable(type: Data.self)
                let url = await Task.detached(priority: .userInitiated) { data.flatMap(AvatarEncoder.dataURL(from:)) }.value
                preparing = false
                pick = nil
                guard let url else {
                    coordinator.notice = TrainingNotice(text: text("Dieses Bild konnte nicht gelesen werden.", "This picture could not be read."))
                    return
                }
                if coordinator.setAvatar(dataUrl: url) { dismiss() }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - Körperprofil

struct AccountProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    let coordinator: AccountCoordinator
    @State private var context: PlannerContext?
    @State private var failed = false
    @State private var age = ""
    @State private var height = ""
    @State private var target = ""
    @State private var activity = 1.2
    @State private var method = "mifflin"
    @State private var rmr = ""
    @State private var kcalMode = "classic"
    @State private var baselineFactor = 1.2
    @State private var error: String?

    static let activities = [1.2, 1.375, 1.55, 1.725, 1.9]

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            Group {
                if context != nil {
                    form(text)
                } else if failed {
                    PlannerUnavailable(coordinator: coordinator) { dismiss() }
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(text("Körperprofil", "Body profile"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(text("Abbrechen", "Cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) { save(text) }.disabled(context == nil)
                }
            }
        }
        .task { await load() }
    }

    private func form(_ text: OverviewText) -> some View {
        Form {
            Section {
                numberField(text("Alter", "Age"), $age, unit: text("Jahre", "years"))
                numberField(text("Größe", "Height"), $height, unit: "cm")
                numberField(text("Zielgewicht", "Target weight"), $target, unit: "kg")
            } footer: {
                Text(text("Berechnung mit männlichem Formelparameter wie in PULS. Das aktuelle Gewicht kommt aus deinen Einträgen.",
                          "Calculated with the male formula parameter as in PULS. Current weight comes from your entries."))
            }
            Section(text("Aktivität", "Activity")) {
                Picker(text("Aktivität", "Activity"), selection: $activity) {
                    ForEach(Self.activities, id: \.self) { Text(text.activityLabel($0)).tag($0) }
                }
            }
            Section(text("Berechnung", "Calculation")) {
                Picker(text("Ruheumsatz", "Resting energy"), selection: $method) {
                    Text(text.planValue("method", "mifflin")).tag("mifflin")
                    Text(text.planValue("method", "measured")).tag("measured")
                }
                if method == "measured" {
                    numberField(text("Gemessener Ruheumsatz", "Measured resting energy"), $rmr, unit: "kcal")
                }
                Picker(text("Kalorienberechnung", "Calorie mode"), selection: $kcalMode) {
                    Text(text.planValue("kcalMode", "classic")).tag("classic")
                    Text(text.planValue("kcalMode", "baseline")).tag("baseline")
                }
                if kcalMode == "baseline" {
                    Picker(text("Alltagsfaktor", "Everyday factor"), selection: $baselineFactor) {
                        ForEach([1.2, 1.3, 1.4], id: \.self) { Text(text.number($0)).tag($0) }
                    }
                }
            }
            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
            }
        }
    }

    private func numberField(_ title: String, _ value: Binding<String>, unit: String) -> some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField(title, text: value)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                Text(unit).foregroundStyle(.secondary)
            }
        }
    }

    private func load() async {
        guard context == nil else { return }
        guard let planner = await coordinator.loadPlanner() else {
            failed = true
            return
        }
        let p = planner.context.profile
        let locale = coordinator.text.locale
        age = AccountInput.text(p?["age"]?.doubleValue, locale: locale)
        height = AccountInput.text(p?["height"]?.doubleValue, locale: locale)
        target = AccountInput.text(p?["target"]?.doubleValue, locale: locale)
        activity = p?["activity"]?.doubleValue.flatMap { Self.activities.contains($0) ? $0 : nil } ?? 1.2
        method = p?["method"]?.stringValue == "measured" ? "measured" : "mifflin"
        rmr = AccountInput.text(p?["rmr"]?.doubleValue.flatMap { $0 > 0 ? $0 : nil }, locale: locale)
        kcalMode = p?["kcalMode"]?.stringValue == "baseline" ? "baseline" : "classic"
        baselineFactor = p?["baselineFactor"]?.doubleValue.flatMap { [1.2, 1.3, 1.4].contains($0) ? $0 : nil } ?? 1.2
        context = planner.context
    }

    private func save(_ text: OverviewText) {
        guard let context else { return }
        let locale = text.locale
        guard let ageValue = AccountInput.number(age, locale: locale), ageValue == ageValue.rounded(), (18...100).contains(ageValue) else {
            error = text("Alter 18 bis 100 Jahre.", "Age 18 to 100 years."); return
        }
        guard let heightValue = AccountInput.number(height, locale: locale), (120...230).contains(heightValue) else {
            error = text("Größe 120 bis 230 cm.", "Height 120 to 230 cm."); return
        }
        guard let targetValue = AccountInput.number(target, locale: locale), (30...300).contains(targetValue) else {
            error = text("Zielgewicht 30 bis 300 kg.", "Target weight 30 to 300 kg."); return
        }
        var wanted: [String: JSONValue] = [
            "age": .number(ageValue), "height": .number(heightValue), "target": .number(targetValue),
            "activity": .number(activity), "method": .string(method), "kcalMode": .string(kcalMode),
        ]
        if kcalMode == "baseline" { wanted["baselineFactor"] = .number(baselineFactor) }
        if method == "measured" {
            guard let value = AccountInput.number(rmr, locale: locale), (500...5000).contains(value) else {
                error = text("Gemessener Ruheumsatz 500 bis 5000 kcal.", "Measured resting energy 500 to 5,000 kcal."); return
            }
            wanted["rmr"] = .number(value)
        }
        // Nur geänderte Felder; ein unveränderter Stand braucht keinen Befehl.
        let old = context.profile
        let changed = wanted.filter { old?[$0.key] != $0.value }
        guard !changed.isEmpty else { dismiss(); return }
        if coordinator.saveProfile(changed, context: context) { dismiss() }
    }
}

// MARK: - Plan & Ziele

struct AccountPlanSheet: View {
    @Environment(\.dismiss) private var dismiss
    let coordinator: AccountCoordinator
    @State private var context: PlannerContext?
    @State private var failed = false
    @State private var mode = "auto"
    @State private var direction = "lose"
    @State private var pace = "medium"
    @State private var macroMode = "auto"
    @State private var protein = 2.0
    @State private var fat = 0.8
    @State private var kcal = ""
    @State private var p = ""
    @State private var c = ""
    @State private var f = ""
    @State private var error: String?

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            Group {
                if context != nil {
                    form(text)
                } else if failed {
                    PlannerUnavailable(coordinator: coordinator) { dismiss() }
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle(text("Plan & Ziele", "Plan & targets"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(text("Abbrechen", "Cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) { save(text) }.disabled(context == nil)
                }
            }
        }
        .task { await load() }
    }

    private func form(_ text: OverviewText) -> some View {
        Form {
            Section {
                Picker(text("Ziele", "Targets"), selection: $mode) {
                    Text(text.planValue("mode", "auto")).tag("auto")
                    Text(text.planValue("mode", "manual")).tag("manual")
                }
                .pickerStyle(.segmented)
                Picker(text("Richtung", "Direction"), selection: $direction) {
                    ForEach(["lose", "maintain", "gain"], id: \.self) { Text(text.planValue("direction", $0)).tag($0) }
                }
                if mode == "auto", direction != "maintain" {
                    Picker(text("Tempo", "Pace"), selection: $pace) {
                        ForEach(direction == "lose" ? ["low", "medium", "high", "extreme"] : ["low", "medium", "high"], id: \.self) {
                            Text(text.planValue("pace", $0)).tag($0)
                        }
                    }
                }
            }
            Section(text("Makros", "Macros")) {
                Picker(text("Makros", "Macros"), selection: $macroMode) {
                    Text(text.planValue("macroMode", "auto")).tag("auto")
                    Text(text.planValue("macroMode", "manual")).tag("manual")
                }
                .pickerStyle(.segmented)
                .disabled(mode == "manual")
                if mode == "auto", macroMode == "auto" {
                    Stepper(value: $protein, in: 1.4...2.2, step: 0.1) {
                        Text(text("Eiweiß", "Protein") + " " + text.number(protein, digits: 1) + " g/kg")
                    }
                    Stepper(value: $fat, in: 0.5...1.5, step: 0.1) {
                        Text(text("Fett", "Fat") + " " + text.number(fat, digits: 1) + " g/kg")
                    }
                }
            }
            if mode == "manual" || macroMode == "manual" {
                Section {
                    if mode == "manual" { field(text("Kalorien", "Calories"), $kcal, unit: "kcal") }
                    field(text.macroLabel("p"), $p, unit: "g")
                    field(text.macroLabel("c"), $c, unit: "g")
                    field(text.macroLabel("f"), $f, unit: "g")
                } header: {
                    Text(text("Eigene Ziele", "Own targets"))
                }
            }
            if let error {
                Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
            }
        }
        .onChange(of: direction) { _, value in
            if value != "lose", pace == "extreme" { pace = "high" }
        }
        .onChange(of: mode) { _, value in
            if value == "manual" { macroMode = "manual" }
        }
    }

    private func field(_ title: String, _ value: Binding<String>, unit: String) -> some View {
        LabeledContent(title) {
            HStack(spacing: 4) {
                TextField(title, text: value).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                Text(unit).foregroundStyle(.secondary)
            }
        }
    }

    private func load() async {
        guard context == nil else { return }
        guard let planner = await coordinator.loadPlanner() else {
            failed = true
            return
        }
        let plan = planner.context.plan
        mode = plan["mode"]?.stringValue == "manual" ? "manual" : "auto"
        direction = ["lose", "maintain", "gain"].first { $0 == plan["direction"]?.stringValue } ?? "maintain"
        pace = ["low", "medium", "high", "extreme"].first { $0 == plan["pace"]?.stringValue } ?? "medium"
        macroMode = plan["macroMode"]?.stringValue == "manual" ? "manual" : "auto"
        protein = plan["protein"]?.doubleValue.map { min(2.2, max(1.4, $0)) } ?? 2.0
        fat = plan["fat"]?.doubleValue.map { min(1.5, max(0.5, $0)) } ?? 0.8
        let locale = coordinator.text.locale
        let goals = planner.context.macroGoals
        kcal = AccountInput.text(goals["kcal"], locale: locale)
        p = AccountInput.text(goals["p"], locale: locale)
        c = AccountInput.text(goals["c"], locale: locale)
        f = AccountInput.text(goals["f"], locale: locale)
        context = planner.context
    }

    private func save(_ text: OverviewText) {
        guard let context else { return }
        let locale = text.locale
        var goals = context.macroGoals
        if mode == "manual" || macroMode == "manual" {
            let keys = mode == "manual" ? ["kcal", "p", "c", "f"] : ["p", "c", "f"]
            let inputs = ["kcal": kcal, "p": p, "c": c, "f": f]
            for key in keys {
                guard let value = AccountInput.number(inputs[key] ?? "", locale: locale),
                      value >= (key == "kcal" ? 1 : 0), value <= (key == "kcal" ? 20_000 : 2000) else {
                    error = text("Kalorien 1–20 000, Makros 0–2000 g.", "Calories 1–20,000, macros 0–2,000 g.")
                    return
                }
                goals[key] = value
            }
        }
        guard Set(goals.keys) == ["kcal", "p", "c", "f"] else {
            error = text("Ziele unvollständig. Bitte im Web bearbeiten.", "Targets incomplete. Please edit in the web view.")
            return
        }
        let plan: [String: JSONValue] = [
            "mode": .string(mode), "direction": .string(direction), "pace": .string(pace), "macroMode": .string(mode == "manual" ? "manual" : macroMode),
            "protein": .number((protein * 10).rounded() / 10), "fat": .number((fat * 10).rounded() / 10),
        ]
        if coordinator.savePlan(plan, goals: goals, context: context) { dismiss() }
    }
}

/// Planner-Kontext nicht ladbar oder zu groß: klarer Web-Ausweg, keine Sackgasse.
struct PlannerUnavailable: View {
    let coordinator: AccountCoordinator
    let onClose: () -> Void

    var body: some View {
        let text = coordinator.text
        ContentUnavailableView {
            Label(text("Plan nicht verfügbar", "Plan unavailable"), systemImage: "exclamationmark.triangle")
        } description: {
            Text(text("PULS konnte den Plan gerade nicht laden.", "PULS could not load the plan right now."))
        } actions: {
            if coordinator.offers("accountPlan") {
                Button(text("Im Web bearbeiten", "Edit in the web view")) {
                    onClose()
                    coordinator.openWeb("accountPlan")
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }
}

// MARK: - Messung

struct AccountMeasurementSheet: View {
    @Environment(\.dismiss) private var dismiss
    let coordinator: AccountCoordinator
    let initialDate: String?
    @State private var date = Date()
    @State private var values: [String: String] = [:]
    @State private var error: String?

    var body: some View {
        let text = coordinator.text
        let fields = coordinator.projection?.body.fields ?? []
        let today = coordinator.projection?.today.flatMap { WeightDay.date(from: $0) } ?? Date()
        NavigationStack {
            Form {
                Section {
                    DatePicker(text("Tag", "Day"), selection: $date, in: ...today, displayedComponents: .date)
                }
                Section {
                    ForEach(fields) { field in
                        LabeledContent(field.label) {
                            HStack(spacing: 4) {
                                TextField(text.number(field.min) + "–" + text.number(field.max), text: binding(field.key))
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                    .accessibilityLabel(field.label)
                                Text(field.unit).foregroundStyle(.secondary)
                            }
                        }
                    }
                } footer: {
                    Text(text("Leere Felder bleiben unverändert. Einzelne Werte entfernst du über „Löschen“ der ganzen Messung.",
                              "Empty fields stay unchanged. To remove single values delete the whole measurement."))
                }
                if let note = coordinator.projection?.body.navyNote {
                    Section { Text(note).font(.footnote).foregroundStyle(.secondary) }
                }
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
                }
            }
            .navigationTitle(initialDate == nil ? text("Messung hinzufügen", "Add measurement") : text("Messung bearbeiten", "Edit measurement"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(text("Abbrechen", "Cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(text("Sichern", "Save")) { save(fields, text) } }
            }
        }
        .onAppear {
            date = initialDate.flatMap { WeightDay.date(from: $0) } ?? today
            fill(fields)
        }
        .onChange(of: date) { _, _ in fill(fields) }
    }

    private func binding(_ key: String) -> Binding<String> {
        Binding(get: { values[key] ?? "" }, set: { values[key] = $0 })
    }

    /// Bekannte Werte des gewählten Tages aus dem verlustfreien Spiegel vorbelegen.
    private func fill(_ fields: [AccountMeasurementField]) {
        let day = WeightDay.string(from: date)
        let row = AccountOps.measurements(coordinator.store.document.root, date: day).first
        var next: [String: String] = [:]
        for field in fields {
            next[field.key] = AccountInput.text(row?[field.key]?.doubleValue, locale: coordinator.text.locale)
        }
        values = next
    }

    private func save(_ fields: [AccountMeasurementField], _ text: OverviewText) {
        var parsed: [String: Double] = [:]
        for field in fields {
            let raw = (values[field.key] ?? "").trimmingCharacters(in: .whitespaces)
            guard !raw.isEmpty else { continue }
            guard let value = AccountInput.number(raw, locale: text.locale), field.accepts(value) else {
                error = text("\(field.label): \(text.number(field.min)) bis \(text.number(field.max)) \(field.unit).",
                             "\(field.label): \(text.number(field.min)) to \(text.number(field.max)) \(field.unit).")
                return
            }
            parsed[field.key] = value
        }
        guard !parsed.isEmpty else {
            error = text("Bitte mindestens einen Wert eintragen.", "Please enter at least one value.")
            return
        }
        let day = WeightDay.string(from: date)
        // Unveränderte Werte nicht erneut senden (Merge im Web; ein identischer Stand wäre ohnehin ein Noop).
        let row = AccountOps.measurements(coordinator.store.document.root, date: day).first
        let changed = parsed.filter { row?[$0.key]?.doubleValue != $0.value }
        guard !changed.isEmpty else { dismiss(); return }
        if coordinator.saveMeasurement(date: day, values: changed) { dismiss() }
    }
}
