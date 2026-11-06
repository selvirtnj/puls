import Foundation
import XCTest
@testable import PULSCore

/// M7 (P1 + P2): Ernährungs-Projektion, Query-Antworten, Befehle, Wirkungsprüfungen und Replay (§12).
/// Erwartete Werte stammen exakt aus tests/fixtures/native-bridge/nutrition-*.json, apply-/ack-nutrition-*.json.
final class NutritionTests: XCTestCase {
    private static let user = Fixtures.sessionUser

    private func decode(_ name: String) throws -> InboundMessage {
        try XCTUnwrap(InboundMessage.decode(data: Fixtures.data(name)), name)
    }

    private func projection() throws -> NutritionProjectionMessage {
        guard case .nutritionProjection(let message) = try decode("nutrition-projection") else { throw XCTSkip("projection") }
        return message
    }

    private func result(_ name: String) throws -> NutritionResultMessage {
        guard case .nutritionResult(let message) = try decode(name) else { throw XCTSkip(name) }
        return message
    }

    private func productDetail(_ name: String = "nutrition-result-product") throws -> NutritionProductDetail {
        guard case .product(let detail)? = try result(name).result else { throw XCTSkip("product") }
        return detail
    }

    private func hello() throws -> HelloMessage {
        guard case .hello(let hello) = try decode("nutrition-hello") else { throw XCTSkip("hello") }
        return hello
    }

    // MARK: Hello und Projektion

    func testHelloCapabilitiesP2() throws {
        let hello = try hello()
        let caps = try XCTUnwrap(hello.nutrition)
        XCTAssertEqual(caps.stage, "P2")
        XCTAssertEqual(caps.stageNumber, 2)
        XCTAssertTrue(caps.isAtLeastP2)
        XCTAssertEqual(caps.queries, ["search", "product", "recipe", "entry", "labelParse", "recipeImport", "goals"])
        XCTAssertTrue(caps.supports(.labelParse))
        XCTAssertTrue(NutritionOps.all.isSubset(of: Set(hello.ops)))
        XCTAssertTrue(NutritionOps.p2.isSubset(of: Set(hello.ops)))
        XCTAssertEqual(try InboundMessage.decode(hello.json), .hello(hello), "nutrition bleibt beim Zurückschreiben erhalten")
        // Älterer Web-Stand ohne Feld bzw. mit unerwarteter Form: kein Ernährungsbereich, aber gültiges Hello.
        let old = try InboundMessage.decode(JSONValue.parse(#"{"type":"hello","protocol":1,"ops":[],"screens":[],"ownerPending":false,"nutrition":"P1"}"#))
        guard case .hello(let legacy)? = old else { return XCTFail("hello") }
        XCTAssertNil(legacy.nutrition)
        XCTAssertFalse(NutritionCapabilities(stage: "P1", queries: []).isAtLeastP2)
    }

    func testProjectionValuesExactlyFromFixture() throws {
        let message = try projection()
        XCTAssertEqual(message.projectionSeq, 1)
        XCTAssertEqual(message.userId, Self.user)
        XCTAssertEqual(message.reason, "interest")
        XCTAssertEqual(message.json, try Fixtures.value("nutrition-projection"))
        let n = message.nutrition
        XCTAssertEqual(n.stage, "P2")
        XCTAssertEqual(n.date, "2026-10-28")
        XCTAssertTrue(n.isToday)
        XCTAssertEqual(n.language, "de")
        XCTAssertEqual(n.goals.values, MacroValues(kcal: 2006, p: 167, c: 184, f: 67))
        XCTAssertEqual(n.goals.mode, "auto")
        XCTAssertEqual(n.totals, MacroValues(kcal: 199, p: 10, c: 35, f: 2))
        XCTAssertEqual(n.micros.map(\.key), OverviewProjection.microOrder)
        let fiber = try XCTUnwrap(n.micro("fiber"))
        XCTAssertNil(fiber.value, "unbekannt ist nicht 0")
        XCTAssertEqual(fiber.knowledge, .unknown)
        XCTAssertEqual(fiber.target, 30)
        XCTAssertEqual(fiber.targetSource, "reference")
        let vitc = try XCTUnwrap(n.micro("vitc"))
        XCTAssertEqual(vitc.value, 0, "bekannte 0 bleibt 0")
        XCTAssertEqual(vitc.knowledge, .partial(known: 1, total: 2))
        XCTAssertEqual(n.micro("b12")?.unit, "µg")
        let water = try XCTUnwrap(n.water)
        XCTAssertEqual(water.value, 475)
        XCTAssertEqual(water.estimated, 475)
        XCTAssertNil(water.target)
        XCTAssertTrue(water.estimatedDisplayOnly)
        XCTAssertFalse(n.foodLogCompleted)
        XCTAssertEqual(n.entries.map(\.id), ["old", "drink"])
        XCTAssertEqual(n.entries[1].unit, "ml")
        XCTAssertEqual(n.entries[1].amount, 500)
        XCTAssertEqual(n.entries[1].nutrients, ["vitc": 0])
        XCTAssertNil(n.entries[0].foodRef)
        XCTAssertEqual(n.entries[0].kcal, 99)
        XCTAssertEqual(n.entryCount, 2)
        XCTAssertEqual(n.favorites.first?.ref, .id("product"))
        XCTAssertEqual(n.favorites.first?.source, "Eigene Werte")
        XCTAssertTrue(n.favorites.first?.unitKnown == true)
        XCTAssertEqual(n.recipes.first?.id, "recipe")
        XCTAssertEqual(n.recipes.first?.yield, 200)
        XCTAssertEqual(n.recipes.first?.per100, MacroValues(kcal: 100, p: 10, c: 15, f: 0))
        XCTAssertNil(n.settings.waterGoal)
        XCTAssertEqual(n.settings.microGoals, [:], "Erweiterungsfeld water gehört nicht zum Mikroformular")
        XCTAssertEqual(n.omitted.any, false)
        XCTAssertEqual(n.navigation, NavigationTarget(page: "food", web: true))
    }

    // MARK: Queries

    func testProductResultUnitsAndExpect() throws {
        let detail = try productDetail()
        XCTAssertEqual(detail.product.ref, .id("product"))
        XCTAssertEqual(detail.units.map(\.key), ["g", "kg", "oz", "ml", "l", "p0"])
        XCTAssertEqual(detail.unit("ml")?.factor, 1.2, "g↔ml nur mit Web-Dichte")
        XCTAssertEqual(detail.unit("oz")?.factor, 28.349523125)
        XCTAssertEqual(detail.unit("p0")?.factor, 30)
        XCTAssertEqual(detail.unit("p0")?.snapshot, ["name": "Weighed serving", "amount": 30, "unit": "g", "source": "Synthetic fixture"])
        XCTAssertEqual(detail.expect?["extra"], ["keep": true])
        XCTAssertEqual(detail.defaultUnit?.key, "g")
        XCTAssertEqual(detail.defaultAmount, 100)
        XCTAssertEqual(detail.density, 1.2)
        XCTAssertNil(detail.packageAmount)
        XCTAssertTrue(detail.canAdd)
        XCTAssertTrue(detail.canFavorite)
        XCTAssertTrue(detail.baseKnown)
        XCTAssertEqual(NutritionOps.canonicalAmount(2, factor: 30), 60)
        XCTAssertNil(NutritionOps.canonicalAmount(0.05, factor: 1), "unter 0,1 g ungültig")
        XCTAssertNil(NutritionOps.canonicalAmount(11, factor: 1000), "über 10 000 g ungültig")
    }

    func testOffProductIsDraftWithUnknownBasis() throws {
        let detail = try productDetail("nutrition-p2-result-off-product")
        XCTAssertEqual(detail.product.ref, .barcode("4006381333931"))
        XCTAssertFalse(detail.product.unitKnown)
        XCTAssertFalse(detail.baseKnown)
        XCTAssertNil(detail.expect)
        XCTAssertNotNil(detail.draft)
        XCTAssertTrue(detail.product.reviewRequired)
        XCTAssertFalse(detail.canAdd, "OFF nie direkte food.add-Quelle")
        XCTAssertFalse(detail.canFavorite)
        XCTAssertEqual(detail.attribution?.license, "ODbL")
        XCTAssertEqual(detail.attribution?.licenseUrl?.absoluteString, "https://opendatacommons.org/licenses/odbl/1-0/")
    }

    func testSearchResultsP1FieldsAndStagedP2() throws {
        guard case .search(let local)? = try result("nutrition-result-search").result else { return XCTFail("search") }
        XCTAssertEqual(local.items.map(\.ref), [.id("product")])
        XCTAssertEqual(local.phase, "complete")
        XCTAssertTrue(local.isFinal)
        XCTAssertTrue(local.offline)
        XCTAssertEqual(local.onlineStatus, "offline")
        XCTAssertTrue(local.attribution.hasPrefix("BLS 4.0"))
        guard case .search(let online)? = try result("nutrition-p2-result-search").result else { return XCTFail("p2 search") }
        XCTAssertTrue(online.onlineSupported)
        XCTAssertEqual(online.onlineStatus, "ready")
        XCTAssertEqual(online.onlineItems.map(\.ref), [.barcode("4006381333931")])
        XCTAssertTrue(online.onlineItems.first?.reviewRequired == true)
        XCTAssertEqual(online.onlineAttribution?.name, "Open Food Facts")
        // Unbekannte OFF-Bezüge werden toleriert (Zeile entfällt, Nachricht bleibt gültig).
        var odd = try Fixtures.value("nutrition-p2-result-search")
        odd["result"]?["online"]?["items"] = [["ref": ["future": "x"], "name": "?"], ["ref": ["barcode": "123"], "name": "ok"]]
        odd["result"]?["phase"] = "local"
        guard case .nutritionResult(let message)? = try InboundMessage.decode(odd), case .search(let partial)? = message.result else {
            return XCTFail("tolerant")
        }
        XCTAssertEqual(partial.onlineItems.map(\.name), ["ok"])
        XCTAssertFalse(partial.isFinal)
    }

    func testRecipeAndLabelResults() throws {
        guard case .recipe(let recipe)? = try result("nutrition-result-recipe").result else { return XCTFail("recipe") }
        XCTAssertEqual(recipe.name, "Synthetic recipe")
        XCTAssertEqual(recipe.yield, 200)
        XCTAssertEqual(recipe.ingredients.map(\.amount), [100])
        XCTAssertEqual(recipe.totals, MacroValues(kcal: 200, p: 20, c: 30, f: 0))
        XCTAssertEqual(recipe.per100, MacroValues(kcal: 100, p: 10, c: 15, f: 0))
        XCTAssertEqual(recipe.recipe["extra"], "preserve")
        guard case .labelParse(let label)? = try result("nutrition-result-label").result else { return XCTFail("label") }
        XCTAssertEqual(label.values, ["kcal": 200, "f": 0, "c": 30, "p": 20])
        XCTAssertNil(label.values["fiber"], "fehlende Werte fehlen")
        XCTAssertTrue(label.reviewRequired)
        XCTAssertNil(label.basis)
    }

    func testQueryRequestsAreBoundedAndExact() throws {
        let search = try XCTUnwrap(NutritionQueryRequest.search("Synthetic", filter: .favorites, limit: 20, requestId: "r1"))
        XCTAssertEqual(search.json, ["requestId": "r1", "kind": "search", "q": "Synthetic", "filter": "favorites", "limit": 20])
        XCTAssertNil(NutritionQueryRequest.search(String(repeating: "a", count: 101), requestId: "r"))
        XCTAssertNil(NutritionQueryRequest.search("a", limit: 61, requestId: "r"))
        XCTAssertNil(NutritionQueryRequest.search("a", requestId: "  "))
        XCTAssertEqual(NutritionQueryRequest.product(.barcode("4006381333931"), requestId: "b")?.json,
                       ["requestId": "b", "kind": "product", "product": ["barcode": "4006381333931"]])
        XCTAssertEqual(NutritionQueryRequest.detail(.entry, id: "old", requestId: "e")?.json, ["requestId": "e", "kind": "entry", "id": "old"])
        XCTAssertNil(NutritionQueryRequest.detail(.search, id: "x", requestId: "e"))
        XCTAssertEqual(NutritionQueryRequest.labelParse(lines: ["Brennwert 200 kcal"], column: 1, requestId: "l")?.json,
                       ["requestId": "l", "kind": "labelParse", "lines": ["Brennwert 200 kcal"], "column": 1])
        XCTAssertNil(NutritionQueryRequest.labelParse(lines: Array(repeating: "x", count: 501), requestId: "l"))
        XCTAssertNil(NutritionQueryRequest.labelParse(lines: ["x"], column: 3, requestId: "l"))
    }

    // MARK: Befehle gegen die Apply-Fixtures

    func testFoodAddMatchesFixtureExactly() throws {
        let fixture = try ApplyCommand(json: Fixtures.value("apply-nutrition-food-add"))
        let detail = try productDetail()
        let command = try XCTUnwrap(NutritionCommands.add(entryId: "new-entry", detail: detail, amount: 2,
                                                          unit: XCTUnwrap(detail.unit("p0")), meal: "Snacks", date: "2026-10-28"))
        XCTAssertEqual(command.op, fixture.op)
        XCTAssertEqual(command.args, fixture.args)
        // P2: belegte Portion unverändert mitsenden.
        let withPortion = try XCTUnwrap(NutritionCommands.add(entryId: "new-entry", detail: detail, amount: 2,
                                                              unit: XCTUnwrap(detail.unit("p0")), meal: "Snacks", date: "2026-10-28",
                                                              includePortionSnapshot: true))
        XCTAssertEqual(withPortion.args["portion"], detail.unit("p0")?.snapshot)
        let grams = try XCTUnwrap(detail.unit("g"))
        let portion = try XCTUnwrap(detail.unit("p0"))
        XCTAssertNil(NutritionCommands.add(entryId: "bad id", detail: detail, amount: 2, unit: grams, date: "2026-10-28"))
        XCTAssertNil(NutritionCommands.add(entryId: "x", detail: detail, amount: 2, unit: grams, meal: "Brunch", date: "2026-10-28"))
        XCTAssertNil(NutritionCommands.add(entryId: "x", detail: detail, amount: 400, unit: portion, date: "2026-10-28"),
                     "400 × 30 g > 10 000 g")
        let off = try productDetail("nutrition-p2-result-off-product")
        let anyGram = try XCTUnwrap(NutritionUnit(Loose(["key": "g", "factor": 1])))
        XCTAssertNil(NutritionCommands.add(entryId: "x", detail: off, amount: 1, unit: anyGram, date: "2026-10-28"))
    }

    func testPortionCommandsKeepRawExpect() throws {
        let detail = try productDetail()
        XCTAssertTrue(detail.canManage)
        XCTAssertEqual(detail.portions.map(\.name), ["Weighed serving"])
        XCTAssertEqual(detail.portions.first?.amount, 30)
        let save = try XCTUnwrap(NutritionCommands.savePortion(detail: detail, name: "  Scoop ", amount: 25))
        XCTAssertEqual(save.op, NutritionOps.portionSave)
        XCTAssertEqual(save.args["name"], "Scoop")
        XCTAssertEqual(save.args["amount"], 25)
        XCTAssertEqual(save.args["product"], detail.product.ref.json)
        XCTAssertEqual(save.args["expect"], detail.expect)
        XCTAssertNil(NutritionCommands.savePortion(detail: detail, name: "   ", amount: 25))
        XCTAssertNil(NutritionCommands.savePortion(detail: detail, name: "Scoop", amount: 0.05))
        XCTAssertNil(NutritionCommands.savePortion(detail: detail, name: "Scoop", amount: 10_001))
        let delete = try XCTUnwrap(NutritionCommands.deletePortion(detail: detail, name: "Weighed serving"))
        XCTAssertEqual(delete.op, NutritionOps.portionDelete)
        XCTAssertEqual(delete.args["name"], "Weighed serving")
        XCTAssertEqual(delete.args["expect"], detail.expect)
    }

    func testExtrasCommandSendsOnlyChangedFields() throws {
        let detail = try productDetail()
        XCTAssertEqual(detail.storedDensity, 1.2)
        XCTAssertEqual(detail.storedWater, 40)
        let remove = try XCTUnwrap(NutritionCommands.extras(detail: detail, density: .remove))
        XCTAssertEqual(remove.op, NutritionOps.productExtrasSet)
        XCTAssertEqual(remove.args["density"], .null)
        XCTAssertNil(remove.args["water"])
        XCTAssertEqual(try XCTUnwrap(NutritionCommands.extras(detail: detail, density: .set(1.05))).args["density"], 1.05)
        XCTAssertNil(NutritionCommands.extras(detail: detail), "mindestens ein Feld")
        XCTAssertNil(NutritionCommands.extras(detail: detail, density: .set(25)))
        XCTAssertNil(NutritionCommands.extras(detail: detail, water: .set(50)), "Wasseranteil nur bei ml-Produkten")
    }

    func testRecipeCopyAndDeleteUseRawRecipe() throws {
        guard case .recipe(let recipe)? = try result("nutrition-result-recipe").result else { return XCTFail("recipe") }
        let copy = try XCTUnwrap(NutritionCommands.copyRecipe(recipe, newId: "recipe-copy"))
        XCTAssertEqual(copy.op, NutritionOps.recipeCopy)
        XCTAssertEqual(copy.args["id"], "recipe-copy")
        XCTAssertEqual(copy.args["sourceId"], "recipe")
        XCTAssertEqual(copy.args["expect"], recipe.recipe)
        XCTAssertNil(NutritionCommands.copyRecipe(recipe, newId: "recipe"), "Kopie braucht eine neue ID")
        XCTAssertNil(NutritionCommands.copyRecipe(recipe, newId: "bad id"))
        let delete = try XCTUnwrap(NutritionCommands.deleteRecipe(recipe))
        XCTAssertEqual(delete.op, NutritionOps.recipeDelete)
        XCTAssertEqual(delete.args["id"], "recipe")
        XCTAssertEqual(delete.args["expect"], recipe.recipe)
    }

    func testProductSaveReviewAndLabelMatchFixtures() throws {
        let review = try ApplyCommand(json: Fixtures.value("apply-nutrition-product-save"))
        let off = try productDetail("nutrition-p2-result-off-product")
        let values = NutritionCommands.ProductValues(name: "OFF fixture drink", unit: "ml", kcal: 200, p: 20, c: 30, f: 0,
                                                     barcode: "4006381333931", packageAmount: 330)
        let built = try XCTUnwrap(NutritionCommands.saveProduct(kind: .review, id: "off-saved", values: values, expect: off.expect,
                                                                draft: off.draft, confirmWarnings: false))
        XCTAssertEqual(built.op, review.op)
        XCTAssertEqual(built.args, review.args)

        let label = try ApplyCommand(json: Fixtures.value("apply-nutrition-label-save"))
        let labelValues = NutritionCommands.ProductValues(name: "Vision fixture", unit: "g", kcal: 100, p: 10, c: 15, f: 0, fiber: 2)
        let labelBuilt = try XCTUnwrap(NutritionCommands.saveProduct(kind: .label, id: "label", values: labelValues, expect: nil,
                                                                     label: (.portionG, 50, 1), confirmWarnings: false))
        XCTAssertEqual(labelBuilt.args, label.args)
        // Grenzen: Bezug muss zur Basis passen, review braucht Barcode, Werte je 100 begrenzt, leere Namen ungültig.
        XCTAssertNil(NutritionCommands.saveProduct(kind: .label, id: "label", values: labelValues, expect: nil,
                                                   label: (.portionML, 50, 1), confirmWarnings: false))
        var noCode = values
        noCode.barcode = nil
        XCTAssertNil(NutritionCommands.saveProduct(kind: .review, id: "x", values: noCode, expect: nil, confirmWarnings: false))
        var tooMuch = noCode
        tooMuch.kcal = 1001
        XCTAssertNil(NutritionCommands.saveProduct(kind: .custom, id: "x", values: tooMuch, expect: nil, confirmWarnings: false))
        var empty = noCode
        empty.name = "  "
        XCTAssertNil(NutritionCommands.saveProduct(kind: .custom, id: "x", values: empty, expect: nil, confirmWarnings: false))
        XCTAssertNotNil(NutritionCommands.saveProduct(kind: .custom, id: "x", values: noCode, expect: nil, confirmWarnings: false))
    }

    // MARK: Wirkungsprüfungen (§7)

    private func state(foods: [JSONValue] = [], extra: [String: JSONValue] = [:]) throws -> JSONValue {
        var profile = try XCTUnwrap(Fixtures.value("nutrition-input")["profile"])
        if !foods.isEmpty { profile["foods"] = .array(foods) }
        for (key, value) in extra { profile[key] = value }
        return profile
    }

    func testFoodAddEffectUsesAckEffect() throws {
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[NutritionOps.foodAdd])
        let args = try ApplyCommand(json: Fixtures.value("apply-nutrition-food-add")).args
        let ack = try XCTUnwrap(AckMessage(json: Fixtures.value("ack-nutrition-food-add")).result)
        let stored: JSONValue = [
            "id": "new-entry", "date": "2026-10-28", "meal": "Snacks", "name": "Synthetic product", "grams": 60, "unit": "g",
            "kcal": 120, "p": 12, "c": 18, "f": 0, "nutrients": ["water": 24, "vitc": 0], "foodRef": "product",
            "loggedAt": 1_793_188_800_000,
        ]
        XCTAssertTrue(check(args, try state(foods: [stored]), ack), "fehlendes recipeId zählt als null")
        var changed = stored
        changed["kcal"] = 121
        XCTAssertFalse(check(args, try state(foods: [changed]), ack))
        var renamed = stored
        renamed["name"] = "Neu"
        XCTAssertFalse(check(args, try state(foods: [renamed]), ack))
        var otherDay = stored
        otherDay["date"] = "2026-10-27"
        XCTAssertFalse(check(args, try state(foods: [otherDay]), ack))
        XCTAssertFalse(check(args, try state(), ack))
        XCTAssertFalse(check(args, try state(foods: [stored]), nil), "ohne Ack-Ergebnis keine Wirkung behaupten")
    }

    func testDiaryEffectsAndReducers() throws {
        let checks = BridgeOps.defaultEffectChecks
        let old = try XCTUnwrap(Fixtures.value("nutrition-input")["profile"]?["foods"]?[1])
        // Löschen / Wiederherstellen (exakter alter Snapshot, Index kein Merkmal).
        let delete = try XCTUnwrap(checks[NutritionOps.foodDelete])
        XCTAssertFalse(delete(["id": "old", "expect": old], try state(), nil))
        var reduced = try state()
        BridgeOps.reduceFoodDelete(&reduced, ["id": "old", "expect": old])
        XCTAssertTrue(delete(["id": "old", "expect": old], reduced, nil))
        let restoreArgs: JSONValue = ["entry": old, "index": 1, "expect": .null]
        XCTAssertFalse(try XCTUnwrap(checks[NutritionOps.foodRestore])(restoreArgs, reduced, nil))
        BridgeOps.reduceFoodRestore(&reduced, restoreArgs)
        XCTAssertEqual(reduced["foods"]?[1], old)
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.foodRestore])(restoreArgs, reduced, nil))
        // Wasser: logWater-Snapshot.
        let water = try XCTUnwrap(NutritionCommands.water(id: "w1", date: "2026-10-28"))
        var withWater = try state()
        BridgeOps.reduceWaterAdd(&withWater, water.args)
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.waterAdd])(water.args, withWater, nil))
        XCTAssertEqual(NutritionOps.food(withWater, id: "w1")?["nutrients"], ["water": 250])
        // Tagesabschluss: expliziter Zielwert.
        var day: JSONValue = ["date": "2026-10-28", "done": true]
        day = BridgeOps.prepareDayComplete(day, ProfileDocument(root: try state()))
        XCTAssertEqual(day["expect"], false)
        var completed = try state()
        BridgeOps.reduceDayComplete(&completed, day)
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.dayComplete])(day, completed, nil))
        // Mikroziele: Erweiterungsfeld water bleibt, 0 entfernt.
        let micro = try XCTUnwrap(NutritionCommands.microGoals(Dictionary(uniqueKeysWithValues: OverviewProjection.microOrder.map {
            ($0, $0 == "fiber" ? 35.0 : 0)
        })))
        let microArgs = BridgeOps.prepareMicroGoals(micro.args, ProfileDocument(root: try state()))
        XCTAssertEqual(microArgs["expect"], ["water": 12])
        XCTAssertEqual(NutritionOps.microGoalsTarget(microArgs), ["water": 12, "fiber": 35])
        var goals = try state()
        BridgeOps.reduceMicroGoals(&goals, microArgs)
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.microGoalsSet])(microArgs, goals, nil))
        // Wasserziel, 0 = kein Ziel bleibt gültiger Zielwert.
        let waterGoal = BridgeOps.prepareWaterGoal(try XCTUnwrap(NutritionCommands.waterGoal(ml: 0)).args, ProfileDocument(root: try state()))
        XCTAssertEqual(waterGoal["expect"], .null)
        var wg = try state()
        BridgeOps.reduceWaterGoal(&wg, waterGoal)
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.waterGoalSet])(waterGoal, wg, nil))
        // Favorit.
        let favorite = try XCTUnwrap(NutritionCommands.favorite(detail: productDetail(), favorite: false))
        XCTAssertFalse(try XCTUnwrap(checks[NutritionOps.productFavorite])(favorite.args, try state(), nil))
        var fav = try state()
        BridgeOps.reduceProductFavorite(&fav, favorite.args)
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.productFavorite])(favorite.args, fav, nil))
        XCTAssertEqual(fav["custom"]?[0]?["extra"], ["keep": true], "unbekannte Felder bleiben")
    }

    func testUpdateEffectComparesOriginalPlusAckValues() throws {
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[NutritionOps.foodUpdate])
        let old = try XCTUnwrap(Fixtures.value("nutrition-input")["profile"]?["foods"]?[0])
        let args: JSONValue = ["id": "drink", "amount": 250, "unit": "ml", "expect": old]
        let effect: JSONValue = ["effect": ["grams": 250, "unit": "ml", "kcal": 50, "p": 0, "c": 12.5, "f": 0, "nutrients": ["vitc": 0],
                                            "foodRef": .null, "recipeId": .null, "loggedAt": .null]]
        var updated = old
        updated["grams"] = 250
        updated["kcal"] = 50
        updated["c"] = 12.5
        XCTAssertTrue(check(args, try state(foods: [updated]), effect))
        var lost = updated
        lost["unknown"] = nil
        XCTAssertFalse(check(args, try state(foods: [lost]), effect), "unbekannte Felder müssen erhalten sein")
        XCTAssertFalse(check(args, try state(foods: [old]), effect))
    }

    func testP2EffectsUseResultObjects() throws {
        let checks = BridgeOps.defaultEffectChecks
        let save = try XCTUnwrap(AckMessage(json: Fixtures.value("ack-nutrition-product-save")).result)
        let saved = try XCTUnwrap(save["product"])
        let args = try ApplyCommand(json: Fixtures.value("apply-nutrition-product-save")).args
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.productSave])(args, try state(extra: ["custom": [saved]]), save))
        var stale = saved
        stale["verified"] = nil
        XCTAssertFalse(try XCTUnwrap(checks[NutritionOps.productSave])(args, try state(extra: ["custom": [stale]]), save))

        let importAck = try XCTUnwrap(AckMessage(json: Fixtures.value("ack-nutrition-recipe-import-save")).result)
        let recipe = try XCTUnwrap(importAck["recipe"])
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.recipeImportSave])([:], try state(extra: ["recipes": [recipe]]), importAck))
        XCTAssertFalse(try XCTUnwrap(checks[NutritionOps.recipeImportSave])([:], try state(), importAck))
        XCTAssertTrue(try XCTUnwrap(checks[NutritionOps.recipeDelete])(["id": "gone"], try state(), nil))

        let goalsAck = try XCTUnwrap(AckMessage(json: Fixtures.value("ack-nutrition-goals-set")).result)
        let effect = try XCTUnwrap(goalsAck["effect"])
        var goalsState = try state(extra: [
            "profile": try XCTUnwrap(effect["profile"]), "plan": try XCTUnwrap(effect["plan"]), "goals": try XCTUnwrap(effect["goals"]),
            "tdeeCalibration": try XCTUnwrap(effect["tdeeCalibration"]),
        ])
        let goalsCheck = try XCTUnwrap(checks[NutritionOps.goalsSet])
        XCTAssertFalse(goalsCheck([:], goalsState, goalsAck), "Tagesrecords fehlen noch")
        goalsState["goalHistory"] = .array((goalsState["goalHistory"]?.arrayValue ?? []) + [try XCTUnwrap(effect["goalRecord"])])
        goalsState["profileHistory"] = .array((goalsState["profileHistory"]?.arrayValue ?? []) + [try XCTUnwrap(effect["profileRecord"])])
        XCTAssertTrue(goalsCheck([:], goalsState, goalsAck))
    }

    // MARK: Store

    @MainActor
    private func connectedStore(session: String = "app-1", directory: URL? = nil) throws -> (ProfileStore, [ApplyCommand]) {
        let ids = SequentialIDs()
        let store = ProfileStore(environment: StoreEnvironment(
            directory: try directory ?? makeTemporaryDirectory(), now: { fixedNow }, makeCommandID: { ids.make() },
            sessionID: session, reducers: BridgeOps.nutritionReducers
        ))
        store.receive(.hello(try hello()))
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: try state(), reason: "load")))
        return (store, [])
    }

    @MainActor
    func testStoreOffersNutritionAndCorrelatesResults() throws {
        let (store, _) = try connectedStore()
        XCTAssertTrue(store.webOffersNutrition)
        XCTAssertEqual(store.nutritionCapabilities?.stage, "P2")
        store.receive(.nutritionProjection(try projection()))
        XCTAssertEqual(store.currentNutrition?.nutrition.date, "2026-10-28")
        // Ältere projectionSeq desselben Dokuments verworfen.
        var older = try Fixtures.value("nutrition-projection")
        older["projectionSeq"] = 0
        older["reason"] = "save"
        guard case .nutritionProjection(let stale)? = try InboundMessage.decode(older) else { return XCTFail("projection") }
        store.receive(.nutritionProjection(try projection()))
        XCTAssertFalse(store.receive(.nutritionProjection(stale)))

        // Gestaffelte Suche: lokal → weiter registriert, complete → fertig.
        let request = try XCTUnwrap(NutritionQueryRequest.search("OFF fixture", requestId: "p2"))
        store.registerNutritionQuery(request)
        var local = try Fixtures.value("nutrition-p2-result-search")
        local["result"]?["phase"] = "local"
        guard case .nutritionResult(let first)? = try InboundMessage.decode(local) else { return XCTFail("local") }
        XCTAssertTrue(store.receive(.nutritionResult(first)))
        XCTAssertTrue(store.isNutritionQueryPending("p2"))
        XCTAssertTrue(store.receive(.nutritionResult(try result("nutrition-p2-result-search"))))
        XCTAssertFalse(store.isNutritionQueryPending("p2"))
        guard case .search(let final)? = store.nutritionResult("p2")?.result else { return XCTFail("final") }
        XCTAssertTrue(final.isFinal)

        // Nicht registriert bzw. anderer Nutzer: verworfen.
        XCTAssertFalse(store.receive(.nutritionResult(try result("nutrition-result-product"))))
        store.registerNutritionQuery(try XCTUnwrap(NutritionQueryRequest.product(.id("product"), requestId: "q")))
        var foreign = try Fixtures.value("nutrition-result-product")
        foreign["userId"] = "someone-else"
        guard case .nutritionResult(let other)? = try InboundMessage.decode(foreign) else { return XCTFail("foreign") }
        XCTAssertFalse(store.receive(.nutritionResult(other)))
        XCTAssertFalse(store.isNutritionQueryPending("q"))

        // ownerPending: Projektion verdeckt, neue Generation.
        let generation = store.nutritionGeneration
        store.receive(.hello(HelloMessage(webVersion: "78", ownerPending: true)))
        XCTAssertNil(store.currentNutrition)
        XCTAssertGreaterThan(store.nutritionGeneration, generation)
        XCTAssertFalse(store.webOffersNutrition)
    }

    @MainActor
    func testNoNutritionWithoutCapabilitiesOrOps() throws {
        var helloJSON = try Fixtures.value("nutrition-hello")
        helloJSON["nutrition"] = nil
        guard case .hello(let noCaps)? = try InboundMessage.decode(helloJSON) else { return XCTFail("hello") }
        let store = ProfileStore(environment: StoreEnvironment(directory: try makeTemporaryDirectory(), sessionID: "a"))
        store.receive(.hello(noCaps))
        XCTAssertFalse(store.webOffersNutrition)
        var missingOp = try hello()
        missingOp.ops.removeAll { $0 == NutritionOps.foodRestore }
        store.receive(.hello(missingOp))
        XCTAssertFalse(store.webOffersNutrition, "alle neun P1-Ops nötig")
    }

    private func entryDetail(_ index: Int = 1, canRestore: Bool = true) throws -> NutritionEntryDetail {
        let entry = try XCTUnwrap(Fixtures.value("nutrition-input")["profile"]?["foods"]?[index])
        return try NutritionEntryDetail(json: ["entry": entry, "index": .number(Double(index)), "canRestore": .bool(canRestore)])
    }

    private final class Sent {
        var commands: [ApplyCommand] = []
    }

    @MainActor
    private func sendingStore(directory: URL? = nil) throws -> (ProfileStore, Sent) {
        let (store, _) = try connectedStore(directory: directory)
        let sent = Sent()
        store.sender = { sent.commands.append($0) }
        return (store, sent)
    }

    /// Das Löschen steht danach nicht mehr in der Outbox, an seiner Stelle wartet genau ein Restore mit dem alten Snapshot.
    @MainActor
    private func assertReplaced(_ store: ProfileStore, delete: ApplyCommand, restore: Command, state: NutritionUndoState,
                                file: StaticString = #filePath, line: UInt = #line) {
        guard case .restoring(let id) = state else { return XCTFail("restore erwartet", file: file, line: line) }
        XCTAssertFalse(store.outboxEntries.contains { $0.command.id == delete.id }, file: file, line: line)
        let restored = store.outboxEntries.filter { $0.command.op == NutritionOps.foodRestore }
        XCTAssertEqual(restored.map(\.command.id), [id], file: file, line: line)
        XCTAssertEqual(restored.first?.command.args, restore.args, file: file, line: line)
        XCTAssertEqual(restored.first?.status, .pending, file: file, line: line)
    }

    @MainActor
    func testUndoReplacesPendingAckedOrInFlightDeleteAtomically() throws {
        let restore = try XCTUnwrap(NutritionCommands.restore(detail: entryDetail()))
        // Nie gesendet (wartend).
        let (unsent, _) = try sendingStore()
        unsent.sender = nil
        let pending = try unsent.performNutrition(XCTUnwrap(NutritionCommands.delete(detail: entryDetail())), asUser: Self.user)
        assertReplaced(unsent, delete: pending, restore: restore,
                       state: try unsent.undoNutritionDelete(deleteCommandId: pending.id, restore: restore, asUser: Self.user))

        // Unterwegs: Restore wird nach dem Löschen gesendet (Web: Ankunftsreihenfolge), ein spätes Ack ist unbekannt.
        let (flying, sent) = try sendingStore()
        let delete = try flying.performNutrition(XCTUnwrap(NutritionCommands.delete(detail: entryDetail())), asUser: Self.user)
        let state = try flying.undoNutritionDelete(deleteCommandId: delete.id, restore: restore, asUser: Self.user)
        assertReplaced(flying, delete: delete, restore: restore, state: state)
        XCTAssertEqual(sent.commands.map(\.op), [NutritionOps.foodDelete, NutritionOps.foodRestore])
        flying.receive(.ack(AckMessage(id: delete.id, ok: true, seq: 2)))
        assertReplaced(flying, delete: delete, restore: restore, state: state)

        // Bestätigt: ebenfalls ersetzt, also kein Replay des Löschens nach einem Neustart.
        let (acked, _) = try sendingStore()
        let done = try acked.performNutrition(XCTUnwrap(NutritionCommands.delete(detail: entryDetail())), asUser: Self.user)
        acked.receive(.ack(AckMessage(id: done.id, ok: true, seq: 2)))
        assertReplaced(acked, delete: done, restore: restore,
                       state: try acked.undoNutritionDelete(deleteCommandId: done.id, restore: restore, asUser: Self.user))

        // Geparkt (conflict): nie ausgeführt, nur verwerfen.
        let (parked, parkedSent) = try sendingStore()
        let conflict = try parked.performNutrition(XCTUnwrap(NutritionCommands.delete(detail: entryDetail())), asUser: Self.user)
        parked.receive(.ack(AckMessage(id: conflict.id, ok: false, seq: 1, error: AckError(code: .conflict))))
        XCTAssertEqual(try parked.undoNutritionDelete(deleteCommandId: conflict.id, restore: restore, asUser: Self.user), .notNeeded)
        XCTAssertTrue(parked.outboxEntries.isEmpty)
        XCTAssertFalse(parkedSent.commands.contains { $0.op == NutritionOps.foodRestore })

        // Anderes Konto: kein Rückgängig.
        XCTAssertThrowsError(try acked.undoNutritionDelete(deleteCommandId: done.id, restore: restore, asUser: "someone-else"))
    }

    @MainActor
    func testRestartBetweenUndoAndAckKeepsEntry() throws {
        let directory = try makeTemporaryDirectory()
        let (store, _) = try sendingStore(directory: directory)
        let detail = try entryDetail()
        let delete = try store.performNutrition(XCTUnwrap(NutritionCommands.delete(detail: detail)), asUser: Self.user)
        let restore = try XCTUnwrap(NutritionCommands.restore(detail: detail))
        try store.undoNutritionDelete(deleteCommandId: delete.id, restore: restore, asUser: Self.user)
        // Absturz vor jedem Ack: nach dem Neustart wird nur das Restore erneut gesendet, nie das Löschen.
        let restarted = ProfileStore(environment: StoreEnvironment(directory: directory, now: { fixedNow }, sessionID: "app-2"))
        let sent = Sent()
        restarted.sender = { sent.commands.append($0) }
        restarted.receive(.hello(try hello()))
        restarted.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: try state(), reason: "load")))
        XCTAssertEqual(sent.commands.map(\.op), [NutritionOps.foodRestore])
        XCTAssertEqual(sent.commands.first?.args["entry"], detail.entry)
        // Ein verspätetes Ack des ersetzten Löschens ändert nichts mehr.
        restarted.receive(.ack(AckMessage(id: delete.id, ok: true, seq: 4)))
        XCTAssertEqual(restarted.outboxEntries.map(\.command.op), [NutritionOps.foodRestore])
    }
    @MainActor
    func testBusyWithoutWebLockRetriesWithSameIdBounded() async throws {
        let ids = SequentialIDs()
        var environment = StoreEnvironment(directory: try makeTemporaryDirectory(), now: { fixedNow }, makeCommandID: { ids.make() },
                                           sessionID: "app-1")
        environment.busyRetryDelay = { _ in .milliseconds(5) }
        let store = ProfileStore(environment: environment)
        let sent = Sent()
        store.sender = { sent.commands.append($0) }
        store.receive(.hello(try hello()))
        store.receive(.snapshot(SnapshotMessage(seq: 1, userId: Self.user, state: try state(), reason: "load")))
        let water = try store.performNutrition(XCTUnwrap(NutritionCommands.water(id: "w1", date: "2026-10-28")), asUser: Self.user)
        for round in 0..<(NutritionOps.busyRetryLimit + 2) {
            store.receive(.ack(AckMessage(id: water.id, ok: false, seq: 1, error: AckError(code: .busy, message: "Katalog lädt"))))
            try await Task.sleep(for: .milliseconds(60))
            _ = round
        }
        XCTAssertEqual(Set(sent.commands.map(\.id)), [water.id], "immer dieselbe Befehls-ID")
        XCTAssertEqual(sent.commands.count, 1 + NutritionOps.busyRetryLimit, "begrenzte Wiederholungen")

        // Echte Web-Sperre: kein Timer, der Chrome-Pfad sendet nach deren Ende.
        let other = try store.performNutrition(XCTUnwrap(NutritionCommands.water(id: "w2", date: "2026-10-28")), asUser: Self.user)
        store.receive(.chrome(ChromeMessage(blocking: true, reason: "modal", page: "food")))
        let before = sent.commands.count
        store.receive(.ack(AckMessage(id: other.id, ok: false, seq: 1, error: AckError(code: .busy))))
        try await Task.sleep(for: .milliseconds(60))
        XCTAssertEqual(sent.commands.count, before)
        store.receive(.chrome(ChromeMessage(blocking: false, reason: "none", page: "food")))
        XCTAssertTrue(sent.commands.dropFirst(before).contains { $0.id == other.id })
    }

    func testFoodAddEffectChecksSourceBarcodeAndWaterName() throws {
        let check = try XCTUnwrap(BridgeOps.defaultEffectChecks[NutritionOps.foodAdd])
        var args = try ApplyCommand(json: Fixtures.value("apply-nutrition-food-add")).args
        args["expect"]?["source"] = "Eigene Werte"
        args["expect"]?["barcode"] = "4006381333931"
        let ack = try XCTUnwrap(AckMessage(json: Fixtures.value("ack-nutrition-food-add")).result)
        var stored: JSONValue = [
            "id": "new-entry", "date": "2026-10-28", "meal": "Snacks", "name": "Synthetic product", "grams": 60, "unit": "g",
            "kcal": 120, "p": 12, "c": 18, "f": 0, "nutrients": ["water": 24, "vitc": 0], "foodRef": "product",
            "loggedAt": 1_793_188_800_000, "source": "Eigene Werte", "barcode": "4006381333931",
        ]
        XCTAssertTrue(check(args, try state(foods: [stored]), ack))
        stored["source"] = "PULS Basis"
        XCTAssertFalse(check(args, try state(foods: [stored]), ack))
        stored["source"] = "Eigene Werte"
        stored["barcode"] = nil
        XCTAssertFalse(check(args, try state(foods: [stored]), ack))

        let water = try XCTUnwrap(NutritionCommands.water(id: "w1", date: "2026-10-28"))
        var entry = NutritionOps.waterEntry(id: "w1", date: "2026-10-28", ml: 250)
        let waterCheck = try XCTUnwrap(BridgeOps.defaultEffectChecks[NutritionOps.waterAdd])
        XCTAssertTrue(waterCheck(water.args, try state(foods: [entry]), nil))
        entry["name"] = "Saft"
        XCTAssertFalse(waterCheck(water.args, try state(foods: [entry]), nil))
    }

    func testGoalFormsSendObservedExpectation() throws {
        let water = try XCTUnwrap(NutritionCommands.waterGoal(ml: 2000, expect: .null))
        // Preparer überschreibt eine mitgegebene Erwartung nie mit dem neueren Dokument.
        let prepared = BridgeOps.prepareWaterGoal(water.args, ProfileDocument(root: try state(extra: ["waterGoal": 1500])))
        XCTAssertEqual(prepared["expect"], .null)
        let micro = try XCTUnwrap(NutritionCommands.microGoals(["fiber": 30], expect: ["water": 12]))
        XCTAssertEqual(BridgeOps.prepareMicroGoals(micro.args, ProfileDocument(root: try state(extra: ["microGoals": [:]])))["expect"],
                       ["water": 12])
        XCTAssertEqual(NutritionOps.waterGoalExpect(try state()), .null)
        XCTAssertEqual(NutritionOps.microGoalsExpect(try state()), ["water": 12])
    }

    @MainActor
    func testAddReplaysAfterLostEffectWithSameIdAndExpect() throws {
        let directory = try makeTemporaryDirectory()
        let (store, _) = try connectedStore(session: "app-1", directory: directory)
        var sent: [ApplyCommand] = []
        store.sender = { sent.append($0) }
        let detail = try productDetail()
        let command = try XCTUnwrap(NutritionCommands.add(entryId: "new-entry", detail: detail, amount: 2,
                                                          unit: XCTUnwrap(detail.unit("p0")), meal: "Snacks", date: "2026-10-28"))
        let apply = try store.performNutrition(command, asUser: Self.user)
        XCTAssertEqual(sent.map(\.id), [apply.id])
        let ack = try AckMessage(json: Fixtures.value("ack-nutrition-food-add"))
        store.receive(.ack(AckMessage(id: apply.id, ok: true, seq: 2, result: ack.result)))
        let stored: JSONValue = [
            "id": "new-entry", "date": "2026-10-28", "meal": "Snacks", "name": "Synthetic product", "grams": 60, "unit": "g",
            "kcal": 120, "p": 12, "c": 18, "f": 0, "nutrients": ["water": 24, "vitc": 0], "foodRef": "product",
            "loggedAt": 1_793_188_800_000,
        ]
        store.receive(.snapshot(SnapshotMessage(seq: 2, userId: Self.user, state: try state(foods: [stored]), reason: "apply")))
        XCTAssertEqual(store.outboxEntries.first?.lastSeenEffect, true)
        XCTAssertEqual(store.outboxEntries.first?.result, ack.result)

        // Neustart, Eintrag verloren → Replay mit derselben ID und demselben `expect` (Web antwortet noop/conflict).
        let restarted = ProfileStore(environment: StoreEnvironment(directory: directory, now: { fixedNow }, sessionID: "app-2"))
        var replay: [ApplyCommand] = []
        restarted.sender = { replay.append($0) }
        restarted.receive(.hello(try hello()))
        restarted.receive(.snapshot(SnapshotMessage(seq: 3, userId: Self.user, state: try state(), reason: "load")))
        XCTAssertEqual(replay.map(\.id), [apply.id])
        XCTAssertEqual(replay.first?.args, apply.args)

        // Das Replay aus app-2 blieb unbestätigt (wieder `pending`): eine weitere Sitzung sendet es erneut, nie doppelt eingetragen
        // (gleiche Eintrags-ID, das Web bestätigt per Historie bzw. noop).
        let third = ProfileStore(environment: StoreEnvironment(directory: directory, now: { fixedNow }, sessionID: "app-3"))
        var none: [ApplyCommand] = []
        third.sender = { none.append($0) }
        third.receive(.hello(try hello()))
        third.receive(.snapshot(SnapshotMessage(seq: 4, userId: Self.user, state: try state(foods: [stored]), reason: "load")))
        XCTAssertEqual(none.map(\.id), [apply.id], "offener Befehl wird erneut gesendet; das Web bestätigt per Historie/noop")
    }
}
