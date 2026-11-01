import Foundation

// M8/S: `projection{name:"account"}`, `accountResult`, `hello.account` und `snapshot.device` aus
// docs/native/NATIVE-BRIDGE-PROTOCOL.md §13 (Gegenstück: js/native-account.js). Weiterhin Phase A: das Web besitzt
// Profil, Berechnungen, Auth und Sync.
//
// Umschlag streng (`projectionSeq`, `ownerPending`, `account` bzw. `requestId`/`kind`/`ok` Pflicht), Inhalt nachsichtig:
// fehlend oder falscher Typ = unbekannt (`nil`), nie erfundene Nullen. Ein bekannter Nullwert bleibt `0`. `raw` erhält jede
// Nachricht verlustfrei. Native rechnet weder Energie, Prognose, Navy, Kalibrierung noch historische BMI-Werte.
// Die Projektion trägt bewusst keine E-Mail, Session, Tokens oder Speicherwerte; Native fragt auch keine ab.

// MARK: - Hello-Fähigkeiten

/// `hello.account = {queries, webActions}`; `nil` ohne `nativeAccount` bzw. bei älterem Web.
public struct AccountCapabilities: Equatable, Hashable, Sendable {
    public var queries: [String]
    public var webActions: [String]

    public init(queries: [String], webActions: [String]) {
        self.queries = queries
        self.webActions = webActions
    }

    init?(json: JSONValue?) {
        guard let json, case .object = json else { return nil }
        let o = Loose(json)
        queries = o.array("queries").compactMap(\.stringValue)
        webActions = o.array("webActions").compactMap(\.stringValue)
    }

    public var json: JSONValue {
        .object(["queries": .array(queries.map(JSONValue.string)), "webActions": .array(webActions.map(JSONValue.string))])
    }

    public var supportsPlanner: Bool { queries.contains(AccountQueryRequest.plannerKind) }

    public func supports(_ action: String) -> Bool { webActions.contains(action) }
}

// MARK: - Gerätedarstellung im Snapshot (§13.1)

/// `snapshot.device = {scheme}`: lokale Darstellung des Geräts, kein Profilfeld, nie synchronisiert.
public enum AccountScheme: String, CaseIterable, Sendable {
    case system, light, dark
}

// MARK: - Projektion

public struct AccountProjectionMessage: Equatable, Sendable {
    public static let accountName = "account"

    public var projectionSeq: Int
    /// Profilsnapshot-Nummer beim Versand (nur Kontext; darf hinter dem Snapshot liegen).
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var reason: String
    /// Aktuelle Web-Kontounterseite oben im Envelope (wie `chrome.accountSection`).
    public var accountSection: String?
    public var account: AccountProjection
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.nonEmptyString("name") == Self.accountName else { throw BridgeDecodingError.invalidField("name") }
        projectionSeq = try fields.int("projectionSeq")
        guard projectionSeq >= 0 else { throw BridgeDecodingError.invalidField("projectionSeq") }
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        reason = try fields.optionalString("reason") ?? "unknown"
        accountSection = try fields.optionalString("accountSection")
        guard let account = fields["account"] else { throw BridgeDecodingError.missingField("account") }
        self.account = try AccountProjection(json: account)
        raw = json
    }

    public var json: JSONValue { raw }
}

extension AccountProjectionMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

public struct AccountProjection: Equatable, Sendable {
    public var language: String
    public var locale: String?
    public var today: String?
    /// Aktuell ausgewählter Web-Tag (nicht immer heute; Planziele aus `dayGoals(date)`).
    public var date: String?
    public var identity: AccountIdentity
    /// `nil`: kein gespeichertes Profil.
    public var profile: AccountProfile?
    public var plan: AccountPlan
    /// Exakt `dayGoals(date)`; nie als Roh-expect benutzen.
    public var goals: MacroValues
    public var energy: AccountEnergy?
    /// Vorhandene Web-Prognose als einfaches HTML; nur als Text dargestellt, nie ausgeführt.
    public var forecastHTML: String?
    public var body: AccountBody
    public var adaptive: AccountAdaptive
    public var appearance: AccountAppearance
    public var sound: AccountSound
    public var cloud: AccountCloud
    public var recovery: AccountRecovery
    public var sections: [AccountSection]
    /// Feste Web-Ausstiege (`{action, web:true}`), nur bekannte Aktionen.
    public var navigation: [AccountNavigation]
    public var omittedMeasurements: Int
    public var omittedHistory: Int
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        guard case .object = json else { throw BridgeDecodingError.invalidField("account") }
        let o = Loose(json)
        language = o.string("language") == "en" ? "en" : "de"
        locale = o.string("locale")
        today = o.string("today").flatMap { WeightDay.isValid($0) ? $0 : nil }
        date = o.string("date").flatMap { WeightDay.isValid($0) ? $0 : nil }
        identity = AccountIdentity(o.object("identity"))
        profile = o.object("profile").map(AccountProfile.init)
        plan = AccountPlan(o.object("plan"))
        goals = o.object("goals").map { MacroValues($0) } ?? MacroValues()
        energy = o.object("energy").map(AccountEnergy.init)
        forecastHTML = o.object("forecast")?.string("html")
        body = AccountBody(o.object("body"))
        adaptive = AccountAdaptive(o.object("adaptive"))
        appearance = AccountAppearance(o.object("appearance"))
        sound = AccountSound(o.object("sound"))
        cloud = AccountCloud(o.object("cloud"))
        recovery = AccountRecovery(o.object("recovery"))
        sections = o.array("sections").compactMap { AccountSection(Loose($0)) }
        navigation = (o.object("navigation")?.values ?? [:]).values.compactMap(AccountNavigation.init(json:))
            .sorted { $0.action < $1.action }
        let omitted = o.object("omitted")
        omittedMeasurements = max(0, omitted?.int("measurements") ?? 0)
        omittedHistory = max(0, omitted?.int("history") ?? 0)
        raw = json
    }

    public func section(_ key: String) -> AccountSection? { sections.first { $0.key == key } }

    public func offers(_ action: String) -> Bool { navigation.contains { $0.action == action } }
}

public struct AccountIdentity: Equatable, Sendable {
    public var displayName: String
    /// JPEG-Daten-URL bis 24 Ki Zeichen, sonst `nil` (dann ggf. `avatarOmitted`).
    public var avatarImage: String?
    public var avatarOmitted: Bool
    public var streak: Int?
    public var level: Int?
    public var current: Double?
    public var needed: Double?
    public var total: Double?

    init(_ o: Loose?) {
        displayName = o?.string("displayName") ?? ""
        avatarImage = o?.string("avatarImage").flatMap { AccountAvatar.isJPEGDataURL($0) ? $0 : nil }
        avatarOmitted = o?.bool("avatarOmitted") ?? false
        streak = o?.int("streak")
        level = o?.int("level")
        current = o?.number("current")
        needed = o?.number("needed")
        total = o?.number("total")
    }
}

/// Gespeicherte Profilfelder, soweit vorhanden. `weight` ist der gespeicherte Profilwert, nicht `currentWeight()`.
public struct AccountProfile: Equatable, Sendable {
    public var age: Double?
    public var height: Double?
    public var target: Double?
    public var activity: Double?
    public var method: String?
    public var rmr: Double?
    public var kcalMode: String?
    public var baselineFactor: Double?
    public var weight: Double?
    public var sex: String?
    public var special: Bool?
    public var updated: String?

    init(_ o: Loose) {
        age = o.number("age")
        height = o.number("height")
        target = o.number("target")
        activity = o.number("activity")
        method = o.string("method")
        rmr = o.number("rmr")
        kcalMode = o.string("kcalMode")
        baselineFactor = o.number("baselineFactor")
        weight = o.number("weight")
        sex = o.string("sex")
        special = o.bool("special")
        updated = o.string("updated")
    }
}

public struct AccountPlan: Equatable, Sendable {
    public var mode: String?
    public var direction: String?
    public var pace: String?
    public var macroMode: String?
    public var protein: Double?
    public var fat: Double?
    public var adaptive: Bool?
    public var learnTdee: Bool?

    init(_ o: Loose?) {
        mode = o?.string("mode")
        direction = o?.string("direction")
        pace = o?.string("pace")
        macroMode = o?.string("macroMode")
        protein = o?.number("protein")
        fat = o?.number("fat")
        adaptive = o?.bool("adaptive")
        learnTdee = o?.bool("learnTdee")
    }
}

/// Letzte `energyFor` des Webs (ganze kcal); fehlender Grundbedarf/Sport bleibt `nil`.
public struct AccountEnergy: Equatable, Sendable {
    public var rmr: Double?
    public var tdee: Double?
    public var baseline: Double?
    public var sport: Double?
    public var calibrated: Bool

    init(_ o: Loose) {
        rmr = o.number("rmr")
        tdee = o.number("tdee")
        baseline = o.number("baseline")
        sport = o.number("sport")
        calibrated = o.bool("calibrated") ?? false
    }
}

public struct AccountBody: Equatable, Sendable {
    /// `currentWeight()`; `nil` ohne Gewicht.
    public var weight: Double?
    /// BMI und BMI-/Alter-Schätzung (`bodyMetrics`), Web-gerundet.
    public var bmi: Double?
    public var bmiBodyFat: Double?
    public var bmiLabel: String?
    /// `currentBodyFat()`: manuell oder Navy (`estimated:true`); `nil` ohne Wert.
    public var bodyFat: AccountBodyFat?
    public var summary: AccountBodySummary
    /// Neueste höchstens 20 (kompakt, ohne unbekannte Felder; Erwartungen kommen aus dem Spiegel).
    public var measurements: [AccountMeasurement]
    /// Neueste höchstens 100 Gewichte mit **historischer BMI-/Alter-Schätzung** (kein Navy-/Messwert).
    public var history: [AccountHistoryRow]
    public var fields: [AccountMeasurementField]
    public var navyNote: String?

    init(_ o: Loose?) {
        weight = o?.number("weight")
        let metrics = o?.object("metrics")
        bmi = metrics?.number("bmi")
        bmiBodyFat = metrics?.number("bf")
        bmiLabel = metrics?.string("label")
        bodyFat = o?.object("bodyFat").flatMap(AccountBodyFat.init)
        summary = AccountBodySummary(o?.object("summary"))
        measurements = (o?.array("measurements") ?? []).compactMap { AccountMeasurement(Loose($0)) }
        history = (o?.array("history") ?? []).compactMap { AccountHistoryRow(Loose($0)) }
        fields = (o?.array("fields") ?? []).compactMap { AccountMeasurementField(Loose($0)) }
        navyNote = o?.string("navyNote")
    }

    public func field(_ key: String) -> AccountMeasurementField? { fields.first { $0.key == key } }
}

public struct AccountBodyFat: Equatable, Sendable {
    public var value: Double
    /// `true` = Navy-Schätzung, `false` = gemessener Wert.
    public var estimated: Bool
    public var date: String?

    init?(_ o: Loose) {
        guard let value = o.number("value") else { return nil }
        self.value = value
        estimated = o.bool("estimated") ?? true
        date = o.string("date")
    }
}

public struct AccountBodySummary: Equatable, Sendable {
    public var date: String?
    /// `entry` (jüngster Gewichtseintrag) oder `profile` (gespeichertes Profilgewicht).
    public var source: String
    public var weekStart: String?
    public var weekCount: Int
    public var weekMean: Double?

    init(_ o: Loose?) {
        date = o?.string("date")
        source = o?.string("source") == "entry" ? "entry" : "profile"
        weekStart = o?.string("weekStart")
        weekCount = o?.int("weekCount") ?? 0
        weekMean = o?.number("weekMean")
    }
}

public struct AccountMeasurement: Equatable, Sendable, Identifiable {
    public var id: String
    public var date: String
    /// Bekannte gespeicherte Registry-Werte; fehlende fehlen (keine Rückfüllung).
    public var values: [String: Double]

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty, let date = o.string("date") else { return nil }
        self.id = id
        self.date = date
        var values: [String: Double] = [:]
        for (key, value) in o.values where key != "id" && key != "date" {
            if let number = value.doubleValue, number.isFinite { values[key] = number }
        }
        self.values = values
    }
}

public struct AccountHistoryRow: Equatable, Sendable, Identifiable {
    public var id: String
    public var date: String
    public var kg: Double?
    public var bmi: Double?
    public var bodyFat: Double?
    public var estimated: Bool
    public var method: String?

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty, let date = o.string("date") else { return nil }
        self.id = id
        self.date = date
        kg = o.number("kg")
        bmi = o.number("bmi")
        bodyFat = o.number("bodyFat")
        estimated = o.bool("estimated") ?? true
        method = o.string("method")
    }
}

/// Dynamische Web-Registry der Messfelder (einschließlich Hals).
public struct AccountMeasurementField: Equatable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var unit: String
    public var min: Double
    public var max: Double

    public var id: String { key }

    init?(_ o: Loose) {
        guard let key = o.string("key"), !key.isEmpty, let min = o.number("min"), let max = o.number("max"), min <= max else { return nil }
        self.key = key
        label = o.string("label") ?? key
        unit = o.string("unit") ?? ""
        self.min = min
        self.max = max
    }

    public func accepts(_ value: Double) -> Bool { value.isFinite && value >= min && value <= max }
}

public struct AccountAdaptive: Equatable, Sendable {
    /// `plan.learnTdee`.
    public var enabled: Bool
    /// `plan.adaptive !== false`.
    public var adaptive: Bool
    /// Kalibrierung im Modus Grundbedarf + Sport gesperrt.
    public var disabled: Bool
    public var observation: AccountObservation
    public var calibration: AccountCalibration?

    init(_ o: Loose?) {
        enabled = o?.bool("enabled") ?? false
        adaptive = o?.bool("adaptive") ?? true
        disabled = o?.bool("disabled") ?? false
        observation = AccountObservation(o?.object("observation"))
        calibration = o?.object("calibration").map(AccountCalibration.init)
    }
}

/// `tdeeObservation()`: nur vorhandene Felder.
public struct AccountObservation: Equatable, Sendable {
    public var eligible: Bool?
    public var coverage: Double?
    public var weightCount: Int?
    public var start: String?
    public var end: String?
    public var mean: Double?
    public var slope: Double?
    public var estimate: Double?
    public var base: Double?
    public var low: Double?
    public var high: Double?
    public var reason: String?

    init(_ o: Loose?) {
        eligible = o?.bool("eligible")
        coverage = o?.number("coverage")
        weightCount = o?.int("weightCount")
        start = o?.string("start")
        end = o?.string("end")
        mean = o?.number("mean")
        slope = o?.number("slope")
        estimate = o?.number("estimate")
        base = o?.number("base")
        low = o?.number("low")
        high = o?.number("high")
        reason = o?.string("reason")
    }
}

public struct AccountCalibration: Equatable, Sendable {
    public var date: String?
    public var value: Double?
    public var base: Double?
    public var activity: Double?
    public var windowStart: String?
    public var windowEnd: String?

    init(_ o: Loose) {
        date = o.string("date")
        value = o.number("value")
        base = o.number("base")
        activity = o.number("activity")
        windowStart = o.string("windowStart")
        windowEnd = o.string("windowEnd")
    }
}

public struct AccountAppearance: Equatable, Sendable {
    /// Gerätewunsch `system|light|dark`.
    public var scheme: AccountScheme
    public var language: String
    public var resolvedScheme: String?
    public var appIcon: String?

    init(_ o: Loose?) {
        scheme = o?.string("scheme").flatMap(AccountScheme.init(rawValue:)) ?? .system
        language = o?.string("language") == "en" ? "en" : "de"
        resolvedScheme = o?.string("resolvedScheme")
        appIcon = o?.string("appIcon")
    }
}

public struct AccountSound: Equatable, Sendable {
    public var enabled: Bool
    /// Web-Lautstärke 0–70 (`soundVolume ?? 35`); unbekannt bleibt `nil`.
    public var volume: Double?

    init(_ o: Loose?) {
        enabled = o?.bool("enabled") ?? true
        volume = o?.number("volume")
    }
}

/// Nur Status; keine Sync-Entscheidung, keine E-Mail.
public struct AccountCloud: Equatable, Sendable {
    public var signedIn: Bool
    public var configured: Bool
    public var dirty: Bool
    public var conflict: Bool
    public var revision: Int?
    public var busy: Bool
    public var uploadBlocked: Bool

    init(_ o: Loose?) {
        signedIn = o?.bool("signedIn") ?? false
        configured = o?.bool("configured") ?? false
        dirty = o?.bool("dirty") ?? false
        conflict = o?.bool("conflict") ?? false
        revision = o?.int("revision")
        busy = o?.bool("busy") ?? false
        uploadBlocked = o?.bool("uploadBlocked") ?? false
    }
}

/// Nur Vorhandensein, keine Backup-Inhalte.
public struct AccountRecovery: Equatable, Sendable {
    public var pending: Bool
    public var corrupt: Bool
    public var uploadBlocked: Bool
    public var localConflictBackup: Bool
    public var remoteConflictBackup: Bool

    init(_ o: Loose?) {
        pending = o?.bool("pending") ?? false
        corrupt = o?.bool("corrupt") ?? false
        uploadBlocked = o?.bool("uploadBlocked") ?? false
        localConflictBackup = o?.bool("localConflictBackup") ?? false
        remoteConflictBackup = o?.bool("remoteConflictBackup") ?? false
    }

    public var needsAttention: Bool { pending || corrupt || uploadBlocked || localConflictBackup || remoteConflictBackup }
}

/// Web-Unterseite `{key,title,note}` (übersetzt vom Web).
public struct AccountSection: Equatable, Sendable, Identifiable {
    public static let keys = ["plan", "body", "adaptive", "design", "sounds", "manage"]

    public var key: String
    public var title: String
    public var note: String

    public var id: String { key }

    init?(_ o: Loose) {
        guard let key = o.string("key"), !key.isEmpty else { return nil }
        self.key = key
        title = o.string("title") ?? key
        note = o.string("note") ?? ""
    }
}

// MARK: - Web-Ausstiege (§13.5)

/// `pulsNativeNavigate({action, web:true})`. Nur die festen Kontoaktionen; Native ruft sie nach dem Ausblenden seiner
/// Ansicht auf. Sensible Abläufe (Anmeldung, Abmeldung, Konflikt, Import, Reset, Löschen) führt ausschließlich das Web aus.
public struct AccountNavigation: Equatable, Hashable, Sendable {
    public static let actions: [String] = [
        "accountSignIn", "accountSignOut", "accountConflict", "accountImport", "accountReset", "accountDelete",
        "accountExport", "accountCSV", "accountRecovery", "accountPlan", "accountAvatar",
    ]

    public var action: String

    public init?(action: String) {
        guard Self.actions.contains(action) else { return nil }
        self.action = action
    }

    /// Nur `{action, web:true}` aus der Projektion (anderes wird verworfen).
    init?(json: JSONValue) {
        guard let object = json.objectValue, object["web"] == .bool(true), Set(object.keys) == ["action", "web"],
              let action = object["action"]?.stringValue else { return nil }
        self.init(action: action)
    }

    public var json: JSONValue { .object(["action": .string(action), "web": .bool(true)]) }
}

// MARK: - Planner-Query (§13.3)

public struct AccountQueryRequest: Equatable, Hashable, Sendable {
    public static let plannerKind = "planner"

    public var requestId: String
    public var kind: String

    public static func planner(requestId: String) -> AccountQueryRequest? {
        guard ProgressQueryRequest.isValidRequestID(requestId) else { return nil }
        return AccountQueryRequest(requestId: requestId, kind: plannerKind)
    }

    /// Ausschließlich die beiden Request-Felder.
    public var json: JSONValue { .object(["requestId": .string(requestId), "kind": .string(kind)]) }
}

/// `{type:'accountResult', requestId, kind, ok, result | error}`. Kein Ack, kein Schreibnachweis.
public struct AccountResultMessage: Equatable, Sendable {
    public var requestId: String
    public var kind: String
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var ok: Bool
    public var error: AckError?
    public var planner: AccountPlannerResult?
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
        ok = try fields.requiredBool("ok")
        if ok {
            guard let value = fields["result"], case .object = value else { throw BridgeDecodingError.invalidField("result") }
            planner = kind == AccountQueryRequest.plannerKind ? try AccountPlannerResult(json: value) : nil
            error = nil
        } else {
            planner = nil
            if let value = fields["error"], case .object = value {
                error = try AckError(json: value)
            } else {
                error = AckError(code: .other("unknown"))
            }
        }
        raw = json
    }

    public var json: JSONValue { raw }
}

extension AccountResultMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

public struct AccountPlannerResult: Equatable, Sendable {
    public var context: PlannerContext
    /// M7 vorhanden: `plan.set`/`adaptive.set` meldet das Web dann ebenfalls.
    public var planOps: Bool

    init(json: JSONValue) throws {
        let o = Loose(json)
        guard let context = PlannerContext(json: o.values["expect"]) else { throw BridgeDecodingError.invalidField("result.expect") }
        self.context = context
        planOps = o.bool("planOps") ?? false
    }
}

/// Vollständiger Planner-/Zielkontext `{profile,plan,goals,weight,tdeeCalibration,date,goalRecord,profileRecord}` (roh,
/// einschließlich unbekannter Felder). Genau dieser Wert ist `expect` für `profile.set`/`plan.set`/`adaptive.set`.
public struct PlannerContext: Equatable, Sendable {
    public static let keys = ["profile", "plan", "goals", "weight", "tdeeCalibration", "date", "goalRecord", "profileRecord"]

    public let raw: JSONValue

    public init?(json: JSONValue?) {
        guard let json, let object = json.objectValue, Set(object.keys) == Set(Self.keys),
              object["plan"]?.objectValue != nil, object["goals"]?.objectValue != nil,
              let date = object["date"]?.stringValue, WeightDay.isValid(date) else { return nil }
        raw = json
    }

    public var profile: JSONValue? { raw["profile"].flatMap { $0.isNull ? nil : $0 } }
    public var plan: JSONValue { raw["plan"] ?? [:] }
    public var goals: JSONValue { raw["goals"] ?? [:] }
    public var weight: Double? { raw["weight"]?.doubleValue }
    public var date: String { raw["date"]?.stringValue ?? "" }

    /// Die vier Makros als Eingabe (z. B. für `adaptive.set` bzw. automatische Pläne).
    public var macroGoals: [String: Double] {
        var values: [String: Double] = [:]
        for key in ["kcal", "p", "c", "f"] { if let number = goals[key]?.doubleValue { values[key] = number } }
        return values
    }
}

// MARK: - Prognose als Text (§13.2 forecast)

/// Die Web-Prognose ist einfaches HTML (`<h3>`, `<p>`, `<details><summary>`). Native zeigt ausschließlich deren Text;
/// Skripte, Stile und Verweise werden nie ausgeführt oder geöffnet. Native berechnet keinen Termin.
public enum ForecastText {
    public struct Block: Equatable, Sendable {
        public enum Kind: Equatable, Sendable { case heading, paragraph, summary }
        public var kind: Kind
        public var text: String
        /// Innerhalb von `<details>` (aufklappbare Annahmen).
        public var inDetails: Bool
    }

    public static func blocks(_ html: String) -> [Block] {
        var blocks: [Block] = []
        var depthDetails = 0
        var kind: Block.Kind?
        var buffer = ""
        var skipping = 0
        var index = html.startIndex
        func flush() {
            if let open = kind {
                let clean = collapse(decode(buffer))
                if !clean.isEmpty { blocks.append(Block(kind: open, text: clean, inDetails: depthDetails > 0)) }
            }
            kind = nil
            buffer = ""
        }
        while index < html.endIndex {
            if html[index] == "<", let close = html[index...].firstIndex(of: ">") {
                let tag = html[html.index(after: index)..<close].lowercased()
                let closing = tag.hasPrefix("/")
                let name = String(tag.drop(while: { $0 == "/" }).prefix(while: { $0.isLetter || $0.isNumber }))
                switch name {
                case "script", "style":
                    skipping += closing ? -1 : 1
                    skipping = max(0, skipping)
                case "details":
                    flush()
                    depthDetails = max(0, depthDetails + (closing ? -1 : 1))
                case "h1", "h2", "h3", "h4", "h5", "h6":
                    flush()
                    if !closing { kind = .heading }
                case "p", "div", "li":
                    flush()
                    if !closing { kind = .paragraph }
                case "summary":
                    flush()
                    if !closing { kind = .summary }
                case "br":
                    if kind != nil { buffer += " " }
                default:
                    break
                }
                index = html.index(after: close)
                continue
            }
            if skipping == 0 {
                if kind == nil { kind = .paragraph }
                buffer.append(html[index])
            }
            index = html.index(after: index)
        }
        flush()
        return blocks
    }

    static func collapse(_ text: String) -> String {
        text.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    /// Benannte Grundentitäten und numerische Entitäten.
    static func decode(_ text: String) -> String {
        guard text.contains("&") else { return text }
        var result = ""
        var index = text.startIndex
        while index < text.endIndex {
            if text[index] == "&", let semicolon = text[index...].prefix(12).firstIndex(of: ";") {
                let entity = String(text[text.index(after: index)..<semicolon])
                if let decoded = entityValue(entity) {
                    result += decoded
                    index = text.index(after: semicolon)
                    continue
                }
            }
            result.append(text[index])
            index = text.index(after: index)
        }
        return result
    }

    private static func entityValue(_ entity: String) -> String? {
        switch entity {
        case "amp": return "&"
        case "lt": return "<"
        case "gt": return ">"
        case "quot": return "\""
        case "apos", "#39": return "'"
        case "nbsp": return "\u{00A0}"
        default:
            guard entity.hasPrefix("#") else { return nil }
            let digits = entity.dropFirst()
            let code = digits.hasPrefix("x") || digits.hasPrefix("X") ? UInt32(digits.dropFirst(), radix: 16) : UInt32(digits)
            guard let code, let scalar = Unicode.Scalar(code) else { return nil }
            return String(Character(scalar))
        }
    }
}

// MARK: - JavaScript-Zeichenketten

/// `String.prototype.trim()` und `.length` wie im Web (UTF-16-Einheiten), damit Grenzen und Wirkungen übereinstimmen.
public enum JSString {
    /// ECMAScript WhiteSpace + LineTerminator.
    static let trimmed: Set<UInt32> = [
        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
        0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
    ]

    public static func trim(_ text: String) -> String {
        let scalars = text.unicodeScalars
        guard let first = scalars.firstIndex(where: { !trimmed.contains($0.value) }),
              let last = scalars.lastIndex(where: { !trimmed.contains($0.value) }) else { return "" }
        return String(scalars[first...last])
    }

    public static func length(_ text: String) -> Int { text.utf16.count }
}

// MARK: - Avatar (§13.4)

public enum AccountAvatar {
    /// Eingang höchstens 512 Ki Zeichen.
    public static let maxInputLength = 512 * 1024
    /// Projektion zeigt nur JPEG-Daten-URLs bis 24 Ki; der Spiegel kann größere gespeicherte (≤ 200 000) enthalten.
    public static let maxStoredLength = 200_000

    /// Web `/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/`, höchstens 512 Ki Zeichen.
    public static func isValidInput(_ dataUrl: String) -> Bool {
        guard dataUrl.utf16.count <= maxInputLength else { return false }
        for type in ["jpeg", "png", "webp"] {
            let prefix = "data:image/\(type);base64,"
            if dataUrl.hasPrefix(prefix) { return isBase64(dataUrl.dropFirst(prefix.count), padded: true) }
        }
        return false
    }

    /// Gespeichertes Web-Ergebnis `data:image/jpeg;base64,…` (Web-Validator: `[A-Za-z0-9+/=]+`).
    public static func isJPEGDataURL(_ text: String) -> Bool {
        let prefix = "data:image/jpeg;base64,"
        guard text.hasPrefix(prefix), text.utf16.count <= maxStoredLength else { return false }
        let body = text.dropFirst(prefix.count)
        return !body.isEmpty && body.utf8.allSatisfy { isBase64Byte($0) || $0 == UInt8(ascii: "=") }
    }

    /// Bilddaten einer JPEG-Daten-URL (nur Anzeige).
    public static func imageData(_ dataUrl: String?) -> Data? {
        guard let dataUrl, isJPEGDataURL(dataUrl) else { return nil }
        return Data(base64Encoded: String(dataUrl.dropFirst("data:image/jpeg;base64,".count)))
    }

    private static func isBase64(_ body: Substring, padded: Bool) -> Bool {
        let bytes = Array(body.utf8)
        var end = bytes.count
        var padding = 0
        while end > 0, bytes[end - 1] == UInt8(ascii: "="), padding < 2 {
            end -= 1
            padding += 1
        }
        guard end > 0 else { return false }
        return bytes[0..<end].allSatisfy(isBase64Byte)
    }

    private static func isBase64Byte(_ byte: UInt8) -> Bool {
        (byte >= 0x41 && byte <= 0x5A) || (byte >= 0x61 && byte <= 0x7A) || (byte >= 0x30 && byte <= 0x39)
            || byte == UInt8(ascii: "+") || byte == UInt8(ascii: "/")
    }
}
