import Foundation

/// Verlustfreier JSON-Baum für das Web-Profil (`localStorage['puls-v1']`) und die Brückennachrichten.
///
/// - Zahlen sind `Double`, genau wie in JavaScript. Jede Zahl, die `JSON.stringify` erzeugt, ist damit exakt
///   darstellbar. Ganzzahlige Werte unter 2^53 werden ohne `.0` ausgegeben (siehe `JSONValue.formatNumber`).
/// - Objekt-Schlüsselreihenfolge wird nicht erhalten, der Inhalt vollständig (auch unbekannte Felder).
/// - Einzelne UTF-16-Surrogate (in JS möglich, in Swift-Strings nicht) werden beim Einlesen zu U+FFFD.
public enum JSONValue: Hashable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
}

/// Verschachtelungsgrenzen, einheitlich für Leser, Foundation-Eingang und Schreiber.
/// Ebene = Anzahl verschachtelter Objekte/Listen; ein flaches Objekt hat Tiefe 1.
public enum JSONLimits {
    /// Höchste Tiefe, die der Leser (Spiegel, Outbox, JSON-Strings) akzeptiert und die geschrieben wird.
    public static let maxDepth = 512
    /// Höchste Tiefe einer Brückennachricht bzw. von Befehls-`args`. Die Reserve deckt die Umschläge beim
    /// Speichern ab (Spiegel: +1 um `state`, Outbox: +4 um `args`), damit alles Angenommene wieder lesbar ist.
    public static let bridgeDepth = 500
}

public enum JSONError: Error, Equatable, Sendable {
    case syntax(offset: Int, reason: String)
    case nestingTooDeep(offset: Int)
    case unsupportedType(String)
    case nonFiniteNumber
}

// MARK: - Zugriff

extension JSONValue {
    public var isNull: Bool {
        if case .null = self { return true }
        return false
    }

    public var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    public var doubleValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    /// Nur für ganzzahlige Zahlen im `Int`-Bereich.
    public var intValue: Int? {
        if case .number(let value) = self { return Int(exactly: value) }
        return nil
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    /// Lesen: Wert zum Schlüssel, wenn `self` ein Objekt ist.
    /// Schreiben: nur auf Objekten wirksam; `nil` entfernt den Schlüssel. Andere Schlüssel bleiben unangetastet.
    public subscript(key: String) -> JSONValue? {
        get {
            if case .object(let object) = self { return object[key] }
            return nil
        }
        set {
            guard case .object(var object) = self else { return }
            object[key] = newValue
            self = .object(object)
        }
    }

    /// Verschachtelungstiefe (Skalare 0, flaches Objekt/Liste 1). Bricht ab, sobald `limit` überschritten ist.
    public func depth(limit: Int = Int.max) -> Int {
        switch self {
        case .array(let array):
            guard limit > 0 else { return 1 }
            return 1 + (array.map { $0.depth(limit: limit - 1) }.max() ?? 0)
        case .object(let object):
            guard limit > 0 else { return 1 }
            return 1 + (object.values.map { $0.depth(limit: limit - 1) }.max() ?? 0)
        default:
            return 0
        }
    }

    /// `true`, wenn die Tiefe höchstens `maxDepth` ist.
    public func fitsDepth(_ maxDepth: Int) -> Bool {
        depth(limit: maxDepth) <= maxDepth
    }

    public subscript(index: Int) -> JSONValue? {
        guard case .array(let array) = self, array.indices.contains(index) else { return nil }
        return array[index]
    }
}

// MARK: - Literale (vor allem für Tests und feste Nachrichten)

extension JSONValue: ExpressibleByBooleanLiteral, ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral,
    ExpressibleByStringLiteral, ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral {
    public init(booleanLiteral value: Bool) { self = .bool(value) }
    public init(integerLiteral value: Int) { self = .number(Double(value)) }
    public init(floatLiteral value: Double) { self = .number(value) }
    public init(stringLiteral value: String) { self = .string(value) }
    public init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    public init(dictionaryLiteral elements: (String, JSONValue)...) {
        self = .object(Dictionary(elements, uniquingKeysWith: { _, last in last }))
    }
}

// MARK: - Foundation-Objekte (WKScriptMessage.body, JSONSerialization)

extension JSONValue {
    /// Wandelt einen Foundation-Baum (NSDictionary, NSArray, NSString, NSNumber, NSNull) verlustfrei um.
    /// Wahrheitswerte werden über `CFBoolean` von Zahlen unterschieden. Tiefer als `maxDepth` → Fehler.
    public init(foundation object: Any, maxDepth: Int = JSONLimits.maxDepth) throws {
        try self.init(foundation: object, remainingDepth: maxDepth)
    }

    private init(foundation object: Any, remainingDepth: Int) throws {
        switch object {
        case is NSNull:
            self = .null
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                self = .bool(number.boolValue)
            } else {
                let value = number.doubleValue
                guard value.isFinite else { throw JSONError.nonFiniteNumber }
                self = .number(value)
            }
        case let string as String:
            self = .string(string)
        case let array as [Any]:
            guard remainingDepth > 0 else { throw JSONError.nestingTooDeep(offset: 0) }
            self = .array(try array.map { try JSONValue(foundation: $0, remainingDepth: remainingDepth - 1) })
        case let dictionary as [String: Any]:
            guard remainingDepth > 0 else { throw JSONError.nestingTooDeep(offset: 0) }
            var object = [String: JSONValue](minimumCapacity: dictionary.count)
            for (key, value) in dictionary {
                object[key] = try JSONValue(foundation: value, remainingDepth: remainingDepth - 1)
            }
            self = .object(object)
        default:
            throw JSONError.unsupportedType(String(describing: type(of: object)))
        }
    }
}

// MARK: - Codable (für Einbettung in Codable-Typen; Dateien und JS nutzen `serialized()`)

extension JSONValue: Codable {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Kein gültiger JSON-Wert")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()
        case .bool(let value):
            try container.encode(value)
        case .number(let value):
            if let integer = JSONValue.exactInteger(value) {
                try container.encode(integer)
            } else if value.isFinite {
                try container.encode(value)
            } else {
                try container.encodeNil()
            }
        case .string(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        }
    }
}

// MARK: - Zahlen

extension JSONValue {
    /// 2^53: bis hierhin sind alle Ganzzahlen als Double exakt.
    static let maxExactInteger: Double = 9_007_199_254_740_992

    static func exactInteger(_ value: Double) -> Int64? {
        guard value.isFinite, value.rounded(.towardZero) == value, abs(value) < maxExactInteger else { return nil }
        return Int64(value)
    }

    /// JSON-Text einer Zahl: Ganzzahlen ohne `.0` (wie `JSON.stringify`), sonst kürzeste exakte Darstellung.
    /// `-0` wird wie in JavaScript zu `0`. Nicht-endliche Werte gibt es in JSON nicht und werden `null`.
    public static func formatNumber(_ value: Double) -> String {
        guard value.isFinite else { return "null" }
        if let integer = exactInteger(value) { return String(integer) }
        return "\(value)"
    }
}
