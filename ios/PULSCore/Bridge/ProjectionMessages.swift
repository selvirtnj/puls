import Foundation

// M3: `projection{name:"overview"}` aus docs/native/NATIVE-BRIDGE-PROTOCOL.md (additive v1-Erweiterung).
//
// Regeln:
// - Der Umschlag wird streng gelesen (wie `snapshot`): `projectionSeq`, `ownerPending`, `overview` sind Pflicht.
// - Im `overview` sind nur `date` und `today` Pflicht (gültige Kalendertage). Alle anderen Felder werden
//   nachsichtig gelesen: fehlend, `null` oder unerwarteter Typ = unbekannt (`nil`), nie erfundene Nullen.
//   So bleibt die native Übersicht bei einem erweiterten Web-Stand bedienbar, statt komplett auszufallen.
// - Verlustfrei: `raw` enthält die komplette Nachricht (auch unbekannte Felder); `json` gibt sie unverändert aus.
// - Native rechnet nichts nach: Ziele, Reste, Prozent, Rundung und Trend kommen fertig aus dem Web.

public struct ProjectionMessage: Equatable, Sendable {
    public static let overviewName = "overview"

    /// Flüchtige, dokumentlokale Nummer (beginnt bei 1). Nur innerhalb desselben Web-Dokuments vergleichbar.
    public var projectionSeq: Int
    /// Letzte Profilsnapshot-Nummer (nur Diagnose; ein Tageswechsel erhöht sie nicht).
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    /// `load | date | render | background | save | cloud | …`; unbekannte Werte bleiben erhalten.
    public var reason: String
    /// Schlüssel der Web-Kontounterseite beim Versand oder `nil` (liegt im Umschlag, nicht im `overview`).
    public var accountSection: String?
    public var overview: OverviewProjection
    /// Die vollständige Nachricht wie empfangen.
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.nonEmptyString("name") == Self.overviewName else { throw BridgeDecodingError.invalidField("name") }
        projectionSeq = try fields.int("projectionSeq")
        guard projectionSeq >= 0 else { throw BridgeDecodingError.invalidField("projectionSeq") }
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        reason = try fields.optionalString("reason") ?? "unknown"
        accountSection = try fields.optionalString("accountSection")
        guard let overview = fields["overview"] else { throw BridgeDecodingError.missingField("overview") }
        self.overview = try OverviewProjection(json: overview)
        raw = json
    }

    public var json: JSONValue { raw }
}

extension ProjectionMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

// MARK: - Übersicht

public struct OverviewProjection: Equatable, Sendable {
    /// Gewählter Tag; nur Essen/Energie/Mikros/Wasser/Tagesabschluss folgen ihm.
    public var date: String
    public var today: String
    public var isToday: Bool
    /// `de` oder `en` (Standard `de`).
    public var language: String
    public var locale: String?
    /// `system | light | dark` (Web-Einstellung).
    public var colorScheme: String
    /// `nil` = unbekannt.
    public var online: Bool?
    public var page: String?
    public var tabs: [OverviewTab]
    public var goals: OverviewGoals?
    public var eaten: MacroValues?
    public var remaining: MacroValues?
    public var energy: EnergyFacts?
    /// Schlüssel `p`, `c`, `f`.
    public var macros: [String: MacroBar]
    /// Reihenfolge wie im Web (`OverviewProjection.microOrder`), unbekannte Schlüssel danach alphabetisch.
    public var micros: [MicroValue]
    public var water: WaterValue?
    public var food: FoodSummary?
    public var training: TrainingSummary?
    public var weight: WeightSummary?
    public var progress: ProgressSummary?
    /// Feste Einstiege aus `overview.actions` (nur gültige Ziele).
    public var actions: [String: NavigationTarget]
    /// Das empfangene `overview`-Objekt.
    public var raw: JSONValue

    public static let microOrder = ["fiber", "vitc", "iron", "calcium", "b12", "folate", "potassium", "magnesium"]

    public init(json: JSONValue) throws {
        guard case .object = json else { throw BridgeDecodingError.invalidField("overview") }
        let o = Loose(json)
        guard let date = o.string("date"), WeightDay.isValid(date) else { throw BridgeDecodingError.invalidField("overview.date") }
        guard let today = o.string("today"), WeightDay.isValid(today) else { throw BridgeDecodingError.invalidField("overview.today") }
        self.date = date
        self.today = today
        isToday = o.bool("isToday") ?? (date == today)
        language = o.string("language") == "en" ? "en" : "de"
        locale = o.string("locale")
        colorScheme = o.string("colorScheme") ?? "system"
        online = o.object("connectivity")?.bool("online")
        page = o.string("page")
        tabs = o.array("tabs").compactMap(OverviewTab.init(json:))
        goals = o.object("goals").map { OverviewGoals($0) }
        eaten = o.object("eaten").map { MacroValues($0) }
        remaining = o.object("remaining").map { MacroValues($0) }
        energy = o.object("energy").flatMap { EnergyFacts($0) }
        var macros: [String: MacroBar] = [:]
        if let bars = o.object("macros") {
            for key in ["p", "c", "f"] {
                if let bar = bars.object(key) { macros[key] = MacroBar(bar) }
            }
        }
        self.macros = macros
        var micros: [MicroValue] = []
        if let microObject = o.object("micros") {
            let known = Self.microOrder.filter { microObject.values[$0] != nil }
            let extra = microObject.values.keys.filter { !Self.microOrder.contains($0) }.sorted()
            for key in known + extra {
                if let micro = microObject.object(key) { micros.append(MicroValue(key: key, micro)) }
            }
        }
        self.micros = micros
        water = o.object("water").map { WaterValue($0) }
        food = o.object("food").map { FoodSummary($0) }
        training = o.object("training").map { TrainingSummary($0) }
        weight = o.object("weight").map { WeightSummary($0) }
        progress = o.object("progress").map { ProgressSummary($0) }
        var actions: [String: NavigationTarget] = [:]
        if let actionObject = o.object("actions") {
            for (key, value) in actionObject.values {
                if let target = NavigationTarget(json: value) { actions[key] = target }
            }
        }
        self.actions = actions
        raw = json
    }
}

public struct OverviewTab: Equatable, Sendable, Identifiable {
    public var id: String
    public var icon: String?
    public var labelKey: String?

    public init(id: String, icon: String? = nil, labelKey: String? = nil) {
        self.id = id
        self.icon = icon
        self.labelKey = labelKey
    }

    init?(json: JSONValue) {
        let o = Loose(json)
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.init(id: id, icon: o.string("icon"), labelKey: o.string("labelKey"))
    }
}

/// `{kcal,p,c,f}`; `nil` = unbekannt.
public struct MacroValues: Equatable, Sendable {
    public var kcal: Double?
    public var p: Double?
    public var c: Double?
    public var f: Double?

    public init(kcal: Double? = nil, p: Double? = nil, c: Double? = nil, f: Double? = nil) {
        self.kcal = kcal
        self.p = p
        self.c = c
        self.f = f
    }

    init(_ o: Loose) {
        self.init(kcal: o.number("kcal"), p: o.number("p"), c: o.number("c"), f: o.number("f"))
    }

    public subscript(key: String) -> Double? {
        switch key {
        case "kcal": return kcal
        case "p": return p
        case "c": return c
        case "f": return f
        default: return nil
        }
    }
}

public struct OverviewGoals: Equatable, Sendable {
    public var values: MacroValues?
    public var mode: String?
    public var macroMode: String?
    public var calorieMode: String?
    public var source: String?

    init(_ o: Loose) {
        values = o.object("values").map { MacroValues($0) }
        mode = o.string("mode")
        macroMode = o.string("macroMode")
        calorieMode = o.string("calorieMode")
        source = o.string("source")
    }
}

public struct EnergyFacts: Equatable, Sendable {
    public var hasGoal: Bool
    public var over: Bool
    /// Ungekappter Ringwert; die Darstellung begrenzt ihn auf 0–100.
    public var percent: Double
    /// Positiver Rest/Überschuss bzw. gegessen ohne Ziel (bereits gerundet).
    public var displayValue: Double?
    /// `energy.left | energy.over | energy.noGoal`.
    public var captionKey: String

    init?(_ o: Loose) {
        guard let captionKey = o.string("captionKey") else { return nil }
        self.captionKey = captionKey
        hasGoal = o.bool("hasGoal") ?? false
        over = o.bool("over") ?? false
        percent = o.number("percent") ?? 0
        displayValue = o.number("displayValue")
    }

    /// Für den Ring wie `dsRing`.
    public var ringFraction: Double {
        min(max(percent, 0), 100) / 100
    }
}

public struct MacroBar: Equatable, Sendable {
    public var over: Bool
    /// Balkenprozent wie `dsMacroRows`, höchstens 100.
    public var percent: Double

    init(_ o: Loose) {
        over = o.bool("over") ?? false
        percent = min(max(o.number("percent") ?? 0, 0), 100)
    }
}

public struct MicroValue: Equatable, Sendable, Identifiable {
    public var key: String
    public var labelKey: String?
    public var unit: String?
    /// `nil`, solange kein Eintrag einen Wert kennt (`known == 0`). Ein bekannter Nullwert bleibt `0`.
    public var value: Double?
    public var known: Int
    public var total: Int
    public var target: Double?
    /// `custom | reference | nil`.
    public var targetSource: String?

    public var id: String { key }

    init(key: String, _ o: Loose) {
        self.key = key
        labelKey = o.string("labelKey")
        unit = o.string("unit")
        known = o.int("known") ?? 0
        total = o.int("total") ?? 0
        // Ohne bekannte Einträge gibt es keinen Wert, auch wenn das Feld eine Zahl trüge.
        value = known > 0 ? o.number("value") : nil
        target = o.number("target")
        targetSource = o.string("targetSource")
    }

    public var knowledge: Knowledge { Knowledge(known: known, total: total, hasValue: value != nil) }
}

/// Wie vollständig ein Tageswert bekannt ist.
public enum Knowledge: Equatable, Sendable {
    /// Keine Einträge an diesem Tag.
    case noEntries
    /// Einträge vorhanden, aber keiner kennt den Wert.
    case unknown
    /// Nur ein Teil der Einträge kennt den Wert.
    case partial(known: Int, total: Int)
    case complete

    init(known: Int, total: Int, hasValue: Bool) {
        if total <= 0 { self = hasValue ? .complete : .noEntries }
        else if known <= 0 || !hasValue { self = .unknown }
        else if known < total { self = .partial(known: known, total: total) }
        else { self = .complete }
    }
}

public struct WaterValue: Equatable, Sendable {
    /// ml; `nil` ohne bekannte Werte.
    public var value: Double?
    /// Bisherige Web-Anzeige (auch `0` bei unbekannt).
    public var displayValue: Double?
    public var known: Int
    public var total: Int
    public var target: Double?
    /// ml aus bestehenden Getränkeschätzungen (`0` = keine).
    public var estimated: Double
    public var unknownDrinks: Int

    init(_ o: Loose) {
        known = o.int("known") ?? 0
        total = o.int("total") ?? 0
        value = o.number("value")
        displayValue = o.number("displayValue")
        target = o.number("target")
        estimated = o.number("estimated") ?? 0
        unknownDrinks = o.int("unknownDrinks") ?? 0
    }

    public var knowledge: Knowledge { Knowledge(known: known, total: total, hasValue: value != nil) }
}

public struct FoodEntrySummary: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var amount: Double?
    /// Exakt wie im Web: `ml` oder `g`.
    public var unit: String
    public var kcal: Double?
    public var meal: String?

    init?(json: JSONValue) {
        let o = Loose(json)
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        amount = o.number("amount")
        unit = o.string("unit") == "ml" ? "ml" : "g"
        kcal = o.number("kcal")
        meal = o.string("meal")
    }
}

public struct FoodSummary: Equatable, Sendable {
    /// Alle Einträge des Tages (auch nicht übertragene).
    public var total: Int
    public var entries: [FoodEntrySummary]
    /// Die letzten fünf wie im Web, neuester zuerst.
    public var previewIds: [String]
    public var omitted: Int
    public var complete: Bool?

    init(_ o: Loose) {
        entries = o.array("entries").compactMap(FoodEntrySummary.init(json:))
        total = o.int("total") ?? entries.count
        previewIds = o.array("previewIds").compactMap(\.stringValue)
        omitted = o.int("omitted") ?? 0
        complete = o.bool("complete")
    }

    /// Vorschau in Web-Reihenfolge; fehlt `previewIds`, die ersten fünf übertragenen.
    public var preview: [FoodEntrySummary] {
        guard !previewIds.isEmpty else { return Array(entries.prefix(5)) }
        let byID = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return previewIds.compactMap { byID[$0] }
    }
}

public struct WorkoutSummary: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String?
    public var date: String?
    public var routineId: String?

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name")
        date = o.string("date")
        routineId = o.string("routineId")
    }
}

public struct RunSummary: Equatable, Sendable {
    /// Datenschlüssel (z. B. `run`), kein übersetzter Name.
    public var type: String?
    public var elapsedSeconds: Double?
    public var paused: Bool
    /// Bestehende Web-Anzeige der Uhr (Momentaufnahme).
    public var clock: String?

    init(_ o: Loose) {
        type = o.string("type")
        elapsedSeconds = o.number("elapsedSeconds")
        paused = o.bool("paused") ?? false
        clock = o.string("clock")
    }
}

public struct RoutineSummary: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var exerciseCount: Int?

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        exerciseCount = o.int("exerciseCount")
    }
}

public struct WeekActivity: Equatable, Sendable {
    public var start: String?
    public var end: String?
    public var sessions: Int?
    public var workouts: Int?
    public var activities: Int?
    public var activeMinutes: Double?
    public var minutesGoal: Double?
    public var runKm: Double?

    init(_ o: Loose) {
        start = o.string("start")
        end = o.string("end")
        sessions = o.int("sessions")
        workouts = o.int("workouts")
        activities = o.int("activities")
        activeMinutes = o.number("activeMinutes")
        minutesGoal = o.number("minutesGoal")
        runKm = o.number("runKm")
    }
}

public struct TrainingSummary: Equatable, Sendable {
    public var activeWorkout: WorkoutSummary?
    public var activeRun: RunSummary?
    /// Höchstens drei wie `dsTrainingGroup`.
    public var routines: [RoutineSummary]
    public var routineCount: Int
    public var lastWorkout: WorkoutSummary?
    public var nextRoutine: RoutineSummary?
    public var week: WeekActivity?

    init(_ o: Loose) {
        activeWorkout = o.object("activeWorkout").flatMap { WorkoutSummary($0) }
        activeRun = o.object("activeRun").map { RunSummary($0) }
        routines = o.array("routines").compactMap { RoutineSummary(Loose($0)) }
        routineCount = o.int("routineCount") ?? routines.count
        lastWorkout = o.object("lastWorkout").flatMap { WorkoutSummary($0) }
        nextRoutine = o.object("nextRoutine").flatMap { RoutineSummary($0) }
        week = o.object("week").map { WeekActivity($0) }
    }
}

public struct WeightSummary: Equatable, Sendable {
    public struct Point: Equatable, Sendable {
        public var id: String?
        public var date: String
        public var kg: Double
    }

    public struct WeeklyMean: Equatable, Sendable {
        public var start: String
        public var kg: Double
        public var count: Int?
    }

    public struct WeeklyChange: Equatable, Sendable {
        public var kg: Double
        public var from: String?
        public var to: String?
    }

    /// Jüngste Messung bis heute (kein Profilgewicht).
    public var current: Point?
    public var trend: Point?
    public var weeklyMean: WeeklyMean?
    public var weeklyChange: WeeklyChange?

    init(_ o: Loose) {
        current = o.object("current").flatMap(Self.point)
        trend = o.object("trend").flatMap(Self.point)
        if let mean = o.object("weeklyMean"), let start = mean.string("start"), let kg = mean.number("kg") {
            weeklyMean = WeeklyMean(start: start, kg: kg, count: mean.int("count"))
        }
        if let change = o.object("weeklyChange"), let kg = change.number("kg") {
            weeklyChange = WeeklyChange(kg: kg, from: change.string("from"), to: change.string("to"))
        }
    }

    private static func point(_ o: Loose) -> Point? {
        guard let date = o.string("date"), let kg = o.number("kg") else { return nil }
        return Point(id: o.string("id"), date: date, kg: kg)
    }
}

public struct ProgressSummary: Equatable, Sendable {
    /// Zeitraum wie im Web (z. B. `"90"`), als Text.
    public var period: String?
    public var lines: [String: Bool]
    /// Anzahl übertragener Chart-Tage (die Reihen selbst rendert M3 nicht nativ).
    public var rowCount: Int
    public var total: Int
    public var omitted: Int
    /// Web-Ausweichziel für den Indexchart (`{page:'home',web:true}`).
    public var navigation: NavigationTarget?

    init(_ o: Loose) {
        if let text = o.string("period") { period = text }
        else if let number = o.number("period") { period = JSONValue.formatNumber(number) }
        var lines: [String: Bool] = [:]
        for (key, value) in o.object("lines")?.values ?? [:] {
            if let flag = value.boolValue { lines[key] = flag }
        }
        self.lines = lines
        rowCount = o.array("rows").count
        total = o.int("total") ?? rowCount
        omitted = o.int("omitted") ?? 0
        navigation = o.values["navigation"].flatMap(NavigationTarget.init(json:))
    }
}

// MARK: - Nachsichtiger Leser

/// Fehlende Felder und falsche Typen sind `nil` (unbekannt); nur endliche Zahlen.
struct Loose {
    let values: [String: JSONValue]

    init(_ value: JSONValue?) {
        values = value?.objectValue ?? [:]
    }

    init(values: [String: JSONValue]) {
        self.values = values
    }

    func number(_ key: String) -> Double? {
        guard let number = values[key]?.doubleValue, number.isFinite else { return nil }
        return number
    }

    func int(_ key: String) -> Int? {
        values[key]?.intValue
    }

    func string(_ key: String) -> String? {
        values[key]?.stringValue
    }

    func bool(_ key: String) -> Bool? {
        values[key]?.boolValue
    }

    func object(_ key: String) -> Loose? {
        values[key]?.objectValue.map { Loose(values: $0) }
    }

    func array(_ key: String) -> [JSONValue] {
        values[key]?.arrayValue ?? []
    }
}
