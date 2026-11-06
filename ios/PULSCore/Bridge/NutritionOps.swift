import Foundation

// M7/P1: Ernährungs-Ops aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §12.4 (Gegenstück: js/native-nutrition.js).
//
// - Vollständige Erwartungen stammen aus dem verlustfreien Profil (Anzeige = Spiegel plus offene Befehle) bzw. aus den
//   Detailqueries `product`/`entry`, nie aus der gekürzten Projektion. Ein vom Aufrufer gesetztes `expect` bleibt.
// - Optimistische Reducer nur, wo die Wirkung eindeutig ist (Löschen, Wiederherstellen, Wasser, Tagesabschluss,
//   Mikro-/Wasserziel, Favorit eines gespeicherten Produkts). `food.add`/`food.update` setzt allein das Web
//   (Rundung, Makro-/Mikro-Snapshot, `loggedAt`): Native rechnet keine Nährwerte nach.
// - Wirkungsprüfungen (§7) lesen das gespeicherte Profil und `ack.result.effect` (vom Web gespeicherte Werte).

public enum NutritionOps {
    public static let foodAdd = "food.add"
    public static let foodUpdate = "food.update"
    public static let foodDelete = "food.delete"
    public static let foodRestore = "food.restore"
    public static let waterAdd = "water.add"
    public static let dayComplete = "day.complete"
    public static let microGoalsSet = "microGoals.set"
    public static let waterGoalSet = "waterGoal.set"
    public static let productFavorite = "product.favorite"

    /// Die neun P1-Ops; der native Bereich braucht alle (§12.1).
    public static let all: Set<String> = [
        foodAdd, foodUpdate, foodDelete, foodRestore, waterAdd, dayComplete, microGoalsSet, waterGoalSet, productFavorite,
    ]

    // P2 (§12.5): angekündigt per Hello, einzeln freigeschaltet.
    public static let productSave = "product.save"
    public static let productExtrasSet = "product.extras.set"
    public static let portionSave = "portion.save"
    public static let portionDelete = "portion.delete"
    public static let recipeSave = "recipe.save"
    public static let recipeDelete = "recipe.delete"
    public static let recipeCopy = "recipe.copy"
    public static let recipeImportSave = "recipe.import.save"
    public static let goalsSet = "goals.set"

    public static let p2: Set<String> = [
        productSave, productExtrasSet, portionSave, portionDelete, recipeSave, recipeDelete, recipeCopy, recipeImportSave, goalsSet,
    ]

    public static func isNutrition(_ op: String) -> Bool { all.contains(op) || p2.contains(op) }

    /// `product.save`-Arten.
    public enum SaveKind: String, Sendable {
        case custom, review, label
    }

    /// Etikettbezug: je 100 g/ml oder je gelesener Portion.
    public enum LabelBasis: String, Sendable, CaseIterable {
        case g, ml
        case portionG = "portion-g"
        case portionML = "portion-ml"

        public var unit: String { self == .g || self == .portionG ? "g" : "ml" }
        public var isPortion: Bool { self == .portionG || self == .portionML }
    }

    public static func recipe(_ state: JSONValue, id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return (state["recipes"]?.arrayValue ?? []).first { $0["id"]?.stringValue == id }
    }

    /// Verlaufsrecord des Tages (`goalHistory`/`profileHistory`).
    static func historyRecord(_ state: JSONValue, _ key: String, date: String) -> JSONValue? {
        (state[key]?.arrayValue ?? []).last { $0["date"]?.stringValue == date }
    }

    /// Web `meals` (gespeicherte Datenwerte, auch in Englisch deutsch).
    public static let meals = ["Frühstück", "Mittagessen", "Abendessen", "Snacks"]
    /// Wie das letzte Web-`foodForm()` ohne sichtbare Mahlzeitenwahl (keine erzwungenen Mahlzeitenkategorien).
    public static let defaultMeal = "Frühstück"
    /// `water.add`/`logWater` speichern immer unter `Snacks`.
    public static let waterMeal = "Snacks"
    public static let waterName = "Trinkwasser"
    /// „+ Wasser“ addiert direkt 250 ml (Web `addWaterGlass`).
    public static let glassMl = 250
    /// Höchstens so viele automatische Wiederholungen nach `busy` ohne Web-Sperre (Backoff 1/2/4/8/16 s).
    public static let busyRetryLimit = 5

    /// Felder aus `ack.result.effect` (Web `entryResult`).
    public static let effectKeys = ["grams", "unit", "kcal", "p", "c", "f", "nutrients", "foodRef", "recipeId", "loggedAt"]

    // MARK: Lesen im Profil (exakte Rohwerte)

    public static func foods(_ state: JSONValue) -> [JSONValue] {
        state["foods"]?.arrayValue ?? []
    }

    public static func food(_ state: JSONValue, id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return foods(state).first { $0["id"]?.stringValue == id }
    }

    public static func isComplete(_ state: JSONValue, date: String) -> Bool {
        (state["foodLogCompleted"]?.arrayValue ?? []).contains { $0.stringValue == date }
    }

    /// Web `rawGoal(k)`: `state[k] ?? null`.
    public static func rawGoal(_ state: JSONValue, _ key: String) -> JSONValue {
        guard let value = state[key], !value.isNull else { return .null }
        return value
    }

    /// Erwartung für `microGoals.set`: rohes Objekt (inkl. Erweiterungsfelder) oder `null`. Formulare halten sie beim
    /// Befüllen fest, damit ein inzwischen geänderter Stand zu `conflict` führt statt still überschrieben zu werden.
    public static func microGoalsExpect(_ state: JSONValue) -> JSONValue {
        let raw = rawGoal(state, "microGoals")
        if case .object = raw { return raw }
        return .null
    }

    /// Erwartung für `waterGoal.set`: rohe Zahl oder `null`.
    public static func waterGoalExpect(_ state: JSONValue) -> JSONValue {
        let raw = rawGoal(state, "waterGoal")
        if case .number = raw { return raw }
        return .null
    }

    /// Gespeichertes Produkt zum Verweis (`custom` nach ID bzw. `catalogKey`).
    public static func customProduct(_ state: JSONValue, ref: ProductRef) -> JSONValue? {
        let custom = state["custom"]?.arrayValue ?? []
        switch ref {
        case .id(let id): return custom.first { $0["id"]?.stringValue == id }
        case .catalogKey(let key): return custom.first { $0["catalogKey"]?.stringValue == key }
        case .recipeId, .barcode: return nil
        }
    }

    /// Wert eines Eintragsfelds wie `entryResult`: fehlend = `null`.
    static func normalized(_ value: JSONValue?) -> JSONValue {
        value ?? .null
    }

    /// JS-Wahrheitswert (für `if(food.barcode)`): leere Zeichenkette, 0, false und null sind falsch.
    static func isTruthy(_ value: JSONValue) -> Bool {
        switch value {
        case .null: return false
        case .bool(let flag): return flag
        case .number(let number): return number != 0 && !number.isNaN
        case .string(let text): return !text.isEmpty
        default: return true
        }
    }

    /// `if(food.source) x.source = String(food.source).slice(0,150)`; ohne Quelle im Ziel kein Vergleich (`matchEntry`).
    static func matchesSource(_ stored: JSONValue?, expected: String?) -> Bool {
        guard let expected, !expected.isEmpty else { return true }
        guard let text = stored?.stringValue else { return false }
        if expected.utf16.count <= 150 { return text == expected }
        // Gekürzt: höchstens 150 Einheiten und Anfang der Originalquelle (ein getrenntes Surrogat wird U+FFFD).
        return text.utf16.count <= 150 && (expected.hasPrefix(text) || expected.hasPrefix(String(text.dropLast())))
    }

    /// Alle `effect`-Felder stimmen mit dem gespeicherten Eintrag überein (fehlende optionale Felder als `null`).
    public static func matchesEffect(_ entry: JSONValue, _ effect: JSONValue?) -> Bool {
        guard let effect, case .object = effect else { return false }
        return effectKeys.allSatisfy { normalized(entry[$0]) == normalized(effect[$0]) }
    }

    /// Ziel von `microGoals.set`: im alten Objekt vorhandene, nicht zum Mikroformular gehörende Felder plus positive Ziele.
    /// Formularschlüssel = bekannte Web-Mikros plus alle gesendeten Schlüssel (Native sendet immer das ganze Formular).
    public static func microGoalsTarget(_ args: JSONValue) -> JSONValue? {
        guard let goals = args["goals"]?.objectValue, let expect = args["expect"] else { return nil }
        let formKeys = Set(OverviewProjection.microOrder).union(goals.keys)
        var target: [String: JSONValue] = [:]
        switch expect {
        case .null: break
        case .object(let old):
            for (key, value) in old where !formKeys.contains(key) { target[key] = value }
        default: return nil
        }
        for (key, value) in goals {
            if let number = value.doubleValue, number > 0 { target[key] = value }
        }
        return .object(target)
    }

    /// `water.add`-Zielstand (Web `logWater`).
    public static func waterEntry(id: String, date: String, ml: Double) -> JSONValue {
        [
            "id": .string(id), "date": .string(date), "meal": .string(waterMeal), "name": .string(waterName),
            "grams": .number(ml), "unit": "ml", "kcal": 0, "p": 0, "c": 0, "f": 0, "nutrients": ["water": .number(ml)],
        ]
    }

    /// Kanonische Menge wie Web `quantity`: `amount × factor`, gültig 0,1–10 000 (g bzw. ml). Faktor nur aus `units`.
    public static func canonicalAmount(_ amount: Double, factor: Double) -> Double? {
        guard amount.isFinite, amount >= 0.000001, amount <= 1e10, factor.isFinite, factor > 0 else { return nil }
        let grams = amount * factor
        guard grams.isFinite, grams >= 0.1, grams <= 10_000 else { return nil }
        return grams
    }

    /// Neue persistierte IDs (Eintrag, Katalogprodukt): Web `validData` `[A-Za-z0-9_-]{1,100}`.
    public static func isValidNewID(_ id: String) -> Bool {
        ActivityIDs.isValid(id)
    }

    /// Stabile neue Eintrags-/Produkt-ID.
    public static func makeID() -> String {
        UUID().uuidString.lowercased()
    }
}

// MARK: - Preparer

extension BridgeOps {
    public static let nutritionPreparers: [String: CommandPreparer] = [
        NutritionOps.foodUpdate: prepareFoodEntryExpect,
        NutritionOps.foodDelete: prepareFoodEntryExpect,
        NutritionOps.dayComplete: prepareDayComplete,
        NutritionOps.microGoalsSet: prepareMicroGoals,
        NutritionOps.waterGoalSet: prepareWaterGoal,
    ]

    private static func expectingValue(_ args: JSONValue, _ expect: JSONValue) -> JSONValue {
        var prepared = args
        prepared["expect"] = expect
        return prepared
    }

    /// Ersatz, falls kein Eintrag aus der `entry`-Query mitgegeben wurde: vollständiger Eintrag aus dem Profil.
    /// Fehlt er, bleibt `expect` offen (das Web antwortet `invalid`/noop, nie eine stille Änderung).
    @Sendable
    public static func prepareFoodEntryExpect(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let entry = NutritionOps.food(document.root, id: args["id"]?.stringValue) else { return args }
        return expectingValue(args, entry)
    }

    /// `expect` = bisher gesehener Tagesabschluss (Boolean), nie ein blindes Toggle.
    @Sendable
    public static func prepareDayComplete(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let date = args["date"]?.stringValue else { return args }
        return expectingValue(args, .bool(NutritionOps.isComplete(document.root, date: date)))
    }

    /// `expect` = rohes `microGoals` (inkl. Erweiterungsfelder) oder `null`.
    @Sendable
    public static func prepareMicroGoals(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return expectingValue(args, NutritionOps.microGoalsExpect(document.root))
    }

    /// `expect` = rohes `waterGoal` (Zahl) oder `null`.
    @Sendable
    public static func prepareWaterGoal(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return expectingValue(args, NutritionOps.waterGoalExpect(document.root))
    }
}

// MARK: - Optimistische Reducer

extension BridgeOps {
    public static let nutritionReducers: [String: OptimisticReducer] = [
        NutritionOps.foodDelete: reduceFoodDelete,
        NutritionOps.foodRestore: reduceFoodRestore,
        NutritionOps.waterAdd: reduceWaterAdd,
        NutritionOps.dayComplete: reduceDayComplete,
        NutritionOps.microGoalsSet: reduceMicroGoals,
        NutritionOps.waterGoalSet: reduceWaterGoal,
        NutritionOps.productFavorite: reduceProductFavorite,
    ]

    /// Nur wenn der Eintrag noch exakt der Erwartung entspricht.
    @Sendable
    public static func reduceFoodDelete(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, let expect = args["expect"],
              let list = state["foods"]?.arrayValue,
              let entry = list.first(where: { $0["id"]?.stringValue == id }), entry == expect else { return }
        state["foods"] = .array(list.filter { $0["id"]?.stringValue != id })
    }

    /// Wie `undoDiaryDelete`: alter Rohsnapshot bei `min(index, length)`, nur wenn die ID frei ist.
    @Sendable
    public static func reduceFoodRestore(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let entry = args["entry"], case .object = entry,
              let id = entry["id"]?.stringValue, let index = args["index"]?.intValue, index >= 0 else { return }
        var list = state["foods"]?.arrayValue ?? []
        guard !list.contains(where: { $0["id"]?.stringValue == id }) else { return }
        list.insert(entry, at: min(index, list.count))
        state["foods"] = .array(list)
    }

    @Sendable
    public static func reduceWaterAdd(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, let date = args["date"]?.stringValue,
              let ml = args["ml"]?.doubleValue else { return }
        var list = state["foods"]?.arrayValue ?? []
        guard !list.contains(where: { $0["id"]?.stringValue == id }) else { return }
        list.append(NutritionOps.waterEntry(id: id, date: date, ml: ml))
        state["foods"] = .array(list)
    }

    @Sendable
    public static func reduceDayComplete(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let date = args["date"]?.stringValue, let done = args["done"]?.boolValue,
              let expect = args["expect"]?.boolValue, NutritionOps.isComplete(state, date: date) == expect, expect != done else { return }
        var list = state["foodLogCompleted"]?.arrayValue ?? []
        if done {
            list.append(.string(date))
        } else {
            list.removeAll { $0.stringValue == date }
        }
        state["foodLogCompleted"] = .array(list)
    }

    @Sendable
    public static func reduceMicroGoals(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let target = NutritionOps.microGoalsTarget(args),
              NutritionOps.rawGoal(state, "microGoals") == args["expect"] else { return }
        state["microGoals"] = target
    }

    @Sendable
    public static func reduceWaterGoal(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let ml = args["ml"], ml.intValue != nil,
              NutritionOps.rawGoal(state, "waterGoal") == args["expect"] else { return }
        state["waterGoal"] = ml
    }

    /// Nur für ein bereits gespeichertes eigenes Produkt (`custom`), das exakt der Erwartung entspricht. Eine Basis-
    /// produktkopie legt allein das Web an.
    @Sendable
    public static func reduceProductFavorite(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let ref = ProductRef(json: args["product"]), let favorite = args["favorite"]?.boolValue,
              let expect = args["expect"], var custom = state["custom"]?.arrayValue else { return }
        let matches: (JSONValue) -> Bool = { item in
            switch ref {
            case .id(let id): return item["id"]?.stringValue == id
            case .catalogKey(let key): return item["catalogKey"]?.stringValue == key
            case .recipeId, .barcode: return false
            }
        }
        guard let index = custom.firstIndex(where: matches), custom[index] == expect else { return }
        custom[index]["favorite"] = .bool(favorite)
        state["custom"] = .array(custom)
    }
}

// MARK: - Sichtbare Wirkung (§7, §12.4)

extension BridgeOps {
    public static let nutritionEffectChecks: [String: EffectCheck] = [
        // Ziel-ID mit Datum/Mahlzeit aus args, alle Web-Werte aus `ack.result.effect`, Name aus der Originalquelle.
        NutritionOps.foodAdd: { args, state, result in
            guard let entry = NutritionOps.food(state, id: args["id"]?.stringValue),
                  entry["date"] == args["date"], entry["meal"] == args["meal"],
                  NutritionOps.matchesEffect(entry, result?["effect"]) else { return false }
            guard let ref = ProductRef(json: args["product"]) else { return false }
            let expect = args["expect"]
            // Web `addSnapshot`: Quelle (auf 150 Einheiten gekürzt) und Barcode aus der Originalquelle; ein Rezept trägt keine.
            let source: String?
            let barcode: JSONValue?
            switch ref {
            case .recipeId:
                source = nil
                barcode = nil
            case .catalogKey:
                source = expect?["source"]?.stringValue
                barcode = nil
            case .id, .barcode:
                source = expect?["source"]?.stringValue
                barcode = expect?["barcode"].flatMap { NutritionOps.isTruthy($0) ? $0 : nil }
            }
            // Wie Web `matchEntry`: nur die Felder des Zielsnapshots prüfen (ohne Quelle/Barcode im Ziel kein Vergleich).
            guard NutritionOps.matchesSource(entry["source"], expected: source) else { return false }
            if let barcode, entry["barcode"] != barcode { return false }
            // Katalogzeilen kürzt das Web auf 100 Einheiten; gespeicherte Produkte und Rezepte behalten den Namen.
            if case .catalogKey = ref { return true }
            return entry["name"] == expect?["name"]
        },
        // Vollständiger ursprünglicher Eintrag mit den neuen Web-Werten; Name/Datum/Mahlzeit/Referenzen unverändert.
        NutritionOps.foodUpdate: { args, state, result in
            guard let entry = NutritionOps.food(state, id: args["id"]?.stringValue),
                  let expect = args["expect"]?.objectValue, let effect = result?["effect"],
                  NutritionOps.matchesEffect(entry, effect) else { return false }
            let effectKeys = Set(NutritionOps.effectKeys)
            let stored = entry.objectValue ?? [:]
            for (key, value) in expect where !effectKeys.contains(key) {
                guard stored[key] == value else { return false }
            }
            // Keine zusätzlichen Felder außer den Effect-Feldern.
            return stored.keys.allSatisfy { expect[$0] != nil || effectKeys.contains($0) }
        },
        NutritionOps.foodDelete: { args, state, _ in
            NutritionOps.food(state, id: args["id"]?.stringValue) == nil
        },
        // Vollständiger alter Snapshot unter seiner ID wieder vorhanden (Index ist kein Wirkungsmerkmal).
        NutritionOps.foodRestore: { args, state, _ in
            guard let entry = args["entry"], let id = entry["id"]?.stringValue else { return false }
            return NutritionOps.food(state, id: id) == entry
        },
        NutritionOps.waterAdd: { args, state, result in
            guard let id = args["id"]?.stringValue, let date = args["date"]?.stringValue, let ml = args["ml"]?.doubleValue,
                  let entry = NutritionOps.food(state, id: id) else { return false }
            guard entry["date"]?.stringValue == date, entry["meal"]?.stringValue == NutritionOps.waterMeal,
                  entry["name"]?.stringValue == NutritionOps.waterName,
                  entry["grams"]?.doubleValue == ml, entry["unit"]?.stringValue == "ml",
                  ["kcal", "p", "c", "f"].allSatisfy({ entry[$0]?.doubleValue == 0 }),
                  entry["nutrients"]?["water"]?.doubleValue == ml else { return false }
            if let effect = result?["effect"] { return NutritionOps.matchesEffect(entry, effect) }
            return true
        },
        NutritionOps.dayComplete: { args, state, _ in
            guard let date = args["date"]?.stringValue, let done = args["done"]?.boolValue else { return false }
            return NutritionOps.isComplete(state, date: date) == done
        },
        NutritionOps.microGoalsSet: { args, state, _ in
            guard let target = NutritionOps.microGoalsTarget(args) else { return false }
            return NutritionOps.rawGoal(state, "microGoals") == target
        },
        NutritionOps.waterGoalSet: { args, state, _ in
            guard let ml = args["ml"]?.doubleValue else { return false }
            return state["waterGoal"]?.doubleValue == ml
        },
        // P2: exakt das vom Web gespeicherte Produkt (`result.product`) unter `result.productId`.
        NutritionOps.productSave: productEffect,
        NutritionOps.productExtrasSet: productEffect,
        NutritionOps.portionSave: productEffect,
        NutritionOps.portionDelete: productEffect,
        NutritionOps.recipeSave: recipeEffect,
        NutritionOps.recipeCopy: recipeEffect,
        NutritionOps.recipeImportSave: recipeEffect,
        NutritionOps.recipeDelete: { args, state, _ in
            NutritionOps.recipe(state, id: args["id"]?.stringValue) == nil
        },
        // Endgültiger Zielkontext nach Web-Neuberechnung: Profil, Plan, Ziele, Kalibrierung und die Records des Tages.
        // M8: exakt wie Web `goals.set.effective` (erster Verlaufseintrag des Tages, fehlender Record = `null`).
        NutritionOps.goalsSet: { _, state, result in AccountOps.plannerEffectIsVisible(state, result) },
        // Web `!!custom.find(ref)?.favorite === favorite` (fehlendes eigenes Produkt zählt als `false`).
        NutritionOps.productFavorite: { args, state, _ in
            guard let ref = ProductRef(json: args["product"]), let favorite = args["favorite"]?.boolValue else { return false }
            let current = NutritionOps.customProduct(state, ref: ref)?["favorite"]?.boolValue == true
            return current == favorite
        },
    ]
}

// MARK: - P2-Wirkungen

extension BridgeOps {
    @Sendable
    static func productEffect(_ args: JSONValue, _ state: JSONValue, _ result: JSONValue?) -> Bool {
        guard let id = result?["productId"]?.stringValue, let product = result?["product"], case .object = product else { return false }
        return (state["custom"]?.arrayValue ?? []).first { $0["id"]?.stringValue == id } == product
    }

    @Sendable
    static func recipeEffect(_ args: JSONValue, _ state: JSONValue, _ result: JSONValue?) -> Bool {
        guard let id = result?["recipeId"]?.stringValue, let recipe = result?["recipe"], case .object = recipe else { return false }
        return NutritionOps.recipe(state, id: id) == recipe
    }
}

// MARK: - Befehle

/// Befehle der nativen Ernährungsoberfläche. `nil` = das Web würde `invalid` antworten (Grenzen aus §12.4 nativ geprüft).
public enum NutritionCommands {
    /// Eintrag aus einem Produkt/Rezept der `product`-Query. `expect` = deren vollständige Quelle. Für eine neue
    /// Katalogzeile ist `productId` Pflicht (stabil, sonst Replay-Duplikate).
    public static func add(entryId: String, detail: NutritionProductDetail, amount: Double, unit: NutritionUnit,
                           meal: String = NutritionOps.defaultMeal, date: String, productId: String? = nil,
                           includePortionSnapshot: Bool = false) -> Command? {
        guard detail.canAdd, let expect = detail.expect, NutritionOps.isValidNewID(entryId), WeightDay.isValid(date),
              NutritionOps.meals.contains(meal), detail.units.contains(unit),
              NutritionOps.canonicalAmount(amount, factor: unit.factor) != nil else { return nil }
        var args: JSONValue = [
            "id": .string(entryId), "product": detail.product.ref.json, "amount": .number(amount), "unit": .string(unit.key),
            "meal": .string(meal), "date": .string(date), "expect": expect,
        ]
        if detail.newCatalogProduct {
            guard let productId, NutritionOps.isValidNewID(productId) else { return nil }
            args["productId"] = .string(productId)
        }
        // P2: belegte Quellportion unverändert mitsenden (Lost-History-Replay ohne geladenen Portionskatalog).
        if includePortionSnapshot, let snapshot = unit.snapshot { args["portion"] = snapshot }
        return Command(op: NutritionOps.foodAdd, args: args)
    }

    /// Werte eines Produkts je 100 g/ml (bzw. bei `label` je gelesener Bezugsportion). Leere Werte sind ungültig, nie 0.
    public struct ProductValues: Equatable, Sendable {
        public var name: String
        public var unit: String
        public var kcal: Double
        public var p: Double
        public var c: Double
        public var f: Double
        public var brand: String?
        public var barcode: String?
        public var packageAmount: Double?
        public var fiber: Double?

        public init(name: String, unit: String, kcal: Double, p: Double, c: Double, f: Double, brand: String? = nil,
                    barcode: String? = nil, packageAmount: Double? = nil, fiber: Double? = nil) {
            self.name = name
            self.unit = unit
            self.kcal = kcal
            self.p = p
            self.c = c
            self.f = f
            self.brand = brand
            self.barcode = barcode
            self.packageAmount = packageAmount
            self.fiber = fiber
        }

        func json(id: String) -> JSONValue {
            var object: [String: JSONValue] = [
                "id": .string(id), "name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines)), "unit": .string(unit),
                "kcal": .number(kcal), "p": .number(p), "c": .number(c), "f": .number(f),
            ]
            if let brand, !brand.trimmingCharacters(in: .whitespaces).isEmpty { object["brand"] = .string(brand) }
            if let barcode { object["barcode"] = .string(barcode) }
            if let packageAmount { object["packageAmount"] = .number(packageAmount) }
            if let fiber { object["fiber"] = .number(fiber) }
            return .object(object)
        }
    }

    /// `product.save` (P2). `custom`/`review`: Werte je 100, kcal 0–1000, P/C/F 0–100. `review` braucht einen Barcode und
    /// bei neuem OFF-Produkt den `draft` der Produktquery. `label`: Werte der gewählten Bezugsportion, Bestätigung Pflicht.
    /// `expect` = vollständiges Rohprodukt der Query oder `null` (neu). Warnungen nur mit `confirmWarnings`.
    public static func saveProduct(kind: NutritionOps.SaveKind, id: String, values: ProductValues, expect: JSONValue?,
                                   draft: JSONValue? = nil, label: (basis: NutritionOps.LabelBasis, amount: Double, column: Int)? = nil,
                                   confirmWarnings: Bool) -> Command? {
        let name = values.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard NutritionOps.isValidNewID(id), (1...100).contains(name.count), ["g", "ml"].contains(values.unit) else { return nil }
        let numbers = [values.kcal, values.p, values.c, values.f]
        guard numbers.allSatisfy({ $0.isFinite && $0 >= 0 }) else { return nil }
        if let brand = values.brand { guard brand.count <= 100 else { return nil } }
        var args: JSONValue = [
            "kind": .string(kind.rawValue), "product": values.json(id: id), "expect": expect ?? .null,
            "confirmWarnings": .bool(confirmWarnings),
        ]
        switch kind {
        case .custom, .review:
            guard values.kcal <= 1000, values.p <= 100, values.c <= 100, values.f <= 100 else { return nil }
            if let amount = values.packageAmount { guard amount >= 0.1, amount <= 10_000 else { return nil } }
            if kind == .review {
                guard let barcode = values.barcode, !barcode.isEmpty, barcode.count <= 40 else { return nil }
                if let draft, case .object = draft { args["draft"] = draft }
            } else {
                guard values.barcode == nil else { return nil }
            }
        case .label:
            guard let label, expect == nil || expect?.isNull == true, values.unit == label.basis.unit, (0...2).contains(label.column) else {
                return nil
            }
            let amount = label.basis.isPortion ? label.amount : 100
            guard amount >= 0.1, amount <= 10_000 else { return nil }
            if let fiber = values.fiber { guard fiber.isFinite, fiber >= 0 else { return nil } }
            args["label"] = [
                "basis": .string(label.basis.rawValue), "amount": .number(amount), "column": .number(Double(label.column)),
                "confirmed": true,
            ]
        }
        return Command(op: NutritionOps.productSave, args: args)
    }

    /// Menge in kanonischer Basis (`g`/`ml` des Eintrags): das Tagebuch hat keine eigene Dichte, kein g↔ml.
    public static func update(detail: NutritionEntryDetail, amount: Double) -> Command? {
        guard amount.isFinite, amount >= 0.1, amount <= 10_000 else { return nil }
        return Command(op: NutritionOps.foodUpdate, args: [
            "id": .string(detail.id), "amount": .number(amount), "unit": .string(detail.base), "expect": detail.entry,
        ])
    }

    /// Nur mit wiederherstellbarem Snapshot (`canRestore`), sonst im Web löschen.
    public static func delete(detail: NutritionEntryDetail) -> Command? {
        guard detail.canRestore else { return nil }
        return Command(op: NutritionOps.foodDelete, args: ["id": .string(detail.id), "expect": detail.entry])
    }

    /// Natives Undo: unveränderter alter Snapshot an seinem alten Index.
    public static func restore(detail: NutritionEntryDetail) -> Command? {
        guard detail.canRestore, (0...1_000_000).contains(detail.index) else { return nil }
        return Command(op: NutritionOps.foodRestore, args: [
            "entry": detail.entry, "index": .number(Double(detail.index)), "expect": .null,
        ])
    }

    public static func water(id: String, date: String, ml: Int = NutritionOps.glassMl) -> Command? {
        guard NutritionOps.isValidNewID(id), WeightDay.isValid(date), (1...10_000).contains(ml) else { return nil }
        return Command(op: NutritionOps.waterAdd, args: [
            "id": .string(id), "date": .string(date), "ml": .number(Double(ml)), "expect": .null,
        ])
    }

    /// Expliziter Zielwert; `expect` ergänzt der Store aus dem Profil.
    public static func completeDay(date: String, done: Bool) -> Command? {
        guard WeightDay.isValid(date) else { return nil }
        return Command(op: NutritionOps.dayComplete, args: ["date": .string(date), "done": .bool(done)])
    }

    /// Ganzes Formular: jeder bekannte Schlüssel 0–1 000 000, `0` entfernt dessen Ziel.
    public static func microGoals(_ goals: [String: Double], expect: JSONValue? = nil) -> Command? {
        guard !goals.isEmpty, goals.allSatisfy({ !$0.key.isEmpty && $0.value.isFinite && $0.value >= 0 && $0.value <= 1_000_000 }) else {
            return nil
        }
        var args: JSONValue = ["goals": .object(goals.mapValues { JSONValue.number($0) })]
        if let expect { args["expect"] = expect }
        return Command(op: NutritionOps.microGoalsSet, args: args)
    }

    /// `0` = kein Ziel.
    public static func waterGoal(ml: Int, expect: JSONValue? = nil) -> Command? {
        guard (0...10_000).contains(ml) else { return nil }
        var args: JSONValue = ["ml": .number(Double(ml))]
        if let expect { args["expect"] = expect }
        return Command(op: NutritionOps.waterGoalSet, args: args)
    }

    /// Nur gespeicherte bzw. Basis-Produkte (keine neue Katalogzeile, kein Rezept).
    public static func favorite(detail: NutritionProductDetail, favorite: Bool) -> Command? {
        guard detail.canFavorite, let expect = detail.expect else { return nil }
        return Command(op: NutritionOps.productFavorite, args: [
            "product": detail.product.ref.json, "favorite": .bool(favorite), "expect": expect,
        ])
    }

    // MARK: P2 Portionen, Produktzusätze, Rezepte (§12.5)

    /// Roh-Args von Produkt-Ops höchstens 24 Ki, `recipe.copy` höchstens 48 Ki (das Web prüft dieselbe Grenze).
    private static func fits(_ args: JSONValue, limit: Int) -> Bool {
        AccountOps.serializedLength(args) <= limit
    }

    /// `portion.save`: gewogene/belegte Menge in der Basiseinheit des Produkts; gleiche Bezeichnung ersetzt das Web.
    public static func savePortion(detail: NutritionProductDetail, name: String, amount: Double) -> Command? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard detail.canManage, let expect = detail.expect, (1...80).contains(trimmed.utf16.count),
              amount.isFinite, amount >= 0.1, amount <= 10_000 else { return nil }
        let args: JSONValue = [
            "product": detail.product.ref.json, "name": .string(trimmed), "amount": .number(amount), "expect": expect,
        ]
        return fits(args, limit: 24 * 1024) ? Command(op: NutritionOps.portionSave, args: args) : nil
    }

    /// `portion.delete`: nur diese Bezeichnung; übrige Produktfelder und Tagebucheinträge bleiben.
    public static func deletePortion(detail: NutritionProductDetail, name: String) -> Command? {
        guard detail.canManage, let expect = detail.expect, !name.isEmpty else { return nil }
        let args: JSONValue = ["product": detail.product.ref.json, "name": .string(name), "expect": expect]
        return fits(args, limit: 24 * 1024) ? Command(op: NutritionOps.portionDelete, args: args) : nil
    }

    /// Änderung eines Produktzusatzes: `keep` sendet das Feld nicht, `remove` sendet `null`.
    public enum ExtraChange: Equatable, Sendable {
        case keep
        case remove
        case set(Double)

        var json: JSONValue? {
            switch self {
            case .keep: return nil
            case .remove: return JSONValue.null
            case .set(let value): return JSONValue.number(value)
            }
        }
    }

    /// `product.extras.set`: Dichte 0,01–20 g/ml, Wasseranteil 0–100 nur bei ml-Produkten, mindestens ein Feld.
    public static func extras(detail: NutritionProductDetail, density: ExtraChange = .keep, water: ExtraChange = .keep) -> Command? {
        guard detail.canManage, let expect = detail.expect, density != .keep || water != .keep else { return nil }
        if case .set(let value) = density { guard value.isFinite, value >= 0.01, value <= 20 else { return nil } }
        if case .set(let value) = water { guard value.isFinite, value >= 0, value <= 100 else { return nil } }
        if water != .keep { guard detail.base == "ml" else { return nil } }
        var args: JSONValue = ["product": detail.product.ref.json, "expect": expect]
        if let value = density.json { args["density"] = value }
        if let value = water.json { args["water"] = value }
        return fits(args, limit: 24 * 1024) ? Command(op: NutritionOps.productExtrasSet, args: args) : nil
    }

    /// `recipe.copy`: neue stabile ID, `expect` = Rohrezept der `recipe`-Query. Den Standardnamen setzt das Web.
    public static func copyRecipe(_ recipe: NutritionRecipeDetail, newId: String) -> Command? {
        guard let sourceId = recipe.recipe["id"]?.stringValue, NutritionOps.isValidNewID(sourceId),
              NutritionOps.isValidNewID(newId), newId != sourceId else { return nil }
        let args: JSONValue = ["id": .string(newId), "sourceId": .string(sourceId), "expect": recipe.recipe]
        return fits(args, limit: 48 * 1024) ? Command(op: NutritionOps.recipeCopy, args: args) : nil
    }

    /// `recipe.delete`: die native Bestätigung gilt als Bestätigung des Web-Dialogs; Tagebucheinträge bleiben.
    public static func deleteRecipe(_ recipe: NutritionRecipeDetail) -> Command? {
        guard let id = recipe.recipe["id"]?.stringValue, NutritionOps.isValidNewID(id) else { return nil }
        return Command(op: NutritionOps.recipeDelete, args: ["id": .string(id), "expect": recipe.recipe])
    }
}
