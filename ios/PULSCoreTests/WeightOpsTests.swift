import Foundation
import XCTest
@testable import PULSCore

/// Optimistische Vorschau für weight.upsert/weight.delete: dieselbe Mutation wie das Web (ein Gewicht pro Tag).
final class WeightOpsTests: XCTestCase {
    private static let user = Fixtures.sessionUser

    private func weight(_ id: String, _ date: String, _ kg: Double) -> JSONValue {
        ["id": .string(id), "date": .string(date), "kg": .number(kg)]
    }

    // MARK: Reducer

    func testUpsertReplacesSameIdAndSameDayAndKeepsOtherFields() {
        var state: JSONValue = [
            "weights": [weight("a", "2026-10-26", 83), weight("b", "2026-10-27", 82), weight("c", "2026-10-28", 81)],
            "profile": ["weight": 84],
        ]
        // Neue ID für einen belegten Tag: alter Tageseintrag fällt weg (wie addWeight).
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: "n", date: "2026-10-27", kg: 81.5))
        XCTAssertEqual(state["weights"], [weight("a", "2026-10-26", 83), weight("c", "2026-10-28", 81), weight("n", "2026-10-27", 81.5)])

        // Bestehende ID auf neuen Tag verschieben, der schon belegt ist: beide alten Zeilen fallen weg.
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: "a", date: "2026-10-28", kg: 80))
        XCTAssertEqual(state["weights"], [weight("n", "2026-10-27", 81.5), weight("a", "2026-10-28", 80)])
        XCTAssertEqual(state["profile"], ["weight": 84])
    }

    func testUpsertCreatesWeightsListAndIgnoresInvalidArgs() {
        var state: JSONValue = ["x": true]
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: "a", date: "2026-10-26", kg: 19))
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: "a", date: "2026-10-26", kg: 401))
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: " ", date: "2026-10-26", kg: 80))
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: "a", date: "26.10.2026", kg: 80))
        XCTAssertEqual(state, ["x": true])
        BridgeOps.reduceWeightUpsert(&state, BridgeOps.weightUpsertArgs(id: "a", date: "2026-10-26", kg: 20))
        XCTAssertEqual(state["weights"], [weight("a", "2026-10-26", 20)])
    }

    func testDeleteFiltersByIdAndIsIdempotent() {
        var state: JSONValue = ["weights": [weight("a", "2026-10-26", 83), weight("b", "2026-10-27", 82)]]
        BridgeOps.reduceWeightDelete(&state, BridgeOps.weightDeleteArgs(id: "a"))
        XCTAssertEqual(state["weights"], [weight("b", "2026-10-27", 82)])
        BridgeOps.reduceWeightDelete(&state, BridgeOps.weightDeleteArgs(id: "a"))
        XCTAssertEqual(state["weights"], [weight("b", "2026-10-27", 82)])
        var empty: JSONValue = [:]
        BridgeOps.reduceWeightDelete(&empty, BridgeOps.weightDeleteArgs(id: "a"))
        XCTAssertEqual(empty, [:])
    }

    // MARK: Im Store

    private final class SentLog {
        var commands: [ApplyCommand] = []
    }

    @MainActor
    private func makeStore(directory: URL) -> ProfileStore {
        let ids = SequentialIDs()
        return ProfileStore(environment: StoreEnvironment(
            directory: directory,
            now: { fixedNow },
            makeCommandID: { ids.make() },
            sessionID: "app-1",
            reducers: BridgeOps.weightReducers
        ))
    }

    @MainActor
    private func ready(_ store: ProfileStore, weights: [JSONValue], seq: Int = 10) -> SentLog {
        let log = SentLog()
        store.sender = { log.commands.append($0) }
        store.receive(.hello(HelloMessage(webVersion: "75", ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete], screens: ["body"])))
        store.receive(.snapshot(SnapshotMessage(seq: seq, userId: Self.user, state: ["weights": .array(weights), "keep": 1], reason: "load")))
        return log
    }

    @MainActor
    func testOptimisticUpsertDeleteAndUndoInStore() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = ready(store, weights: [weight("a", "2026-10-26", 83)])
        XCTAssertEqual(store.availableScreens, ["body"])

        let add = try store.perform(Command(op: BridgeOps.weightUpsert,
                                            args: BridgeOps.weightUpsertArgs(id: "n", date: "2026-10-26", kg: 82.4)))
        XCTAssertEqual(add.args["expect"], "a")
        XCTAssertEqual(WeightEntry.entries(in: store.document), [WeightEntry(id: "n", date: "2026-10-26", kg: 82.4)])
        XCTAssertEqual(store.document["keep"], 1)

        let delete = try store.perform(Command(op: BridgeOps.weightDelete, args: BridgeOps.weightDeleteArgs(id: "n")))
        XCTAssertEqual(delete.args["expect"], "n")
        XCTAssertEqual(WeightEntry.entries(in: store.document), [])

        // Rückgängig = Upsert mit denselben Werten; der Tag ist in der Anzeige leer, also expect null.
        let undo = try store.perform(Command(op: BridgeOps.weightUpsert,
                                             args: BridgeOps.weightUpsertArgs(id: "n", date: "2026-10-26", kg: 82.4)))
        XCTAssertEqual(undo.args["expect"], .null)
        XCTAssertEqual(WeightEntry.entries(in: store.document), [WeightEntry(id: "n", date: "2026-10-26", kg: 82.4)])
        XCTAssertEqual(sent.commands.map(\.id), [add.id, delete.id, undo.id])
        // Bestätigter Stand bleibt bis zum Web-Snapshot unverändert.
        XCTAssertEqual(WeightEntry.entries(in: store.confirmedDocument), [WeightEntry(id: "a", date: "2026-10-26", kg: 83)])
    }

    @MainActor
    func testConflictRollsBackAndResendWithFreshExpect() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = ready(store, weights: [])
        let mine = try store.perform(Command(op: BridgeOps.weightUpsert,
                                             args: BridgeOps.weightUpsertArgs(id: "m", date: "2026-10-26", kg: 82)))
        XCTAssertEqual(mine.args["expect"], .null)

        // Anderes Gerät hat den Tag inzwischen belegt.
        store.receive(.snapshot(SnapshotMessage(seq: 11, userId: Self.user,
                                                state: ["weights": [weight("o", "2026-10-26", 80)]], reason: "cloud")))
        store.receive(.ack(AckMessage(id: mine.id, ok: false, seq: 11, error: AckError(code: .conflict))))
        XCTAssertEqual(store.conflicts.map(\.command.id), [mine.id])
        XCTAssertEqual(WeightEntry.entries(in: store.document), [WeightEntry(id: "o", date: "2026-10-26", kg: 80)])

        // „Meinen Wert übernehmen“: neuer Befehl ohne expect (Store setzt den aktuellen), alter wird verworfen.
        var args = mine.args
        args["expect"] = nil
        let resend = try store.perform(Command(op: mine.op, args: args))
        try store.discardCommand(id: mine.id)
        XCTAssertEqual(resend.args["expect"], "o")
        XCTAssertTrue(store.conflicts.isEmpty)
        XCTAssertEqual(WeightEntry.entries(in: store.document), [WeightEntry(id: "m", date: "2026-10-26", kg: 82)])
        XCTAssertEqual(sent.commands.last?.id, resend.id)
    }

    // MARK: Ausdrückliches expect (Stand beim Start der Aktion)

    @MainActor
    func testEditUsesNewIdAndKeepsExpectFromStartEvenAfterNewerSnapshot() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = ready(store, weights: [weight("o1", "2026-10-26", 83)])
        let original = try XCTUnwrap(WeightEntry.entries(in: store.document).first)
        let command = WeightCommands.edit(original: original, kg: 82, newID: "n")

        // Während das Sheet offen ist, ändert ein anderes Gerät denselben Tag (neue ID wie im Web).
        store.receive(.snapshot(SnapshotMessage(seq: 11, userId: Self.user,
                                                state: ["weights": [weight("o2", "2026-10-26", 81)]], reason: "cloud")))
        let apply = try store.performWeight(command, asUser: Self.user)
        XCTAssertEqual(apply.args["id"], "n")
        XCTAssertEqual(apply.args["date"], "2026-10-26")
        XCTAssertEqual(apply.args["expect"], "o1", "nicht still auf o2 ersetzt: das Web meldet conflict")
        XCTAssertEqual(sent.commands.last, apply)
    }

    func testAddCommandExpectsDayFromOpenedState() {
        let seen = [WeightEntry(id: "a", date: "2026-10-26", kg: 83)]
        XCTAssertEqual(WeightCommands.add(date: "2026-10-26", kg: 82, newID: "n", seen: seen).args["expect"], "a")
        XCTAssertEqual(WeightCommands.add(date: "2026-10-27", kg: 82, newID: "n", seen: seen).args["expect"], .null)
        XCTAssertEqual(WeightCommands.delete(seen[0]).args, ["id": "a", "expect": "a"])
    }

    func testRestoreRefusesWhenDayOrIdIsTakenAgain() {
        let deleted = WeightEntry(id: "a", date: "2026-10-26", kg: 83)
        XCTAssertNil(WeightCommands.restore(deleted, current: [WeightEntry(id: "x", date: "2026-10-26", kg: 80)]))
        // Gleiche ID inzwischen mit anderem Datum: nicht überschreiben.
        XCTAssertNil(WeightCommands.restore(deleted, current: [WeightEntry(id: "a", date: "2026-10-27", kg: 80)]))
        let restore = WeightCommands.restore(deleted, current: [WeightEntry(id: "y", date: "2026-10-25", kg: 80)])
        XCTAssertEqual(restore?.args, ["id": "a", "date": "2026-10-26", "kg": 83, "expect": .null])
    }

    // MARK: Konto-Bindung

    @MainActor
    func testConflictsAndActionsAreBoundToCurrentUser() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        let sent = ready(store, weights: [])
        let mine = try store.performWeight(WeightCommands.add(date: "2026-10-26", kg: 82, newID: "m", seen: []), asUser: Self.user)
        store.receive(.ack(AckMessage(id: mine.id, ok: false, seq: 10, error: AckError(code: .conflict))))
        XCTAssertEqual(store.weightConflicts.map(\.command.id), [mine.id])

        // Kontowechsel zu B.
        let other = "b0000000-0000-4000-8000-0000000000bb"
        store.receive(.hello(HelloMessage(webVersion: "75", ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete], screens: ["body"])))
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: other, state: ["weights": []], reason: "load")))
        XCTAssertEqual(store.conflicts.count, 1, "Konflikt von A bleibt erhalten")
        XCTAssertTrue(store.weightConflicts.isEmpty, "aber nie unter B sichtbar")

        let sentBefore = sent.commands.count
        XCTAssertThrowsError(try store.useMineWeight(conflictID: mine.id, asUser: other)) { error in
            XCTAssertEqual(error as? WeightCommandError, .userChanged)
        }
        XCTAssertThrowsError(try store.useMineWeight(conflictID: mine.id, asUser: Self.user)) { error in
            XCTAssertEqual(error as? WeightCommandError, .userChanged)
        }
        XCTAssertThrowsError(try store.keepOtherWeight(conflictID: mine.id, asUser: other)) { error in
            XCTAssertEqual(error as? WeightCommandError, .userChanged)
        }
        XCTAssertEqual(store.conflicts.count, 1)
        XCTAssertEqual(sent.commands.count, sentBefore, "nichts von A unter B gesendet")
        XCTAssertTrue(WeightEntry.entries(in: store.document).isEmpty)

        // Sheet/Undo aus der Sitzung von A darf unter B nichts schreiben.
        XCTAssertThrowsError(try store.performWeight(
            WeightCommands.add(date: "2026-10-27", kg: 80, newID: "late", seen: []), asUser: Self.user
        )) { error in
            XCTAssertEqual(error as? WeightCommandError, .userChanged)
        }
        XCTAssertEqual(sent.commands.count, sentBefore)
    }

    @MainActor
    func testUseMineAndKeepOtherViaStoreForCurrentUser() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        _ = ready(store, weights: [weight("o", "2026-10-26", 80)])
        let first = try store.performWeight(WeightCommands.edit(original: WeightEntry(id: "x", date: "2026-10-26", kg: 79), kg: 82, newID: "m"),
                                            asUser: Self.user)
        store.receive(.ack(AckMessage(id: first.id, ok: false, seq: 10, error: AckError(code: .conflict))))
        let resend = try store.useMineWeight(conflictID: first.id, asUser: Self.user)
        XCTAssertEqual(resend.args["expect"], "o")
        XCTAssertTrue(store.weightConflicts.isEmpty)

        store.receive(.ack(AckMessage(id: resend.id, ok: false, seq: 10, error: AckError(code: .conflict))))
        try store.keepOtherWeight(conflictID: resend.id, asUser: Self.user)
        XCTAssertTrue(store.conflicts.isEmpty)
        XCTAssertThrowsError(try store.keepOtherWeight(conflictID: resend.id, asUser: Self.user)) { error in
            XCTAssertEqual(error as? WeightCommandError, .noLongerConflict)
        }
        XCTAssertEqual(WeightEntry.entries(in: store.document), [WeightEntry(id: "o", date: "2026-10-26", kg: 80)])
    }

    @MainActor
    func testConflictKeepOtherDeviceDiscards() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        _ = ready(store, weights: [weight("o", "2026-10-26", 80)])
        let mine = try store.perform(Command(op: BridgeOps.weightDelete, args: BridgeOps.weightDeleteArgs(id: "o")))
        store.receive(.ack(AckMessage(id: mine.id, ok: false, seq: 10, error: AckError(code: .conflict))))
        try store.discardCommand(id: mine.id)
        XCTAssertTrue(store.conflicts.isEmpty)
        XCTAssertTrue(store.pending.isEmpty)
        XCTAssertEqual(WeightEntry.entries(in: store.document), [WeightEntry(id: "o", date: "2026-10-26", kg: 80)])
    }
}
