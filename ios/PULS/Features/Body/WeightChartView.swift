import SwiftUI
import Charts
import PULSCore

/// Verlauf: Messwerte als Punkte, geglätteter Trend als Linie (wie die Web-Trendkarte).
struct WeightChartView: View {
    let points: [WeightTrendPoint]
    let text: BodyText

    private struct ChartPoint: Identifiable {
        let id: String
        let date: Date
        let kg: Double
        let trend: Double
    }

    private var chartPoints: [ChartPoint] {
        points.compactMap { point in
            WeightDay.date(from: point.date).map { ChartPoint(id: point.id, date: $0, kg: point.kg, trend: point.trend) }
        }
    }

    /// Wie im Web: kleinster/größter Wert aus Messung und Trend mit 0,4 kg Rand.
    private func domain(_ rows: [ChartPoint]) -> ClosedRange<Double> {
        let values = rows.flatMap { [$0.kg, $0.trend] }
        let low = (values.min() ?? 0) - 0.4
        let high = (values.max() ?? 1) + 0.4
        return low...Swift.max(high, low + 1)
    }

    var body: some View {
        let rows = chartPoints
        VStack(alignment: .leading, spacing: 10) {
            Chart(rows) { point in
                PointMark(
                    x: .value(text("Datum", "Date"), point.date, unit: .day),
                    y: .value(text("Messwert", "Measurement"), point.kg)
                )
                .symbolSize(rows.count > 120 ? 10 : 22)
                .foregroundStyle(Color.secondary.opacity(0.55))

                LineMark(
                    x: .value(text("Datum", "Date"), point.date, unit: .day),
                    y: .value(text("Trend", "Trend"), point.trend)
                )
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                .foregroundStyle(Color.blue)
            }
            .chartYScale(domain: domain(rows))
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4))
            }
            .chartYAxis {
                AxisMarks(position: .trailing, values: .automatic(desiredCount: 4))
            }
            .frame(height: 200)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text("Gewichtsverlauf", "Weight history"))
            .accessibilityValue(summary)

            HStack(spacing: 16) {
                legend(color: .blue, label: text("Geglätteter Trend", "Smoothed trend"))
                legend(color: Color.secondary.opacity(0.55), label: text("Messwerte", "Measurements"))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)
        }
    }

    private var summary: String {
        guard let first = points.first, let last = points.last else { return "" }
        if points.count == 1 {
            return text("Ein Messwert: ", "One measurement: ") + text.kg(last.kg)
        }
        return text(
            "Trend von \(text.kg(WeightMath.round1(first.trend), maxDigits: 1)) am \(text.day(first.date)) auf \(text.kg(WeightMath.round1(last.trend), maxDigits: 1)) am \(text.day(last.date)), \(text.measurements(points.count))",
            "Trend from \(text.kg(WeightMath.round1(first.trend), maxDigits: 1)) on \(text.day(first.date)) to \(text.kg(WeightMath.round1(last.trend), maxDigits: 1)) on \(text.day(last.date)), \(text.measurements(points.count))"
        )
    }

    private func legend(color: Color, label: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label)
        }
    }
}
