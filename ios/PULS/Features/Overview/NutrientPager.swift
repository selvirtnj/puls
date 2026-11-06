import SwiftUI
import PULSCore

// Wischbare Nährwertkarte wie `nutritionSlides` im Web (Seite 1 „Energie & Makros“, Seite 2 „Mikronährstoffe“).
// Gemeinsam für Übersicht und Essen-Tab. Nur Darstellung: Werte, Ziele und Wissensstand kommen fertig aus der
// jeweiligen Web-Projektion; „unbekannt“ wird nie als 0 gezeigt.

/// Zwei Seiten mit Wischen (TabView `.page`) und Seitenpunkten. Die Höhe folgt der höheren Seite, damit die
/// Karte beim Wischen nicht springt.
struct NutrientPager<First: View, Second: View>: View {
    let text: OverviewText
    let first: First
    let second: Second
    @State private var page = 0

    // Explizit: `@State private` macht den synthetisierten Initialisierer sonst dateiprivat.
    init(text: OverviewText, @ViewBuilder first: () -> First, @ViewBuilder second: () -> Second) {
        self.text = text
        self.first = first()
        self.second = second()
    }

    private var labels: [String] {
        [text("Energie & Makros", "Energy & macros"), text("Mikronährstoffe", "Micronutrients")]
    }

    var body: some View {
        VStack(spacing: 6) {
            // Unsichtbare Kopien bestimmen die gemeinsame Höhe; die TabView liegt darüber.
            ZStack(alignment: .top) {
                first.hidden()
                second.hidden()
            }
            .frame(maxWidth: .infinity)
            .overlay {
                TabView(selection: $page) {
                    first
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .tag(0)
                        .accessibilityHidden(page != 0)
                    second
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .tag(1)
                        .accessibilityHidden(page != 1)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
            }
            PagerDots(count: 2, page: $page, labels: labels, text: text)
        }
        .sensoryFeedback(.selection, trigger: page)
    }
}

/// Seitenpunkte in Akzentfarbe (gut sichtbar in Hell und Dunkel); VoiceOver: einstellbar per Wischen hoch/runter.
private struct PagerDots: View {
    let count: Int
    @Binding var page: Int
    let labels: [String]
    let text: OverviewText
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<count, id: \.self) { index in
                Circle()
                    .fill(index == page ? AnyShapeStyle(.tint) : AnyShapeStyle(Color(.tertiaryLabel)))
                    .frame(width: 7, height: 7)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 4)
                    .contentShape(Rectangle())
                    .onTapGesture { select(index) }
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text("Ansicht", "View"))
        .accessibilityValue(labels.indices.contains(page) ? "\(labels[page]), \(page + 1) / \(count)" : "")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: select(min(count - 1, page + 1))
            case .decrement: select(max(0, page - 1))
            @unknown default: break
            }
        }
    }

    private func select(_ index: Int) {
        if reduceMotion {
            page = index
        } else {
            withAnimation(.easeInOut(duration: 0.25)) { page = index }
        }
    }
}

// MARK: - Mikronährstoffe

/// Eine Kachel der Mikronährstoffseite (bereits formatierte Web-Werte).
struct MicroCellModel: Identifiable, Equatable {
    let id: String
    let label: String
    let value: String
    /// Hinweis bei teilweise bekannten Werten („2 von 3 Einträgen“).
    let note: String?
    /// Balken nur bei bekanntem Wert und Ziel (reine Anzeige `value / target`, höchstens 1).
    let fraction: Double?

    static func fraction(value: Double?, target: Double?, knowledge: Knowledge) -> Double? {
        switch knowledge {
        case .complete, .partial:
            guard let value, let target, target > 0 else { return nil }
            return min(max(value / target, 0), 1)
        default:
            return nil
        }
    }

    /// Übersicht (`overview.micros`).
    init(micro: MicroValue, text: OverviewText) {
        id = micro.key
        label = text.nutrientLabel(micro)
        let unit = micro.unit.map { " " + $0 } ?? ""
        switch micro.knowledge {
        case .noEntries:
            value = "–"
        case .unknown:
            value = text("unbekannt", "unknown")
        default:
            let shown = micro.value.map { text.number($0) } ?? "–"
            value = micro.target.map { "\(shown) / \(text.number($0))\(unit)" } ?? shown + unit
        }
        if case .partial = micro.knowledge { note = text.knowledgeNote(micro.knowledge) } else { note = nil }
        fraction = Self.fraction(value: micro.value, target: micro.target, knowledge: micro.knowledge)
    }

    /// Essen-Tab (`nutrition.micros`).
    init(micro: NutritionMicro, text: OverviewText) {
        id = micro.key
        label = NutritionFormat.microLabel(micro, text: text)
        value = NutritionFormat.microValue(micro, text: text)
        if case .partial = micro.knowledge { note = text.knowledgeNote(micro.knowledge) } else { note = nil }
        fraction = Self.fraction(value: micro.value, target: micro.target, knowledge: micro.knowledge)
    }
}

/// Mikronährstoffe als kompaktes Zweierraster (bei sehr großer Schrift einspaltig), wie die Web-`microgrid`.
struct MicroGrid: View {
    let title: String
    let cells: [MicroCellModel]
    var goalsTitle: String?
    var goalsEnabled = true
    var onGoals: (() -> Void)?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(title: String, cells: [MicroCellModel], goalsTitle: String? = nil, goalsEnabled: Bool = true,
         onGoals: (() -> Void)? = nil) {
        self.title = title
        self.cells = cells
        self.goalsTitle = goalsTitle
        self.goalsEnabled = goalsEnabled
        self.onGoals = onGoals
    }

    var body: some View {
        let columns = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                if let onGoals, let goalsTitle {
                    Button(goalsTitle, action: onGoals)
                        .font(.subheadline)
                        .buttonStyle(.borderless)
                        .disabled(!goalsEnabled)
                }
            }
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(stride(from: 0, to: cells.count, by: columns)), id: \.self) { start in
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(cells[start..<min(start + columns, cells.count)]) { cell in
                            MicroCell(cell: cell)
                        }
                        if columns == 2, start + 1 >= cells.count {
                            Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }
}

private struct MicroCell: View {
    let cell: MicroCellModel

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(cell.label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(cell.value)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let note = cell.note {
                Text(note)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if let fraction = cell.fraction {
                ProgressView(value: fraction)
                    .tint(.blue)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
