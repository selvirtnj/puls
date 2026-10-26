import Foundation

// Eigener Leser/Schreiber statt JSONSerialization: Zahlen werden exakt mit `Double(String)` gelesen
// (keine NSDecimalNumber-Umwege), Wahrheitswerte sind eindeutig, und die Ausgabe ist deterministisch.

extension JSONValue {
    /// Liest genau einen JSON-Wert (UTF-8, optional mit BOM). Zusätzliche Zeichen danach sind ein Fehler,
    /// ebenso eine Verschachtelung tiefer als `maxDepth`.
    public static func parse(_ data: Data, maxDepth: Int = JSONLimits.maxDepth) throws -> JSONValue {
        try data.withUnsafeBytes { raw -> JSONValue in
            var parser = JSONParser(bytes: raw.bindMemory(to: UInt8.self), maxDepth: maxDepth)
            return try parser.parseDocument()
        }
    }

    public static func parse(_ text: String, maxDepth: Int = JSONLimits.maxDepth) throws -> JSONValue {
        try parse(Data(text.utf8), maxDepth: maxDepth)
    }

    /// Kompakter JSON-Text. `sortedKeys` macht die Ausgabe deterministisch (Standard).
    /// U+2028/U+2029 werden maskiert, damit der Text auch als JavaScript-Ausdruck gültig ist.
    /// Wer Dateien schreibt, prüft vorher `fitsDepth(JSONLimits.maxDepth)`, damit der Leser sie wieder annimmt.
    public func serialized(sortedKeys: Bool = true) -> Data {
        var writer = JSONWriter(sortedKeys: sortedKeys)
        writer.write(self)
        return Data(writer.output)
    }

    public func serializedString(sortedKeys: Bool = true) -> String {
        var writer = JSONWriter(sortedKeys: sortedKeys)
        writer.write(self)
        return String(decoding: writer.output, as: UTF8.self)
    }
}

// MARK: - Leser

private enum Byte {
    static let quote: UInt8 = 0x22         // "
    static let backslash: UInt8 = 0x5C     // \
    static let slash: UInt8 = 0x2F         // /
    static let comma: UInt8 = 0x2C         // ,
    static let colon: UInt8 = 0x3A         // :
    static let openBrace: UInt8 = 0x7B     // {
    static let closeBrace: UInt8 = 0x7D    // }
    static let openBracket: UInt8 = 0x5B   // [
    static let closeBracket: UInt8 = 0x5D  // ]
    static let minus: UInt8 = 0x2D         // -
    static let plus: UInt8 = 0x2B          // +
    static let dot: UInt8 = 0x2E           // .
    static let zero: UInt8 = 0x30          // 0
    static let nine: UInt8 = 0x39          // 9
    static let lowerE: UInt8 = 0x65        // e
    static let upperE: UInt8 = 0x45        // E
    static let lowerB: UInt8 = 0x62        // b
    static let lowerF: UInt8 = 0x66        // f
    static let lowerN: UInt8 = 0x6E        // n
    static let lowerR: UInt8 = 0x72        // r
    static let lowerT: UInt8 = 0x74        // t
    static let lowerU: UInt8 = 0x75        // u
    static let space: UInt8 = 0x20
    static let tab: UInt8 = 0x09
    static let newline: UInt8 = 0x0A
    static let carriageReturn: UInt8 = 0x0D
}

struct JSONParser {
    static let maxDepth = JSONLimits.maxDepth
    private static let replacement: Unicode.Scalar = "\u{FFFD}"

    let bytes: UnsafeBufferPointer<UInt8>
    let maxDepth: Int
    private(set) var index = 0
    private var depth = 0

    init(bytes: UnsafeBufferPointer<UInt8>, maxDepth: Int = JSONLimits.maxDepth) {
        self.bytes = bytes
        self.maxDepth = maxDepth
    }

    mutating func parseDocument() throws -> JSONValue {
        if bytes.count >= 3, bytes[0] == 0xEF, bytes[1] == 0xBB, bytes[2] == 0xBF { index = 3 }
        skipWhitespace()
        let value = try parseValue()
        skipWhitespace()
        guard index == bytes.count else { throw failure("Zusätzliche Zeichen nach dem JSON-Wert") }
        return value
    }

    private func failure(_ reason: String) -> JSONError {
        .syntax(offset: index, reason: reason)
    }

    private mutating func skipWhitespace() {
        while index < bytes.count {
            switch bytes[index] {
            case Byte.space, Byte.tab, Byte.newline, Byte.carriageReturn: index += 1
            default: return
            }
        }
    }

    private static func isDigit(_ byte: UInt8) -> Bool {
        byte >= Byte.zero && byte <= Byte.nine
    }

    private mutating func parseValue() throws -> JSONValue {
        guard index < bytes.count else { throw failure("Unerwartetes Ende") }
        switch bytes[index] {
        case Byte.openBrace: return try parseObject()
        case Byte.openBracket: return try parseArray()
        case Byte.quote: return .string(try parseString())
        case Byte.lowerT:
            try expectLiteral("true")
            return .bool(true)
        case Byte.lowerF:
            try expectLiteral("false")
            return .bool(false)
        case Byte.lowerN:
            try expectLiteral("null")
            return .null
        case Byte.minus, Byte.zero...Byte.nine:
            return .number(try parseNumber())
        default:
            throw failure("Unerwartetes Zeichen")
        }
    }

    private mutating func expectLiteral(_ literal: StaticString) throws {
        let count = literal.utf8CodeUnitCount
        guard index + count <= bytes.count else { throw failure("Unvollständiges Literal") }
        let expected = literal.utf8Start
        for offset in 0..<count where bytes[index + offset] != expected[offset] {
            throw failure("Ungültiges Literal")
        }
        index += count
    }

    private mutating func enterContainer() throws {
        depth += 1
        guard depth <= maxDepth else { throw JSONError.nestingTooDeep(offset: index) }
    }

    private mutating func parseObject() throws -> JSONValue {
        try enterContainer()
        defer { depth -= 1 }
        index += 1 // {
        var object: [String: JSONValue] = [:]
        skipWhitespace()
        if index < bytes.count, bytes[index] == Byte.closeBrace {
            index += 1
            return .object(object)
        }
        while true {
            skipWhitespace()
            guard index < bytes.count, bytes[index] == Byte.quote else { throw failure("Schlüssel erwartet") }
            let key = try parseString()
            skipWhitespace()
            guard index < bytes.count, bytes[index] == Byte.colon else { throw failure("':' erwartet") }
            index += 1
            skipWhitespace()
            // Doppelte Schlüssel: der letzte gewinnt, wie bei JSON.parse.
            object[key] = try parseValue()
            skipWhitespace()
            guard index < bytes.count else { throw failure("Objekt nicht beendet") }
            if bytes[index] == Byte.comma {
                index += 1
                continue
            }
            if bytes[index] == Byte.closeBrace {
                index += 1
                return .object(object)
            }
            throw failure("',' oder '}' erwartet")
        }
    }

    private mutating func parseArray() throws -> JSONValue {
        try enterContainer()
        defer { depth -= 1 }
        index += 1 // [
        var array: [JSONValue] = []
        skipWhitespace()
        if index < bytes.count, bytes[index] == Byte.closeBracket {
            index += 1
            return .array(array)
        }
        while true {
            skipWhitespace()
            array.append(try parseValue())
            skipWhitespace()
            guard index < bytes.count else { throw failure("Liste nicht beendet") }
            if bytes[index] == Byte.comma {
                index += 1
                continue
            }
            if bytes[index] == Byte.closeBracket {
                index += 1
                return .array(array)
            }
            throw failure("',' oder ']' erwartet")
        }
    }

    private mutating func parseString() throws -> String {
        index += 1 // öffnendes "
        let start = index
        // Schneller Weg ohne Escapes.
        while index < bytes.count {
            let byte = bytes[index]
            if byte == Byte.quote {
                let text = String(decoding: UnsafeBufferPointer(rebasing: bytes[start..<index]), as: UTF8.self)
                index += 1
                return text
            }
            if byte == Byte.backslash { break }
            if byte < 0x20 { throw failure("Steuerzeichen in Zeichenkette") }
            index += 1
        }
        guard index < bytes.count else { throw failure("Zeichenkette nicht beendet") }

        var buffer = [UInt8](bytes[start..<index])
        while index < bytes.count {
            let byte = bytes[index]
            if byte == Byte.quote {
                index += 1
                return String(decoding: buffer, as: UTF8.self)
            }
            if byte == Byte.backslash {
                index += 1
                guard index < bytes.count else { throw failure("Escape nicht beendet") }
                let escape = bytes[index]
                index += 1
                switch escape {
                case Byte.quote: buffer.append(Byte.quote)
                case Byte.backslash: buffer.append(Byte.backslash)
                case Byte.slash: buffer.append(Byte.slash)
                case Byte.lowerB: buffer.append(0x08)
                case Byte.lowerF: buffer.append(0x0C)
                case Byte.lowerN: buffer.append(0x0A)
                case Byte.lowerR: buffer.append(0x0D)
                case Byte.lowerT: buffer.append(0x09)
                case Byte.lowerU:
                    let scalar = try parseUnicodeEscape()
                    UTF8.encode(scalar) { buffer.append($0) }
                default:
                    throw failure("Ungültiges Escape")
                }
                continue
            }
            if byte < 0x20 { throw failure("Steuerzeichen in Zeichenkette") }
            buffer.append(byte)
            index += 1
        }
        throw failure("Zeichenkette nicht beendet")
    }

    private mutating func parseHex4() throws -> UInt16 {
        guard index + 4 <= bytes.count else { throw failure("\\u-Sequenz unvollständig") }
        var value: UInt16 = 0
        for _ in 0..<4 {
            let byte = bytes[index]
            index += 1
            let digit: UInt16
            switch byte {
            case 0x30...0x39: digit = UInt16(byte - 0x30)
            case 0x41...0x46: digit = UInt16(byte - 0x41 + 10)
            case 0x61...0x66: digit = UInt16(byte - 0x61 + 10)
            default: throw failure("Ungültige \\u-Sequenz")
            }
            value = (value << 4) | digit
        }
        return value
    }

    /// Nach `\u`: liest ein Zeichen, verbindet Surrogatpaare; einzelne Surrogate werden U+FFFD.
    private mutating func parseUnicodeEscape() throws -> Unicode.Scalar {
        let first = try parseHex4()
        if UTF16.isLeadSurrogate(first) {
            if index + 6 <= bytes.count, bytes[index] == Byte.backslash, bytes[index + 1] == Byte.lowerU {
                let resume = index
                index += 2
                let second = try parseHex4()
                if UTF16.isTrailSurrogate(second) {
                    let value = 0x10000 + ((UInt32(first) - 0xD800) << 10) + (UInt32(second) - 0xDC00)
                    return Unicode.Scalar(value) ?? Self.replacement
                }
                index = resume // nächstes Escape eigenständig lesen
            }
            return Self.replacement
        }
        if UTF16.isTrailSurrogate(first) { return Self.replacement }
        return Unicode.Scalar(first) ?? Self.replacement
    }

    private mutating func parseNumber() throws -> Double {
        let start = index
        if bytes[index] == Byte.minus { index += 1 }
        guard index < bytes.count else { throw failure("Zahl unvollständig") }
        if bytes[index] == Byte.zero {
            index += 1
        } else if Self.isDigit(bytes[index]) {
            while index < bytes.count, Self.isDigit(bytes[index]) { index += 1 }
        } else {
            throw failure("Ziffer erwartet")
        }
        if index < bytes.count, bytes[index] == Byte.dot {
            index += 1
            guard index < bytes.count, Self.isDigit(bytes[index]) else { throw failure("Nachkommastelle erwartet") }
            while index < bytes.count, Self.isDigit(bytes[index]) { index += 1 }
        }
        if index < bytes.count, bytes[index] == Byte.lowerE || bytes[index] == Byte.upperE {
            index += 1
            if index < bytes.count, bytes[index] == Byte.plus || bytes[index] == Byte.minus { index += 1 }
            guard index < bytes.count, Self.isDigit(bytes[index]) else { throw failure("Exponent erwartet") }
            while index < bytes.count, Self.isDigit(bytes[index]) { index += 1 }
        }
        let text = String(decoding: UnsafeBufferPointer(rebasing: bytes[start..<index]), as: UTF8.self)
        guard let value = Double(text), value.isFinite else { throw failure("Zahl außerhalb des Bereichs") }
        return value
    }
}

// MARK: - Schreiber

struct JSONWriter {
    private static let hexDigits: [UInt8] = Array("0123456789abcdef".utf8)

    let sortedKeys: Bool
    private(set) var output: [UInt8] = []

    init(sortedKeys: Bool) {
        self.sortedKeys = sortedKeys
    }

    mutating func write(_ value: JSONValue) {
        switch value {
        case .null:
            output.append(contentsOf: "null".utf8)
        case .bool(let flag):
            output.append(contentsOf: (flag ? "true" : "false").utf8)
        case .number(let number):
            output.append(contentsOf: JSONValue.formatNumber(number).utf8)
        case .string(let text):
            writeString(text)
        case .array(let array):
            output.append(Byte.openBracket)
            for (offset, element) in array.enumerated() {
                if offset > 0 { output.append(Byte.comma) }
                write(element)
            }
            output.append(Byte.closeBracket)
        case .object(let object):
            output.append(Byte.openBrace)
            var first = true
            let pairs: [(key: String, value: JSONValue)] = sortedKeys
                ? object.sorted(by: { $0.key < $1.key })
                : Array(object)
            for (key, element) in pairs {
                if !first { output.append(Byte.comma) }
                first = false
                writeString(key)
                output.append(Byte.colon)
                write(element)
            }
            output.append(Byte.closeBrace)
        }
    }

    private mutating func writeString(_ text: String) {
        output.append(Byte.quote)
        for scalar in text.unicodeScalars {
            switch scalar.value {
            case 0x22: output.append(contentsOf: [Byte.backslash, Byte.quote])
            case 0x5C: output.append(contentsOf: [Byte.backslash, Byte.backslash])
            case 0x0A: output.append(contentsOf: [Byte.backslash, Byte.lowerN])
            case 0x0D: output.append(contentsOf: [Byte.backslash, Byte.lowerR])
            case 0x09: output.append(contentsOf: [Byte.backslash, Byte.lowerT])
            case 0x08: output.append(contentsOf: [Byte.backslash, Byte.lowerB])
            case 0x0C: output.append(contentsOf: [Byte.backslash, Byte.lowerF])
            case 0x00..<0x20, 0x2028, 0x2029:
                writeUnicodeEscape(scalar.value)
            case 0x20..<0x80:
                output.append(UInt8(scalar.value))
            default:
                UTF8.encode(scalar) { output.append($0) }
            }
        }
        output.append(Byte.quote)
    }

    private mutating func writeUnicodeEscape(_ value: UInt32) {
        output.append(Byte.backslash)
        output.append(Byte.lowerU)
        for shift in stride(from: 12, through: 0, by: -4) {
            output.append(Self.hexDigits[Int((value >> UInt32(shift)) & 0xF)])
        }
    }
}
