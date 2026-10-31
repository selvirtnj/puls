import Foundation
import PULSCore

/// Texte und Formate des nativen Trainings (DE/EN nach `training.language`, Zahlen im Web-Gebietsschema).
/// Formatiert nur; alle Werte (Vorher, Volumen, XP, Level, Serie, Empfehlung) kommen fertig aus dem Web.
struct TrainingText {
    let base: OverviewText

    init(language: String?, locale: String?) {
        base = OverviewText(language: language, locale: locale)
    }

    init(projection: TrainingProjection?, fallbackLanguage: String?) {
        self.init(language: projection?.language ?? fallbackLanguage, locale: projection?.locale)
    }

    var locale: Locale { base.locale }
    var isEnglish: Bool { base.isEnglish }

    func callAsFunction(_ german: String, _ english: String) -> String {
        base(german, english)
    }

    func number(_ value: Double, digits: Int = 1) -> String {
        base.number(value, digits: digits)
    }

    /// Uhr wie `formatClock` im Web: `mm:ss` bzw. `h:mm:ss`.
    func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded(.down)))
        let hours = total / 3600, minutes = (total % 3600) / 60, secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%02d:%02d", minutes, secs)
    }

    /// Gesprochene Dauer für VoiceOver.
    func spokenDuration(_ seconds: Double) -> String {
        let formatter = DateComponentsFormatter()
        formatter.unitsStyle = .full
        formatter.allowedUnits = seconds >= 3600 ? [.hour, .minute] : [.minute, .second]
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = locale
        formatter.calendar = calendar
        return formatter.string(from: max(0, seconds)) ?? clock(seconds)
    }

    func count(_ value: Int, _ singularDE: String, _ pluralDE: String, _ singularEN: String, _ pluralEN: String) -> String {
        "\(value) " + (value == 1 ? self(singularDE, singularEN) : self(pluralDE, pluralEN))
    }

    func exercises(_ value: Int) -> String { count(value, "Übung", "Übungen", "exercise", "exercises") }
    func sets(_ value: Int) -> String { count(value, "Satz", "Sätze", "set", "sets") }

    /// Satzwert für die Anzeige: leer bleibt leer (nicht „0“).
    func value(_ value: SetValue?) -> String {
        switch value {
        case .number(let amount)?: return number(amount, digits: 2)
        case .empty?: return ""
        case nil: return "?"
        }
    }

    /// Web-Spalte „Vorher“: `n(kg) × reps`.
    func previous(_ set: PreviousSet?) -> String {
        guard let set, let reps = set.reps?.number else { return "–" }
        let kg = set.shownKg ?? set.kg?.number
        guard let kg else { return "–" }
        return "\(number(kg)) × \(number(reps, digits: 0))"
    }

    func day(_ day: String?, today: String?) -> String {
        guard let day else { return "" }
        if let today { return base.friendlyDay(day, today: today) }
        return base.shortDay(day)
    }

    func repRange(min: Double?, max: Double?) -> String? {
        switch (min, max) {
        case let (low?, high?) where low != high: return "\(number(low, digits: 0))–\(number(high, digits: 0)) " + self("Wdh.", "reps")
        case let (low?, _): return "\(number(low, digits: 0)) " + self("Wdh.", "reps")
        case let (nil, high?): return "\(number(high, digits: 0)) " + self("Wdh.", "reps")
        default: return nil
        }
    }

    func rest(_ seconds: Double?) -> String {
        guard let seconds else { return self("Standard", "Default") }
        if seconds == 0 { return self("Keine Pause", "No rest") }
        return clock(seconds)
    }

    /// Fehlertext zu einem abgelehnten Trainingsbefehl.
    func failure(_ code: AckErrorCode?, message: String?) -> String {
        switch code {
        case .gone?: return self("Nicht mehr möglich: Das Ziel gibt es nicht mehr.", "No longer possible: the target no longer exists.")
        case .invalid?: return self("Nicht gespeichert", "Not saved") + (message.map { ": \($0)" } ?? ".")
        case .wrongUser?: return self("Die Änderung gehört zu einem anderen Konto und wurde zurückgehalten.",
                                      "The change belongs to another account and was held back.")
        case .unknownOp?: return self("Diese PULS-Version kann die Änderung gerade nicht ausführen.",
                                      "This PULS version cannot apply the change right now.")
        default: return self("Die Änderung wurde nicht übernommen.", "The change was not applied.")
        }
    }
}

/// Eingabe für kg/Wdh. wie im Web: Komma als Dezimaltrenner, leer erlaubt (`""` ist nicht 0).
enum SetInput {
    /// kg 0–1000 oder leer; `nil` = ungültig.
    static func kg(_ text: String) -> SetValue? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .empty }
        guard let value = Double(trimmed.replacingOccurrences(of: ",", with: ".")), value.isFinite,
              value >= 0, value <= 1000 else { return nil }
        return .number(value)
    }

    /// Wiederholungen 1–1000 ganzzahlig oder leer; `nil` = ungültig.
    static func reps(_ text: String) -> SetValue? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .empty }
        guard let value = Int(trimmed), value >= 1, value <= 1000 else { return nil }
        return .number(Double(value))
    }

    /// Körpergewicht 20–400 kg oder leer (`nil` im Ergebnis = kein Wert); `.failure` = ungültig.
    static func bodyweight(_ text: String) -> Result<Double?, InputError> {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return .success(nil) }
        guard let value = Double(trimmed.replacingOccurrences(of: ",", with: ".")), value.isFinite,
              value >= 20, value <= 400 else { return .failure(InputError()) }
        return .success(value)
    }

    struct InputError: Error {}

    /// Text eines gespeicherten Werts für das Eingabefeld (Dezimaltrenner nach Gebietsschema).
    static func text(_ value: SetValue?, locale: Locale) -> String {
        guard case .number(let number)? = value else { return "" }
        return number.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(locale))
    }
}
