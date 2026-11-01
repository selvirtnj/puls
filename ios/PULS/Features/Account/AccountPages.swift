import SwiftUI
import PULSCore

// Unterseiten des nativen Kontos. Alle Werte (Ziele, Energie, Prognose, BMI, Navy, Kalibrierung) kommen fertig aus dem
// Web; unbekannt bleibt „unbekannt“, Schätzungen sind als solche gekennzeichnet.

// MARK: - Plan

struct AccountPlanPage: View {
    let coordinator: AccountCoordinator
    let projection: AccountProjection

    var body: some View {
        let text = coordinator.text
        List {
            Section {
                AccountValueRow(title: text("Kalorien", "Calories"), value: text.kcal(projection.goals.kcal))
                ForEach(["p", "c", "f"], id: \.self) { key in
                    AccountValueRow(title: text.macroLabel(key), value: text.optionalNumber(projection.goals[key], unit: "g"))
                }
            } header: {
                Text(text("Tagesziele", "Daily targets"))
            } footer: {
                if let date = projection.date, let today = projection.today, date != today {
                    Text(text("Ziele für \(text.day(date)), den in PULS gewählten Tag.", "Targets for \(text.day(date)), the day selected in PULS."))
                }
            }

            if let energy = projection.energy {
                Section(text("Energie", "Energy")) {
                    AccountValueRow(title: text("Ruheumsatz", "Resting energy"), value: text.kcal(energy.rmr))
                    AccountValueRow(title: text("Erhalt", "Maintenance"), value: text.kcal(energy.tdee),
                                    note: energy.calibrated ? text("aus dem Verlauf kalibriert", "calibrated from history") : nil)
                    if let baseline = energy.baseline {
                        AccountValueRow(title: text("Grundbedarf", "Baseline"), value: text.kcal(baseline))
                    }
                    if let sport = energy.sport {
                        AccountValueRow(title: text("Sport heute", "Exercise today"), value: text.kcal(sport))
                    }
                    if energy.calibrated {
                        Label(text("Erhalt aus dem Verlauf kalibriert", "Maintenance calibrated from history"), systemImage: "checkmark.seal")
                            .font(.footnote)
                    }
                }
            }

            Section(text("Plan", "Plan")) {
                let plan = projection.plan
                AccountValueRow(title: text("Ziele", "Targets"), value: text.planValue("mode", plan.mode))
                AccountValueRow(title: text("Richtung", "Direction"), value: text.planValue("direction", plan.direction))
                if plan.mode == "auto", plan.direction != "maintain" {
                    AccountValueRow(title: text("Tempo", "Pace"), value: text.planValue("pace", plan.pace))
                }
                AccountValueRow(title: text("Makros", "Macros"), value: text.planValue("macroMode", plan.macroMode))
                if plan.mode == "auto", plan.macroMode == "auto" {
                    AccountValueRow(title: text("Eiweiß", "Protein"), value: text.optionalNumber(plan.protein, unit: "g/kg"))
                    AccountValueRow(title: text("Fett", "Fat"), value: text.optionalNumber(plan.fat, unit: "g/kg"))
                }
                if coordinator.canEditPlan {
                    Button(text("Plan & Ziele bearbeiten", "Edit plan & targets")) { coordinator.sheet = .plan }
                        .disabled(coordinator.isPlannerPending)
                }
            }

            Section(text("Körperprofil", "Body profile")) {
                if let profile = projection.profile {
                    AccountValueRow(title: text("Alter", "Age"), value: text.optionalNumber(profile.age, digits: 0))
                    AccountValueRow(title: text("Größe", "Height"), value: text.optionalNumber(profile.height, unit: "cm"))
                    AccountValueRow(title: text("Zielgewicht", "Target weight"), value: text.optionalNumber(profile.target, unit: "kg"))
                    AccountValueRow(title: text("Aktivität", "Activity"), value: profile.activity.map(text.activityLabel) ?? text("unbekannt", "unknown"))
                    AccountValueRow(title: text("Ruheumsatz", "Resting energy"), value: text.planValue("method", profile.method))
                    AccountValueRow(title: text("Kalorienberechnung", "Calorie mode"), value: text.planValue("kcalMode", profile.kcalMode))
                } else {
                    Text(text("Noch kein Profil gespeichert.", "No profile saved yet.")).foregroundStyle(.secondary)
                }
                if coordinator.canEditProfile {
                    Button(text("Körperprofil bearbeiten", "Edit body profile")) { coordinator.sheet = .profile }
                        .disabled(coordinator.isPlannerPending)
                }
            }

            if let html = projection.forecastHTML, !html.isEmpty {
                Section(text("Prognose", "Forecast")) {
                    ForecastView(html: html, text: text)
                }
            }

            if !coordinator.canEditPlan || !coordinator.canEditProfile, coordinator.offers("accountPlan") {
                Section {
                    AccountWebRow(title: text("Plan im Web bearbeiten", "Edit plan in the web view"), symbol: "slider.horizontal.3", text: text) {
                        coordinator.openWeb("accountPlan")
                    }
                } footer: {
                    Text(text("Gewicht trägst du unter „Körper & Entwicklung“ ein; Plan und Profil legen keine Messung an.",
                              "Log weight under “Body & development”; plan and profile never create a measurement."))
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Körper

struct AccountBodyPage: View {
    @Environment(ProfileStore.self) private var store
    let coordinator: AccountCoordinator
    let projection: AccountProjection
    @State private var deleting: String?

    var body: some View {
        let text = coordinator.text
        let bodyData = projection.body
        List {
            Section {
                AccountValueRow(title: text("Aktuelles Gewicht", "Current weight"), value: text.optionalNumber(bodyData.weight, unit: "kg"),
                                note: bodyData.summary.source == "profile" ? text("aus dem Profil, noch kein Eintrag", "from the profile, no entry yet") : nil)
                if let mean = bodyData.summary.weekMean, let start = bodyData.summary.weekStart {
                    AccountValueRow(title: text("Wochenmittel ab \(text.shortDay(start))", "Weekly average from \(text.shortDay(start))"),
                                    value: text.kg(mean) + " · " + text("\(bodyData.summary.weekCount) Einträge", "\(bodyData.summary.weekCount) entries"))
                }
                Button {
                    coordinator.openBody()
                } label: {
                    Label(text("Gewicht & Verlauf", "Weight & history"), systemImage: "scalemass")
                }
            } header: {
                Text(text("Gewicht", "Weight"))
            } footer: {
                if bodyData.summary.source == "profile" {
                    Text(text("Ohne Gewichtseintrag zeigt PULS das gespeicherte Profilgewicht; es ist keine Messung.",
                              "Without a weight entry PULS shows the saved profile weight; it is not a measurement."))
                }
            }

            Section {
                if let fat = bodyData.bodyFat {
                    AccountValueRow(title: text("Körperfett", "Body fat"), value: text.number(fat.value) + " %",
                                    note: nil)
                    Text(fat.estimated
                         ? text("US-Navy-Schätzung vom \(text.day(fat.date)), keine Messung.", "US Navy estimate from \(text.day(fat.date)), not a measurement.")
                         : text("Gemessen am \(text.day(fat.date)).", "Measured on \(text.day(fat.date))."))
                        .font(.footnote).foregroundStyle(.secondary)
                } else {
                    AccountValueRow(title: text("Körperfett", "Body fat"), value: text("unbekannt", "unknown"))
                }
                if let bmi = bodyData.bmi {
                    AccountValueRow(title: "BMI", value: text.number(bmi) + (bodyData.bmiLabel.map { " · " + $0 } ?? ""))
                }
                if let estimate = bodyData.bmiBodyFat {
                    AccountValueRow(title: text("Schätzung aus BMI und Alter", "Estimate from BMI and age"), value: text.number(estimate) + " %")
                }
            } header: {
                Text(text("Körperfett & BMI", "Body fat & BMI"))
            } footer: {
                if let note = bodyData.navyNote { Text(note) }
            }

            measurementsSection(text: text, data: bodyData)

            if !bodyData.history.isEmpty {
                Section {
                    DisclosureGroup(text("Verlauf anzeigen", "Show history")) {
                        ForEach(bodyData.history) { row in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(text.day(row.date) + (row.kg.map { " · " + text.kg($0) } ?? ""))
                                Text("BMI " + text.optionalNumber(row.bmi) + " · " + text("Körperfett ", "Body fat ")
                                     + text.optionalNumber(row.bodyFat, unit: "%"))
                                    .font(.footnote).foregroundStyle(.secondary)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                } header: {
                    Text(text("Gewichtsverlauf", "Weight history"))
                } footer: {
                    Text(text("BMI und Körperfett hier sind historische Schätzungen aus BMI und Alter, keine Navy- oder Messwerte.",
                              "BMI and body fat here are historical estimates from BMI and age, not Navy or measured values."))
                }
            }

            if projection.omittedHistory + projection.omittedMeasurements > 0 {
                Section {
                    AccountWebRow(title: text("Alle älteren Einträge im Web", "All older entries in the web view"), symbol: "list.bullet", text: text) {
                        coordinator.openWebSection(.body)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .confirmationDialog(text("Messung löschen?", "Delete measurement?"),
                            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible) {
            Button(text("Löschen", "Delete"), role: .destructive) {
                if let id = deleting { coordinator.deleteMeasurement(id: id) }
                deleting = nil
            }
            Button(text("Abbrechen", "Cancel"), role: .cancel) { deleting = nil }
        }
    }

    @ViewBuilder
    private func measurementsSection(text: OverviewText, data: AccountBody) -> some View {
        let rows = coordinator.measurementRows
        let canSave = coordinator.can(AccountOps.measurementsSave) && !data.fields.isEmpty
        let canDelete = coordinator.can(AccountOps.measurementsDelete)
        Section {
            if rows.isEmpty {
                Text(text("Noch keine Körpermaße.", "No body measurements yet.")).foregroundStyle(.secondary)
            }
            ForEach(rows, id: \.self) { row in
                let id = row["id"]?.stringValue ?? ""
                let date = row["date"]?.stringValue ?? ""
                Button {
                    if canSave { coordinator.sheet = .measurement(date) }
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(text.day(date)).foregroundStyle(.primary)
                        Text(valuesLine(row, fields: data.fields, text: text))
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .disabled(!canSave)
                .swipeActions(edge: .trailing) {
                    if canDelete {
                        Button(role: .destructive) { deleting = id } label: { Label(text("Löschen", "Delete"), systemImage: "trash") }
                    }
                }
                .accessibilityAction(named: Text(text("Löschen", "Delete"))) { if canDelete { deleting = id } }
            }
            if canSave {
                Button {
                    coordinator.sheet = .measurement(nil)
                } label: {
                    Label(text("Messung hinzufügen", "Add measurement"), systemImage: "plus")
                }
            }
        } header: {
            Text(text("Körpermaße", "Body measurements"))
        } footer: {
            if canSave {
                Text(text("Eine Messung pro Tag. Leere Felder bleiben unverändert.", "One measurement per day. Empty fields stay unchanged."))
            }
        }
    }

    private func valuesLine(_ row: JSONValue, fields: [AccountMeasurementField], text: OverviewText) -> String {
        let parts = fields.compactMap { field -> String? in
            guard let value = row[field.key]?.doubleValue, value.isFinite else { return nil }
            return "\(field.label) \(text.number(value)) \(field.unit)"
        }
        return parts.isEmpty ? text("keine bekannten Werte", "no known values") : parts.joined(separator: " · ")
    }
}

// MARK: - Adaptiver Erhalt

struct AccountAdaptivePage: View {
    let coordinator: AccountCoordinator
    let projection: AccountProjection
    @State private var working = false

    var body: some View {
        let text = coordinator.text
        let adaptive = projection.adaptive
        let observation = adaptive.observation
        let pending = coordinator.isPlannerPending || working
        List {
            Section {
                Toggle(text("Kalorien bei neuen Gewichtseinträgen automatisch anpassen", "Adjust calories automatically with new weight entries"),
                       isOn: Binding(get: { adaptive.adaptive }, set: { value in change(adaptive: value, learn: adaptive.enabled) }))
                    .disabled(!coordinator.canEditAdaptive || pending)
                Toggle(text("Erhalt aus vollständiger Aufnahme und Gewichtsverlauf lernen", "Learn maintenance from complete logging and weight history"),
                       isOn: Binding(get: { adaptive.enabled }, set: { value in change(adaptive: adaptive.adaptive, learn: value) }))
                    .disabled(!coordinator.canEditAdaptive || pending || adaptive.disabled)
                if pending { ProgressView() }
            } footer: {
                Text(text("Nur bei berechneten Zielen. 28 vollständige Tage, mindestens zwei Gewichte pro Woche; wöchentliche Korrektur höchstens 100 kcal.",
                          "Only with calculated targets. 28 complete days, at least two weights per week; weekly correction at most 100 kcal."))
            }

            Section(text("Beobachtung", "Observation")) {
                if let coverage = observation.coverage {
                    AccountValueRow(title: text("Vollständige Tage", "Complete days"), value: "\(text.integer(coverage))/28")
                }
                if let count = observation.weightCount {
                    AccountValueRow(title: text("Gewichte", "Weights"), value: "\(count)")
                }
                if let estimate = observation.estimate {
                    AccountValueRow(title: text("Geschätzter Erhalt", "Estimated maintenance"), value: text.kcal(estimate))
                }
                if let low = observation.low, let high = observation.high {
                    AccountValueRow(title: text("Spanne", "Range"), value: "\(text.integer(low))–\(text.integer(high)) kcal")
                }
                if let reason = observation.reason, !reason.isEmpty {
                    Text(reason).font(.footnote).foregroundStyle(.secondary)
                }
            }

            if let calibration = adaptive.calibration {
                Section(text("Letzte Kalibrierung", "Last calibration")) {
                    AccountValueRow(title: text("Datum", "Date"), value: text.day(calibration.date))
                    if let value = calibration.value { AccountValueRow(title: text("Erhalt", "Maintenance"), value: text.kcal(value)) }
                    if let base = calibration.base { AccountValueRow(title: text("Formelwert", "Formula value"), value: text.kcal(base)) }
                    if let start = calibration.windowStart, let end = calibration.windowEnd {
                        AccountValueRow(title: text("Zeitraum", "Window"), value: "\(text.shortDay(start)) – \(text.shortDay(end))")
                    }
                }
            }

            if !coordinator.canEditAdaptive, coordinator.offers("accountPlan") {
                Section {
                    AccountWebRow(title: text("Im Plan einstellen", "Set in the plan"), symbol: "slider.horizontal.3", text: text) {
                        coordinator.openWeb("accountPlan")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func change(adaptive: Bool, learn: Bool) {
        guard !working else { return }
        working = true
        Task {
            await coordinator.setAdaptive(adaptive: adaptive, learnTdee: learn)
            working = false
        }
    }
}

// MARK: - Darstellung

struct AccountDesignPage: View {
    let coordinator: AccountCoordinator
    let projection: AccountProjection

    var body: some View {
        let text = coordinator.text
        let editable = coordinator.can(AccountOps.appearanceSet) && !coordinator.isAppearancePending
        List {
            Section {
                Picker(text("Darstellung", "Appearance"), selection: Binding(
                    get: { coordinator.schemeDisplayed },
                    set: { coordinator.setAppearance(scheme: $0) })) {
                    Text(text("System", "System")).tag(AccountScheme.system)
                    Text(text("Hell", "Light")).tag(AccountScheme.light)
                    Text(text("Dunkel", "Dark")).tag(AccountScheme.dark)
                }
                .pickerStyle(.inline)
                .disabled(!editable)
            } header: {
                Text(text("Hell & Dunkel", "Light & dark"))
            } footer: {
                Text(text("Gilt nur auf diesem Gerät und wird nicht synchronisiert.", "Applies to this device only and is not synced."))
            }

            Section(text("Sprache", "Language")) {
                Picker(text("Sprache", "Language"), selection: Binding(
                    get: { coordinator.languageDisplayed },
                    set: { coordinator.setAppearance(language: $0) })) {
                    Text("Deutsch").tag("de")
                    Text("English").tag("en")
                }
                .pickerStyle(.inline)
                .disabled(!editable)
            }

            Section {
                AccountValueRow(title: text("App-Icon", "App icon"), value: text("Dunkel (fest in der iPhone-App)", "Dark (fixed in the iPhone app)"))
            }
            if coordinator.isAppearancePending {
                Section { Label(text("Wird übernommen …", "Applying …"), systemImage: "hourglass") }
            }
        }
        .listStyle(.insetGrouped)
    }
}

// MARK: - Klänge

struct AccountSoundPage: View {
    let coordinator: AccountCoordinator
    let projection: AccountProjection
    @State private var volume: Double?

    var body: some View {
        let text = coordinator.text
        let sound = coordinator.soundDisplayed
        let editable = coordinator.can(AccountOps.soundSet)
        let shown = volume ?? sound.volume ?? AccountOps.defaultVolume
        List {
            Section {
                Toggle(text("Töne", "Sounds"), isOn: Binding(
                    get: { sound.enabled },
                    set: { coordinator.setSound(enabled: $0, volume: sound.volume ?? AccountOps.defaultVolume) }))
                    .disabled(!editable)
                VStack(alignment: .leading) {
                    Text(text("Lautstärke", "Volume") + " " + text.integer(shown))
                    Slider(value: Binding(get: { shown }, set: { volume = $0 }), in: 0...AccountOps.maxVolume, step: 5, onEditingChanged: { editing in
                        guard !editing, let value = volume else { return }
                        coordinator.setSound(enabled: sound.enabled, volume: value)
                    })
                    .accessibilityLabel(text("Lautstärke", "Volume"))
                    .accessibilityValue(text.integer(shown))
                }
                .disabled(!editable || !sound.enabled)
            } footer: {
                Text(text("Haptik folgt weiter den bestehenden PULS-Einstellungen.", "Haptics keep following the existing PULS settings."))
            }
        }
        .listStyle(.insetGrouped)
        .onChange(of: sound.volume) { _, _ in volume = nil }
    }
}

// MARK: - Verwalten (nur Web-Ausstiege)

struct AccountManagePage: View {
    let coordinator: AccountCoordinator
    let projection: AccountProjection

    var body: some View {
        let text = coordinator.text
        let cloud = projection.cloud
        List {
            AccountStatusSection(coordinator: coordinator, projection: projection)

            Section {
                if !cloud.signedIn, cloud.configured, !coordinator.isPreview {
                    row("accountSignIn", text("Bei PULS anmelden", "Sign in to PULS"), "person.crop.circle.badge.plus", text)
                }
                if cloud.signedIn {
                    row("accountSignOut", text("Abmelden (im Web bestätigen)", "Sign out (confirm in the web view)"), "rectangle.portrait.and.arrow.right", text)
                }
                if cloud.conflict {
                    row("accountConflict", text("Konflikt lösen", "Resolve conflict"), "arrow.left.arrow.right", text)
                }
            } header: {
                Text(text("Anmeldung", "Sign-in"))
            } footer: {
                Text(text("Anmeldung, Abmeldung und Konfliktwahl laufen in PULS selbst; die App sieht keine Passwörter.",
                          "Sign-in, sign-out and conflict choice run in PULS itself; the app never sees passwords."))
            }

            Section(text("Sicherung", "Backup")) {
                row("accountExport", text("Sicherung exportieren (JSON)", "Export backup (JSON)"), "square.and.arrow.up", text)
                row("accountCSV", text("CSV-Export", "CSV export"), "tablecells", text)
                row("accountImport", text("Sicherung importieren", "Import backup"), "square.and.arrow.down", text)
                row("accountRecovery", text("Wiederherstellung & Konfliktsicherungen", "Recovery & conflict backups"), "lifepreserver", text)
            }

            Section {
                row("accountReset", text("Daten zurücksetzen", "Reset data"), "arrow.counterclockwise", text, role: .destructive)
                row("accountDelete", text("Konto löschen", "Delete account"), "trash", text, role: .destructive)
            } footer: {
                Text(text("Diese Schritte bestätigst du in PULS mit den bestehenden Sicherheitsabfragen.",
                          "You confirm these steps in PULS with the existing safety prompts."))
            }
        }
        .listStyle(.insetGrouped)
    }

    @ViewBuilder
    private func row(_ action: String, _ title: String, _ symbol: String, _ text: OverviewText, role: ButtonRole? = nil) -> some View {
        if coordinator.offers(action) {
            AccountWebRow(title: title, symbol: symbol, text: text, role: role) { coordinator.openWeb(action) }
        }
    }
}
