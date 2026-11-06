import Foundation

// Welle N1: `hello.extras`, `pulsNativeQuery`/`nativeResult`, Abschnitte, Seiten, Abschluss, Indexchart und Teilen
// (docs/native/NATIVE-BRIDGE-PROTOCOL.md §15). Alles hinter den Flags `nativeCompletion`/`nativeExtras`: ohne sie bleibt
// jede bisherige Nachricht unverändert. Keine Rechenformeln: XP, Normalisierung, Pace und Summen kommen fertig aus dem Web.

/// `hello.extras`; `nil` ohne N1 bzw. bei älterem Web-Stand.
public struct ExtrasCapabilities: Equatable, Sendable {
    public var queries: [String]
    public var ops: [String]

    public init(queries: [String] = [], ops: [String] = []) {
        self.queries = queries
        self.ops = ops
    }

    /// Nachsichtig: eine unerwartete Form schaltet nur die Erweiterungen nicht frei.
    init?(json: JSONValue?) {
        guard let json, case .object = json else { return nil }
        queries = (json["queries"]?.arrayValue ?? []).compactMap(\.stringValue)
        ops = (json["ops"]?.arrayValue ?? []).compactMap(\.stringValue)
    }

    public var json: JSONValue {
        .object(["queries": .array(queries.map(JSONValue.string)), "ops": .array(ops.map(JSONValue.string))])
    }
}

// MARK: - Anfragen

/// CSV-Arten: exakt die vier Knöpfe von `csvExportForm`.
public enum NativeCSVKind: String, CaseIterable, Sendable {
    case foods, workouts, weights, measurements
}

/// Sammlung und Pflichtfilter einer Seitenabfrage (§15.3).
public struct NativePageQuery: Equatable, Hashable, Sendable {
    public var collection: String
    public var filters: [String: JSONValue]

    public static func diary(date: String) -> NativePageQuery {
        NativePageQuery(collection: "diary", filters: ["date": .string(date)])
    }
    public static let recipes = NativePageQuery(collection: "recipes", filters: [:])
    public static func monthEntries(month: String) -> NativePageQuery {
        NativePageQuery(collection: "monthEntries", filters: ["month": .string(month)])
    }
    public static func metricPoints(metric: String, range: String) -> NativePageQuery {
        NativePageQuery(collection: "metricPoints", filters: ["metric": .string(metric), "range": .string(range)])
    }
    public static let historyDays = NativePageQuery(collection: "historyDays", filters: [:])
    public static let records = NativePageQuery(collection: "records", filters: [:])
    public static func activityEntries(mode: String, offset: Int, filter: String) -> NativePageQuery {
        NativePageQuery(collection: "activityEntries", filters: [
            "mode": .string(mode), "offset": .number(Double(offset)), "filter": .string(filter),
        ])
    }
    public static func exerciseHistory(exerciseId: String) -> NativePageQuery {
        NativePageQuery(collection: "exerciseHistory", filters: ["exerciseId": .string(exerciseId)])
    }
    public static let bodyHistory = NativePageQuery(collection: "bodyHistory", filters: [:])
    public static let measurements = NativePageQuery(collection: "measurements", filters: [:])
}

/// Argument für `window.pulsNativeQuery(request)`; nur die Felder des jeweiligen Vertrags (das Web lehnt andere ab).
public struct NativeQueryRequest: Equatable, Hashable, Sendable {
    public enum Kind: String, Sendable {
        case completion, page, pageItem, indexChart, export, share, recipePreview
    }

    public var requestId: String
    public var kind: Kind
    var fields: [String: JSONValue]

    private init?(requestId: String, kind: Kind, fields: [String: JSONValue]) {
        guard !requestId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, requestId.utf16.count <= 100 else { return nil }
        self.requestId = requestId
        self.kind = kind
        self.fields = fields
    }

    private static func cursorFields(_ cursor: String?) -> [String: JSONValue] {
        guard let cursor else { return [:] }
        return ["cursor": JSONValue.string(cursor)]
    }

    /// Standard 60, höchstens 200 Zeilen; das Größenbudget kann früher enden.
    public static func page(_ query: NativePageQuery, limit: Int? = nil, cursor: String? = nil, requestId: String) -> NativeQueryRequest? {
        if let limit { guard (1...200).contains(limit) else { return nil } }
        var fields = query.filters.merging(cursorFields(cursor)) { first, _ in first }
        fields["collection"] = JSONValue.string(query.collection)
        if let limit { fields["limit"] = JSONValue.number(Double(limit)) }
        return NativeQueryRequest(requestId: requestId, kind: .page, fields: fields)
    }

    /// Fortsetzung einer übergroßen Zeile; kein `limit`.
    public static func pageItem(_ query: NativePageQuery, itemIndex: Int, cursor: String?, requestId: String) -> NativeQueryRequest? {
        guard itemIndex >= 0 else { return nil }
        var fields = query.filters.merging(cursorFields(cursor)) { first, _ in first }
        fields["collection"] = JSONValue.string(query.collection)
        fields["itemIndex"] = JSONValue.number(Double(itemIndex))
        return NativeQueryRequest(requestId: requestId, kind: .pageItem, fields: fields)
    }

    public static func indexChart(cursor: String? = nil, requestId: String) -> NativeQueryRequest? {
        NativeQueryRequest(requestId: requestId, kind: .indexChart, fields: cursorFields(cursor))
    }

    /// `csv == nil` = JSON-Sicherung.
    public static func export(csv: NativeCSVKind?, cursor: String? = nil, requestId: String) -> NativeQueryRequest? {
        var fields = cursorFields(cursor)
        if let csv {
            fields["format"] = JSONValue.string("csv")
            fields["csvOptions"] = JSONValue.object(["kind": JSONValue.string(csv.rawValue)])
        } else {
            fields["format"] = JSONValue.string("json")
        }
        return NativeQueryRequest(requestId: requestId, kind: .export, fields: fields)
    }

    /// `collection`: `workout` oder `run`.
    public static func share(collection: String, id: String, cursor: String? = nil, requestId: String) -> NativeQueryRequest? {
        guard ["workout", "run"].contains(collection), !id.isEmpty else { return nil }
        var fields = cursorFields(cursor)
        fields["collection"] = JSONValue.string(collection)
        fields["id"] = JSONValue.string(id)
        return NativeQueryRequest(requestId: requestId, kind: .share, fields: fields)
    }

    public static func completion(kind: NativeCompletion.Kind, id: String, cursor: String? = nil, requestId: String) -> NativeQueryRequest? {
        guard !id.isEmpty else { return nil }
        var fields = cursorFields(cursor)
        fields["collection"] = JSONValue.string(kind.rawValue)
        fields["id"] = JSONValue.string(id)
        return NativeQueryRequest(requestId: requestId, kind: .completion, fields: fields)
    }

    /// §12.5: Vorschau eines Rezeptentwurfs (`RecipeDraft.previewJSON`). Gemeldet in `hello.nutrition.queries`, nicht in `extras`.
    public static func recipePreview(draft: JSONValue, requestId: String) -> NativeQueryRequest? {
        NativeQueryRequest(requestId: requestId, kind: .recipePreview, fields: ["draft": draft])
    }

    public var json: JSONValue {
        var object = fields
        object["requestId"] = JSONValue.string(requestId)
        object["kind"] = JSONValue.string(kind.rawValue)
        return .object(object)
    }
}

// MARK: - Antworten

/// `{type:'nativeResult', requestId, kind, ok, result | error}`. Kein Ack, kein Wirkungsnachweis.
public struct NativeResultMessage: Equatable, Sendable {
    public var requestId: String
    public var kind: String
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var language: String
    public var ok: Bool
    public var error: AckError?
    public var result: JSONValue?
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        requestId = try fields.nonEmptyString("requestId")
        kind = try fields.nonEmptyString("kind")
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        language = (try fields.optionalString("language")) == "en" ? "en" : "de"
        ok = try fields.requiredBool("ok")
        if ok {
            guard let value = fields["result"], case .object = value else { throw BridgeDecodingError.invalidField("result") }
            result = value
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

    public var isGone: Bool { error?.code == .gone }
    /// Datenstand geändert: Teilmenge verwerfen und neu beginnen (§15.1).
    public var isStaleCursor: Bool { error?.code == .other("stale_cursor") }
    /// Provider fehlt in diesem Dokument: Wiederholen hilft nicht.
    public var isUnavailable: Bool { error?.code == .other("unavailable") }
}

/// Inhaltsabschnitt (§15.6). Längen und Offsets zählen UTF-16-Codeeinheiten, nie Characters.
public struct NativeChunk: Equatable, Sendable {
    /// `text` oder `json`.
    public var encoding: String
    public var content: String
    public var offset: Int
    public var totalLength: Int
    public var nextCursor: String?
    /// Vollständiges Result einschließlich Metadaten (`name`, `type`, `dismissed`, …).
    public var meta: JSONValue

    public init?(json: JSONValue) {
        guard let encoding = json["encoding"]?.stringValue, encoding == "text" || encoding == "json",
              let content = json["content"]?.stringValue, let offset = json["offset"]?.intValue, offset >= 0,
              let totalLength = json["totalLength"]?.intValue, totalLength >= 0 else { return nil }
        self.encoding = encoding
        self.content = content
        self.offset = offset
        self.totalLength = totalLength
        nextCursor = json["nextCursor"]?.stringValue
        meta = json
    }
}

/// Setzt Abschnitte exakt in Offsetreihenfolge zusammen; prüft Offsets, Art und Gesamtlänge.
public struct ChunkAssembler: Equatable, Sendable {
    public private(set) var text = ""
    public private(set) var encoding: String?
    public private(set) var meta: JSONValue?
    private var length = 0
    private var total: Int?

    public init() {}

    /// `false` = Abschnitt passt nicht (dann neu beginnen).
    public mutating func append(_ chunk: NativeChunk) -> Bool {
        guard chunk.offset == length, encoding == nil || encoding == chunk.encoding, total == nil || total == chunk.totalLength else {
            return false
        }
        encoding = chunk.encoding
        total = chunk.totalLength
        if meta == nil { meta = chunk.meta }
        text += chunk.content
        length += chunk.content.utf16.count
        return length <= chunk.totalLength
    }

    public var isComplete: Bool { total != nil && total == length }

    /// Bei `encoding:'json'` erst der vollständige String wird geparst.
    public func parsed() -> JSONValue? {
        guard isComplete, encoding == "json" else { return nil }
        return try? JSONValue.parse(text, maxDepth: JSONLimits.bridgeDepth)
    }
}

/// Antwort auf `page`: Zeilen oder erster Abschnitt einer einzelnen übergroßen Zeile.
public enum NativePage: Equatable, Sendable {
    case items(items: [JSONValue], total: Int, nextCursor: String?)
    case largeRow(NativeLargeRow)

    public init?(json: JSONValue) {
        if json["encoding"] != nil {
            guard let row = NativeLargeRow(json: json) else { return nil }
            self = .largeRow(row)
            return
        }
        guard let items = json["items"]?.arrayValue else { return nil }
        self = .items(items: items, total: json["total"]?.intValue ?? items.count, nextCursor: json["nextCursor"]?.stringValue)
    }
}

public struct NativeLargeRow: Equatable, Sendable {
    public var itemIndex: Int
    public var total: Int
    /// Offset 0 derselben Zeile (bei unterbrochenem Lesen).
    public var itemCursor: String?
    /// `page`-Cursor nach dieser Zeile; `nil` = Ende.
    public var afterItemCursor: String?
    public var chunk: NativeChunk

    init?(json: JSONValue) {
        guard let chunk = NativeChunk(json: json), let itemIndex = json["itemIndex"]?.intValue else { return nil }
        self.chunk = chunk
        self.itemIndex = itemIndex
        total = json["total"]?.intValue ?? itemIndex + 1
        itemCursor = json["itemCursor"]?.stringValue
        afterItemCursor = json["afterItemCursor"]?.stringValue
    }
}

/// Fügt Seiten zusammen, ohne eine Zeile mit stabiler ID doppelt zu zeigen. Zeilen ohne ID bleiben alle erhalten.
public enum NativePageRows {
    private static func key(_ row: JSONValue) -> String? {
        guard let id = row["id"]?.stringValue, !id.isEmpty else { return nil }
        return (row["kind"]?.stringValue ?? "") + ":" + id
    }

    public static func merging(_ rows: [JSONValue], _ next: [JSONValue]) -> [JSONValue] {
        var seen = Set(rows.compactMap(key))
        var result = rows
        for row in next {
            if let rowKey = key(row), !seen.insert(rowKey).inserted { continue }
            result.append(row)
        }
        return result
    }
}

/// Erkennt einen Kreislauf beim Neuaufsetzen nach `stale_cursor`: Kommt die Liste bei zwei Durchläufen in Folge nicht weiter
/// als zuvor (z. B. weil der Fortsetzungscursor hinter vielen Abschnitten verfällt) oder gibt es zu viele Durchläufe, wird
/// abgebrochen. Nie endlos laden.
public struct PageRestartGuard: Equatable, Sendable {
    public static let stallLimit = 2
    public static let restartLimit = 6

    private var furthest = 0
    private var stalled = 0
    private var restarts = 0

    public init() {}

    /// `reached` = gelesene Zeilen beim Verfall des Cursors.
    public mutating func allowsRestart(reached: Int) -> Bool {
        restarts += 1
        if reached > furthest {
            furthest = reached
            stalled = 0
        } else {
            stalled += 1
        }
        return stalled < Self.stallLimit && restarts <= Self.restartLimit
    }
}

// MARK: - Abschluss

/// `result.completion` bzw. Query `completion`. XP, Level und Serien sind eingefrorene Web-Werte: nur anzeigen.
public struct NativeCompletion: Equatable, Sendable, Identifiable {
    public enum Kind: String, Sendable {
        case workout, run
    }

    public struct Level: Equatable, Sendable {
        public var level: Int?
        public var current: Double?
        public var needed: Double?
        public var total: Double?
    }

    public struct WeekDay: Equatable, Sendable, Identifiable {
        public var date: String
        public var trained: Bool
        public var today: Bool
        public var id: String { date }
    }

    public var kind: Kind
    public var id: String
    /// Stabile ID des tatsächlichen Finish-Zyklus; fehlt nur bei alten Web-Receipts/Ersatzansichten.
    public var cycleId: String?
    public var xp: Double?
    public var durationXp: Double?
    public var wins: [String]
    public var level: Level?
    public var streak: Int?
    public var weekStreak: Int?
    public var week: [WeekDay]
    /// Roh: Workout-Kennzahlen bzw. vollständiges M6-Laufdetail.
    public var summary: JSONValue?
    /// Ack enthielt nur den Kopf; der Rest kommt über Query `completion`.
    public var chunked: Bool
    /// Native Ersatzansicht: Das Training ist gespeichert, sein Abschluss aber nicht mehr erhalten (nie erfundene XP).
    public var unavailable: Bool

    /// Ersatz für ein erfolgreiches Finish ohne Abschluss; ohne XP, Level und Serien.
    public static func unavailableJSON(kind: Kind, id: String) -> JSONValue {
        .object(["kind": .string(kind.rawValue), "id": .string(id), "unavailable": .bool(true)])
    }

    public init?(json: JSONValue?) {
        guard let json, case .object = json else { return nil }
        let o = Loose(json)
        guard let rawKind = o.string("kind"), let kind = Kind(rawValue: rawKind), let id = o.string("id"), !id.isEmpty else { return nil }
        self.kind = kind
        self.id = id
        cycleId = o.string("cycleId").flatMap { $0.isEmpty ? nil : $0 }
        xp = o.number("xp")
        durationXp = o.number("durationXp")
        wins = o.array("wins").compactMap(\.stringValue)
        level = o.object("level").map { Level(level: $0.int("level"), current: $0.number("current"), needed: $0.number("needed"), total: $0.number("total")) }
        streak = o.int("streak")
        weekStreak = o.int("weekStreak")
        week = o.array("week").compactMap { value -> WeekDay? in
            let day = Loose(value)
            guard let date = day.string("date") else { return nil }
            return WeekDay(date: date, trained: day.bool("trained") ?? false, today: day.bool("today") ?? false)
        }
        if let summary = o.values["summary"], case .object = summary { self.summary = summary } else { summary = nil }
        chunked = o.bool("chunked") ?? false
        unavailable = o.bool("unavailable") ?? false
    }

    public var workoutSummary: NativeWorkoutSummary? {
        guard kind == .workout, let summary else { return nil }
        return NativeWorkoutSummary(summary)
    }

    public var runDetail: StoredActivityDetail? {
        guard kind == .run, let summary else { return nil }
        return try? StoredActivityDetail(json: summary)
    }
}

public struct NativeWorkoutSummary: Equatable, Sendable {
    public var name: String
    public var date: String?
    public var durationClock: String?
    public var bodyweight: Double?
    public var exerciseCount: Int?
    public var sets: Double?
    public var reps: Double?
    public var volume: Double?

    init(_ json: JSONValue) {
        let o = Loose(json)
        name = o.string("name") ?? ""
        date = o.string("date")
        durationClock = o.string("durationClock")
        bodyweight = o.number("bodyweight")
        exerciseCount = o.int("exerciseCount")
        sets = o.number("sets")
        reps = o.number("reps")
        volume = o.number("volume")
    }
}

// MARK: - Indexchart

/// `{period, series, min, max, first, last}`: fertig normalisiert im Web, Swift zeichnet nur.
public struct NativeIndexChart: Equatable, Sendable {
    public struct Point: Equatable, Sendable {
        public var date: String
        /// Gemessener Wert in Originaleinheit.
        public var raw: Double
        /// Web-Index (erste positive Messung = 100).
        public var value: Double
    }

    public var period: String
    public var series: [String: [Point]]
    public var min: Double
    public var max: Double

    public init?(json: JSONValue?) {
        guard let json, case .object = json else { return nil }
        let o = Loose(json)
        guard let min = o.number("min"), let max = o.number("max"), min < max else { return nil }
        self.min = min
        self.max = max
        period = o.string("period") ?? ""
        var series: [String: [Point]] = [:]
        for (key, value) in o.object("series")?.values ?? [:] {
            let points = (value.arrayValue ?? []).compactMap { item -> Point? in
                let point = Loose(item)
                guard let date = point.string("date"), let raw = point.number("raw"), let index = point.number("v") else { return nil }
                return Point(date: date, raw: raw, value: index)
            }
            series[key] = points
        }
        self.series = series
    }
}

// MARK: - Teilen

/// `{title, text, data?}`: `text` ist bei Läufen `null`, dann liefert `data` das M6-Detail.
public struct NativeShare: Equatable, Sendable {
    public var title: String
    public var text: String?
    public var run: StoredActivityDetail?

    public init?(json: JSONValue?) {
        guard let json, case .object = json else { return nil }
        title = json["title"]?.stringValue ?? "PULS"
        text = json["text"]?.stringValue
        if let data = json["data"], let detail = try? StoredActivityDetail(json: data) { run = detail } else { run = nil }
        guard text != nil || run != nil else { return nil }
    }
}

// MARK: - Seitenzeilen (dieselben Formen wie die Projektionen)

extension ActivityEntry {
    public init?(pageRow json: JSONValue) { self.init(Loose(json)) }
}

extension StrengthRecord {
    public init?(pageRow json: JSONValue) { self.init(Loose(json)) }
}

extension NutritionEntry {
    public init?(pageRow json: JSONValue) { self.init(Loose(json)) }
}

extension NutritionRecipeRow {
    public init?(pageRow json: JSONValue) { self.init(Loose(json)) }
}

extension AccountHistoryRow {
    public init?(pageRow json: JSONValue) { self.init(Loose(json)) }
}

extension AccountMeasurement {
    public init?(pageRow json: JSONValue) { self.init(Loose(json)) }
}

extension ExerciseHistorySession {
    /// Seitenzeile ohne frühere Satzkürzung.
    public init(pageRow json: JSONValue, index: Int) {
        let row = Loose(json)
        let sets = row.array("sets").enumerated().map { setIndex, setValue -> HistorySet in
            let set = Loose(setValue)
            return HistorySet(index: setIndex, kg: SetValue(json: set.values["kg"]), reps: SetValue(json: set.values["reps"]))
        }
        self.init(index: index, workoutId: row.string("workoutId"), date: row.string("date"), name: row.string("name") ?? "",
                  e1rm: row.number("e1rm"), volume: row.number("volume"), sets: sets, omitted: row.int("omitted") ?? 0)
    }
}

// MARK: - Ops

public enum ExtrasOps {
    public static let completionDismiss = "completion.dismiss"
    public static let exerciseSettingsSet = "exercise.settings.set"
    public static let routeFromRun = "route.fromRun"

    public static let all: Set<String> = [completionDismiss, exerciseSettingsSet, routeFromRun]

    public static func isExtras(_ op: String) -> Bool { all.contains(op) }

    public static let nativeCompletionFeature = "nativeCompletion"
    public static let nativeExtrasFeature = "nativeExtras"

    /// Bekannte primäre Web-Muskelgruppen (`muscleNames` in js/insights.js).
    public static let muscles = [
        "abdominals", "abductors", "adductors", "biceps", "calves", "chest", "forearms", "glutes", "hamstrings", "lats",
        "lower back", "middle back", "neck", "quadriceps", "shoulders", "traps", "triceps",
    ]

    /// Rohzeile der Übungsbibliothek: Erwartung für `exercise.settings.set`, nie der kompakte `record`.
    public static func exerciseRow(_ state: JSONValue, id: String) -> JSONValue? {
        (state["exerciseBook"]?.arrayValue ?? []).first { $0["id"]?.stringValue == id }
    }

    /// Name wie `runSaveRouteFromRun`: getrimmt, leer `Route`, höchstens 60 UTF-16-Einheiten.
    public static func routeName(_ name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let units = Array((trimmed.isEmpty ? "Route" : trimmed).utf16.prefix(60))
        return String(decoding: units, as: UTF16.self)
    }

    /// §15.5: Route unter der stabilen ID mit diesem Namen sowie Geometrie und Distanz des Quelllaufs. `runLineString`
    /// schreibt fünf Nachkommastellen; verglichen wird daher mit dieser Genauigkeit statt Text gegen Text. Ist der Quelllauf
    /// inzwischen gelöscht, bleiben ID und Name der Nachweis (die Route bleibt dann bewusst bestehen).
    static func routeMatchesRun(_ args: JSONValue, _ state: JSONValue) -> Bool {
        guard let id = args["routeId"]?.stringValue, let name = args["name"]?.stringValue,
              let route = (state["runRoutes"]?.arrayValue ?? []).first(where: { $0["id"]?.stringValue == id }),
              route["name"]?.stringValue == routeName(name) else { return false }
        guard let run = (state["runs"]?.arrayValue ?? []).first(where: { $0["id"] == args["runId"] }) else { return true }
        guard route["distanceKm"] == run["distanceKm"] else { return false }
        let expected = RouteLine.segments(run["route"]?.stringValue).flatMap { $0 }
        let line = RouteLine.points(route["line"]?.stringValue)
        guard !line.isEmpty, line.count == expected.count else { return false }
        return zip(expected, line).allSatisfy { pair in
            abs(pair.0.lat - pair.1.lat) <= 0.0000051 && abs(pair.0.lon - pair.1.lon) <= 0.0000051
        }
    }
}

extension BridgeOps {
    public static let extrasEffectChecks: [String: EffectCheck] = [
        // Exakt die vom Web gemeldete Folgezeile unter unveränderter ID.
        ExtrasOps.exerciseSettingsSet: { args, state, result in
            guard let id = args["exerciseId"]?.stringValue, let exercise = result?["exercise"] else { return false }
            return ExtrasOps.exerciseRow(state, id: id) == exercise
        },
        ExtrasOps.routeFromRun: { args, state, _ in ExtrasOps.routeMatchesRun(args, state) },
        // Absichtlich kein Profilfeld (§15.2): das bestätigte Result ist der Nachweis.
        ExtrasOps.completionDismiss: { args, _, result in
            guard let id = args["id"]?.stringValue else { return false }
            return result?["dismissedId"]?.stringValue == id
        },
    ]
}

public enum ExtrasCommands {
    /// `nil` = das Web würde `invalid` antworten (Grenzen aus §15.5).
    public static func exerciseSettings(exerciseId: String, target: Double, repMin: Int, repMax: Int, loadStep: Double,
                                        muscle: String?, expect: JSONValue) -> Command? {
        guard case .object = expect, !exerciseId.isEmpty, target.isFinite, target >= 0, target <= 2000,
              (1...30).contains(repMin), (1...30).contains(repMax), repMax >= repMin,
              loadStep.isFinite, loadStep >= 0.25, loadStep <= 25 else { return nil }
        var args: JSONValue = [
            "exerciseId": .string(exerciseId), "e1rmTarget": .number(target), "repMin": .number(Double(repMin)),
            "repMax": .number(Double(repMax)), "loadStep": .number(loadStep), "expect": expect,
        ]
        if let muscle {
            guard ExtrasOps.muscles.contains(muscle) else { return nil }
            args["muscles"] = JSONValue.array([JSONValue.string(muscle)])
        }
        guard AccountOps.serializedLength(args) <= 24 * 1024 else { return nil }
        return Command(op: ExtrasOps.exerciseSettingsSet, args: args)
    }

    /// `routeId` stabil vor dem ersten Versand; bleibt mit dem Befehl in der Outbox. Den Namen normalisiert das Web.
    public static func routeFromRun(runId: String, routeId: String, name: String) -> Command? {
        guard ActivityIDs.isValid(runId), ActivityIDs.isValid(routeId), name.utf16.count <= 256 else { return nil }
        return Command(op: ExtrasOps.routeFromRun, args: ["runId": .string(runId), "routeId": .string(routeId), "name": .string(name)])
    }

    public static func dismissCompletion(id: String, cycleId: String? = nil) -> Command? {
        guard !id.isEmpty, id.utf16.count <= 256 else { return nil }
        if let cycleId, cycleId.isEmpty || cycleId.utf16.count > 256 { return nil }
        var args: JSONValue = ["id": .string(id)]
        if let cycleId { args["cycleId"] = .string(cycleId) }
        return Command(op: ExtrasOps.completionDismiss, args: args)
    }
}
