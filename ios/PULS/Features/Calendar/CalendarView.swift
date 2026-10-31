import SwiftUI
import UIKit
import PULSCore

// M5: nativer Trainingskalender (Web: `trainingCalendar` in js/training.js + Lauftage aus js/running.js).
// Monate kommen per Query (`kind:'month'`), vollständige Tagesanzahlen aus `days`, Tagesliste aus den begrenzten
// `entries`. Wochenbeginn Montag wie im Web. Bearbeiten/Löschen/Teilen bleiben Web-Abläufe.

struct CalendarScreen: View {
    @Bindable var coordinator: ProgressCoordinator
    @State private var phase: LoadPhase<CalendarMonthResult> = .loading
    /// Zuletzt geladener Monat; bleibt beim Nachladen sichtbar (kein Flackern beim Tageswechsel).
    @State private var shown: CalendarMonthResult?
    @State private var reload = 0

    var body: some View {
        let text = coordinator.text
        let month = coordinator.visibleMonth
        let selected = selectedDay(in: month)
        List {
            ProgressNoticeSection(coordinator: coordinator)
            Section {
                MonthHeader(month: month, text: text, isLoading: phase == .loading && shown != nil) { delta in
                    changeMonth(by: delta)
                }
                if let result = shown, result.month == month {
                    MonthGrid(result: result, selected: selected, today: coordinator.today, text: text) { day in
                        coordinator.calendarDay = day
                    }
                    Legend(text: text)
                } else {
                    QueryPhaseView(isLoading: phase == .loading, isGone: phase == .gone, text: text,
                                   retry: { reload += 1 }, openWeb: { coordinator.openWeb(action: "calendar") })
                }
            }
            if let result = shown, result.month == month {
                DayDetailSection(result: result, day: selected, coordinator: coordinator, text: text)
                if let week = result.weekRecap {
                    RecapSection(recap: week, title: text("Woche", "Week") + " · " + text.range(week.start, week.end), text: text)
                }
                MonthSummarySection(result: result, text: text)
            }
            Section {
                Button {
                    coordinator.openWeb(action: "calendar")
                } label: {
                    Label(text("Kalender in PULS öffnen", "Open calendar in PULS"), systemImage: "arrow.up.forward.app")
                }
                .accessibilityHint(text("Zeigt den Web-Kalender mit allen Funktionen", "Shows the web calendar with all features"))
            }
        }
        .listStyle(.insetGrouped)
        .contentMargins(.top, 4, for: .scrollContent)
        .task(id: QueryKey(month: month, week: WeightDay.weekStart(selected) ?? "", revision: coordinator.dataRevision,
                           reload: reload)) { @MainActor in
            await load(month: month, day: selected)
        }
        .onChange(of: coordinator.store.progressGeneration) { _, _ in
            // Dokument/Nutzer gewechselt: alte Daten nicht weiter zeigen.
            shown = nil
        }
    }

    private struct QueryKey: Hashable {
        var month: String
        var week: String
        var revision: String
        var reload: Int
    }

    /// Ausgewählter Tag im sichtbaren Monat: gemerkter Tag, sonst heute (falls im Monat), sonst der 1.
    private func selectedDay(in month: String) -> String {
        if let day = coordinator.calendarDay, day.hasPrefix(month + "-") { return day }
        if coordinator.today.hasPrefix(month + "-") { return coordinator.today }
        return month + "-01"
    }

    private func changeMonth(by delta: Int) {
        guard let next = CalendarMonth.adding(delta, to: coordinator.visibleMonth) else { return }
        coordinator.calendarMonth = next
        coordinator.calendarDay = nil
        UISelectionFeedbackGenerator().selectionChanged()
    }

    private func load(month: String, day: String) async {
        phase = .loading
        let outcome = await coordinator.fetch { requestId in
            ProgressQueryRequest.month(month, day: day, requestId: requestId)
        }
        guard !Task.isCancelled else { return }
        switch outcome {
        case .loaded(let message):
            if case .month(let result)? = message.result, result.month == month {
                shown = result
                phase = .loaded(result)
            } else {
                phase = .failed
            }
        case .gone: phase = .gone
        case .failed, .loading: phase = .failed
        }
    }
}

// MARK: - Kopf und Raster

private struct MonthHeader: View {
    let month: String
    let text: ProgressText
    let isLoading: Bool
    let change: (Int) -> Void

    var body: some View {
        HStack {
            Button { change(-1) } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(text("Vorheriger Monat", "Previous month"))
            Spacer(minLength: 4)
            HStack(spacing: 8) {
                Text(text.monthTitle(month))
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                if isLoading { ProgressView().controlSize(.small) }
            }
            Spacer(minLength: 4)
            Button { change(1) } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(text("Nächster Monat", "Next month"))
        }
        .buttonStyle(.borderless)
        .accessibilityElement(children: .contain)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: change(1)
            case .decrement: change(-1)
            @unknown default: break
            }
        }
    }
}

private struct MonthGrid: View {
    let result: CalendarMonthResult
    let selected: String
    let today: String
    let text: ProgressText
    let select: (String) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 7)

    var body: some View {
        let offset = CalendarMonth.mondayOffset(result.month) ?? 0
        LazyVGrid(columns: columns, spacing: 4) {
            ForEach(Array(text.weekdaySymbols.enumerated()), id: \.offset) { index, symbol in
                Text(symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(text.weekdayNames[index])
                    .accessibilityHidden(true)
            }
            ForEach(0..<offset, id: \.self) { index in
                Color.clear
                    .frame(minHeight: 44)
                    .accessibilityHidden(true)
                    .id("empty-\(index)")
            }
            ForEach(result.days) { day in
                DayCell(day: day, isSelected: day.date == selected, isToday: day.date == today, text: text) {
                    select(day.date)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

private struct DayCell: View {
    let day: CalendarDayCount
    let isSelected: Bool
    let isToday: Bool
    let text: ProgressText
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Text(String(Int(day.date.suffix(2)) ?? 0))
                    .font(.callout.weight(isToday || isSelected ? .bold : .regular))
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? Color.white : (isToday ? Color.accentColor : Color.primary))
                HStack(spacing: 3) {
                    if day.workouts > 0 {
                        Circle().fill(isSelected ? Color.white : Color.accentColor).frame(width: 6, height: 6)
                    }
                    if day.activities > 0 {
                        Circle().strokeBorder(isSelected ? Color.white : Color.accentColor, lineWidth: 1.5).frame(width: 6, height: 6)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isSelected ? Color.accentColor : Color.clear)
            }
            .overlay {
                if isToday && !isSelected {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Color.accentColor, lineWidth: 1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibility)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var accessibility: String {
        var parts = [text.longDay(day.date)]
        if isToday { parts.append(text("heute", "today")) }
        if day.workouts > 0 { parts.append(text.workouts(day.workouts)) }
        if day.activities > 0 { parts.append(text.activities(day.activities)) }
        if day.total == 0 { parts.append(text("kein Eintrag", "no entries")) }
        return parts.joined(separator: ", ")
    }
}

private struct Legend: View {
    let text: ProgressText

    var body: some View {
        HStack(spacing: 16) {
            Label {
                Text(text("Krafttraining", "Strength"))
            } icon: {
                Circle().fill(Color.accentColor).frame(width: 6, height: 6)
            }
            Label {
                Text(text("Aktivität", "Activity"))
            } icon: {
                Circle().strokeBorder(Color.accentColor, lineWidth: 1.5).frame(width: 6, height: 6)
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Tag und Monat

private struct DayDetailSection: View {
    let result: CalendarMonthResult
    let day: String
    let coordinator: ProgressCoordinator
    let text: ProgressText

    var body: some View {
        let entries = result.entries(on: day)
        Section {
            if entries.isEmpty && !result.isIncomplete(day) {
                Text(text("Kein Training an diesem Tag.", "No workout on this day."))
                    .foregroundStyle(.secondary)
            }
            ForEach(entries) { entry in
                Button {
                    if entry.isWorkout {
                        coordinator.show(.workout(id: entry.entryId, name: entry.name))
                    } else {
                        coordinator.show(.run(id: entry.entryId, name: entry.name))
                    }
                } label: {
                    ActivityEntryRow(entry: entry, text: text, showsChevron: true)
                }
                .accessibilityHint(entry.isWorkout ? text("Öffnet den Rückblick", "Opens the review")
                                                   : text("Öffnet die Aktivität", "Opens the activity"))
            }
            if result.isIncomplete(day) {
                OmittedNote(message: text("Nicht alle Einträge dieses Tages passen in diese Ansicht.",
                                          "Not every entry of this day fits this view."), text: text) {
                    coordinator.openWeb(action: "calendar")
                }
            }
        } header: {
            Text(text.longDay(day))
        }
    }
}

/// Zeile einer Trainings- oder Aktivitätseinheit mit Web-Werten (unbekannte Dauer/kcal ausdrücklich).
struct ActivityEntryRow: View {
    let entry: ActivityEntry
    let text: ProgressText
    var showsChevron = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.isWorkout ? "dumbbell.fill" : "figure.run")
                .foregroundStyle(.tint)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name.isEmpty ? (entry.isWorkout ? "Workout" : text("Aktivität", "Activity")) : entry.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            Spacer(minLength: 8)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts = [text.duration(clock: entry.durationClock, seconds: entry.durationSeconds)]
        if let km = entry.distanceKm, km > 0 { parts.append(text.km(km)) }
        if let kcal = entry.kcal {
            parts.append(text("ca. ", "approx. ") + text.number(kcal, digits: 0) + " kcal")
        } else {
            parts.append(text("kcal unbekannt", "kcal unknown"))
        }
        return parts.joined(separator: " · ")
    }
}

private struct MonthSummarySection: View {
    let result: CalendarMonthResult
    let text: ProgressText

    var body: some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Trainings", "Workouts"), value: "\(result.stats?.count ?? 0)")
                StatTile(title: text("Sätze", "Sets"), value: "\(result.stats?.sets ?? 0)")
                StatTile(title: text("Volumen", "Volume"), value: text.optional(result.stats?.volume, unit: "kg"))
            }
            if let activity = result.activity {
                ActivitySummaryRow(summary: activity, text: text)
            }
        } header: {
            Text(text("Monat", "Month") + " · " + text.monthTitle(result.month))
        } footer: {
            Text(text("Kalender zählt alle abgeschlossenen Einträge, auch importierte zukünftige.",
                      "The calendar counts all finished entries, including imported future ones."))
        }
    }
}

/// Aktivitätssumme mit ausdrücklich gezählten unbekannten Anteilen.
struct ActivitySummaryRow: View {
    let summary: ActivitySummary
    let text: ProgressText

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Einheiten", "Sessions"), value: "\(summary.count ?? 0)")
                StatTile(title: text("Aktive Zeit", "Active time"), value: summary.durationLabel ?? "–")
                StatTile(title: "km", value: summary.distanceKm.map { text.number($0) } ?? "–")
                StatTile(title: text("kcal geschätzt", "kcal estimated"), value: summary.kcal.map { text.number($0, digits: 0) } ?? "–")
            }
            if summary.unknownDurationCount > 0 || summary.unknownKcalCount > 0 {
                Text(unknownNote)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var unknownNote: String {
        var parts: [String] = []
        if summary.unknownDurationCount > 0 {
            parts.append(text("\(summary.unknownDurationCount) ohne bekannte Dauer", "\(summary.unknownDurationCount) without known duration"))
        }
        if summary.unknownKcalCount > 0 {
            parts.append(text("\(summary.unknownKcalCount) ohne bekannte kcal", "\(summary.unknownKcalCount) without known kcal"))
        }
        return parts.joined(separator: " · ")
    }
}

/// Wochen- oder Monatsrecap (Workouts, XP, Muskeln, Aktivität) mit Web-Werten.
struct RecapSection: View {
    let recap: ProgressRecap
    let title: String
    let text: ProgressText

    var body: some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Trainings", "Workouts"), value: "\(recap.stats?.count ?? 0)")
                StatTile(title: text("Sätze", "Sets"), value: "\(recap.stats?.sets ?? 0)")
                StatTile(title: text("Volumen", "Volume"), value: text.optional(recap.stats?.volume, unit: "kg"))
                StatTile(title: "XP", value: recap.xp.map { "+" + text.number($0, digits: 0) } ?? "–")
            }
            if let average = recap.stats?.averageClock {
                LabeledContent(text("Ø Workoutdauer", "Avg. workout"), value: average)
            } else if (recap.stats?.count ?? 0) > 0 {
                LabeledContent(text("Ø Workoutdauer", "Avg. workout"), value: text("unbekannt", "unknown"))
            }
            if let activity = recap.activity {
                ActivitySummaryRow(summary: activity, text: text)
            }
            if !recap.muscles.isEmpty {
                MuscleBars(muscles: recap.muscles, text: text)
            }
            if recap.musclesOmitted > 0 {
                Text(text("\(recap.musclesOmitted) weitere Muskelgruppen in PULS.", "\(recap.musclesOmitted) more muscle groups in PULS."))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text(title)
        }
    }
}

/// Muskelverteilung (Sätze je Muskelgruppe aus `muscleCounts`). Balkenlänge relativ zur größten Zeile.
struct MuscleBars: View {
    let muscles: [MuscleCount]
    let text: ProgressText

    var body: some View {
        let maximum = max(muscles.map(\.sets).max() ?? 1, 1)
        VStack(alignment: .leading, spacing: 8) {
            Text(text("Muskelverteilung", "Muscle distribution"))
                .font(.subheadline.weight(.semibold))
            ForEach(muscles) { muscle in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(muscle.label).font(.footnote)
                        Spacer(minLength: 8)
                        Text(text.sets(Int(muscle.sets)))
                            .font(.footnote)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                    GeometryReader { proxy in
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.accentColor)
                            .frame(width: max(4, proxy.size.width * muscle.sets / maximum))
                    }
                    .frame(height: 6)
                    .accessibilityHidden(true)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.vertical, 4)
    }
}
