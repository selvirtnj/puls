import Foundation
import XCTest
@testable import PULSCore

final class BridgeMessagesTests: XCTestCase {
    private func decode(_ name: String) throws -> InboundMessage? {
        try InboundMessage.decode(data: Fixtures.data(name))
    }

    // MARK: Web → Native

    func testHelloFixture() throws {
        guard case .hello(let hello)? = try decode("hello") else { return XCTFail("hello erwartet") }
        XCTAssertEqual(hello.webVersion, "74")
        XCTAssertEqual(hello.ops, ["weight.upsert", "weight.delete"])
        XCTAssertEqual(hello.screens, ["body"])
        XCTAssertFalse(hello.ownerPending)
    }

    func testOwnerPendingIsRequired() throws {
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(#"{"type":"hello","protocol":1,"ops":[],"screens":[]}"#)))
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(
            #"{"type":"snapshot","protocol":1,"seq":1,"userId":null,"state":{},"reason":"load"}"#
        )))
        let pendingHello = try InboundMessage.decode(JSONValue.parse(
            #"{"type":"hello","protocol":1,"webVersion":"75","ops":[],"screens":[],"ownerPending":true}"#
        ))
        guard case .hello(let hello)? = pendingHello else { return XCTFail("hello erwartet") }
        XCTAssertTrue(hello.ownerPending)
    }

    func testSnapshotFixture() throws {
        guard case .snapshot(let snapshot)? = try decode("snapshot") else { return XCTFail("snapshot erwartet") }
        XCTAssertEqual(snapshot.seq, 42)
        XCTAssertEqual(snapshot.userId, Fixtures.sessionUser)
        XCTAssertEqual(snapshot.reason, "save")
        XCTAssertFalse(snapshot.ownerPending)
        XCTAssertEqual(snapshot.cloud, CloudStatus(signedIn: true, revision: 17, dirty: false, conflict: false))
        XCTAssertEqual(snapshot.flags, StateFlags.none)
        XCTAssertFalse(snapshot.flags.isReadOnly)
        XCTAssertEqual(snapshot.state["xUnknown"]?["keep"], true)
        XCTAssertEqual(snapshot.state["weights"]?[0]?["kg"], 84.2)
    }

    func testAckFixtures() throws {
        guard case .ack(let ok)? = try decode("ack-ok") else { return XCTFail("ack erwartet") }
        XCTAssertEqual(ok, AckMessage(id: "c0000000-0000-4000-8000-000000000001", ok: true, seq: 43))

        guard case .ack(let failed)? = try decode("ack-error") else { return XCTFail("ack erwartet") }
        XCTAssertFalse(failed.ok)
        XCTAssertEqual(failed.seq, 43)
        XCTAssertEqual(failed.error?.code, .invalid)
        XCTAssertEqual(failed.error?.message, "kg außerhalb 20–400")
    }

    func testOpenNativeAndNavigateFixtures() throws {
        XCTAssertEqual(try decode("open-native"), .openNative(OpenNativeMessage(screen: "body")))
        XCTAssertEqual(try decode("navigate"), .navigate(NavigateMessage(page: "account")))
    }

    func testMessageWithoutTypeIsIgnored() throws {
        XCTAssertNil(try decode("invalid-message-no-type"))
    }

    func testUnknownTypeAndOtherProtocolAreIgnored() throws {
        XCTAssertNil(try InboundMessage.decode(JSONValue.parse(#"{"type":"futureThing","protocol":1,"x":1}"#)))
        XCTAssertNil(try InboundMessage.decode(JSONValue.parse(#"{"type":"hello","protocol":2,"ops":[]}"#)))
        XCTAssertNil(try InboundMessage.decode(JSONValue.parse(#"{"type":"hello","ops":[]}"#)))
        XCTAssertNil(try InboundMessage.decode(JSONValue.parse(#"{"type":7,"protocol":1}"#)))
    }

    func testUnknownFieldsAreIgnored() throws {
        let text = #"{"type":"navigate","protocol":1,"page":"home","futureField":{"a":[1]}}"#
        XCTAssertEqual(try InboundMessage.decode(JSONValue.parse(text)), .navigate(NavigateMessage(page: "home")))
    }

    func testMalformedKnownMessagesAreRejected() {
        let malformed = [
            #"{"type":"snapshot","protocol":1,"seq":1,"userId":null,"state":[]}"#,
            #"{"type":"snapshot","protocol":1,"userId":null,"state":{}}"#,
            #"{"type":"snapshot","protocol":1,"seq":1.5,"userId":null,"state":{}}"#,
            #"{"type":"snapshot","protocol":1,"seq":-1,"userId":null,"state":{}}"#,
            #"{"type":"snapshot","protocol":1,"seq":1,"userId":5,"state":{}}"#,
            #"{"type":"snapshot","protocol":1,"seq":1,"userId":null,"state":{},"flags":{"preview":"ja"}}"#,
            #"{"type":"ack","protocol":1,"ok":true}"#,
            #"{"type":"ack","protocol":1,"id":"","ok":true}"#,
            #"{"type":"ack","protocol":1,"id":"x","ok":"true"}"#,
            #"{"type":"ack","protocol":1,"id":"x","ok":false,"error":{"message":"ohne code"}}"#,
            #"{"type":"hello","protocol":1,"ops":"weight.upsert"}"#,
            #"{"type":"hello","protocol":1,"ops":[1]}"#,
            #"{"type":"openNative","protocol":1}"#,
            #"{"type":"navigate","protocol":1,"page":""}"#,
        ]
        for text in malformed {
            XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(text)), text)
        }
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse("[1]")))
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse("\"hello\"")))
    }

    func testFoundationBodyAndStringBodyDecodeIdentically() throws {
        let data = try Fixtures.data("snapshot")
        let fromData = try InboundMessage.decode(data: data)
        // WKScriptMessage.body kommt als NSDictionary mit NSNumber an.
        let foundation = foundationObject(try JSONValue.parse(data))
        XCTAssertEqual(try InboundMessage.decode(foundation: foundation), fromData)
        let text = try XCTUnwrap(String(data: data, encoding: .utf8))
        XCTAssertEqual(try InboundMessage.decode(foundation: text), fromData)
        XCTAssertNotNil(fromData)
    }

    func testInboundMessagesRoundTripThroughJSON() throws {
        for name in ["hello", "snapshot", "ack-ok", "ack-error", "open-native", "navigate"] {
            let message = try XCTUnwrap(decode(name), name)
            XCTAssertEqual(try InboundMessage.decode(message.json), message, name)
        }
    }

    // MARK: Native → Web

    func testApplyFixturesMatchCommandModelExactly() throws {
        let names = try Fixtures.allNames().filter {
            $0.hasPrefix("apply-") || ($0.hasPrefix("invalid-") && $0 != "invalid-message-no-type")
        }
        XCTAssertGreaterThanOrEqual(names.count, 8)
        for name in names {
            let fixture = try Fixtures.value(name)
            let command = try ApplyCommand(json: fixture)
            // Gleiche Feldnamen und Werte wie im Protokoll: zurückgeschrieben identisch.
            XCTAssertEqual(command.json, fixture, name)
        }
    }

    func testUpsertFixtureFields() throws {
        let command = try ApplyCommand(json: Fixtures.value("apply-weight-upsert"))
        XCTAssertEqual(command.id, "c0000000-0000-4000-8000-000000000001")
        XCTAssertEqual(command.userId, Fixtures.sessionUser)
        XCTAssertEqual(command.baseSeq, 42)
        XCTAssertEqual(command.op, "weight.upsert")
        let expected: JSONValue = [
            "id": "w0000000-0000-4000-8000-000000000009", "date": "2026-10-26", "kg": 82.4,
            "expect": "w0000000-0000-4000-8000-000000000003",
        ]
        XCTAssertEqual(command.args, expected)
    }

    func testLocalUserIsSentAsExplicitNull() throws {
        let command = ApplyCommand(id: "c1", userId: nil, baseSeq: 0, op: "weight.delete", args: ["id": "w1"])
        let text = command.json.serializedString()
        XCTAssertTrue(text.contains("\"userId\":null"))
        XCTAssertEqual(try ApplyCommand(json: JSONValue.parse(text)), command)
    }

    func testApplyCommandCodable() throws {
        let command = try ApplyCommand(json: Fixtures.value("apply-weight-upsert"))
        let data = try JSONEncoder().encode(command)
        XCTAssertEqual(try JSONDecoder().decode(ApplyCommand.self, from: data), command)
    }

    func testEveryFixtureIsHandled() throws {
        let names = try Fixtures.allNames()
        XCTAssertTrue(names.contains("profile-full"))
        for name in names {
            let value = try Fixtures.value(name)
            switch name {
            case "profile-full":
                XCTAssertNotNil(value.objectValue)
            case "invalid-message-no-type":
                XCTAssertNil(try InboundMessage.decode(value))
            case _ where name.hasPrefix("apply-") || name.hasPrefix("invalid-"):
                XCTAssertNoThrow(try ApplyCommand(json: value), name)
            default:
                XCTAssertNotNil(try InboundMessage.decode(value), "unbehandelte Fixture \(name)")
            }
        }
    }

    func testAckErrorCodes() {
        let codes = ["invalid", "wrong_user", "conflict", "readonly", "unknown_op", "persist_failed", "not_ready", "future_code"]
        for code in codes {
            XCTAssertEqual(AckErrorCode(code: code).code, code)
        }
        XCTAssertEqual(AckErrorCode(code: "wrong_user"), .wrongUser)
        XCTAssertEqual(AckErrorCode(code: "conflict"), .conflict)
        XCTAssertEqual(AckErrorCode(code: "future_code"), .other("future_code"))
    }

    func testConflictFixtureExpectsOutdatedDayID() throws {
        let command = try ApplyCommand(json: Fixtures.value("invalid-weight-conflict"))
        XCTAssertEqual(command.op, BridgeOps.weightUpsert)
        XCTAssertEqual(command.args["expect"], "w0000000-0000-4000-8000-000000000099")
    }

    // MARK: Tiefengrenze

    private func nested(_ depth: Int) -> JSONValue {
        var value: JSONValue = [:]
        for _ in 1..<depth { value = ["n": value] }
        return value
    }

    func testTooDeepMessagesAreRejectedOnAllPaths() throws {
        // Nachricht (Tiefe 1) + state: insgesamt bridgeDepth + 1 Ebenen.
        let tooDeep = SnapshotMessage(seq: 1, userId: nil, state: nested(JSONLimits.bridgeDepth)).json
        let fits = SnapshotMessage(seq: 1, userId: nil, state: nested(JSONLimits.bridgeDepth - 1)).json
        XCTAssertEqual(tooDeep.depth(), JSONLimits.bridgeDepth + 1)

        XCTAssertThrowsError(try InboundMessage.decode(tooDeep))
        XCTAssertThrowsError(try InboundMessage.decode(data: tooDeep.serialized()))
        XCTAssertThrowsError(try InboundMessage.decode(foundation: foundationObject(tooDeep)))
        XCTAssertThrowsError(try InboundMessage.decode(foundation: tooDeep.serializedString()))

        XCTAssertNotNil(try InboundMessage.decode(fits))
        XCTAssertNotNil(try InboundMessage.decode(foundation: foundationObject(fits)))
        // Was die Brücke annimmt, ist als Spiegel (state + 1 Ebene) wieder lesbar.
        guard case .snapshot(let snapshot)? = try InboundMessage.decode(fits) else { return XCTFail("snapshot") }
        let record = MirrorRecord(seq: 1, userId: nil, cloud: .unknown, flags: .none, savedAt: fixedNow, state: snapshot.state)
        XCTAssertNoThrow(try JSONValue.parse(record.json.serialized()))
    }
}
