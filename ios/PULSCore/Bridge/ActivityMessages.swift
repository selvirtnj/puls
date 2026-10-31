import Foundation

// M6: `projection{name:"activity"}` und `activityResult` aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §11.
//
// Umschlag streng (`projectionSeq`, `ownerPending`, `activity` bzw. `requestId`/`kind`/`ok` Pflicht), Inhalt nachsichtig:
// fehlend oder falscher Typ = unbekannt (`nil`), nie erfundene Nullen. `raw` erhält die Nachricht verlustfrei.
// Native rechnet weder Distanz, Pace, kcal, Höhe, Splits noch MMA-Phasen: es zeigt die Web-Werte und führt nur Uhren
// aus den Zeitbasen fort (`runElapsed`).

public struct ActivityProjectionMessage: Equatable, Sendable {
    public static let activityName = "activity"

    public var projectionSeq: Int
    /// Profilsnapshot-Nummer beim Versand (nur Kontext; darf hinter dem Snapshot liegen).
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var reason: String
    public var activity: ActivityProjection
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.nonEmptyString("name") == Self.activityName else { throw BridgeDecodingError.invalidField("name") }
        projectionSeq = try fields.int("projectionSeq")
        guard projectionSeq >= 0 else { throw BridgeDecodingError.invalidField("projectionSeq") }
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        reason = try fields.optionalString("reason") ?? "unknown"
        guard let activity = fields["activity"] else { throw BridgeDecodingError.missingField("activity") }
        self.activity = try ActivityProjection(json: activity)
        raw = json
    }

    public var json: JSONValue { raw }
}

extension ActivityProjectionMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

// MARK: - Nutzlast

public struct ActivityProjection: Equatable, Sendable {
    /// `de` oder `en` (Standard `de`).
    public var language: String
    public var locale: String?
    public var today: String?
    /// `runTypeList()` in Web-Reihenfolge (8 Arten).
    public var types: [ActivityTypeInfo]
    public var settings: ActivitySettings
    public var active: ActiveActivity?
    /// Abschluss-Entwurf des aktuell pausierten Laufs nach `run.finish`.
    public var summary: ActivitySummaryDraft?
    public var routes: [ActivityRouteRow]
    /// Letzte Aktivitäten, neueste zuerst.
    public var recent: [RecentActivity]
    public var omitted: ActivityOmitted
    public var navigation: [String: ActivityNavigation]
    public var planner: RoutePlannerInfo?
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        guard case .object = json else { throw BridgeDecodingError.invalidField("activity") }
        let o = Loose(json)
        language = o.string("language") == "en" ? "en" : "de"
        locale = o.string("locale")
        today = o.string("today").flatMap { WeightDay.isValid($0) ? $0 : nil }
        types = o.array("types").compactMap { ActivityTypeInfo(Loose($0)) }
        settings = ActivitySettings(o.object("settings"))
        active = o.object("active").flatMap(ActiveActivity.init)
        summary = o.object("summary").flatMap(ActivitySummaryDraft.init)
        routes = o.array("routes").compactMap { ActivityRouteRow(Loose($0)) }
        recent = o.array("recent").compactMap { RecentActivity(Loose($0)) }
        omitted = ActivityOmitted(o.object("omitted"))
        var navigation: [String: ActivityNavigation] = [:]
        for (key, value) in o.object("navigation")?.values ?? [:] {
            if let target = ActivityNavigation(json: value) { navigation[key] = target }
        }
        self.navigation = navigation
        planner = o.object("planner").map(RoutePlannerInfo.init)
        raw = json
    }

    public func type(_ id: String?) -> ActivityTypeInfo? {
        guard let id else { return nil }
        return types.first { $0.id == id }
    }

    public func route(_ id: String?) -> ActivityRouteRow? {
        guard let id else { return nil }
        return routes.first { $0.id == id }
    }

    /// Entwurf gehört zur aktiven, pausierten Aktivität.
    public var currentSummary: ActivitySummaryDraft? {
        guard let summary, let active, active.paused, summary.key == active.startedAt else { return nil }
        return summary
    }
}

/// Eine wählbare Aktivitätsart (`{id,label,icon,gps,category}`); `label` ist bereits übersetzt.
public struct ActivityTypeInfo: Equatable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var icon: String
    public var gps: Bool
    /// `run | walk | ride | other`
    public var category: String

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        label = o.string("label") ?? id
        icon = o.string("icon") ?? id
        gps = o.bool("gps") ?? false
        category = o.string("category") ?? "other"
    }

    public init(id: String, label: String, icon: String, gps: Bool, category: String) {
        self.id = id
        self.label = label
        self.icon = icon
        self.gps = gps
        self.category = category
    }
}

/// MMA-Runden `{work 10–3600, rest 0–1800, count 1–100}` in Sekunden bzw. Anzahl (Web `runSetRounds`).
public struct RoundSettings: Equatable, Hashable, Sendable {
    public var work: Int
    public var rest: Int
    public var count: Int

    public init(work: Int, rest: Int, count: Int) {
        self.work = work
        self.rest = rest
        self.count = count
    }

    init?(_ o: Loose?) {
        guard let o, let work = o.int("work"), let rest = o.int("rest"), let count = o.int("count") else { return nil }
        self.init(work: work, rest: rest, count: count)
    }

    public var isValid: Bool {
        (10...3600).contains(work) && (0...1800).contains(rest) && (1...100).contains(count)
    }

    public var json: JSONValue {
        ["work": .number(Double(work)), "rest": .number(Double(rest)), "count": .number(Double(count))]
    }

    /// Web-Standard `{work:180, rest:60, count:5}`.
    public static let standard = RoundSettings(work: 180, rest: 60, count: 5)
}

/// Anzeige-Einstellungen, **keine** Erwartung für Ops (dafür das rohe `runSettings` aus dem Snapshot).
public struct ActivitySettings: Equatable, Sendable {
    public var lastType: String?
    public var rounds: RoundSettings
    public var countdownSeconds: Int

    init(_ o: Loose?) {
        lastType = o?.string("lastType")
        rounds = RoundSettings(o?.object("rounds")) ?? .standard
        let countdown = o?.int("countdownSeconds") ?? 10
        countdownSeconds = (1...60).contains(countdown) ? countdown : 10
    }
}

/// `runMmaState()` als Momentaufnahme. Phasenwechsel kommen per Projektion; Native zählt nur die Restsekunde herunter.
public struct MmaState: Equatable, Sendable {
    public var round: Int
    public var count: Int
    /// `work | rest | done`
    public var phase: String
    public var remainingSeconds: Double
    public var phaseSeconds: Double
    public var elapsedSeconds: Double?
    public var observedAt: Double?

    init?(_ o: Loose) {
        guard let phase = o.string("phase") else { return nil }
        self.phase = phase
        round = o.int("round") ?? 1
        count = o.int("count") ?? 1
        remainingSeconds = o.number("remainingSeconds") ?? 0
        phaseSeconds = o.number("phaseSeconds") ?? 0
        elapsedSeconds = o.number("elapsedSeconds")
        observedAt = o.number("observedAt")
    }

    public var isDone: Bool { phase == "done" }

    /// Restsekunden der Phase bei `elapsed` aktiven Sekunden: nur heruntergezählt, nie unter 0, keine eigene Phase.
    public func remaining(atElapsed elapsed: Int) -> Double {
        guard !isDone else { return 0 }
        guard let base = elapsedSeconds else { return remainingSeconds }
        return max(0, remainingSeconds - max(0, Double(elapsed) - base))
    }

    /// Fortschritt der Phase 0…1 für den Balken (wie `runViewTick`); `done` = voll.
    public func progress(atElapsed elapsed: Int) -> Double {
        guard !isDone, phaseSeconds > 0 else { return 1 }
        return min(1, max(0, 1 - remaining(atElapsed: elapsed) / phaseSeconds))
    }
}

public struct RouteProgress: Equatable, Sendable {
    public var distanceKm: Double?
    public var routeKm: Double?
    /// ≤ 1, `nil` ohne Distanz.
    public var fraction: Double?

    init(_ o: Loose) {
        distanceKm = o.number("distanceKm")
        routeKm = o.number("routeKm")
        fraction = o.number("fraction").map { min(1, max(0, $0)) }
    }
}

/// Laufende Aktivität mit Zeitbasen (`state.activeRun`) und Web-Livewerten.
public struct ActiveActivity: Equatable, Sendable {
    public var startedAt: Double
    public var paused: Bool
    public var pausedAt: Double?
    public var pausedSeconds: Double
    public var segment: Int
    public var segmentStartedAt: Double?
    public var type: String
    public var gps: Bool
    /// `runOwnedHere()`: dieses Gerät zeichnet auf.
    public var recordingDevice: Bool
    /// `false` bei GPS-Aktivität eines anderen Geräts: nur lesbar, keine Steuer-Ops.
    public var controlsEnabled: Bool
    /// Web-Sperre (`runLocked`); die native Sperre ist reine Native-UI.
    public var locked: Bool
    /// Kumulative aktive Sekunden.
    public var laps: [Double]
    public var rounds: RoundSettings?
    public var mma: MmaState?
    public var routeId: String?
    public var routeProgress: RouteProgress?
    /// `runGpsKm()` auf 0,01 km; `nil` ohne lokale GPS-Daten.
    public var distanceKm: Double?
    public var paceText: String?
    public var currentPaceText: String?
    /// `runLiveData()`: formatierte Web-Werte (`time, clock, dist, pace, avgpace, gain, alt, speed, kcal, lap|phase, roundleft`).
    public var values: [String: String]?
    public var gpsLabel: String?
    public var elapsedSeconds: Double?
    public var observedAt: Double?
    public var durationLimitSeconds: Double?

    init?(_ o: Loose) {
        guard let startedAt = o.number("startedAt") else { return nil }
        self.startedAt = startedAt
        pausedAt = o.number("pausedAt")
        paused = o.bool("paused") ?? (pausedAt != nil)
        pausedSeconds = o.number("pausedSeconds") ?? 0
        segment = o.int("segment") ?? 0
        segmentStartedAt = o.number("segmentStartedAt")
        type = o.string("type") ?? "run"
        gps = o.bool("gps") ?? false
        recordingDevice = o.bool("recordingDevice") ?? !gps
        controlsEnabled = o.bool("controlsEnabled") ?? (!gps || recordingDevice)
        locked = o.bool("locked") ?? false
        laps = o.array("laps").compactMap { $0.doubleValue }
        rounds = RoundSettings(o.object("rounds"))
        mma = o.object("mma").flatMap(MmaState.init)
        routeId = o.string("routeId")
        routeProgress = o.object("routeProgress").map(RouteProgress.init)
        distanceKm = o.number("distanceKm")
        paceText = o.string("paceText")
        currentPaceText = o.string("currentPaceText")
        if let object = o.object("values") {
            var values: [String: String] = [:]
            for (key, value) in object.values { if let text = value.stringValue { values[key] = text } }
            self.values = values
        } else {
            values = nil
        }
        gpsLabel = o.string("gpsLabel")
        elapsedSeconds = o.number("elapsedSeconds")
        observedAt = o.number("observedAt")
        durationLimitSeconds = o.number("durationLimitSeconds")
    }

    /// `runElapsed`: `floor(((pausedAt ?? jetzt) − startedAt)/1000 − pausedSeconds)`, nie negativ. `now` in ms.
    public func elapsed(atMillis now: Double) -> Int {
        let end = pausedAt ?? now
        let value = ((end - startedAt) / 1000 - pausedSeconds).rounded(.down)
        guard value.isFinite, value > 0 else { return 0 }
        return Int(min(value, Double(Int32.max)))
    }

    public func elapsed(at date: Date) -> Int {
        elapsed(atMillis: date.timeIntervalSince1970 * 1000)
    }

    /// Aktuelle Runde wie Web `runLiveData`: `(Nummer, Sekunden seit letzter Markierung)`.
    public func currentLap(atElapsed elapsed: Int) -> (number: Int, seconds: Int) {
        let since = laps.last ?? 0
        return (laps.count + 1, max(0, elapsed - Int(since)))
    }

    public func value(_ key: String) -> String? {
        values?[key]
    }
}

/// Höhenwerte aus `runElevation` (`{gain, loss, max, min}` in m, gerundet).
public struct ActivityElevation: Equatable, Sendable {
    public var gain: Double?
    public var max: Double?

    init(_ o: Loose) {
        gain = o.number("gain")
        max = o.number("max")
    }
}

/// Ersatzdistanz des Entwurfs, verlustfrei: `''`/fehlend = keine Eingabe, `0` = ausdrücklich 0 km.
public enum ManualDistance: Equatable, Sendable {
    case none
    case km(Double)
    /// Ein im Web getippter, noch nicht gespeicherter Text (z. B. `"3.5"`).
    case text(String)

    public init(json: JSONValue?) {
        switch json {
        case .number(let value)? where value.isFinite: self = .km(value)
        case .string(let text)? where !text.trimmingCharacters(in: .whitespaces).isEmpty: self = .text(text)
        default: self = .none
        }
    }

    /// Zahlenwert, sofern lesbar (Komma oder Punkt).
    public var kilometres: Double? {
        switch self {
        case .none: return nil
        case .km(let value): return value
        case .text(let text):
            let cleaned = text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
            guard let value = Double(cleaned), value.isFinite else { return nil }
            return value
        }
    }
}

/// `runSummary` des aktuell pausierten Laufs (Projektion) bzw. mit Strecke/Splits/Runden (Query `summary`).
public struct ActivitySummaryDraft: Equatable, Sendable {
    /// `startedAt` der Aktivität.
    public var key: Double
    public var type: String
    public var km: Double?
    /// Aktive Sekunden.
    public var moving: Double?
    public var pause: Double?
    public var elevation: ActivityElevation?
    public var maxSpeed: Double?
    public var kcal: Double?
    public var feeling: Int?
    public var terrain: String?
    public var note: String
    public var manualKm: ManualDistance
    public var manualDistanceAllowed: Bool
    /// Nur Query: kodierte Strecke (`runRouteString`), `nil` unter 0,01 km.
    public var route: String?
    /// Nur Query: Kilometerzeiten in Sekunden.
    public var splits: [Double]
    /// Nur Query: `[Meter, Sekunden]` des Rests.
    public var splitRest: [Double]?
    /// Nur Query: kumulative Runden.
    public var laps: [Double]

    init?(_ o: Loose) {
        guard let key = o.number("key") else { return nil }
        self.key = key
        type = o.string("type") ?? "run"
        km = o.number("km")
        moving = o.number("moving")
        pause = o.number("pause")
        elevation = o.object("elev").map(ActivityElevation.init)
        maxSpeed = o.number("maxSpeed")
        kcal = o.number("kcal")
        feeling = o.int("feeling")
        terrain = o.string("terrain")
        note = o.string("note") ?? ""
        manualKm = ManualDistance(json: o.values["manualKm"])
        manualDistanceAllowed = o.bool("manualDistanceAllowed") ?? false
        route = o.string("route").flatMap { $0.isEmpty ? nil : $0 }
        splits = o.array("splits").compactMap { $0.doubleValue }
        let rest = o.array("splitRest").compactMap { $0.doubleValue }
        splitRest = rest.count == 2 ? rest : nil
        laps = o.array("laps").compactMap { $0.doubleValue }
    }
}

public struct ActivityRouteRow: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var distanceKm: Double?
    public var ascentM: Double?
    /// Hat Wegpunkte (Web-„Bearbeiten“ im Planer).
    public var editable: Bool

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        distanceKm = o.number("distanceKm")
        ascentM = o.number("ascentM")
        editable = o.bool("editable") ?? false
    }
}

public struct RecentActivity: Equatable, Sendable, Identifiable {
    public var id: String
    public var date: String?
    public var type: String
    public var name: String
    public var startedAt: Double?
    public var distanceKm: Double?
    public var durationSeconds: Double?
    /// Web `runPaceText` (mit „ /km“) oder `–`.
    public var paceText: String?
    public var kcal: Double?
    public var hasRoute: Bool

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        date = o.string("date")
        type = o.string("type") ?? "run"
        name = o.string("name") ?? ""
        startedAt = o.number("startedAt")
        distanceKm = o.number("distanceKm")
        durationSeconds = o.number("durationSeconds")
        paceText = o.string("paceText")
        kcal = o.number("kcal")
        hasRoute = o.bool("hasRoute") ?? false
    }
}

public struct ActivityOmitted: Equatable, Sendable {
    public var routes: Int
    public var recent: Int

    init(_ o: Loose?) {
        routes = o?.int("routes") ?? 0
        recent = o?.int("recent") ?? 0
    }
}

/// Feste Parameter des Web-Routenplaners (BRouter ohne Schlüssel).
public struct RoutePlannerInfo: Equatable, Sendable {
    public var provider: String?
    public var url: String?
    public var profile: String?
    public var maxWaypoints: Int
    public var maxLinePoints: Int
    /// Typische Pace der letzten Läufe in s/km.
    public var typicalPaceSeconds: Double?
    public var native: Bool

    init(_ o: Loose) {
        provider = o.string("provider")
        url = o.string("url")
        profile = o.string("profile")
        maxWaypoints = o.int("maxWaypoints") ?? 60
        maxLinePoints = o.int("maxLinePoints") ?? 800
        typicalPaceSeconds = o.number("typicalPaceSeconds")
        native = o.bool("native") ?? false
    }
}

// MARK: - IDs, Strecken

public enum ActivityIDs {
    /// Web `id()`: `^[A-Za-z0-9_-]{1,100}$`.
    public static func isValid(_ id: String) -> Bool {
        let scalars = id.unicodeScalars
        guard (1...100).contains(scalars.count) else { return false }
        return scalars.allSatisfy { scalar in
            (scalar >= "a" && scalar <= "z") || (scalar >= "A" && scalar <= "Z") || (scalar >= "0" && scalar <= "9")
                || scalar == "_" || scalar == "-"
        }
    }
}

public struct GeoPoint: Equatable, Sendable {
    public var lat: Double
    public var lon: Double

    public init(lat: Double, lon: Double) {
        self.lat = lat
        self.lon = lon
    }
}

/// Lesen der Web-Streckenstrings (keine Umrechnung, keine Glättung).
public enum RouteLine {
    /// `runLineLatLngs`: `"lat,lon;lat,lon"`.
    public static func points(_ line: String?) -> [GeoPoint] {
        guard let line else { return [] }
        return line.split(separator: ";", omittingEmptySubsequences: false).compactMap { pair in
            let parts = pair.split(separator: ",", omittingEmptySubsequences: false)
            guard parts.count == 2,
                  let lat = Double(parts[0].trimmingCharacters(in: .whitespaces)),
                  let lon = Double(parts[1].trimmingCharacters(in: .whitespaces)),
                  lat.isFinite, lon.isFinite else { return nil }
            return GeoPoint(lat: lat, lon: lon)
        }
    }

    /// `runRoutePoints`: Abschnitte durch `|` getrennt, nur Abschnitte mit mindestens zwei Punkten.
    public static func segments(_ route: String?) -> [[GeoPoint]] {
        guard let route else { return [] }
        return route.split(separator: "|", omittingEmptySubsequences: false)
            .map { points(String($0)) }
            .filter { $0.count > 1 }
    }
}

// MARK: - Web-Auswege (§11.5)

/// `pulsNativeNavigate({action, id?, web:true})` für Aktivitäten. Nur die Whitelist aus §11.5.
public struct ActivityNavigation: Equatable, Hashable, Sendable {
    public static let actions: Set<String> = ["activity", "activityRoutes", "routePlanner", "runDetail", "editRun"]
    public static let actionsWithID: Set<String> = ["runDetail", "editRun"]

    public var action: String
    public var id: String?

    /// `routePlanner` nimmt optional eine (editierbare) Routen-ID.
    public init?(action: String, id: String? = nil) {
        guard Self.actions.contains(action) else { return nil }
        if Self.actionsWithID.contains(action) {
            guard let id, ActivityIDs.isValid(id) else { return nil }
            self.id = id
        } else if action == "routePlanner", let id {
            guard ActivityIDs.isValid(id) else { return nil }
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

    /// Argument für `pulsNativeNavigate`; `web:true` gilt nur für diesen Aufruf (sonst würde wieder nativ umgeleitet).
    public var json: JSONValue {
        var object: [String: JSONValue] = ["action": .string(action), "web": .bool(true)]
        if let id { object["id"] = .string(id) }
        return .object(object)
    }
}

// MARK: - Queries (§11.3)

/// Argument für `window.pulsNativeActivityQuery(request)`: nur `requestId`, `kind`, `id`.
public struct ActivityQueryRequest: Equatable, Hashable, Sendable {
    public enum Kind: String, Sendable, CaseIterable {
        case summary, run, route
    }

    public var requestId: String
    public var kind: Kind
    public var id: String?

    public static func summary(requestId: String) -> ActivityQueryRequest? {
        guard ProgressQueryRequest.isValidRequestID(requestId) else { return nil }
        return ActivityQueryRequest(requestId: requestId, kind: .summary, id: nil)
    }

    /// `run` (gespeicherte Aktivität) oder `route`; ID wie Web `id()`.
    public static func detail(_ kind: Kind, id: String, requestId: String) -> ActivityQueryRequest? {
        guard kind != .summary, ProgressQueryRequest.isValidRequestID(requestId), ActivityIDs.isValid(id) else { return nil }
        return ActivityQueryRequest(requestId: requestId, kind: kind, id: id)
    }

    public var json: JSONValue {
        var object: [String: JSONValue] = ["requestId": .string(requestId), "kind": .string(kind.rawValue)]
        if let id { object["id"] = .string(id) }
        return .object(object)
    }
}

/// `{type:'activityResult', requestId, kind, ok, result | error}`. Kein Ack, kein Schreibnachweis.
public struct ActivityResultMessage: Equatable, Sendable {
    public var requestId: String
    public var kind: String
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var language: String
    public var ok: Bool
    public var error: AckError?
    public var result: ActivityQueryResult?
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
            result = try ActivityQueryResult(kind: kind, json: value)
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
}

extension ActivityResultMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

public enum ActivityQueryResult: Equatable, Sendable {
    case summary(ActivitySummaryDraft)
    case run(StoredActivityDetail)
    case route(RouteDetail)
    case unknown(JSONValue)

    init(kind: String, json: JSONValue) throws {
        switch kind {
        case "summary":
            guard let draft = ActivitySummaryDraft(Loose(json)) else { throw BridgeDecodingError.invalidField("result.key") }
            self = .summary(draft)
        case "run": self = .run(try StoredActivityDetail(json: json))
        case "route": self = .route(try RouteDetail(json: json))
        default: self = .unknown(json)
        }
    }
}

/// Bearbeitbare Felder einer gespeicherten Aktivität (`editExpect`, Web `editable(r)`), roh für `expect`.
public struct ActivityEdit: Equatable, Sendable {
    /// Exakt wie vom Web gesendet (Erwartung für `run.edit`/`run.delete`).
    public var raw: JSONValue

    public init(raw: JSONValue) {
        self.raw = raw
    }

    public var type: String { raw["type"]?.stringValue ?? "run" }
    public var feeling: Int? { raw["feeling"]?.intValue }
    public var terrain: String? { raw["terrain"]?.stringValue }
    public var note: String { raw["note"]?.stringValue ?? "" }
}

/// Gespeicherte Aktivität (Query `run`): kompakte Zeile plus Details, Route und Bearbeitungserwartung.
public struct StoredActivityDetail: Equatable, Sendable {
    public var entry: RecentActivity
    public var feeling: Int?
    public var terrain: String?
    public var note: String
    /// Kodierte Strecke (`runRoutePoints`), `nil` ohne GPS-Strecke.
    public var route: String?
    public var laps: [Double]
    public var splits: [Double]
    public var splitRest: [Double]?
    public var pauseSeconds: Double?
    public var maxSpeed: Double?
    public var elevationGain: Double?
    public var elevationMax: Double?
    public var navigation: ActivityNavigation?
    public var editExpect: ActivityEdit?

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let entry = RecentActivity(o) else { throw BridgeDecodingError.invalidField("result.id") }
        self.entry = entry
        feeling = o.int("feeling")
        terrain = o.string("terrain")
        note = o.string("note") ?? ""
        route = o.string("route").flatMap { $0.isEmpty ? nil : $0 }
        laps = o.array("laps").compactMap { $0.doubleValue }
        splits = o.array("splits").compactMap { $0.doubleValue }
        let rest = o.array("splitRest").compactMap { $0.doubleValue }
        splitRest = rest.count == 2 ? rest : nil
        pauseSeconds = o.number("pauseSeconds")
        maxSpeed = o.number("maxSpeed")
        elevationGain = o.number("elevationGain")
        elevationMax = o.number("elevationMax")
        navigation = o.values["navigation"].flatMap(ActivityNavigation.init(json:))
        if let raw = o.values["editExpect"], case .object = raw { editExpect = ActivityEdit(raw: raw) } else { editExpect = nil }
    }
}

/// Gespeicherte Route (Query `route`), Web-Strings `lat,lon;…`.
public struct RouteDetail: Equatable, Sendable {
    public var id: String
    public var name: String
    public var line: String
    public var waypoints: String?
    public var distanceKm: Double?
    public var ascentM: Double?
    public var createdAt: Double?

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let id = o.string("id"), !id.isEmpty else { throw BridgeDecodingError.invalidField("result.id") }
        self.id = id
        name = o.string("name") ?? ""
        line = o.string("line") ?? ""
        waypoints = o.string("waypoints")
        distanceKm = o.number("distanceKm")
        ascentM = o.number("ascentM")
        createdAt = o.number("createdAt")
    }

    public var points: [GeoPoint] { RouteLine.points(line) }
}
