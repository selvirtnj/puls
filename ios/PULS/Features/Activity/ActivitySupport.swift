import Foundation
import PULSCore

/// Texte und Formate der nativen Aktivitäten (DE/EN nach `activity.language`, Zahlen im Web-Gebietsschema).
/// Formatiert nur: Distanz, Pace, kcal, Höhe, Splits und MMA-Phasen kommen fertig aus dem Web (§11).
struct ActivityText {
    let base: OverviewText

    init(language: String?, locale: String?) {
        base = OverviewText(language: language, locale: locale)
    }

    var locale: Locale { base.locale }
    var isEnglish: Bool { base.isEnglish }

    func callAsFunction(_ german: String, _ english: String) -> String {
        base(german, english)
    }

    func number(_ value: Double, digits: Int = 1) -> String {
        base.number(value, digits: digits)
    }

    /// Wie `runKm`: höchstens zwei Nachkommastellen.
    func km(_ value: Double) -> String {
        number(value, digits: 2)
    }

    /// Wie `formatClock`: `mm:ss` bzw. `h:mm:ss`.
    func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded(.down)))
        let hours = total / 3600, minutes = (total % 3600) / 60, secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%02d:%02d", minutes, secs)
    }

    /// Wie `runShortClock` (MMA-Restzeit, Rundenlängen): `m:ss` bzw. `h:mm:ss`, gerundet wie `Math.round`.
    func shortClock(_ seconds: Double) -> String {
        let total = max(0, Int(JSMath.round(seconds)))
        let hours = total / 3600, minutes = (total % 3600) / 60, secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%d:%02d", minutes, secs)
    }

    /// Wie `runPaceText` für eine vom Web gelieferte Sekundenangabe pro km (Splits): `m:ss /km`.
    func pace(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "–" }
        let total = Int(JSMath.round(seconds))
        return "\(total / 60):" + String(format: "%02d", total % 60) + " /km"
    }

    func spokenDuration(_ seconds: Double) -> String {
        let formatter = DateComponentsFormatter()
        formatter.unitsStyle = .full
        formatter.allowedUnits = seconds >= 3600 ? [.hour, .minute, .second] : [.minute, .second]
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = locale
        formatter.calendar = calendar
        return formatter.string(from: max(0, seconds)) ?? clock(seconds)
    }

    func timeOfDay(_ date: Date) -> String {
        date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits).locale(locale))
    }

    func day(_ day: String?, today: String?) -> String {
        guard let day else { return "" }
        if let today { return base.friendlyDay(day, today: today) }
        return base.shortDay(day)
    }

    func startDate(_ millis: Double) -> String {
        Date(timeIntervalSince1970: millis / 1000)
            .formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).hour().minute().locale(locale))
    }

    func failure(_ code: AckErrorCode?, message: String?) -> String {
        switch code {
        case .gone?: return self("Nicht mehr möglich: Die Aktivität hat sich geändert.", "No longer possible: the activity changed.")
        case .invalid?: return self("Nicht gespeichert", "Not saved") + (message.map { ": \($0)" } ?? ".")
        case .wrongUser?: return self("Die Änderung gehört zu einem anderen Konto und wurde zurückgehalten.",
                                      "The change belongs to another account and was held back.")
        case .unknownOp?: return self("Diese PULS-Version kann das gerade nicht ausführen.", "This PULS version cannot do this right now.")
        default: return self("Die Änderung wurde nicht übernommen.", "The change was not applied.")
        }
    }

    // MARK: Feste Web-Listen (Beschriftungen wie run-session.js)

    /// `RUN_FEELINGS`
    var feelings: [ActivityFeeling] {
        [
            ActivityFeeling(value: 1, symbol: "tortoise", label: self("Erschöpft", "Exhausted")),
            ActivityFeeling(value: 2, symbol: "cloud.rain", label: self("Schwer", "Hard")),
            ActivityFeeling(value: 3, symbol: "equal.circle", label: self("Normal", "Normal")),
            ActivityFeeling(value: 4, symbol: "hand.thumbsup", label: self("Gut", "Good")),
            ActivityFeeling(value: 5, symbol: "bolt", label: self("Stark", "Strong")),
        ]
    }

    func feeling(_ value: Int?) -> String? {
        guard let value else { return nil }
        return feelings.first { $0.value == value }?.label
    }

    /// `RUN_TERRAINS`
    func terrain(_ key: String) -> String {
        switch key {
        case "road": return self("Straße", "Road")
        case "forest": return self("Wald", "Forest")
        case "mixed": return self("Gemischt", "Mixed")
        case "trail": return "Trail"
        case "track": return self("Bahn", "Track")
        case "treadmill": return self("Laufband", "Treadmill")
        default: return key
        }
    }

    /// Feldbeschriftungen der Live-Werte (`runLiveFields`).
    func field(_ key: String) -> String {
        switch key {
        case "time": return self("Zeit", "Time")
        case "dist": return self("Distanz (km)", "Distance (km)")
        case "pace": return self("Tempo (/km)", "Pace (/km)")
        case "avgpace": return self("Ø Tempo (/km)", "Avg pace (/km)")
        case "gain": return self("Höhenmeter", "Elevation gain")
        case "alt": return self("Höhe", "Altitude")
        case "speed": return self("Ø km/h", "Avg km/h")
        case "kcal": return "kcal*"
        case "clock": return self("Uhrzeit", "Time of day")
        default: return key
        }
    }
}

struct ActivityFeeling: Identifiable, Equatable {
    let value: Int
    let symbol: String
    let label: String
    var id: Int { value }
}

/// Art der Live-Ansicht wie `runLiveKind`.
enum ActivityLiveKind {
    case run, walk, plain, mma

    init(type: String, gps: Bool, category: String?) {
        if type == "mma" { self = .mma } else if !gps { self = .plain } else { self = category == "run" ? .run : .walk }
    }

    /// Haupt- und Zusatzwerte (`runLiveFields`).
    var fields: [String] {
        switch self {
        case .run: return ["time", "dist", "pace", "avgpace", "kcal"]
        case .walk: return ["time", "dist", "gain", "alt", "speed", "kcal"]
        case .plain, .mma: return ["kcal", "clock"]
        }
    }
}

enum ActivitySymbols {
    /// Web-Icon-Schlüssel (`RUN_ACTIVITIES.icon`) → SF Symbol.
    static func symbol(_ icon: String?) -> String {
        switch icon {
        case "run"?: return "figure.run"
        case "walk"?: return "figure.walk"
        case "hike"?: return "figure.hiking"
        case "mountain"?: return "mountain.2"
        case "tabletennis"?: return "figure.table.tennis"
        case "soccer"?: return "figure.soccer"
        case "mma"?: return "figure.boxing"
        case "padel"?: return "figure.tennis"
        case "ride"?: return "figure.outdoor.cycle"
        default: return "figure.mixed.cardio"
        }
    }
}

/// Auswahllisten des Web-Rundenformulars (`runRoundsForm`), inklusive des aktuellen Werts.
enum RoundOptions {
    static func work(_ current: Int) -> [Int] { Array(Set([30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600, current])).sorted() }
    static func rest(_ current: Int) -> [Int] { Array(Set([0, 15, 30, 45, 60, 90, 120, 180, current])).sorted() }
    static func count(_ current: Int) -> [Int] { Array(Set(Array(1...12) + [15, 20, current])).sorted() }
}

/// Ersatzdistanz-Eingabe wie `runsum-km`: leer = keine Eingabe, Komma als Dezimaltrenner, 0–1000.
enum ManualKmInput {
    static func parse(_ text: String) -> ManualDistance? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return ManualDistance.none }
        guard let value = Double(trimmed.replacingOccurrences(of: ",", with: ".")), value.isFinite,
              value >= 0, value <= 1000 else { return nil }
        return .km(value)
    }

    static func text(_ distance: ManualDistance, locale: Locale) -> String {
        switch distance {
        case .none: return ""
        case .text(let text): return text
        case .km(let value): return value.formatted(.number.precision(.fractionLength(0...2)).grouping(.never).locale(locale))
        }
    }
}
