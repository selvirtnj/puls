import Foundation

// Typen zu docs/native/NATIVE-BRIDGE-PROTOCOL.md (Protokoll v1).
// Regeln: unbekannte Felder werden ignoriert, unbekannter `type` oder anderes `protocol` wird ignoriert (nil),
// eine bekannte Nachricht mit falscher Form ist ein Fehler (BridgeDecodingError).

public enum BridgeProtocol {
    public static let version = 1
    /// Name des WKScriptMessageHandlers.
    public static let handlerName = "pulsState"
    /// Eintrag in `window.pulsNativeFeatures`.
    public static let featureName = "stateBridge"
}

public enum BridgeDecodingError: Error, Equatable, Sendable {
    case notAnObject
    case missingField(String)
    case invalidField(String)
    /// Tiefer verschachtelt als `JSONLimits.bridgeDepth`.
    case tooDeep
}

// MARK: - Web → Native

public enum InboundMessage: Equatable, Sendable {
    case hello(HelloMessage)
    case snapshot(SnapshotMessage)
    case ack(AckMessage)
    case openNative(OpenNativeMessage)
    case navigate(NavigateMessage)
    /// M3: flüchtige Anzeige-Projektion (nur `name:"overview"`; andere Namen werden ignoriert).
    case projection(ProjectionMessage)
    /// M3: Web-Modal/Session sperrt die native Navigation (`blocking`).
    case chrome(ChromeMessage)
    /// M4: `projection{name:"training"}` (Routinen, laufende Session, Bibliothek).
    case trainingProjection(TrainingProjectionMessage)
    /// M4: Antwort auf `pulsNativeExerciseSearch` (keine Mutation).
    case exerciseSearch(ExerciseSearchMessage)
    /// M5: `projection{name:"progress"}` (Fortschritt, Kalender-Kontext).
    case progressProjection(ProgressProjectionMessage)
    /// M5: Antwort auf `pulsNativeProgressQuery` (keine Mutation, kein Ack).
    case progressResult(ProgressResultMessage)
    /// M6: `projection{name:"activity"}` (Arten, aktive Aktivität mit Zeitbasen, Entwurf, Routen, letzte Aktivitäten).
    case activityProjection(ActivityProjectionMessage)
    /// M6: Antwort auf `pulsNativeActivityQuery` (keine Mutation, kein Ack).
    case activityResult(ActivityResultMessage)

    /// `nil` = ignorieren (kein/unbekannter `type`, anderes `protocol`). Wirft bei falscher Form einer bekannten Nachricht.
    public static func decode(_ value: JSONValue) throws -> InboundMessage? {
        guard case .object(let object) = value else { throw BridgeDecodingError.notAnObject }
        guard value.fitsDepth(JSONLimits.bridgeDepth) else { throw BridgeDecodingError.tooDeep }
        guard case .string(let type)? = object["type"] else { return nil }
        guard case .number(let version)? = object["protocol"], version == Double(BridgeProtocol.version) else { return nil }
        switch type {
        case "hello": return .hello(try HelloMessage(json: value))
        case "snapshot": return .snapshot(try SnapshotMessage(json: value))
        case "ack": return .ack(try AckMessage(json: value))
        case "openNative": return .openNative(try OpenNativeMessage(json: value))
        case "navigate": return .navigate(try NavigateMessage(json: value))
        case "projection":
            // Unbekannte Projektionen künftiger Web-Stände sind kein Fehler.
            guard case .string(let name)? = object["name"] else { throw BridgeDecodingError.invalidField("name") }
            switch name {
            case ProjectionMessage.overviewName: return .projection(try ProjectionMessage(json: value))
            case TrainingProjectionMessage.trainingName: return .trainingProjection(try TrainingProjectionMessage(json: value))
            case ProgressProjectionMessage.progressName: return .progressProjection(try ProgressProjectionMessage(json: value))
            case ActivityProjectionMessage.activityName: return .activityProjection(try ActivityProjectionMessage(json: value))
            default: return nil
            }
        case "chrome": return .chrome(try ChromeMessage(json: value))
        case "exerciseSearch": return .exerciseSearch(try ExerciseSearchMessage(json: value))
        case "progressResult": return .progressResult(try ProgressResultMessage(json: value))
        case "activityResult": return .activityResult(try ActivityResultMessage(json: value))
        default: return nil
        }
    }

    public static func decode(data: Data) throws -> InboundMessage? {
        try decode(JSONValue.parse(data, maxDepth: JSONLimits.bridgeDepth))
    }

    /// `WKScriptMessage.body`: Foundation-Baum oder ein JSON-String.
    public static func decode(foundation body: Any) throws -> InboundMessage? {
        if let text = body as? String {
            return try decode(JSONValue.parse(text, maxDepth: JSONLimits.bridgeDepth))
        }
        return try decode(JSONValue(foundation: body, maxDepth: JSONLimits.bridgeDepth))
    }

    public var json: JSONValue {
        switch self {
        case .hello(let message): return message.json
        case .snapshot(let message): return message.json
        case .ack(let message): return message.json
        case .openNative(let message): return message.json
        case .navigate(let message): return message.json
        case .projection(let message): return message.json
        case .chrome(let message): return message.json
        case .trainingProjection(let message): return message.json
        case .exerciseSearch(let message): return message.json
        case .progressProjection(let message): return message.json
        case .progressResult(let message): return message.json
        case .activityProjection(let message): return message.json
        case .activityResult(let message): return message.json
        }
    }
}

/// M3: `chrome{blocking, reason?, page?}`. Bei `blocking:true` sperrt Native Datum und Tabwechsel;
/// bei `reason` `session`/`run` blendet Native seine Leisten aus (Vollbild-Session im Web).
public struct ChromeMessage: Equatable, Sendable {
    public static let fullScreenReasons: Set<String> = ["session", "run"]

    public var blocking: Bool
    /// `modal | session | run | …`; unbekannte Werte bleiben erhalten.
    public var reason: String?
    public var page: String?
    /// Schlüssel der offenen Web-Kontounterseite (`plan`, `body`, …) oder `nil` (Übersicht/anderer Tab).
    public var accountSection: String?

    public init(blocking: Bool, reason: String? = nil, page: String? = nil, accountSection: String? = nil) {
        self.blocking = blocking
        self.reason = reason
        self.page = page
        self.accountSection = accountSection
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        blocking = try fields.requiredBool("blocking")
        reason = try fields.optionalString("reason")
        page = try fields.optionalString("page")
        accountSection = try fields.optionalString("accountSection")
    }

    /// Native Leisten weg, solange das Web eine Vollbild-Session zeigt.
    public var hidesNativeBars: Bool {
        blocking && reason.map(Self.fullScreenReasons.contains) == true
    }

    public var json: JSONValue {
        var object: [String: JSONValue] = [
            "type": .string("chrome"), "protocol": .number(Double(BridgeProtocol.version)), "blocking": .bool(blocking),
        ]
        if let reason { object["reason"] = .string(reason) }
        if let page { object["page"] = .string(page) }
        object["accountSection"] = accountSection.map(JSONValue.string) ?? .null
        return .object(object)
    }
}

public struct HelloMessage: Equatable, Sendable {
    public var webVersion: String?
    /// Vom Web ausführbare Befehle.
    public var ops: [String]
    /// Bereiche, die Native übernehmen darf.
    public var screens: [String]
    /// Anmeldung läuft bzw. Profilzuordnung ungeklärt: keine Snapshots, Befehle wie `not_ready` (Pflichtfeld).
    public var ownerPending: Bool
    /// M3: angekündigte Projektionen (`overview`). Fehlt bei älteren Web-Ständen (= leer).
    public var projections: [String]
    /// M3: vom Web unterstützte native Navigation (`nativeTabs`). Fehlt bei älteren Web-Ständen (= leer).
    public var features: [String]

    public init(webVersion: String? = nil, ops: [String] = [], screens: [String] = [], ownerPending: Bool = false,
                projections: [String] = [], features: [String] = []) {
        self.webVersion = webVersion
        self.ops = ops
        self.screens = screens
        self.ownerPending = ownerPending
        self.projections = projections
        self.features = features
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        if case .number(let number)? = fields["webVersion"] {
            webVersion = JSONValue.formatNumber(number)
        } else {
            webVersion = try fields.optionalString("webVersion")
        }
        ops = try fields.stringArray("ops")
        screens = try fields.stringArray("screens")
        ownerPending = try fields.requiredBool("ownerPending")
        projections = try fields.stringArray("projections")
        features = try fields.stringArray("features")
    }

    public var json: JSONValue {
        var object: [String: JSONValue] = [
            "type": .string("hello"),
            "protocol": .number(Double(BridgeProtocol.version)),
            "webVersion": webVersion.map(JSONValue.string) ?? .null,
            "ops": .array(ops.map(JSONValue.string)),
            "screens": .array(screens.map(JSONValue.string)),
            "ownerPending": .bool(ownerPending),
        ]
        if !projections.isEmpty { object["projections"] = .array(projections.map(JSONValue.string)) }
        if !features.isEmpty { object["features"] = .array(features.map(JSONValue.string)) }
        return .object(object)
    }
}

public struct CloudStatus: Equatable, Sendable {
    public var signedIn: Bool
    public var revision: Int?
    public var dirty: Bool
    public var conflict: Bool

    public init(signedIn: Bool = false, revision: Int? = nil, dirty: Bool = false, conflict: Bool = false) {
        self.signedIn = signedIn
        self.revision = revision
        self.dirty = dirty
        self.conflict = conflict
    }

    public static let unknown = CloudStatus()

    /// Fehlt das Feld, gilt `unknown`. Nur Anzeige/Diagnose: unerwartete Werttypen werden nachsichtig gelesen,
    /// damit ein Snapshot daran nicht scheitert (Flags dagegen werden streng geprüft).
    public init(json: JSONValue?) throws {
        guard let json, !json.isNull else {
            self = .unknown
            return
        }
        let fields = try Fields(json)
        signedIn = fields["signedIn"]?.boolValue ?? false
        revision = fields["revision"]?.intValue
        dirty = fields["dirty"]?.boolValue ?? false
        conflict = fields["conflict"]?.boolValue ?? false
    }

    public var json: JSONValue {
        .object([
            "signedIn": .bool(signedIn),
            "revision": revision.map { JSONValue.number(Double($0)) } ?? .null,
            "dirty": .bool(dirty),
            "conflict": .bool(conflict),
        ])
    }
}

public struct StateFlags: Equatable, Sendable {
    public var preview: Bool
    public var recovery: Bool
    public var uploadBlocked: Bool

    public init(preview: Bool = false, recovery: Bool = false, uploadBlocked: Bool = false) {
        self.preview = preview
        self.recovery = recovery
        self.uploadBlocked = uploadBlocked
    }

    public static let none = StateFlags()

    /// Schreibende Befehle beantwortet das Web dann mit `readonly` (Protokoll 4.1).
    public var isReadOnly: Bool { preview || recovery || uploadBlocked }

    public init(json: JSONValue?) throws {
        guard let json, !json.isNull else {
            self = .none
            return
        }
        let fields = try Fields(json)
        preview = try fields.bool("preview", default: false)
        recovery = try fields.bool("recovery", default: false)
        uploadBlocked = try fields.bool("uploadBlocked", default: false)
    }

    public var json: JSONValue {
        .object(["preview": .bool(preview), "recovery": .bool(recovery), "uploadBlocked": .bool(uploadBlocked)])
    }
}

public struct SnapshotMessage: Equatable, Sendable {
    public var seq: Int
    /// Supabase-Nutzer-ID oder `nil` (lokal ohne Konto).
    public var userId: String?
    /// Vollständiges Profil wie in `puls-v1`, immer ein Objekt.
    public var state: JSONValue
    public var cloud: CloudStatus
    public var flags: StateFlags
    /// `load | save | cloud | import | reset | migrate | autofinish | apply`; unbekannte Werte bleiben erhalten.
    public var reason: String
    /// Pflichtfeld; bei tatsächlich gesendeten Snapshots immer `false`. Ein Snapshot mit `true` wird nicht übernommen.
    public var ownerPending: Bool

    public init(seq: Int, userId: String?, state: JSONValue, cloud: CloudStatus = .unknown,
                flags: StateFlags = .none, reason: String = "save", ownerPending: Bool = false) {
        self.seq = seq
        self.userId = userId
        self.state = state
        self.cloud = cloud
        self.flags = flags
        self.reason = reason
        self.ownerPending = ownerPending
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        seq = try fields.int("seq")
        guard seq >= 0 else { throw BridgeDecodingError.invalidField("seq") }
        userId = try fields.optionalString("userId")
        guard let state = fields["state"] else { throw BridgeDecodingError.missingField("state") }
        guard case .object = state else { throw BridgeDecodingError.invalidField("state") }
        self.state = state
        cloud = try CloudStatus(json: fields["cloud"])
        flags = try StateFlags(json: fields["flags"])
        reason = try fields.optionalString("reason") ?? "unknown"
        ownerPending = try fields.requiredBool("ownerPending")
    }

    public var json: JSONValue {
        .object([
            "type": .string("snapshot"),
            "protocol": .number(Double(BridgeProtocol.version)),
            "seq": .number(Double(seq)),
            "userId": userId.map(JSONValue.string) ?? .null,
            "state": state,
            "cloud": cloud.json,
            "flags": flags.json,
            "reason": .string(reason),
            "ownerPending": .bool(ownerPending),
        ])
    }
}

/// Fehlercodes aus Protokoll Abschnitt 6.
public enum AckErrorCode: Hashable, Sendable {
    case invalid
    case wrongUser
    /// Aktueller Eintrag weicht von `args.expect` ab.
    case conflict
    case readonly
    case unknownOp
    case persistFailed
    case notReady
    /// M4: Ziel nicht mehr anwendbar (Workout beendet, Satz/Übung/Routine fehlt, Pause abgelaufen).
    /// Befehl endgültig verwerfen, nicht erneut senden.
    case gone
    /// M4: Ein Web-Dialog ist offen. Halten und nach `chrome` ohne `reason:'modal'` erneut senden.
    case busy
    case other(String)

    public init(code: String) {
        switch code {
        case "invalid": self = .invalid
        case "wrong_user": self = .wrongUser
        case "conflict": self = .conflict
        case "readonly": self = .readonly
        case "unknown_op": self = .unknownOp
        case "persist_failed": self = .persistFailed
        case "not_ready": self = .notReady
        case "gone": self = .gone
        case "busy": self = .busy
        default: self = .other(code)
        }
    }

    public var code: String {
        switch self {
        case .invalid: return "invalid"
        case .wrongUser: return "wrong_user"
        case .conflict: return "conflict"
        case .readonly: return "readonly"
        case .unknownOp: return "unknown_op"
        case .persistFailed: return "persist_failed"
        case .notReady: return "not_ready"
        case .gone: return "gone"
        case .busy: return "busy"
        case .other(let code): return code
        }
    }
}

public struct AckError: Equatable, Sendable {
    public var code: AckErrorCode
    public var message: String?

    public init(code: AckErrorCode, message: String? = nil) {
        self.code = code
        self.message = message
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        code = AckErrorCode(code: try fields.string("code"))
        message = try fields.optionalString("message")
    }

    public var json: JSONValue {
        .object(["code": .string(code.code), "message": message.map(JSONValue.string) ?? .null])
    }
}

public struct AckMessage: Equatable, Sendable {
    public var id: String
    public var ok: Bool
    public var seq: Int?
    public var error: AckError?
    /// M4: kleines Ergebnis-Objekt bei `ok:true` (z. B. `{workoutId, started}`). Nur Objekte; sonst `nil`.
    public var result: JSONValue?

    public init(id: String, ok: Bool, seq: Int? = nil, error: AckError? = nil, result: JSONValue? = nil) {
        self.id = id
        self.ok = ok
        self.seq = seq
        self.error = error
        self.result = result
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        id = try fields.nonEmptyString("id")
        ok = try fields.requiredBool("ok")
        seq = try fields.optionalInt("seq")
        switch fields["error"] {
        case nil, .null?: error = nil
        case let value?: error = try AckError(json: value)
        }
        // Nachsichtig: ein unerwartetes `result` darf das Ack selbst nicht verwerfen (sonst bliebe der Befehl offen).
        if case .object? = fields["result"] { result = fields["result"] } else { result = nil }
    }

    public var json: JSONValue {
        var object: [String: JSONValue] = [
            "type": .string("ack"),
            "protocol": .number(Double(BridgeProtocol.version)),
            "id": .string(id),
            "ok": .bool(ok),
        ]
        if let seq { object["seq"] = .number(Double(seq)) }
        if let error { object["error"] = error.json }
        if let result { object["result"] = result }
        return .object(object)
    }
}

public struct OpenNativeMessage: Equatable, Sendable {
    public var screen: String
    /// M4: `screen:"training"` nennt das aktive Workout.
    public var workoutId: String?
    /// M6: `screen:"activity"` nennt die aktive Aktivität (`startedAt`) oder `null` (Startansicht). Nachsichtig gelesen:
    /// ein unerwarteter Wert darf das Öffnen nicht verhindern (Native muss immer etwas zeigen).
    public var startedAt: Double?
    /// M6: „Diese Route nehmen“ im Web-Routenblatt: Native wählt diese Route in seiner Startansicht vor.
    public var routeId: String?

    public init(screen: String, workoutId: String? = nil, startedAt: Double? = nil, routeId: String? = nil) {
        self.screen = screen
        self.workoutId = workoutId
        self.startedAt = startedAt
        self.routeId = routeId
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        screen = try fields.nonEmptyString("screen")
        workoutId = try fields.optionalString("workoutId")
        if let value = fields["startedAt"]?.doubleValue, value.isFinite { startedAt = value } else { startedAt = nil }
        if let value = fields["routeId"]?.stringValue, !value.isEmpty { routeId = value } else { routeId = nil }
    }

    public var json: JSONValue {
        var object: [String: JSONValue] = [
            "type": .string("openNative"), "protocol": .number(Double(BridgeProtocol.version)), "screen": .string(screen),
        ]
        if let workoutId { object["workoutId"] = .string(workoutId) }
        if let startedAt { object["startedAt"] = .number(startedAt) }
        if let routeId { object["routeId"] = .string(routeId) }
        return .object(object)
    }
}

public struct NavigateMessage: Equatable, Sendable {
    public var page: String
    /// M3: `true`, wenn Native ausdrücklich die Web-Ansicht angefordert hat (`pulsNativeNavigate({…, web:true})`).
    /// Dann auch bei gleicher Seite gesendet; Native zeigt die Web-Seite statt des nativen Bereichs.
    public var web: Bool

    public init(page: String, web: Bool = false) {
        self.page = page
        self.web = web
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        page = try fields.nonEmptyString("page")
        web = try fields.bool("web", default: false)
    }

    public var json: JSONValue {
        var object: [String: JSONValue] = [
            "type": .string("navigate"), "protocol": .number(Double(BridgeProtocol.version)), "page": .string(page),
        ]
        if web { object["web"] = .bool(true) }
        return .object(object)
    }
}

// MARK: - Native → Web

/// Argument für `window.pulsNativeApply(cmd)`.
public struct ApplyCommand: Equatable, Sendable {
    public var id: String
    /// Muss zur Web-Session passen; `nil` = lokal ohne Konto (wird als `null` gesendet).
    public var userId: String?
    /// Spiegel-Stand bei Erzeugung, nur Diagnose.
    public var baseSeq: Int
    public var op: String
    public var args: JSONValue

    public init(id: String, userId: String?, baseSeq: Int, op: String, args: JSONValue) {
        self.id = id
        self.userId = userId
        self.baseSeq = baseSeq
        self.op = op
        self.args = args
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        id = try fields.nonEmptyString("id")
        userId = try fields.optionalString("userId")
        baseSeq = try fields.int("baseSeq")
        op = try fields.nonEmptyString("op")
        guard let args = fields["args"] else { throw BridgeDecodingError.missingField("args") }
        guard case .object = args else { throw BridgeDecodingError.invalidField("args") }
        self.args = args
    }

    public var json: JSONValue {
        .object([
            "id": .string(id),
            "userId": userId.map(JSONValue.string) ?? .null,
            "baseSeq": .number(Double(baseSeq)),
            "op": .string(op),
            "args": args,
        ])
    }
}

// MARK: - Codable (über denselben JSON-Weg, damit es genau eine Abbildung gibt)

extension HelloMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

extension SnapshotMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

extension AckMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

extension OpenNativeMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

extension NavigateMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

extension ApplyCommand: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

// MARK: - Feldleser

/// Strenger Leser für Objektfelder: falscher Typ ist ein Fehler, fehlende optionale Felder nicht.
struct Fields {
    let values: [String: JSONValue]

    init(_ value: JSONValue) throws {
        guard case .object(let object) = value else { throw BridgeDecodingError.notAnObject }
        values = object
    }

    subscript(key: String) -> JSONValue? {
        values[key]
    }

    func string(_ key: String) throws -> String {
        guard let value = values[key] else { throw BridgeDecodingError.missingField(key) }
        guard case .string(let text) = value else { throw BridgeDecodingError.invalidField(key) }
        return text
    }

    func nonEmptyString(_ key: String) throws -> String {
        let text = try string(key)
        guard !text.isEmpty else { throw BridgeDecodingError.invalidField(key) }
        return text
    }

    func optionalString(_ key: String) throws -> String? {
        switch values[key] {
        case nil, .null?: return nil
        case .string(let text)?: return text
        default: throw BridgeDecodingError.invalidField(key)
        }
    }

    func int(_ key: String) throws -> Int {
        guard let value = values[key] else { throw BridgeDecodingError.missingField(key) }
        guard case .number(let number) = value, let integer = Int(exactly: number) else {
            throw BridgeDecodingError.invalidField(key)
        }
        return integer
    }

    func optionalInt(_ key: String) throws -> Int? {
        switch values[key] {
        case nil, .null?: return nil
        case .number(let number)?:
            guard let integer = Int(exactly: number) else { throw BridgeDecodingError.invalidField(key) }
            return integer
        default: throw BridgeDecodingError.invalidField(key)
        }
    }

    func requiredBool(_ key: String) throws -> Bool {
        guard let value = values[key] else { throw BridgeDecodingError.missingField(key) }
        guard case .bool(let flag) = value else { throw BridgeDecodingError.invalidField(key) }
        return flag
    }

    func bool(_ key: String, default defaultValue: Bool) throws -> Bool {
        switch values[key] {
        case nil, .null?: return defaultValue
        case .bool(let flag)?: return flag
        default: throw BridgeDecodingError.invalidField(key)
        }
    }

    func stringArray(_ key: String) throws -> [String] {
        switch values[key] {
        case nil, .null?: return []
        case .array(let items)?:
            return try items.map { item -> String in
                guard case .string(let text) = item else { throw BridgeDecodingError.invalidField(key) }
                return text
            }
        default: throw BridgeDecodingError.invalidField(key)
        }
    }
}
