import Foundation
import XCTest
@testable import PULSCore

/// Store-Regeln: seq, Vorschau, Outbox-Replay, optimistische Anzeige und Rücknahme.
final class ProfileStoreTests: XCTestCase {
    private static let user = Fixtures.sessionUser

    /// Test-Op: hängt `args` an `state.items` an (statt echter Gewichtslogik, die das Web besitzt).
    private static let reducers: [String: OptimisticReducer] = [
        "test.add": { state, args in
            var items = state["items"]?.arrayValue ?? []
            items.append(args)
            state["items"] = .array(items)
        },
    ]

    @MainActor
    private func makeStore(directory: URL, ids: SequentialIDs = SequentialIDs(), session: String = "app-1") -> ProfileStore {
        ProfileStore(environment: StoreEnvironment(
            directory: directory,
            now: { fixedNow },
            makeCommandID: { ids.make() },
            sessionID: session,
            reducers: Self.reducers,
            screenRequirements: ["body": ["test.add"]]
        ))
    }

    private func snapshot(_ seq: Int, items: [JSONValue] = [], userId: String? = ProfileStoreTests.user,
                          flags: StateFlags = .none) -> InboundMessage {
        .snapshot(SnapshotMessage(
            seq: seq, userId: userId, state: ["items": .array(items), "xKeep": ["deep": true]],
            cloud: CloudStatus(signedIn: true, revision: 3), flags: flags, reason: "save"
        ))
    }

    private let hello = InboundMessage.hello(HelloMessage(webVersion: "74", ops: ["test.add"], screens: ["body"]))

    private final class SentLog {
        var commands: [ApplyCommand] = []
    }

    @MainActor
    private func connect(_ store: ProfileStore) -> SentLog {
        let log = SentLog()
        store.sender = { log.commands.append($0) }
        return log
    }

    // MARK: seq

    @MainActor
    func testSnapshotsOnlyAcceptedWithHigherSeq() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        XCTAssertTrue(store.receive(snapshot(42)))
        XCTAssertFalse(store.receive(snapshot(41, items: ["alt"])))
        XCTAssertFalse(store.receive(snapshot(42, items: ["gleich"])))
        XCTAssertEqual(store.seq, 42)
        XCTAssertEqual(store.document["items"], [])
        XCTAssertTrue(store.receive(snapshot(43, items: ["neu"])))
        XCTAssertEqual(store.seq, 43)
        XCTAssertEqual(store.document["items"], ["neu"])
        XCTAssertEqual(store.document["xKeep"], ["deep": true])
        XCTAssertEqual(store.cloud.revision, 3)
    }

    @MainActor
    func testHelloStartsNewEpochForResetWebCounter() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        store.receive(snapshot(43))
        store.receive(hello)
        // Web-Speicher wurde zurückgesetzt: Zähler beginnt neu.
        XCTAssertTrue(store.receive(snapshot(1, items: ["frisch"])))
        XCTAssertEqual(store.seq, 1)
        XCTAssertFalse(store.receive(snapshot(1, items: ["doppelt"])))
        XCTAssertEqual(store.document["items"], ["frisch"])
    }

    // MARK: Vorschau

    @MainActor
    func testPreviewSnapshotIsNeitherShownNorMirrored() async throws {
        let directory = try makeTemporaryDirectory()
        let store = makeStore(directory: directory)
        let sent = connect(store)
        store.receive(hello)
        store.receive(snapshot(10, items: ["echt"]))
        await store.waitForMirrorWrites()

        store.receive(hello)
        XCTAssertFalse(store.receive(snapshot(0, items: ["vorschau"], flags: StateFlags(preview: true))))
        await store.waitForMirrorWrites()

        XCTAssertEqual(store.document["items"], ["echt"])
        XCTAssertEqual(store.seq, 10)
        XCTAssertTrue(store.availableScreens.isEmpty)
        XCTAssertEqual(MirrorFile(directory: directory).read(userId: Self.user)?.seq, 10)
        XCTAssertThrowsError(try store.perform(Command(op: "test.add", args: ["n": 1]))) { error in
            XCTAssertEqual(error as? ProfileStoreError, .preview)
        }
        XCTAssertTrue(sent.commands.isEmpty)
    }

    // MARK: perform und Outbox

    @MainActor
    func testPerformPersistsShowsOptimisticallyAndSends() throws {
        let directory = try makeTemporaryDirectory()
        let store = makeStore(directory: directory)
        let sent = connect(store)

        XCTAssertThrowsError(try store.perform(Command(op: "test.add", args: ["n": 1]))) { error in
            XCTAssertEqual(error as? ProfileStoreError, .webNotReady)
        }
        store.receive(hello)
        store.receive(snapshot(42))
        XCTAssertEqual(store.availableScreens, ["body"])

        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))
        XCTAssertEqual(command.userId, Self.user)
        XCTAssertEqual(command.baseSeq, 42)
        XCTAssertEqual(sent.commands, [command])
        XCTAssertEqual(store.pending.count, 1)
        XCTAssertEqual(store.document["items"], [["n": 1]])
        XCTAssertEqual(store.confirmedDocument["items"], [])
        // Steht auf der Platte, bevor perform zurückkehrt.
        XCTAssertEqual(Outbox(directory: directory).replayableCommands, [command])

        XCTAssertThrowsError(try store.perform(Command(op: "weight.explode", args: [:]))) { error in
            XCTAssertEqual(error as? ProfileStoreError, .unsupportedOp("weight.explode"))
        }
    }

    @MainActor
    func testAckOkKeepsOverlayUntilSnapshotThenUsesWebState() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        _ = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))

        store.receive(.ack(AckMessage(id: command.id, ok: true, seq: 43)))
        XCTAssertTrue(store.pending.isEmpty)
        XCTAssertEqual(store.document["items"], [["n": 1]], "kein Flackern zwischen ack und Snapshot")

        store.receive(snapshot(43, items: [["n": 1, "fromWeb": true]]))
        XCTAssertEqual(store.document["items"], [["n": 1, "fromWeb": true]])
    }

    @MainActor
    func testInvalidAckRollsBackAndNotifies() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        _ = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let command = try store.perform(Command(op: "test.add", args: ["n": 999]))
        XCTAssertEqual(store.document["items"], [["n": 999]])

        store.receive(.ack(AckMessage(id: command.id, ok: false, seq: 42,
                                      error: AckError(code: .invalid, message: "außerhalb"))))
        XCTAssertEqual(store.document["items"], [])
        XCTAssertTrue(store.pending.isEmpty)
        XCTAssertEqual(store.notice, .commandRejected(id: command.id, op: "test.add", message: "außerhalb"))
    }

    @MainActor
    func testOutboxReplaysAfterRestartWithSameID() throws {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory)
        first.receive(hello)
        first.receive(snapshot(42))
        // Kein Sender: App wird beendet, bevor das Web antwortet.
        let command = try first.perform(Command(op: "test.add", args: ["n": 1]))

        let second = makeStore(directory: directory)
        let sent = connect(second)
        XCTAssertEqual(second.pending.map(\.command), [command])
        second.receive(hello)
        XCTAssertTrue(sent.commands.isEmpty, "Replay erst mit dem Lade-Snapshot")
        second.receive(snapshot(43))
        XCTAssertEqual(sent.commands, [command])

        // Erneutes hello (Neuladen der Seite) spielt idempotent mit derselben ID nochmals ein.
        second.receive(hello)
        second.receive(snapshot(44))
        XCTAssertEqual(sent.commands.map(\.id), [command.id, command.id])

        second.receive(.ack(AckMessage(id: command.id, ok: true, seq: 45)))
        second.receive(.ack(AckMessage(id: command.id, ok: true, seq: 45)))
        XCTAssertTrue(second.pending.isEmpty)
        // Bestätigt, aber bis zum Nachweis nach App-Neustart weiter aufbewahrt.
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.status), [.acked(session: "app-1")])
    }

    @MainActor
    func testReadOnlyHoldsAndReplaysWhenWritable() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))

        store.receive(.ack(AckMessage(id: command.id, ok: false, seq: 42, error: AckError(code: .readonly))))
        XCTAssertEqual(store.pending.count, 1)
        XCTAssertEqual(store.document["items"], [["n": 1]])

        store.receive(snapshot(43, flags: StateFlags(recovery: true)))
        XCTAssertTrue(store.isReadOnly)
        XCTAssertThrowsError(try store.perform(Command(op: "test.add", args: ["n": 2]))) { error in
            XCTAssertEqual(error as? ProfileStoreError, .readOnly)
        }
        XCTAssertEqual(sent.commands.count, 1)

        store.receive(snapshot(44))
        XCTAssertEqual(sent.commands.map(\.id), [command.id, command.id])
    }

    @MainActor
    func testUnknownOpParksAndFallsBackToWeb() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))

        store.receive(.ack(AckMessage(id: command.id, ok: false, seq: 42, error: AckError(code: .unknownOp))))
        XCTAssertTrue(store.availableScreens.isEmpty)
        XCTAssertEqual(store.parked.map(\.command.id), [command.id])
        XCTAssertEqual(store.document["items"], [], "geparkte Befehle werden nicht angezeigt")
        XCTAssertThrowsError(try store.perform(Command(op: "test.add", args: ["n": 2])))

        // Neues Web meldet die Op wieder: Bereich frei, Befehl wird erneut gesendet.
        store.receive(hello)
        store.receive(snapshot(43))
        XCTAssertEqual(store.availableScreens, ["body"])
        XCTAssertTrue(store.parked.isEmpty)
        XCTAssertEqual(sent.commands.map(\.id), [command.id, command.id])
    }

    @MainActor
    func testWrongUserParksAndOverlayIsPerUser() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        _ = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))

        // Anderer Nutzer angemeldet: Befehl gehört nicht in dessen Anzeige.
        store.receive(snapshot(43, userId: "b0000000-0000-4000-8000-0000000000bb"))
        XCTAssertEqual(store.document["items"], [])

        store.receive(.ack(AckMessage(id: command.id, ok: false, seq: 43, error: AckError(code: .wrongUser))))
        XCTAssertEqual(store.parked.count, 1)
        XCTAssertEqual(store.notice, .commandParked(id: command.id, op: "test.add", code: .wrongUser))

        try store.discardCommand(id: command.id)
        XCTAssertTrue(store.pending.isEmpty)
    }

    // MARK: Spiegel

    @MainActor
    func testSnapshotIsMirroredAndRestoredAfterRestart() async throws {
        let directory = try makeTemporaryDirectory()
        let profile = try Fixtures.value("profile-full")
        let first = makeStore(directory: directory)
        first.receive(.snapshot(SnapshotMessage(seq: 42, userId: Self.user, state: profile, reason: "load")))
        await first.waitForMirrorWrites()
        XCTAssertNil(first.lastMirrorError)
        XCTAssertEqual(MirrorFile(directory: directory).read(userId: Self.user)?.state, profile)

        let second = makeStore(directory: directory)
        await second.restoreMirror()
        XCTAssertTrue(second.hasDocument)
        XCTAssertEqual(second.seq, 42)
        XCTAssertEqual(second.userId, Self.user)
        XCTAssertEqual(second.document.root, profile)

        // Ein späterer echter Snapshot muss höher sein, ein neues hello öffnet die Epoche.
        XCTAssertFalse(second.receive(.snapshot(SnapshotMessage(seq: 41, userId: Self.user, state: [:]))))
        second.receive(hello)
        XCTAssertTrue(second.receive(.snapshot(SnapshotMessage(seq: 41, userId: Self.user, state: [:]))))
    }

    @MainActor
    func testRestoreDoesNotOverrideNewerSnapshot() async throws {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory)
        first.receive(snapshot(5, items: ["alt"]))
        await first.waitForMirrorWrites()

        let second = makeStore(directory: directory)
        second.receive(snapshot(6, items: ["neu"]))
        await second.restoreMirror()
        XCTAssertEqual(second.document["items"], ["neu"])
        XCTAssertEqual(second.seq, 6)
        await second.waitForMirrorWrites()
        XCTAssertEqual(MirrorFile(directory: directory).read(userId: Self.user)?.seq, 6)
    }

    @MainActor
    func testMirrorWritesCoalesceToLatestState() async throws {
        let directory = try makeTemporaryDirectory()
        let store = makeStore(directory: directory)
        for seq in 1...20 {
            store.receive(snapshot(seq, items: [.number(Double(seq))]))
        }
        await store.waitForMirrorWrites()
        XCTAssertEqual(MirrorFile(directory: directory).read(userId: Self.user)?.seq, 20)
    }

    @MainActor
    func testOpenNativeAndNavigateAreRecorded() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        store.receive(.openNative(OpenNativeMessage(screen: "body")))
        store.receive(.navigate(NavigateMessage(page: "account")))
        XCTAssertEqual(store.currentWebPage, "account")
        XCTAssertEqual(store.consumeScreenRequest(), "body")
        XCTAssertNil(store.consumeScreenRequest())
    }

    // MARK: Gewichts-Ops: expect, Konflikt, acked (Protokoll 5–7)

    private let weightHello = InboundMessage.hello(HelloMessage(
        webVersion: "74", ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete], screens: ["body"]
    ))

    private func weight(_ id: String, _ date: String, _ kg: Double) -> JSONValue {
        ["id": .string(id), "date": .string(date), "kg": .number(kg)]
    }

    private func weightSnapshot(_ seq: Int, _ weights: [JSONValue], reason: String = "save",
                                flags: StateFlags = .none, userId: String? = ProfileStoreTests.user) -> InboundMessage {
        .snapshot(SnapshotMessage(
            seq: seq, userId: userId, state: ["weights": .array(weights), "xKeep": true], flags: flags, reason: reason
        ))
    }

    private func upsert(_ id: String, _ date: String, _ kg: Double) -> Command {
        Command(op: BridgeOps.weightUpsert, args: ["id": .string(id), "date": .string(date), "kg": .number(kg)])
    }

    @MainActor
    func testPerformSetsExpectFromCurrentState() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        store.receive(weightHello)
        store.receive(weightSnapshot(10, [weight("w3", "2026-10-26", 83.5)]))

        let replaceDay = try store.perform(upsert("w9", "2026-10-26", 82.4))
        XCTAssertEqual(replaceDay.args["expect"], "w3")
        XCTAssertEqual(replaceDay.args["kg"], 82.4)
        XCTAssertEqual(try store.perform(upsert("w10", "2026-10-27", 80)).args["expect"], .null)

        let deleteExisting = try store.perform(Command(op: BridgeOps.weightDelete, args: ["id": "w3"]))
        XCTAssertEqual(deleteExisting.args["expect"], "w3")
        let deleteMissing = try store.perform(Command(op: BridgeOps.weightDelete, args: ["id": "w-unbekannt"]))
        XCTAssertEqual(deleteMissing.args["expect"], .null)

        // Vom Aufrufer gesetztes expect bleibt.
        let explicit = try store.perform(Command(
            op: BridgeOps.weightUpsert, args: ["id": "w11", "date": "2026-10-26", "kg": 81, "expect": "w-alt"]
        ))
        XCTAssertEqual(explicit.args["expect"], "w-alt")
    }

    @MainActor
    func testConflictParksRollsBackAndIsVisible() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))
        XCTAssertEqual(store.document["items"], [["n": 1]])

        store.receive(.ack(AckMessage(id: command.id, ok: false, seq: 42, error: AckError(code: .conflict))))
        XCTAssertEqual(store.document["items"], [], "optimistische Anzeige zurückgenommen")
        XCTAssertEqual(store.conflicts.map(\.command.id), [command.id])
        XCTAssertEqual(store.notice, .commandConflict(id: command.id, op: "test.add"))

        // Wird nicht automatisch erneut gesendet.
        store.receive(hello)
        store.receive(snapshot(43))
        XCTAssertEqual(sent.commands.count, 1)
        XCTAssertEqual(store.conflicts.count, 1)
    }

    @MainActor
    func testAckedEntryIsRemovedOnlyByLoadSnapshotOfLaterAppSession() throws {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory, session: "app-1")
        _ = connect(first)
        first.receive(weightHello)
        first.receive(weightSnapshot(10, [weight("w3", "2026-10-26", 83.5)], reason: "load"))
        let command = try first.perform(upsert("w9", "2026-10-26", 82.4))
        first.receive(.ack(AckMessage(id: command.id, ok: true, seq: 11)))
        first.receive(weightSnapshot(11, [weight("w9", "2026-10-26", 82.4)], reason: "apply"))
        XCTAssertTrue(first.pending.isEmpty)
        XCTAssertEqual(first.outboxEntries.map(\.status), [.acked(session: "app-1")])
        XCTAssertEqual(first.outboxEntries.map(\.lastSeenEffect), [true], "apply-Snapshot zeigt die Wirkung")
        XCTAssertEqual(Outbox(directory: directory).entries.map(\.lastSeenEffect), [true], "persistent gemerkt")

        // Neuladen im selben App-Prozess reicht nicht.
        first.receive(weightHello)
        first.receive(weightSnapshot(12, [weight("w9", "2026-10-26", 82.4)], reason: "load"))
        XCTAssertEqual(first.outboxEntries.count, 1)

        // Neue App-Sitzung: ein save-Snapshot reicht nicht, erst der load-Snapshot mit der Wirkung.
        let second = makeStore(directory: directory, session: "app-2")
        let sent = connect(second)
        second.receive(weightHello)
        second.receive(weightSnapshot(13, [weight("w9", "2026-10-26", 82.4)], reason: "save"))
        XCTAssertEqual(second.outboxEntries.count, 1)
        second.receive(weightHello)
        second.receive(weightSnapshot(14, [weight("w9", "2026-10-26", 82.4)], reason: "load"))
        XCTAssertTrue(second.outboxEntries.isEmpty)
        XCTAssertTrue(Outbox(directory: directory).entries.isEmpty)
        XCTAssertTrue(sent.commands.isEmpty)
    }

    @MainActor
    func testAckedEntryIsResentWhenEffectMissingAfterRestart() throws {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory, session: "app-1")
        _ = connect(first)
        first.receive(weightHello)
        first.receive(weightSnapshot(10, [weight("w3", "2026-10-26", 83.5)], reason: "load"))
        let command = try first.perform(upsert("w9", "2026-10-26", 82.4))
        first.receive(.ack(AckMessage(id: command.id, ok: true, seq: 11)))

        // WebKit hat den Stand vor dem Beenden nicht auf den Datenträger gebracht.
        let second = makeStore(directory: directory, session: "app-2")
        let sent = connect(second)
        second.receive(weightHello)
        second.receive(weightSnapshot(10, [weight("w3", "2026-10-26", 83.5)], reason: "load"))
        XCTAssertEqual(sent.commands, [command], "gleiche ID und ursprüngliches expect")
        XCTAssertEqual(second.pending.map(\.command.id), [command.id])
    }

    @MainActor
    func testRecoveryOrOtherUserLoadDoesNotConfirmAcked() throws {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory, session: "app-1")
        _ = connect(first)
        first.receive(weightHello)
        first.receive(weightSnapshot(10, [], reason: "load"))
        let command = try first.perform(upsert("w9", "2026-10-26", 82.4))
        first.receive(.ack(AckMessage(id: command.id, ok: true, seq: 11)))

        let second = makeStore(directory: directory, session: "app-2")
        let sent = connect(second)
        second.receive(weightHello)
        second.receive(weightSnapshot(12, [], reason: "load", flags: StateFlags(recovery: true)))
        second.receive(weightHello)
        second.receive(weightSnapshot(13, [], reason: "load", userId: "b0000000-0000-4000-8000-0000000000bb"))
        XCTAssertEqual(second.outboxEntries.map(\.status), [.acked(session: "app-1")])
        XCTAssertTrue(sent.commands.isEmpty)
    }

    // MARK: not_ready und Tiefengrenze

    @MainActor
    func testNotReadyPausesSendingUntilNextSnapshot() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = connect(store)
        store.receive(hello)
        store.receive(snapshot(42))
        let first = try store.perform(Command(op: "test.add", args: ["n": 1]))
        store.receive(.ack(AckMessage(id: first.id, ok: false, seq: 42, error: AckError(code: .notReady))))
        XCTAssertTrue(store.isWaitingForWeb)

        // Während der Anmeldung: einreihen, anzeigen, aber nicht senden.
        let second = try store.perform(Command(op: "test.add", args: ["n": 2]))
        XCTAssertEqual(sent.commands.map(\.id), [first.id])
        XCTAssertEqual(store.document["items"], [["n": 1], ["n": 2]])

        // Endgültiger Kontosnapshot: beide werden gesendet.
        store.receive(snapshot(43))
        XCTAssertFalse(store.isWaitingForWeb)
        XCTAssertEqual(sent.commands.map(\.id), [first.id, first.id, second.id])
    }

    @MainActor
    func testTooDeepSnapshotIsRejectedAndMirrorKept() async throws {
        let directory = try makeTemporaryDirectory()
        let store = makeStore(directory: directory)
        store.receive(snapshot(1, items: ["gut"]))
        await store.waitForMirrorWrites()

        var deep: JSONValue = [:]
        for _ in 0..<JSONLimits.bridgeDepth { deep = ["n": deep] }
        XCTAssertFalse(store.receive(.snapshot(SnapshotMessage(seq: 2, userId: Self.user, state: deep))))
        await store.waitForMirrorWrites()
        XCTAssertEqual(store.seq, 1)
        XCTAssertEqual(store.document["items"], ["gut"])
        XCTAssertEqual(MirrorFile(directory: directory).read(userId: Self.user)?.seq, 1)
    }

    /// Sitzung 1: Befehl senden, bestätigen und die angegebenen Snapshots (Wochenlisten) sehen; dann Sitzung 2 mit
    /// einem load-Snapshot. Liefert die Befehle, die Sitzung 2 sendet, und den Store von Sitzung 2.
    @MainActor
    private func restartScenario(
        sessionOneSnapshots: [[JSONValue]], loadWeights: [JSONValue]
    ) throws -> (command: ApplyCommand, sent: [ApplyCommand], second: ProfileStore, directory: URL) {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory, session: "app-1")
        _ = connect(first)
        first.receive(weightHello)
        first.receive(weightSnapshot(10, [weight("w3", "2026-10-26", 83.5)], reason: "load"))
        let command = try first.perform(upsert("w9", "2026-10-26", 82.4))
        first.receive(.ack(AckMessage(id: command.id, ok: true, seq: 11)))
        for (offset, weights) in sessionOneSnapshots.enumerated() {
            first.receive(weightSnapshot(11 + offset, weights, reason: offset == 0 ? "apply" : "save"))
        }

        let second = makeStore(directory: directory, session: "app-2")
        let sent = connect(second)
        second.receive(weightHello)
        second.receive(weightSnapshot(100, loadWeights, reason: "load"))
        return (command, sent.commands, second, directory)
    }

    private let w9 = ProfileStoreTests.weightValue("w9", "2026-10-26", 82.4)
    private let w3 = ProfileStoreTests.weightValue("w3", "2026-10-26", 83.5)

    private static func weightValue(_ id: String, _ date: String, _ kg: Double) -> JSONValue {
        ["id": .string(id), "date": .string(date), "kg": .number(kg)]
    }

    @MainActor
    func testCase1EffectVisibleInLoadIsSettledWithoutReplay() throws {
        // lastSeenEffect nil (kein Snapshot in Sitzung 1), Wirkung im load sichtbar.
        let result = try restartScenario(sessionOneSnapshots: [], loadWeights: [w9])
        XCTAssertTrue(result.second.outboxEntries.isEmpty)
        XCTAssertTrue(result.sent.isEmpty)
    }

    @MainActor
    func testCase2SeenThenGoneBeforeRestartIsSettledWithoutReplay() throws {
        // Sitzung 1 sah die Wirkung, danach wurde sie im Web gelöscht: lastSeenEffect false.
        let result = try restartScenario(sessionOneSnapshots: [[w9], []], loadWeights: [])
        XCTAssertTrue(result.second.outboxEntries.isEmpty)
        XCTAssertTrue(result.sent.isEmpty, "bewusstes Löschen im Web wird nicht rückgängig gemacht")
    }

    @MainActor
    func testCase3LastSeenThenLostAfterRestartIsReplayed() throws {
        // Sitzung 1 sah die Wirkung zuletzt noch; nach dem Neustart fehlt sie (Speicherverlust).
        let result = try restartScenario(sessionOneSnapshots: [[w9]], loadWeights: [w3])
        XCTAssertEqual(result.sent, [result.command], "gleiche ID und gleiches expect")
        XCTAssertEqual(result.sent.first?.args["expect"], "w3")
        XCTAssertEqual(result.second.pending.map(\.command.id), [result.command.id])
    }

    @MainActor
    func testCase4NeverSeenAndMissingIsReplayed() throws {
        // lastSeenEffect nil (App vor dem apply-Snapshot beendet), Wirkung fehlt.
        let result = try restartScenario(sessionOneSnapshots: [], loadWeights: [w3])
        XCTAssertEqual(result.sent, [result.command])
    }

    @MainActor
    func testGoneAndReappearedCountsOnlyLastState() throws {
        // gesehen → verschwunden → wieder gesehen: zuletzt true, nach Neustart fehlend → Replay.
        let result = try restartScenario(sessionOneSnapshots: [[w9], [], [w9]], loadWeights: [w3])
        XCTAssertEqual(result.sent, [result.command])
    }

    @MainActor
    func testLastSeenEffectSurvivesRestartAndIgnoresRecovery() throws {
        let directory = try makeTemporaryDirectory()
        let first = makeStore(directory: directory, session: "app-1")
        _ = connect(first)
        first.receive(weightHello)
        first.receive(weightSnapshot(10, [], reason: "load"))
        let command = try first.perform(upsert("w9", "2026-10-26", 82.4))
        first.receive(.ack(AckMessage(id: command.id, ok: true, seq: 11)))
        XCTAssertEqual(first.outboxEntries.map(\.lastSeenEffect), [nil])
        first.receive(weightSnapshot(11, [w9], reason: "apply"))
        // Recovery-Ersatzsnapshot ändert den Wert nicht.
        first.receive(weightSnapshot(12, [], reason: "save", flags: StateFlags(recovery: true)))
        XCTAssertEqual(first.outboxEntries.map(\.lastSeenEffect), [true])

        // Neustart: der gespeicherte Wert ist da; Snapshots der neuen Sitzung ohne load ändern ihn nicht.
        let second = makeStore(directory: directory, session: "app-2")
        let sent = connect(second)
        XCTAssertEqual(second.outboxEntries.map(\.lastSeenEffect), [true])
        second.receive(weightHello)
        second.receive(weightSnapshot(20, [], reason: "cloud"))
        XCTAssertEqual(second.outboxEntries.map(\.lastSeenEffect), [true])
        XCTAssertTrue(sent.commands.isEmpty)
        // Recovery-load entscheidet nicht; erst der gültige load-Snapshot.
        second.receive(weightHello)
        second.receive(weightSnapshot(21, [], reason: "load", flags: StateFlags(recovery: true)))
        XCTAssertTrue(sent.commands.isEmpty)
        second.receive(weightHello)
        second.receive(weightSnapshot(22, [], reason: "load"))
        XCTAssertEqual(sent.commands, [command], "zuletzt gesehen, jetzt fehlend → Replay")
    }
    // MARK: ownerPending

    @MainActor
    func testOwnerPendingHidesScreensAndHoldsCommands() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = connect(store)
        store.receive(hello)
        store.receive(snapshot(42, items: ["vorher"]))
        XCTAssertEqual(store.availableScreens, ["body"])

        store.receive(.hello(HelloMessage(webVersion: "74", ops: ["test.add"], screens: ["body"], ownerPending: true)))
        XCTAssertTrue(store.ownerPending)
        XCTAssertTrue(store.availableScreens.isEmpty)
        XCTAssertEqual(store.document["items"], ["vorher"], "Spiegel bleibt")
        let command = try store.perform(Command(op: "test.add", args: ["n": 1]))
        XCTAssertTrue(sent.commands.isEmpty, "wie not_ready: nur einreihen")
        XCTAssertEqual(store.pending.count, 1)
        XCTAssertFalse(store.receive(.snapshot(SnapshotMessage(seq: 43, userId: Self.user, state: [:], ownerPending: true))))

        // Zuordnung geklärt: hello(false) und regulärer Snapshot, dann Replay.
        store.receive(hello)
        XCTAssertTrue(sent.commands.isEmpty)
        store.receive(snapshot(44))
        XCTAssertFalse(store.ownerPending)
        XCTAssertEqual(store.availableScreens, ["body"])
        XCTAssertEqual(sent.commands, [command])
    }
}