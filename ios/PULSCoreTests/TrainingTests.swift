import Foundation
import XCTest
@testable import PULSCore

/// M4: Trainings-Projektion, Ack-Ergebnis, `gone`/`busy`, Preparer, Reducer und Wirkungsprüfungen.
final class TrainingTests: XCTestCase {
    private static let user = Fixtures.sessionUser
    private static let workoutID = "o0000000-0000-4000-8000-000000000003"
    private static let bench = "e0000000-0000-4000-8000-000000000011"
    private static let fly = "e0000000-0000-4000-8000-000000000012"

    private func fixtureProjection() throws -> TrainingProjectionMessage {
        guard case .trainingProjection(let message)? = try InboundMessage.decode(data: Fixtures.data("training-projection")) else {
            throw XCTSkip("training-projection erwartet")
        }
        return message
    }

    private func profile() throws -> JSONValue {
        try XCTUnwrap(Fixtures.value("training-input")["profile"])
    }

    private var trainingHello: InboundMessage {
        .hello(HelloMessage(
            webVersion: "76",
            ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete] + TrainingOps.all.sorted(),
            screens: ["body", "training"], ownerPending: false,
            projections: ["overview", "training"], features: ["nativeTabs", "nativeTraining"]
        ))
    }

    private final class SentLog {
        var commands: [ApplyCommand] = []
    }

    @MainActor
    private func makeStore(directory: URL, ids: SequentialIDs = SequentialIDs(), session: String = "app-1") -> ProfileStore {
        ProfileStore(environment: StoreEnvironment(
            directory: directory, now: { fixedNow }, makeCommandID: { ids.make() }, sessionID: session,
            reducers: BridgeOps.trainingReducers
        ))
    }

    @MainActor
    private func connectedStore(directory: URL? = nil, session: String = "app-1") throws -> (ProfileStore, SentLog) {
        let store = makeStore(directory: try directory ?? makeTemporaryDirectory(), session: session)
        let log = SentLog()
        store.sender = { log.commands.append($0) }
        store.receive(trainingHello)
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: try profile(), reason: "load")))
        store.receive(.trainingProjection(try fixtureProjection()))
        return (store, log)
    }

    // MARK: Decoder

    func testTrainingProjectionEnvelopeAndRoundTrip() throws {
        let message = try fixtureProjection()
        XCTAssertEqual(message.projectionSeq, 1)
        XCTAssertEqual(message.seq, 1)
        XCTAssertEqual(message.userId, Self.user)
        XCTAssertEqual(message.reason, "load")
        XCTAssertNil(message.raw["accountSection"], "Training trägt kein accountSection")
        XCTAssertEqual(message.json, try Fixtures.value("training-projection"))
        let data = try JSONEncoder().encode(message)
        XCTAssertEqual(try JSONDecoder().decode(TrainingProjectionMessage.self, from: data), message)
    }

    func testActiveSessionKeepsEmptyDistinctFromNumbers() throws {
        let training = try fixtureProjection().training
        XCTAssertEqual(training.language, "de")
        XCTAssertEqual(training.today, "2026-10-28")
        XCTAssertEqual(training.restSeconds, 90)
        let active = try XCTUnwrap(training.active)
        XCTAssertEqual(active.id, Self.workoutID)
        XCTAssertEqual(active.startedAt, 1_793_187_600_000)
        XCTAssertEqual(active.autoFinishAt, 1_793_205_600_000)
        XCTAssertEqual(active.rest, RestInfo(endAt: 1_793_188_860_000, exerciseId: Self.bench))
        XCTAssertEqual(active.loggedSets, 1)
        XCTAssertEqual(active.openSets, 4)
        XCTAssertTrue(active.complete)
        let bench = try XCTUnwrap(active.exercise(id: Self.bench))
        XCTAssertEqual(bench.libraryId, "x0000000-0000-4000-8000-000000000001")
        XCTAssertEqual(bench.effectiveRestSeconds, 120)
        XCTAssertEqual(bench.supersetWith, [Self.fly])
        XCTAssertEqual(bench.previous?.date, "2026-10-24")
        XCTAssertEqual(bench.sets.map(\.kg), [.number(80), .number(80), .empty])
        XCTAssertEqual(bench.sets.map(\.reps), [.number(8), .number(7), .empty])
        XCTAssertEqual(bench.sets.map(\.done), [true, false, false])
        XCTAssertEqual(bench.sets[1].previous, PreviousSet(kg: .number(80), reps: .number(7), shownKg: 80))
        XCTAssertNil(bench.sets[2].previous)
        // Vorbelegung ist nie erledigt.
        XCTAssertEqual(active.exercise(id: Self.fly)?.sets.first?.done, false)
        XCTAssertEqual(active.exercise(id: Self.fly)?.sets.first?.kg, .number(15))
    }

    func testRoutinesLibraryRecentIdentity() throws {
        let training = try fixtureProjection().training
        XCTAssertEqual(training.routines.map(\.id), ["t0000000-0000-4000-8000-000000000001"])
        XCTAssertEqual(training.routines.first?.setCount, 5)
        XCTAssertEqual(training.routines.first?.exercises.last?.superset, "s0000000-0000-4000-8000-000000000001")
        XCTAssertNil(training.routines.first?.exercises.first?.superset)
        XCTAssertEqual(training.recommendation?.nextRoutineId, "t0000000-0000-4000-8000-000000000001")
        XCTAssertEqual(training.recommendation?.last?.date, "2026-10-24")
        XCTAssertEqual(training.library.map(\.equipment), ["barbell", "cable"])
        XCTAssertNil(training.library.last?.repMin)
        XCTAssertEqual(training.recent.first?.durationSeconds, 4200)
        XCTAssertEqual(training.recent.first?.volume, 1380)
        XCTAssertEqual(training.recent.first?.xp, 49)
        XCTAssertEqual(training.identity?.level, 1)
        XCTAssertEqual(training.identity?.needed, 250)
        XCTAssertEqual(training.identity?.streak, 0)
        XCTAssertFalse(training.omitted.any)
    }

    func testAckResultAndNewCodes() throws {
        guard case .ack(let ack)? = try InboundMessage.decode(data: Fixtures.data("ack-training-start")) else {
            return XCTFail("ack erwartet")
        }
        XCTAssertEqual(ack.result, ["workoutId": "w-web-generated-uuid", "started": true])
        XCTAssertEqual(AckErrorCode(code: "gone"), .gone)
        XCTAssertEqual(AckErrorCode(code: "busy"), .busy)
        // Ein Ack ohne Objekt-Ergebnis bleibt gültig.
        let text = #"{"type":"ack","protocol":1,"id":"c1","ok":true,"seq":2,"result":"x"}"#
        guard case .ack(let lenient)? = try InboundMessage.decode(JSONValue.parse(text)) else { return XCTFail("ack") }
        XCTAssertNil(lenient.result)
    }

    func testOpenNativeTrainingAndExerciseSearch() throws {
        let open = #"{"type":"openNative","protocol":1,"screen":"training","workoutId":"o1"}"#
        XCTAssertEqual(try InboundMessage.decode(JSONValue.parse(open)),
                       .openNative(OpenNativeMessage(screen: "training", workoutId: "o1")))
        let search = #"""
        {"type":"exerciseSearch","protocol":1,"requestId":"r1","query":"bank","equipment":"all","total":2,"canCreate":true,
         "items":[{"id":"x1","name":"Bankdrücken","muscles":["chest"],"equipment":"barbell","inLibrary":true},{"name":"ohne ID"}]}
        """#
        guard case .exerciseSearch(let message)? = try InboundMessage.decode(JSONValue.parse(search)) else {
            return XCTFail("exerciseSearch erwartet")
        }
        XCTAssertEqual(message.requestId, "r1")
        XCTAssertTrue(message.canCreate)
        XCTAssertEqual(message.items.map(\.id), ["x1"])
        XCTAssertEqual(message.total, 2)
        let missingID = #"{"type":"exerciseSearch","protocol":1,"items":[]}"#
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(missingID)))
    }

    func testWebCallsAreSerializedJSON() {
        XCTAssertTrue(WebCall.setTraining(true).contains("pulsNativeSetTraining(true)===true"))
        XCTAssertNil(WebCall.resumeWorkoutInWeb(id: ""))
        let fallback = WebCall.resumeWorkoutInWeb(id: "o\"1")
        XCTAssertTrue(fallback?.contains(#""id":"o\"1""#) == true)
        XCTAssertTrue(fallback?.contains(#""web":true"#) == true)
        let request = ExerciseSearchRequest(requestId: "r", query: String(repeating: "a", count: 150), equipment: "x", limit: 999)
        XCTAssertEqual(request.query.utf16.count, 100)
        XCTAssertEqual(request.equipment, "all")
        XCTAssertEqual(request.limit, 200)
    }

    // MARK: Store

    @MainActor
    func testTrainingBecomesAvailableOnlyWithAllOps() throws {
        let (store, _) = try connectedStore()
        XCTAssertTrue(store.availableScreens.contains("training"))
        XCTAssertTrue(store.webOffersTraining)
        XCTAssertNotNil(store.currentTraining)

        store.receive(.hello(HelloMessage(webVersion: "76", ops: ["set.update"], screens: ["training"],
                                          projections: ["training"])))
        XCTAssertFalse(store.availableScreens.contains("training"))
        XCTAssertNil(store.currentTraining)

        store.receive(.hello(HelloMessage(ownerPending: true)))
        XCTAssertNil(store.trainingProjection, "ownerPending verwirft die Projektion sofort")
    }

    @MainActor
    func testProjectionOfOtherUserIsNotShown() throws {
        let store = makeStore(directory: try makeTemporaryDirectory())
        store.receive(trainingHello)
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: "anderer", state: try profile(), reason: "load")))
        store.receive(.trainingProjection(try fixtureProjection()))
        XCTAssertNil(store.currentTraining)
    }

    @MainActor
    func testSetUpdatePreparerMatchesFixtureAndShowsOptimistically() throws {
        let (store, log) = try connectedStore()
        let fixture = try ApplyCommand(json: Fixtures.value("apply-training-set-update"))
        let apply = try store.performTraining(
            TrainingCommands.updateSet(workoutId: Self.workoutID, exerciseId: Self.bench, setIndex: 1,
                                       kg: .number(82.5), reps: .number(8), done: true),
            asUser: Self.user
        )
        XCTAssertEqual(apply.op, fixture.op)
        XCTAssertEqual(apply.args, fixture.args, "Gleiche Felder und dasselbe expect wie die Web-Fixture")
        XCTAssertEqual(log.commands.map(\.id), [apply.id])

        let session = try XCTUnwrap(store.trainingSession(workoutId: Self.workoutID))
        let set = try XCTUnwrap(session.exercise(id: Self.bench)?.sets[1])
        XCTAssertEqual(set.kg, .number(82.5))
        XCTAssertTrue(set.done)
        XCTAssertEqual(set.previous?.reps, .number(7))
        XCTAssertTrue(store.hasUnconfirmed { $0.op == TrainingOps.setUpdate })

        // Zweiter Befehl auf demselben Satz baut auf dem optimistischen Stand auf.
        let second = try store.performTraining(
            TrainingCommands.updateSet(workoutId: Self.workoutID, exerciseId: Self.bench, setIndex: 1, reps: .number(9)),
            asUser: Self.user
        )
        XCTAssertEqual(second.args["expect"], ["kg": 82.5, "reps": 8, "done": true])
    }

    @MainActor
    func testEmptyingAFieldClearsDoneAndItsRest() throws {
        var state = try profile()
        let args: JSONValue = [
            "workoutId": .string(Self.workoutID), "exerciseId": .string(Self.bench), "setIndex": 0, "kg": "",
            "expect": ["kg": 80, "reps": 8, "done": true],
        ]
        BridgeOps.reduceSetUpdate(&state, args)
        let set = try XCTUnwrap(TrainingOps.exercise(state, Self.workoutID, Self.bench)?["sets"]?[0])
        XCTAssertEqual(set["kg"], "")
        XCTAssertEqual(set["done"], false)
        XCTAssertEqual(set["reps"], 8)
        // „Erledigt“ ohne kg wäre im Web `invalid`: keine Vorschau.
        XCTAssertNil(TrainingOps.setTarget(current: set, args: ["done": true]))
        XCTAssertNil(TrainingOps.setTarget(current: set, args: ["reps": 1.5]))
        XCTAssertNil(TrainingOps.setTarget(current: set, args: ["kg": 1001]))
    }

    @MainActor
    func testCountPreparersAndStructuralExpectations() throws {
        let (store, _) = try connectedStore()
        let add = try store.performTraining(TrainingCommands.addSet(workoutId: Self.workoutID, exerciseId: Self.bench), asUser: Self.user)
        XCTAssertEqual(add.args["expect"], ["setCount": 3])
        let move = try store.performTraining(
            TrainingCommands.moveExercise(workoutId: Self.workoutID, exerciseId: Self.fly, toIndex: 0), asUser: Self.user)
        XCTAssertEqual(move.args["expect"], ["order": [.string(Self.bench), .string(Self.fly)]])
        // Verschieben wird optimistisch angezeigt.
        XCTAssertEqual(store.trainingSession(workoutId: Self.workoutID)?.exercises.map(\.id), [Self.fly, Self.bench])
        let skip = try store.performTraining(TrainingCommands.skipRest(workoutId: Self.workoutID), asUser: Self.user)
        XCTAssertEqual(skip.args["expect"], ["endAt": 1_793_188_860_000])
        let remove = try store.performTraining(
            TrainingCommands.removeExercise(workoutId: Self.workoutID, exerciseId: Self.bench), asUser: Self.user)
        XCTAssertEqual(remove.args["expect"], ["doneSets": 1])
        XCTAssertEqual(store.trainingSession(workoutId: Self.workoutID)?.exercises.map(\.id), [Self.fly])
        let routine = try XCTUnwrap(store.rawRoutine(id: "t0000000-0000-4000-8000-000000000001"))
        let save = try store.performTraining(TrainingCommands.saveRoutine(routine, expect: routine), asUser: Self.user)
        XCTAssertEqual(save.args["expect"], routine)
    }

    @MainActor
    func testGoneDiscardsAndRollsBack() throws {
        let (store, _) = try connectedStore()
        let apply = try store.performTraining(TrainingCommands.skipRest(workoutId: Self.workoutID), asUser: Self.user)
        XCTAssertNil(store.trainingSession(workoutId: Self.workoutID)?.rest, "optimistisch beendet")
        store.receive(.ack(AckMessage(id: apply.id, ok: false, seq: 1, error: AckError(code: .gone, message: "weg"))))
        XCTAssertTrue(store.outboxEntries.isEmpty, "gone wird nie erneut gesendet")
        XCTAssertNotNil(store.trainingSession(workoutId: Self.workoutID)?.rest, "Anzeige wieder wie im Web")
        XCTAssertEqual(store.notice, .commandGone(id: apply.id, op: TrainingOps.restSkip, message: "weg"))
        XCTAssertEqual(store.recentAcks.last?.code, .gone)
    }

    @MainActor
    func testBusyIsResentAfterNonModalChrome() throws {
        let (store, log) = try connectedStore()
        let apply = try store.performTraining(TrainingCommands.discard(workoutId: Self.workoutID), asUser: Self.user)
        store.receive(.ack(AckMessage(id: apply.id, ok: false, seq: 1, error: AckError(code: .busy))))
        XCTAssertTrue(store.isWaitingForWebDialog)
        XCTAssertEqual(store.pending.map(\.command.id), [apply.id])
        store.receive(.chrome(ChromeMessage(blocking: true, reason: "modal", page: "workout")))
        XCTAssertEqual(log.commands.filter { $0.id == apply.id }.count, 1, "Dialog noch offen: nicht erneut senden")
        store.receive(.chrome(ChromeMessage(blocking: false, reason: "none", page: "workout")))
        XCTAssertEqual(log.commands.filter { $0.id == apply.id }.count, 2)
        XCTAssertFalse(store.isWaitingForWebDialog)
    }

    @MainActor
    func testConflictIsParkedAndCanBeReappliedWithFreshExpect() throws {
        let (store, _) = try connectedStore()
        let apply = try store.performTraining(TrainingCommands.addSet(workoutId: Self.workoutID, exerciseId: Self.fly), asUser: Self.user)
        store.receive(.ack(AckMessage(id: apply.id, ok: false, seq: 1, error: AckError(code: .conflict))))
        XCTAssertEqual(store.trainingConflicts.map(\.command.id), [apply.id])
        let again = try store.reapplyTrainingConflict(id: apply.id, asUser: Self.user)
        XCTAssertEqual(again.args["expect"], ["setCount": 2])
        XCTAssertTrue(store.trainingConflicts.isEmpty)
        XCTAssertThrowsError(try store.reapplyTrainingConflict(id: apply.id, asUser: Self.user))
    }

    @MainActor
    func testStartResultIsKeptForTheEffectCheckAfterRestart() async throws {
        let directory = try makeTemporaryDirectory()
        var state = try profile()
        state["workouts"] = .array((state["workouts"]?.arrayValue ?? []).filter { $0["finished"] == true })
        do {
            let store = makeStore(directory: directory, session: "app-1")
            store.sender = { _ in }
            store.receive(trainingHello)
            store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: state, reason: "load")))
            let apply = try store.performTraining(TrainingCommands.start(routineId: "t0000000-0000-4000-8000-000000000001"),
                                                  asUser: Self.user)
            store.receive(.ack(AckMessage(id: apply.id, ok: true, seq: 2, result: ["workoutId": "w-new", "started": true])))
            XCTAssertEqual(store.outboxEntries.first?.result?["workoutId"], "w-new")
            XCTAssertEqual(store.recentAcks.last?.result?["started"], true)
            await store.waitForMirrorWrites()
        }
        // Neue App-Sitzung: der Lade-Snapshot zeigt das neue Workout → ohne Replay entfernt.
        var started = state
        started["workouts"] = .array((state["workouts"]?.arrayValue ?? []) + [["id": "w-new", "finished": false, "exercises": []]])
        let restarted = makeStore(directory: directory, session: "app-2")
        let log = SentLog()
        restarted.sender = { log.commands.append($0) }
        restarted.receive(trainingHello)
        restarted.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: started, reason: "load")))
        XCTAssertTrue(restarted.outboxEntries.isEmpty)
        XCTAssertTrue(log.commands.isEmpty)
    }

    // MARK: Wirkung

    func testEffectChecks() throws {
        let state = try profile()
        let checks = BridgeOps.defaultEffectChecks
        let base: JSONValue = ["workoutId": .string(Self.workoutID), "exerciseId": .string(Self.bench)]
        var update = base
        update["setIndex"] = 0
        update["done"] = true
        XCTAssertEqual(checks[TrainingOps.setUpdate]?(update, state, nil), true)
        update["kg"] = 90
        XCTAssertEqual(checks[TrainingOps.setUpdate]?(update, state, nil), false)

        var add = base
        add["expect"] = ["setCount": 2]
        XCTAssertEqual(checks[TrainingOps.setAdd]?(add, state, nil), true)
        XCTAssertEqual(checks[TrainingOps.workoutStart]?(["routineId": .null], state, ["workoutId": .string(Self.workoutID)]), true)
        XCTAssertEqual(checks[TrainingOps.workoutStart]?(["routineId": .null], state, nil), false)
        XCTAssertEqual(checks[TrainingOps.workoutFinish]?(["workoutId": "o0000000-0000-4000-8000-000000000001"], state, nil), true)
        XCTAssertEqual(checks[TrainingOps.workoutDiscard]?(["workoutId": "fehlt"], state, nil), true)
        XCTAssertEqual(checks[TrainingOps.restAdjust]?(["workoutId": .string(Self.workoutID)], state, ["endAt": 1_793_188_860_000]), true)
        XCTAssertEqual(checks[TrainingOps.restSkip]?(["workoutId": .string(Self.workoutID), "expect": ["endAt": 1]], state, nil), true)
        XCTAssertEqual(checks[TrainingOps.supersetSet]?(["workoutId": .string(Self.workoutID), "exerciseId": .string(Self.bench),
                                                         "partnerId": .string(Self.fly)], state, nil), true)
        XCTAssertEqual(checks[TrainingOps.exerciseCreate]?(["name": "Bench Press"], state, ["libraryId": "x0000000-0000-4000-8000-000000000001"]), true)
        for op in TrainingOps.all {
            XCTAssertNotNil(checks[op], "Wirkungsprüfung fehlt: \(op)")
        }
        XCTAssertNotNil(checks[BridgeOps.weightUpsert])
    }

    // MARK: Session und Routinen-Entwurf

    func testSessionModelMergesMirrorAndProjection() throws {
        let projection = try fixtureProjection().training
        let session = try XCTUnwrap(TrainingSessionModel.build(
            workoutId: Self.workoutID, document: ProfileDocument(root: try profile()), projection: projection))
        XCTAssertEqual(session.name, "Push")
        XCTAssertEqual(session.doneSets, 1)
        XCTAssertEqual(session.openSets, 4)
        XCTAssertTrue(session.isComplete)
        XCTAssertEqual(session.exercise(id: Self.fly)?.supersetWith, [Self.bench])
        XCTAssertEqual(session.exercise(id: Self.fly)?.effectiveRestSeconds, 90)
        XCTAssertEqual(session.elapsedSeconds(at: Date(timeIntervalSince1970: 1_793_188_800)), 1200)
        XCTAssertEqual(session.rest?.remainingSeconds(at: Date(timeIntervalSince1970: 1_793_188_800.5)), 60)

        // Ohne Spiegel-Eintrag gilt die Projektion.
        let fromProjection = try XCTUnwrap(TrainingSessionModel.build(workoutId: Self.workoutID, document: .empty, projection: projection))
        XCTAssertEqual(fromProjection.exercises.map(\.id), [Self.bench, Self.fly])
        XCTAssertNil(TrainingSessionModel.build(workoutId: "fremd", document: .empty, projection: projection))
    }

    func testRoutineDraftKeepsUnknownFields() throws {
        var raw = try XCTUnwrap(TrainingOps.routine(try profile(), "t0000000-0000-4000-8000-000000000001"))
        raw["xRoutine"] = ["keep": true]
        var counter = 0
        var draft = try XCTUnwrap(RoutineDraft(raw: raw) { counter += 1; return "i\(counter)" })
        XCTAssertEqual(draft.items.map(\.restSeconds), [120, 90])
        XCTAssertEqual(draft.routineJSON, raw, "Unverändert gespeichert = identisch")
        draft.items[0].sets = 4
        draft.setSuperset(itemID: "i1", partnerID: "i2", newGroup: { "neu" })
        XCTAssertEqual(draft.items[0].superset, "s0000000-0000-4000-8000-000000000001")
        draft.items[1].restSeconds = nil
        let json = draft.routineJSON
        XCTAssertEqual(json["xRoutine"], ["keep": true])
        XCTAssertEqual(json["exercises"]?[0]?["sets"], 4)
        XCTAssertNil(json["exercises"]?[1]?["restSeconds"])
        XCTAssertEqual(draft.expect, raw)
        XCTAssertTrue(draft.isValid)
        draft.items[0].max = 2
        XCTAssertFalse(draft.isValid)

        var fresh = RoutineDraft(newID: "t-neu", name: "  ")
        XCTAssertFalse(fresh.isValid)
        fresh.name = "Beine"
        fresh.append(libraryId: "x1", itemID: "a")
        fresh.append(libraryId: "x1", itemID: "b")
        XCTAssertEqual(fresh.items.count, 1, "keine doppelte Übung wie im Web")
        XCTAssertEqual(fresh.routineJSON, ["id": "t-neu", "name": "Beine",
                                           "exercises": [["exerciseId": "x1", "sets": 3, "min": 6, "max": 10]]])
        XCTAssertEqual(fresh.expect, .null)
    }
}
