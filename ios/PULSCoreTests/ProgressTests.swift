import Foundation
import XCTest
@testable import PULSCore

/// M5: Fortschritts-Projektion, Query-Antworten, Anfragen, Einstellungs-Ops und deren Wirkungsprüfung (§10).
final class ProgressTests: XCTestCase {
    private static let user = Fixtures.sessionUser
    private static let bench = "x0000000-0000-4000-8000-000000000001"
    private static let push = "o0000000-0000-4000-8000-000000000001"
    private static let run = "r0000000-0000-4000-8000-000000000001"

    private func projection() throws -> ProgressProjectionMessage {
        guard case .progressProjection(let message)? = try InboundMessage.decode(data: Fixtures.data("progress-projection")) else {
            throw XCTSkip("progress-projection erwartet")
        }
        return message
    }

    private func result(_ name: String) throws -> ProgressResultMessage {
        guard case .progressResult(let message)? = try InboundMessage.decode(data: Fixtures.data(name)) else {
            throw XCTSkip("\(name) erwartet")
        }
        return message
    }

    private func profile() throws -> JSONValue {
        try XCTUnwrap(Fixtures.value("progress-input")["profile"])
    }

    private var progressHello: InboundMessage {
        .hello(HelloMessage(
            webVersion: "77",
            ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete] + ProgressOps.all.sorted(),
            screens: ["body", "calendar", "progress"], ownerPending: false,
            projections: ["overview", "progress"], features: ["nativeTabs", "nativeProgress"]
        ))
    }

    private final class SentLog {
        var commands: [ApplyCommand] = []
    }

    @MainActor
    private func connectedStore(session: String = "app-1", directory: URL? = nil) throws -> (ProfileStore, SentLog) {
        let ids = SequentialIDs()
        let store = ProfileStore(environment: StoreEnvironment(
            directory: try directory ?? makeTemporaryDirectory(), now: { fixedNow }, makeCommandID: { ids.make() },
            sessionID: session, reducers: BridgeOps.progressReducers
        ))
        let log = SentLog()
        store.sender = { log.commands.append($0) }
        store.receive(progressHello)
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: try profile(), reason: "load")))
        store.receive(.progressProjection(try projection()))
        return (store, log)
    }

    // MARK: Projektion

    func testProjectionEnvelopeIsLossless() throws {
        let message = try projection()
        XCTAssertEqual(message.projectionSeq, 1)
        XCTAssertEqual(message.seq, 1)
        XCTAssertEqual(message.userId, Self.user)
        XCTAssertEqual(message.reason, "load")
        XCTAssertNil(message.raw["accountSection"])
        XCTAssertEqual(message.json, try Fixtures.value("progress-projection"))
        let data = try JSONEncoder().encode(message)
        XCTAssertEqual(try JSONDecoder().decode(ProgressProjectionMessage.self, from: data), message)
    }

    func testProjectionValuesComeFromTheWeb() throws {
        let progress = try projection().progress
        XCTAssertEqual(progress.language, "de")
        XCTAssertEqual(progress.today, "2026-10-28")
        XCTAssertEqual(progress.settings.group, "training")
        XCTAssertEqual(progress.settings.chartPeriod, "90")
        XCTAssertEqual(progress.settings.chartLines, ["weight": true, "strength": false, "kcal": true])
        XCTAssertEqual(progress.identity?.level, 1)
        XCTAssertEqual(progress.identity?.current, 109)
        XCTAssertEqual(progress.identity?.weekStreak, 2)
        XCTAssertEqual(progress.stats?.averageClock, "1:10:00")
        XCTAssertEqual(progress.records.map(\.id), [Self.bench, "x0000000-0000-4000-8000-000000000002"])
        XCTAssertEqual(progress.records.first?.best, E1RMPoint(date: "2026-10-24", e1rm: 101.3))
        XCTAssertNil(progress.records.last?.best, "kein e1RM bleibt unbekannt")
        XCTAssertEqual(progress.records.last?.heaviest?.reps, 12)
        let metrics = try XCTUnwrap(progress.metrics)
        XCTAssertEqual(metrics.groups.count, 4)
        XCTAssertEqual(metrics.ranges.map(\.key), ["week", "month", "half", "year", "all"])
        XCTAssertEqual(metrics.selectedDefinition?.unit, "Index")
        XCTAssertEqual(metrics.points, [DatedValue(index: 0, date: "2026-10-24", value: 100)])
        XCTAssertEqual(metrics.high, 100)
        // Chart: nur echte Tage, unbekannte Werte bleiben nil (keine Nullen, keine Interpolation).
        let chart = try XCTUnwrap(progress.chart)
        XCTAssertEqual(chart.rows.count, 6)
        XCTAssertEqual(chart.rows.first, TrendRow(date: "2026-10-20", weight: nil, strength: nil, kcal: nil))
        XCTAssertEqual(chart.rows[1].weight, 84.1)
        XCTAssertNil(chart.rows[1].kcal)
        XCTAssertEqual(progress.recap?.mode, "week")
        XCTAssertNil(progress.recap?.stats?.average)
        XCTAssertEqual(progress.recap(mode: "month")?.muscles.map(\.label), ["Brust", "Trizeps"])
        XCTAssertEqual(progress.recap(mode: "month")?.activity?.durationLabel, "1 h 56 min")
        let activity = try XCTUnwrap(progress.activity)
        XCTAssertEqual(activity.filter, "all")
        XCTAssertEqual(activity.types.map(\.type), ["gym", "run", "other"])
        XCTAssertEqual(activity.byType.first?.summary.distanceKm, 5.1)
        XCTAssertEqual(activity.summary?.unknownKcalCount, 1)
        XCTAssertNil(activity.entries.first?.kcal, "unbekannte kcal bleiben nil")
        XCTAssertEqual(activity.entries.last?.distanceKm, 5.12)
        XCTAssertEqual(progress.weeklyGoals?.weeklyGoalKm, 20)
        XCTAssertEqual(progress.weeklyGoals?.activeMinutes, 45)
        XCTAssertEqual(progress.running?.fastest?.paceText, "5:02 /km")
        XCTAssertEqual(progress.running?.weeks.count, 8)
        XCTAssertEqual(progress.runRecords.map(\.km), [1, 5])
        XCTAssertFalse(progress.omitted.any)
        XCTAssertEqual(progress.navigation["calendar"], ProgressNavigation(action: "calendar"))
        XCTAssertEqual(progress.navigation.count, 4)
    }

    // MARK: Query-Antworten

    func testMonthResult() throws {
        let message = try result("progress-result-month")
        XCTAssertEqual(message.requestId, "q")
        XCTAssertTrue(message.ok)
        XCTAssertEqual(message.json, try Fixtures.value("progress-result-month"))
        guard case .month(let month)? = message.result else { return XCTFail("month erwartet") }
        XCTAssertEqual(month.month, "2026-10")
        XCTAssertEqual(month.days.count, 31)
        XCTAssertEqual(month.day("2026-10-24")?.workouts, 1)
        XCTAssertEqual(month.day("2026-10-26")?.activities, 1)
        XCTAssertEqual(month.entries.map(\.date), ["2026-10-24", "2026-10-26", "2026-10-27"])
        XCTAssertEqual(month.entries(on: "2026-10-24").first?.isWorkout, true)
        XCTAssertEqual(month.entries(on: "2026-10-24").first?.entryId, Self.push)
        XCTAssertNil(month.entries(on: "2026-10-24").first?.distanceKm)
        XCTAssertFalse(month.isIncomplete("2026-10-26"))
        XCTAssertEqual(month.weekRecap?.start, "2026-09-28", "ohne day: Woche des Monatsanfangs")
        XCTAssertNil(month.weekRecap?.offset)
        XCTAssertEqual(month.monthRecap?.xp, 109)
        XCTAssertEqual(month.activityView?.mode, "month")
        XCTAssertEqual(month.activityView?.activeDays, ["2026-10-24", "2026-10-26", "2026-10-27"])
    }

    func testWorkoutResultKeepsRawSets() throws {
        guard case .workout(let review)? = try result("progress-result-workout").result else { return XCTFail("workout") }
        XCTAssertEqual(review.id, Self.push)
        XCTAssertEqual(review.durationClock, "1:10:00")
        XCTAssertEqual(review.stats.volume, 1380)
        XCTAssertEqual(review.xp, 49)
        XCTAssertNil(review.bodyweight)
        XCTAssertEqual(review.exercises.count, 2)
        let bench = try XCTUnwrap(review.exercises.first)
        XCTAssertEqual(bench.sets.map(\.kg), [.number(80), .number(80), .empty])
        XCTAssertEqual(bench.sets.map(\.done), [true, true, false])
        XCTAssertNil(bench.sets[2].e1rm)
        XCTAssertNil(review.exercises[1].sets[0].e1rm, "hohe Wiederholungen ohne e1RM")
    }

    func testExerciseResultAndRenamedBest() throws {
        guard case .exercise(let history)? = try result("progress-result-exercise").result else { return XCTFail("exercise") }
        XCTAssertEqual(history.id, Self.bench)
        XCTAssertEqual(history.best, 101.3)
        XCTAssertEqual(history.points.map(\.value), [101.3])
        XCTAssertEqual(history.history.first?.sets.map(\.kg), [.number(80), .number(80)])
        XCTAssertEqual(history.total, 1)
        // Neuer Feldname nach dem Performance-Review.
        let renamed = try ExerciseHistoryResult(json: ["id": "x1", "bestE1rm": 90, "points": [["date": "2026-10-01", "value": 0]]])
        XCTAssertEqual(renamed.best, 90)
        XCTAssertTrue(renamed.points.isEmpty, "kein Nullpunkt")
    }

    func testRunResultWithoutRoute() throws {
        guard case .run(let detail)? = try result("progress-result-run").result else { return XCTFail("run") }
        XCTAssertEqual(detail.entry.entryId, Self.run)
        XCTAssertEqual(detail.paceText, "5:02 /km")
        XCTAssertNil(detail.maxSpeed)
        XCTAssertEqual(detail.pauseSeconds, 12)
        XCTAssertEqual(detail.note, "Fixture")
        XCTAssertFalse(detail.hasRoute)
        XCTAssertEqual(detail.navigation, ProgressNavigation(action: "runDetail", id: Self.run))
    }

    func testGoneResultAndMalformedEnvelope() throws {
        let gone = #"{"type":"progressResult","protocol":1,"requestId":"q2","kind":"workout","ownerPending":false,"ok":false,"error":{"code":"gone","message":"x"}}"#
        guard case .progressResult(let message)? = try InboundMessage.decode(JSONValue.parse(gone)) else { return XCTFail("result") }
        XCTAssertTrue(message.isGone)
        XCTAssertNil(message.result)
        let missingID = #"{"type":"progressResult","protocol":1,"kind":"month","ownerPending":false,"ok":true,"result":{}}"#
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(missingID)))
    }

    // MARK: Anfragen und Navigation

    func testQueryRequestsFollowWebLimits() {
        XCTAssertNotNil(ProgressQueryRequest.month("2024-02", day: "2024-02-29", requestId: "r"))
        XCTAssertNil(ProgressQueryRequest.month("2023-02", day: "2023-02-29", requestId: "r"))
        XCTAssertNil(ProgressQueryRequest.month("2026-10", day: "2026-11-01", requestId: "r"), "Tag muss im Monat liegen")
        XCTAssertNil(ProgressQueryRequest.month("2026-13", requestId: "r"))
        XCTAssertNil(ProgressQueryRequest.month("2026-10", requestId: "  "))
        XCTAssertNil(ProgressQueryRequest.month("2026-10", requestId: String(repeating: "a", count: 101)))
        XCTAssertNil(ProgressQueryRequest.month("2026-10", activityFilter: "Run", requestId: "r"))
        XCTAssertNil(ProgressQueryRequest.month("2026-10", activityMode: "year", requestId: "r"))
        XCTAssertNil(ProgressQueryRequest.detail(.workout, id: "", requestId: "r"))
        XCTAssertNil(ProgressQueryRequest.detail(.month, id: "x", requestId: "r"))
        let request = ProgressQueryRequest.month("2026-10", day: "2026-10-28", activityMode: "week", activityFilter: "run", requestId: "q\"1")!
        let script = WebCall.progressQuery(request)
        XCTAssertTrue(script.contains(#""requestId":"q\"1""#))
        XCTAssertTrue(script.contains("===true:false"))
        XCTAssertEqual(request.json.objectValue?.keys.sorted(), ["activityFilter", "activityMode", "day", "kind", "month", "requestId"])
        XCTAssertEqual(ProgressQueryRequest.detail(.run, id: "r1", requestId: "x")?.json.objectValue?.keys.sorted(), ["id", "kind", "requestId"])
    }

    func testCalendarMonthGeometry() {
        XCTAssertEqual(CalendarMonth.adding(1, to: "2026-12"), "2027-01")
        XCTAssertEqual(CalendarMonth.adding(-1, to: "2026-01"), "2025-12")
        XCTAssertEqual(CalendarMonth.adding(-13, to: "2026-01"), "2024-12")
        XCTAssertEqual(CalendarMonth.dayCount("2024-02"), 29)
        XCTAssertEqual(CalendarMonth.dayCount("2026-02"), 28)
        XCTAssertEqual(CalendarMonth.dayCount("2026-10"), 31)
        // 1. Oktober 2026 ist ein Donnerstag: drei leere Zellen vor dem Montag-Wochenbeginn.
        XCTAssertEqual(CalendarMonth.mondayOffset("2026-10"), 3)
        XCTAssertEqual(CalendarMonth.mondayOffset("2026-06"), 0)
        XCTAssertEqual(CalendarMonth.of(day: "2026-10-28"), "2026-10")
        XCTAssertFalse(CalendarMonth.isValid("2026-1"))
    }

    func testNavigationWhitelistAndInterest() {
        XCTAssertNil(ProgressNavigation(action: "deleteWorkout", id: "x"))
        XCTAssertNil(ProgressNavigation(action: "reviewWorkout"))
        XCTAssertEqual(ProgressNavigation(action: "calendar", id: "ignored")?.id, nil)
        let share = ProgressNavigation(action: "shareWorkout", id: "o\"1")!
        XCTAssertEqual(share.json, ["action": "shareWorkout", "id": "o\"1", "web": true])
        XCTAssertTrue(WebCall.progressNavigate(share).contains(#""web":true"#))
        let interest = ProjectionInterest(["progress", "overview", "bogus", "overview"])
        XCTAssertEqual(interest.projections, ["overview", "progress"])
        XCTAssertTrue(WebCall.setInterest(interest).contains(#"pulsNativeSetInterest({"projections":["overview","progress"]})"#))
        XCTAssertEqual(ProjectionInterest([]).json, ["projections": []])
    }

    /// Werte mit `node -e` gegen V8 abgeglichen (`Math.round(x*10)/10`).
    func testJSRoundingParity() {
        XCTAssertEqual(JSMath.round1(25.15), 25.2, "25.15*10 ist als Double genau 251.5")
        XCTAssertEqual(JSMath.round1(0.05), 0.1)
        XCTAssertEqual(JSMath.round1(2.675), 2.7)
        XCTAssertEqual(JSMath.round1(1.005), 1)
        XCTAssertEqual(JSMath.round1(81.25), 81.3)
        XCTAssertEqual(JSMath.round1(81.24), 81.2)
        // Negative Hälften Richtung +∞ wie Math.round (nicht vom Nullpunkt weg).
        XCTAssertEqual(JSMath.round1(-2.25), -2.2)
        XCTAssertEqual(JSMath.round1(-0.25), -0.2)
        XCTAssertEqual(JSMath.round(-2.5), -2)
        XCTAssertEqual(JSMath.round(2.5), 3)
        XCTAssertEqual(JSMath.round(0.49999999999999994), 0, "nicht floor(x+0.5)")
        XCTAssertEqual(WeightMath.round1(-0.25), -0.2, "Gewichtsdifferenz wie Web round()")
        XCTAssertEqual(ProgressOps.roundedKm(25.15), 25.2)
    }

    func testInterestSyncAlwaysConvergesOnLatestWish() {
        let a = ProjectionInterest(["overview"]), b = ProjectionInterest(["overview", "progress"])
        var sync = InterestSync()
        XCTAssertEqual(sync.want(a, hello: 1), a)
        XCTAssertNil(sync.want(a, hello: 1), "ausstehend: nicht doppelt senden")
        XCTAssertNil(sync.finished(a, accepted: true, hello: 1))
        XCTAssertNil(sync.want(a, hello: 1), "bestätigt: nicht erneut")
        // A angenommen → B ausstehend → wieder A gewünscht ⇒ nach Antwort auf B wird A gesendet.
        XCTAssertEqual(sync.want(b, hello: 1), b)
        XCTAssertNil(sync.want(a, hello: 1))
        XCTAssertEqual(sync.finished(b, accepted: true, hello: 1), a)
        XCTAssertNil(sync.finished(a, accepted: true, hello: 1))
        XCTAssertEqual(sync.confirmed, a)
        // Abgelehnt: nicht in Schleife, eine andere Liste wird gesendet, das nächste Hello beginnt neu.
        XCTAssertEqual(sync.want(b, hello: 1), b)
        XCTAssertNil(sync.finished(b, accepted: false, hello: 1))
        XCTAssertNil(sync.want(b, hello: 1))
        XCTAssertEqual(sync.confirmed, a, "Web behält den bisherigen Stand")
        XCTAssertEqual(sync.want(b, hello: 2), b)
        // Späte Antwort eines älteren Hellos wird ignoriert.
        XCTAssertNil(sync.finished(b, accepted: false, hello: 1))
        XCTAssertEqual(sync.inFlight, b)
        XCTAssertNil(sync.finished(b, accepted: true, hello: 2))
        XCTAssertEqual(sync.confirmed, b)
    }

    // MARK: Store

    @MainActor
    func testStoreOffersScreensAndAcceptsOnlyRegisteredResults() throws {
        let (store, _) = try connectedStore()
        XCTAssertTrue(store.webOffersProgress)
        XCTAssertTrue(store.webOffersCalendar)
        XCTAssertNotNil(store.currentProgress)

        // Nicht angefragt → verworfen.
        XCTAssertFalse(store.receive(.progressResult(try result("progress-result-month"))))
        let request = try XCTUnwrap(ProgressQueryRequest.month("2026-10", requestId: "q"))
        store.registerProgressQuery(request)
        XCTAssertTrue(store.isProgressQueryPending("q"))
        XCTAssertTrue(store.receive(.progressResult(try result("progress-result-month"))))
        XCTAssertNotNil(store.progressResult("q"))
        XCTAssertFalse(store.isProgressQueryPending("q"))

        // Neues Dokument: Ergebnisse verworfen, späte Antwort nicht übernommen.
        store.registerProgressQuery(request)
        let generation = store.progressGeneration
        store.webDocumentDidChange()
        XCTAssertGreaterThan(store.progressGeneration, generation)
        XCTAssertNil(store.progressResult("q"))
        XCTAssertNil(store.currentProgress)
        XCTAssertFalse(store.receive(.progressResult(try result("progress-result-month"))))
    }

    @MainActor
    func testResultOfOtherUserAndOwnerPendingAreDropped() throws {
        let (store, _) = try connectedStore()
        store.registerProgressQuery(try XCTUnwrap(ProgressQueryRequest.month("2026-10", requestId: "q")))
        var other = try Fixtures.value("progress-result-month")
        other["userId"] = "b0000000-0000-4000-8000-0000000000bb"
        guard case .progressResult(let foreign)? = try InboundMessage.decode(other) else { return XCTFail("result") }
        XCTAssertFalse(store.receive(.progressResult(foreign)))
        XCTAssertNil(store.progressResult("q"))

        store.registerProgressQuery(try XCTUnwrap(ProgressQueryRequest.month("2026-10", requestId: "q")))
        store.receive(.hello(HelloMessage(ops: [], screens: [], ownerPending: true)))
        XCTAssertNil(store.currentProgress)
        XCTAssertFalse(store.webOffersProgress)
        XCTAssertFalse(store.receive(.progressResult(try result("progress-result-month"))))
    }

    @MainActor
    func testStaleProgressProjectionIgnored() throws {
        let (store, _) = try connectedStore()
        var newer = try Fixtures.value("progress-projection")
        newer["projectionSeq"] = 5
        newer["reason"] = "save"
        guard case .progressProjection(let five)? = try InboundMessage.decode(newer) else { return XCTFail("projection") }
        XCTAssertTrue(store.receive(.progressProjection(five)))
        newer["projectionSeq"] = 4
        guard case .progressProjection(let four)? = try InboundMessage.decode(newer) else { return XCTFail("projection") }
        XCTAssertFalse(store.receive(.progressProjection(four)))
        XCTAssertEqual(store.currentProgress?.projectionSeq, 5)
    }

    @MainActor
    func testPreviewKeepsCalendarAndProgressReadableButNotWritable() throws {
        let store = ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), now: { fixedNow }))
        var sent: [ApplyCommand] = []
        store.sender = { sent.append($0) }
        store.receive(progressHello)
        let preview = StateFlags(preview: true)
        XCTAssertFalse(store.receive(.snapshot(SnapshotMessage(seq: 0, userId: nil, state: try profile(), flags: preview, reason: "load"))))
        var projection = try Fixtures.value("progress-projection")
        projection["flags"] = preview.json
        projection["userId"] = .null
        guard case .progressProjection(let message)? = try InboundMessage.decode(projection) else { return XCTFail("projection") }
        XCTAssertTrue(store.receive(.progressProjection(message)))

        XCTAssertTrue(store.webOffersProgress)
        XCTAssertTrue(store.webOffersCalendar)
        XCTAssertNotNil(store.currentProgress)
        XCTAssertTrue(store.availableScreens.isEmpty, "Schreibbereiche bleiben in der Vorschau gesperrt")
        XCTAssertFalse(store.hasDocument, "Vorschau-Profil wird nicht gespiegelt")
        XCTAssertThrowsError(try store.performProgress(XCTUnwrap(ProgressCommands.setView(key: "range", value: "year")), asUser: nil)) {
            XCTAssertEqual($0 as? ProfileStoreError, .preview)
        }
        XCTAssertTrue(sent.isEmpty)

        store.registerProgressQuery(try XCTUnwrap(ProgressQueryRequest.month("2026-10", requestId: "q")))
        var result = try Fixtures.value("progress-result-month")
        result["flags"] = preview.json
        result["userId"] = .null
        guard case .progressResult(let answer)? = try InboundMessage.decode(result) else { return XCTFail("result") }
        XCTAssertTrue(store.receive(.progressResult(answer)))
    }

    func testGoalInputNeverReadsGroupedThousandsAsDecimals() {
        for identifier in ["de-DE", "en-GB", "en-US"] {
            let locale = Locale(identifier: identifier)
            let kmText = GoalInput.kmText(1000, locale: locale)
            XCTAssertEqual(kmText, "1000", identifier)
            XCTAssertEqual(GoalInput.km(kmText, locale: locale), .some(1000), identifier)
            XCTAssertEqual(GoalInput.minutes(GoalInput.minutesText(1000, locale: locale), locale: locale), 1000, identifier)
            XCTAssertEqual(GoalInput.minutes(GoalInput.minutesText(10080, locale: locale), locale: locale), 10080, identifier)
            XCTAssertEqual(GoalInput.km("", locale: locale), .some(nil), "leer = kein Ziel")
            XCTAssertNil(GoalInput.km("1001", locale: locale))
            XCTAssertNil(GoalInput.minutes("10081", locale: locale))
            XCTAssertNil(GoalInput.minutes("12,5", locale: locale))
        }
        let de = Locale(identifier: "de-DE"), en = Locale(identifier: "en-GB")
        // Von Hand getippte Tausendertrennung wird als solche gelesen, nicht als Dezimalstelle.
        XCTAssertEqual(GoalInput.km("1.000", locale: de), .some(1000))
        XCTAssertEqual(GoalInput.km("1,000", locale: en), .some(1000))
        XCTAssertEqual(GoalInput.minutes("10.080", locale: de), 10080)
        XCTAssertEqual(GoalInput.minutes("10,080", locale: en), 10080)
        XCTAssertEqual(GoalInput.km("25,5", locale: de), .some(25.5))
        XCTAssertEqual(GoalInput.km("25.5", locale: de), .some(25.5))
        XCTAssertEqual(GoalInput.km("25.5", locale: en), .some(25.5))
        XCTAssertEqual(GoalInput.kmText(25.5, locale: de), "25,5")
        XCTAssertNil(GoalInput.km("1.2.3", locale: de))
    }

    // MARK: Ops

    @MainActor
    func testPreparedCommandsMatchFixturesExactly() throws {
        let (store, log) = try connectedStore()
        let view = try store.performProgress(XCTUnwrap(ProgressCommands.setView(key: "range", value: "year")), asUser: Self.user)
        let expectedView = try ApplyCommand(json: Fixtures.value("apply-progress-view"))
        XCTAssertEqual(view.args, expectedView.args)
        XCTAssertEqual(log.commands.last?.op, ProgressOps.viewSet)
        // Optimistisch: progressView zeigt sofort den Zielwert.
        XCTAssertEqual(store.document["progressView"], ["group": "training", "range": "year", "metric": "strength"])
    }

    @MainActor
    func testChartAndGoalArgsMatchFixtures() throws {
        let (chartStore, _) = try connectedStore()
        let chart = try chartStore.performProgress(
            XCTUnwrap(ProgressCommands.setChart(period: "week", lines: ["weight": false, "strength": true, "kcal": false])),
            asUser: Self.user)
        XCTAssertEqual(chart.args, try ApplyCommand(json: Fixtures.value("apply-progress-chart")).args)

        let (goalStore, _) = try connectedStore()
        let goal = try goalStore.performProgress(XCTUnwrap(ProgressCommands.setGoals(weeklyGoalKm: 25.15, weekMinutesGoal: 180)),
                                                 asUser: Self.user)
        XCTAssertEqual(goal.args, try ApplyCommand(json: Fixtures.value("apply-progress-goal")).args)
        // Andere Lauf-Einstellungen bleiben in der Anzeige erhalten.
        XCTAssertEqual(goalStore.document["runSettings"]?["xFutureSetting"], ["keep": true])
        XCTAssertEqual(goalStore.document["runSettings"]?["weeklyGoalKm"], 25.2)
    }

    func testCommandBoundaries() {
        XCTAssertNil(ProgressCommands.setView(key: "color", value: "x"))
        XCTAssertNil(ProgressCommands.setView(key: "metric", value: String(repeating: "m", count: 161)))
        XCTAssertNil(ProgressCommands.setChart())
        XCTAssertNil(ProgressCommands.setChart(lines: ["weight": true]))
        XCTAssertNil(ProgressCommands.setGoals(weeklyGoalKm: 0.05, weekMinutesGoal: 10))
        XCTAssertNil(ProgressCommands.setGoals(weeklyGoalKm: nil, weekMinutesGoal: 10081))
        XCTAssertNotNil(ProgressCommands.setGoals(weeklyGoalKm: nil, weekMinutesGoal: 0))
    }

    func testEffectChecksUseSnapshotNotProjection() throws {
        let state = try profile()
        let viewArgs = try ApplyCommand(json: Fixtures.value("apply-progress-view")).args
        let viewCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[ProgressOps.viewSet])
        XCTAssertFalse(viewCheck(viewArgs, state, nil))
        var changed = state
        changed["progressView"] = ["group": "training", "range": "year", "metric": "strength"]
        XCTAssertTrue(viewCheck(viewArgs, changed, nil))
        // Gruppe löscht die Metrik wie im Web.
        let groupArgs: JSONValue = ["key": "group", "value": "food", "expect": ["group": "training", "metric": "strength", "xKeep": 1]]
        XCTAssertEqual(ProgressOps.viewTarget(groupArgs), ["group": "food", "xKeep": 1])

        let chartArgs = try ApplyCommand(json: Fixtures.value("apply-progress-chart")).args
        let chartCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[ProgressOps.chartSet])
        XCTAssertFalse(chartCheck(chartArgs, state, nil))
        changed = state
        changed["chartPeriod"] = "week"
        changed["chartLines"] = ["weight": false, "strength": true, "kcal": false]
        XCTAssertTrue(chartCheck(chartArgs, changed, nil))

        let goalArgs = try ApplyCommand(json: Fixtures.value("apply-progress-goal")).args
        let goalCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[ProgressOps.goalSet])
        XCTAssertFalse(goalCheck(goalArgs, state, nil))
        changed = state
        changed["runSettings"] = ["weeklyGoalKm": 25.2, "weekMinutesGoal": 180, "xFutureSetting": ["keep": true]]
        XCTAssertTrue(goalCheck(goalArgs, changed, nil), "wie Math.round(25.15*10)/10 = 25.2 (25.15*10 ist als Double 251.5)")
        // Fehlende Minuten gelten wie im Web als 150.
        XCTAssertEqual(ProgressOps.effectiveGoals(["runSettings": ["weeklyGoalKm": 0]]), ["weeklyGoalKm": .null, "weekMinutesGoal": 150])
    }

    @MainActor
    func testAckedProgressCommandSettlesOnRestartWithEffect() throws {
        let directory = try makeTemporaryDirectory()
        let (store, _) = try connectedStore(session: "app-1", directory: directory)
        let apply = try store.performProgress(XCTUnwrap(ProgressCommands.setGoals(weeklyGoalKm: 25.15, weekMinutesGoal: 180)),
                                              asUser: Self.user)
        store.receive(.ack(AckMessage(id: apply.id, ok: true, seq: 2)))
        var after = try profile()
        after["runSettings"] = ["weeklyGoalKm": 25.2, "weekMinutesGoal": 180, "xFutureSetting": ["keep": true]]
        store.receive(.snapshot(SnapshotMessage(seq: 2, userId: Self.user, state: after, reason: "apply")))
        XCTAssertEqual(store.outboxEntries.first?.lastSeenEffect, true)

        // Neuer Prozess: Wirkung im load-Snapshot sichtbar → ohne Replay entfernt.
        let restarted = ProfileStore(environment: StoreEnvironment(directory: directory, now: { fixedNow }, sessionID: "app-2"))
        let log = SentLog()
        restarted.sender = { log.commands.append($0) }
        XCTAssertEqual(restarted.outboxEntries.count, 1)
        restarted.receive(progressHello)
        restarted.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: after, reason: "load")))
        XCTAssertTrue(restarted.outboxEntries.isEmpty)
        XCTAssertTrue(log.commands.isEmpty)

        // Gegenprobe: Wirkung nach Neustart verloren, zuletzt sichtbar → Replay mit derselben ID und `expect`.
        let other = try makeTemporaryDirectory()
        let (first, _) = try connectedStore(session: "app-1", directory: other)
        let lost = try first.performProgress(XCTUnwrap(ProgressCommands.setGoals(weeklyGoalKm: 25.15, weekMinutesGoal: 180)),
                                             asUser: Self.user)
        first.receive(.ack(AckMessage(id: lost.id, ok: true, seq: 2)))
        first.receive(.snapshot(SnapshotMessage(seq: 2, userId: Self.user, state: after, reason: "apply")))
        let second = ProfileStore(environment: StoreEnvironment(directory: other, now: { fixedNow }, sessionID: "app-2"))
        let replayLog = SentLog()
        second.sender = { replayLog.commands.append($0) }
        second.receive(progressHello)
        second.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: try profile(), reason: "load")))
        XCTAssertEqual(replayLog.commands.map(\.id), [lost.id])
        XCTAssertEqual(replayLog.commands.first?.args, lost.args)
    }
}
