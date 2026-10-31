import SwiftUI
import PULSCore

// Native Übersicht (M3). Liest ausschließlich `ProfileStore.currentProjection` (Web-Projektion `overview`).
// Keine eigenen Plan-, Summen-, Trend- oder Chartformeln: Werte, Reste und Prozent kommen fertig aus dem Web.
// Alle Knöpfe führen über `pulsNativeNavigate` in bestehende Web-Abläufe; nur das Gewicht öffnet den nativen
// Körperbereich aus M2. Seitentitel und Datumsleiste liegen im gemeinsamen Kopf (`ShellHeader`).

struct OverviewHost: View {
    let store: ProfileStore
    let actions: OverviewActions

    var body: some View {
        OverviewRoot(actions: actions)
            .environment(store)
    }
}

private struct OverviewRoot: View {
    @Environment(ProfileStore.self) private var store
    let actions: OverviewActions

    var body: some View {
        if let projection = store.currentProjection {
            OverviewView(projection: projection, actions: actions)
        } else {
            OverviewLoadingView(
                text: OverviewText(language: store.document["language"]?.stringValue, locale: nil),
                onShowWeb: actions.showWebHome
            )
        }
    }
}

struct OverviewView: View {
    let projection: ProjectionMessage
    let actions: OverviewActions

    var body: some View {
        let overview = projection.overview
        let text = OverviewText(language: overview.language, locale: overview.locale)
        List {
            StatusSection(projection: projection, text: text)
            EnergySection(overview: overview, text: text, perform: actions.perform)
            FoodSection(overview: overview, text: text, perform: actions.perform)
            NutrientSection(overview: overview, text: text)
            TrainingSection(overview: overview, text: text, perform: actions.perform)
            BodySection(overview: overview, text: text, perform: actions.perform, openBody: actions.openBody)
            ProgressSection(overview: overview, text: text, perform: actions.perform)
        }
        .listStyle(.insetGrouped)
        .contentMargins(.top, 8, for: .scrollContent)
        .environment(\.locale, text.locale)
        .tint(.blue)
    }
}

// MARK: - Zeilen

/// Zeile im Stil von `dsRow`: Titel, optionale Detailzeile, rechter Wert, Chevron bei Aktion.
private struct OverviewRow: View {
    let title: String
    var detail: String?
    var value: String?
    var systemImage: String?
    /// Akzentfarbige Aktionszeile (`dsaction`).
    var isAction = false
    var accessibilityHint: String?
    var action: (() -> Void)?

    var body: some View {
        if let action {
            Button(action: action) { content(showsChevron: true) }
                .accessibilityHint(accessibilityHint ?? "")
        } else {
            content(showsChevron: false)
        }
    }

    private func content(showsChevron: Bool) -> some View {
        HStack(spacing: 12) {
            if let systemImage {
                Image(systemName: systemImage)
                    .foregroundStyle(.tint)
                    .frame(minWidth: 24)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .foregroundStyle(isAction ? AnyShapeStyle(.tint) : AnyShapeStyle(.primary))
                if let detail, !detail.isEmpty {
                    Text(detail)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            if let value {
                Text(value)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.trailing)
            }
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Status

private struct StatusSection: View {
    let projection: ProjectionMessage
    let text: OverviewText

    private struct Note: Identifiable {
        let symbol: String
        let message: String
        var id: String { message }
    }

    private var notes: [Note] {
        var notes: [Note] = []
        if projection.overview.online == false {
            notes.append(Note(symbol: "wifi.slash", message: text("Offline. Einträge bleiben auf diesem iPhone und werden später synchronisiert.",
                                            "Offline. Entries stay on this iPhone and sync later.")))
        }
        if projection.flags.preview {
            notes.append(Note(symbol: "eye", message: text("Vorschau: nur zur Ansicht.", "Preview: view only.")))
        }
        if projection.flags.recovery {
            notes.append(Note(symbol: "lock", message: text("Wiederherstellung offen. Wähle zuerst in PULS den gewünschten Stand.",
                                       "Recovery pending. Choose the version in PULS first.")))
        }
        if projection.flags.uploadBlocked {
            notes.append(Note(symbol: "pause.circle", message: text("Synchronisierung angehalten, bitte im Konto prüfen.", "Sync paused, please check Account.")))
        }
        if projection.cloud.conflict {
            notes.append(Note(symbol: "exclamationmark.triangle", message: text("Sync-Konflikt, bitte im Konto klären.", "Sync conflict, please resolve in Account.")))
        }
        return notes
    }

    var body: some View {
        let notes = notes
        if !notes.isEmpty {
            Section {
                ForEach(notes) { note in
                    Label(note.message, systemImage: note.symbol)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

// MARK: - Energie

private struct EnergySection: View {
    let overview: OverviewProjection
    let text: OverviewText
    let perform: (NavigationTarget) -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Section {
            if let energy = overview.energy {
                let layout = dynamicTypeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
                    : AnyLayout(HStackLayout(alignment: .center, spacing: 20))
                layout {
                    EnergyRing(energy: energy, eaten: overview.eaten?.kcal, goal: overview.goals?.values?.kcal, text: text)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(bigValue(energy))
                            .font(.title.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(energy.over ? AnyShapeStyle(.orange) : AnyShapeStyle(.primary))
                        Text(text.energyCaption(energy.captionKey))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 6)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(accessibilityText(energy))
            } else {
                OverviewRow(title: text("Energie", "Energy"), value: text.kcal(overview.eaten?.kcal))
            }

            ForEach(["p", "c", "f"], id: \.self) { key in
                MacroRow(
                    label: text.macroLabel(key),
                    eaten: overview.eaten?[key],
                    goal: overview.goals?.values?[key],
                    bar: overview.macros[key],
                    text: text
                )
            }

            if let addFood = overview.actions["addFood"] {
                Button {
                    perform(addFood)
                } label: {
                    Text(text("Essen eintragen", "Log food"))
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 36)
                }
                .buttonStyle(.borderedProminent)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 4, trailing: 0))
            }
        }
    }

    /// Wie `dsEnergyFacts.big`: Überschuss mit „+“, sonst Rest bzw. gegessen ohne Ziel.
    private func bigValue(_ energy: EnergyFacts) -> String {
        guard let value = energy.displayValue else { return "–" }
        return (energy.over ? "+" : "") + text.integer(value) + " kcal"
    }

    private func accessibilityText(_ energy: EnergyFacts) -> String {
        var parts = [bigValue(energy) + " " + text.energyCaption(energy.captionKey)]
        if let eaten = overview.eaten?.kcal {
            if let goal = overview.goals?.values?.kcal, energy.hasGoal {
                parts.append(text("\(text.integer(eaten)) von \(text.integer(goal)) kcal gegessen",
                                  "\(text.integer(eaten)) of \(text.integer(goal)) kcal eaten"))
            } else {
                parts.append(text("\(text.integer(eaten)) kcal gegessen", "\(text.integer(eaten)) kcal eaten"))
            }
        }
        return parts.joined(separator: ", ")
    }
}

private struct EnergyRing: View {
    let energy: EnergyFacts
    let eaten: Double?
    let goal: Double?
    let text: OverviewText
    @ScaledMetric(relativeTo: .title) private var size: CGFloat = 104

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color(.systemFill), lineWidth: 10)
            Circle()
                .trim(from: 0, to: energy.ringFraction)
                .stroke(energy.over ? Color.orange : Color.blue, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text(eaten.map(text.integer) ?? "–")
                    .font(.headline)
                    .monospacedDigit()
                Text(energy.hasGoal && goal != nil ? text("von", "of") + " " + text.integer(goal ?? 0) : "kcal")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .minimumScaleFactor(0.6)
            .padding(14)
        }
        .frame(width: size, height: size)
    }
}

private struct MacroRow: View {
    let label: String
    let eaten: Double?
    let goal: Double?
    let bar: MacroBar?
    let text: OverviewText

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                Spacer(minLength: 8)
                Text(valueText)
                    .monospacedDigit()
                    .foregroundStyle(bar?.over == true ? AnyShapeStyle(.orange) : AnyShapeStyle(.secondary))
            }
            .font(.subheadline)
            if let bar {
                ProgressView(value: bar.percent, total: 100)
                    .tint(bar.over ? .orange : .blue)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityValue(bar?.over == true ? text("über dem Ziel", "over target") : "")
    }

    private var valueText: String {
        guard let eaten else { return "–" }
        // Gegessen ganzzahlig, Ziel mit Web-Präzision; keine erneute Differenz aus gerundeten Werten.
        if let goal { return "\(text.integer(eaten)) / \(text.number(goal)) g" }
        return "\(text.integer(eaten)) g"
    }
}

// MARK: - Essen

private struct FoodSection: View {
    let overview: OverviewProjection
    let text: OverviewText
    let perform: (NavigationTarget) -> Void

    var body: some View {
        let food = overview.food
        let preview = food?.preview ?? []
        Section {
            if preview.isEmpty {
                Text(food?.total ?? 0 > 0 ? text("Einträge im Tagebuch ansehen.", "See entries in the diary.")
                                         : text("Noch nichts eingetragen.", "Nothing logged yet."))
                    .foregroundStyle(.secondary)
            }
            ForEach(preview) { entry in
                OverviewRow(
                    title: entry.name.isEmpty ? text("Eintrag", "Entry") : entry.name,
                    detail: entry.amount.map { "\(text.number($0)) \(entry.unit)" },
                    value: text.kcal(entry.kcal),
                    accessibilityHint: text("Bearbeiten", "Edit"),
                    action: NavigationTarget(action: "editFood", id: entry.id).map { target in { perform(target) } }
                )
            }
            if let diary = overview.actions["diary"] {
                let total = food?.total ?? 0
                OverviewRow(
                    title: total > preview.count ? text("Alle \(total) anzeigen", "Show all \(total)")
                                                 : text("Zum Ernährungstagebuch", "Open food diary"),
                    isAction: true,
                    action: { perform(diary) }
                )
            }
        } header: {
            Text(overview.isToday ? text("Heute eingetragen", "Logged today") : text("Eingetragen", "Logged"))
        } footer: {
            if food?.complete == true {
                Label(text("Tag abgeschlossen", "Day completed"), systemImage: "checkmark.circle")
            }
        }
    }
}

// MARK: - Wasser und Mikronährstoffe (nur Anzeige)

private struct NutrientSection: View {
    let overview: OverviewProjection
    let text: OverviewText
    @State private var showsMicros = false

    var body: some View {
        if overview.water != nil || !overview.micros.isEmpty {
            Section {
                if let water = overview.water {
                    OverviewRow(
                        title: text("Wasser", "Water"),
                        detail: waterDetail(water),
                        value: waterValue(water),
                        systemImage: "drop"
                    )
                }
                if !overview.micros.isEmpty {
                    DisclosureGroup(isExpanded: $showsMicros) {
                        ForEach(overview.micros) { micro in
                            OverviewRow(
                                title: text.nutrientLabel(micro),
                                detail: text.knowledgeNote(micro.knowledge).flatMap { note in
                                    micro.knowledge == .unknown ? nil : note
                                },
                                value: microValue(micro)
                            )
                        }
                    } label: {
                        Text(text("Mikronährstoffe & Ballaststoffe", "Micronutrients & fiber"))
                    }
                }
            } header: {
                Text(text("Nährwerte", "Nutrients"))
            }
        }
    }

    /// Unbekannt bleibt „unbekannt“, ein bekannter Nullwert bleibt „0“.
    private func microValue(_ micro: MicroValue) -> String {
        let unit = micro.unit.map { " " + $0 } ?? ""
        switch micro.knowledge {
        case .noEntries: return "–"
        case .unknown: return text("unbekannt", "unknown")
        default:
            let value = micro.value.map { text.number($0) } ?? "–"
            if let target = micro.target { return "\(value) / \(text.number(target))\(unit)" }
            return value + unit
        }
    }

    private func waterValue(_ water: WaterValue) -> String {
        switch water.knowledge {
        case .noEntries: return water.target.map { "– / \(text.number($0)) ml" } ?? "–"
        case .unknown: return text("unbekannt", "unknown")
        default:
            let value = water.value.map { text.number($0) } ?? "–"
            if let target = water.target { return "\(value) / \(text.number(target)) ml" }
            return value + " ml"
        }
    }

    private func waterDetail(_ water: WaterValue) -> String? {
        var parts: [String] = []
        if water.knowledge != .unknown, let note = text.knowledgeNote(water.knowledge) { parts.append(note) }
        if water.estimated > 0 {
            parts.append(text("davon \(text.number(water.estimated)) ml geschätzt", "incl. \(text.number(water.estimated)) ml estimated"))
        }
        if water.unknownDrinks > 0 {
            parts.append(water.unknownDrinks == 1
                         ? text("1 Getränk ohne Wasserwert", "1 drink without water value")
                         : text("\(water.unknownDrinks) Getränke ohne Wasserwert", "\(water.unknownDrinks) drinks without water value"))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

// MARK: - Training (folgt wie im Web dem heutigen Stand)

private struct TrainingSection: View {
    let overview: OverviewProjection
    let text: OverviewText
    let perform: (NavigationTarget) -> Void

    var body: some View {
        let training = overview.training
        Section {
            if let run = training?.activeRun, let resume = NavigationTarget(action: "resumeRun") {
                RunRow(run: run, text: text) { perform(resume) }
            }
            if let workout = training?.activeWorkout {
                OverviewRow(
                    title: workout.name.flatMap { $0.isEmpty ? nil : $0 } ?? "Workout",
                    detail: text("Laufendes Training", "Workout in progress"),
                    value: text("Fortsetzen", "Resume"),
                    systemImage: "dumbbell",
                    action: NavigationTarget(action: "resumeWorkout", id: workout.id).map { target in { perform(target) } }
                )
            } else {
                ForEach(training?.routines ?? []) { routine in
                    OverviewRow(
                        title: routine.name,
                        detail: routine.exerciseCount.map { count in
                            count == 1 ? text("1 Übung", "1 exercise") : text("\(count) Übungen", "\(count) exercises")
                        },
                        value: text("Starten", "Start"),
                        systemImage: "dumbbell",
                        action: NavigationTarget(action: "startRoutine", id: routine.id).map { target in { perform(target) } }
                    )
                }
                if let start = overview.actions["startWorkout"] {
                    OverviewRow(title: text("Freies Training", "Empty workout"), systemImage: "plus.circle", action: { perform(start) })
                }
            }
            if let routines = overview.actions["routines"] {
                OverviewRow(title: text("Alle Routinen", "All routines"), isAction: true, action: { perform(routines) })
            }
        } header: {
            Text(text("Training", "Training"))
        } footer: {
            if let week = training?.week, let footer = weekText(week) {
                Text(footer)
            }
        }
    }

    /// Wie `dsTrainingGroup`: aktive Minuten dieser Woche, Ziel und Laufkilometer.
    private func weekText(_ week: WeekActivity) -> String? {
        guard let minutes = week.activeMinutes else { return nil }
        var line = text("Aktiv diese Woche", "Active this week") + ": " + text.number(minutes.rounded(.down), digits: 0)
        if let goal = week.minutesGoal, goal > 0 { line += " / " + text.number(goal, digits: 0) }
        line += " min"
        if let km = week.runKm { line += " · " + text.number(km) + " km" }
        return line
    }
}

/// Laufende Aktivität: Momentaufnahme der Web-Uhr, lokal weitergezählt bis zur nächsten Projektion.
private struct RunRow: View {
    let run: RunSummary
    let text: OverviewText
    let action: () -> Void
    @State private var anchor = Date()

    var body: some View {
        TimelineView(.periodic(from: anchor, by: 1)) { context in
            OverviewRow(
                title: text("Aktivität läuft", "Activity in progress"),
                detail: run.paused ? text("Pausiert", "Paused") : nil,
                value: clock(at: context.date),
                systemImage: "figure.run",
                action: action
            )
        }
        .onChange(of: run) { _, _ in anchor = Date() }
    }

    private func clock(at date: Date) -> String {
        guard let elapsed = run.elapsedSeconds else { return run.clock ?? text("Öffnen", "Open") }
        if run.paused { return run.clock ?? text.clock(elapsed) }
        return text.clock(elapsed + max(0, date.timeIntervalSince(anchor)))
    }
}

// MARK: - Körper (folgt dem heutigen Stand)

private struct BodySection: View {
    let overview: OverviewProjection
    let text: OverviewText
    let perform: (NavigationTarget) -> Void
    let openBody: () -> Void

    var body: some View {
        let weight = overview.weight
        Section {
            OverviewRow(
                title: text("Gewicht", "Weight"),
                detail: weight?.current.map { text("Zuletzt", "Last") + " " + text.friendlyDay($0.date, today: overview.today) }
                    ?? text("Noch kein Eintrag", "No entry yet"),
                value: weight?.current.map { text.kg($0.kg) },
                systemImage: "scalemass",
                accessibilityHint: text("Öffnet Körper & Gewicht", "Opens body & weight"),
                action: openBody
            )
            if let note = trendNote(weight) {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            if let addWeight = overview.actions["addWeight"] {
                OverviewRow(title: text("Gewicht erfassen", "Log weight"), isAction: true, action: { perform(addWeight) })
            }
        } header: {
            Text(text("Körper", "Body"))
        }
    }

    private func trendNote(_ weight: WeightSummary?) -> String? {
        var parts: [String] = []
        if let trend = weight?.trend { parts.append(text("Trend", "Trend") + " " + text.kg(trend.kg)) }
        if let change = weight?.weeklyChange {
            parts.append(text("Woche", "Week") + " " + text.signedKg(change.kg))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

// MARK: - Verlauf (Indexchart bleibt in M3 im Web)

private struct ProgressSection: View {
    let overview: OverviewProjection
    let text: OverviewText
    let perform: (NavigationTarget) -> Void

    var body: some View {
        if let progress = overview.progress, let target = progress.navigation {
            Section {
                OverviewRow(
                    title: text("Verlauf ansehen", "View progress"),
                    detail: detail(progress),
                    systemImage: "chart.xyaxis.line",
                    accessibilityHint: text("Öffnet den Verlauf in PULS", "Opens progress in PULS"),
                    action: { perform(target) }
                )
            } header: {
                Text(text("Verlauf", "Progress"))
            }
        }
    }

    private func detail(_ progress: ProgressSummary) -> String? {
        var parts: [String] = []
        if let period = progress.period {
            parts.append(Int(period).map { text("\($0) Tage", "\($0) days") } ?? period)
        }
        let names: [(String, String)] = [
            ("weight", text("Gewicht", "Weight")), ("strength", text("Kraft", "Strength")), ("kcal", text("Kalorien", "Calories")),
        ]
        let shown = names.filter { progress.lines[$0.0] == true }.map(\.1)
        if !shown.isEmpty { parts.append(shown.joined(separator: ", ")) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

// MARK: - Laden

/// Noch keine Projektion: Ladeansicht, nach etwa 3 s zusätzlich die Web-Übersicht als Ausweg.
private struct OverviewLoadingView: View {
    let text: OverviewText
    let onShowWeb: () -> Void
    @State private var isSlow = false

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(text("Übersicht wird geladen …", "Loading overview …"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if isSlow {
                Button(text("Web-Übersicht anzeigen", "Show web overview"), action: onShowWeb)
                    .buttonStyle(.bordered)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .task {
            try? await Task.sleep(for: .seconds(3))
            isSlow = true
        }
    }
}
