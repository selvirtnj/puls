import Foundation

/// Eingabe der Wochenziele (km, Minuten) in DE/EN. Vorbelegung **ohne** Tausendertrennzeichen, damit „1000“ nie als
/// „1.000“ (= 1 km) zurückgelesen wird. Beim Lesen werden Dezimalkomma und -punkt akzeptiert; ein Trennzeichen mit
/// genau drei Ziffern danach (z. B. „1.000“ in DE, „1,000“ in EN) gilt als Tausendertrennung.
public enum GoalInput {
    /// km für das Eingabefeld: höchstens eine Nachkommastelle, ohne Gruppierung, Dezimaltrenner des Gebietsschemas.
    public static func kmText(_ km: Double, locale: Locale) -> String {
        km.formatted(.number.precision(.fractionLength(0...1)).grouping(.never).locale(locale))
    }

    public static func minutesText(_ minutes: Double, locale: Locale) -> String {
        minutes.formatted(.number.precision(.fractionLength(0)).grouping(.never).locale(locale))
    }

    /// `nil` = nicht lesbar.
    public static func number(_ text: String, locale: Locale) -> Double? {
        var value = text.trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "\u{00A0}", with: "").replacingOccurrences(of: "\u{202F}", with: "")
            .replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "'", with: "")
        guard !value.isEmpty else { return nil }
        let decimal = locale.decimalSeparator ?? "."
        let grouping = locale.groupingSeparator ?? (decimal == "," ? "." : ",")
        if isGrouped(value, separator: grouping) {
            value = value.replacingOccurrences(of: grouping, with: "")
        }
        value = value.replacingOccurrences(of: ",", with: ".")
        guard value.filter({ $0 == "." }).count <= 1, value.allSatisfy({ $0.isASCII && ($0.isNumber || $0 == ".") }),
              let number = Double(value), number.isFinite else { return nil }
        return number
    }

    /// „1.000“ bzw. „10.080“: Ziffern in Dreiergruppen hinter dem Trennzeichen.
    static func isGrouped(_ text: String, separator: String) -> Bool {
        guard !separator.isEmpty, text.contains(separator) else { return false }
        let parts = text.components(separatedBy: separator)
        guard let head = parts.first, (1...3).contains(head.count), head.allSatisfy(\.isNumber) else { return false }
        return parts.dropFirst().allSatisfy { $0.count == 3 && $0.allSatisfy(\.isNumber) }
    }

    /// Leer = kein Ziel (`.some(nil)`); 0,1–1000 km; sonst `nil` (ungültig).
    public static func km(_ text: String, locale: Locale) -> Double?? {
        if text.trimmingCharacters(in: .whitespaces).isEmpty { return .some(nil) }
        guard let value = number(text, locale: locale), value >= 0.1, value <= 1000 else { return nil }
        return .some(value)
    }

    /// Ganze Minuten 0–10080; sonst `nil`.
    public static func minutes(_ text: String, locale: Locale) -> Int? {
        guard let value = number(text, locale: locale), value == value.rounded(), value >= 0, value <= 10080 else { return nil }
        return Int(value)
    }
}
