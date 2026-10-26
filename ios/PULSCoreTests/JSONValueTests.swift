import Foundation
import XCTest
@testable import PULSCore

final class JSONValueTests: XCTestCase {
    // MARK: Round-Trip des vollständigen Fixture-Profils

    func testProfileRoundTripIsSemanticallyIdentical() throws {
        let original = try Fixtures.data("profile-full")
        let parsed = try JSONValue.parse(original)
        let written = parsed.serialized()
        let reparsed = try JSONValue.parse(written)
        XCTAssertEqual(parsed, reparsed)
        // Zweiter Durchlauf ist byte-identisch (deterministische Ausgabe).
        XCTAssertEqual(reparsed.serialized(), written)

        // Unabhängige Gegenprobe mit Foundation.
        let foundationOriginal = try XCTUnwrap(JSONSerialization.jsonObject(with: original) as? NSDictionary)
        let foundationWritten = try XCTUnwrap(JSONSerialization.jsonObject(with: written) as? NSDictionary)
        XCTAssertEqual(foundationOriginal, foundationWritten)
        // Weg über einen Foundation-Baum wie bei WKScriptMessage.body.
        XCTAssertEqual(try JSONValue(foundation: foundationObject(parsed)), parsed)
    }

    func testProfileRoundTripKeepsUnknownFieldsOnAllLevels() throws {
        let value = try JSONValue.parse(Fixtures.value("profile-full").serialized())

        XCTAssertEqual(value["goals"]?["xFutureGoalField"], "keep-me")
        let nested: JSONValue = [1, 2.5, .null, true]
        XCTAssertEqual(value["foods"]?[1]?["xUnknownFoodField"]?["nested"], nested)
        XCTAssertEqual(value["weights"]?[2]?["xWeightNote"], "unknown-field")

        let deep = try XCTUnwrap(value["xFutureTopLevel"]?["deep"])
        let deeper: JSONValue = [["a": 1], ["b": "zwei"]]
        XCTAssertEqual(deep["deeper"], deeper)
        XCTAssertEqual(deep["big"], .number(1_761_480_000_000))
        XCTAssertEqual(deep["neg"], .number(-12.75))
        XCTAssertEqual(deep["empty"], .object([:]))
        XCTAssertEqual(deep["emptyList"], .array([]))

        // null und leere Satzwerte bleiben, was sie sind.
        XCTAssertEqual(value["activeRun"], .null)
        XCTAssertEqual(value["workouts"]?[0]?["rest"], .null)
        XCTAssertEqual(value["workouts"]?[0]?["exercises"]?[0]?["sets"]?[2]?["kg"], "")
        XCTAssertEqual(value["workouts"]?[0]?["exercises"]?[0]?["sets"]?[2]?["done"], false)
    }

    func testIntegersAreWrittenWithoutFraction() throws {
        let text = try Fixtures.value("profile-full").serializedString()
        XCTAssertTrue(text.contains("\"big\":1761480000000"))
        XCTAssertFalse(text.contains("1761480000000.0"))
        XCTAssertTrue(text.contains("\"neg\":-12.75"))
        XCTAssertTrue(text.contains("\"kg\":84.2"))
        XCTAssertTrue(text.contains("\"version\":2"))
        XCTAssertFalse(text.contains("\"version\":2.0"))
    }

    func testNumberFormatting() {
        XCTAssertEqual(JSONValue.formatNumber(2300), "2300")
        XCTAssertEqual(JSONValue.formatNumber(-0.0), "0")
        XCTAssertEqual(JSONValue.formatNumber(82.4), "82.4")
        XCTAssertEqual(JSONValue.formatNumber(0.1 + 0.2), "0.30000000000000004")
        XCTAssertEqual(JSONValue.formatNumber(1_761_480_000_000), "1761480000000")
        XCTAssertEqual(JSONValue.formatNumber(-9_007_199_254_740_991), "-9007199254740991")
        XCTAssertEqual(JSONValue.formatNumber(.infinity), "null")
    }

    func testNumbersRoundTripExactly() throws {
        let samples: [Double] = [
            0, -0.0, 1, -1, 82.4, 0.1, 0.1 + 0.2, 1e21, 1e-7, 5e-324, 1.7976931348623157e308,
            9_007_199_254_740_991, 9_007_199_254_740_992, 123_456_789.123_456_78, -12.75, 2.5e-5,
        ]
        for sample in samples {
            let text = JSONValue.number(sample).serializedString()
            let back = try JSONValue.parse(text)
            XCTAssertEqual(back.doubleValue, sample, "Zahl \(sample) als \(text)")
        }
    }

    // MARK: Zeichenketten

    func testStringEscapesAreDecoded() throws {
        let value = try JSONValue.parse(#""a\"b\\c\/d\n\t\u00e9\ud83d\ude00""#)
        XCTAssertEqual(value, .string("a\"b\\c/d\n\té😀"))
    }

    func testLoneSurrogateBecomesReplacementCharacter() throws {
        XCTAssertEqual(try JSONValue.parse(#""x\ud800y""#), .string("x\u{FFFD}y"))
        XCTAssertEqual(try JSONValue.parse(#""\udc00""#), .string("\u{FFFD}"))
        XCTAssertEqual(try JSONValue.parse(#""\ud800\u0041""#), .string("\u{FFFD}A"))
    }

    func testWriterEscapesControlAndLineSeparators() throws {
        let original = JSONValue.string("q\"b\\n\n\r\t\u{08}\u{0C}\u{01}\u{2028}\u{2029}ü")
        let text = original.serializedString()
        XCTAssertTrue(text.contains("\\u2028"))
        XCTAssertTrue(text.contains("\\u2029"))
        XCTAssertTrue(text.contains("\\u0001"))
        XCTAssertFalse(text.contains("\u{2028}"))
        XCTAssertEqual(try JSONValue.parse(text), original)
    }

    // MARK: Fehlerhafte Eingaben

    func testInvalidJSONIsRejected() {
        let invalid = [
            "", " ", "{", "}", "[1,]", "{\"a\":1,}", "01", "1.", "-", ".5", "+1", "tru", "nul", "[1 2]",
            "{\"a\" 1}", "{a:1}", "\"a", "\"\\x\"", "\"a\nb\"", "1 2", "NaN", "Infinity", "1e400", "\"\\u12\"",
        ]
        for text in invalid {
            XCTAssertThrowsError(try JSONValue.parse(text), "sollte abgelehnt werden: \(text.debugDescription)")
        }
    }

    func testWhitespaceAndBOMAreAccepted() throws {
        XCTAssertEqual(try JSONValue.parse(" \n\t{\"a\" : [ 1 , true ] }\r\n"), ["a": [1, true]])
        var data = Data([0xEF, 0xBB, 0xBF])
        data.append(Data("[null]".utf8))
        XCTAssertEqual(try JSONValue.parse(data), [.null])
    }

    func testDuplicateKeysKeepLastValue() throws {
        XCTAssertEqual(try JSONValue.parse("{\"a\":1,\"a\":2}"), ["a": 2])
    }

    func testNestingLimit() {
        let deep = String(repeating: "[", count: JSONParser.maxDepth + 1) + String(repeating: "]", count: JSONParser.maxDepth + 1)
        XCTAssertThrowsError(try JSONValue.parse(deep))
        let allowed = String(repeating: "[", count: 100) + String(repeating: "]", count: 100)
        XCTAssertNoThrow(try JSONValue.parse(allowed))
    }

    func testDepthLimitIsConsistentAcrossReaderWriterAndFoundation() throws {
        func nested(_ depth: Int) -> JSONValue {
            var value: JSONValue = []
            for _ in 1..<depth { value = [value] }
            return value
        }
        let atLimit = nested(JSONLimits.maxDepth)
        let overLimit = nested(JSONLimits.maxDepth + 1)
        XCTAssertEqual(atLimit.depth(), JSONLimits.maxDepth)
        XCTAssertTrue(atLimit.fitsDepth(JSONLimits.maxDepth))
        XCTAssertFalse(overLimit.fitsDepth(JSONLimits.maxDepth))
        XCTAssertEqual(JSONValue.number(1).depth(), 0)

        // Was der Foundation-Eingang annimmt, liest der Leser wieder; darüber lehnen beide ab.
        XCTAssertEqual(try JSONValue(foundation: foundationObject(atLimit)), atLimit)
        XCTAssertEqual(try JSONValue.parse(atLimit.serialized()), atLimit)
        XCTAssertThrowsError(try JSONValue(foundation: foundationObject(overLimit)))
        XCTAssertThrowsError(try JSONValue.parse(overLimit.serialized()))
    }

    // MARK: Foundation und Codable

    func testFoundationConversionDistinguishesBooleans() throws {
        let object: [String: Any] = [
            "int": NSNumber(value: 1),
            "bool": NSNumber(value: true),
            "double": NSNumber(value: 82.4),
            "null": NSNull(),
            "list": ["x", NSNumber(value: false)] as [Any],
        ]
        let value = try JSONValue(foundation: object)
        XCTAssertEqual(value, ["int": 1, "bool": true, "double": 82.4, "null": .null, "list": ["x", false]])
        XCTAssertThrowsError(try JSONValue(foundation: Date()))
    }

    func testCodableRoundTrip() throws {
        let value = try Fixtures.value("profile-full")
        let data = try JSONEncoder().encode(value)
        XCTAssertEqual(try JSONDecoder().decode(JSONValue.self, from: data), value)
        XCTAssertEqual(try JSONValue.parse(data), value)
    }

    func testSubscriptSetterOnlyTouchesItsKey() {
        var value: JSONValue = ["keep": ["x": 1], "change": 1]
        value["change"] = 2
        value["new"] = "n"
        value["keep"]?["y"] = true
        XCTAssertEqual(value, ["keep": ["x": 1, "y": true], "change": 2, "new": "n"])
        value["change"] = nil
        XCTAssertNil(value["change"])
    }
}
