import Foundation
import XCTest
@testable import PULSCore

/// M3: Übersichts-Projektion, Dokument-Hello und sichere Web-Aufrufe.
final class ProjectionTests: XCTestCase {
    private func fixtureProjection() throws -> ProjectionMessage {
        guard case .projection(let message)? = try InboundMessage.decode(data: Fixtures.data("projection")) else {
            throw XCTSkip("projection erwartet")
        }
        return message
    }

    // MARK: Decoder und Werteparität

    func testProjectionFixtureEnvelope() throws {
        let message = try fixtureProjection()
        XCTAssertEqual(message.projectionSeq, 2)
        XCTAssertEqual(message.seq, 1)
        XCTAssertEqual(message.userId, Fixtures.sessionUser)
        XCTAssertFalse(message.ownerPending)
        XCTAssertEqual(message.reason, "date")
        XCTAssertEqual(message.flags, .none)
        XCTAssertEqual(message.cloud, CloudStatus(signedIn: true, revision: 17, dirty: true, conflict: false))
    }

    func testProjectionFixtureValuesAreTakenAsIs() throws {
        let overview = try fixtureProjection().overview
        XCTAssertEqual(overview.date, "2026-10-25")
        XCTAssertEqual(overview.today, "2026-10-28")
        XCTAssertFalse(overview.isToday)
        XCTAssertEqual(overview.language, "de")
        XCTAssertEqual(overview.locale, "de-DE")
        XCTAssertEqual(overview.colorScheme, "system")
        XCTAssertNil(overview.online)
        XCTAssertEqual(overview.tabs.map(\.id), ["workout", "home", "add", "food", "account"])
        XCTAssertEqual(overview.goals?.values, MacroValues(kcal: 2010, p: 168, c: 184, f: 67))
        XCTAssertEqual(overview.goals?.calorieMode, "baseline")
        XCTAssertEqual(overview.eaten, MacroValues(kcal: 415, p: 19, c: 59, f: 9))
        XCTAssertEqual(overview.remaining, MacroValues(kcal: 1595, p: 149, c: 125, f: 58))
        let energy = try XCTUnwrap(overview.energy)
        XCTAssertEqual(energy.displayValue, 1595)
        XCTAssertEqual(energy.captionKey, "energy.left")
        XCTAssertEqual(energy.percent, 20.65174129353234)
        XCTAssertEqual(energy.ringFraction, 0.2065174129353234, accuracy: 1e-12)
        XCTAssertEqual(overview.macros["p"]?.percent, 11.36904761904762)
        XCTAssertEqual(Set(overview.macros.keys), ["p", "c", "f"])
    }

    func testUnknownStaysDistinctFromZero() throws {
        let overview = try fixtureProjection().overview
        XCTAssertEqual(overview.micros.map(\.key), OverviewProjection.microOrder)
        let byKey = Dictionary(uniqueKeysWithValues: overview.micros.map { ($0.key, $0) })
        // Bekannte Null bleibt 0, unbekannt bleibt nil.
        XCTAssertEqual(byKey["vitc"]?.value, 0)
        XCTAssertEqual(byKey["vitc"]?.knowledge, .partial(known: 1, total: 3))
        XCTAssertNil(byKey["b12"]?.value)
        XCTAssertEqual(byKey["b12"]?.knowledge, .unknown)
        XCTAssertEqual(byKey["iron"]?.value, 3.4)
        XCTAssertEqual(byKey["iron"]?.targetSource, "reference")
        let water = try XCTUnwrap(overview.water)
        XCTAssertEqual(water.value, 472)
        XCTAssertEqual(water.knowledge, .partial(known: 2, total: 3))
        XCTAssertEqual(water.estimated, 0)
    }

    func testFoodTrainingWeightProgress() throws {
        let overview = try fixtureProjection().overview
        let food = try XCTUnwrap(overview.food)
        XCTAssertEqual(food.total, 3)
        XCTAssertEqual(food.preview.map(\.name), ["Wasser", "Milch 1,5 %", "Haferflocken"])
        XCTAssertEqual(food.preview.first?.unit, "ml")
        XCTAssertEqual(food.preview.last?.unit, "g")
        XCTAssertEqual(food.preview.last?.kcal, 298)
        XCTAssertEqual(food.complete, true)

        let training = try XCTUnwrap(overview.training)
        XCTAssertEqual(training.activeWorkout?.id, "o0000000-0000-4000-8000-000000000002")
        XCTAssertNil(training.activeWorkout?.routineId)
        XCTAssertNil(training.activeRun)
        XCTAssertEqual(training.routines.map(\.id), ["t0000000-0000-4000-8000-000000000001"])
        XCTAssertEqual(training.routineCount, 1)
        XCTAssertEqual(training.week?.minutesGoal, 240)
        XCTAssertEqual(training.week?.runKm, 0)

        let weight = try XCTUnwrap(overview.weight)
        XCTAssertEqual(weight.current?.kg, 83.5)
        XCTAssertEqual(weight.trend?.kg, 83.9)
        XCTAssertEqual(weight.weeklyChange?.kg, -0.6)

        let progress = try XCTUnwrap(overview.progress)
        XCTAssertEqual(progress.period, "90")
        XCTAssertEqual(progress.lines["strength"], false)
        XCTAssertEqual(progress.rowCount, 5)
        XCTAssertEqual(progress.navigation, .page("home", section: nil, web: true))

        XCTAssertEqual(overview.actions["quickAdd"], .action("quickAdd", id: nil))
        XCTAssertEqual(overview.actions["diary"], .page("food", section: nil, web: false))
        XCTAssertEqual(overview.actions.count, 6)
    }

    func testProjectionRoundTripIsLossless() throws {
        let fixture = try Fixtures.value("projection")
        let message = try fixtureProjection()
        XCTAssertEqual(message.json, fixture)
        let data = try JSONEncoder().encode(message)
        XCTAssertEqual(try JSONDecoder().decode(ProjectionMessage.self, from: data), message)
    }

    func testProjectionToleratesUnknownAndMissingFields() throws {
        let text = #"""
        {"type":"projection","protocol":1,"name":"overview","projectionSeq":1,"ownerPending":false,"xFuture":[1],
         "overview":{"date":"2026-10-25","today":"2026-10-25","eaten":{"kcal":null,"p":"x"},"micros":{"zinc":{"known":0,"total":2,"value":5}},
          "actions":{"bad":{"action":"eval"},"weird":{"page":"weight"},"ok":{"action":"editFood","id":"f1"},"noId":{"action":"editFood"}},"xNew":{}}}
        """#
        guard case .projection(let message)? = try InboundMessage.decode(JSONValue.parse(text)) else { return XCTFail("projection") }
        let overview = message.overview
        XCTAssertTrue(overview.isToday)
        XCTAssertNil(overview.eaten?.kcal)
        XCTAssertNil(overview.eaten?.p)
        XCTAssertNil(overview.energy)
        XCTAssertEqual(overview.micros.map(\.key), ["zinc"])
        XCTAssertNil(overview.micros.first?.value, "known 0 bleibt unbekannt")
        XCTAssertEqual(overview.actions, ["ok": .action("editFood", id: "f1")])
        XCTAssertEqual(message.raw["xFuture"], [1])
    }

    func testMalformedProjectionsAreRejectedOrIgnored() throws {
        let malformed = [
            #"{"type":"projection","protocol":1,"name":"overview","projectionSeq":1,"overview":{"date":"2026-10-25","today":"2026-10-25"}}"#,
            #"{"type":"projection","protocol":1,"name":"overview","projectionSeq":1.5,"ownerPending":false,"overview":{"date":"2026-10-25","today":"2026-10-25"}}"#,
            #"{"type":"projection","protocol":1,"name":"overview","projectionSeq":1,"ownerPending":false}"#,
            #"{"type":"projection","protocol":1,"name":"overview","projectionSeq":1,"ownerPending":false,"overview":{"date":"2026-02-30","today":"2026-10-25"}}"#,
            #"{"type":"projection","protocol":1,"name":5,"projectionSeq":1,"ownerPending":false,"overview":{}}"#,
        ]
        for text in malformed {
            XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(text)), text)
        }
        // Künftige Projektionen anderer Namen sind kein Fehler.
        XCTAssertNil(try InboundMessage.decode(JSONValue.parse(
            #"{"type":"projection","protocol":1,"name":"food","projectionSeq":1,"ownerPending":false,"food":{}}"#
        )))
    }

    // MARK: Store-Regeln

    @MainActor
    private func makeStore() throws -> ProfileStore {
        ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), now: { fixedNow }, sessionID: "app-1"))
    }

    private func projection(seq: Int, reason: String = "render", userId: String? = Fixtures.sessionUser,
                            preview: Bool = false, date: String = "2026-10-25") throws -> InboundMessage {
        var value = try Fixtures.value("projection")
        value["projectionSeq"] = .number(Double(seq))
        value["reason"] = .string(reason)
        value["userId"] = userId.map(JSONValue.string) ?? .null
        value["flags"] = ["preview": .bool(preview), "recovery": false, "uploadBlocked": false]
        var overview = try XCTUnwrap(value["overview"])
        overview["date"] = .string(date)
        value["overview"] = overview
        return try XCTUnwrap(InboundMessage.decode(value))
    }

    private func snapshot(_ seq: Int = 1, userId: String?) -> InboundMessage {
        .snapshot(SnapshotMessage(seq: seq, userId: userId, state: [:], reason: "load"))
    }

    @MainActor
    func testOverviewRequiresDocumentHelloAndSameUser() throws {
        let store = try makeStore()
        store.receive(try projection(seq: 1, reason: "load"))
        XCTAssertNil(store.currentProjection, "ohne Hello keine native Übersicht")
        XCTAssertFalse(store.webOffersNativeTabs)

        store.receive(try InboundMessage.decode(data: Fixtures.data("hello"))!)
        XCTAssertTrue(store.webOffersNativeTabs)
        XCTAssertTrue(store.webOffersOverview)
        store.receive(snapshot(userId: Fixtures.sessionUser))
        XCTAssertNotNil(store.currentProjection)

        // Nutzerwechsel: alte Projektion sofort verdeckt.
        store.receive(snapshot(2, userId: "b0000000-0000-4000-8000-0000000000bb"))
        XCTAssertNil(store.currentProjection)
        store.receive(try projection(seq: 2, userId: "b0000000-0000-4000-8000-0000000000bb"))
        XCTAssertNotNil(store.currentProjection)
    }

    @MainActor
    func testOldWebWithoutNativeTabsKeepsWebNavigation() throws {
        let store = try makeStore()
        store.receive(.hello(HelloMessage(webVersion: "73", ops: [BridgeOps.weightUpsert, BridgeOps.weightDelete], screens: ["body"])))
        XCTAssertFalse(store.webOffersNativeTabs)
        XCTAssertFalse(store.webOffersOverview)
        store.receive(.hello(HelloMessage(webVersion: "74", features: ["nativeTabs"])))
        XCTAssertTrue(store.webOffersNativeTabs)
        XCTAssertFalse(store.webOffersOverview, "Tabs ohne angekündigte Projektion: Übersicht bleibt Web")
    }

    @MainActor
    func testOwnerPendingHidesAndDiscardsOverview() throws {
        let store = try makeStore()
        store.receive(try InboundMessage.decode(data: Fixtures.data("hello"))!)
        store.receive(snapshot(userId: Fixtures.sessionUser))
        store.receive(try projection(seq: 1, reason: "load"))
        XCTAssertNotNil(store.currentProjection)

        store.receive(.hello(HelloMessage(webVersion: "74", ownerPending: true, projections: ["overview"], features: ["nativeTabs"])))
        XCTAssertFalse(store.webOffersNativeTabs)
        XCTAssertNil(store.currentProjection)
        XCTAssertNil(store.projection, "alte Übersicht verworfen")

        store.receive(.hello(HelloMessage(webVersion: "74", ownerPending: false, projections: ["overview"], features: ["nativeTabs"])))
        XCTAssertNil(store.currentProjection, "wartet auf neue Daten")
        store.receive(try projection(seq: 2))
        XCTAssertNotNil(store.currentProjection)
    }

    @MainActor
    func testProjectionSeqIsDocumentLocal() throws {
        let store = try makeStore()
        store.receive(try InboundMessage.decode(data: Fixtures.data("hello"))!)
        store.receive(snapshot(userId: Fixtures.sessionUser))
        XCTAssertTrue(store.receive(try projection(seq: 3, date: "2026-10-25")))
        XCTAssertFalse(store.receive(try projection(seq: 2, date: "2026-10-24")), "verspätete Nummer")
        XCTAssertFalse(store.receive(try projection(seq: 3, date: "2026-10-24")))
        XCTAssertEqual(store.currentProjection?.overview.date, "2026-10-25")
        // Datumswechsel ohne neuen Profilsnapshot: nur projectionSeq steigt.
        XCTAssertTrue(store.receive(try projection(seq: 4, reason: "date", date: "2026-10-24")))
        XCTAssertEqual(store.currentProjection?.overview.date, "2026-10-24")
        XCTAssertEqual(store.seq, 1)

        // Neues Dokument: Prüfung zurückgesetzt, Tabs bis zum nächsten Hello aus.
        store.webDocumentDidChange()
        XCTAssertFalse(store.webOffersNativeTabs)
        XCTAssertNil(store.projection)
        store.receive(try InboundMessage.decode(data: Fixtures.data("hello"))!)
        XCTAssertTrue(store.receive(try projection(seq: 1, reason: "load")))
        XCTAssertNotNil(store.currentProjection)
    }

    @MainActor
    func testPreviewProjectionIsShownWithoutSnapshot() throws {
        let store = try makeStore()
        store.receive(try InboundMessage.decode(data: Fixtures.data("hello"))!)
        store.receive(try projection(seq: 1, reason: "load", userId: nil, preview: true))
        XCTAssertEqual(store.currentProjection?.flags.preview, true)
        XCTAssertFalse(store.hasDocument, "Projektion legt kein Profil an")
    }

    @MainActor
    func testNavigateEventsAreDistinct() throws {
        let store = try makeStore()
        store.receive(.navigate(NavigateMessage(page: "home")))
        let first = try XCTUnwrap(store.webNavigation)
        store.receive(.navigate(NavigateMessage(page: "home", web: true)))
        let second = try XCTUnwrap(store.webNavigation)
        XCTAssertNotEqual(first.token, second.token)
        XCTAssertTrue(second.web)
        XCTAssertEqual(store.currentWebPage, "home")
    }

    // MARK: Web-Aufrufe

    func testNavigationTargetsAreAllowListed() {
        XCTAssertEqual(NavigationTarget(page: "food"), .page("food", section: nil, web: false))
        XCTAssertNil(NavigationTarget(page: "weight"))
        XCTAssertNil(NavigationTarget(page: "home", section: "body"))
        XCTAssertNotNil(NavigationTarget(page: "account", section: "body", web: true))
        XCTAssertNil(NavigationTarget(action: "eval"))
        XCTAssertNil(NavigationTarget(action: "startRoutine"))
        XCTAssertNil(NavigationTarget(action: "startRoutine", id: ""))
        XCTAssertEqual(NavigationTarget(action: "quickAdd", id: "x"), .action("quickAdd", id: nil))
        XCTAssertNil(NavigationTarget(json: ["action": "quickAdd", "page": "home"]))
        XCTAssertNil(NavigationTarget(json: ["page": "home", "web": "true"]))
    }

    func testWebCallsEncodeUserContentAsJSON() throws {
        let hostile = "x');alert(1);//\u{2028}\""
        let script = WebCall.navigate(.action("editFood", id: hostile))
        let prefix = "(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate("
        let suffix = ")!==false:false"
        XCTAssertTrue(script.hasPrefix(prefix + "{"))
        XCTAssertTrue(script.hasSuffix(suffix))
        XCTAssertFalse(script.contains("\u{2028}"))
        // Das Argument ist exakt das serialisierte JSON und liest sich verlustfrei zurück.
        let argument = String(script.dropFirst(prefix.count).dropLast(suffix.count))
        XCTAssertEqual(try JSONValue.parse(argument), ["action": "editFood", "id": .string(hostile)])

        XCTAssertEqual(WebCall.setDate("2026-10-25"),
                       "(typeof window.pulsNativeSetDate==='function')?window.pulsNativeSetDate(\"2026-10-25\")===true:false")
        XCTAssertNil(WebCall.setDate("2026-02-30"))
        XCTAssertNil(WebCall.setDate("2026-10-25\");alert(1)//"))
        XCTAssertEqual(WebCall.navigate(.page("account", section: "body", web: true)),
                       #"(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate({"page":"account","section":"body","web":true})!==false:false"#)
        XCTAssertEqual(WebCall.setChrome(true),
                       "(typeof window.pulsNativeSetChrome==='function')?window.pulsNativeSetChrome(true)!==false:false")
    }

    // MARK: chrome

    func testChromeMessage() throws {
        let session = try InboundMessage.decode(JSONValue.parse(
            #"{"type":"chrome","protocol":1,"blocking":true,"reason":"session","page":"workout","xNew":1}"#
        ))
        guard case .chrome(let chrome)? = session else { return XCTFail("chrome erwartet") }
        XCTAssertTrue(chrome.blocking)
        XCTAssertTrue(chrome.hidesNativeBars)
        XCTAssertEqual(chrome.page, "workout")
        XCTAssertFalse(ChromeMessage(blocking: true, reason: "modal").hidesNativeBars)
        XCTAssertFalse(ChromeMessage(blocking: false, reason: "session").hidesNativeBars)
        XCTAssertThrowsError(try InboundMessage.decode(JSONValue.parse(#"{"type":"chrome","protocol":1}"#)))
        XCTAssertEqual(try InboundMessage.decode(chrome.json), .chrome(ChromeMessage(blocking: true, reason: "session", page: "workout")))
    }

    @MainActor
    func testChromeStateResetsWithDocument() throws {
        let store = try makeStore()
        store.receive(.chrome(ChromeMessage(blocking: true, reason: "modal")))
        XCTAssertTrue(store.webBlocksNavigation)
        store.receive(.chrome(ChromeMessage(blocking: false)))
        XCTAssertFalse(store.webBlocksNavigation)
        store.receive(.chrome(ChromeMessage(blocking: true, reason: "run")))
        store.webDocumentDidChange()
        XCTAssertFalse(store.webBlocksNavigation)
        XCTAssertNil(store.webChrome)
    }
}
