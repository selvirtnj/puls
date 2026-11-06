import Foundation
import XCTest
@testable import PULSCore

/// Rezept-Editor, Rezept-Import (§12.5) und Routenplaner (§11.6, `route.save`).
final class RecipeAndRouteTests: XCTestCase {
    private func recipe() throws -> NutritionRecipeDetail {
        guard case .nutritionResult(let message)? = try InboundMessage.decode(Fixtures.value("nutrition-result-recipe")),
              case .recipe(let detail)? = message.result else { throw XCTSkip("recipe") }
        return detail
    }

    private func imported() throws -> NutritionRecipeImport {
        guard case .nutritionResult(let message)? = try InboundMessage.decode(Fixtures.value("nutrition-p2-result-import")),
              case .recipeImport(let result)? = message.result else { throw XCTSkip("import") }
        return result
    }

    private func ownIngredient(amount: Double = 100) throws -> RecipeIngredient {
        try XCTUnwrap(RecipeIngredient(name: " Reis ", unit: "g", amount: amount, kcal: 350, p: 7, c: 78, f: 1))
    }

    // MARK: Rezept

    func testEditKeepsRawFieldsAndExpect() throws {
        let detail = try recipe()
        var draft = RecipeDraft(recipe: detail)
        XCTAssertEqual(draft.id, "recipe")
        XCTAssertEqual(draft.yieldGrams, 200)
        draft.name = " Neu "
        draft.ingredients[0].amount = 150
        let command = try XCTUnwrap(NutritionCommands.saveRecipe(draft))
        XCTAssertEqual(command.op, NutritionOps.recipeSave)
        XCTAssertEqual(command.args["expect"], detail.recipe)
        XCTAssertEqual(command.args["recipe"]?["name"], "Neu")
        XCTAssertEqual(command.args["recipe"]?["extra"], "preserve", "unbekannte Felder bleiben")
        XCTAssertEqual(command.args["recipe"]?["ingredients"]?[0]?["amount"], 150)
        XCTAssertEqual(command.args["recipe"]?["ingredients"]?[0]?["kcal"], 200, "Snapshot unverändert")
    }

    func testNewRecipeNeedsCompleteForm() throws {
        var draft = RecipeDraft(id: "new-recipe", name: "Pfanne")
        XCTAssertNil(NutritionCommands.saveRecipe(draft), "keine Zutat, kein Gewicht")
        draft.ingredients = [try ownIngredient()]
        XCTAssertNil(NutritionCommands.saveRecipe(draft), "gewogenes Gesamtgewicht fehlt")
        draft.yieldGrams = 0.5
        XCTAssertNil(NutritionCommands.saveRecipe(draft))
        draft.yieldGrams = 300
        let command = try XCTUnwrap(NutritionCommands.saveRecipe(draft))
        XCTAssertEqual(command.args["expect"], .null)
        XCTAssertEqual(command.args["recipe"]?["ingredients"]?[0]?["name"], "Reis")
        draft.ingredients[0].amount = nil
        XCTAssertNil(NutritionCommands.saveRecipe(draft), "Menge wird nie erfunden")
        draft.ingredients[0].amount = 100
        draft.id = "bad id"
        XCTAssertNil(NutritionCommands.saveRecipe(draft))
    }

    func testIngredientLimits() throws {
        XCTAssertNil(RecipeIngredient(name: "x", unit: "g", amount: 100, kcal: 1001, p: 0, c: 0, f: 0))
        XCTAssertNil(RecipeIngredient(name: "x", unit: "g", amount: 100, kcal: 10, p: 101, c: 0, f: 0))
        XCTAssertNil(RecipeIngredient(name: "x", unit: "stk", amount: 100, kcal: 10, p: 1, c: 0, f: 0))
        XCTAssertNil(RecipeIngredient(name: "  ", unit: "g", amount: 100, kcal: 10, p: 1, c: 0, f: 0))
        let unknown = try XCTUnwrap(NutritionProduct(json: ["ref": ["barcode": "4006381333931"], "name": "OFF", "unit": .null, "kcal": 1, "p": 1, "c": 1, "f": 1]))
        XCTAssertNil(RecipeIngredient(product: unknown, amount: 100), "Bezug unbekannt")
        let known = try XCTUnwrap(NutritionProduct(json: ["ref": ["id": "p"], "name": "Milch", "unit": "ml", "kcal": 47, "p": 3.4, "c": 4.8, "f": 1.5, "source": "PULS Basis"]))
        let ingredient = try XCTUnwrap(RecipeIngredient(product: known, amount: 100))
        XCTAssertEqual(ingredient.unit, "ml")
        XCTAssertEqual(ingredient.json["source"], "PULS Basis")
    }

    func testImportResultNeverInventsAmounts() throws {
        let result = try imported()
        XCTAssertEqual(result.name, "Imported fixture")
        XCTAssertEqual(result.lines, ["100 g Synthetic product", "2 eggs"])
        XCTAssertEqual(result.suggestions[0].amount, 100)
        XCTAssertEqual(result.suggestions[0].matches.first?.ingredient["kcal"], 200)
        XCTAssertNil(result.suggestions[1].amount, "Stückzahl ist keine Menge")
        XCTAssertTrue(result.suggestions[1].matches.isEmpty)
    }

    func testImportSaveNeedsConfirmation() throws {
        let result = try imported()
        var draft = RecipeDraft(id: "imported-recipe", name: "Importiert")
        draft.ingredients = [try ownIngredient()]
        draft.yieldGrams = 300
        XCTAssertNil(NutritionCommands.saveImportedRecipe(draft, source: result, confirmed: false))
        let command = try XCTUnwrap(NutritionCommands.saveImportedRecipe(draft, source: result, confirmed: true))
        XCTAssertEqual(command.op, NutritionOps.recipeImportSave)
        XCTAssertEqual(command.args["confirmIngredients"], true)
        XCTAssertEqual(command.args["expect"], .null)
        XCTAssertEqual(command.args["preview"], ["name": "Imported fixture", "lines": ["100 g Synthetic product", "2 eggs"]])
    }

    func testImportRequests() {
        XCTAssertEqual(NutritionQueryRequest.recipeImport(url: "https://example.org/r", requestId: "r")?.json,
                       ["requestId": "r", "kind": "recipeImport", "url": "https://example.org/r"])
        XCTAssertEqual(NutritionQueryRequest.recipeImport(text: "100 g Reis", requestId: "r")?.json,
                       ["requestId": "r", "kind": "recipeImport", "text": "100 g Reis"])
        XCTAssertNil(NutritionQueryRequest.recipeImport(url: String(repeating: "a", count: 2049), requestId: "r"))
        XCTAssertNil(NutritionQueryRequest.recipeImport(text: String(repeating: "a", count: 100_001), requestId: "r"))
        XCTAssertNil(NutritionQueryRequest.recipeImport(text: "", requestId: "r"))
    }

    func testRecognizedAmountKeepsItsUnit() throws {
        let result = try imported()
        XCTAssertEqual(result.suggestions[0].unit, "g")
        XCTAssertNil(result.suggestions[1].unit, "angenommene Menge hat keine Einheit")
        let milk = try XCTUnwrap(NutritionProduct(json: ["ref": ["id": "p"], "name": "Milch", "unit": "g", "kcal": 47, "p": 3.4, "c": 4.8, "f": 1.5]))
        XCTAssertNil(try XCTUnwrap(RecipeIngredient(product: milk, amount: 200, amountUnit: "ml")).amount, "200 ml sind ohne Dichte keine 200 g")
        XCTAssertEqual(try XCTUnwrap(RecipeIngredient(product: milk, amount: 200, amountUnit: "g")).amount, 200)
        XCTAssertEqual(try XCTUnwrap(RecipeIngredient(product: milk, amount: 100)).amount, 100, "freier Startwert ohne erkannte Einheit")
    }

    func testIngredientSearchStaysLocal() throws {
        XCTAssertEqual(try XCTUnwrap(NutritionQueryRequest.search("Milch", limit: 60, online: false, requestId: "r")).json["online"], false)
        XCTAssertNil(try XCTUnwrap(NutritionQueryRequest.search("Milch", requestId: "r")).json["online"])
    }

    func testUntouchedNumbersKeepFullPrecision() {
        let parse: (String) -> Double? = { Double($0.replacingOccurrences(of: ",", with: ".")) }
        var field = RecipeNumberField(original: 1.23456, shown: "1,235")
        XCTAssertEqual(field.value(parse: parse), 1.23456, "bloßes Umbenennen ändert die Zahl nicht")
        field.text = "1,24"
        XCTAssertEqual(field.value(parse: parse), 1.24)
        field.text = "1,235"
        XCTAssertEqual(field.value(parse: parse), 1.23456, "derselbe Text ist derselbe Wert")
        XCTAssertNil(RecipeNumberField(original: nil, shown: "").value(parse: parse))
    }

    // MARK: Vorschau

    func testPreviewDraftAcceptsIncompleteDrafts() throws {
        var draft = RecipeDraft(id: "new-recipe")
        var json = try XCTUnwrap(draft.previewJSON)
        XCTAssertEqual(json["name"], "")
        XCTAssertEqual(json["yield"], 0, "fehlendes Gewicht: das Web zeigt „Gesamtgewicht fehlt“")
        XCTAssertEqual(json["ingredients"], [])

        var ingredient = try ownIngredient()
        ingredient.amount = nil
        draft.ingredients = [ingredient]
        draft.name = "  Pfanne "
        json = try XCTUnwrap(draft.previewJSON)
        XCTAssertEqual(json["name"], "Pfanne")
        XCTAssertEqual(json["ingredients"]?[0]?["amount"], 0, "fehlende Menge zählt nicht mit")
        XCTAssertEqual(json["ingredients"]?[0]?["kcal"], 350)
    }

    func testPreviewDraftStaysWithinTransportLimits() throws {
        var bad = RecipeDraft(id: "bad id")
        XCTAssertNil(bad.previewJSON)
        bad = RecipeDraft(id: "new-recipe")
        bad.yieldGrams = 100_001
        XCTAssertNil(bad.previewJSON)
        bad.yieldGrams = -1
        XCTAssertNil(bad.previewJSON)
        bad.yieldGrams = 100
        bad.name = String(repeating: "a", count: 101)
        XCTAssertNil(bad.previewJSON)
        bad.name = "x"
        var ingredient = try ownIngredient()
        ingredient.amount = 100_001
        bad.ingredients = [ingredient]
        XCTAssertNil(bad.previewJSON)
        // Fehlende Nährwerte werden nicht mit 0 ergänzt.
        bad.ingredients = [RecipeIngredient(raw: ["name": "Ohne Werte", "unit": "g", "kcal": 10, "p": 1, "c": 1], amount: 100)]
        XCTAssertNil(bad.previewJSON)
    }

    func testPreviewDraftKeepsUnknownFields() throws {
        let draft = RecipeDraft(recipe: try recipe())
        XCTAssertEqual(try XCTUnwrap(draft.previewJSON)["extra"], "preserve")
    }

    func testPreviewRequestAndResult() throws {
        let draft = try XCTUnwrap(RecipeDraft(id: "new-recipe").previewJSON)
        XCTAssertEqual(NativeQueryRequest.recipePreview(draft: draft, requestId: "r")?.json,
                       ["requestId": "r", "kind": "recipePreview", "draft": draft])
        XCTAssertNil(NativeQueryRequest.recipePreview(draft: draft, requestId: " "))

        let full: JSONValue = [
            "totals": ["kcal": 350.4, "p": 7, "c": 78, "f": 1], "per100": ["kcal": 175.2, "p": 3.5, "c": 39, "f": 0.5],
            "display": ["totals": ["kcal": "350", "p": "7", "c": "78", "f": "1"], "per100": ["kcal": "175", "p": "3,5", "c": "39", "f": "0,5"]],
            "validation": ["valid": true, "message": .null],
        ]
        let preview = try XCTUnwrap(RecipePreview(json: full))
        XCTAssertTrue(preview.isValid)
        XCTAssertNil(preview.message)
        XCTAssertEqual(preview.totals.kcal, "350")
        XCTAssertEqual(preview.per100?.p, "3,5", "fertiger Web-Text")

        let empty: JSONValue = [
            "display": ["totals": ["kcal": "0", "p": "0", "c": "0", "f": "0"], "per100": .null],
            "validation": ["valid": false, "message": "Bitte prüfen"],
        ]
        let missing = try XCTUnwrap(RecipePreview(json: empty))
        XCTAssertNil(missing.per100)
        XCTAssertFalse(missing.isValid)
        XCTAssertEqual(missing.message, "Bitte prüfen")

        XCTAssertNil(RecipePreview(json: ["display": ["totals": ["kcal": 1]], "validation": ["valid": true]]), "Zahlen statt Texten")
        XCTAssertNil(RecipePreview(json: ["validation": ["valid": true]]))
    }

    func testPreviewArrivesAsNativeResult() throws {
        let message = try NativeResultMessage(json: [
            "protocol": 1, "type": "nativeResult", "requestId": "q", "kind": "recipePreview", "seq": 3, "userId": .null, "ownerPending": false,
            "flags": ["preview": false, "recovery": false, "uploadBlocked": false], "language": "de", "ok": true,
            "result": ["display": ["totals": ["kcal": "0", "p": "0", "c": "0", "f": "0"], "per100": .null], "validation": ["valid": false]],
        ])
        XCTAssertEqual(message.kind, NativeQueryRequest.Kind.recipePreview.rawValue)
        XCTAssertNotNil(message.result.flatMap { RecipePreview(json: $0) })
    }

    // MARK: Route

    private let a = GeoPoint(lat: 51, lon: 10)
    private let b = GeoPoint(lat: 51.01, lon: 10.01)

    func testBRouterURLMatchesWebParameters() throws {
        let url = try XCTUnwrap(BRouter.url(base: "https://brouter.de/brouter", profile: "hiking-mountain", waypoints: [a, b]))
        XCTAssertEqual(url.absoluteString,
                       "https://brouter.de/brouter?lonlats=10.000000,51.000000%7C10.010000,51.010000&profile=hiking-mountain&alternativeidx=0&format=geojson")
        XCTAssertNil(BRouter.url(base: "https://brouter.de/brouter", profile: "p", waypoints: [a]))
        XCTAssertNil(BRouter.url(base: "http://brouter.de", profile: "p", waypoints: [a, b]))
    }

    func testBRouterParse() throws {
        let body = #"{"features":[{"geometry":{"coordinates":[[10,51,100],[10.01,51.01,110]]},"properties":{"track-length":"2500","filtered ascend":"42"}}]}"#
        let result = try XCTUnwrap(BRouter.parse(Data(body.utf8)))
        XCTAssertEqual(result.line, [a, b], "GeoJSON ist lon,lat")
        XCTAssertEqual(result.distanceKm, 2.5)
        XCTAssertEqual(result.ascentM, 42)
        // Ohne `track-length`: Web-Abstand entlang der Linie; ohne Anstieg bleibt er unbekannt.
        let plain = #"{"features":[{"geometry":{"coordinates":[[10,51],[10.01,51.01]]},"properties":{}}]}"#
        let fallback = try XCTUnwrap(BRouter.parse(Data(plain.utf8)))
        XCTAssertEqual(fallback.distanceKm, 1.3137758416831165, accuracy: 1e-9)
        XCTAssertNil(fallback.ascentM)
        XCTAssertNil(BRouter.parse(Data(#"{"features":[]}"#.utf8)))
        XCTAssertNil(BRouter.parse(Data("kein json".utf8)))
    }

    func testStraightDistanceEqualsWebRunMeters() {
        XCTAssertEqual(RoutePlan.straightKm([a, b]), 1.3137758416831165, accuracy: 1e-9)
        XCTAssertEqual(RoutePlan.straightKm([a]), 0)
    }

    func testThinningStaysWithinLimitAndKeepsEnd() {
        let line = (0..<2399).map { GeoPoint(lat: 50 + Double($0) / 100_000, lon: 10) }
        let thinned = RoutePlan.thinned(line, limit: 800)
        XCTAssertLessThanOrEqual(thinned.count, 800)
        XCTAssertEqual(thinned.first, line.first)
        XCTAssertEqual(thinned.last, line.last)
        XCTAssertEqual(RoutePlan.thinned([a, b], limit: 800), [a, b])
    }

    func testPlanEditingAndEstimate() {
        var plan = RoutePlan()
        plan.waypoints = [a, b]
        plan.straighten()
        XCTAssertEqual(plan.line, [a, b])
        plan.closeLoop()
        XCTAssertEqual(plan.waypoints, [a, b, a])
        plan.apply(BRouterResult(line: [a, b], distanceKm: 5.125, ascentM: 42.4))
        XCTAssertEqual(plan.roundedKm, 5.13)
        XCTAssertEqual(plan.estimatedSeconds(pace: 300), 1537.5)
        XCTAssertNil(plan.estimatedSeconds(pace: nil))
    }

    func testSaveCommandRoundsLikeWeb() throws {
        var plan = RoutePlan()
        plan.waypoints = [a, b]
        plan.apply(BRouterResult(line: [a, b], distanceKm: 5.125, ascentM: 42.4))
        let command = try XCTUnwrap(plan.saveCommand(id: "route-1", name: "Runde", maxLinePoints: 800, expect: .null))
        XCTAssertEqual(command.op, ActivityOps.routeSave)
        XCTAssertEqual(command.args["route"]?["distanceKm"], 5.13)
        XCTAssertEqual(command.args["route"]?["ascentM"], 42)
        XCTAssertEqual(command.args["expect"], .null, "neue Route: ausdrücklich keine Erwartung")
        XCTAssertNil(RoutePlan().saveCommand(id: "route-1", name: "Runde", maxLinePoints: 800, expect: .null), "mindestens zwei Punkte")
        plan.ascentM = nil
        XCTAssertNil(try XCTUnwrap(plan.saveCommand(id: "route-1", name: "Runde", maxLinePoints: 800, expect: .null)).args["route"]?["ascentM"])
    }

    func testExistingRouteKeepsLineUntilChanged() throws {
        let detail = try RouteDetail(json: ["id": "r", "name": "Alt", "line": "51,10;51.005,10.005;51.01,10.01", "waypoints": "51,10;51.01,10.01",
                                            "distanceKm": 3.2, "ascentM": 12])
        let plan = RoutePlan(detail: detail)
        XCTAssertEqual(plan.line.count, 3)
        XCTAssertEqual(plan.waypoints, [a, b])
        XCTAssertEqual(plan.distanceKm, 3.2, "gespeicherte Distanz, nicht neu gerechnet")
        XCTAssertEqual(plan.ascentM, 12)
    }

    func testNameLikeWeb() {
        XCTAssertEqual(RoutePlan.name("  ", fallback: "Meine Route"), "Meine Route")
        XCTAssertEqual(RoutePlan.name(" Runde ", fallback: "x"), "Runde")
        XCTAssertEqual(RoutePlan.name(String(repeating: "a", count: 70), fallback: "x").count, 60)
    }
}
