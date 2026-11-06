import Foundation

/// Eine Zutat im Rezeptentwurf. `raw` hält alle Felder der Quelle, damit unbekannte Felder erhalten bleiben; geändert wird nur
/// die Menge. Nährwerte sind der Snapshot je 100 g/ml, unabhängig von späteren Produktänderungen.
public struct RecipeIngredient: Equatable, Sendable, Identifiable {
    public let id: UUID
    var raw: JSONValue
    /// `nil` = noch nicht eingegeben (z. B. Importzeile ohne erkannte Menge); nie erfunden.
    public var amount: Double?

    public init(raw: JSONValue, amount: Double?) {
        id = UUID()
        self.raw = raw
        self.amount = amount
    }

    /// Wie `recipePickIngredient`. `nil` bei unvollständigen, ungeprüften oder im Bezug unbekannten Produkten. `amountUnit` ist
    /// die Einheit einer erkannten Menge: Passt sie nicht zum Produkt, bleibt die Menge leer (200 ml sind ohne Dichte keine 200 g).
    public init?(product: NutritionProduct, amount: Double?, amountUnit: String? = nil) {
        guard product.complete, product.unitKnown, !product.reviewRequired,
              let kcal = product.kcal, let p = product.p, let c = product.c, let f = product.f else { return nil }
        var object: [String: JSONValue] = [
            "name": .string(String(decoding: Array(product.name.utf16.prefix(100)), as: UTF16.self)), "unit": .string(product.unit),
            "kcal": .number(kcal), "p": .number(p), "c": .number(c), "f": .number(f),
        ]
        if !product.source.isEmpty { object["source"] = .string(product.source) }
        self.init(raw: .object(object), amount: amountUnit == nil || amountUnit == product.unit ? amount : nil)
    }

    /// Eigene Etikettwerte wie `recipeAddOwn`. `nil` außerhalb der Web-Grenzen; leere Werte gibt es hier nicht.
    public init?(name: String, unit: String, amount: Double, kcal: Double, p: Double, c: Double, f: Double) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (1...100).contains(trimmed.utf16.count), ["g", "ml"].contains(unit),
              [kcal, p, c, f].allSatisfy({ $0.isFinite && $0 >= 0 }), kcal <= 1000, p <= 100, c <= 100, f <= 100 else { return nil }
        self.init(raw: .object([
            "name": .string(trimmed), "unit": .string(unit), "kcal": .number(kcal), "p": .number(p), "c": .number(c), "f": .number(f),
        ]), amount: amount)
    }

    public var name: String { raw["name"]?.stringValue ?? "" }
    public var unit: String { raw["unit"]?.stringValue ?? "" }
    public var kcal: Double? { raw["kcal"]?.doubleValue }

    var isComplete: Bool {
        guard let amount, amount >= 0.1, amount <= 100_000, ["g", "ml"].contains(unit),
              !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, name.utf16.count <= 100,
              let kcal, kcal >= 0, kcal <= 1000 else { return false }
        return ["p", "c", "f"].allSatisfy { key in
            guard let value = raw[key]?.doubleValue else { return false }
            return value >= 0 && value <= 100
        }
    }

    var json: JSONValue {
        var object = raw
        if let amount { object["amount"] = .number(amount) }
        return object
    }

    /// Form der `recipePreview`-Query: fehlende Menge = 0 (zählt nicht mit, das Web meldet den Entwurf als ungültig). Fehlende
    /// oder außerhalb der Grenzen liegende Nährwerte werden nicht ergänzt, dann gibt es keine Vorschau.
    var previewJSON: JSONValue? {
        let amount = self.amount ?? 0
        guard amount.isFinite, amount >= 0, amount <= 100_000, ["g", "ml"].contains(unit), raw["name"]?.stringValue != nil, name.utf16.count <= 100,
              let kcal, kcal.isFinite, kcal >= 0, kcal <= 1000 else { return nil }
        for key in ["p", "c", "f"] {
            guard let value = raw[key]?.doubleValue, value.isFinite, value >= 0, value <= 100 else { return nil }
        }
        var object = raw
        object["amount"] = .number(amount)
        return object
    }
}

/// Zahlenfeld eines Formulars: Solange der angezeigte Text unverändert ist, gilt der Ausgangswert in voller Genauigkeit. Die
/// Anzeige rundet (1.23456 steht als 1,235 im Feld); bloßes Umbenennen darf gespeicherte Zahlen nicht verändern.
public struct RecipeNumberField: Equatable, Sendable {
    public let original: Double?
    public let shown: String
    public var text: String

    public init(original: Double?, shown: String) {
        self.original = original
        self.shown = shown
        text = shown
    }

    public func value(parse: (String) -> Double?) -> Double? {
        text == shown ? original : parse(text)
    }
}

/// Ergebnis der `recipePreview`-Query (§12.5). Nur die fertig formatierten Web-Texte, keine eigene Rechnung.
public struct RecipePreview: Equatable, Sendable {
    public struct Values: Equatable, Sendable {
        public var kcal: String
        public var p: String
        public var c: String
        public var f: String

        init?(_ json: JSONValue?) {
            guard let json, let kcal = json["kcal"]?.stringValue, let p = json["p"]?.stringValue,
                  let c = json["c"]?.stringValue, let f = json["f"]?.stringValue else { return nil }
            self.kcal = kcal
            self.p = p
            self.c = c
            self.f = f
        }
    }

    public var totals: Values
    /// `nil` ohne Gesamtgewicht.
    public var per100: Values?
    /// `validRecipe` des Webs nach derselben Namens-Trimmung wie beim Speichern.
    public var isValid: Bool
    public var message: String?

    public init?(json: JSONValue) {
        guard let display = json["display"], let totals = Values(display["totals"]),
              let isValid = json["validation"]?["valid"]?.boolValue else { return nil }
        self.totals = totals
        if let raw = display["per100"], !raw.isNull {
            guard let values = Values(raw) else { return nil }
            per100 = values
        } else {
            per100 = nil
        }
        self.isValid = isValid
        message = json["validation"]?["message"]?.stringValue
    }
}

/// Entwurf für `recipe.save`/`recipe.import.save`. Prüft nur die Formgrenzen von `validRecipe`; Summen, je-100-Werte und die
/// inhaltliche Prüfung liefert allein das Web (Query `recipePreview`, verbindlich beim Speichern).
public struct RecipeDraft: Equatable, Sendable {
    public var id: String
    public var name: String
    public var yieldGrams: Double?
    public var ingredients: [RecipeIngredient]
    /// Beim Öffnen gesehenes Rohrezept (Erwartung, unbekannte Felder); `nil` = neu.
    public let expect: JSONValue?

    public init(id: String, name: String = "") {
        self.id = id
        self.name = name
        yieldGrams = nil
        ingredients = []
        expect = nil
    }

    public init(recipe: NutritionRecipeDetail) {
        id = recipe.recipe["id"]?.stringValue ?? ""
        name = recipe.name
        yieldGrams = recipe.yield
        ingredients = (recipe.recipe["ingredients"]?.arrayValue ?? []).map { RecipeIngredient(raw: $0, amount: $0["amount"]?.doubleValue) }
        expect = recipe.recipe
    }

    public var isComplete: Bool {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard NutritionOps.isValidNewID(id), (1...100).contains(trimmed.utf16.count), let yieldGrams, yieldGrams >= 1, yieldGrams <= 100_000,
              (1...100).contains(ingredients.count) else { return false }
        return ingredients.allSatisfy(\.isComplete)
    }

    /// Unbekannte Wurzelfelder des Rohrezepts bleiben erhalten.
    var json: JSONValue {
        var object = expect ?? .object([:])
        object["id"] = .string(id)
        object["name"] = .string(name.trimmingCharacters(in: .whitespacesAndNewlines))
        if let yieldGrams { object["yield"] = .number(yieldGrams) }
        object["ingredients"] = .array(ingredients.map(\.json))
        return object
    }

    /// Entwurf für die `recipePreview`-Query; darf unvollständig sein (leerer Name, keine Zutat, Gewicht 0). `nil` außerhalb der
    /// Transportgrenzen, dann lehnt das Web die Anfrage ohne Antwort ab und es gibt keine Vorschau.
    public var previewJSON: JSONValue? {
        let weight = yieldGrams ?? 0
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard NutritionOps.isValidNewID(id), trimmed.utf16.count <= 100, weight.isFinite, weight >= 0, weight <= 100_000,
              ingredients.count <= 100 else { return nil }
        var rows: [JSONValue] = []
        for ingredient in ingredients {
            guard let row = ingredient.previewJSON else { return nil }
            rows.append(row)
        }
        var object = expect ?? .object([:])
        object["id"] = .string(id)
        object["name"] = .string(trimmed)
        object["yield"] = .number(weight)
        object["ingredients"] = .array(rows)
        return AccountOps.serializedLength(object) <= 48 * 1024 ? object : nil
    }
}

extension NutritionCommands {
    /// `recipe.save`: `expect` = beim Öffnen gesehenes Rohrezept oder `null`. Roh-Args höchstens 48 Ki (§12.5).
    public static func saveRecipe(_ draft: RecipeDraft) -> Command? {
        guard draft.isComplete else { return nil }
        let args: JSONValue = ["recipe": draft.json, "expect": draft.expect ?? .null]
        guard AccountOps.serializedLength(args) <= 48 * 1024 else { return nil }
        return Command(op: NutritionOps.recipeSave, args: args)
    }

    /// `recipe.import.save`: nur nach ausdrücklicher Bestätigung der Zutaten und Mengen.
    public static func saveImportedRecipe(_ draft: RecipeDraft, source: NutritionRecipeImport, confirmed: Bool) -> Command? {
        guard confirmed, draft.isComplete, draft.expect == nil, source.lines.count <= 100,
              source.lines.allSatisfy({ $0.utf16.count <= 1000 }) else { return nil }
        let args: JSONValue = [
            "recipe": draft.json, "expect": .null, "confirmIngredients": true,
            "preview": ["name": .string(source.name), "lines": .array(source.lines.map(JSONValue.string))],
        ]
        guard AccountOps.serializedLength(args) <= 48 * 1024 else { return nil }
        return Command(op: NutritionOps.recipeImportSave, args: args)
    }
}
