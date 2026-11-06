import Foundation
import XCTest
@testable import PULSCore

/// N1 (§15): Hello-Erweiterung, Query-Hülle, Abschnitte, Seiten, Abschluss, Indexchart, Teilen und Ops.
final class ExtrasTests: XCTestCase {
    private func hello() throws -> HelloMessage {
        guard case .hello(let hello)? = try InboundMessage.decode(Fixtures.value("n1-hello")) else { throw XCTSkip("hello") }
        return hello
    }

    private func nativeResult(_ result: JSONValue, kind: String = "page", requestId: String = "q") -> JSONValue {
        [
            "protocol": 1, "type": "nativeResult", "requestId": .string(requestId), "seq": 3, "userId": .null, "ownerPending": false,
            "flags": ["preview": false, "recovery": false, "uploadBlocked": false], "language": "de", "kind": .string(kind),
            "ok": true, "result": result,
        ]
    }

    // MARK: Hello

    func testHelloCarriesExtrasLosslessly() throws {
        let hello = try hello()
        XCTAssertEqual(hello.extras?.queries, ["completion", "page", "pageItem", "indexChart", "export", "share"])
        XCTAssertEqual(hello.extras?.ops, [ExtrasOps.completionDismiss])
        XCTAssertTrue(hello.features.contains(ExtrasOps.nativeCompletionFeature))
        XCTAssertTrue(hello.features.contains(ExtrasOps.nativeExtrasFeature))
        XCTAssertEqual(try InboundMessage.decode(hello.json), .hello(hello))
    }

    @MainActor
    func testOffersFollowHelloOnly() throws {
        let store = ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), sessionID: "a"))
        XCTAssertFalse(store.webOffersCompletion)
        XCTAssertFalse(store.offersExtras(.page))
        // Web v80: weder Feature noch `extras`.
        store.receive(.hello(HelloMessage(webVersion: "80", ops: ["weight.upsert"], features: ["nativeTabs"])))
        XCTAssertFalse(store.webOffersCompletion)
        XCTAssertFalse(store.offersExtras(.indexChart))
        store.receive(.hello(try hello()))
        XCTAssertTrue(store.webOffersCompletion)
        XCTAssertTrue(store.offersExtras(.page))
        XCTAssertTrue(store.offersExtras(.indexChart))
        // Nur `nativeCompletion`: keine Seiten.
        var only = try hello()
        only.features.removeAll { $0 == ExtrasOps.nativeExtrasFeature }
        only.extras = ExtrasCapabilities(queries: ["completion"], ops: [ExtrasOps.completionDismiss])
        store.receive(.hello(only))
        XCTAssertTrue(store.webOffersCompletion)
        XCTAssertTrue(store.offersExtras(.completion))
        XCTAssertFalse(store.offersExtras(.page))
    }

    // MARK: Abschluss

    func testWorkoutCompletionFromAckFixture() throws {
        guard case .ack(let ack)? = try InboundMessage.decode(Fixtures.value("n1-workout-completion")) else { return XCTFail("ack") }
        let completion = try XCTUnwrap(NativeCompletion(json: ack.result?["completion"]))
        XCTAssertEqual(completion.kind, .workout)
        XCTAssertEqual(completion.id, "o0000000-0000-4000-8000-000000000003")
        XCTAssertEqual(completion.cycleId, ack.id)
        XCTAssertEqual(completion.xp, 14)
        XCTAssertEqual(completion.level?.level, 1)
        XCTAssertEqual(completion.level?.needed, 250)
        XCTAssertEqual(completion.streak, 1)
        XCTAssertEqual(completion.weekStreak, 2)
        XCTAssertEqual(completion.week.count, 7)
        XCTAssertEqual(completion.week.filter(\.today).map(\.date), ["2026-10-28"])
        XCTAssertFalse(completion.chunked)
        let summary = try XCTUnwrap(completion.workoutSummary)
        XCTAssertEqual(summary.name, "Push")
        XCTAssertEqual(summary.durationClock, "20:00")
        XCTAssertEqual(summary.volume, 640)
        XCTAssertNil(completion.runDetail)
    }

    func testChunkedCompletionHeadIsReadable() throws {
        let completion = try XCTUnwrap(NativeCompletion(json: ["kind": "run", "id": "r", "xp": 3, "chunked": true]))
        XCTAssertEqual(completion.kind, .run)
        XCTAssertTrue(completion.chunked)
        XCTAssertNil(completion.summary)
        XCTAssertNil(completion.cycleId, "alter Kopf ohne expliziten Zyklus")
        XCTAssertNil(NativeCompletion(json: ["kind": "other", "id": "r"]))
        XCTAssertNil(NativeCompletion(json: nil))
    }

    func testLedgerKeepsOpenAndNeverReopensDismissed() throws {
        let directory = try makeTemporaryDirectory()
        let record = CompletionRecord(userId: "u", id: "w", commandId: "c1", completion: ["kind": "workout", "id": "w", "xp": 14])
        let ledger = CompletionLedger(directory: directory)
        XCTAssertTrue(ledger.add(record))
        XCTAssertFalse(ledger.add(record), "Replay desselben Abschlusses")
        XCTAssertEqual(CompletionLedger(directory: directory).records, [record], "übersteht einen Neustart")
        ledger.dismiss(record)
        XCTAssertTrue(ledger.records.isEmpty)
        let restarted = CompletionLedger(directory: directory)
        XCTAssertFalse(restarted.add(record), "ein alter Finish-Ack öffnet nichts neu")
        var otherCommand = record
        otherCommand.commandId = "c2"
        XCTAssertFalse(restarted.add(otherCommand), "inhaltsgleicher Abschluss unter neuer Befehls-ID ist derselbe Zyklus")
        XCTAssertTrue(restarted.records.isEmpty)
        var foreign = record
        foreign.userId = "anderer"
        XCTAssertTrue(restarted.add(foreign), "nutzergebunden")
    }

    func testNewFinishCycleOfSameWorkoutIsShown() throws {
        let ledger = CompletionLedger(directory: try makeTemporaryDirectory())
        let first = CompletionRecord(userId: "u", id: "w", commandId: "c1", completion: ["kind": "workout", "id": "w", "xp": 14])
        XCTAssertTrue(ledger.add(first))
        ledger.dismiss(first)
        let second = CompletionRecord(userId: "u", id: "w", commandId: "c2", completion: ["kind": "workout", "id": "w", "xp": 20])
        XCTAssertTrue(ledger.add(second), "wirklich neu abgeschlossen")
        XCTAssertEqual(ledger.records, [second])
        // Ein noch offener älterer Zyklus wird ersetzt, nicht doppelt gezeigt.
        let third = CompletionRecord(userId: "u", id: "w", commandId: "c3", completion: ["kind": "workout", "id": "w", "xp": 21])
        XCTAssertTrue(ledger.add(third))
        XCTAssertEqual(ledger.records, [third])
        XCTAssertFalse(ledger.add(first), "das alte Ack bleibt geschlossen")
    }

    func testChunkedHeadMatchesFullContentAfterDismiss() throws {
        let directory = try makeTemporaryDirectory()
        let ledger = CompletionLedger(directory: directory)
        let head: JSONValue = ["kind": "run", "id": "r", "xp": 3, "durationXp": 1, "level": ["level": 1], "streak": 2, "chunked": true]
        let record = CompletionRecord(userId: "u", id: "r", commandId: "c1", completion: head)
        XCTAssertTrue(ledger.add(record))
        let full: JSONValue = ["kind": "run", "id": "r", "xp": 3, "durationXp": 1, "level": ["level": 1], "streak": 2, "summary": ["id": "r"]]
        XCTAssertTrue(ledger.replace(record, completion: full))
        XCTAssertEqual(CompletionLedger(directory: directory).records.first?.completion, full, "vollständiger Inhalt dauerhaft")
        let stored = try XCTUnwrap(ledger.records.first)
        ledger.dismiss(stored)
        var replay = record
        replay.commandId = "c9"
        XCTAssertFalse(ledger.add(replay), "gekürzter Kopf desselben Zyklus öffnet nichts neu")
    }

    func testExplicitCycleSurvivesNoopNewCommandAndRestart() throws {
        let directory = try makeTemporaryDirectory()
        let ledger = CompletionLedger(directory: directory)
        let head: JSONValue = ["kind": "workout", "id": "w", "cycleId": "finish-1", "xp": 14, "chunked": true]
        let first = CompletionRecord(userId: "u", id: "w", commandId: "finish-1", completion: head)
        XCTAssertEqual(NativeCompletion(json: head)?.cycleId, "finish-1")
        XCTAssertTrue(ledger.add(first))
        let noop = CompletionRecord(userId: "u", id: "w", commandId: "noop-2", completion: head)
        XCTAssertFalse(ledger.add(noop), "andere Befehls-ID erzeugt keinen neuen Zyklus")
        ledger.dismiss(first)
        let restarted = CompletionLedger(directory: directory)
        XCTAssertFalse(restarted.add(noop), "Zyklus-Dismiss übersteht Neustart")
        var changedPayload = head
        changedPayload["xp"] = 999
        XCTAssertFalse(restarted.add(CompletionRecord(userId: "u", id: "w", commandId: "noop-3", completion: changedPayload)),
                       "explizite Identität statt Inhaltsheuristik")
        XCTAssertEqual(restarted.pendingDismissals.first?.cycleId, "finish-1")
        XCTAssertTrue(restarted.add(CompletionRecord(userId: "other", id: "w", commandId: "noop-2", completion: head)), "nutzergetrennt")
    }

    func testExplicitRefinishWithMatchingChunkedValuesIsShown() throws {
        let directory = try makeTemporaryDirectory()
        let ledger = CompletionLedger(directory: directory)
        let full: JSONValue = ["kind": "workout", "id": "w", "cycleId": "finish-1", "xp": 14, "durationXp": 14,
                               "level": ["level": 1], "streak": 1, "summary": ["name": "old"]]
        let first = CompletionRecord(userId: "u", id: "w", commandId: "finish-1", completion: CompletionLedger.head(full))
        XCTAssertTrue(ledger.add(first))
        XCTAssertTrue(ledger.replace(first, completion: full))
        ledger.dismiss(try XCTUnwrap(ledger.records.first))
        let restarted = CompletionLedger(directory: directory)
        var nextFull = full
        nextFull["cycleId"] = "finish-2"
        nextFull["summary"] = ["name": "renamed after reopening"]
        let next = CompletionRecord(userId: "u", id: "w", commandId: "finish-2", completion: CompletionLedger.head(nextFull))
        XCTAssertTrue(restarted.add(next), "gleiche XP/Level/Serie ohne Summary im Kopf, aber echter neuer Zyklus")
        XCTAssertEqual(restarted.records.first?.cycleId, "finish-2")
        XCTAssertFalse(restarted.replace(first, completion: full), "verspätetes Nachladen des alten Zyklus")
        XCTAssertFalse(restarted.replace(next, completion: full), "Full-Result muss zum Kopf-Zyklus passen")
        XCTAssertTrue(restarted.replace(next, completion: nextFull))
        restarted.dismiss(first)
        XCTAssertEqual(restarted.records.first?.cycleId, "finish-2", "verspätetes Schließen des alten Records erhält den neuen")
        XCTAssertEqual(CompletionLedger(directory: directory).records.first?.completion, nextFull)
        // Bei cycleId hat selbst die alte commandId keine Vorrangwirkung.
        var thirdHead = next.completion
        thirdHead["cycleId"] = "finish-3"
        XCTAssertTrue(restarted.add(CompletionRecord(userId: "u", id: "w", commandId: "finish-1", completion: thirdHead)))
        XCTAssertFalse(restarted.add(next), "Replay des zuvor offenen, inzwischen abgelösten Zyklus")
        XCTAssertEqual(CompletionLedger(directory: directory).records.first?.cycleId, "finish-3")
    }

    func testUnavailableFallbackNeverCoversAClosedCompletion() throws {
        let ledger = CompletionLedger(directory: try makeTemporaryDirectory())
        let real = CompletionRecord(userId: "u", id: "w", commandId: "c1", completion: ["kind": "workout", "id": "w", "xp": 14])
        let fallback = CompletionRecord(userId: "u", id: "w", commandId: "c2",
                                        completion: NativeCompletion.unavailableJSON(kind: .workout, id: "w"))
        XCTAssertTrue(ledger.add(real))
        XCTAssertFalse(ledger.add(fallback), "offener echter Abschluss bleibt")
        ledger.dismiss(real)
        XCTAssertFalse(ledger.add(fallback), "geschlossen bleibt geschlossen")
        let free = CompletionRecord(userId: "u", id: "x", commandId: "c3", completion: NativeCompletion.unavailableJSON(kind: .run, id: "x"))
        XCTAssertTrue(ledger.add(free))
        XCTAssertTrue(NativeCompletion(json: free.completion)?.unavailable == true)
        XCTAssertNil(NativeCompletion(json: free.completion)?.xp, "keine erfundenen XP")
        ledger.dismiss(free)
        XCTAssertFalse(ledger.pendingDismissals.contains { $0.id == "x" }, "im Web gibt es nichts zu bestätigen")
    }

    // MARK: Abschluss im Store

    @MainActor
    private func finishedStore(user: String) throws -> (store: ProfileStore, apply: ApplyCommand) {
        let store = ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), sessionID: "a"))
        store.receive(.hello(try hello()))
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: user, state: ["workouts": []], reason: "load")))
        let apply = try store.perform(Command(op: TrainingOps.workoutFinish, args: ["workoutId": "w", "confirmUnfinished": false]))
        return (store, apply)
    }

    @MainActor
    private func acknowledge(_ apply: ApplyCommand, result: JSONValue, on store: ProfileStore) throws {
        let json: JSONValue = ["protocol": 1, "type": "ack", "id": .string(apply.id), "ok": true, "seq": 2, "result": result]
        guard case .ack(let ack)? = try InboundMessage.decode(json) else { return XCTFail("ack") }
        store.receive(.ack(ack))
    }

    @MainActor
    func testCompletionStaysWithItsOwner() throws {
        let (store, apply) = try finishedStore(user: "a")
        try acknowledge(apply, result: ["workoutId": "w", "completion": ["kind": "workout", "id": "w", "xp": 14]], on: store)
        let record = try XCTUnwrap(store.currentCompletion)
        XCTAssertEqual(record.userId, "a")
        XCTAssertEqual(record.commandId, apply.id)

        store.receive(.snapshot(SnapshotMessage(seq: 3, userId: "b", state: ["workouts": []], reason: "cloud")))
        XCTAssertNil(store.currentCompletion, "A-Abschluss nie unter B")
        XCTAssertFalse(store.completionIsVisible(record))

        store.receive(.snapshot(SnapshotMessage(seq: 4, userId: "a", state: ["workouts": []], reason: "cloud")))
        XCTAssertNotNil(store.currentCompletion)
        store.receive(.hello(HelloMessage(webVersion: "80", ownerPending: true)))
        XCTAssertNil(store.currentCompletion, "ungeklärter Besitzer")
        store.receive(.hello(try hello()))
        XCTAssertNil(store.currentCompletion, "erst ein Snapshot bestätigt das Konto")
        store.receive(.snapshot(SnapshotMessage(seq: 5, userId: "a", state: ["workouts": []], reason: "load")))
        XCTAssertNotNil(store.currentCompletion)
        store.webDocumentDidChange()
        XCTAssertNil(store.currentCompletion, "neues Dokument ohne Bestätigung")
    }

    @MainActor
    func testMissingCompletionGetsFallback() throws {
        let (store, apply) = try finishedStore(user: "a")
        XCTAssertTrue(store.showsNativeCompletion(for: nil))
        try acknowledge(apply, result: ["workoutId": "w", "completionUnavailable": true], on: store)
        let record = try XCTUnwrap(store.currentCompletion)
        XCTAssertEqual(record.id, "w")
        XCTAssertTrue(NativeCompletion(json: record.completion)?.unavailable == true)
    }

    @MainActor
    func testOldWebKeepsItsOwnCompletion() throws {
        let store = ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), sessionID: "a"))
        store.receive(.hello(HelloMessage(webVersion: "80", ops: ["weight.upsert"], features: ["nativeTabs"])))
        XCTAssertFalse(store.showsNativeCompletion(for: ["workoutId": "w"]))
        XCTAssertTrue(store.showsNativeCompletion(for: ["completionUnavailable": true]))
    }

    @MainActor
    func testDismissIsQueuedLaterWhenReadOnly() throws {
        let (store, apply) = try finishedStore(user: "a")
        try acknowledge(apply, result: ["completion": ["kind": "workout", "id": "w", "xp": 14]], on: store)
        let record = try XCTUnwrap(store.currentCompletion)
        store.receive(.snapshot(SnapshotMessage(seq: 3, userId: "a", state: ["workouts": []],
                                                flags: StateFlags(uploadBlocked: true), reason: "save")))
        store.dismissCompletion(record)
        XCTAssertNil(store.currentCompletion)
        XCTAssertFalse(store.pending.contains { $0.command.op == ExtrasOps.completionDismiss }, "gerade nur lesbar")
        store.receive(.snapshot(SnapshotMessage(seq: 4, userId: "a", state: ["workouts": []], reason: "save")))
        XCTAssertEqual(store.pending.filter { $0.command.op == ExtrasOps.completionDismiss }.map { $0.command.args["id"] }, ["w"])
    }

    @MainActor
    func testStoreCarriesCycleThroughDeferredDismissAndFullLoad() throws {
        let (store, apply) = try finishedStore(user: "a")
        let head: JSONValue = ["kind": "workout", "id": "w", "cycleId": "web-cycle", "xp": 14, "chunked": true]
        try acknowledge(apply, result: ["completion": head], on: store)
        let first = try XCTUnwrap(store.currentCompletion)
        XCTAssertEqual(first.cycleId, "web-cycle")
        let noop = try store.perform(Command(op: TrainingOps.workoutFinish, args: ["workoutId": "w"]))
        try acknowledge(noop, result: ["completion": head], on: store)
        XCTAssertEqual(store.currentCompletion?.commandId, apply.id, "noop erhält das ursprüngliche Receipt")
        XCTAssertTrue(store.completionIsVisible(CompletionRecord(userId: "a", id: "w", commandId: noop.id, completion: head)),
                      "Sichtbarkeit folgt cycleId statt Versand-ID")
        var wrongFull = head
        wrongFull["cycleId"] = "another-cycle"
        wrongFull["summary"] = ["name": "wrong"]
        store.storeFullCompletion(first, completion: wrongFull)
        XCTAssertNil(store.currentCompletion?.completion["summary"])
        var full = head
        full["chunked"] = false
        full["summary"] = ["name": "correct"]
        store.storeFullCompletion(first, completion: full)
        XCTAssertEqual(store.currentCompletion?.completion["summary"]?["name"], "correct")
        store.receive(.snapshot(SnapshotMessage(seq: 3, userId: "a", state: ["workouts": []],
                                                flags: StateFlags(uploadBlocked: true), reason: "save")))
        store.dismissCompletion(try XCTUnwrap(store.currentCompletion))
        XCTAssertFalse(store.pending.contains { $0.command.op == ExtrasOps.completionDismiss })
        store.receive(.snapshot(SnapshotMessage(seq: 4, userId: "a", state: ["workouts": []], reason: "save")))
        let dismiss = try XCTUnwrap(store.pending.first { $0.command.op == ExtrasOps.completionDismiss })
        XCTAssertEqual(dismiss.command.args["cycleId"], "web-cycle", "verzögerte Outbox bindet den ursprünglichen Zyklus")
        try acknowledge(noop, result: ["completion": head], on: store)
        XCTAssertNil(store.currentCompletion, "Noop-Ack öffnet keinen geschlossenen Zyklus")
        let next = try store.perform(Command(op: TrainingOps.workoutFinish, args: ["workoutId": "w"]))
        var nextHead = head
        nextHead["cycleId"] = "next-web-cycle"
        try acknowledge(next, result: ["completion": nextHead], on: store)
        XCTAssertEqual(store.currentCompletion?.cycleId, "next-web-cycle")
        XCTAssertFalse(store.completionIsVisible(first), "alter Zyklus bleibt unsichtbar")
    }

    // MARK: Anfragen

    func testRequestShapesMatchContract() throws {
        XCTAssertEqual(NativeQueryRequest.page(.diary(date: "2026-10-28"), limit: 31, cursor: "c", requestId: "r")?.json,
                       ["requestId": "r", "kind": "page", "collection": "diary", "date": "2026-10-28", "limit": 31, "cursor": "c"])
        XCTAssertEqual(NativeQueryRequest.page(.recipes, requestId: "r")?.json, ["requestId": "r", "kind": "page", "collection": "recipes"])
        XCTAssertEqual(NativeQueryRequest.page(.activityEntries(mode: "month", offset: 0, filter: "all"), requestId: "r")?.json,
                       ["requestId": "r", "kind": "page", "collection": "activityEntries", "mode": "month", "offset": 0, "filter": "all"])
        XCTAssertNil(NativeQueryRequest.page(.recipes, limit: 201, requestId: "r"))
        XCTAssertNil(NativeQueryRequest.page(.recipes, requestId: "  "))
        XCTAssertNil(NativeQueryRequest.page(.recipes, requestId: String(repeating: "a", count: 101)))
        XCTAssertEqual(NativeQueryRequest.pageItem(.exerciseHistory(exerciseId: "e"), itemIndex: 2, cursor: "c", requestId: "r")?.json,
                       ["requestId": "r", "kind": "pageItem", "collection": "exerciseHistory", "exerciseId": "e", "itemIndex": 2, "cursor": "c"])
        XCTAssertEqual(NativeQueryRequest.indexChart(requestId: "r")?.json, ["requestId": "r", "kind": "indexChart"])
        XCTAssertEqual(NativeQueryRequest.export(csv: nil, requestId: "r")?.json, ["requestId": "r", "kind": "export", "format": "json"])
        XCTAssertEqual(NativeQueryRequest.export(csv: .foods, requestId: "r")?.json,
                       ["requestId": "r", "kind": "export", "format": "csv", "csvOptions": ["kind": "foods"]])
        XCTAssertEqual(NativeQueryRequest.share(collection: "run", id: "x", requestId: "r")?.json,
                       ["requestId": "r", "kind": "share", "collection": "run", "id": "x"])
        XCTAssertNil(NativeQueryRequest.share(collection: "food", id: "x", requestId: "r"))
        XCTAssertEqual(NativeQueryRequest.completion(kind: .workout, id: "w", requestId: "r")?.json,
                       ["requestId": "r", "kind": "completion", "collection": "workout", "id": "w"])
    }

    // MARK: Antworten

    @MainActor
    func testOnlyRegisteredResultsAreAccepted() throws {
        let store = ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), sessionID: "a"))
        let page: JSONValue = ["collection": "recipes", "items": [], "total": 0, "nextCursor": .null]
        guard case .nativeResult(let message)? = try InboundMessage.decode(nativeResult(page)) else { return XCTFail("result") }
        XCTAssertFalse(store.receive(.nativeResult(message)), "nicht registriert")
        store.registerNativeQuery(try XCTUnwrap(NativeQueryRequest.page(.recipes, requestId: "q")))
        XCTAssertTrue(store.isNativeQueryPending("q"))
        XCTAssertTrue(store.receive(.nativeResult(message)))
        XCTAssertEqual(store.nativeResult("q")?.result, page)
        store.forgetNativeQuery("q")
        XCTAssertNil(store.nativeResult("q"))

        // Falsche Art bzw. neues Dokument: verworfen.
        store.registerNativeQuery(try XCTUnwrap(NativeQueryRequest.indexChart(requestId: "q")))
        XCTAssertFalse(store.receive(.nativeResult(message)))
        store.registerNativeQuery(try XCTUnwrap(NativeQueryRequest.page(.recipes, requestId: "q")))
        let generation = store.extrasGeneration
        store.webDocumentDidChange()
        XCTAssertGreaterThan(store.extrasGeneration, generation)
        XCTAssertFalse(store.isNativeQueryPending("q"))
        XCTAssertFalse(store.receive(.nativeResult(message)))
    }

    func testStaleCursorIsRecognised() throws {
        var json = nativeResult(.null)
        json["ok"] = false
        json["result"] = nil
        json["error"] = ["code": "stale_cursor", "message": "x"]
        guard case .nativeResult(let message)? = try InboundMessage.decode(json) else { return XCTFail("result") }
        XCTAssertTrue(message.isStaleCursor)
        XCTAssertFalse(message.isGone)
        XCTAssertNil(message.result)
    }

    func testUnavailableIsRecognised() throws {
        var json = nativeResult(.null)
        json["ok"] = false
        json["result"] = nil
        json["error"] = ["code": "unavailable", "message": "x"]
        guard case .nativeResult(let message)? = try InboundMessage.decode(json) else { return XCTFail("result") }
        XCTAssertTrue(message.isUnavailable)
        XCTAssertFalse(message.isStaleCursor)
    }

    func testRestartGuardStopsACircle() {
        // 70 Abschnitte: Der Fortsetzungscursor verfällt jedes Mal an derselben Stelle.
        var circle = PageRestartGuard()
        XCTAssertTrue(circle.allowsRestart(reached: 4), "erster Verfall: Fortschritt")
        XCTAssertTrue(circle.allowsRestart(reached: 4))
        XCTAssertFalse(circle.allowsRestart(reached: 4), "nicht weitergekommen: Abbruch")
        // Laufende Saves: Es geht jedes Mal weiter, ist aber trotzdem begrenzt.
        var moving = PageRestartGuard()
        var allowed = 0
        for reached in 1...20 where moving.allowsRestart(reached: reached) { allowed += 1 }
        XCTAssertEqual(allowed, PageRestartGuard.restartLimit)
    }

    func testPageMergeSkipsKnownIDsOnly() {
        let rows: [JSONValue] = [["id": "a", "kind": "workout"], ["date": "2026-10-28", "value": 1]]
        let merged = NativePageRows.merging(rows, [["id": "a", "kind": "workout"], ["id": "a", "kind": "run"], ["date": "2026-10-28", "value": 1]])
        XCTAssertEqual(merged.count, 4, "gleiche ID anderer Art und Zeilen ohne ID bleiben")
    }

    func testChunksCountUTF16AndConcatenateInOrder() throws {
        let first = try XCTUnwrap(NativeChunk(json: ["encoding": "json", "content": "{\"a\":\"😀", "offset": 0, "totalLength": 12,
                                                     "nextCursor": "n", "name": "file"]))
        XCTAssertEqual(first.content.utf16.count, 8)
        XCTAssertEqual(first.meta["name"], "file")
        let second = try XCTUnwrap(NativeChunk(json: ["encoding": "json", "content": "ab\"}", "offset": 8, "totalLength": 12, "nextCursor": .null]))
        var assembler = ChunkAssembler()
        XCTAssertTrue(assembler.append(first))
        XCTAssertFalse(assembler.isComplete)
        XCTAssertNil(assembler.parsed())
        XCTAssertFalse(assembler.append(first), "falscher Offset")
        XCTAssertTrue(assembler.append(second))
        XCTAssertTrue(assembler.isComplete)
        XCTAssertEqual(assembler.parsed(), ["a": "😀ab"])
        XCTAssertEqual(assembler.meta?["name"], "file")

        var wrongTotal = ChunkAssembler()
        XCTAssertTrue(wrongTotal.append(first))
        XCTAssertFalse(wrongTotal.append(try XCTUnwrap(NativeChunk(json: ["encoding": "json", "content": "x", "offset": 8, "totalLength": 9]))))
        XCTAssertNil(NativeChunk(json: ["encoding": "binary", "content": "", "offset": 0, "totalLength": 0]))
    }

    func testPageDecodesRowsAndLargeRow() throws {
        let page = try XCTUnwrap(NativePage(json: ["collection": "records", "items": [["id": "a"]], "total": 3, "nextCursor": "n"]))
        XCTAssertEqual(page, .items(items: [["id": "a"]], total: 3, nextCursor: "n"))
        let large = try XCTUnwrap(NativePage(json: [
            "collection": "exerciseHistory", "itemIndex": 4, "total": 9, "itemCursor": "i", "afterItemCursor": "a",
            "encoding": "json", "content": "{", "offset": 0, "totalLength": 2, "nextCursor": "c",
        ]))
        guard case .largeRow(let row) = large else { return XCTFail("large") }
        XCTAssertEqual(row.itemIndex, 4)
        XCTAssertEqual(row.total, 9)
        XCTAssertEqual(row.afterItemCursor, "a")
        XCTAssertEqual(row.chunk.nextCursor, "c")
        XCTAssertNil(NativePage(json: ["collection": "records"]))
    }

    func testExerciseHistoryRowKeepsEverySet() throws {
        let sets: [JSONValue] = (0..<150).map { _ in ["kg": 50, "reps": 8] }
        let session = ExerciseHistorySession(pageRow: ["workoutId": "w", "date": "2026-10-28", "name": "Push", "e1rm": .null, "sets": .array(sets)], index: 2)
        XCTAssertEqual(session.index, 2)
        XCTAssertEqual(session.sets.count, 150)
        XCTAssertNil(session.e1rm, "kein e1RM bleibt unbekannt")
    }

    func testIndexChartUsesWebValuesOnly() throws {
        let chart = try XCTUnwrap(NativeIndexChart(json: [
            "period": "month", "min": 85, "max": 115, "first": "2026-10-01", "last": "2026-10-28",
            "series": ["weight": [["date": "2026-10-01", "raw": 84.2, "v": 100]], "kcal": []],
        ]))
        XCTAssertEqual(chart.series["weight"]?.first?.raw, 84.2)
        XCTAssertEqual(chart.series["weight"]?.first?.value, 100)
        XCTAssertEqual(chart.series["kcal"]?.count, 0)
        XCTAssertNil(chart.series["strength"], "ausgeschaltete Kurve fehlt")
        XCTAssertNil(NativeIndexChart(json: ["min": 5, "max": 5, "series": [:]]))
    }

    func testShareNeedsTextOrRunData() throws {
        XCTAssertEqual(NativeShare(json: ["title": "PULS", "text": "Push"])?.text, "Push")
        let run = try XCTUnwrap(NativeShare(json: ["title": "PULS", "text": .null, "data": ["id": "r", "type": "run", "name": "Lauf"]]))
        XCTAssertNil(run.text)
        XCTAssertEqual(run.run?.entry.id, "r")
        XCTAssertNil(NativeShare(json: ["title": "PULS", "text": .null]))
    }

    // MARK: Ops

    func testExerciseSettingsLimits() throws {
        let row: JSONValue = ["id": "e", "name": "Bank", "extra": true]
        let command = try XCTUnwrap(ExtrasCommands.exerciseSettings(exerciseId: "e", target: 130, repMin: 5, repMax: 9, loadStep: 1.25,
                                                                    muscle: "chest", expect: row))
        XCTAssertEqual(command.op, ExtrasOps.exerciseSettingsSet)
        XCTAssertEqual(command.args, ["exerciseId": "e", "e1rmTarget": 130, "repMin": 5, "repMax": 9, "loadStep": 1.25,
                                      "muscles": ["chest"], "expect": row])
        let keep = try XCTUnwrap(ExtrasCommands.exerciseSettings(exerciseId: "e", target: 0, repMin: 6, repMax: 10, loadStep: 2.5,
                                                                 muscle: nil, expect: row))
        XCTAssertNil(keep.args["muscles"], "Bibliothekszuordnung bleibt")
        func invalid(target: Double = 0, repMin: Int = 6, repMax: Int = 10, step: Double = 2.5, muscle: String? = nil) -> Bool {
            ExtrasCommands.exerciseSettings(exerciseId: "e", target: target, repMin: repMin, repMax: repMax, loadStep: step,
                                            muscle: muscle, expect: row) == nil
        }
        XCTAssertTrue(invalid(target: 2001))
        XCTAssertTrue(invalid(repMin: 0))
        XCTAssertTrue(invalid(repMax: 31))
        XCTAssertTrue(invalid(repMin: 10, repMax: 9))
        XCTAssertTrue(invalid(step: 0.1))
        XCTAssertTrue(invalid(muscle: "invented"))
    }

    func testRouteFromRunNeedsStableIDs() throws {
        let command = try XCTUnwrap(ExtrasCommands.routeFromRun(runId: "run-1", routeId: "route-1", name: " Runde "))
        XCTAssertEqual(command.args, ["runId": "run-1", "routeId": "route-1", "name": " Runde "], "den Namen normalisiert das Web")
        XCTAssertNil(ExtrasCommands.routeFromRun(runId: "run 1", routeId: "r", name: ""))
        XCTAssertNil(ExtrasCommands.routeFromRun(runId: "r", routeId: "r", name: String(repeating: "a", count: 257)))
    }

    func testDismissCommandBindsOptionalCycle() throws {
        XCTAssertEqual(ExtrasCommands.dismissCompletion(id: "w")?.args, ["id": "w"], "kompatibler Altpfad")
        XCTAssertEqual(ExtrasCommands.dismissCompletion(id: "w", cycleId: "finish-1")?.args, ["id": "w", "cycleId": "finish-1"])
        XCTAssertNil(ExtrasCommands.dismissCompletion(id: "w", cycleId: ""))
        XCTAssertNil(ExtrasCommands.dismissCompletion(id: "w", cycleId: String(repeating: "a", count: 257)))
    }

    func testEffects() throws {
        let row: JSONValue = ["id": "e", "target": 130]
        let saved: JSONValue = ["id": "route-1", "name": "Runde", "line": "51.00000,10.00000;51.00100,10.00100", "distanceKm": 1.5]
        let state: JSONValue = [
            "exerciseBook": [row], "runRoutes": [saved],
            "runs": [["id": "run-1", "distanceKm": 1.5, "route": "51,10;51.000999999,10.001"]],
        ]
        let settings = try XCTUnwrap(BridgeOps.defaultEffectChecks[ExtrasOps.exerciseSettingsSet])
        XCTAssertTrue(settings(["exerciseId": "e"], state, ["exercise": row]))
        XCTAssertFalse(settings(["exerciseId": "e"], state, ["exercise": ["id": "e", "target": 140]]))
        let route = try XCTUnwrap(BridgeOps.defaultEffectChecks[ExtrasOps.routeFromRun])
        XCTAssertTrue(route(["runId": "run-1", "routeId": "route-1", "name": " Runde "], state, nil))
        XCTAssertFalse(route(["runId": "run-1", "routeId": "other", "name": "Runde"], state, nil))
        XCTAssertFalse(route(["runId": "run-1", "routeId": "route-1", "name": "Anders"], state, nil), "bloße ID genügt nicht")
        var moved = state
        moved["runs"] = [["id": "run-1", "distanceKm": 1.5, "route": "52,10;52.001,10.001"]]
        XCTAssertFalse(route(["runId": "run-1", "routeId": "route-1", "name": "Runde"], moved, nil), "andere Geometrie")
        var longer = state
        longer["runs"] = [["id": "run-1", "distanceKm": 2, "route": "51,10;51.000999999,10.001"]]
        XCTAssertFalse(route(["runId": "run-1", "routeId": "route-1", "name": "Runde"], longer, nil), "andere Distanz")
        var deleted = state
        deleted["runs"] = []
        XCTAssertTrue(route(["runId": "run-1", "routeId": "route-1", "name": "Runde"], deleted, nil), "Quelllauf gelöscht")
        XCTAssertEqual(ExtrasOps.routeName("   "), "Route")
        XCTAssertEqual(ExtrasOps.routeName(String(repeating: "a", count: 70)).count, 60)
        let dismiss = try XCTUnwrap(BridgeOps.defaultEffectChecks[ExtrasOps.completionDismiss])
        XCTAssertTrue(dismiss(["id": "w"], state, ["dismissedId": "w"]))
        XCTAssertFalse(dismiss(["id": "w"], state, nil))
    }

    // MARK: Portionen

    func testPortionInOtherUnitDoesNotMatchBase() throws {
        var product = try XCTUnwrap(Fixtures.value("nutrition-result-product")["result"])
        var expect = try XCTUnwrap(product["expect"])
        expect["portions"] = [["name": "Glas", "amount": 30, "unit": "ml", "source": "Eigene Portionsangabe"]]
        product["expect"] = expect
        let detail = try NutritionProductDetail(json: product)
        let portion = try XCTUnwrap(detail.portions.first)
        XCTAssertEqual(portion.unit, "ml", "Einheit bleibt unverändert")
        XCTAssertFalse(portion.matches(base: detail.base), "30 ml sind ohne Dichte keine 30 g")
        XCTAssertTrue(portion.matches(base: "ml"))
    }
}
