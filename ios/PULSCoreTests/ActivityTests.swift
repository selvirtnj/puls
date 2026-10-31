import Foundation
import XCTest
@testable import PULSCore

/// M6: Aktivitäts-Projektion, Query-Antworten, Ops, Wirkungsprüfungen und Replay-Schutz (§11).
/// Erwartete Werte stammen exakt aus tests/fixtures/native-bridge/activity-*.json, apply-run-start.json, ack-run-start.json.
final class ActivityTests: XCTestCase {
    private static let user = Fixtures.sessionUser
    private static let run1 = "r0000000-0000-4000-8000-000000000001"
    private static let run2 = "r0000000-0000-4000-8000-000000000002"
    private static let route1 = "q0000000-0000-4000-8000-000000000001"
    private static let startedAt: Double = 1_793_188_800_000

    private func projection(_ name: String = "activity-projection") throws -> ActivityProjectionMessage {
        guard case .activityProjection(let message)? = try InboundMessage.decode(data: Fixtures.data(name)) else {
            throw XCTSkip("\(name) erwartet")
        }
        return message
    }

    private func summaryResult() throws -> ActivityResultMessage {
        guard case .activityResult(let message)? = try InboundMessage.decode(data: Fixtures.data("activity-result-summary")) else {
            throw XCTSkip("activity-result-summary erwartet")
        }
        return message
    }

    /// Synthetisches Profil passend zu den Fixtures: `runs` in Speicherreihenfolge (letzte = r…02), eine Route.
    private func profile() -> JSONValue {
        [
            "language": "de",
            "runs": [
                ["id": .string(Self.run1), "date": "2026-10-26", "type": "run", "distanceKm": 5.123, "durationSeconds": 1547,
                 "kcal": 401, "note": "Fixture"],
                ["id": .string(Self.run2), "date": "2026-10-27", "type": "other", "distanceKm": 0, "durationSeconds": 1200],
            ],
            "runSettings": ["lastType": "run", "rounds": ["work": 180, "rest": 60, "count": 5], "weeklyGoalKm": 20,
                            "xFutureSetting": ["keep": true]],
            "runRoutes": [
                ["id": .string(Self.route1), "name": "Parkrunde", "line": "52.52000,13.40500;52.52100,13.40600",
                 "waypoints": "52.52000,13.40500;52.52100,13.40600", "distanceKm": 3.1, "ascentM": 12, "createdAt": 1_793_000_000_000],
            ],
        ]
    }

    private var activityHello: InboundMessage {
        .hello(HelloMessage(
            webVersion: "78",
            ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete] + ActivityOps.all.sorted(),
            screens: ["body", "activity"], ownerPending: false,
            projections: ["overview", "activity"], features: ["nativeTabs", "nativeActivity"]
        ))
    }

    private final class SentLog {
        var commands: [ApplyCommand] = []
    }

    @MainActor
    private func connectedStore(session: String = "app-1", directory: URL? = nil, state: JSONValue? = nil) throws -> (ProfileStore, SentLog) {
        let ids = SequentialIDs()
        let store = ProfileStore(environment: StoreEnvironment(
            directory: try directory ?? makeTemporaryDirectory(), now: { fixedNow }, makeCommandID: { ids.make() },
            sessionID: session, reducers: BridgeOps.activityReducers
        ))
        let log = SentLog()
        store.sender = { log.commands.append($0) }
        store.receive(activityHello)
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: state ?? profile(), reason: "load")))
        store.receive(.activityProjection(try projection()))
        return (store, log)
    }

    // MARK: Projektion

    func testProjectionEnvelopeIsLossless() throws {
        let message = try projection()
        XCTAssertEqual(message.projectionSeq, 1)
        XCTAssertEqual(message.seq, 2)
        XCTAssertEqual(message.userId, Self.user)
        XCTAssertEqual(message.reason, "interest")
        XCTAssertTrue(message.cloud.dirty)
        XCTAssertEqual(message.json, try Fixtures.value("activity-projection"))
        let data = try JSONEncoder().encode(message)
        XCTAssertEqual(try JSONDecoder().decode(ActivityProjectionMessage.self, from: data), message)
        XCTAssertEqual(try InboundMessage.decode(message.json), .activityProjection(message))
    }

    func testProjectionWithoutActiveRun() throws {
        let activity = try projection().activity
        XCTAssertEqual(activity.language, "de")
        XCTAssertEqual(activity.locale, "de-DE")
        XCTAssertEqual(activity.today, "2026-10-28")
        XCTAssertEqual(activity.types.map(\.id), ["run", "walk", "hike", "mountain", "tabletennis", "soccer", "mma", "padel"])
        XCTAssertEqual(activity.types.filter(\.gps).map(\.id), ["run", "walk", "hike", "mountain"])
        XCTAssertEqual(activity.type("soccer")?.label, "Fußball")
        XCTAssertEqual(activity.type("hike")?.category, "walk")
        XCTAssertEqual(activity.settings.lastType, "run")
        XCTAssertEqual(activity.settings.rounds, RoundSettings(work: 180, rest: 60, count: 5))
        XCTAssertEqual(activity.settings.countdownSeconds, 10)
        XCTAssertNil(activity.active)
        XCTAssertNil(activity.summary)
        XCTAssertNil(activity.currentSummary)
        XCTAssertEqual(activity.routes.count, 1)
        XCTAssertEqual(activity.routes.first?.id, Self.route1)
        XCTAssertEqual(activity.routes.first?.distanceKm, 3.1)
        XCTAssertEqual(activity.routes.first?.ascentM, 12)
        XCTAssertEqual(activity.routes.first?.editable, true)
        XCTAssertEqual(activity.recent.map(\.id), [Self.run2, Self.run1], "neueste zuerst")
        XCTAssertEqual(activity.recent.first?.distanceKm, 0, "0 km bleibt 0, nicht unbekannt")
        XCTAssertNil(activity.recent.first?.kcal, "unbekannte kcal bleiben nil")
        XCTAssertNil(activity.recent.first?.startedAt)
        XCTAssertEqual(activity.recent.last?.distanceKm, 5.123)
        XCTAssertEqual(activity.recent.last?.durationSeconds, 1547)
        XCTAssertEqual(activity.recent.last?.paceText, "5:02 /km")
        XCTAssertEqual(activity.recent.last?.kcal, 401)
        XCTAssertEqual(activity.omitted, ActivityOmitted(nil))
        XCTAssertEqual(activity.navigation["start"], ActivityNavigation(action: "activity"))
        XCTAssertEqual(activity.navigation["routes"], ActivityNavigation(action: "activityRoutes"))
        XCTAssertEqual(activity.navigation["planner"], ActivityNavigation(action: "routePlanner"))
        let planner = try XCTUnwrap(activity.planner)
        XCTAssertEqual(planner.provider, "brouter")
        XCTAssertEqual(planner.url, "https://brouter.de/brouter")
        XCTAssertEqual(planner.profile, "hiking-mountain")
        XCTAssertEqual(planner.maxWaypoints, 60)
        XCTAssertEqual(planner.maxLinePoints, 800)
        XCTAssertEqual(planner.typicalPaceSeconds, 301.9715010735897)
        XCTAssertTrue(planner.native)
    }

    func testLiveProjectionKeepsTimeBasesAndWebValues() throws {
        let message = try projection("activity-live")
        XCTAssertEqual(message.projectionSeq, 3)
        XCTAssertEqual(message.seq, 4)
        XCTAssertEqual(message.reason, "activity")
        let active = try XCTUnwrap(message.activity.active)
        XCTAssertEqual(active.startedAt, Self.startedAt)
        XCTAssertFalse(active.paused)
        XCTAssertNil(active.pausedAt)
        XCTAssertEqual(active.pausedSeconds, 0)
        XCTAssertEqual(active.segment, 0)
        XCTAssertNil(active.segmentStartedAt)
        XCTAssertEqual(active.type, "run")
        XCTAssertTrue(active.gps)
        XCTAssertTrue(active.recordingDevice)
        XCTAssertTrue(active.controlsEnabled)
        XCTAssertFalse(active.locked)
        XCTAssertEqual(active.laps, [])
        XCTAssertNil(active.rounds)
        XCTAssertNil(active.mma)
        XCTAssertNil(active.routeId)
        XCTAssertNil(active.routeProgress)
        XCTAssertEqual(active.distanceKm, 0.06)
        XCTAssertEqual(active.paceText, "6:00")
        XCTAssertEqual(active.currentPaceText, "3:00")
        XCTAssertEqual(active.value("time"), "00:20")
        XCTAssertEqual(active.value("dist"), "0,06")
        XCTAssertEqual(active.value("gain"), "–")
        XCTAssertEqual(active.value("speed"), "10")
        XCTAssertEqual(active.value("kcal"), "4")
        XCTAssertEqual(active.value("lap"), "Runde 1 · 00:20")
        XCTAssertEqual(active.gpsLabel, "GPS-Signal schwach · ±50 m")
        XCTAssertEqual(active.elapsedSeconds, 20)
        XCTAssertEqual(active.observedAt, 1_793_188_820_000)
        XCTAssertEqual(active.durationLimitSeconds, 172_800)
        // Uhr lokal aus der Zeitbasis (`runElapsed`): zum Beobachtungszeitpunkt genau die Web-Momentaufnahme.
        XCTAssertEqual(active.elapsed(atMillis: 1_793_188_820_000), 20)
        XCTAssertEqual(active.elapsed(atMillis: 1_793_188_820_999), 20, "abgerundet wie Math.floor")
        XCTAssertEqual(active.elapsed(atMillis: 1_793_188_799_000), 0, "nie negativ")
        let lap = active.currentLap(atElapsed: 20)
        XCTAssertEqual(lap.number, 1)
        XCTAssertEqual(lap.seconds, 20, "wie values.lap „Runde 1 · 00:20“")
    }

    func testPausedClockAndMmaCountdown() throws {
        var live = try Fixtures.value("activity-live")
        live["activity"]?["active"]?["paused"] = true
        live["activity"]?["active"]?["pausedAt"] = 1_793_188_830_000
        live["activity"]?["active"]?["pausedSeconds"] = 2.5
        live["activity"]?["active"]?["type"] = "mma"
        live["activity"]?["active"]?["laps"] = [10]
        live["activity"]?["active"]?["mma"] = ["round": 1, "count": 5, "phase": "work", "remainingSeconds": 163,
                                               "phaseSeconds": 180, "elapsedSeconds": 17, "observedAt": 1_793_188_817_000]
        guard case .activityProjection(let message)? = try InboundMessage.decode(live) else { return XCTFail("projection") }
        let active = try XCTUnwrap(message.activity.active)
        // floor((pausedAt − startedAt)/1000 − pausedSeconds) = floor(30 − 2,5) = 27, unabhängig von „jetzt“.
        XCTAssertEqual(active.elapsed(atMillis: 1_900_000_000_000), 27)
        XCTAssertEqual(active.currentLap(atElapsed: 27).number, 2)
        XCTAssertEqual(active.currentLap(atElapsed: 27).seconds, 17)
        let mma = try XCTUnwrap(active.mma)
        XCTAssertEqual(mma.remaining(atElapsed: 17), 163)
        XCTAssertEqual(mma.remaining(atElapsed: 27), 153, "nur heruntergezählt")
        XCTAssertEqual(mma.remaining(atElapsed: 400), 0, "nie unter 0, keine eigene Phase")
        XCTAssertEqual(mma.progress(atElapsed: 17), 1 - 163.0 / 180.0, accuracy: 1e-12)
    }

    func testSummaryResultIsLossless() throws {
        let message = try summaryResult()
        XCTAssertEqual(message.requestId, "q")
        XCTAssertEqual(message.kind, "summary")
        XCTAssertEqual(message.seq, 10)
        XCTAssertTrue(message.ok)
        XCTAssertEqual(message.json, try Fixtures.value("activity-result-summary"))
        guard case .summary(let draft)? = message.result else { return XCTFail("summary erwartet") }
        XCTAssertEqual(draft.key, Self.startedAt)
        XCTAssertEqual(draft.type, "run")
        XCTAssertEqual(draft.km, 0.06)
        XCTAssertEqual(draft.moving, 23)
        XCTAssertEqual(draft.pause, 4)
        XCTAssertNil(draft.elevation)
        XCTAssertNil(draft.maxSpeed)
        XCTAssertNil(draft.feeling)
        XCTAssertNil(draft.terrain)
        XCTAssertEqual(draft.note, "")
        XCTAssertEqual(draft.manualKm, ManualDistance.none, "'' = keine Eingabe")
        XCTAssertEqual(draft.kcal, 5)
        XCTAssertFalse(draft.manualDistanceAllowed)
        XCTAssertEqual(draft.route, "51.00000,10.00000;51.00050,10.00000")
        XCTAssertEqual(RouteLine.segments(draft.route), [[GeoPoint(lat: 51, lon: 10), GeoPoint(lat: 51.0005, lon: 10)]])
        XCTAssertEqual(draft.splits, [])
        XCTAssertNil(draft.splitRest)
        XCTAssertEqual(draft.laps, [23])
    }

    func testManualDistanceKeepsEmptyAndZeroApart() {
        XCTAssertEqual(ManualDistance(json: .string("")), ManualDistance.none)
        XCTAssertEqual(ManualDistance(json: nil), ManualDistance.none)
        XCTAssertEqual(ManualDistance(json: .number(0)), .km(0), "0 ist ausdrücklich 0 km")
        XCTAssertEqual(ManualDistance(json: .string("3,5")).kilometres, 3.5)
        XCTAssertNil(ManualDistance.none.kilometres)
        // Befehl: keine Eingabe → Feld fehlt; 0 → 0.
        let empty = ActivityCommands.saveSummary(startedAt: Self.startedAt, pausedAt: 1, feeling: nil, terrain: nil, note: "  ",
                                                 manualKm: ManualDistance.none)
        XCTAssertNil(empty?.args["manualKm"])
        XCTAssertEqual(empty?.args["note"], "")
        XCTAssertEqual(empty?.args["feeling"], JSONValue.null)
        let zero = ActivityCommands.saveSummary(startedAt: Self.startedAt, pausedAt: 1, feeling: 4, terrain: "forest", note: "x",
                                                manualKm: .km(0))
        XCTAssertEqual(zero?.args["manualKm"], 0)
        XCTAssertNil(ActivityCommands.saveSummary(startedAt: 1, pausedAt: 1, feeling: 6, terrain: nil, note: "", manualKm: ManualDistance.none))
        XCTAssertNil(ActivityCommands.saveSummary(startedAt: 1, pausedAt: 1, feeling: nil, terrain: "sand", note: "", manualKm: ManualDistance.none))
        XCTAssertNil(ActivityCommands.saveSummary(startedAt: 1, pausedAt: 1, feeling: nil, terrain: nil, note: "", manualKm: .km(1000.5)))
        // Notiz höchstens 200 UTF-16-Einheiten, ohne ein Emoji zu teilen.
        let long = String(repeating: "a", count: 199) + "😀"
        XCTAssertEqual(ActivityOps.limitedNote(long).utf16.count, 199)
    }

    func testRunAndRouteResults() throws {
        let runJSON: JSONValue = [
            "type": "activityResult", "protocol": 1, "requestId": "r", "kind": "run", "ownerPending": false, "ok": true,
            "result": [
                "id": .string(Self.run1), "date": "2026-10-26", "type": "run", "name": "Laufen", "startedAt": .null, "distanceKm": 5.123,
                "durationSeconds": 1547, "paceText": "5:02 /km", "kcal": 401, "hasRoute": false, "feeling": 4, "terrain": .null,
                "note": "Fixture", "route": .null, "laps": [], "splits": [300, 302], "splitRest": [123, 37], "pauseSeconds": .null,
                "maxSpeed": .null, "elevationGain": .null, "elevationMax": .null,
                "navigation": ["action": "runDetail", "id": .string(Self.run1)],
                "editExpect": ["type": "run", "feeling": 4, "terrain": .null, "note": "Fixture"],
            ],
        ]
        guard case .activityResult(let message)? = try InboundMessage.decode(runJSON),
              case .run(let detail)? = message.result else { return XCTFail("run erwartet") }
        XCTAssertEqual(detail.entry.id, Self.run1)
        XCTAssertEqual(detail.feeling, 4)
        XCTAssertNil(detail.terrain)
        XCTAssertNil(detail.route)
        XCTAssertNil(detail.pauseSeconds, "unbekannt bleibt nil")
        XCTAssertEqual(detail.splits, [300, 302])
        XCTAssertEqual(detail.splitRest, [123, 37])
        XCTAssertEqual(detail.navigation, ActivityNavigation(action: "runDetail", id: Self.run1))
        XCTAssertEqual(detail.editExpect?.raw, ["type": "run", "feeling": 4, "terrain": .null, "note": "Fixture"])

        let gone: JSONValue = ["type": "activityResult", "protocol": 1, "requestId": "x", "kind": "route", "ownerPending": false,
                               "ok": false, "error": ["code": "gone"]]
        guard case .activityResult(let missing)? = try InboundMessage.decode(gone) else { return XCTFail("result") }
        XCTAssertTrue(missing.isGone)
        XCTAssertNil(missing.result)

        let route = try RouteDetail(json: ["id": .string(Self.route1), "name": "Parkrunde", "line": "52.52000,13.40500;52.52100,13.40600",
                                           "waypoints": .null, "distanceKm": 3.1, "ascentM": .null, "createdAt": .null])
        XCTAssertEqual(route.points.count, 2)
        XCTAssertNil(route.waypoints)
        XCTAssertNil(route.ascentM)
    }

    func testOpenNativeCarriesActivityTarget() throws {
        let json: JSONValue = ["type": "openNative", "protocol": 1, "screen": "activity", "startedAt": .null, "routeId": .string(Self.route1)]
        guard case .openNative(let open)? = try InboundMessage.decode(json) else { return XCTFail("openNative") }
        XCTAssertNil(open.startedAt)
        XCTAssertEqual(open.routeId, Self.route1)
        let running: JSONValue = ["type": "openNative", "protocol": 1, "screen": "activity", "startedAt": .number(Self.startedAt)]
        guard case .openNative(let live)? = try InboundMessage.decode(running) else { return XCTFail("openNative") }
        XCTAssertEqual(live.startedAt, Self.startedAt)
        XCTAssertNil(live.routeId)
        // Nachsichtig: ein unerwarteter Wert verhindert das Öffnen nicht.
        let odd: JSONValue = ["type": "openNative", "protocol": 1, "screen": "activity", "startedAt": "x"]
        guard case .openNative(let tolerant)? = try InboundMessage.decode(odd) else { return XCTFail("openNative") }
        XCTAssertNil(tolerant.startedAt)
    }

    // MARK: Anfragen, Navigation, Interesse

    func testQueriesNavigationAndInterest() {
        XCTAssertEqual(ActivityQueryRequest.summary(requestId: "q")?.json, ["requestId": "q", "kind": "summary"])
        XCTAssertEqual(ActivityQueryRequest.detail(.run, id: Self.run1, requestId: "q")?.json.objectValue?.keys.sorted(), ["id", "kind", "requestId"])
        XCTAssertNil(ActivityQueryRequest.detail(.summary, id: "x", requestId: "q"))
        XCTAssertNil(ActivityQueryRequest.detail(.route, id: "bad id", requestId: "q"), "Web-ID nur [A-Za-z0-9_-]")
        XCTAssertNil(ActivityQueryRequest.summary(requestId: " "))
        XCTAssertFalse(ActivityIDs.isValid(String(repeating: "a", count: 101)))
        XCTAssertTrue(ActivityIDs.isValid(Self.run1))

        XCTAssertNil(ActivityNavigation(action: "deleteRun", id: Self.run1))
        XCTAssertNil(ActivityNavigation(action: "runDetail"), "Detail braucht eine ID")
        XCTAssertEqual(ActivityNavigation(action: "routePlanner")?.json, ["action": "routePlanner", "web": true])
        XCTAssertEqual(ActivityNavigation(action: "routePlanner", id: Self.route1)?.id, Self.route1)
        XCTAssertNil(ActivityNavigation(action: "activity", id: "x")?.id)
        let fallback = ActivityNavigation(action: "activity")!
        XCTAssertTrue(WebCall.activityNavigate(fallback).contains(#"{"action":"activity","web":true}"#))
        XCTAssertTrue(WebCall.setActivity(true).contains("pulsNativeSetActivity(true)===true"))
        XCTAssertTrue(WebCall.activityQuery(ActivityQueryRequest.summary(requestId: "q\"1")!).contains(#""requestId":"q\"1""#))

        let interest = ProjectionInterest(["activity", "overview", "training", "progress", "bogus"])
        XCTAssertEqual(interest.projections, ["activity", "overview", "progress", "training"], "bis zu vier Namen mit nativeActivity")
    }

    func testRoundingParityIncludingNegativeZero() {
        // Mit node gegen V8 abgeglichen: Math.round(x*100)/100.
        XCTAssertEqual(JSMath.round2(5.125), 5.13)
        XCTAssertEqual(JSMath.round2(1.005), 1)
        XCTAssertEqual(JSMath.round2(0.285), 0.28)
        XCTAssertEqual(JSMath.round2(2.675), 2.68)
        XCTAssertEqual(JSMath.round2(3.14159), 3.14)
        // V8 liefert für −0,5 ≤ x < 0 eine negative Null; XCTAssertEqual(+0, −0) bestünde, daher Vorzeichen prüfen.
        XCTAssertEqual(JSMath.round(-0.5).sign, .minus)
        XCTAssertEqual(JSMath.round(-0.5).bitPattern, (-0.0 as Double).bitPattern)
        XCTAssertEqual(JSMath.round(-0.2).sign, .minus)
        XCTAssertEqual(JSMath.round1(-0.05).sign, .minus)
        XCTAssertEqual(JSMath.round(0.2).sign, .plus)
        XCTAssertEqual(JSMath.round(-0.51), -1)
        XCTAssertEqual(JSMath.round(-2.5), -2)
        // JSON.stringify(-0) === "0".
        XCTAssertEqual(JSONValue.number(JSMath.round(-0.4)).serializedString(), "0")
    }

    // MARK: Store

    @MainActor
    func testStoreOffersActivityOnlyWithFullHello() throws {
        let (store, _) = try connectedStore()
        XCTAssertTrue(store.webOffersActivity)
        XCTAssertNotNil(store.currentActivity)
        XCTAssertTrue(StoreEnvironment.defaultScreenRequirements["activity"] == ActivityOps.all)

        // Ohne eine der Ops kein nativer Bereich.
        var ops = ActivityOps.all
        ops.remove(ActivityOps.routeSave)
        store.receive(.hello(HelloMessage(ops: ops.sorted(), screens: ["activity"], ownerPending: false,
                                          projections: ["activity"], features: ["nativeActivity"])))
        XCTAssertFalse(store.webOffersActivity)
        XCTAssertNil(store.currentActivity)
    }

    @MainActor
    func testStaleProjectionAndRegisteredResults() throws {
        let (store, _) = try connectedStore()
        XCTAssertTrue(store.receive(.activityProjection(try projection("activity-live"))))
        XCTAssertFalse(store.receive(.activityProjection(try projection())), "projectionSeq 1 nach 3 (kein load) ist veraltet")
        XCTAssertEqual(store.currentActivity?.projectionSeq, 3)

        XCTAssertFalse(store.receive(.activityResult(try summaryResult())), "nicht angefragt")
        store.registerActivityQuery(try XCTUnwrap(ActivityQueryRequest.summary(requestId: "q")))
        XCTAssertTrue(store.isActivityQueryPending("q"))
        XCTAssertTrue(store.receive(.activityResult(try summaryResult())))
        XCTAssertNotNil(store.activityResult("q"))

        // Neues Dokument: Projektion und Ergebnisse verworfen, späte Antwort nicht übernommen.
        store.registerActivityQuery(try XCTUnwrap(ActivityQueryRequest.summary(requestId: "q")))
        let generation = store.activityGeneration
        store.webDocumentDidChange()
        XCTAssertGreaterThan(store.activityGeneration, generation)
        XCTAssertNil(store.currentActivity)
        XCTAssertNil(store.activityResult("q"))
        XCTAssertFalse(store.receive(.activityResult(try summaryResult())))
    }

    @MainActor
    func testOwnerPendingAndOtherUserDropResults() throws {
        let (store, _) = try connectedStore()
        store.registerActivityQuery(try XCTUnwrap(ActivityQueryRequest.summary(requestId: "q")))
        var foreign = try Fixtures.value("activity-result-summary")
        foreign["userId"] = "b0000000-0000-4000-8000-0000000000bb"
        guard case .activityResult(let other)? = try InboundMessage.decode(foreign) else { return XCTFail("result") }
        XCTAssertFalse(store.receive(.activityResult(other)))
        store.receive(.hello(HelloMessage(ops: [], screens: [], ownerPending: true)))
        XCTAssertNil(store.activityProjection)
        XCTAssertFalse(store.webOffersActivity)
    }

    @MainActor
    func testOpenNativeRequestIsConsumedOnce() throws {
        let (store, _) = try connectedStore()
        store.receive(.openNative(OpenNativeMessage(screen: "activity", startedAt: nil, routeId: Self.route1)))
        let request = store.consumeActivityRequest()
        XCTAssertNil(request.startedAt)
        XCTAssertEqual(request.routeId, Self.route1)
        XCTAssertNil(store.consumeActivityRequest().routeId)
    }

    // MARK: Ops

    @MainActor
    func testRunStartArgsMatchFixtureExactly() throws {
        let (store, log) = try connectedStore()
        let fixture = try ApplyCommand(json: Fixtures.value("apply-run-start"))
        let apply = try store.performActivity(XCTUnwrap(ActivityCommands.start(type: "run")), asUser: Self.user)
        XCTAssertEqual(apply.op, fixture.op)
        XCTAssertEqual(apply.args, fixture.args)
        XCTAssertEqual(apply.userId, fixture.userId)
        XCTAssertEqual(log.commands.map(\.id), [apply.id])
        // Ohne gespeicherte Aktivitäten: `lastRunId:null`.
        XCTAssertEqual(BridgeOps.prepareRunStart(["type": "walk"], .empty)["expect"], ["lastRunId": .null])
        // MMA-Runden nur bei MMA und in Web-Grenzen; Route nur als gültige ID.
        XCTAssertNil(ActivityCommands.start(type: "run", rounds: .standard))
        XCTAssertNil(ActivityCommands.start(type: "mma", rounds: RoundSettings(work: 5, rest: 60, count: 5)))
        XCTAssertEqual(ActivityCommands.start(type: "mma", rounds: .standard)?.args["rounds"], ["work": 180, "rest": 60, "count": 5])
        XCTAssertNil(ActivityCommands.start(type: "run", routeId: "a b"))
    }

    func testRunStartEffectNeverAllowsSecondStart() throws {
        guard case .ack(let ack)? = try InboundMessage.decode(data: Fixtures.data("ack-run-start")) else { return XCTFail("ack") }
        XCTAssertEqual(ack.id, "a6000000-0000-4000-8000-000000000003")
        XCTAssertEqual(ack.seq, 2)
        XCTAssertEqual(ack.result, ["startedAt": 1_793_188_800_000, "started": true])
        let args = try ApplyCommand(json: Fixtures.value("apply-run-start")).args
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[ActivityOps.runStart])
        var state = profile()
        XCTAssertFalse(check(args, state, ack.result))
        state["activeRun"] = ["startedAt": .number(Self.startedAt), "type": "run", "gps": true]
        XCTAssertTrue(check(args, state, ack.result), "aktiv")
        state["activeRun"] = nil
        var runs = state["runs"]?.arrayValue ?? []
        runs.append(["id": "r3", "startedAt": .number(Self.startedAt)])
        state["runs"] = .array(runs)
        XCTAssertTrue(check(args, state, ack.result), "bereits gespeichert zählt als erledigter Start")
        XCTAssertFalse(check(args, state, nil), "ohne Ergebnis keine Wirkung")
    }

    @MainActor
    func testAckedStartIsReplayedOnlyAfterLossAndSettlesWhenSaved() throws {
        let directory = try makeTemporaryDirectory()
        let (store, _) = try connectedStore(session: "app-1", directory: directory)
        let apply = try store.performActivity(XCTUnwrap(ActivityCommands.start(type: "run")), asUser: Self.user)
        store.receive(.ack(AckMessage(id: apply.id, ok: true, seq: 2, result: ["startedAt": .number(Self.startedAt), "started": true])))
        var running = profile()
        running["activeRun"] = ["startedAt": .number(Self.startedAt), "type": "run"]
        store.receive(.snapshot(SnapshotMessage(seq: 2, userId: Self.user, state: running, reason: "apply")))
        XCTAssertEqual(store.outboxEntries.first?.lastSeenEffect, true)

        // Neuer Prozess, Aktivität inzwischen gespeichert: ohne Replay entfernt (kein zweiter Start).
        var saved = profile()
        var runs = saved["runs"]?.arrayValue ?? []
        runs.append(["id": "r3", "startedAt": .number(Self.startedAt)])
        saved["runs"] = .array(runs)
        let restarted = ProfileStore(environment: StoreEnvironment(directory: directory, now: { fixedNow }, sessionID: "app-2"))
        let log = SentLog()
        restarted.sender = { log.commands.append($0) }
        restarted.receive(activityHello)
        restarted.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: saved, reason: "load")))
        XCTAssertTrue(restarted.outboxEntries.isEmpty)
        XCTAssertTrue(log.commands.isEmpty)

        // Gegenprobe: zuletzt sichtbar, nach Neustart verloren → Replay mit derselben ID und demselben `expect`
        // (bei inzwischen anderer letzter Aktivität antwortet das Web `conflict`, nie ein Doppelstart).
        let other = try makeTemporaryDirectory()
        let (first, _) = try connectedStore(session: "app-1", directory: other)
        let lost = try first.performActivity(XCTUnwrap(ActivityCommands.start(type: "run")), asUser: Self.user)
        first.receive(.ack(AckMessage(id: lost.id, ok: true, seq: 2, result: ["startedAt": .number(Self.startedAt), "started": true])))
        first.receive(.snapshot(SnapshotMessage(seq: 2, userId: Self.user, state: running, reason: "apply")))
        let second = ProfileStore(environment: StoreEnvironment(directory: other, now: { fixedNow }, sessionID: "app-2"))
        let replay = SentLog()
        second.sender = { replay.commands.append($0) }
        second.receive(activityHello)
        second.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: profile(), reason: "load")))
        XCTAssertEqual(replay.commands.map(\.id), [lost.id])
        XCTAssertEqual(replay.commands.first?.args, lost.args)
    }

    func testControlEffects() throws {
        let checks = BridgeOps.defaultEffectChecks
        let base: JSONValue = ["startedAt": .number(Self.startedAt)]
        var state = profile()
        state["activeRun"] = ["startedAt": .number(Self.startedAt), "pausedAt": 1_793_188_830_000, "segment": 0, "laps": [10, 20]]

        let pause = try XCTUnwrap(checks[ActivityOps.runPause])
        XCTAssertTrue(pause(base, state, ["startedAt": .number(Self.startedAt), "pausedAt": 1_793_188_830_000, "segment": 0]))
        XCTAssertFalse(pause(base, state, ["startedAt": .number(Self.startedAt), "pausedAt": 1_793_188_831_000, "segment": 0]))

        let finish = try XCTUnwrap(checks[ActivityOps.runFinish])
        XCTAssertTrue(finish(base, state, ["startedAt": .number(Self.startedAt), "pausedAt": 1_793_188_830_000]))

        let lap = try XCTUnwrap(checks[ActivityOps.runLap])
        var lapArgs = base
        lapArgs["expect"] = ["laps": [10]]
        XCTAssertTrue(lap(lapArgs, state, ["lap": 20]))
        XCTAssertFalse(lap(lapArgs, state, ["lap": 21]))

        let resume = try XCTUnwrap(checks[ActivityOps.runResume])
        XCTAssertFalse(resume(base, state, ["startedAt": .number(Self.startedAt), "pausedAt": .null, "segment": 1]), "noch pausiert")
        var resumed = state
        resumed["activeRun"] = ["startedAt": .number(Self.startedAt), "pausedAt": .null, "segment": 1]
        XCTAssertTrue(resume(base, resumed, ["startedAt": .number(Self.startedAt), "pausedAt": .null, "segment": 1]))

        // Speichern: gespeicherte ID mit demselben startedAt, keine aktive mehr.
        let save = try XCTUnwrap(checks[ActivityOps.summarySave])
        XCTAssertFalse(save(base, state, ["runId": "r3", "startedAt": .number(Self.startedAt)]))
        var saved = profile()
        var runs = saved["runs"]?.arrayValue ?? []
        runs.append(["id": "r3", "startedAt": .number(Self.startedAt)])
        saved["runs"] = .array(runs)
        XCTAssertTrue(save(base, saved, ["runId": "r3", "startedAt": .number(Self.startedAt)]))
        var stillActive = saved
        stillActive["activeRun"] = ["startedAt": .number(Self.startedAt)]
        XCTAssertFalse(save(base, stillActive, ["runId": "r3", "startedAt": .number(Self.startedAt)]))
        XCTAssertFalse(save(base, saved, nil))
        XCTAssertFalse(finish(base, saved, ["startedAt": .number(Self.startedAt), "pausedAt": 1_793_188_830_000]),
                       "nach dem Speichern ist der Abschluss nicht mehr sichtbar (lastSeenEffect false → kein Replay)")

        let discard = try XCTUnwrap(checks[ActivityOps.runDiscard])
        XCTAssertFalse(discard(base, state, nil))
        XCTAssertTrue(discard(base, profile(), nil))
    }

    @MainActor
    func testPreparedControlExpectationsComeFromSnapshot() throws {
        var state = profile()
        state["activeRun"] = ["startedAt": .number(Self.startedAt), "pausedAt": 1_793_188_830_000, "segment": 2, "laps": [10]]
        let (store, _) = try connectedStore(state: state)
        let resume = try store.performActivity(XCTUnwrap(ActivityCommands.resume(startedAt: Self.startedAt)), asUser: Self.user)
        XCTAssertEqual(resume.args["expect"], ["pausedAt": 1_793_188_830_000, "segment": 2])
        let lap = try store.performActivity(XCTUnwrap(ActivityCommands.lap(startedAt: Self.startedAt)), asUser: Self.user)
        XCTAssertEqual(lap.args["expect"], ["laps": [10]])
        let pause = try store.performActivity(XCTUnwrap(ActivityCommands.pause(startedAt: Self.startedAt)), asUser: Self.user)
        XCTAssertEqual(pause.args["expect"], ["pausedAt": .null, "segment": 2])
        // `segment || 0`: fehlend gilt als 0.
        XCTAssertEqual(BridgeOps.prepareRunPause(base(), ProfileDocument(root: ["activeRun": ["startedAt": 1]]))["expect"],
                       ["pausedAt": .null, "segment": 0])
    }

    private func base() -> JSONValue { ["startedAt": .number(Self.startedAt)] }

    @MainActor
    func testEditDeleteAndSettingsShowOnlyUnambiguousEffects() throws {
        let (store, _) = try connectedStore()
        // Einstellungen: rohes runSettings als expect, Wochenziele/unbekannte Felder bleiben.
        let settings = try store.performActivity(XCTUnwrap(ActivityCommands.settings(lastType: "mma")), asUser: Self.user)
        XCTAssertEqual(settings.args["expect"], profile()["runSettings"])
        XCTAssertEqual(store.document["runSettings"]?["lastType"], "mma")
        XCTAssertEqual(store.document["runSettings"]?["xFutureSetting"], ["keep": true])
        XCTAssertEqual(store.document["runSettings"]?["weeklyGoalKm"], 20)
        let settingsCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[ActivityOps.settingsSet])
        XCTAssertTrue(settingsCheck(settings.args, store.document.root, nil))
        XCTAssertFalse(settingsCheck(settings.args, profile(), nil))
        XCTAssertEqual(ActivityOps.settingsTarget(["rounds": ["work": 60, "rest": 0, "count": 3], "expect": .null]),
                       ["rounds": ["work": 60, "rest": 0, "count": 3]])

        // Bearbeiten: expect = editable(run), Ziel mit getrimmter Notiz, Gefühl entfernt bei null.
        let edit = try store.performActivity(XCTUnwrap(ActivityCommands.edit(id: Self.run1, type: "run", feeling: nil, terrain: "forest",
                                                                             note: "  Wald  ", expect: nil)), asUser: Self.user)
        XCTAssertEqual(edit.args["expect"], ["type": "run", "feeling": .null, "terrain": .null, "note": "Fixture"])
        let edited = try XCTUnwrap(ActivityOps.run(store.document.root, id: Self.run1))
        XCTAssertEqual(edited["terrain"], "forest")
        XCTAssertEqual(edited["note"], "Wald")
        XCTAssertNil(edited["feeling"])
        XCTAssertEqual(edited["kcal"], 401, "kcal-Snapshot bleibt")
        let editCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[ActivityOps.runEdit])
        XCTAssertTrue(editCheck(edit.args, store.document.root, nil))
        XCTAssertFalse(editCheck(edit.args, profile(), nil))

        // Löschen mit veraltetem expect: keine optimistische Wirkung.
        let stale = try store.performActivity(XCTUnwrap(ActivityCommands.delete(id: Self.run2, expect:
            ActivityEdit(raw: ["type": "run", "feeling": .null, "terrain": .null, "note": ""]))), asUser: Self.user)
        XCTAssertNotNil(ActivityOps.run(store.document.root, id: Self.run2), "expect passt nicht → nichts vorweggenommen")
        let delete = try store.performActivity(XCTUnwrap(ActivityCommands.delete(id: Self.run2, expect: nil)), asUser: Self.user)
        XCTAssertEqual(delete.args["expect"], ["type": "other", "feeling": .null, "terrain": .null, "note": ""])
        XCTAssertNil(ActivityOps.run(store.document.root, id: Self.run2))
        let deleteCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[ActivityOps.runDelete])
        XCTAssertTrue(deleteCheck(stale.args, store.document.root, nil))
    }

    @MainActor
    func testRouteDeleteAndSaveEffects() throws {
        let (store, _) = try connectedStore()
        let delete = try store.performActivity(XCTUnwrap(ActivityCommands.deleteRoute(id: Self.route1)), asUser: Self.user)
        XCTAssertEqual(delete.args["expect"], profile()["runRoutes"]?[0])
        XCTAssertTrue(ActivityOps.routes(store.document.root).isEmpty, "Route optimistisch entfernt")

        let save = try XCTUnwrap(ActivityCommands.saveRoute(
            id: "q2", name: "  Runde  ",
            line: [GeoPoint(lat: 51.015625, lon: 10.123456), GeoPoint(lat: 51.02, lon: 10.13)],
            waypoints: [GeoPoint(lat: 51.015625, lon: 10.123456), GeoPoint(lat: 51.02, lon: 10.13)],
            distanceKm: 5.125, ascentM: 12.5))
        let prepared = BridgeOps.prepareRouteSave(save.args, store.document)
        XCTAssertEqual(prepared["expect"], JSONValue.null)
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[ActivityOps.routeSave])
        // Gespeicherte Web-Form: toFixed(5), Math.round(km*100)/100 = 5.13, Math.round(12.5) = 13, Name getrimmt.
        var state = profile()
        state["runRoutes"] = [["id": "q2", "name": "Runde", "line": "51.01563,10.12346;51.02000,10.13000",
                               "waypoints": "51.01563,10.12346;51.02000,10.13000", "distanceKm": 5.13, "ascentM": 13, "createdAt": 1]]
        XCTAssertTrue(check(prepared, state, ["routeId": "q2"]))
        state["runRoutes"] = [["id": "q2", "name": "Runde", "line": "51.01563,10.12346;51.02000,10.13000",
                               "waypoints": "51.01563,10.12346;51.02000,10.13000", "distanceKm": 5.12, "ascentM": 13, "createdAt": 1]]
        XCTAssertFalse(check(prepared, state, ["routeId": "q2"]))
        XCTAssertNil(ActivityCommands.saveRoute(id: "q3", name: " ", line: [], waypoints: [], distanceKm: 1, ascentM: nil))
    }
}
