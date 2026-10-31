import Foundation

// M5: `projection{name:"progress"}` und `progressResult` aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §10.
//
// Regeln wie bei Übersicht und Training: Umschlag streng (`projectionSeq`, `ownerPending`, `progress` bzw.
// `requestId`/`kind`/`ok` Pflicht), Inhalt nachsichtig. Fehlend oder falscher Typ = unbekannt (`nil`), nie erfundene
// Nullen und nie aufgefüllte Chart-Tage. `raw` erhält die vollständige Nachricht verlustfrei (auch unbekannte Felder).
// Native rechnet keine Kennzahlen nach: Level/XP, Serien, e1RM, Pace, kcal, Summen und Rundung kommen fertig aus dem Web.

public struct ProgressProjectionMessage: Equatable, Sendable {
    public static let progressName = "progress"

    /// Dokumentlokal, gemeinsam mit Übersicht/Training hochgezählt; Native vergleicht je Projektionsname.
    public var projectionSeq: Int
    /// Profilsnapshot-Nummer beim Versand (nur Kontext; darf hinter dem Snapshot liegen).
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var reason: String
    public var progress: ProgressProjection
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.nonEmptyString("name") == Self.progressName else { throw BridgeDecodingError.invalidField("name") }
        projectionSeq = try fields.int("projectionSeq")
        guard projectionSeq >= 0 else { throw BridgeDecodingError.invalidField("projectionSeq") }
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        reason = try fields.optionalString("reason") ?? "unknown"
        guard let progress = fields["progress"] else { throw BridgeDecodingError.missingField("progress") }
        self.progress = try ProgressProjection(json: progress)
        raw = json
    }

    public var json: JSONValue { raw }
}

extension ProgressProjectionMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

// MARK: - Nutzlast

public struct ProgressProjection: Equatable, Sendable {
    /// `de` oder `en` (Standard `de`).
    public var language: String
    public var locale: String?
    /// Heutiger Web-Tag (`today()`), `nil` bei ungültigem Wert.
    public var today: String?
    public var settings: ProgressSettings
    public var identity: ProgressIdentity?
    public var stats: WorkoutStatsSummary?
    /// Höchstens 60 identifizierbare Bibliotheksübungen; `recordCount` zählt alle.
    public var records: [StrengthRecord]
    public var recordCount: Int
    public var metrics: ProgressMetrics?
    public var chart: ProgressChart?
    /// Aktuelle Web-Auswahl (`recapMode/recapOffset`).
    public var recap: ProgressRecap?
    /// Aktuelle Woche und aktueller Monat.
    public var recaps: [ProgressRecap]
    public var activity: ActivityView?
    public var weeklyGoals: WeeklyGoals?
    public var running: RunningSummary?
    public var runRecords: [RunRecord]
    public var omitted: ProgressOmitted
    /// Feste Web-Auswege (`calendar`, `progress`, `records`, `weeklyGoals`), nur gültige Ziele.
    public var navigation: [String: ProgressNavigation]
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        guard case .object = json else { throw BridgeDecodingError.invalidField("progress") }
        let o = Loose(json)
        language = o.string("language") == "en" ? "en" : "de"
        locale = o.string("locale")
        today = o.string("today").flatMap { WeightDay.isValid($0) ? $0 : nil }
        settings = ProgressSettings(o.object("settings"))
        identity = o.object("identity").map(ProgressIdentity.init)
        stats = o.object("stats").map(WorkoutStatsSummary.init)
        records = o.array("records").compactMap { StrengthRecord(Loose($0)) }
        recordCount = o.int("recordCount") ?? records.count
        metrics = o.object("metrics").map(ProgressMetrics.init)
        chart = o.object("chart").map(ProgressChart.init)
        recap = o.object("recap").flatMap(ProgressRecap.init)
        recaps = o.array("recaps").compactMap { ProgressRecap(Loose($0)) }
        activity = o.object("activity").flatMap(ActivityView.init)
        weeklyGoals = o.object("weeklyGoals").map(WeeklyGoals.init)
        running = o.object("running").map(RunningSummary.init)
        runRecords = o.array("runRecords").compactMap { RunRecord(Loose($0)) }
        omitted = ProgressOmitted(o.object("omitted"))
        var navigation: [String: ProgressNavigation] = [:]
        for (key, value) in o.object("navigation")?.values ?? [:] {
            if let target = ProgressNavigation(json: value) { navigation[key] = target }
        }
        self.navigation = navigation
        raw = json
    }

    public func recap(mode: String) -> ProgressRecap? {
        recaps.first { $0.mode == mode }
    }

    public func record(id: String) -> StrengthRecord? {
        records.first { $0.id == id }
    }
}

/// Gespeicherte Ansichtswerte (kompakt, **nicht** als `expect` verwenden: dafür den verlustfreien Snapshot).
public struct ProgressSettings: Equatable, Sendable {
    public var group: String?
    public var range: String?
    public var metric: String?
    public var chartPeriod: String?
    /// Nur gespeicherte Kurvenschalter; ein fehlender Schalter heißt im Web „an“.
    public var chartLines: [String: Bool]

    init(_ o: Loose?) {
        let view = o?.object("progressView")
        group = view?.string("group")
        range = view?.string("range")
        metric = view?.string("metric")
        chartPeriod = Self.period(o, "chartPeriod")
        var lines: [String: Bool] = [:]
        for (key, value) in o?.object("chartLines")?.values ?? [:] {
            if let flag = value.boolValue { lines[key] = flag }
        }
        chartLines = lines
    }

    static func period(_ o: Loose?, _ key: String) -> String? {
        if let text = o?.string(key) { return text }
        if let number = o?.number(key) { return JSONValue.formatNumber(number) }
        return nil
    }
}

/// `xpProgress(totalWorkoutXP())`, `dailyWorkoutStreak()`, `trainingStreak()`.
public struct ProgressIdentity: Equatable, Sendable {
    public var level: Int?
    public var current: Double?
    public var needed: Double?
    public var total: Double?
    public var streak: Int?
    public var weekStreak: Int?

    init(_ o: Loose) {
        level = o.int("level")
        current = o.number("current")
        needed = o.number("needed")
        total = o.number("total")
        streak = o.int("streak")
        weekStreak = o.int("weekStreak")
    }
}

/// `workoutStats` des Webs; `average`/`duration` in Sekunden, Anzeige über die Clock-Felder.
public struct WorkoutStatsSummary: Equatable, Sendable {
    public var count: Int?
    public var sets: Int?
    public var reps: Int?
    /// Bereits `n`-gerundet.
    public var volume: Double?
    public var duration: Double?
    /// `nil` = unbekannte Durchschnittsdauer.
    public var average: Double?
    public var timed: Int?
    public var averageClock: String?
    public var durationClock: String?

    init(_ o: Loose) {
        count = o.int("count")
        sets = o.int("sets")
        reps = o.int("reps")
        volume = o.number("volume")
        duration = o.number("duration")
        average = o.number("average")
        timed = o.int("timed")
        averageClock = o.string("averageClock")
        durationClock = o.string("durationClock")
    }
}

public struct E1RMPoint: Equatable, Sendable {
    public var date: String?
    public var e1rm: Double
}

public struct HeaviestSet: Equatable, Sendable {
    public var date: String?
    public var kg: Double?
    public var reps: Double?
}

public struct StrengthRank: Equatable, Sendable {
    public var level: Int?
    /// Bereits übersetzter Web-Text.
    public var name: String?
    public var percent: Double?
}

/// Rekord einer Bibliotheksübung (`strengthRecord`, `levelFor`, `rankForecast`, `progression`).
public struct StrengthRecord: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var target: Double?
    public var best: E1RMPoint?
    public var heaviest: HeaviestSet?
    public var rank: StrengthRank?
    /// Web-Texte in `language`.
    public var forecast: String?
    public var suggestion: String?

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        target = o.number("target")
        if let best = o.object("best"), let e1rm = best.number("e1rm") {
            self.best = E1RMPoint(date: best.string("date"), e1rm: e1rm)
        }
        heaviest = o.object("heaviest").map(Self.heaviest)
        rank = o.object("rank").map(Self.rank)
        forecast = o.string("forecast")
        suggestion = o.string("suggestion")
    }

    static func heaviest(_ o: Loose) -> HeaviestSet {
        HeaviestSet(date: o.string("date"), kg: o.number("kg"), reps: o.number("reps"))
    }

    static func rank(_ o: Loose) -> StrengthRank {
        StrengthRank(level: o.int("level"), name: o.string("name"), percent: o.number("percent"))
    }
}

/// `{key, label}` einer Web-Auswahl (Gruppe, Zeitraum).
public struct KeyLabel: Equatable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var id: String { key }

    init?(_ o: Loose) {
        guard let key = o.string("key"), !key.isEmpty else { return nil }
        self.key = key
        label = o.string("label") ?? key
    }
}

public struct MetricDefinition: Equatable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var unit: String
    public var note: String?
    public var id: String { key }

    init?(_ o: Loose) {
        guard let key = o.string("key"), !key.isEmpty else { return nil }
        self.key = key
        label = o.string("label") ?? key
        unit = o.string("unit") ?? ""
        note = o.string("note")
    }
}

/// Ein echter Messpunkt (kein Punkt für unbekannte Werte).
public struct DatedValue: Equatable, Sendable, Identifiable {
    public var index: Int
    public var date: String
    public var value: Double
    public var id: Int { index }

    public init(index: Int, date: String, value: Double) {
        self.index = index
        self.date = date
        self.value = value
    }

    /// Punkte mit gültigem Tag und endlichem Wert; andere werden ausgelassen, nie durch 0 ersetzt.
    static func points(_ values: [JSONValue], key: String = "value") -> [DatedValue] {
        var result: [DatedValue] = []
        for value in values {
            let o = Loose(value)
            guard let date = o.string("date"), WeightDay.isValid(date), let number = o.number(key) else { continue }
            result.append(DatedValue(index: result.count, date: date, value: number))
        }
        return result
    }
}

/// Web-Explorer (`progressExplorer`): Auswahl, Definitionen und gefilterte Punkte.
public struct ProgressMetrics: Equatable, Sendable {
    public var group: String?
    public var range: String?
    public var metric: String?
    public var groups: [KeyLabel]
    public var ranges: [KeyLabel]
    public var definitions: [MetricDefinition]
    /// Höchstens 400, aufsteigend.
    public var points: [DatedValue]
    /// Anzahl **aller** gefilterten Punkte (auch bei Kürzung).
    public var total: Int
    public var omitted: Int
    public var definitionsOmitted: Int
    public var latest: Double?
    public var average: Double?
    public var high: Double?

    init(_ o: Loose) {
        group = o.string("group")
        range = o.string("range")
        metric = o.string("metric")
        groups = o.array("groups").compactMap { KeyLabel(Loose($0)) }
        ranges = o.array("ranges").compactMap { KeyLabel(Loose($0)) }
        definitions = o.array("definitions").compactMap { MetricDefinition(Loose($0)) }
        points = DatedValue.points(o.array("points"))
        total = o.int("total") ?? points.count
        omitted = o.int("omitted") ?? 0
        definitionsOmitted = o.int("definitionsOmitted") ?? 0
        latest = o.number("latest")
        average = o.number("average")
        high = o.number("high")
    }

    public var selectedDefinition: MetricDefinition? {
        guard let metric else { return nil }
        return definitions.first { $0.key == metric }
    }
}

/// Eine Zeile aus `trendData()`; `nil` = an diesem Tag nicht gemessen (nie 0).
public struct TrendRow: Equatable, Sendable, Identifiable {
    public var date: String
    public var weight: Double?
    public var strength: Double?
    public var kcal: Double?
    public var id: String { date }
}

public struct ProgressChart: Equatable, Sendable {
    public var period: String?
    public var lines: [String: Bool]
    /// Nur wirkliche Tage (höchstens 400), aufsteigend; fehlende Tage werden nicht aufgefüllt.
    public var rows: [TrendRow]
    public var total: Int
    public var omitted: Int

    init(_ o: Loose) {
        period = ProgressSettings.period(o, "period")
        var lines: [String: Bool] = [:]
        for (key, value) in o.object("lines")?.values ?? [:] {
            if let flag = value.boolValue { lines[key] = flag }
        }
        self.lines = lines
        rows = o.array("rows").compactMap { value in
            let row = Loose(value)
            guard let date = row.string("date"), WeightDay.isValid(date) else { return nil }
            return TrendRow(date: date, weight: row.number("weight"), strength: row.number("strength"), kcal: row.number("kcal"))
        }
        total = o.int("total") ?? rows.count
        omitted = o.int("omitted") ?? 0
    }
}

public struct MuscleCount: Equatable, Sendable, Identifiable {
    public var key: String
    /// Web-Anzeigetext in `language`.
    public var label: String
    public var sets: Double
    public var id: String { key }

    init?(_ o: Loose) {
        guard let key = o.string("key"), !key.isEmpty else { return nil }
        self.key = key
        label = o.string("label") ?? key
        sets = o.number("sets") ?? 0
    }
}

/// Aktivitätssumme (`activityPeriodStats`): nur bekannte Zeiten/kcal summiert, unbekannte Anteile gezählt.
public struct ActivitySummary: Equatable, Sendable {
    public var count: Int?
    public var durationSeconds: Double?
    /// Web-Anzeige (`actDuration`).
    public var durationLabel: String?
    public var minutes: Double?
    /// Aktivitätskarte (0,1 km).
    public var distanceKm: Double?
    /// Wie `activityRecapHtml`.
    public var recapDistanceKm: Double?
    /// Geschätzte Brutto-kcal.
    public var kcal: Double?
    public var unknownDurationCount: Int
    public var unknownKcalCount: Int

    init(_ o: Loose) {
        count = o.int("count")
        durationSeconds = o.number("durationSeconds")
        durationLabel = o.string("durationLabel")
        minutes = o.number("minutes")
        distanceKm = o.number("distanceKm")
        recapDistanceKm = o.number("recapDistanceKm")
        kcal = o.number("kcal")
        unknownDurationCount = o.int("unknownDurationCount") ?? 0
        unknownKcalCount = o.int("unknownKcalCount") ?? 0
    }
}

/// Woche bzw. Monat (`recapRange`/`activityPeriodRange`); `offset` `nil` bei Query-Recaps.
public struct ProgressRecap: Equatable, Sendable, Identifiable {
    public var mode: String
    public var offset: Int?
    public var start: String
    public var end: String
    public var stats: WorkoutStatsSummary?
    public var xp: Double?
    public var muscles: [MuscleCount]
    /// Bei gekürzten Query-Recaps.
    public var musclesOmitted: Int
    public var activity: ActivitySummary?
    public var id: String { mode + start }

    init?(_ o: Loose) {
        guard let mode = o.string("mode"), let start = o.string("start"), WeightDay.isValid(start),
              let end = o.string("end"), WeightDay.isValid(end) else { return nil }
        self.mode = mode
        offset = o.int("offset")
        self.start = start
        self.end = end
        stats = o.object("stats").map(WorkoutStatsSummary.init)
        xp = o.number("xp")
        muscles = o.array("muscles").compactMap { MuscleCount(Loose($0)) }
        musclesOmitted = o.int("musclesOmitted") ?? 0
        activity = o.object("activity").map(ActivitySummary.init)
    }
}

/// Kompakte Trainings- oder Aktivitätszeile (`actRow`). Dauer/kcal `nil` = unbekannt.
public struct ActivityEntry: Equatable, Sendable, Identifiable {
    /// `workout` oder `activity`.
    public var kind: String
    /// Datenschlüssel (`gym`, `run`, …), kein übersetzter Name.
    public var type: String
    public var entryId: String
    public var date: String
    /// Name des Workouts bzw. übersetzter Aktivitätstyp.
    public var name: String
    public var durationSeconds: Double?
    public var durationClock: String?
    public var distanceKm: Double?
    public var kcal: Double?
    public var estimatedKcal: Bool

    public var id: String { kind + ":" + entryId }
    public var isWorkout: Bool { kind == "workout" }

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty, let date = o.string("date"), WeightDay.isValid(date) else { return nil }
        let kind = o.string("kind") ?? "activity"
        entryId = id
        self.date = date
        self.kind = kind
        type = o.string("type") ?? (kind == "workout" ? "gym" : "run")
        name = o.string("name") ?? ""
        durationSeconds = o.number("durationSeconds")
        durationClock = o.string("durationClock")
        distanceKm = o.number("distanceKm")
        kcal = o.number("kcal")
        estimatedKcal = o.bool("estimatedKcal") ?? true
    }
}

public struct ActivityTypeLabel: Equatable, Sendable, Identifiable {
    public var type: String
    public var label: String
    public var id: String { type }

    init?(_ o: Loose) {
        guard let type = o.string("type"), !type.isEmpty else { return nil }
        self.type = type
        label = o.string("label") ?? type
    }
}

public struct ActivityTypeSummary: Equatable, Sendable, Identifiable {
    public var type: String
    public var label: String
    public var summary: ActivitySummary
    public var id: String { type }

    init?(_ o: Loose) {
        guard let type = o.string("type"), !type.isEmpty else { return nil }
        self.type = type
        label = o.string("label") ?? type
        summary = ActivitySummary(o)
    }
}

/// Aktivitätsauswertung (`activityPeriodStats`/`activityEntries`).
public struct ActivityView: Equatable, Sendable {
    public var mode: String
    public var offset: Int?
    /// `all`, `gym` oder gespeicherter Typ.
    public var filter: String
    public var start: String
    public var end: String
    public var summary: ActivitySummary?
    public var activeDays: [String]
    public var types: [ActivityTypeLabel]
    public var byType: [ActivityTypeSummary]
    /// Letzte 60 (Projektion) bzw. gekürzte Zeilen, neueste zuerst.
    public var entries: [ActivityEntry]
    public var omitted: Int
    public var typesOmitted: Int

    init?(_ o: Loose) {
        guard let start = o.string("start"), WeightDay.isValid(start), let end = o.string("end"), WeightDay.isValid(end) else {
            return nil
        }
        self.start = start
        self.end = end
        mode = o.string("mode") ?? "week"
        offset = o.int("offset")
        filter = o.string("filter") ?? "all"
        summary = o.object("summary").map(ActivitySummary.init)
        activeDays = o.array("activeDays").compactMap(\.stringValue).filter(WeightDay.isValid)
        types = o.array("types").compactMap { ActivityTypeLabel(Loose($0)) }
        byType = o.array("byType").compactMap { ActivityTypeSummary(Loose($0)) }
        entries = o.array("entries").compactMap { ActivityEntry(Loose($0)) }
        omitted = o.int("omitted") ?? 0
        typesOmitted = o.int("typesOmitted") ?? 0
    }
}

/// Wochenziele: `runGoalKm()`/`activeMinutesGoal()`; Minuten abgerundet, km auf 0,1 wie `activityWeekLine`.
public struct WeeklyGoals: Equatable, Sendable {
    /// `nil` = kein km-Ziel.
    public var weeklyGoalKm: Double?
    /// `0` = kein Minutenziel.
    public var weekMinutesGoal: Double?
    public var start: String?
    public var end: String?
    public var activeMinutes: Double?
    public var runKm: Double?

    init(_ o: Loose) {
        weeklyGoalKm = o.number("weeklyGoalKm")
        weekMinutesGoal = o.number("weekMinutesGoal")
        start = o.string("start")
        end = o.string("end")
        activeMinutes = o.number("activeMinutes")
        runKm = o.number("runKm")
    }

    public var hasKmGoal: Bool { (weeklyGoalKm ?? 0) > 0 }
    public var hasMinutesGoal: Bool { (weekMinutesGoal ?? 0) > 0 }
}

public struct RunWeek: Equatable, Sendable, Identifiable {
    public var start: String
    public var end: String?
    public var km: Double
    public var id: String { start }
}

/// Laufkarte (`runProgressCard`); Pace kommt als fertiger Web-Text.
public struct RunningSummary: Equatable, Sendable {
    public struct Longest: Equatable, Sendable {
        public var id: String
        public var date: String?
        public var distanceKm: Double?
    }

    public struct Fastest: Equatable, Sendable {
        public var id: String
        public var date: String?
        public var paceText: String?
    }

    public var count: Int?
    public var totalKm: Double?
    public var monthKm: Double?
    public var monthPaceText: String?
    public var longest: Longest?
    public var fastest: Fastest?
    public var weeks: [RunWeek]

    init(_ o: Loose) {
        count = o.int("count")
        totalKm = o.number("totalKm")
        monthKm = o.number("monthKm")
        monthPaceText = o.string("monthPaceText")
        if let longest = o.object("longest"), let id = longest.string("id"), !id.isEmpty {
            self.longest = Longest(id: id, date: longest.string("date"), distanceKm: longest.number("distanceKm"))
        }
        if let fastest = o.object("fastest"), let id = fastest.string("id"), !id.isEmpty {
            self.fastest = Fastest(id: id, date: fastest.string("date"), paceText: fastest.string("paceText"))
        }
        weeks = o.array("weeks").compactMap { value in
            let week = Loose(value)
            guard let start = week.string("start"), WeightDay.isValid(start), let km = week.number("km") else { return nil }
            return RunWeek(start: start, end: week.string("end"), km: km)
        }
    }
}

/// `runBestEfforts()`: 1/5/10/21 volle Kilometer.
public struct RunRecord: Equatable, Sendable, Identifiable {
    public var km: Double
    public var seconds: Double?
    public var clock: String?
    public var runId: String?
    public var date: String?
    public var id: Double { km }

    init?(_ o: Loose) {
        guard let km = o.number("km") else { return nil }
        self.km = km
        seconds = o.number("seconds")
        clock = o.string("clock")
        runId = o.string("runId")
        date = o.string("date")
    }
}

public struct ProgressOmitted: Equatable, Sendable {
    public var records: Int
    public var muscles: Int
    public var activityTypes: Int

    init(_ o: Loose?) {
        records = o?.int("records") ?? 0
        muscles = o?.int("muscles") ?? 0
        activityTypes = o?.int("activityTypes") ?? 0
    }

    public var any: Bool { records > 0 || muscles > 0 || activityTypes > 0 }
}

// MARK: - Web-Auswege (§10.5)

/// `pulsNativeNavigate({action, id?, web:true})` für Kalender/Fortschritt. Nur die Whitelist aus §10.5;
/// Aktionen mit Ziel brauchen eine ID (1–256 UTF-16-Einheiten).
public struct ProgressNavigation: Equatable, Hashable, Sendable {
    public static let actions: Set<String> = [
        "calendar", "progress", "records", "reviewWorkout", "shareWorkout", "editWorkout",
        "exerciseHistory", "exerciseSettings", "weeklyGoals", "runDetail", "editRun",
    ]
    public static let actionsWithID: Set<String> = [
        "reviewWorkout", "shareWorkout", "editWorkout", "exerciseHistory", "exerciseSettings", "runDetail", "editRun",
    ]

    public var action: String
    public var id: String?

    public init?(action: String, id: String? = nil) {
        guard Self.actions.contains(action) else { return nil }
        if Self.actionsWithID.contains(action) {
            guard let id, ProgressQueryRequest.isValidID(id) else { return nil }
            self.id = id
        } else {
            self.id = nil
        }
        self.action = action
    }

    init?(json: JSONValue) {
        let o = Loose(json)
        guard let action = o.string("action") else { return nil }
        self.init(action: action, id: o.string("id"))
    }

    /// Argument für `pulsNativeNavigate`; `web:true` gilt nur für diesen Aufruf.
    public var json: JSONValue {
        var object: [String: JSONValue] = ["action": .string(action), "web": .bool(true)]
        if let id { object["id"] = .string(id) }
        return .object(object)
    }

    /// Seitenwechsel ins Web-Training (`trainTab`), sonst Web-Dialog/Review über der aktuellen Seite.
    public var changesPage: Bool { ["calendar", "progress", "records", "editWorkout"].contains(action) }
}

// MARK: - Kalendermonat

/// `YYYY-MM` streng gregorianisch. Nur Kalendergeometrie, keine Kennzahlen.
public enum CalendarMonth {
    public static func isValid(_ month: String) -> Bool {
        month.utf16.count == 7 && WeightDay.isValid(month + "-01")
    }

    public static func of(day: String) -> String? {
        guard WeightDay.isValid(day) else { return nil }
        return String(day.prefix(7))
    }

    public static func firstDay(_ month: String) -> String? {
        isValid(month) ? month + "-01" : nil
    }

    public static func adding(_ months: Int, to month: String) -> String? {
        guard isValid(month), let year = Int(month.prefix(4)), let number = Int(month.suffix(2)) else { return nil }
        let index = year * 12 + (number - 1) + months
        let newYear = Int((Double(index) / 12).rounded(.down))
        let newMonth = index - newYear * 12 + 1
        guard (1...9999).contains(newYear) else { return nil }
        return String(format: "%04d-%02d", newYear, newMonth)
    }

    /// Anzahl Tage (28–31).
    public static func dayCount(_ month: String) -> Int? {
        guard let first = firstDay(month).flatMap(WeightDay.dayNumber),
              let next = adding(1, to: month).flatMap(firstDay).flatMap(WeightDay.dayNumber) else { return nil }
        return next - first
    }

    /// Leere Zellen vor dem 1. bei Wochenbeginn Montag (wie `trainingCalendar`: `(getDay()+6)%7`).
    public static func mondayOffset(_ month: String) -> Int? {
        guard let first = firstDay(month).flatMap(WeightDay.dayNumber) else { return nil }
        let weekday = ((first + 4) % 7 + 7) % 7
        return (weekday + 6) % 7
    }
}

// MARK: - Queries (§10.3)

/// Argument für `window.pulsNativeProgressQuery(request)`. Grenzen aus §10.3 schon nativ geprüft: ungültige
/// Anfragen entstehen gar nicht erst (das Web würde sie stumm ablehnen).
public struct ProgressQueryRequest: Equatable, Hashable, Sendable {
    public enum Kind: String, Sendable, CaseIterable {
        case month, workout, exercise, run
    }

    public var requestId: String
    public var kind: Kind
    public var month: String?
    public var day: String?
    public var activityMode: String?
    public var activityFilter: String?
    public var id: String?

    public static func isValidRequestID(_ id: String) -> Bool {
        !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && id.utf16.count <= 100
    }

    public static func isValidID(_ id: String) -> Bool {
        let count = id.utf16.count
        return count >= 1 && count <= 256
    }

    public static func isValidFilter(_ filter: String) -> Bool {
        let scalars = filter.unicodeScalars
        return (2...20).contains(scalars.count) && scalars.allSatisfy { $0 >= "a" && $0 <= "z" }
    }

    /// `month` (`YYYY-MM`), optional `day` im Monat (bestimmt die Wochen-Recap), `activityMode` `week|month`,
    /// `activityFilter` `all|gym|<typ>`.
    public static func month(_ month: String, day: String? = nil, activityMode: String? = nil, activityFilter: String? = nil,
                             requestId: String) -> ProgressQueryRequest? {
        guard isValidRequestID(requestId), CalendarMonth.isValid(month) else { return nil }
        if let day {
            guard WeightDay.isValid(day), day.hasPrefix(month + "-") else { return nil }
        }
        if let activityMode {
            guard activityMode == "week" || activityMode == "month" else { return nil }
        }
        if let activityFilter {
            guard isValidFilter(activityFilter) else { return nil }
        }
        return ProgressQueryRequest(requestId: requestId, kind: .month, month: month, day: day,
                                    activityMode: activityMode, activityFilter: activityFilter, id: nil)
    }

    /// `workout` (abgeschlossen), `exercise` (Bibliotheks-ID) oder `run` (Aktivitäts-ID).
    public static func detail(_ kind: Kind, id: String, requestId: String) -> ProgressQueryRequest? {
        guard kind != .month, isValidRequestID(requestId), isValidID(id) else { return nil }
        return ProgressQueryRequest(requestId: requestId, kind: kind, month: nil, day: nil,
                                    activityMode: nil, activityFilter: nil, id: id)
    }

    /// Nur die erlaubten Felder (das Web lehnt unbekannte Felder ab).
    public var json: JSONValue {
        var object: [String: JSONValue] = ["requestId": .string(requestId), "kind": .string(kind.rawValue)]
        if let month { object["month"] = .string(month) }
        if let day { object["day"] = .string(day) }
        if let activityMode { object["activityMode"] = .string(activityMode) }
        if let activityFilter { object["activityFilter"] = .string(activityFilter) }
        if let id { object["id"] = .string(id) }
        return .object(object)
    }

    /// Angefragtes Ziel ohne `requestId` (sichtbarer Monat/Detail).
    public var target: String {
        [kind.rawValue, month ?? id ?? "", day ?? "", activityMode ?? "", activityFilter ?? ""].joined(separator: "|")
    }
}

/// `{type:'progressResult', requestId, kind, ok, result | error}`. Kein Ack, kein Schreibnachweis.
public struct ProgressResultMessage: Equatable, Sendable {
    public var requestId: String
    public var kind: String
    /// Nur Kontext, kein Persistenznachweis.
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var language: String
    public var ok: Bool
    /// Bei `ok:false` (z. B. `gone`: Ziel nicht mehr vorhanden).
    public var error: AckError?
    public var result: ProgressQueryResult?
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        requestId = try fields.nonEmptyString("requestId")
        kind = try fields.nonEmptyString("kind")
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        language = (try fields.optionalString("language")) == "en" ? "en" : "de"
        ok = try fields.requiredBool("ok")
        if ok {
            guard let value = fields["result"], case .object = value else { throw BridgeDecodingError.invalidField("result") }
            result = try ProgressQueryResult(kind: kind, json: value)
            error = nil
        } else {
            result = nil
            if let value = fields["error"], case .object = value {
                error = try AckError(json: value)
            } else {
                error = AckError(code: .other("unknown"))
            }
        }
        raw = json
    }

    public var json: JSONValue { raw }

    /// Ziel existiert nicht mehr (`gone`).
    public var isGone: Bool { error?.code == .gone }
}

extension ProgressResultMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

public enum ProgressQueryResult: Equatable, Sendable {
    case month(CalendarMonthResult)
    case workout(WorkoutReviewResult)
    case exercise(ExerciseHistoryResult)
    case run(RunDetailResult)
    /// Künftige Arten bleiben lesbar erhalten.
    case unknown(JSONValue)

    init(kind: String, json: JSONValue) throws {
        switch kind {
        case "month": self = .month(try CalendarMonthResult(json: json))
        case "workout": self = .workout(try WorkoutReviewResult(json: json))
        case "exercise": self = .exercise(try ExerciseHistoryResult(json: json))
        case "run": self = .run(try RunDetailResult(json: json))
        default: self = .unknown(json)
        }
    }
}

public struct CalendarDayCount: Equatable, Sendable, Identifiable {
    public var date: String
    public var workouts: Int
    public var activities: Int
    public var id: String { date }
    public var total: Int { workouts + activities }
}

/// Monat aus dem Web-Kalender: alle echten Tage mit vollständigen Anzahlen, höchstens 200 Zeilen.
public struct CalendarMonthResult: Equatable, Sendable {
    public var month: String
    public var start: String
    public var end: String
    public var days: [CalendarDayCount]
    /// Aufsteigend nach Datum; bei `omitted > 0` unvollständig.
    public var entries: [ActivityEntry]
    public var total: Int
    public var omitted: Int
    public var stats: WorkoutStatsSummary?
    public var activity: ActivitySummary?
    public var monthRecap: ProgressRecap?
    public var weekRecap: ProgressRecap?
    public var activityView: ActivityView?
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let month = o.string("month"), CalendarMonth.isValid(month) else { throw BridgeDecodingError.invalidField("result.month") }
        let start = o.string("start") ?? month + "-01"
        self.month = month
        self.start = start
        end = o.string("end") ?? start
        days = o.array("days").compactMap { value in
            let day = Loose(value)
            guard let date = day.string("date"), WeightDay.isValid(date) else { return nil }
            return CalendarDayCount(date: date, workouts: max(0, day.int("workouts") ?? 0), activities: max(0, day.int("activities") ?? 0))
        }
        entries = o.array("entries").compactMap { ActivityEntry(Loose($0)) }
        total = o.int("total") ?? entries.count
        omitted = o.int("omitted") ?? 0
        stats = o.object("stats").map(WorkoutStatsSummary.init)
        activity = o.object("activity").map(ActivitySummary.init)
        let recaps = o.object("recaps")
        monthRecap = recaps?.object("month").flatMap(ProgressRecap.init)
        weekRecap = recaps?.object("week").flatMap(ProgressRecap.init)
        activityView = o.object("activityView").flatMap(ActivityView.init)
        raw = json
    }

    public func day(_ date: String) -> CalendarDayCount? {
        days.first { $0.date == date }
    }

    public func entries(on date: String) -> [ActivityEntry] {
        entries.filter { $0.date == date }
    }

    /// Für diesen Tag fehlen Zeilen (Anzahl größer als übertragene Einträge).
    public func isIncomplete(_ date: String) -> Bool {
        guard let day = day(date) else { return omitted > 0 }
        return entries(on: date).count < day.total
    }
}

public struct ReviewSet: Equatable, Sendable, Identifiable {
    public var index: Int
    /// Satzrohwerte; `""` (leer) bleibt `.empty`, nicht 0.
    public var kg: SetValue?
    public var reps: SetValue?
    public var done: Bool
    public var shownKg: Double?
    public var e1rm: Double?
    public var id: Int { index }
}

public struct ReviewExercise: Equatable, Sendable, Identifiable {
    public var id: String
    public var libraryId: String?
    public var name: String
    public var sets: [ReviewSet]
    public var omitted: Int

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        libraryId = o.string("libraryId")
        name = o.string("name") ?? ""
        sets = o.array("sets").enumerated().map { index, value in
            let set = Loose(value)
            return ReviewSet(index: index, kg: SetValue(json: set.values["kg"]), reps: SetValue(json: set.values["reps"]),
                             done: set.bool("done") ?? false, shownKg: set.number("shownKg"), e1rm: set.number("e1rm"))
        }
        omitted = o.int("omitted") ?? 0
    }
}

/// Lesbarer Rückblick eines abgeschlossenen Workouts (erste `completionReview`-Seite, keine erneute XP-Vergabe).
public struct WorkoutReviewResult: Equatable, Sendable {
    public var id: String
    public var name: String
    public var date: String?
    public var durationSeconds: Double?
    public var durationClock: String?
    public var timeApprox: Bool
    public var autoFinished: Bool
    public var exerciseCount: Int?
    public var stats: WorkoutStatsSummary
    public var xp: Double?
    public var durationXp: Double?
    /// Web-Texte persönlicher Verbesserungen.
    public var wins: [String]
    public var winsOmitted: Int
    /// `nil`, falls nicht gespeichert.
    public var bodyweight: Double?
    public var exercises: [ReviewExercise]
    public var omitted: Int

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let id = o.string("id"), !id.isEmpty else { throw BridgeDecodingError.invalidField("result.id") }
        self.id = id
        name = o.string("name") ?? ""
        date = o.string("date")
        durationSeconds = o.number("durationSeconds")
        durationClock = o.string("durationClock")
        timeApprox = o.bool("timeApprox") ?? false
        autoFinished = o.bool("autoFinished") ?? false
        exerciseCount = o.int("exerciseCount")
        stats = WorkoutStatsSummary(o)
        xp = o.number("xp")
        durationXp = o.number("durationXp")
        wins = o.array("wins").compactMap(\.stringValue)
        winsOmitted = o.int("winsOmitted") ?? 0
        bodyweight = o.number("bodyweight")
        exercises = o.array("exercises").compactMap { ReviewExercise(Loose($0)) }
        omitted = o.int("omitted") ?? 0
    }
}

public struct HistorySet: Equatable, Sendable, Identifiable {
    public var index: Int
    public var kg: SetValue?
    public var reps: SetValue?
    public var id: Int { index }
}

public struct ExerciseHistorySession: Equatable, Sendable, Identifiable {
    public var index: Int
    public var workoutId: String?
    public var date: String?
    public var name: String
    /// `nil` = kein e1RM (z. B. hohe Wiederholungen), nie 0.
    public var e1rm: Double?
    public var volume: Double?
    public var sets: [HistorySet]
    public var omitted: Int
    public var id: Int { index }
}

/// Positiver e1RM-Punkt (`exerciseHistory`); keine erfundenen Nullpunkte.
public struct ExercisePoint: Equatable, Sendable, Identifiable {
    public var index: Int
    public var date: String
    public var workoutId: String?
    public var value: Double
    public var id: Int { index }
}

public struct ExerciseHistoryResult: Equatable, Sendable {
    public var id: String
    public var name: String
    public var target: Double?
    /// Angezeigtes historisches e1RM oder `nil`.
    public var best: Double?
    public var heaviest: HeaviestSet?
    public var rank: StrengthRank?
    public var forecast: String?
    public var suggestion: String?
    /// Neueste zuerst, höchstens 120.
    public var history: [ExerciseHistorySession]
    public var total: Int
    public var omitted: Int
    /// Aufsteigend, höchstens 400 positive Punkte.
    public var points: [ExercisePoint]
    public var pointsOmitted: Int

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let id = o.string("id"), !id.isEmpty else { throw BridgeDecodingError.invalidField("result.id") }
        self.id = id
        name = o.string("name") ?? ""
        target = o.number("target")
        // Vertrag nach Performance-Review: `bestE1rm`; ältere Web-Stände senden `best` (Zahl).
        best = o.number("bestE1rm") ?? o.number("best")
        heaviest = o.object("heaviest").map(StrengthRecord.heaviest)
        rank = o.object("rank").map(StrengthRecord.rank)
        forecast = o.string("forecast")
        suggestion = o.string("suggestion")
        history = o.array("history").enumerated().map { index, value in
            let row = Loose(value)
            let sets = row.array("sets").enumerated().map { setIndex, setValue in
                let set = Loose(setValue)
                return HistorySet(index: setIndex, kg: SetValue(json: set.values["kg"]), reps: SetValue(json: set.values["reps"]))
            }
            return ExerciseHistorySession(index: index, workoutId: row.string("workoutId"), date: row.string("date"),
                                          name: row.string("name") ?? "", e1rm: row.number("e1rm"), volume: row.number("volume"),
                                          sets: sets, omitted: row.int("omitted") ?? 0)
        }
        total = o.int("total") ?? history.count
        omitted = o.int("omitted") ?? 0
        var points: [ExercisePoint] = []
        for value in o.array("points") {
            let point = Loose(value)
            guard let date = point.string("date"), WeightDay.isValid(date), let number = point.number("value"), number > 0 else { continue }
            points.append(ExercisePoint(index: points.count, date: date, workoutId: point.string("workoutId"), value: number))
        }
        self.points = points
        pointsOmitted = o.int("pointsOmitted") ?? 0
    }
}

/// Kompakte Aktivität ohne GPS-Route/Koordinaten/Splits. Unbekannte Werte `nil`.
public struct RunDetailResult: Equatable, Sendable {
    public var entry: ActivityEntry
    public var paceText: String?
    public var maxSpeed: Double?
    public var elevationGain: Double?
    public var elevationMax: Double?
    public var pauseSeconds: Double?
    public var note: String?
    /// Gespeicherter Wert (im Web 1–5).
    public var feeling: JSONValue?
    /// Gespeicherter Schlüssel (`road`, `forest`, …).
    public var terrain: String?
    public var hasRoute: Bool
    public var xp: Double?
    public var durationXp: Double?
    public var wins: [String]
    public var winsOmitted: Int
    public var navigation: ProgressNavigation?

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let entry = ActivityEntry(o) else { throw BridgeDecodingError.invalidField("result.id") }
        self.entry = entry
        paceText = o.string("paceText")
        maxSpeed = o.number("maxSpeed")
        elevationGain = o.number("elevationGain")
        elevationMax = o.number("elevationMax")
        pauseSeconds = o.number("pauseSeconds")
        note = o.string("note").flatMap { $0.isEmpty ? nil : $0 }
        switch o.values["feeling"] {
        case nil, .null?: feeling = nil
        case let value?: feeling = value
        }
        terrain = o.string("terrain")
        hasRoute = o.bool("hasRoute") ?? false
        xp = o.number("xp")
        durationXp = o.number("durationXp")
        wins = o.array("wins").compactMap(\.stringValue)
        winsOmitted = o.int("winsOmitted") ?? 0
        navigation = o.values["navigation"].flatMap(ProgressNavigation.init(json:))
    }
}
