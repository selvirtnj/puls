import Foundation

/// Typisierte Sicht auf einen Eintrag in `state.weights` (`{id, date, kg}`), nur lesend.
/// Geschrieben wird ausschließlich über `weight.upsert` / `weight.delete` (`ProfileStore.perform`).
public struct WeightEntry: Identifiable, Hashable, Sendable {
    public var id: String
    /// Lokaler Kalendertag `YYYY-MM-DD`.
    public var date: String
    public var kg: Double

    public init(id: String, date: String, kg: Double) {
        self.id = id
        self.date = date
        self.kg = kg
    }

    /// `nil`, wenn `id` leer, `date` kein gültiger Tag oder `kg` keine endliche Zahl ist.
    public init?(json: JSONValue) {
        guard let id = json["id"]?.stringValue, !id.isEmpty,
              let date = json["date"]?.stringValue, WeightDay.isValid(date),
              let kg = json["kg"]?.doubleValue, kg.isFinite else { return nil }
        self.init(id: id, date: date, kg: kg)
    }

    /// Alle lesbaren Einträge in Profilreihenfolge (unlesbare werden übersprungen, nie verändert).
    public static func entries(in document: ProfileDocument) -> [WeightEntry] {
        document.array("weights").compactMap(WeightEntry.init(json:))
    }
}

/// Messwert plus geglätteter Trend (wie `weightTrend()` in js/tracker-tools.js).
public struct WeightTrendPoint: Identifiable, Hashable, Sendable {
    public var entry: WeightEntry
    public var trend: Double

    public var id: String { entry.date }
    public var date: String { entry.date }
    public var kg: Double { entry.kg }

    public init(entry: WeightEntry, trend: Double) {
        self.entry = entry
        self.trend = trend
    }
}

/// Mittelwert einer Kalenderwoche ab Montag (wie `weeklyWeights()` in js/flows.js).
public struct WeeklyWeight: Identifiable, Hashable, Sendable {
    /// Montag der Woche, `YYYY-MM-DD`.
    public var weekStart: String
    public var kg: Double
    public var count: Int

    public var id: String { weekStart }

    public init(weekStart: String, kg: Double, count: Int) {
        self.weekStart = weekStart
        self.kg = kg
        self.count = count
    }
}

/// Kalendertage als `YYYY-MM-DD` ohne Zeitzonen-Sprünge (Tagesnummern seit 1970-01-01).
public enum WeightDay {
    /// Streng `YYYY-MM-DD` mit existierendem Datum.
    public static func isValid(_ text: String) -> Bool {
        dayNumber(text) != nil
    }

    /// Tage seit 1970-01-01 (entspricht `Date.parse(day) / 86400000` in JavaScript).
    public static func dayNumber(_ text: String) -> Int? {
        let scalars = Array(text.unicodeScalars)
        guard scalars.count == 10, scalars[4] == "-", scalars[7] == "-" else { return nil }
        func number(_ range: Range<Int>) -> Int? {
            var value = 0
            for index in range {
                let scalar = scalars[index]
                guard scalar >= "0", scalar <= "9" else { return nil }
                value = value * 10 + Int(scalar.value - 48)
            }
            return value
        }
        guard let year = number(0..<4), let month = number(5..<7), let day = number(8..<10),
              (1...12).contains(month), day >= 1, day <= daysIn(month: month, year: year) else { return nil }
        return daysFromCivil(year: year, month: month, day: day)
    }

    public static func string(fromDayNumber number: Int) -> String {
        let (year, month, day) = civilFromDays(number)
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    /// Gregorianischer Kalender in `timeZone`. ISO-Tage nie mit `Calendar.current` bilden: ein buddhistischer oder
    /// japanischer Gerätekalender ergäbe andere Jahreszahlen.
    public static func calendar(timeZone: TimeZone = .current) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    /// Lokaler Kalendertag eines Zeitpunkts (wie `today()` im Web), immer gregorianisch.
    public static func string(from date: Date, timeZone: TimeZone = .current) -> String {
        let parts = calendar(timeZone: timeZone).dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 1970, parts.month ?? 1, parts.day ?? 1)
    }

    /// Lokaler Mittag des Tages (für DatePicker und Diagramm-Achsen), immer gregorianisch.
    public static func date(from text: String, timeZone: TimeZone = .current) -> Date? {
        guard let number = dayNumber(text) else { return nil }
        let (year, month, day) = civilFromDays(number)
        return calendar(timeZone: timeZone).date(from: DateComponents(year: year, month: month, day: day, hour: 12))
    }

    /// Letzter Zeitpunkt des lokalen heutigen Tages (Obergrenze für die Datumsauswahl).
    public static func endOfToday(now: Date = Date(), timeZone: TimeZone = .current) -> Date {
        let gregorian = WeightDay.calendar(timeZone: timeZone)
        let start = gregorian.startOfDay(for: now)
        let next = gregorian.date(byAdding: .day, value: 1, to: start) ?? start.addingTimeInterval(86_400)
        return next.addingTimeInterval(-1)
    }

    public static func adding(days: Int, to text: String) -> String? {
        dayNumber(text).map { string(fromDayNumber: $0 + days) }
    }

    /// Montag der Woche (wie `weekStart()` in js/insights.js).
    public static func weekStart(_ text: String) -> String? {
        guard let number = dayNumber(text) else { return nil }
        // 1970-01-01 war ein Donnerstag (JS getDay() = 4).
        let weekday = ((number + 4) % 7 + 7) % 7
        let sinceMonday = (weekday + 6) % 7
        return string(fromDayNumber: number - sinceMonday)
    }

    private static func isLeap(_ year: Int) -> Bool {
        (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
    }

    private static func daysIn(month: Int, year: Int) -> Int {
        switch month {
        case 2: return isLeap(year) ? 29 : 28
        case 4, 6, 9, 11: return 30
        default: return 31
        }
    }

    // Proleptisch gregorianisch (H. Hinnant, days_from_civil / civil_from_days).
    private static func daysFromCivil(year: Int, month: Int, day: Int) -> Int {
        let y = month <= 2 ? year - 1 : year
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let mp = (month + 9) % 12
        let doy = (153 * mp + 2) / 5 + day - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    private static func civilFromDays(_ days: Int) -> (Int, Int, Int) {
        let z = days + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let day = doy - (153 * mp + 2) / 5 + 1
        let month = mp < 10 ? mp + 3 : mp - 9
        let year = yoe + era * 400 + (month <= 2 ? 1 : 0)
        return (year, month, day)
    }
}

/// Gewichtsauswertungen, Formeln exakt wie im Web (Phase A: Web bleibt maßgeblich).
public enum WeightMath {
    public static let minKg: Double = 20
    public static let maxKg: Double = 400

    /// Grenzen wie `addWeight` (js/app.js) und `validData`.
    public static func isValidKg(_ kg: Double) -> Bool {
        kg.isFinite && kg >= minKg && kg <= maxKg
    }

    /// Eingabe wie `addWeight`: getrimmt, `^\d+[.,]?\d*$`, Komma als Dezimaltrenner. `nil` bei falschem Format
    /// (Bereich prüft `isValidKg`).
    public static func parseKg(_ text: String) -> Double? {
        let raw = text.trimmingCharacters(in: .whitespacesAndNewlines)
        var digitsBefore = 0
        var separator = false
        var normalized = ""
        for scalar in raw.unicodeScalars {
            if scalar >= "0", scalar <= "9" {
                if !separator { digitsBefore += 1 }
                normalized.unicodeScalars.append(scalar)
            } else if scalar == "." || scalar == ",", !separator, digitsBefore > 0 {
                separator = true
                normalized.append(".")
            } else {
                return nil
            }
        }
        guard digitsBefore > 0 else { return nil }
        if normalized.hasSuffix(".") { normalized.removeLast() }
        guard let value = Double(normalized), value.isFinite else { return nil }
        return value
    }

    /// `weightTrend()` aus js/tracker-tools.js: nur Tage bis `today`, aufsteigend, pro Tag der letzte Eintrag,
    /// exponentielle Glättung mit 7-Tage-Zeitkonstante, Lücke mind. 1 und höchstens 30 Tage.
    public static func trend(_ entries: [WeightEntry], today: String) -> [WeightTrendPoint] {
        let sorted = entries.enumerated()
            .filter { $0.element.date <= today && $0.element.kg.isFinite }
            .sorted { lhs, rhs in
                lhs.element.date == rhs.element.date ? lhs.offset < rhs.offset : lhs.element.date < rhs.element.date
            }
            .map(\.element)
        var rows: [WeightEntry] = []
        for entry in sorted {
            if let last = rows.last, last.date == entry.date {
                rows[rows.count - 1] = entry
            } else {
                rows.append(entry)
            }
        }
        var points: [WeightTrendPoint] = []
        var trend: Double?
        var lastDay: Int?
        for entry in rows {
            guard let day = WeightDay.dayNumber(entry.date) else { continue }
            let gap = lastDay.map { Swift.max(1, Double(day - $0)) } ?? 1
            let alpha = 1 - Foundation.exp(-Swift.min(30, gap) / 7)
            let next = trend.map { $0 + alpha * (entry.kg - $0) } ?? entry.kg
            trend = next
            lastDay = day
            points.append(WeightTrendPoint(entry: entry, trend: next))
        }
        return points
    }

    /// `weeklyWeights()` aus js/flows.js: alle Einträge je Kalenderwoche (ab Montag) gemittelt, neueste zuerst.
    public static func weeklyAverages(_ entries: [WeightEntry]) -> [WeeklyWeight] {
        var sums: [String: (sum: Double, count: Int)] = [:]
        for entry in entries {
            guard let week = WeightDay.weekStart(entry.date) else { continue }
            let current = sums[week] ?? (0, 0)
            sums[week] = (current.sum + entry.kg, current.count + 1)
        }
        return sums
            .map { WeeklyWeight(weekStart: $0.key, kg: $0.value.sum / Double($0.value.count), count: $0.value.count) }
            .sorted { $0.weekStart > $1.weekStart }
    }

    /// Jüngster Eintrag bis `today` (wie `currentWeight()`; bei gleichem Tag der erste in Profilreihenfolge).
    public static func latest(_ entries: [WeightEntry], today: String) -> WeightEntry? {
        var best: WeightEntry?
        for entry in entries where entry.date <= today {
            if let current = best, entry.date <= current.date { continue }
            best = entry
        }
        return best
    }

    /// Wochenmittel der Woche des jüngsten Eintrags, nur Einträge bis `today` (wie `accountBodySummary()`).
    public static func latestWeekAverage(_ entries: [WeightEntry], today: String) -> WeeklyWeight? {
        guard let latest = latest(entries, today: today), let week = WeightDay.weekStart(latest.date) else { return nil }
        let rows = entries.filter { $0.date <= today && WeightDay.weekStart($0.date) == week }
        guard !rows.isEmpty else { return nil }
        return WeeklyWeight(weekStart: week, kg: rows.reduce(0) { $0 + $1.kg } / Double(rows.count), count: rows.count)
    }

    /// `currentWeight()`: jüngster Eintrag bis heute, sonst `profile.weight`.
    public static func currentWeight(_ document: ProfileDocument, today: String) -> Double? {
        if let latest = latest(WeightEntry.entries(in: document), today: today) { return latest.kg }
        return document["profile"]?["weight"]?.doubleValue
    }

    /// Liste für die Anzeige: neuester Tag zuerst, bei gleichem Tag Profilreihenfolge.
    public static func newestFirst(_ entries: [WeightEntry]) -> [WeightEntry] {
        entries.enumerated()
            .sorted { lhs, rhs in
                lhs.element.date == rhs.element.date ? lhs.offset < rhs.offset : lhs.element.date > rhs.element.date
            }
            .map(\.element)
    }

    /// `round()` der Web-App: eine Nachkommastelle.
    public static func round1(_ value: Double) -> Double {
        JSMath.round1(value)
    }
}
