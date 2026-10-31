import SwiftUI
import Charts
import PULSCore

// Diagramme aus fertigen Web-Reihen. Nur echte Messpunkte, keine Nullen für unbekannte Tage, keine eigene
// Normalisierung oder Kennzahlformel. Jede Grafik hat eine sichtbare und für VoiceOver lesbare Zusammenfassung.

/// Punktreihe (Explorer, e1RM-Verlauf): Linie zwischen echten Messpunkten plus Punkte.
struct PointSeriesChart: View {
    struct Point: Identifiable, Equatable {
        let id: Int
        let date: Date
        let day: String
        let value: Double
    }

    let points: [Point]
    let unit: String
    let text: ProgressText
    var height: CGFloat = 180

    init(values: [DatedValue], unit: String, text: ProgressText, height: CGFloat = 180) {
        points = values.compactMap { value in
            WeightDay.date(from: value.date).map { Point(id: value.index, date: $0, day: value.date, value: value.value) }
        }
        self.unit = unit
        self.text = text
        self.height = height
    }

    init(exercisePoints: [ExercisePoint], text: ProgressText, height: CGFloat = 180) {
        points = exercisePoints.compactMap { point in
            WeightDay.date(from: point.date).map { Point(id: point.index, date: $0, day: point.date, value: point.value) }
        }
        unit = "kg"
        self.text = text
        self.height = height
    }

    var body: some View {
        if points.isEmpty {
            Text(text("Noch keine Messpunkte in diesem Zeitraum.", "No data points in this period yet."))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 80)
        } else {
            Chart(points) { point in
                LineMark(x: .value(text("Datum", "Date"), point.date, unit: .day),
                         y: .value(unit, point.value))
                    .interpolationMethod(.linear)
                    .foregroundStyle(Color.accentColor)
                PointMark(x: .value(text("Datum", "Date"), point.date, unit: .day),
                          y: .value(unit, point.value))
                    .foregroundStyle(Color.accentColor)
                    .symbolSize(points.count > 60 ? 12 : 30)
                    .accessibilityLabel(text.longDay(point.day))
                    .accessibilityValue(text.number(point.value) + (unit.isEmpty ? "" : " " + unit))
            }
            .chartYScale(domain: .automatic(includesZero: false))
            .frame(height: height)
            .accessibilityLabel(summary)
        }
    }

    /// „12 Messpunkte, zuletzt 101,3 kg am 24. Okt.“
    private var summary: String {
        guard let last = points.last else { return "" }
        let value = text.number(last.value) + (unit.isEmpty ? "" : " " + unit)
        return text("\(points.count) Messpunkte, zuletzt \(value) am \(text.day(last.day))",
                    "\(points.count) data points, latest \(value) on \(text.day(last.day))")
    }
}

/// Wöchentliche Laufkilometer (acht Wochen aus `runProgressCard`).
struct RunWeeksChart: View {
    let weeks: [RunWeek]
    let text: ProgressText

    private struct Bar: Identifiable {
        let id: String
        let date: Date
        let km: Double
    }

    var body: some View {
        let bars = weeks.compactMap { week in WeightDay.date(from: week.start).map { Bar(id: week.start, date: $0, km: week.km) } }
        Chart(bars) { bar in
            BarMark(x: .value(text("Woche", "Week"), bar.date, unit: .weekOfYear), y: .value("km", bar.km))
                .foregroundStyle(Color.accentColor)
                .accessibilityLabel(text("Woche ab ", "Week from ") + text.day(bar.id))
                .accessibilityValue(text.km(bar.km))
        }
        .chartXAxis {
            AxisMarks(values: .stride(by: .weekOfYear, count: 2)) { _ in
                AxisValueLabel(format: .dateTime.day().month(.abbreviated).locale(text.locale))
            }
        }
        .frame(height: 140)
    }
}

/// Gesamtverlauf (`trendData()`): je eingeschalteter Kurve ein eigenes kleines Diagramm mit eigener Skala statt
/// eines normalisierten Indexcharts (dessen Formel bleibt im Web).
struct TrendRowsCharts: View {
    let chart: ProgressChart
    let lines: [String: Bool]
    let text: ProgressText

    var body: some View {
        let enabled = ProgressOps.lineKeys.filter { lines[$0] ?? true }
        if enabled.isEmpty {
            Text(text("Keine Kurve ausgewählt.", "No line selected."))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        ForEach(enabled, id: \.self) { key in
            let values = chart.rows.compactMap { row -> DatedValue? in
                guard let value = value(row, key) else { return nil }
                return DatedValue(index: 0, date: row.date, value: value)
            }
            let indexed = values.enumerated().map { DatedValue(index: $0.offset, date: $0.element.date, value: $0.element.value) }
            VStack(alignment: .leading, spacing: 4) {
                Text(text.line(key))
                    .font(.subheadline.weight(.semibold))
                PointSeriesChart(values: indexed, unit: unit(key), text: text, height: 120)
            }
            .padding(.vertical, 4)
        }
    }

    private func value(_ row: TrendRow, _ key: String) -> Double? {
        switch key {
        case "weight": return row.weight
        case "strength": return row.strength
        case "kcal": return row.kcal
        default: return nil
        }
    }

    private func unit(_ key: String) -> String {
        switch key {
        case "weight": return "kg"
        case "kcal": return "kcal"
        default: return "Index"
        }
    }
}
