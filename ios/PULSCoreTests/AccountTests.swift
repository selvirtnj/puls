import Foundation
import XCTest
@testable import PULSCore

/// M8/S: Konto-Projektion, Planner-Query, Befehle, Wirkungsprüfungen (§7) einschließlich `snapshot.device`.
/// Erwartete Werte stammen exakt aus tests/fixtures/native-bridge/account-*.json, apply-/ack-account-*.json.
final class AccountTests: XCTestCase {
    private static let user = Fixtures.sessionUser

    private func decode(_ name: String) throws -> InboundMessage {
        try XCTUnwrap(InboundMessage.decode(data: Fixtures.data(name)), name)
    }

    private func hello() throws -> HelloMessage {
        guard case .hello(let hello) = try decode("account-hello") else { throw XCTSkip("hello") }
        return hello
    }

    private func projection() throws -> AccountProjectionMessage {
        guard case .accountProjection(let message) = try decode("account-projection") else { throw XCTSkip("projection") }
        return message
    }

    private func planner() throws -> AccountResultMessage {
        guard case .accountResult(let message) = try decode("account-result-planner") else { throw XCTSkip("planner") }
        return message
    }

    private func deviceSnapshot() throws -> SnapshotMessage {
        guard case .snapshot(let message) = try decode("account-snapshot-device") else { throw XCTSkip("snapshot") }
        return message
    }

    /// Vollständiges synthetisches Profil (`state` des Geräte-Snapshots).
    private func state() throws -> JSONValue {
        try deviceSnapshot().state
    }

    private func args(_ name: String) throws -> JSONValue {
        try ApplyCommand(json: Fixtures.value(name)).args
    }

    // MARK: Hello, Snapshot, Projektion

    func testHelloAccountCapabilities() throws {
        let hello = try hello()
        let caps = try XCTUnwrap(hello.account)
        XCTAssertEqual(caps.queries, ["planner"])
        XCTAssertTrue(caps.supportsPlanner)
        XCTAssertEqual(caps.webActions, AccountNavigation.actions)
        XCTAssertTrue(AccountOps.all.isSubset(of: Set(hello.ops)))
        XCTAssertTrue(hello.screens.contains("account"))
        XCTAssertTrue(hello.features.contains("nativeAccount"))
        XCTAssertEqual(try InboundMessage.decode(hello.json), .hello(hello), "account bleibt beim Zurückschreiben erhalten")
        let old = try InboundMessage.decode(JSONValue.parse(#"{"type":"hello","protocol":1,"ops":[],"screens":[],"ownerPending":false}"#))
        guard case .hello(let legacy)? = old else { return XCTFail("hello") }
        XCTAssertNil(legacy.account)
    }

    func testSnapshotDeviceIsKeptBesideState() throws {
        let snapshot = try deviceSnapshot()
        XCTAssertEqual(snapshot.deviceScheme, "dark")
        XCTAssertEqual(snapshot.reason, "apply")
        XCTAssertNil(snapshot.state["device"], "Gerätedarstellung ist kein Profilfeld")
        XCTAssertEqual(snapshot.json, try Fixtures.value("account-snapshot-device"))
        var odd = try Fixtures.value("account-snapshot-device")
        odd["device"] = "dark"
        guard case .snapshot(let lenient)? = try InboundMessage.decode(odd) else { return XCTFail("snapshot") }
        XCTAssertNil(lenient.deviceScheme, "unerwartete Form = unbekannt, Snapshot bleibt gültig")
    }

    func testProjectionValuesExactlyFromFixture() throws {
        let message = try projection()
        XCTAssertEqual(message.projectionSeq, 1)
        XCTAssertEqual(message.seq, 1)
        XCTAssertEqual(message.userId, Self.user)
        XCTAssertEqual(message.reason, "interest")
        XCTAssertNil(message.accountSection)
        XCTAssertEqual(message.json, try Fixtures.value("account-projection"))
        let a = message.account
        XCTAssertEqual(a.language, "de")
        XCTAssertEqual(a.locale, "de-DE")
        XCTAssertEqual(a.today, "2026-10-28")
        XCTAssertEqual(a.date, "2026-10-28")
        XCTAssertEqual(a.identity.displayName, "Fixture")
        XCTAssertNil(a.identity.avatarImage)
        XCTAssertFalse(a.identity.avatarOmitted)
        XCTAssertEqual(a.identity.streak, 0)
        XCTAssertEqual(a.identity.level, 1)
        XCTAssertEqual(a.identity.current, 58)
        XCTAssertEqual(a.identity.needed, 250)
        let profile = try XCTUnwrap(a.profile)
        XCTAssertEqual(profile.age, 30)
        XCTAssertEqual(profile.rmr, 0, "bekannte 0 bleibt 0")
        XCTAssertEqual(profile.kcalMode, "baseline")
        XCTAssertEqual(profile.baselineFactor, 1.3)
        XCTAssertEqual(profile.weight, 84, "gespeichertes Profilgewicht, nicht currentWeight()")
        XCTAssertNil(profile.updated)
        XCTAssertEqual(a.plan.pace, "medium")
        XCTAssertEqual(a.plan.learnTdee, true)
        XCTAssertEqual(a.goals, MacroValues(kcal: 2006, p: 167, c: 184, f: 67))
        let energy = try XCTUnwrap(a.energy)
        XCTAssertEqual(energy.rmr, 1815)
        XCTAssertEqual(energy.tdee, 2360)
        XCTAssertEqual(energy.baseline, 2360)
        XCTAssertEqual(energy.sport, 0)
        XCTAssertFalse(energy.calibrated)
        let body = a.body
        XCTAssertEqual(body.weight, 83.5)
        XCTAssertEqual(body.bmi, 25.8)
        XCTAssertEqual(body.bmiBodyFat, 21.6)
        XCTAssertEqual(body.bmiLabel, "Übergewicht")
        XCTAssertEqual(body.bodyFat, AccountBodyFat(Loose(["value": 23, "estimated": false, "date": "2026-10-27"])))
        XCTAssertEqual(body.bodyFat?.estimated, false, "manuell gemessen, keine Navy-Schätzung")
        XCTAssertEqual(body.summary.source, "entry")
        XCTAssertEqual(body.summary.date, "2026-10-26")
        XCTAssertEqual(body.summary.weekCount, 1)
        XCTAssertEqual(body.summary.weekMean, 83.5)
        XCTAssertEqual(body.measurements.map(\.id), ["fixture-measure"])
        XCTAssertEqual(body.measurements.first?.values, ["waist": 95, "bodyfat": 23, "neck": 40])
        XCTAssertEqual(body.history.map(\.kg), [83.5, 83.9, 84.2])
        XCTAssertEqual(body.history.first?.bodyFat, 21.6)
        XCTAssertEqual(body.history.first?.method, "bmi-age")
        XCTAssertTrue(body.history.allSatisfy(\.estimated))
        XCTAssertEqual(body.fields.map(\.key), ["waist", "chest", "hip", "arm", "thigh", "bodyfat", "restingHR", "neck"])
        XCTAssertEqual(body.field("neck")?.min, 15)
        XCTAssertEqual(body.field("neck")?.max, 80)
        XCTAssertEqual(body.field("restingHR")?.unit, "bpm")
        XCTAssertEqual(a.adaptive.enabled, true)
        XCTAssertEqual(a.adaptive.disabled, true)
        XCTAssertEqual(a.adaptive.observation.eligible, false)
        XCTAssertEqual(a.adaptive.observation.coverage, 0)
        XCTAssertEqual(a.adaptive.observation.weightCount, 0)
        XCTAssertNil(a.adaptive.observation.estimate, "nicht gelieferte Felder bleiben unbekannt")
        XCTAssertEqual(a.adaptive.calibration?.value, 2650)
        XCTAssertEqual(a.adaptive.calibration?.windowEnd, "2026-10-19")
        XCTAssertEqual(a.appearance.scheme, .system)
        XCTAssertEqual(a.appearance.language, "de")
        XCTAssertEqual(a.appearance.resolvedScheme, "light", "aufgelöst immer light/dark, auch bei system")
        XCTAssertEqual(a.sound.enabled, true)
        XCTAssertEqual(a.sound.volume, 0.6)
        XCTAssertTrue(a.cloud.signedIn)
        XCTAssertTrue(a.cloud.configured)
        XCTAssertEqual(a.cloud.revision, 17)
        XCTAssertFalse(a.recovery.needsAttention)
        XCTAssertEqual(a.sections.map(\.key), AccountSection.keys)
        XCTAssertEqual(a.section("design")?.title, "Darstellung")
        XCTAssertEqual(Set(a.navigation.map(\.action)), Set(AccountNavigation.actions))
        XCTAssertEqual(a.omittedMeasurements, 0)
        XCTAssertEqual(a.omittedHistory, 0)
    }

    func testProjectionCarriesNoAuthData() throws {
        let text = try Fixtures.value("account-projection").serializedString().lowercased()
        for forbidden in ["email", "token", "password", "session", "cloudmessage"] {
            XCTAssertFalse(text.contains(forbidden), forbidden)
        }
    }

    func testForecastIsShownAsTextOnly() throws {
        let html = try XCTUnwrap(projection().account.forecastHTML)
        let blocks = ForecastText.blocks(html)
        XCTAssertEqual(blocks.map(\.kind), [.heading, .paragraph, .summary, .paragraph, .paragraph])
        XCTAssertEqual(blocks.first?.text, "Ziel-Szenario: 2. Juli 2027")
        XCTAssertEqual(blocks.first?.inDetails, false)
        XCTAssertEqual(blocks[2].text, "Annahmen & mögliche Abweichungen")
        XCTAssertEqual(blocks.map(\.inDetails), [false, false, true, true, true])
        let hostile = ForecastText.blocks("<p>A &amp; B</p><script>alert(1)</script><p>x&#252;y</p>")
        XCTAssertEqual(hostile.map(\.text), ["A & B", "xüy"])
    }

    // MARK: Planner

    func testPlannerResultKeepsFullContext() throws {
        let result = try planner()
        XCTAssertEqual(result.requestId, "planner")
        XCTAssertTrue(result.ok)
        let planner = try XCTUnwrap(result.planner)
        XCTAssertTrue(planner.planOps)
        XCTAssertEqual(planner.context.date, "2026-10-28")
        XCTAssertEqual(planner.context.weight, 83.5)
        XCTAssertEqual(planner.context.goals["xFutureGoalField"], "keep-me", "unbekannte Zielfelder bleiben im expect")
        XCTAssertEqual(planner.context.macroGoals, ["kcal": 2006, "p": 167, "c": 184, "f": 67])
        XCTAssertEqual(planner.context.raw["profileRecord"], .null)
        XCTAssertEqual(result.json, try Fixtures.value("account-result-planner"))
        var partial = planner.context.raw
        partial["goalRecord"] = nil
        XCTAssertNil(PlannerContext(json: partial), "unvollständiger Kontext ist keine Erwartung")
        XCTAssertEqual(AccountQueryRequest.planner(requestId: "planner")?.json, ["requestId": "planner", "kind": "planner"])
        XCTAssertNil(AccountQueryRequest.planner(requestId: "   "))
        XCTAssertEqual(WebCall.accountQuery(try XCTUnwrap(AccountQueryRequest.planner(requestId: "p1"))),
                       #"(typeof window.pulsNativeAccountQuery==='function')?window.pulsNativeAccountQuery({"kind":"planner","requestId":"p1"})===true:false"#)
    }

    // MARK: Befehle exakt wie die Apply-Fixtures

    func testCommandsBuildApplyFixturesExactly() throws {
        let document = ProfileDocument(root: try state())
        let name = try XCTUnwrap(AccountCommands.name("  New fixture  "))
        XCTAssertEqual(BridgeOps.prepareAccountName(name.args, document), try args("apply-account-name"))

        var withoutAvatar = try state()
        withoutAvatar["avatarImage"] = nil
        let avatar = try XCTUnwrap(AccountCommands.avatar("data:image/png;base64,QUJD"))
        XCTAssertEqual(BridgeOps.prepareAccountAvatar(avatar.args, ProfileDocument(root: withoutAvatar)), try args("apply-account-avatar"))

        let fields = try projection().account.body.fields
        let measurement = try XCTUnwrap(AccountCommands.saveMeasurement(date: "2026-10-28", values: ["waist": 92, "neck": 39], fields: fields,
                                                                        document: document, today: "2026-10-28", newID: "new-measurement"))
        XCTAssertEqual(measurement.op, AccountOps.measurementsSave)
        XCTAssertEqual(measurement.args, try args("apply-account-measurements"))

        let appearance = try XCTUnwrap(AccountCommands.appearance(scheme: .light, language: "en", expect: (.system, "de")))
        XCTAssertEqual(appearance.args, try args("apply-account-appearance"))

        let context = try XCTUnwrap(planner().planner?.context)
        let profile = try XCTUnwrap(AccountCommands.profile(["height": 181, "kcalMode": "baseline", "baselineFactor": 1.3], context: context))
        XCTAssertEqual(profile.args, try args("apply-account-profile"))
    }

    func testCommandLimitsMatchWeb() throws {
        XCTAssertNil(AccountCommands.name("   "))
        XCTAssertNil(AccountCommands.name(String(repeating: "a", count: 41)))
        XCTAssertNotNil(AccountCommands.name(" " + String(repeating: "a", count: 40) + "\u{FEFF}"), "JS trim entfernt auch U+FEFF")
        XCTAssertEqual(JSString.trim("\u{FEFF} a \u{3000}"), "a")
        XCTAssertEqual(JSString.trim("\u{85}x"), "\u{85}x", "U+0085 ist kein JS-Leerraum")
        XCTAssertNil(AccountCommands.avatar("https://example.com/a.jpg"))
        XCTAssertNil(AccountCommands.avatar("data:image/gif;base64,QUJD"))
        XCTAssertNil(AccountCommands.avatar("data:image/png;base64,QU=JD"))
        XCTAssertNil(AccountCommands.avatar("data:image/jpeg;base64," + String(repeating: "A", count: AccountAvatar.maxInputLength)))
        XCTAssertEqual(AccountCommands.avatar(nil)?.args, ["dataUrl": .null])
        let document = ProfileDocument(root: try state())
        let fields = try projection().account.body.fields
        XCTAssertNil(AccountCommands.saveMeasurement(date: "2026-10-29", values: ["waist": 92], fields: fields, document: document,
                                                     today: "2026-10-28"), "kein Zukunftstag")
        XCTAssertNil(AccountCommands.saveMeasurement(date: "2026-10-28", values: ["neck": 81], fields: fields, document: document,
                                                     today: "2026-10-28"), "außerhalb der Registry")
        XCTAssertNil(AccountCommands.saveMeasurement(date: "2026-10-28", values: ["shoe": 42], fields: fields, document: document,
                                                     today: "2026-10-28"), "unbekanntes Feld")
        XCTAssertNil(AccountCommands.saveMeasurement(date: "2026-10-28", values: [:], fields: fields, document: document, today: "2026-10-28"))
        XCTAssertNil(AccountCommands.sound(enabled: true, volume: 71))
        XCTAssertNil(AccountCommands.appearance(expect: (.system, "de")), "mindestens ein Wunsch")
        let context = try XCTUnwrap(planner().planner?.context)
        XCTAssertNil(AccountCommands.profile(["weight": 80], context: context), "kein Gewicht über das Profil")
        XCTAssertNil(AccountCommands.profile([:], context: context))
        XCTAssertNil(AccountCommands.plan(["mode": "manual"], goals: ["kcal": 0, "p": 1, "c": 1, "f": 1], context: context))
        XCTAssertEqual(AccountCommands.plan(["mode": "manual"], goals: ["kcal": 2000, "p": 150, "c": 200, "f": 60], context: context)?.op,
                       AccountOps.planSet)
        XCTAssertEqual(AccountCommands.adaptive(adaptive: false, learnTdee: false, context: context)?.args["expect"], context.raw)
    }

    /// Bestehender Tagesrecord: dieselbe ID, vollständiger Rohinhalt (einschließlich unbekannter Felder) als `expect`.
    func testMeasurementEditUsesRawRecordAndKeepsUnknownFields() throws {
        let document = ProfileDocument(root: try state())
        let fields = try projection().account.body.fields
        let command = try XCTUnwrap(AccountCommands.saveMeasurement(date: "2026-10-27", values: ["waist": 94], fields: fields,
                                                                    document: document, today: "2026-10-28", newID: "unused"))
        XCTAssertEqual(command.args["id"], "fixture-measure")
        XCTAssertEqual(command.args["expect"]?["extra"], "preserve")
        let target = try XCTUnwrap(AccountOps.measurementTarget(command.args))
        XCTAssertEqual(target, ["id": "fixture-measure", "date": "2026-10-27", "neck": 40, "waist": 94, "bodyfat": 23, "extra": "preserve"])
        var reduced = try state()
        BridgeOps.reduceMeasurementSave(&reduced, command.args)
        XCTAssertEqual(AccountOps.measurement(reduced, id: "fixture-measure"), target)
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[AccountOps.measurementsSave])
        XCTAssertTrue(check(command.args, reduced, nil))
        var lost = target
        lost["extra"] = nil
        reduced["measurements"] = [lost]
        XCTAssertFalse(check(command.args, reduced, nil), "unbekannte Felder müssen erhalten bleiben")

        let delete = try XCTUnwrap(AccountCommands.deleteMeasurement(id: "fixture-measure", document: document))
        XCTAssertEqual(delete.args["expect"]?["extra"], "preserve")
        let deleteCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[AccountOps.measurementsDelete])
        XCTAssertFalse(deleteCheck(delete.args, try state(), nil))
        var removed = try state()
        BridgeOps.reduceMeasurementDelete(&removed, delete.args)
        XCTAssertTrue(deleteCheck(delete.args, removed, nil))
        XCTAssertEqual(BridgeOps.prepareMeasurementDelete(["id": "gone"], document)["expect"], ["id": "gone"])
    }

    // MARK: Wirkungen (§7)

    func testEffectsUseStoredAndAckValues() throws {
        let checks = BridgeOps.defaultEffectChecks
        let nameArgs = try args("apply-account-name")
        var named = try state()
        named["displayName"] = "New fixture"
        XCTAssertTrue(try XCTUnwrap(checks[AccountOps.nameSet])(nameArgs, named, nil))
        XCTAssertFalse(try XCTUnwrap(checks[AccountOps.nameSet])(nameArgs, try state(), nil))
        var reduced = try state()
        BridgeOps.reduceAccountName(&reduced, nameArgs)
        XCTAssertEqual(reduced["displayName"], "New fixture")

        let avatarAck = try AckMessage(json: Fixtures.value("ack-account-avatar"))
        let avatarCheck = try XCTUnwrap(checks[AccountOps.avatarSet])
        var pictured = try state()
        pictured["avatarImage"] = "data:image/jpeg;base64,REVG"
        XCTAssertTrue(avatarCheck(try args("apply-account-avatar"), pictured, avatarAck.result))
        XCTAssertFalse(avatarCheck(try args("apply-account-avatar"), try state(), avatarAck.result))
        XCTAssertFalse(avatarCheck(try args("apply-account-avatar"), pictured, nil), "ohne Web-Ergebnis keine Bildwirkung")

        let soundCheck = try XCTUnwrap(checks[AccountOps.soundSet])
        let sound = try XCTUnwrap(AccountCommands.sound(enabled: false, volume: 40))
        XCTAssertFalse(soundCheck(sound.args, try state(), nil))
        var quiet = try state()
        quiet["soundEnabled"] = false
        quiet["soundVolume"] = 40
        XCTAssertTrue(soundCheck(sound.args, quiet, nil))
        let defaultSound = try XCTUnwrap(AccountCommands.sound(enabled: true, volume: 35))
        var unset = try state()
        unset["soundVolume"] = nil
        unset["soundEnabled"] = nil
        XCTAssertTrue(soundCheck(defaultSound.args, unset, nil), "soundVolume ?? 35, soundEnabled !== false")
        XCTAssertEqual(BridgeOps.prepareSound(sound.args, ProfileDocument(root: try state()))["expect"], ["enabled": true, "volume": 0.6])
    }

    func testProfileEffectComparesFirstDayRecordsAndNulls() throws {
        let ack = try AckMessage(json: Fixtures.value("ack-account-profile"))
        let effect = try XCTUnwrap(ack.result?["effect"])
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[AccountOps.profileSet])
        var s = try state()
        for key in ["profile", "plan", "goals"] { s[key] = try XCTUnwrap(effect[key]) }
        s["tdeeCalibration"] = nil
        XCTAssertFalse(check([:], s, ack.result), "alter Tagesrecord (2006 kcal) steht noch an erster Stelle")
        var goals = try XCTUnwrap(s["goalHistory"]?.arrayValue)
        let index = try XCTUnwrap(goals.firstIndex { $0["date"] == "2026-10-28" })
        goals[index] = try XCTUnwrap(effect["goalRecord"])
        s["goalHistory"] = .array(goals)
        s["profileHistory"] = .array((s["profileHistory"]?.arrayValue ?? []) + [try XCTUnwrap(effect["profileRecord"])])
        XCTAssertTrue(check([:], s, ack.result))
        var calibrated = s
        calibrated["tdeeCalibration"] = try state()["tdeeCalibration"]
        XCTAssertFalse(check([:], calibrated, ack.result), "effect.tdeeCalibration null verlangt fehlende Kalibrierung")
        XCTAssertTrue(try XCTUnwrap(BridgeOps.defaultEffectChecks[AccountOps.planSet])([:], s, ack.result))
        XCTAssertTrue(try XCTUnwrap(BridgeOps.defaultEffectChecks[NutritionOps.goalsSet])([:], s, ack.result),
                      "goals.set prüft wie Web goals.set.effective")
    }

    func testAppearanceEffectReadsSnapshotDevice() throws {
        let args = try self.args("apply-account-appearance")
        let ack = try AckMessage(json: Fixtures.value("ack-account-appearance"))
        let check = try XCTUnwrap(BridgeOps.defaultSnapshotEffectChecks[AccountOps.appearanceSet])
        let dark = try deviceSnapshot()
        XCTAssertFalse(check(args, dark, ack.result))
        var english = dark.state
        english["language"] = "en"
        let light = SnapshotMessage(seq: 3, userId: Self.user, state: english, reason: "load", device: ["scheme": "light"])
        XCTAssertTrue(check(args, light, ack.result))
        XCTAssertFalse(check(args, SnapshotMessage(seq: 3, userId: Self.user, state: english, reason: "load"), ack.result),
                       "ohne device keine Wirkung")
        var reduced = dark.state
        BridgeOps.reduceAppearanceLanguage(&reduced, args)
        XCTAssertEqual(reduced["language"], "en", "nur die Sprache optimistisch")
        XCTAssertNil(reduced["colorScheme"], "Gerätewunsch nie ins Profil")
    }

    // MARK: Store

    @MainActor
    private func connectedStore(session: String = "app-1", directory: URL? = nil, device: JSONValue = ["scheme": "system"]) throws -> ProfileStore {
        let ids = SequentialIDs()
        var reducers = BridgeOps.accountReducers
        reducers.merge(BridgeOps.nutritionReducers) { first, _ in first }
        let store = ProfileStore(environment: StoreEnvironment(
            directory: try directory ?? makeTemporaryDirectory(), now: { fixedNow }, makeCommandID: { ids.make() },
            sessionID: session, reducers: reducers
        ))
        store.receive(.hello(try hello()))
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: try state(), reason: "load", device: device)))
        return store
    }

    @MainActor
    func testStoreOffersAccountAndCorrelatesPlanner() throws {
        let store = try connectedStore()
        XCTAssertTrue(store.webOffersAccount)
        XCTAssertEqual(store.deviceScheme, "system")
        XCTAssertTrue(store.accountCapabilities?.supportsPlanner == true)
        XCTAssertTrue(store.receive(.accountProjection(try projection())))
        XCTAssertEqual(store.currentAccount?.account.identity.displayName, "Fixture")
        XCTAssertFalse(store.receive(.accountResult(try planner())), "nicht registrierte Antwort verworfen")
        store.registerAccountQuery(try XCTUnwrap(AccountQueryRequest.planner(requestId: "planner")))
        XCTAssertTrue(store.receive(.accountResult(try planner())))
        XCTAssertEqual(store.accountResult("planner")?.planner?.planOps, true)
        store.receive(.hello(HelloMessage(ops: [], screens: [], ownerPending: true)))
        XCTAssertNil(store.accountResult("planner"), "ungeklärte Zuordnung verwirft Antworten")
        XCTAssertNil(store.currentAccount)
        XCTAssertFalse(store.webOffersAccount)
    }

    @MainActor
    func testOpenNativeAccountSection() throws {
        let store = try connectedStore()
        guard case .openNative(let open)? = try InboundMessage.decode(JSONValue.parse(
            #"{"type":"openNative","protocol":1,"screen":"account","section":"plan"}"#)) else { return XCTFail("openNative") }
        XCTAssertEqual(open.section, "plan")
        store.receive(.openNative(open))
        XCTAssertEqual(store.consumeAccountSectionRequest(), "plan")
        XCTAssertNil(store.consumeAccountSectionRequest())
    }

    @MainActor
    func testOptimisticNameAndPendingScheme() throws {
        let store = try connectedStore()
        let name = try store.performAccount(XCTUnwrap(AccountCommands.name("  New fixture  ")), asUser: Self.user)
        XCTAssertEqual(name.args, try args("apply-account-name"))
        XCTAssertEqual(store.document["displayName"], "New fixture")
        _ = try store.performAccount(XCTUnwrap(AccountCommands.appearance(scheme: .light, expect: (.system, "de"))), asUser: Self.user)
        XCTAssertEqual(store.pendingScheme, .light)
        XCTAssertEqual(store.displayedScheme, .light)
        XCTAssertThrowsError(try store.performAccount(XCTUnwrap(AccountCommands.name("x")), asUser: "someone-else"))
    }

    /// Neustart: Wirkung im `load`-Snapshot sichtbar → ohne Replay entfernt; nie gesehen → mit derselben ID erneut.
    @MainActor
    func testAppearanceRestartRuleUsesDevice() throws {
        for (device, expectReplay) in [(["scheme": "light"] as JSONValue, false), (["scheme": "system"] as JSONValue, true)] {
            let directory = try makeTemporaryDirectory()
            let store = try connectedStore(session: "app-1", directory: directory)
            let apply = try store.performAccount(XCTUnwrap(AccountCommands.appearance(scheme: .light, language: "en", expect: (.system, "de"))),
                                                 asUser: Self.user)
            let ack = try AckMessage(json: Fixtures.value("ack-account-appearance"))
            store.receive(.ack(AckMessage(id: apply.id, ok: true, seq: 2, result: ack.result)))
            XCTAssertEqual(store.outboxEntries.first?.result, ack.result, "Result vollständig in der Outbox")

            let restarted = ProfileStore(environment: StoreEnvironment(directory: directory, now: { fixedNow }, sessionID: "app-2"))
            var sent: [ApplyCommand] = []
            restarted.sender = { sent.append($0) }
            restarted.receive(.hello(try hello()))
            var english = try state()
            english["language"] = "en"
            restarted.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: english, reason: "load", device: device)))
            if expectReplay {
                XCTAssertEqual(sent.map(\.id), [apply.id], "gleiche Befehls-ID, gleiches expect")
                XCTAssertEqual(sent.first?.args, apply.args)
            } else {
                XCTAssertTrue(sent.isEmpty)
                XCTAssertTrue(restarted.outboxEntries.isEmpty)
            }
        }
    }

    /// Formularstand beim Befüllen: ein inzwischen geänderter Spiegel ändert `expect` nicht (Web antwortet dann `conflict`).
    func testCapturedExpectationsAndBusyRetry() throws {
        let seen = try XCTUnwrap(AccountOps.measurements(try state(), date: "2026-10-27").first)
        var later = try state()
        var row = seen
        row["waist"] = 99
        later["measurements"] = [row]
        let fields = try projection().account.body.fields
        let command = try XCTUnwrap(AccountCommands.saveMeasurement(date: "2026-10-27", values: ["neck": 41], fields: fields, existing: seen,
                                                                    document: ProfileDocument(root: later), today: "2026-10-28"))
        XCTAssertEqual(command.args["expect"], seen)
        XCTAssertEqual(command.args["values"], ["neck": 41], "nur bearbeitete Felder")
        XCTAssertEqual(AccountCommands.deleteMeasurement(row: seen)?.args["expect"], seen)
        XCTAssertEqual(AccountCommands.name("Neu", expect: "Fixture")?.args["expect"], "Fixture")
        XCTAssertEqual(BridgeOps.prepareAccountName(try XCTUnwrap(AccountCommands.name("Neu", expect: .null)).args,
                                                    ProfileDocument(root: try state()))["expect"], .null, "festgehaltenes expect bleibt")
        XCTAssertTrue(BridgeOps.retriesBusyWithoutLock(AccountOps.avatarSet))
        XCTAssertTrue(BridgeOps.retriesBusyWithoutLock(NutritionOps.waterAdd))
        XCTAssertFalse(BridgeOps.retriesBusyWithoutLock(BridgeOps.weightUpsert))
        let context = try XCTUnwrap(planner().planner?.context)
        XCTAssertTrue(AccountCommands.plannerFits(context))
        var huge = context.raw
        huge["goals"]?["xFutureGoalField"] = .string(String(repeating: "x", count: AccountOps.argsLimit))
        XCTAssertFalse(AccountCommands.plannerFits(try XCTUnwrap(PlannerContext(json: huge))), "zu groß → Web-Plan")
    }

    @MainActor
    func testAccountBusyWithoutLockRetriesSameCommand() async throws {
        let ids = SequentialIDs()
        var environment = StoreEnvironment(directory: try makeTemporaryDirectory(), now: { fixedNow }, makeCommandID: { ids.make() },
                                           sessionID: "app-1")
        environment.busyRetryDelay = { _ in .milliseconds(5) }
        let store = ProfileStore(environment: environment)
        var sent: [ApplyCommand] = []
        store.sender = { sent.append($0) }
        store.receive(.hello(try hello()))
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: try state(), reason: "load")))
        let apply = try store.performAccount(XCTUnwrap(AccountCommands.avatar("data:image/png;base64,QUJD")), asUser: Self.user)
        store.receive(.ack(AckMessage(id: apply.id, ok: false, seq: 1, error: AckError(code: .busy, message: "Profil gewechselt"))))
        try await Task.sleep(for: .milliseconds(80))
        XCTAssertGreaterThanOrEqual(sent.count, 2)
        XCTAssertTrue(sent.allSatisfy { $0.id == apply.id && $0.args == apply.args }, "gleiche ID, unverändertes expect")
    }

    func testNavigationOnlyFixedWebActions() throws {
        XCTAssertNil(AccountNavigation(action: "signOutNow"))
        let target = try XCTUnwrap(AccountNavigation(action: "accountSignOut"))
        XCTAssertEqual(target.json, ["action": "accountSignOut", "web": true])
        XCTAssertEqual(WebCall.accountNavigate(target),
                       #"(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate({"action":"accountSignOut","web":true})===true:false"#)
        XCTAssertNil(AccountNavigation(json: ["action": "accountReset"]), "ohne web:true kein Ausweg")
        XCTAssertTrue(ProjectionInterest(["account", "overview"]).projections.contains("account"))
    }
}
