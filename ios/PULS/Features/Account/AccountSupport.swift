import SwiftUI
import UIKit
import PULSCore

/// Bereitet ein gewähltes Foto als Eingangsbild für `profile.avatar.set` auf: nur so weit verkleinert und als JPEG
/// kodiert, dass es die Web-Eingangsgrenzen einhält (≤ 512 Ki Zeichen, ≤ 4096 px). Zuschnitt auf 160 × 160, JPEG .85 und
/// die endgültige Größenprüfung macht das Web (`saveAvatarFile`).
enum AvatarEncoder {
    static func dataURL(from data: Data) -> String? {
        guard let image = UIImage(data: data), image.size.width > 0, image.size.height > 0 else { return nil }
        for edge in [1024.0, 768, 512, 384] {
            for quality in [0.8, 0.65, 0.5] {
                guard let jpeg = resized(image, maxEdge: edge).jpegData(compressionQuality: quality) else { continue }
                let url = "data:image/jpeg;base64," + jpeg.base64EncodedString()
                if AccountAvatar.isValidInput(url) { return url }
            }
        }
        return nil
    }

    private static func resized(_ image: UIImage, maxEdge: CGFloat) -> UIImage {
        let scale = min(1, maxEdge / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, (image.size.width * scale).rounded()), height: max(1, (image.size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}

/// Rundes Profilbild oder Initiale.
struct AccountAvatarView: View {
    let data: Data?
    let name: String
    var size: CGFloat = 64

    var body: some View {
        Group {
            if let data, let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                ZStack {
                    Circle().fill(Color.accentColor.opacity(0.18))
                    Text(initial)
                        .font(.system(size: size * 0.42, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.accentColor)
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initial: String {
        name.first.map { String($0).uppercased() } ?? "P"
    }
}

/// Die vorhandene Web-Prognose als Text; aufklappbare Annahmen wie `<details>` im Web.
struct ForecastView: View {
    let html: String
    let text: OverviewText
    @State private var expanded = false

    var body: some View {
        let blocks = ForecastText.blocks(html)
        let main = blocks.filter { !$0.inDetails }
        let details = blocks.filter(\.inDetails)
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(main.enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
            if !details.isEmpty {
                let summary = details.first { $0.kind == .summary }?.text ?? text("Annahmen", "Assumptions")
                DisclosureGroup(isExpanded: $expanded) {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(details.filter { $0.kind != .summary }.enumerated()), id: \.offset) { _, block in
                            blockView(block)
                        }
                    }
                    .padding(.top, 4)
                } label: {
                    Text(summary).font(.subheadline)
                }
            }
        }
    }

    @ViewBuilder
    private func blockView(_ block: ForecastText.Block) -> some View {
        switch block.kind {
        case .heading:
            Text(block.text).font(.headline).accessibilityAddTraits(.isHeader)
        case .paragraph, .summary:
            Text(block.text).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// Zeile „Bezeichnung … Wert“ mit sinnvoller VoiceOver-Ausgabe.
struct AccountValueRow: View {
    let title: String
    let value: String
    var note: String? = nil

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                Spacer(minLength: 12)
                Text(value).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(value).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint(note ?? "")
    }
}

/// Knopfzeile, die in die Web-App führt (immer klar beschriftet).
struct AccountWebRow: View {
    let title: String
    let symbol: String
    let text: OverviewText
    var role: ButtonRole? = nil
    let action: () -> Void

    var body: some View {
        Button(role: role, action: action) {
            HStack {
                Label(title, systemImage: symbol)
                    .foregroundStyle(role == .destructive ? Color.red : Color.primary)
                Spacer()
                Image(systemName: "arrow.up.forward.app")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityHint(text("Öffnet den bestehenden Ablauf in PULS", "Opens the existing flow in PULS"))
    }
}

extension OverviewText {
    func optionalNumber(_ value: Double?, digits: Int = 1, unit: String = "") -> String {
        guard let value else { return self("unbekannt", "unknown") }
        return number(value, digits: digits) + (unit.isEmpty ? "" : " " + unit)
    }

    func day(_ iso: String?) -> String {
        guard let iso, let date = WeightDay.date(from: iso) else { return iso ?? "–" }
        return date.formatted(.dateTime.day().month(.abbreviated).year().locale(locale))
    }

    func activityLabel(_ value: Double) -> String {
        switch value {
        case 1.2: return self("Überwiegend sitzend", "Mostly sedentary")
        case 1.375: return self("Leicht aktiv", "Lightly active")
        case 1.55: return self("Moderat aktiv", "Moderately active")
        case 1.725: return self("Sehr aktiv", "Very active")
        case 1.9: return self("Extrem aktiv", "Extremely active")
        default: return number(value, digits: 3)
        }
    }

    func planValue(_ key: String, _ value: String?) -> String {
        switch (key, value) {
        case ("mode", "auto"?), ("macroMode", "auto"?): return self("Berechnet", "Calculated")
        case ("mode", "manual"?), ("macroMode", "manual"?): return self("Selbst", "Manual")
        case ("direction", "lose"?): return self("Abnehmen", "Lose")
        case ("direction", "maintain"?): return self("Halten", "Maintain")
        case ("direction", "gain"?): return self("Aufbauen", "Build")
        case ("pace", "low"?): return self("Wenig", "Low")
        case ("pace", "medium"?): return self("Mittel", "Medium")
        case ("pace", "high"?): return self("Viel", "High")
        case ("pace", "extreme"?): return self("Extrem (begrenzt)", "Extreme (limited)")
        case ("method", "mifflin"?): return self("Formel", "Formula")
        case ("method", "measured"?): return self("Gemessen", "Measured")
        case ("kcalMode", "classic"?): return self("Klassisch (Aktivitätsfaktor)", "Classic (activity factor)")
        case ("kcalMode", "baseline"?): return self("Grundbedarf + Sport", "Baseline + exercise")
        default: return value ?? self("unbekannt", "unknown")
        }
    }
}

/// Zahleneingabe wie im Web: Komma oder Punkt, leer = kein Wert.
enum AccountInput {
    static func number(_ text: String, locale: Locale) -> Double? {
        GoalInput.number(text, locale: locale)
    }

    static func text(_ value: Double?, locale: Locale) -> String {
        guard let value else { return "" }
        return value.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(locale))
    }
}
