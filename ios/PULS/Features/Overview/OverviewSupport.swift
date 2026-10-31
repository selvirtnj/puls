import Foundation
import PULSCore

/// Texte DE/EN nach `projection.language`, Zahlen/Daten im Web-Gebietsschema (`projection.locale`).
/// Formatiert nur: alle Werte kommen gerundet und fertig berechnet aus dem Web (keine eigenen Formeln).
struct OverviewText {
    let isEnglish: Bool
    let locale: Locale

    init(language: String?, locale: String?) {
        isEnglish = language == "en"
        if let locale, !locale.isEmpty {
            self.locale = Locale(identifier: locale)
        } else {
            self.locale = Locale(identifier: isEnglish ? "en-GB" : "de-DE")
        }
    }

    func callAsFunction(_ german: String, _ english: String) -> String {
        isEnglish ? english : german
    }

    /// Wie `n()` im Web: höchstens eine Nachkommastelle, Gruppierung nach Gebietsschema.
    func number(_ value: Double, digits: Int = 1) -> String {
        // Negative Null (z. B. `JSMath.round(-0.4)`) als „0“ zeigen, nie „−0“.
        (value == 0 ? 0 : value).formatted(.number.precision(.fractionLength(0...digits)).locale(locale))
    }

    /// Bereits ganzzahlige Web-Werte (Energie, Makros gegessen, Essens-kcal).
    func integer(_ value: Double) -> String {
        number(value, digits: 0)
    }

    func kcal(_ value: Double?) -> String {
        value.map { integer($0) + " kcal" } ?? "–"
    }

    func kg(_ value: Double) -> String {
        number(value) + " kg"
    }

    func signedKg(_ value: Double) -> String {
        (value == 0 ? 0 : value).formatted(.number.precision(.fractionLength(0...1)).sign(strategy: .always()).locale(locale)) + " kg"
    }

    /// Heute/Gestern/Morgen, sonst kurzes Datum (wie `friendlyDay`).
    func friendlyDay(_ day: String, today: String) -> String {
        if let a = WeightDay.dayNumber(day), let b = WeightDay.dayNumber(today) {
            switch a - b {
            case 0: return self("Heute", "Today")
            case -1: return self("Gestern", "Yesterday")
            case 1: return self("Morgen", "Tomorrow")
            default: break
            }
        }
        guard let date = WeightDay.date(from: day) else { return day }
        return date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(locale))
    }

    func shortDay(_ day: String) -> String {
        guard let date = WeightDay.date(from: day) else { return day }
        return date.formatted(.dateTime.day().month(.abbreviated).locale(locale))
    }

    /// Titel der Web-Kontounterseiten (`accountSections` in js/account-refresh.js); unbekannt → `nil` (dann „Konto“).
    func accountSectionTitle(_ key: String) -> String? {
        switch key {
        case "plan": return self("Dein Plan", "Your plan")
        case "body": return self("Körper & Entwicklung", "Body & development")
        case "adaptive": return self("Adaptiver Erhalt", "Adaptive maintenance")
        case "design": return self("Sprache & App-Icon", "Language & app icon")
        case "sounds": return self("Klänge & Feedback", "Sounds & feedback")
        case "manage": return self("Konto verwalten", "Manage account")
        default: return nil
        }
    }

    func macroLabel(_ key: String) -> String {
        switch key {
        case "p": return self("Eiweiß", "Protein")
        case "c": return self("Kohlenhydrate", "Carbs")
        case "f": return self("Fett", "Fat")
        default: return key
        }
    }

    /// Nährstoffnamen wie `nutrientLabels` (js/flows.js); unbekannte Schlüssel unverändert.
    func nutrientLabel(_ micro: MicroValue) -> String {
        let key = micro.labelKey.map { $0.hasPrefix("nutrient.") ? String($0.dropFirst("nutrient.".count)) : $0 } ?? micro.key
        switch key {
        case "fiber": return self("Ballaststoffe", "Fiber")
        case "vitc": return "Vitamin C"
        case "iron": return self("Eisen", "Iron")
        case "calcium": return "Calcium"
        case "b12": return "Vitamin B12"
        case "folate": return self("Folat", "Folate")
        case "potassium": return self("Kalium", "Potassium")
        case "magnesium": return "Magnesium"
        default: return key
        }
    }

    func energyCaption(_ key: String) -> String {
        switch key {
        case "energy.over": return self("über dem Tagesziel", "over your daily target")
        case "energy.noGoal": return self("gegessen, kein Tagesziel", "eaten, no daily target")
        default: return self("übrig", "left")
        }
    }

    /// „unbekannt“ bzw. „1 von 3 bekannt“; `nil` bei vollständig bekannt.
    func knowledgeNote(_ knowledge: Knowledge) -> String? {
        switch knowledge {
        case .noEntries: return nil
        case .unknown: return self("unbekannt", "unknown")
        case .partial(let known, let total): return self("\(known) von \(total) Einträgen bekannt", "\(known) of \(total) entries known")
        case .complete: return nil
        }
    }

    /// Laufuhr wie die Web-Anzeige (m:ss bzw. h:mm:ss).
    func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds))
        let hours = total / 3600, minutes = (total % 3600) / 60, secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%d:%02d", minutes, secs)
    }
}
