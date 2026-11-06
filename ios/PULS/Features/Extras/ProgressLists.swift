import SwiftUI
import PULSCore

/// Vollständige Listen aus Kalender und Fortschritt (§15.3), statt „Weitere im Web“.
enum ProgressListRoute: Hashable {
    case metricPoints(metric: String, range: String, unit: String, title: String)
    case historyDays
    case records
    case activityEntries(mode: String, filter: String)
    case monthEntries(month: String)
    case exerciseHistory(id: String, name: String)

    var query: NativePageQuery {
        switch self {
        case .metricPoints(let metric, let range, _, _): return .metricPoints(metric: metric, range: range)
        case .historyDays: return .historyDays
        case .records: return .records
        // Die Liste folgt der gewählten aktuellen Woche bzw. dem aktuellen Monat (Offset 0).
        case .activityEntries(let mode, let filter): return .activityEntries(mode: mode, offset: 0, filter: filter)
        case .monthEntries(let month): return .monthEntries(month: month)
        case .exerciseHistory(let id, _): return .exerciseHistory(exerciseId: id)
        }
    }
}

struct ProgressListScreen: View {
    let coordinator: ProgressCoordinator
    let extras: ExtrasCoordinator
    let route: ProgressListRoute

    private func title(_ text: ProgressText) -> String {
        switch route {
        case .metricPoints(_, _, _, let title): return title
        case .historyDays: return text("Alle Tage", "All days")
        case .records: return text("Alle Rekorde", "All records")
        case .activityEntries: return text("Alle Aktivitäten", "All activities")
        case .monthEntries(let month): return text.monthTitle(month)
        case .exerciseHistory(_, let name): return name.isEmpty ? text("Alle Trainings", "All sessions") : name
        }
    }

    var body: some View {
        let text = coordinator.text
        PagedList(extras: extras, query: route.query, title: title(text), text: text.base) { index, item in
            row(index, item, text: text)
        }
    }

    @ViewBuilder
    private func row(_ index: Int, _ item: JSONValue, text: ProgressText) -> some View {
        switch route {
        case .metricPoints(_, _, let unit, _):
            LabeledContent(text.day(item["date"]?.stringValue)) {
                Text((item["value"]?.doubleValue).map { text.number($0) + (unit.isEmpty ? "" : " " + unit) } ?? "–")
                    .monospacedDigit()
            }
        case .historyDays:
            VStack(alignment: .leading, spacing: 2) {
                Text(text.day(item["date"]?.stringValue))
                Text(historyLine(item, text: text))
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
        case .records:
            if let record = StrengthRecord(pageRow: item) {
                Button {
                    coordinator.show(.exercise(id: record.id, name: record.name))
                } label: {
                    RecordRow(record: record, text: text)
                }
            }
        case .activityEntries, .monthEntries:
            if let entry = ActivityEntry(pageRow: item) {
                Button {
                    if entry.isWorkout {
                        coordinator.show(.workout(id: entry.entryId, name: entry.name))
                    } else {
                        coordinator.show(.run(id: entry.entryId, name: entry.name))
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(text.day(entry.date)).font(.caption).foregroundStyle(.secondary)
                        ActivityEntryRow(entry: entry, text: text, showsChevron: true)
                    }
                }
            }
        case .exerciseHistory:
            sessionRow(ExerciseHistorySession(pageRow: item, index: index), text: text)
        }
    }

    /// Bekannte Werte des Tages; fehlende Messungen bleiben leer (keine Nullen).
    private func historyLine(_ item: JSONValue, text: ProgressText) -> String {
        var parts: [String] = []
        if let weight = item["weight"]?.doubleValue { parts.append(text.line("weight") + " " + text.number(weight) + " kg") }
        if let strength = item["strength"]?.doubleValue { parts.append(text.line("strength") + " " + text.number(strength)) }
        if let kcal = item["kcal"]?.doubleValue { parts.append(text.number(kcal, digits: 0) + " kcal") }
        return parts.isEmpty ? text("keine Messung", "no measurement") : parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func sessionRow(_ session: ExerciseHistorySession, text: ProgressText) -> some View {
        let sets = session.sets.map { "\(text.setValue($0.kg)) × \(text.setValue($0.reps))" }.joined(separator: " / ")
        let label = VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text(session.name.isEmpty ? "Workout" : session.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                Text(text.day(session.date))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(sets)
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            Text(session.e1rm.map { "e1RM " + text.number($0) + " kg" } ?? text("kein e1RM", "no e1RM"))
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        if let workoutId = session.workoutId, ProgressQueryRequest.isValidID(workoutId) {
            Button {
                coordinator.show(.workout(id: workoutId, name: session.name))
            } label: {
                label
            }
        } else {
            label
        }
    }
}

// MARK: - Übungseinstellungen

/// `exercise.settings.set` (§15.5), Felder und Standardwerte wie das Web-Formular `progressionSettings`.
struct ExerciseSettingsSheet: View {
    let extras: ExtrasCoordinator
    let exerciseId: String
    let name: String
    let expect: JSONValue
    @Environment(\.dismiss) private var dismiss
    // Einmalige Startwerte aus der beim Öffnen gesehenen Rohzeile.
    @State private var targetText: String
    @State private var repMin: Int
    @State private var repMax: Int
    @State private var stepText: String
    @State private var muscle: String

    init(extras: ExtrasCoordinator, exerciseId: String, name: String, expect: JSONValue) {
        self.extras = extras
        self.exerciseId = exerciseId
        self.name = name
        self.expect = expect
        let locale = extras.text.locale
        let number: (String) -> Double? = { key in
            guard let value = expect[key]?.doubleValue, value != 0 else { return nil }
            return value
        }
        _targetText = State(initialValue: NutritionInput.text(number("target") ?? 0, locale: locale))
        _repMin = State(initialValue: min(max(Int(number("repMin") ?? 6), 1), 30))
        _repMax = State(initialValue: min(max(Int(number("repMax") ?? 10), 1), 30))
        _stepText = State(initialValue: NutritionInput.text(number("loadStep") ?? 2.5, locale: locale))
        let muscles = expect["muscles"]?.arrayValue ?? []
        _muscle = State(initialValue: muscles.count == 1 ? muscles[0].stringValue ?? "" : "")
    }

    private var text: OverviewText { extras.text }

    private var command: Command? {
        guard let target = NutritionInput.number(targetText, locale: text.locale),
              let step = NutritionInput.number(stepText, locale: text.locale) else { return nil }
        return ExtrasCommands.exerciseSettings(exerciseId: exerciseId, target: target, repMin: repMin, repMax: repMax,
                                               loadStep: step, muscle: muscle.isEmpty ? nil : muscle, expect: expect)
    }

    var body: some View {
        let text = self.text
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField(text("e1RM-Ziel", "e1RM goal"), text: $targetText)
                            .keyboardType(.decimalPad)
                            .monospacedDigit()
                            .accessibilityLabel(text("Persönliches e1RM-Ziel in Kilogramm", "Personal e1RM goal in kilograms"))
                        Text("kg").foregroundStyle(.secondary)
                    }
                } header: {
                    Text(text("Persönliches e1RM-Ziel", "Personal e1RM goal"))
                } footer: {
                    Text(text("0 bis 2000 kg, 0 = kein Ziel.", "0 to 2000 kg, 0 = no goal."))
                }
                Section {
                    Stepper(text("Reps von \(repMin)", "Reps from \(repMin)"), value: $repMin, in: 1...30)
                    Stepper(text("Reps bis \(repMax)", "Reps to \(repMax)"), value: $repMax, in: 1...30)
                } header: {
                    Text(text("Rep-Bereich", "Rep range"))
                } footer: {
                    if repMax < repMin {
                        Text(text("„Bis“ darf nicht kleiner sein als „von“.", "“To” must not be below “from”."))
                            .foregroundStyle(.red)
                    }
                }
                Section {
                    HStack {
                        TextField(text("Erhöhung", "Increase"), text: $stepText)
                            .keyboardType(.decimalPad)
                            .monospacedDigit()
                            .accessibilityLabel(text("Erhöhung in Kilogramm", "Increase in kilograms"))
                        Text("kg").foregroundStyle(.secondary)
                    }
                } header: {
                    Text(text("Erhöhung", "Increase"))
                } footer: {
                    Text(text("0,25 bis 25 kg, gesamtes eingetragenes Gewicht.", "0.25 to 25 kg, total logged weight."))
                }
                Section {
                    Picker(text("Primäre Muskelgruppe", "Primary muscle group"), selection: $muscle) {
                        Text(text("Zuordnung behalten", "Keep assignment")).tag("")
                        ForEach(ExtrasOps.muscles, id: \.self) { key in
                            Text(Self.muscleLabel(key, text: text)).tag(key)
                        }
                    }
                }
            }
            .navigationTitle(name.isEmpty ? text("Trainingsziele", "Training goals") : name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        if let command, extras.saveExerciseSettings(command) { dismiss() }
                    }
                    .disabled(command == nil)
                }
            }
        }
        .environment(\.locale, text.locale)
        .tint(.blue)
    }

    /// Anzeige wie `muscleNames`; die Schlüssel sind bereits Englisch.
    private static func muscleLabel(_ key: String, text: OverviewText) -> String {
        guard !text.isEnglish else { return key.prefix(1).uppercased() + key.dropFirst() }
        switch key {
        case "abdominals": return "Bauch"
        case "abductors": return "Abduktoren"
        case "adductors": return "Adduktoren"
        case "biceps": return "Bizeps"
        case "calves": return "Waden"
        case "chest": return "Brust"
        case "forearms": return "Unterarme"
        case "glutes": return "Gesäß"
        case "hamstrings": return "Beinbeuger"
        case "lats": return "Latissimus"
        case "lower back": return "Unterer Rücken"
        case "middle back": return "Mittlerer Rücken"
        case "neck": return "Nacken"
        case "quadriceps": return "Quadrizeps"
        case "shoulders": return "Schultern"
        case "traps": return "Trapez"
        case "triceps": return "Trizeps"
        default: return key
        }
    }
}
