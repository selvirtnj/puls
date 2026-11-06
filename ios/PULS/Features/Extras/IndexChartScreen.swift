import SwiftUI
import Charts
import PULSCore

// N1 §15.4: kombinierter Gesamtverlauf. Werte und Skala kommen fertig normalisiert aus dem Web (`indexChart`), Swift zeichnet
// nur. Zeitraum und Kurven laufen über die bestehende Op `progress.chart.set`; die Abfrage folgt dem neuen Stand.

struct IndexChartScreen: View {
    let coordinator: ProgressCoordinator
    let extras: ExtrasCoordinator
    @State private var phase: LoadPhase<NativeIndexChart> = .loading
    @State private var reload = 0

    private static let periods = ["week", "month", "half", "year", "all"]

    init(coordinator: ProgressCoordinator, extras: ExtrasCoordinator) {
        self.coordinator = coordinator
        self.extras = extras
    }

    var body: some View {
        let text = coordinator.text
        List {
            ProgressNoticeSection(coordinator: coordinator)
            if let chart = phase.value {
                controls(chart, text: text)
                Section {
                    IndexChartPlot(chart: chart, text: text)
                } header: {
                    Text(text("Gesamtverlauf", "Overall progress"))
                } footer: {
                    Text(text("Erste Messung je Kurve = 100. Tage ohne Messung bleiben leer.",
                              "First measurement of each line = 100. Days without a measurement stay empty."))
                }
                latestSection(chart, text: text)
            } else {
                Section {
                    QueryPhaseView(isLoading: phase == .loading, isGone: phase == .gone, text: text, retry: { reload += 1 }, openWeb: nil)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(text("Gesamtverlauf", "Overall progress"))
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(extras.dataRevision)|\(reload)") { await load() }
    }

    private func load() async {
        let result = await extras.assemble { cursor, requestId in
            NativeQueryRequest.indexChart(cursor: cursor, requestId: requestId)
        }
        guard !Task.isCancelled else { return }
        switch result {
        case .loaded(let content):
            if let chart = NativeIndexChart(json: content.parsed) { phase = .loaded(chart) } else { phase = .failed }
        case .gone:
            phase = .gone
        default:
            // Beim Nachladen bleibt das gezeigte Diagramm stehen.
            if phase.value == nil { phase = .failed }
        }
    }

    @ViewBuilder
    private func controls(_ chart: NativeIndexChart, text: ProgressText) -> some View {
        let canEdit = coordinator.canWrite && !coordinator.isApplying
        let settings = coordinator.projection?.settings
        Section {
            Picker(text("Zeitraum", "Period"), selection: Binding(
                get: { chart.period },
                set: { value in
                    guard Self.periods.contains(value), value != chart.period else { return }
                    coordinator.setChart(period: value)
                }
            )) {
                ForEach(Self.periods, id: \.self) { key in Text(text.period(key)).tag(key) }
                // Älterer gespeicherter Wert (z. B. "90"): sichtbar lassen, nie automatisch umschreiben.
                if !Self.periods.contains(chart.period) {
                    Text(chart.period).tag(chart.period)
                }
            }
            .pickerStyle(.segmented)
            .disabled(!canEdit)
            ForEach(ProgressOps.lineKeys, id: \.self) { key in
                Toggle(text.line(key), isOn: Binding(
                    get: { chart.series[key] != nil },
                    set: { isOn in
                        var next: [String: Bool] = [:]
                        for line in ProgressOps.lineKeys { next[line] = settings?.chartLines[line] ?? (chart.series[line] != nil) }
                        next[key] = isOn
                        coordinator.setChart(lines: next)
                    }
                ))
                .disabled(!canEdit)
            }
        }
    }

    @ViewBuilder
    private func latestSection(_ chart: NativeIndexChart, text: ProgressText) -> some View {
        let keys = ProgressOps.lineKeys.filter { chart.series[$0]?.isEmpty == false }
        if !keys.isEmpty {
            Section {
                ForEach(keys, id: \.self) { key in
                    if let last = chart.series[key]?.last {
                        LabeledContent(text.line(key)) {
                            Text(text.number(last.raw) + Self.unit(key) + " · " + text.day(last.date)).monospacedDigit()
                        }
                    }
                }
            } header: {
                Text(text("Zuletzt gemessen", "Latest measurement"))
            }
        }
    }

    private static func unit(_ key: String) -> String {
        switch key {
        case "weight": return " kg"
        case "kcal": return " kcal"
        default: return ""
        }
    }
}

private struct IndexChartPlot: View {
    private struct Point: Identifiable {
        let id: String
        let date: Date
        let line: String
        let value: Double
    }

    let chart: NativeIndexChart
    let text: ProgressText

    private var points: [Point] {
        ProgressOps.lineKeys.flatMap { key -> [Point] in
            let label = text.line(key)
            return (chart.series[key] ?? []).compactMap { point -> Point? in
                guard let date = WeightDay.date(from: point.date) else { return nil }
                return Point(id: key + point.date, date: date, line: label, value: point.value)
            }
        }
    }

    var body: some View {
        let rows = points
        if rows.isEmpty {
            Text(text("Noch keine Messpunkte in diesem Zeitraum.", "No data points in this period yet."))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 80)
        } else {
            Chart(rows) { point in
                LineMark(x: .value(text("Datum", "Date"), point.date, unit: .day),
                         y: .value("Index", point.value),
                         series: .value(text("Kurve", "Line"), point.line))
                    .interpolationMethod(.linear)
                    .foregroundStyle(by: .value(text("Kurve", "Line"), point.line))
                PointMark(x: .value(text("Datum", "Date"), point.date, unit: .day),
                          y: .value("Index", point.value))
                    .foregroundStyle(by: .value(text("Kurve", "Line"), point.line))
                    .symbolSize(rows.count > 60 ? 10 : 24)
            }
            .chartYScale(domain: chart.min...chart.max)
            .frame(height: 240)
            .accessibilityLabel(text("Gesamtverlauf als Index, erste Messung je Kurve gleich 100",
                                     "Overall progress as an index, first measurement of each line equals 100"))
        }
    }
}
