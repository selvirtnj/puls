import Foundation
import XCTest
@testable import PULSCore

final class OutboxTests: XCTestCase {
    private let session = "session-1"

    private func command(_ number: Int, op: String = "weight.upsert") -> ApplyCommand {
        ApplyCommand(
            id: "cmd-\(number)", userId: Fixtures.sessionUser, baseSeq: 42, op: op,
            args: ["id": .string("w-\(number)"), "date": "2026-10-26", "kg": 82.4, "expect": .null]
        )
    }

    private func failure(_ id: String, _ code: String) -> AckMessage {
        AckMessage(id: id, ok: false, seq: 42, error: AckError(code: AckErrorCode(code: code), message: "Hinweis"))
    }

    /// Macht `outbox.json` unbeschreibbar (Verzeichnis gleichen Namens), damit Speichern scheitert.
    private func breakSaving(_ outbox: Outbox) throws {
        try? FileManager.default.removeItem(at: outbox.fileURL)
        try FileManager.default.createDirectory(at: outbox.fileURL, withIntermediateDirectories: true)
        try Data("x".utf8).write(to: outbox.fileURL.appendingPathComponent("block"))
    }

    func testEnqueuedCommandsSurviveReload() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        XCTAssertTrue(try outbox.enqueue(command(1), at: fixedNow))
        XCTAssertTrue(try outbox.enqueue(command(2), at: fixedNow))

        let reloaded = Outbox(directory: directory)
        XCTAssertNil(reloaded.loadError)
        XCTAssertEqual(reloaded.entries, outbox.entries)
        XCTAssertEqual(reloaded.replayableCommands.map(\.id), ["cmd-1", "cmd-2"])
        XCTAssertEqual(reloaded.entries.first?.command.args["kg"], 82.4)
        XCTAssertEqual(reloaded.entries.first?.command.args["expect"], .null)
    }

    func testEnqueueIsIdempotentByID() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        XCTAssertTrue(try outbox.enqueue(command(1), at: fixedNow))
        XCTAssertFalse(try outbox.enqueue(command(1), at: fixedNow))
        XCTAssertEqual(outbox.entries.count, 1)
        XCTAssertEqual(Outbox(directory: directory).entries.count, 1)
    }

    func testAckOkMarksAckedAndKeepsEntry() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        XCTAssertEqual(outbox.resolve(AckMessage(id: "cmd-1", ok: true, seq: 43), session: session), .confirmed(command(1)))
        XCTAssertTrue(outbox.replayableCommands.isEmpty)

        let reloaded = Outbox(directory: directory)
        XCTAssertEqual(reloaded.entries.map(\.status), [.acked(session: session)])
        // Doppelte Bestätigung derselben ID ist harmlos.
        XCTAssertEqual(reloaded.resolve(AckMessage(id: "cmd-1", ok: true, seq: 43), session: "session-2"), .confirmed(command(1)))
        XCTAssertEqual(reloaded.entries.map(\.status), [.acked(session: "session-2")])
    }

    func testRemoveAckedAndReopen() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        try outbox.enqueue(command(2), at: fixedNow)
        try outbox.enqueue(command(3), at: fixedNow)
        _ = outbox.resolve(AckMessage(id: "cmd-1", ok: true, seq: 43), session: session)
        _ = outbox.resolve(AckMessage(id: "cmd-2", ok: true, seq: 44), session: session)

        try outbox.removeAcked(ids: ["cmd-1", "cmd-3"]) // cmd-3 ist nicht acked und bleibt
        XCTAssertEqual(outbox.reopen(ids: ["cmd-2"]), 1)
        XCTAssertEqual(Outbox(directory: directory).replayableCommands.map(\.id), ["cmd-2", "cmd-3"])
    }

    func testLastSeenEffectPersistsAndRestartsWithNewAck() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        XCTAssertEqual(outbox.recordSeenEffect(["cmd-1": true]), 0, "nur für acked")

        _ = outbox.resolve(AckMessage(id: "cmd-1", ok: true, seq: 43), session: session)
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.lastSeenEffect), [nil])
        XCTAssertEqual(outbox.recordSeenEffect(["cmd-1": true]), 1)
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.lastSeenEffect), [true])
        XCTAssertEqual(outbox.recordSeenEffect(["cmd-1": false]), 1, "nur der letzte Stand zählt")
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.lastSeenEffect), [false])

        // Doppelte Bestätigung behält den Stand.
        _ = outbox.resolve(AckMessage(id: "cmd-1", ok: true, seq: 43), session: session)
        XCTAssertEqual(outbox.entries.map(\.lastSeenEffect), [false])

        // Erneut gesendet und neu bestätigt: Beobachtung beginnt neu.
        outbox.reopen(ids: ["cmd-1"])
        _ = outbox.resolve(AckMessage(id: "cmd-1", ok: true, seq: 44), session: "session-2")
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.lastSeenEffect), [nil])
    }
    func testInvalidRemovesForRollback() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        let ack = failure("cmd-1", "invalid")
        XCTAssertEqual(outbox.resolve(ack, session: session), .rejected(command(1), try XCTUnwrap(ack.error)))
        XCTAssertTrue(Outbox(directory: directory).entries.isEmpty)
    }

    func testWrongUserUnknownOpAndConflictAreParkedNotDeleted() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        try outbox.enqueue(command(2, op: "weight.explode"), at: fixedNow)
        try outbox.enqueue(command(3), at: fixedNow)

        guard case .parked = outbox.resolve(failure("cmd-1", "wrong_user"), session: session) else { return XCTFail("geparkt erwartet") }
        guard case .parked = outbox.resolve(failure("cmd-2", "unknown_op"), session: session) else { return XCTFail("geparkt erwartet") }
        guard case .parked = outbox.resolve(failure("cmd-3", "conflict"), session: session) else { return XCTFail("geparkt erwartet") }
        XCTAssertTrue(outbox.replayableCommands.isEmpty)

        let reloaded = Outbox(directory: directory)
        XCTAssertEqual(reloaded.entries.map(\.status), [.parked(.wrongUser), .parked(.unknownOp), .parked(.conflict)])
        XCTAssertEqual(reloaded.entries.first?.lastError?.code, .wrongUser)

        // Nur die Op, die das Web jetzt kennt, wird wieder freigegeben.
        let unparked = reloaded.unpark { entry in
            entry.status == .parked(.unknownOp) && entry.command.op == "weight.explode"
        }
        XCTAssertEqual(unparked, 1)
        XCTAssertEqual(reloaded.replayableCommands.map(\.id), ["cmd-2"])
    }

    func testTransientErrorsKeepCommandForReplay() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        for number in 1...4 { try outbox.enqueue(command(number), at: fixedNow) }

        for (number, code) in [(1, "readonly"), (2, "persist_failed"), (3, "not_ready"), (4, "future_code")] {
            guard case .held = outbox.resolve(failure("cmd-\(number)", code), session: session) else {
                return XCTFail("gehalten erwartet: \(code)")
            }
        }
        XCTAssertEqual(outbox.replayableCommands.map(\.id), ["cmd-1", "cmd-2", "cmd-3", "cmd-4"])
        XCTAssertEqual(Outbox(directory: directory).replayableCommands.count, 4)
    }

    func testAckWithoutErrorObjectIsHeld() throws {
        let outbox = Outbox(directory: try makeTemporaryDirectory())
        try outbox.enqueue(command(1), at: fixedNow)
        guard case .held = outbox.resolve(AckMessage(id: "cmd-1", ok: false), session: session) else {
            return XCTFail("gehalten erwartet")
        }
        XCTAssertEqual(outbox.entries.count, 1)
    }

    func testCorruptFileIsSetAsideNotLost() throws {
        let directory = try makeTemporaryDirectory()
        let file = directory.appendingPathComponent(Outbox.fileName)
        try Data("{\"version\":1,\"entries\":[{\"broken\"".utf8).write(to: file)

        let outbox = Outbox(directory: directory)
        XCTAssertNotNil(outbox.loadError)
        XCTAssertFalse(outbox.isBlocked)
        XCTAssertTrue(outbox.entries.isEmpty)
        let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        XCTAssertEqual(names.filter { $0.hasPrefix("outbox.corrupt-") }.count, 1)

        // Weiterarbeiten ist möglich; ein zweiter beschädigter Stand bekommt einen eigenen Namen.
        XCTAssertTrue(try outbox.enqueue(command(1), at: fixedNow))
        XCTAssertEqual(Outbox(directory: directory).entries.count, 1)
        try Data("kaputt".utf8).write(to: file)
        _ = Outbox(directory: directory)
        let after = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        XCTAssertEqual(after.filter { $0.hasPrefix("outbox.corrupt-") }.count, 2)
    }

    func testCorruptFileThatCannotBeSetAsideStaysBlocked() throws {
        let directory = try makeTemporaryDirectory()
        let file = directory.appendingPathComponent(Outbox.fileName)
        try Data("kaputt".utf8).write(to: file)
        // Verzeichnis schreibgeschützt: Beiseitelegen scheitert.
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: directory.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: directory.path) }

        let outbox = Outbox(directory: directory)
        XCTAssertTrue(outbox.isBlocked)
        XCTAssertThrowsError(try outbox.enqueue(command(1), at: fixedNow)) { error in
            XCTAssertEqual(error as? OutboxError, .notLoaded)
        }
        XCTAssertEqual(try Data(contentsOf: file), Data("kaputt".utf8))
    }

    func testRemoveOnUserRequestIsTransactional() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        try outbox.enqueue(command(2), at: fixedNow)

        XCTAssertEqual(try outbox.remove(id: "cmd-1"), command(1))
        XCTAssertNil(try outbox.remove(id: "cmd-1"))
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.command.id), ["cmd-2"])

        try breakSaving(outbox)
        XCTAssertThrowsError(try outbox.remove(id: "cmd-2"))
        XCTAssertEqual(outbox.entries.map(\.command.id), ["cmd-2"], "Eintrag bleibt bei Schreibfehler")
        XCTAssertNotNil(outbox.saveError)
    }

    func testRemoveAckedIsTransactional() throws {
        let directory = try makeTemporaryDirectory()
        let outbox = Outbox(directory: directory)
        try outbox.enqueue(command(1), at: fixedNow)
        _ = outbox.resolve(AckMessage(id: "cmd-1", ok: true, seq: 43), session: session)
        try breakSaving(outbox)
        XCTAssertThrowsError(try outbox.removeAcked(ids: ["cmd-1"]))
        XCTAssertEqual(outbox.entries.map(\.status), [.acked(session: session)])
    }

    func testTooDeepArgsAreRefused() throws {
        let outbox = Outbox(directory: try makeTemporaryDirectory())
        var deep: JSONValue = [:]
        for _ in 0..<JSONLimits.bridgeDepth { deep = ["n": deep] }
        let tooDeep = ApplyCommand(id: "cmd-deep", userId: nil, baseSeq: 0, op: "weight.upsert", args: deep)
        XCTAssertThrowsError(try outbox.enqueue(tooDeep, at: fixedNow)) { error in
            XCTAssertEqual(error as? OutboxError, .tooDeep)
        }
        XCTAssertTrue(outbox.entries.isEmpty)
    }
}
