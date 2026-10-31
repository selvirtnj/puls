import SwiftUI
import PULSCore

// M5: nativer Fortschritt (Web: `analyticsPage` in js/insights.js, js/progress-metrics.js, js/activity-overview.js,
// js/run-metrics.js). Alle Werte aus der `progress`-Projektion bzw. Queries; Einstellungen über die drei Ops.

struct ProgressScreen: View {
    let coordinator: ProgressCoordinator
    @State private var recapMode = "week"
    @State private var showsGoals = false
    @State private var waited = false

    var body: some View {
        let text = coordinator.text
        Group {
            if let progress = coordinator.projection {
                content(progress, text: text)
            } else {
                List {
                    Section {
                        QueryPhaseView(isLoading: !waited, isGone: false, text: text,
                                       retry: { waited = false }, openWeb: { coordinator.openWeb(action: "progress") })
                    }
                }
                .listStyle(.insetGrouped)
                // Die Projektion kommt erst nach gemeldetem Interesse; nach ca. 4 s Web-Ausweg anbieten.
                .task(id: waited) { @MainActor in
                    guard !waited else { return }
                    try? await Task.sleep(for: .seconds(4))
                    if !Task.isCancelled { waited = true }
                }
            }
        }
        .sheet(isPresented: $showsGoals) {
            if let goals = coordinator.projection?.weeklyGoals {
                WeeklyGoalSheet(coordinator: coordinator, goals: goals)
            }
        }
    }

    private func content(_ progress: ProgressProjection, text: ProgressText) -> some View {
        List {
            ProgressNoticeSection(coordinator: coordinator)
            if !coordinator.canWrite {
                Section { ReadOnlyNote(text: text) }
            }
            ProgressConflictSection(coordinator: coordinator, text: text)
            if let identity = progress.identity {
                IdentityCard(identity: identity, text: text)
            }
            if let goals = progress.weeklyGoals {
                WeeklyGoalsSection(goals: goals, text: text, canEdit: coordinator.canWrite && !coordinator.isApplying) {
                    showsGoals = true
                }
            }
            recapSection(progress, text: text)
            if let metrics = progress.metrics {
                ExplorerSection(metrics: metrics, coordinator: coordinator, text: text)
            }
            if let chart = progress.chart {
                TrendSection(chart: chart, settings: progress.settings, coordinator: coordinator, text: text)
            }
            RecordsSection(progress: progress, coordinator: coordinator, text: text)
            ActivitySection(projection: progress, coordinator: coordinator, text: text)
            if let running = progress.running, (running.count ?? 0) > 0 || !progress.runRecords.isEmpty {
                RunningSection(running: running, records: progress.runRecords, coordinator: coordinator, text: text)
            }
            Section {
                Button {
                    coordinator.openWeb(action: "progress")
                } label: {
                    Label(text("Fortschritt in PULS öffnen", "Open progress in PULS"), systemImage: "arrow.up.forward.app")
                }
            } footer: {
                if progress.omitted.any {
                    Text(text("Nicht alle Einträge passen in diese Ansicht. Die vollständige Auswertung steht in PULS.",
                              "Not every entry fits this view. The full analysis is in PULS."))
                }
            }
        }
        .listStyle(.insetGrouped)
        .contentMargins(.top, 4, for: .scrollContent)
    }

    @ViewBuilder
    private func recapSection(_ progress: ProgressProjection, text: ProgressText) -> some View {
        if !progress.recaps.isEmpty {
            Section {
                Picker(text("Zeitraum", "Period"), selection: $recapMode) {
                    Text(text("Woche", "Week")).tag("week")
                    Text(text("Monat", "Month")).tag("month")
                }
                .pickerStyle(.segmented)
                .listRowSeparator(.hidden)
            } header: {
                Text(text("Rückblick", "Recap"))
            }
            if let recap = progress.recap(mode: recapMode) ?? progress.recaps.first {
                RecapSection(recap: recap, title: text.range(recap.start, recap.end), text: text)
            }
        }
    }
}

// MARK: - Level, Serie, Wochenziele

private struct IdentityCard: View {
    let identity: ProgressIdentity
    let text: ProgressText

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    if let level = identity.level {
                        Text("Level \(level)").font(.title2.bold())
                    }
                    Spacer(minLength: 8)
                    if let current = identity.current, let needed = identity.needed {
                        Text("\(text.number(current, digits: 0)) / \(text.number(needed, digits: 0)) XP")
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
                if let current = identity.current, let needed = identity.needed, needed > 0 {
                    ProgressView(value: min(max(current, 0), needed), total: needed)
                        .accessibilityHidden(true)
                }
                HStack(spacing: 16) {
                    if let streak = identity.streak {
                        Label(text.count(streak, "Tag in Folge", "Tage in Folge", "day in a row", "days in a row"), systemImage: "flame")
                    }
                    if let weeks = identity.weekStreak {
                        Label(text.count(weeks, "Woche in Folge", "Wochen in Folge", "week in a row", "weeks in a row"),
                              systemImage: "calendar")
                    }
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
                if let total = identity.total {
                    Text(text("Insgesamt \(text.number(total, digits: 0)) XP", "\(text.number(total, digits: 0)) XP in total"))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
        }
    }
}

private struct WeeklyGoalsSection: View {
    let goals: WeeklyGoals
    let text: ProgressText
    let canEdit: Bool
    let edit: () -> Void

    var body: some View {
        Section {
            goalRow(title: text("Aktive Minuten", "Active minutes"), value: goals.activeMinutes, goal: goals.hasMinutesGoal ? goals.weekMinutesGoal : nil,
                    unit: "min", digits: 0)
            goalRow(title: text("Laufen", "Running"), value: goals.runKm, goal: goals.hasKmGoal ? goals.weeklyGoalKm : nil, unit: "km", digits: 1)
            Button(action: edit) {
                Label(text("Wochenziele ändern", "Change weekly goals"), systemImage: "target")
            }
            .disabled(!canEdit)
        } header: {
            Text(text("Wochenziele", "Weekly goals") + (goals.start.map { " · " + text.range($0, goals.end) } ?? ""))
        } footer: {
            Text(text("Krafttraining und alle Aktivitäten zählen für die aktiven Minuten.",
                      "Strength workouts and all activities count towards active minutes."))
        }
    }

    private func goalRow(title: String, value: Double?, goal: Double?, unit: String, digits: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                Spacer(minLength: 8)
                Text(valueText(value, goal: goal, unit: unit, digits: digits))
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            if let goal, goal > 0 {
                ProgressView(value: min(max(value ?? 0, 0), goal), total: goal)
                    .tint((value ?? 0) >= goal ? Color.green : Color.accentColor)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func valueText(_ value: Double?, goal: Double?, unit: String, digits: Int) -> String {
        let current = value.map { text.number($0, digits: digits) } ?? "–"
        guard let goal else { return current + " " + unit + " · " + text("kein Ziel", "no goal") }
        return current + " / " + text.number(goal, digits: digits) + " " + unit
    }
}

/// Wochenziele bearbeiten (`progress.goal.set`; Web-Grenzen: km leer oder 0,1–1000, Minuten 0–10080).
struct WeeklyGoalSheet: View {
    let coordinator: ProgressCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var kmText: String
    @State private var minutesText: String

    init(coordinator: ProgressCoordinator, goals: WeeklyGoals) {
        self.coordinator = coordinator
        let text = coordinator.text
        _kmText = State(initialValue: goals.hasKmGoal ? goals.weeklyGoalKm.map { text.number($0) } ?? "" : "")
        _minutesText = State(initialValue: goals.weekMinutesGoal.map { text.number($0, digits: 0) } ?? "150")
    }

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            Form {
                Section {
                    TextField(text("Kein Ziel", "No goal"), text: $kmText)
                        .keyboardType(.decimalPad)
                        .accessibilityLabel(text("Laufziel in Kilometern pro Woche", "Running goal in kilometres per week"))
                } header: {
                    Text(text("Laufen (km pro Woche)", "Running (km per week)"))
                } footer: {
                    if km == nil {
                        Text(text("Leer lassen für kein Ziel, sonst 0,1 bis 1000 km.", "Leave empty for no goal, otherwise 0.1 to 1000 km."))
                            .foregroundStyle(Color.red)
                    } else {
                        Text(text("Leer lassen für kein Ziel.", "Leave empty for no goal."))
                    }
                }
                Section {
                    TextField("150", text: $minutesText)
                        .keyboardType(.numberPad)
                        .accessibilityLabel(text("Aktive Minuten pro Woche", "Active minutes per week"))
                } header: {
                    Text(text("Aktive Minuten pro Woche", "Active minutes per week"))
                } footer: {
                    Text(minutes == nil ? text("Ganze Minuten von 0 bis 10080; 0 heißt kein Ziel.", "Whole minutes from 0 to 10080; 0 means no goal.")
                                        : text("0 heißt kein Ziel.", "0 means no goal."))
                        .foregroundStyle(minutes == nil ? Color.red : Color.secondary)
                }
            }
            .navigationTitle(text("Wochenziele", "Weekly goals"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save")) {
                        guard let km, let minutes else { return }
                        if coordinator.setGoals(weeklyGoalKm: km.value, weekMinutesGoal: minutes) { dismiss() }
                    }
                    .disabled(km == nil || minutes == nil || !coordinator.canWrite)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .environment(\.locale, text.locale)
    }

    /// `nil` = ungültig; `.value == nil` = kein Ziel.
    private var km: OptionalValue? {
        let trimmed = kmText.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return OptionalValue(value: nil) }
        guard let value = Double(trimmed.replacingOccurrences(of: ",", with: ".")), value.isFinite,
              value >= 0.1, value <= 1000 else { return nil }
        return OptionalValue(value: value)
    }

    private var minutes: Int? {
        guard let value = Int(minutesText.trimmingCharacters(in: .whitespaces)), (0...10080).contains(value) else { return nil }
        return value
    }

    struct OptionalValue {
        let value: Double?
    }
}

// MARK: - Explorer und Verlauf

private struct ExplorerSection: View {
    let metrics: ProgressMetrics
    let coordinator: ProgressCoordinator
    let text: ProgressText

    var body: some View {
        let canEdit = coordinator.canWrite && !coordinator.isApplying
        let definition = metrics.selectedDefinition
        Section {
            if !metrics.groups.isEmpty {
                Picker(text("Bereich", "Area"), selection: binding("group", metrics.group)) {
                    ForEach(metrics.groups) { group in Text(group.label).tag(group.key) }
                }
                .disabled(!canEdit)
            }
            if !metrics.definitions.isEmpty {
                Picker(text("Messwert", "Measure"), selection: binding("metric", metrics.metric)) {
                    ForEach(metrics.definitions) { item in Text(item.label).tag(item.key) }
                }
                .disabled(!canEdit)
            }
            if !metrics.ranges.isEmpty {
                Picker(text("Zeitraum", "Period"), selection: binding("range", metrics.range)) {
                    ForEach(metrics.ranges) { range in Text(range.label).tag(range.key) }
                }
                .pickerStyle(.segmented)
                .disabled(!canEdit)
            }
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Zuletzt", "Latest"), value: format(metrics.latest, definition))
                StatTile(title: text("Durchschnitt", "Average"), value: format(metrics.average, definition))
                StatTile(title: text("Höchstwert", "High"), value: format(metrics.high, definition))
            }
            PointSeriesChart(values: metrics.points, unit: definition?.unit ?? "", text: text)
            if metrics.omitted > 0 {
                OmittedNote(message: text("Gezeigt: die letzten \(metrics.points.count) von \(metrics.total) Punkten.",
                                          "Showing the latest \(metrics.points.count) of \(metrics.total) points."), text: text) {
                    coordinator.openWeb(action: "progress")
                }
            }
        } header: {
            Text(definition?.label ?? text("Messwerte", "Measures"))
        } footer: {
            if let note = definition?.note { Text(note) }
        }
    }

    private func format(_ value: Double?, _ definition: MetricDefinition?) -> String {
        guard let value else { return "–" }
        let unit = definition?.unit ?? ""
        return text.number(value) + (unit.isEmpty ? "" : " " + unit)
    }

    /// Auswahl sendet `progress.view.set`; die Anzeige folgt dem Snapshot bzw. der nächsten Projektion.
    private func binding(_ key: String, _ current: String?) -> Binding<String> {
        Binding(
            get: { current ?? "" },
            set: { value in
                guard value != current, !value.isEmpty else { return }
                coordinator.setView(key: key, value: value)
            }
        )
    }
}

private struct TrendSection: View {
    let chart: ProgressChart
    let settings: ProgressSettings
    let coordinator: ProgressCoordinator
    let text: ProgressText

    private static let periods = ["week", "month", "half", "year", "all"]

    var body: some View {
        let canEdit = coordinator.canWrite && !coordinator.isApplying
        let lines = effectiveLines
        Section {
            Picker(text("Zeitraum", "Period"), selection: Binding(
                get: { chart.period ?? settings.chartPeriod ?? "" },
                set: { value in
                    guard Self.periods.contains(value), value != (chart.period ?? settings.chartPeriod) else { return }
                    coordinator.setChart(period: value)
                }
            )) {
                ForEach(Self.periods, id: \.self) { key in Text(text.period(key)).tag(key) }
            }
            .pickerStyle(.segmented)
            .disabled(!canEdit)
            ForEach(ProgressOps.lineKeys, id: \.self) { key in
                Toggle(text.line(key), isOn: Binding(
                    get: { lines[key] ?? true },
                    set: { isOn in
                        var next = lines
                        next[key] = isOn
                        coordinator.setChart(lines: next)
                    }
                ))
                .disabled(!canEdit)
            }
            TrendRowsCharts(chart: chart, lines: lines, text: text)
            if chart.omitted > 0 {
                OmittedNote(message: text("Gezeigt: die letzten \(chart.rows.count) von \(chart.total) Tagen.",
                                          "Showing the latest \(chart.rows.count) of \(chart.total) days."), text: text) {
                    coordinator.openWeb(action: "progress")
                }
            }
        } header: {
            Text(text("Gesamtverlauf", "Overall progress"))
        } footer: {
            Text(text("Tage ohne Messung bleiben leer. Den kombinierten Indexchart zeigt PULS.",
                      "Days without a measurement stay empty. PULS shows the combined index chart."))
        }
    }

    /// Alle drei Schalter ausdrücklich (fehlend = an, wie im Web).
    private var effectiveLines: [String: Bool] {
        var result: [String: Bool] = [:]
        for key in ProgressOps.lineKeys { result[key] = chart.lines[key] ?? settings.chartLines[key] ?? true }
        return result
    }
}

// MARK: - Rekorde

private struct RecordsSection: View {
    let progress: ProgressProjection
    let coordinator: ProgressCoordinator
    let text: ProgressText

    var body: some View {
        Section {
            if progress.records.isEmpty {
                Text(text("Noch keine Übungen mit Rekorden.", "No exercise records yet."))
                    .foregroundStyle(.secondary)
            }
            ForEach(progress.records) { record in
                Button {
                    coordinator.show(.exercise(id: record.id, name: record.name))
                } label: {
                    RecordRow(record: record, text: text)
                }
                .accessibilityHint(text("Öffnet den Verlauf", "Opens the history"))
            }
            if progress.recordCount > progress.records.count {
                OmittedNote(message: text("\(progress.recordCount - progress.records.count) weitere Übungen in PULS.",
                                          "\(progress.recordCount - progress.records.count) more exercises in PULS."), text: text) {
                    coordinator.openWeb(action: "records")
                }
            }
        } header: {
            Text(text("Rekorde", "Records"))
        }
    }
}

struct RecordRow: View {
    let record: StrengthRecord
    let text: ProgressText

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(record.name.isEmpty ? text("Übung", "Exercise") : record.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            Spacer(minLength: 8)
            if let rank = record.rank?.name {
                Text(rank)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.trailing)
            }
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts: [String] = []
        if let best = record.best {
            parts.append("e1RM " + text.number(best.e1rm) + " kg")
        } else {
            parts.append(text("noch kein e1RM", "no e1RM yet"))
        }
        if let heaviest = record.heaviest, let kg = heaviest.kg {
            parts.append(text("schwerster Satz ", "heaviest set ") + text.number(kg) + " kg" + (heaviest.reps.map { " × " + text.number($0, digits: 0) } ?? ""))
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Aktivitäten

private struct ActivitySection: View {
    let projection: ProgressProjection
    let coordinator: ProgressCoordinator
    let text: ProgressText
    @State private var mode: String?
    @State private var filter: String?
    @State private var queried: LoadPhase<ActivityView>?
    @State private var reload = 0

    var body: some View {
        let base = projection.activity
        let currentMode = mode ?? base?.mode ?? "week"
        let currentFilter = filter ?? base?.filter ?? "all"
        let usesProjection = (mode == nil || mode == base?.mode) && (filter == nil || filter == base?.filter)
        let view = usesProjection ? base : queried?.value
        Section {
            Picker(text("Zeitraum", "Period"), selection: Binding(get: { currentMode }, set: { mode = $0 })) {
                Text(text("Woche", "Week")).tag("week")
                Text(text("Monat", "Month")).tag("month")
            }
            .pickerStyle(.segmented)
            if let types = (view ?? base)?.types, !types.isEmpty {
                Picker(text("Art", "Type"), selection: Binding(get: { currentFilter }, set: { filter = $0 })) {
                    Text(text("Alle", "All")).tag("all")
                    ForEach(types) { type in Text(type.label).tag(type.type) }
                }
            }
            if let view {
                if let summary = view.summary {
                    ActivitySummaryRow(summary: summary, text: text)
                }
                ForEach(view.byType) { row in
                    LabeledContent(row.label) {
                        Text(typeDetail(row.summary)).monospacedDigit()
                    }
                }
                ForEach(view.entries.prefix(10)) { entry in
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
                if view.entries.count > 10 || view.omitted > 0 || view.typesOmitted > 0 {
                    OmittedNote(message: text("Weitere Einträge stehen in PULS.", "More entries are in PULS."), text: text) {
                        coordinator.openWeb(action: "progress")
                    }
                }
            } else if !usesProjection {
                QueryPhaseView(isLoading: queried == nil || queried == .loading, isGone: false, text: text,
                               retry: { reload += 1 }, openWeb: { coordinator.openWeb(action: "progress") })
            }
        } header: {
            Text(text("Aktivitäten", "Activities") + ((view ?? base).map { " · " + text.range($0.start, $0.end) } ?? ""))
        }
        .task(id: "\(currentMode)|\(currentFilter)|\(usesProjection)|\(coordinator.store.progressGeneration)|\(reload)") { @MainActor in
            guard !usesProjection else { return }
            queried = .loading
            let today = coordinator.today
            guard let month = CalendarMonth.of(day: today) else { queried = .failed; return }
            let outcome = await coordinator.fetch { requestId in
                ProgressQueryRequest.month(month, day: today, activityMode: currentMode, activityFilter: currentFilter, requestId: requestId)
            }
            guard !Task.isCancelled else { return }
            if case .loaded(let message) = outcome, case .month(let result)? = message.result, let view = result.activityView {
                queried = .loaded(view)
            } else {
                queried = .failed
            }
        }
    }

    private func typeDetail(_ summary: ActivitySummary) -> String {
        var parts = ["\(summary.count ?? 0)×"]
        if let label = summary.durationLabel { parts.append(label) }
        if let km = summary.distanceKm, km > 0 { parts.append(text.number(km) + " km") }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Laufen

private struct RunningSection: View {
    let running: RunningSummary
    let records: [RunRecord]
    let coordinator: ProgressCoordinator
    let text: ProgressText

    var body: some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Läufe", "Runs"), value: "\(running.count ?? 0)")
                StatTile(title: text("Gesamt", "Total"), value: running.totalKm.map { text.number($0) + " km" } ?? "–")
                StatTile(title: text("Dieser Monat", "This month"), value: running.monthKm.map { text.number($0) + " km" } ?? "–")
            }
            if let pace = running.monthPaceText {
                LabeledContent(text("Ø Pace im Monat", "Avg. pace this month"), value: pace)
            }
            if let longest = running.longest {
                Button {
                    coordinator.show(.run(id: longest.id, name: text("Längster Lauf", "Longest run")))
                } label: {
                    LabeledContent(text("Längster Lauf", "Longest run"), value: text.km(longest.distanceKm) + " · " + text.day(longest.date))
                }
            }
            if let fastest = running.fastest {
                Button {
                    coordinator.show(.run(id: fastest.id, name: text("Schnellster Lauf", "Fastest run")))
                } label: {
                    LabeledContent(text("Schnellste Pace", "Fastest pace"), value: (fastest.paceText ?? "–") + " · " + text.day(fastest.date))
                }
            }
            if !running.weeks.isEmpty {
                RunWeeksChart(weeks: running.weeks, text: text)
                    .accessibilityLabel(text("Laufkilometer der letzten acht Wochen", "Running distance of the last eight weeks"))
            }
            ForEach(records) { record in
                LabeledContent(text("Bestzeit \(text.number(record.km, digits: 0)) km", "Best \(text.number(record.km, digits: 0)) km")) {
                    Text((record.clock ?? "–") + (record.date.map { " · " + text.day($0) } ?? "")).monospacedDigit()
                }
            }
        } header: {
            Text(text("Laufen", "Running"))
        } footer: {
            if records.contains(where: { $0.km == 21 }) {
                Text(text("21 km zählt volle 21 Kilometer, keinen vollständigen Halbmarathon.",
                          "21 km means 21 full kilometres, not a complete half marathon."))
            }
        }
    }
}

// MARK: - Konflikte

private struct ProgressConflictSection: View {
    let coordinator: ProgressCoordinator
    let text: ProgressText

    var body: some View {
        let conflicts = coordinator.conflicts
        if !conflicts.isEmpty {
            Section {
                ForEach(conflicts, id: \.command.id) { entry in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(description(entry.command.op)).font(.subheadline)
                        HStack(spacing: 16) {
                            Button(text("Verwerfen", "Discard"), role: .destructive) {
                                coordinator.discardConflict(id: entry.command.id)
                            }
                            Button(text("Trotzdem übernehmen", "Apply anyway")) {
                                coordinator.reapplyConflict(id: entry.command.id)
                            }
                        }
                        .buttonStyle(.borderless)
                        .frame(minHeight: 44)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text(text("Nicht übernommen", "Not applied"))
            } footer: {
                Text(text("Die Einstellung wurde inzwischen an anderer Stelle geändert. Die Anzeige zeigt den aktuellen Stand.",
                          "This setting was changed elsewhere in the meantime. The view shows the current state."))
            }
        }
    }

    private func description(_ op: String) -> String {
        switch op {
        case ProgressOps.goalSet: return text("Wochenziele", "Weekly goals")
        case ProgressOps.chartSet: return text("Verlaufsdiagramm", "Progress chart")
        default: return text("Fortschrittsansicht", "Progress view")
        }
    }
}
