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
        }
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

    public init(webVersion: String? = nil, ops: [String] = [], screens: [String] = [], ownerPending: Bool = false) {
        self.webVersion = webVersion
        self.ops = ops
        self.screens = screens
        self.ownerPending = ownerPending
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
    }

    public var json: JSONValue {
        .object([
            "type": .string("hello"),
            "protocol": .number(Double(BridgeProtocol.version)),
            "webVersion": webVersion.map(JSONValue.string) ?? .null,
            "ops": .array(ops.map(JSONValue.string)),
            "screens": .array(screens.map(JSONValue.string)),
            "ownerPending": .bool(ownerPending),
        ])
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

    public init(id: String, ok: Bool, seq: Int? = nil, error: AckError? = nil) {
        self.id = id
        self.ok = ok
        self.seq = seq
        self.error = error
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
        return .object(object)
    }
}

public struct OpenNativeMessage: Equatable, Sendable {
    public var screen: String

    public init(screen: String) {
        self.screen = screen
    }

    public init(json: JSONValue) throws {
        screen = try Fields(json).nonEmptyString("screen")
    }

    public var json: JSONValue {
        .object(["type": .string("openNative"), "protocol": .number(Double(BridgeProtocol.version)), "screen": .string(screen)])
    }
}

public struct NavigateMessage: Equatable, Sendable {
    public var page: String

    public init(page: String) {
        self.page = page
    }

    public init(json: JSONValue) throws {
        page = try Fields(json).nonEmptyString("page")
    }

    public var json: JSONValue {
        .object(["type": .string("navigate"), "protocol": .number(Double(BridgeProtocol.version)), "page": .string(page)])
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
