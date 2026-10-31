import Foundation

// M7: `projection{name:"nutrition"}`, `nutritionResult` und `hello.nutrition` aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §12.
//
// Umschlag streng (`projectionSeq`, `ownerPending`, `nutrition` bzw. `requestId`/`kind`/`ok` Pflicht), Inhalt nachsichtig:
// fehlend oder falscher Typ = unbekannt (`nil`), nie erfundene Nullen. Ein bekannter Nullwert bleibt `0`, ein unbekannter
// Mikronährstoff bleibt `nil` (`known == 0`). `raw` erhält jede Nachricht verlustfrei. Native rechnet keine Nährwerte:
// Summen, Ziele, Mikro-Abdeckung, Wasser (inkl. reiner Anzeigeschätzung) und Einheitenfaktoren kommen aus dem Web.

// MARK: - Hello-Fähigkeiten

/// `hello.nutrition = {stage, queries}`. `stage:'P1'` ist ausdrücklich keine Zusage der vollständigen M7-Parität (§12.1).
public struct NutritionCapabilities: Equatable, Hashable, Sendable {
    public var stage: String
    public var queries: [String]

    public init(stage: String, queries: [String]) {
        self.stage = stage
        self.queries = queries
    }

    /// `nil` ohne Objekt bzw. ohne `stage` (älterer Web-Stand): dann kein nativer Ernährungsbereich.
    init?(json: JSONValue?) {
        guard let json, case .object = json else { return nil }
        let o = Loose(json)
        guard let stage = o.string("stage"), !stage.isEmpty else { return nil }
        self.stage = stage
        queries = o.array("queries").compactMap(\.stringValue)
    }

    public var json: JSONValue {
        .object(["stage": .string(stage), "queries": .array(queries.map(JSONValue.string))])
    }

    /// `P1` → 1, `P2` → 2; unbekannte Form → `nil`.
    public var stageNumber: Int? {
        guard stage.hasPrefix("P") else { return nil }
        return Int(stage.dropFirst())
    }

    /// Paket P2 (OFF, Barcode, Produkt-/Etikett-/Rezeptspeicherung, Import) ist gemeldet.
    public var isAtLeastP2: Bool { (stageNumber ?? 0) >= 2 }

    public func supports(_ kind: NutritionQueryRequest.Kind) -> Bool {
        queries.contains(kind.rawValue)
    }

    public func supports(query name: String) -> Bool {
        queries.contains(name)
    }
}

// MARK: - Projektion

public struct NutritionProjectionMessage: Equatable, Sendable {
    public static let nutritionName = "nutrition"

    public var projectionSeq: Int
    /// Profilsnapshot-Nummer beim Versand (nur Kontext; darf hinter dem Snapshot liegen).
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var reason: String
    public var nutrition: NutritionProjection
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.nonEmptyString("name") == Self.nutritionName else { throw BridgeDecodingError.invalidField("name") }
        projectionSeq = try fields.int("projectionSeq")
        guard projectionSeq >= 0 else { throw BridgeDecodingError.invalidField("projectionSeq") }
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        reason = try fields.optionalString("reason") ?? "unknown"
        guard let nutrition = fields["nutrition"] else { throw BridgeDecodingError.missingField("nutrition") }
        self.nutrition = try NutritionProjection(json: nutrition)
        raw = json
    }

    public var json: JSONValue { raw }
}

extension NutritionProjectionMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

public struct NutritionProjection: Equatable, Sendable {
    public var stage: String?
    /// Ausgewählter Web-Tag (folgt `pulsNativeSetDate`).
    public var date: String
    public var today: String?
    public var language: String
    public var locale: String?
    public var goals: NutritionGoals
    /// `totals()`: gespeicherte Tagebuchwerte, ungerundet.
    public var totals: MacroValues
    /// Reihenfolge wie `OverviewProjection.microOrder`, unbekannte Schlüssel danach alphabetisch.
    public var micros: [NutritionMicro]
    public var water: NutritionWater?
    public var foodLogCompleted: Bool
    /// Letzte höchstens 200 Einträge des Tages, neueste zuerst.
    public var entries: [NutritionEntry]
    /// Vollständige Anzahl dieses Tages (auch bei Kürzung).
    public var entryCount: Int
    public var favorites: [NutritionProduct]
    public var recent: [NutritionProduct]
    public var recipes: [NutritionRecipeRow]
    public var settings: NutritionSettings
    public var omitted: NutritionOmitted
    /// Vollständiger Web-Ausweg `{page:'food', web:true}`.
    public var navigation: NavigationTarget?
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        guard case .object = json else { throw BridgeDecodingError.invalidField("nutrition") }
        let o = Loose(json)
        guard let date = o.string("date"), WeightDay.isValid(date) else { throw BridgeDecodingError.invalidField("nutrition.date") }
        self.date = date
        stage = o.string("stage")
        today = o.string("today").flatMap { WeightDay.isValid($0) ? $0 : nil }
        language = o.string("language") == "en" ? "en" : "de"
        locale = o.string("locale")
        goals = NutritionGoals(o.object("goals"))
        totals = o.object("totals").map { MacroValues($0) } ?? MacroValues()
        var micros: [NutritionMicro] = []
        if let object = o.object("micros") {
            let known = OverviewProjection.microOrder.filter { object.values[$0] != nil }
            let extra = object.values.keys.filter { !OverviewProjection.microOrder.contains($0) }.sorted()
            for key in known + extra {
                if let micro = object.object(key) { micros.append(NutritionMicro(key: key, micro)) }
            }
        }
        self.micros = micros
        water = o.object("water").map(NutritionWater.init)
        foodLogCompleted = o.bool("foodLogCompleted") ?? false
        entries = o.array("entries").compactMap { NutritionEntry(Loose($0)) }
        entryCount = max(o.int("entryCount") ?? entries.count, entries.count)
        favorites = o.array("favorites").compactMap { NutritionProduct(json: $0) }
        recent = o.array("recent").compactMap { NutritionProduct(json: $0) }
        recipes = o.array("recipes").compactMap { NutritionRecipeRow(Loose($0)) }
        settings = NutritionSettings(o.object("settings"))
        omitted = NutritionOmitted(o.object("omitted"))
        navigation = o.values["navigation"].flatMap { NavigationTarget(json: $0) }
        raw = json
    }

    public var isToday: Bool { today == nil || today == date }

    public func micro(_ key: String) -> NutritionMicro? {
        micros.first { $0.key == key }
    }

    /// Bekannte Mikro-Schlüssel des Webs (`nutrientLabels`) für das Zielformular.
    public var microKeys: [String] { micros.map(\.key) }
}

/// `{values:{kcal,p,c,f}, mode, macroMode}` aus `dayGoals(date)`; Planberechnung ausschließlich Web.
public struct NutritionGoals: Equatable, Sendable {
    public var values: MacroValues
    public var mode: String?
    public var macroMode: String?

    init(_ o: Loose?) {
        values = o?.object("values").map { MacroValues($0) } ?? MacroValues()
        mode = o?.string("mode")
        macroMode = o?.string("macroMode")
    }
}

/// Ein Mikronährstoff des Tages: `value` nur bei bekannten Werten (`known > 0`), bekannte `0` bleibt `0`.
public struct NutritionMicro: Equatable, Sendable, Identifiable {
    public var key: String
    /// Übersetzter Web-Name (`nutrientLabels`).
    public var label: String?
    public var unit: String?
    public var value: Double?
    public var known: Int
    public var total: Int
    public var target: Double?
    /// `custom | reference | nil`.
    public var targetSource: String?

    public var id: String { key }

    init(key: String, _ o: Loose) {
        self.key = key
        label = o.string("label")
        unit = o.string("unit")
        known = o.int("known") ?? 0
        total = o.int("total") ?? 0
        value = known > 0 ? o.number("value") : nil
        target = o.number("target")
        targetSource = o.string("targetSource")
    }

    public var knowledge: Knowledge { Knowledge(known: known, total: total, hasValue: value != nil) }
}

/// Wasser in ml aus dem zuletzt wirksamen `nutrientTotals`. `estimated` ist reine Anzeige (§12.2), nie gespeichert.
public struct NutritionWater: Equatable, Sendable {
    public var value: Double?
    public var displayValue: Double?
    public var known: Int
    public var total: Int
    public var estimated: Double
    public var unknownDrinks: Int
    public var target: Double?
    public var estimatedDisplayOnly: Bool

    init(_ o: Loose) {
        known = o.int("known") ?? 0
        total = o.int("total") ?? 0
        value = o.number("value")
        displayValue = o.number("displayValue")
        estimated = o.number("estimated") ?? 0
        unknownDrinks = o.int("unknownDrinks") ?? 0
        target = o.number("target")
        estimatedDisplayOnly = o.bool("estimatedDisplayOnly") ?? true
    }

    public var knowledge: Knowledge { Knowledge(known: known, total: total, hasValue: value != nil) }
}

/// Kompakte Tagebuchzeile in Snapshot-Form (§12.2). Nährwerte exakt gespeichert, fehlende fehlen.
public struct NutritionEntry: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var date: String?
    /// Gespeicherter Datenwert (z. B. `Snacks`), keine erzwungene Gruppierung.
    public var meal: String?
    /// Gespeicherte `grams` in kanonischer Einheit.
    public var amount: Double?
    /// `g` oder `ml`.
    public var unit: String
    public var kcal: Double?
    public var p: Double?
    public var c: Double?
    public var f: Double?
    public var nutrients: [String: Double]
    public var foodRef: String?
    public var recipeId: String?
    public var source: String

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        date = o.string("date")
        meal = o.string("meal")
        amount = o.number("amount")
        unit = o.string("unit") == "ml" ? "ml" : "g"
        kcal = o.number("kcal")
        p = o.number("p")
        c = o.number("c")
        f = o.number("f")
        var nutrients: [String: Double] = [:]
        for (key, value) in o.object("nutrients")?.values ?? [:] {
            if let number = value.doubleValue, number.isFinite { nutrients[key] = number }
        }
        self.nutrients = nutrients
        foodRef = o.string("foodRef")
        recipeId = o.string("recipeId")
        source = o.string("source") ?? ""
    }

    /// Ein reiner Wassereintrag (`logWater`/`water.add`).
    public var isWater: Bool { unit == "ml" && kcal == 0 && nutrients["water"] != nil && nutrients.count == 1 }
}

/// `ref` ist genau eines von `{id}`, `{catalogKey}` oder `{recipeId}`; IDs werden nie umgeschrieben.
public enum ProductRef: Equatable, Hashable, Sendable {
    case id(String)
    case catalogKey(String)
    case recipeId(String)
    /// P2-Vorbereitung: Barcode-Treffer (OFF/Entwurf); nie direkte `food.add`-Quelle.
    case barcode(String)

    public init?(json: JSONValue?) {
        guard let object = json?.objectValue, object.count == 1, let first = object.first,
              let text = first.value.stringValue, ProductRef.isValidReference(text) else { return nil }
        switch first.key {
        case "id": self = .id(text)
        case "catalogKey": self = .catalogKey(text)
        case "recipeId": self = .recipeId(text)
        case "barcode": self = .barcode(text)
        default: return nil
        }
    }

    /// Web `id(x)`: nicht leer nach `trim()`, höchstens 256 UTF-16-Einheiten.
    static func isValidReference(_ text: String) -> Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text.utf16.count <= 256
    }

    public var json: JSONValue {
        switch self {
        case .id(let value): return ["id": .string(value)]
        case .catalogKey(let value): return ["catalogKey": .string(value)]
        case .recipeId(let value): return ["recipeId": .string(value)]
        case .barcode(let value): return ["barcode": .string(value)]
        }
    }

    /// Eindeutiger Schlüssel für Listen.
    public var key: String {
        switch self {
        case .id(let value): return "id:" + value
        case .catalogKey(let value): return "catalog:" + value
        case .recipeId(let value): return "recipe:" + value
        case .barcode(let value): return "barcode:" + value
        }
    }

    public var isRecipe: Bool {
        if case .recipeId = self { return true }
        return false
    }
}

/// Kompaktes Produkt (§12.2). Nährwerte pro 100 g/ml, unbekannte Makros `nil`.
public struct NutritionProduct: Equatable, Sendable, Identifiable {
    public var ref: ProductRef
    public var name: String
    public var brand: String
    /// `g` oder `ml` (Bezugsbasis); bei unbekanntem OFF-Bezug `g` mit `unitKnown == false`.
    public var unit: String
    /// P2: OFF-Bezug ist unbekannt (`unit:null`), bis der Nutzer g/ml ausdrücklich wählt.
    public var unitKnown: Bool
    public var kcal: Double?
    public var p: Double?
    public var c: Double?
    public var f: Double?
    /// Quelle/Attribution (z. B. „PULS Basis“, „Eigene Werte“).
    public var source: String
    public var favorite: Bool
    public var complete: Bool
    /// Ungeprüftes OFF-Produkt; keine Speicherfreigabe.
    public var reviewRequired: Bool

    public var id: String { ref.key }

    public init?(json: JSONValue) {
        let o = Loose(json)
        guard let ref = ProductRef(json: o.values["ref"]) else { return nil }
        self.ref = ref
        name = o.string("name") ?? ""
        brand = o.string("brand") ?? ""
        let rawUnit = o.string("unit")
        unit = rawUnit == "ml" ? "ml" : "g"
        unitKnown = rawUnit == "ml" || rawUnit == "g"
        kcal = o.number("kcal")
        p = o.number("p")
        c = o.number("c")
        f = o.number("f")
        source = o.string("source") ?? ""
        favorite = o.bool("favorite") ?? false
        complete = o.bool("complete") ?? [kcal, p, c, f].allSatisfy { $0 != nil }
        reviewRequired = o.bool("reviewRequired") ?? false
    }
}

public struct NutritionRecipeRow: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    /// Fertiges Gesamtgewicht in g.
    public var yield: Double?
    /// Anzahl der Zutaten.
    public var ingredients: Int
    /// `recipeNutrients` pro 100 g.
    public var per100: MacroValues

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        yield = o.number("yield")
        ingredients = o.int("ingredients") ?? 0
        per100 = MacroValues(o)
    }

    public var ref: ProductRef { .recipeId(id) }
}

/// Anzeige-Einstellungen, **keine** vollständige Op-Erwartung (dafür das Profil aus dem Snapshot).
public struct NutritionSettings: Equatable, Sendable {
    public var waterGoal: Double?
    public var microGoals: [String: Double]

    init(_ o: Loose?) {
        waterGoal = o?.number("waterGoal")
        var goals: [String: Double] = [:]
        for (key, value) in o?.object("microGoals")?.values ?? [:] {
            if let number = value.doubleValue, number.isFinite { goals[key] = number }
        }
        microGoals = goals
    }
}

public struct NutritionOmitted: Equatable, Sendable {
    public var entries: Int
    public var favorites: Int
    public var recent: Int
    public var recipes: Int

    init(_ o: Loose?) {
        entries = o?.int("entries") ?? 0
        favorites = o?.int("favorites") ?? 0
        recent = o?.int("recent") ?? 0
        recipes = o?.int("recipes") ?? 0
    }

    public var any: Bool { entries + favorites + recent + recipes > 0 }
}

// MARK: - Queries (§12.3)

/// Argument für `window.pulsNativeNutritionQuery(request)`; nur die Tabellenfelder, schon nativ geprüft.
public struct NutritionQueryRequest: Equatable, Hashable, Sendable {
    public enum Kind: String, Sendable, CaseIterable {
        case search, product, entry, recipe, labelParse
    }

    public enum SearchFilter: String, Sendable, CaseIterable {
        case all, favorites, recent
    }

    public var requestId: String
    public var kind: Kind
    public private(set) var fields: [String: JSONValue]

    private init(requestId: String, kind: Kind, fields: [String: JSONValue]) {
        self.requestId = requestId
        self.kind = kind
        self.fields = fields
    }

    /// Lokale Suche: `q` höchstens 100 UTF-16-Einheiten, `limit` 1–60.
    public static func search(_ q: String, filter: SearchFilter = .all, limit: Int? = nil, requestId: String) -> NutritionQueryRequest? {
        guard ProgressQueryRequest.isValidRequestID(requestId), q.utf16.count <= 100 else { return nil }
        var fields: [String: JSONValue] = ["q": .string(q), "filter": .string(filter.rawValue)]
        if let limit {
            guard (1...60).contains(limit) else { return nil }
            fields["limit"] = .number(Double(limit))
        }
        return NutritionQueryRequest(requestId: requestId, kind: .search, fields: fields)
    }

    public static func product(_ ref: ProductRef, requestId: String) -> NutritionQueryRequest? {
        guard ProgressQueryRequest.isValidRequestID(requestId) else { return nil }
        return NutritionQueryRequest(requestId: requestId, kind: .product, fields: ["product": ref.json])
    }

    /// Vollständiger Eintrag (`entry`) bzw. rohes Rezept (`recipe`).
    public static func detail(_ kind: Kind, id: String, requestId: String) -> NutritionQueryRequest? {
        guard kind == .entry || kind == .recipe, ProgressQueryRequest.isValidRequestID(requestId),
              ProductRef.isValidReference(id) else { return nil }
        return NutritionQueryRequest(requestId: requestId, kind: kind, fields: ["id": .string(id)])
    }

    /// Geordnete Vision-Zeilen an `parseLabelText`: höchstens 500 Zeilen, zusammen höchstens 15 000 Einheiten.
    public static func labelParse(lines: [String], column: Int? = nil, requestId: String) -> NutritionQueryRequest? {
        guard ProgressQueryRequest.isValidRequestID(requestId), lines.count <= 500,
              lines.joined(separator: "\n").utf16.count <= 15_000 else { return nil }
        var fields: [String: JSONValue] = ["lines": .array(lines.map(JSONValue.string))]
        if let column {
            guard (0...2).contains(column) else { return nil }
            fields["column"] = .number(Double(column))
        }
        return NutritionQueryRequest(requestId: requestId, kind: .labelParse, fields: fields)
    }

    public var json: JSONValue {
        var object = fields
        object["requestId"] = .string(requestId)
        object["kind"] = .string(kind.rawValue)
        return .object(object)
    }
}

/// `{type:'nutritionResult', requestId, kind, ok, result | error}`. Kein Ack, kein Schreibnachweis.
public struct NutritionResultMessage: Equatable, Sendable {
    public var requestId: String
    public var kind: String
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var language: String
    public var ok: Bool
    public var error: AckError?
    public var result: NutritionQueryResult?
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        requestId = try fields.nonEmptyString("requestId")
        kind = try fields.nonEmptyString("kind")
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        language = (try fields.optionalString("language")) == "en" ? "en" : "de"
        ok = try fields.requiredBool("ok")
        if ok {
            guard let value = fields["result"], case .object = value else { throw BridgeDecodingError.invalidField("result") }
            result = try NutritionQueryResult(kind: kind, json: value)
            error = nil
        } else {
            result = nil
            if let value = fields["error"], case .object = value {
                error = try AckError(json: value)
            } else {
                error = AckError(code: .other("unknown"))
            }
        }
        raw = json
    }

    public var json: JSONValue { raw }

    public var isGone: Bool { error?.code == .gone }
    /// Details zu groß für die Brücke (`too_large`): Web-Ausweg anbieten.
    public var isTooLarge: Bool { error?.code == .other("too_large") }
}

extension NutritionResultMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

public enum NutritionQueryResult: Equatable, Sendable {
    case search(NutritionSearchResult)
    case product(NutritionProductDetail)
    case entry(NutritionEntryDetail)
    case recipe(NutritionRecipeDetail)
    case labelParse(NutritionLabelParse)
    case unknown(JSONValue)

    init(kind: String, json: JSONValue) throws {
        switch kind {
        case "search": self = .search(NutritionSearchResult(Loose(json)))
        case "product": self = .product(try NutritionProductDetail(json: json))
        case "entry": self = .entry(try NutritionEntryDetail(json: json))
        case "recipe": self = .recipe(try NutritionRecipeDetail(json: json))
        case "labelParse": self = .labelParse(NutritionLabelParse(Loose(json)))
        default: self = .unknown(json)
        }
    }
}

public struct NutritionSearchResult: Equatable, Sendable {
    public var q: String
    public var filter: String
    public var items: [NutritionProduct]
    /// Zahl der zusammengeführten Web-Kandidaten, **keine** Gesamtzahl aller Katalogtreffer.
    public var total: Int
    public var omitted: Int
    public var offline: Bool
    public var catalogueError: String
    /// P2: `local` (Zwischenstand, weitere Antwort derselben `requestId` folgt) oder `complete`; P1 ohne Feld.
    public var phase: String?
    public var cataloguePending: Bool
    /// P2: OFF-Treffer getrennt von den lokalen (`ref:{barcode}`, immer prüfpflichtig).
    public var onlineItems: [NutritionProduct]
    /// `pending/ready/offline/disabled/skipped/rate_limited/timeout/unavailable`.
    public var onlineStatus: String?
    public var onlineHasMore: Bool
    public var onlinePage: Int?
    public var onlineRetryAfterMs: Double?
    public var onlineAttribution: NutritionAttribution?
    /// P1: `false` mit `reason:'P2'` (kein OFF).
    public var onlineSupported: Bool
    public var onlineReason: String?
    public var onlineProvider: String?
    public var attribution: String

    init(_ o: Loose) {
        q = o.string("q") ?? ""
        filter = o.string("filter") ?? "all"
        items = o.array("items").compactMap { NutritionProduct(json: $0) }
        total = o.int("total") ?? items.count
        omitted = o.int("omitted") ?? 0
        offline = o.bool("offline") ?? false
        catalogueError = o.string("catalogueError") ?? ""
        let online = o.object("online")
        onlineSupported = online?.bool("supported") ?? false
        onlineReason = online?.string("reason")
        onlineProvider = online?.string("provider")
        attribution = o.string("attribution") ?? ""
        phase = o.string("phase")
        cataloguePending = o.bool("cataloguePending") ?? false
        // Unbekannte OFF-Bezüge werden toleriert; Zeilen ohne lesbaren Verweis entfallen.
        onlineItems = online?.array("items").compactMap { NutritionProduct(json: $0) } ?? []
        onlineStatus = online?.string("status")
        onlineHasMore = online?.bool("hasMore") ?? false
        onlinePage = online?.int("page")
        onlineRetryAfterMs = online?.number("retryAfterMs")
        onlineAttribution = online?.object("attribution").map(NutritionAttribution.init)
    }

    /// Weitere Antwort derselben Anfrage folgt (P2 `phase:'local'`). P1-Antworten sind immer endgültig.
    public var isFinal: Bool { phase != "local" }
}

/// OFF-Quellenangabe (Name, Lizenz ODbL, Datenschutzhinweis); Links nur zur Anzeige.
public struct NutritionAttribution: Equatable, Sendable {
    public var name: String
    public var url: URL?
    public var license: String?
    public var licenseUrl: URL?
    public var privacy: String?

    init(_ o: Loose) {
        name = o.string("name") ?? "Open Food Facts"
        url = o.string("url").flatMap(NutritionAttribution.httpsURL)
        license = o.string("license")
        licenseUrl = o.string("licenseUrl").flatMap(NutritionAttribution.httpsURL)
        privacy = o.string("privacy")
    }

    static func httpsURL(_ text: String) -> URL? {
        guard let url = URL(string: text), url.scheme == "https", url.host != nil else { return nil }
        return url
    }
}

/// Einheit aus `ffUnits`: Faktor in kanonischer Basis (g bzw. ml). g↔ml nur, wenn das Web sie mit Dichte liefert.
public struct NutritionUnit: Equatable, Hashable, Sendable, Identifiable {
    public var key: String
    public var label: String
    public var factor: Double
    public var portion: Bool
    /// P2: belegte Quellportion unverändert (`food.add` sendet sie als `portion` mit).
    public var snapshot: JSONValue?

    public var id: String { key }

    init?(_ o: Loose) {
        guard let key = o.string("key"), !key.isEmpty, let factor = o.number("factor"), factor > 0 else { return nil }
        self.key = key
        label = o.string("label") ?? key
        self.factor = factor
        portion = o.bool("portion") ?? false
        if let snapshot = o.values["snapshot"], case .object = snapshot { self.snapshot = snapshot } else { snapshot = nil }
    }
}

public struct NutritionProductDetail: Equatable, Sendable {
    public var product: NutritionProduct
    /// Vollständige unveränderte lokale Quelle: Erwartung für `food.add`/`product.favorite`. `nil` bei einem
    /// ungeprüften P2-Entwurf (Barcode/OFF), der erst gespeichert werden muss.
    public var expect: JSONValue?
    /// P2: zu prüfender Entwurf (nie direkt eintragen).
    public var draft: JSONValue?
    public var units: [NutritionUnit]
    public var nutrients: [String: Double]
    public var warnings: [String]
    /// Web-letzte Menge bzw. Standardportion in Basis-Einheit.
    public var defaultAmount: Double?
    /// `g` oder `ml`.
    public var base: String
    /// Neuer Katalogeintrag: `food.add` braucht eine stabile `productId`.
    public var newCatalogProduct: Bool
    public var density: Double?
    public var packageAmount: Double?
    /// P2 Barcode: nicht gefunden (leere zu prüfende Vorlage).
    public var missing: Bool
    /// P2: Bezug g/ml bekannt (`base` nicht null).
    public var baseKnown: Bool
    public var attribution: NutritionAttribution?

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let product = o.values["product"].flatMap(NutritionProduct.init(json:)) else {
            throw BridgeDecodingError.invalidField("result.product")
        }
        self.product = product
        if let expect = o.values["expect"], case .object = expect { self.expect = expect } else { expect = nil }
        if let draft = o.values["draft"], case .object = draft { self.draft = draft } else { draft = nil }
        units = o.array("units").compactMap { NutritionUnit(Loose($0)) }
        var nutrients: [String: Double] = [:]
        for (key, value) in o.object("nutrients")?.values ?? [:] {
            if let number = value.doubleValue, number.isFinite { nutrients[key] = number }
        }
        self.nutrients = nutrients
        warnings = NutritionWarnings.parse(o.values["warnings"])
        defaultAmount = o.number("defaultAmount")
        let rawBase = o.string("base")
        base = rawBase == "ml" ? "ml" : rawBase == "g" ? "g" : product.unit
        baseKnown = rawBase == "ml" || rawBase == "g"
        missing = o.bool("missing") ?? false
        attribution = o.object("attribution").map(NutritionAttribution.init)
        newCatalogProduct = o.bool("newCatalogProduct") ?? false
        density = o.number("density")
        packageAmount = o.number("packageAmount")
    }

    public func unit(_ key: String) -> NutritionUnit? {
        units.first { $0.key == key }
    }

    /// Basiseinheit (Faktor 1) als Startauswahl, sonst die erste gelieferte Einheit.
    public var defaultUnit: NutritionUnit? {
        unit(base) ?? units.first
    }

    /// Favorit nur für gespeicherte/Basis-Produkte, nie für neue Katalogzeilen oder Rezepte (§12.4).
    public var canFavorite: Bool {
        guard expect != nil, !newCatalogProduct else { return false }
        if case .id = product.ref { return true }
        if case .catalogKey = product.ref { return true }
        return false
    }

    /// Direkt eintragbar: lokale Quelle vorhanden, kein ungeprüfter Entwurf.
    public var canAdd: Bool {
        guard expect != nil, draft == nil, !units.isEmpty else { return false }
        if case .barcode = product.ref { return false }
        return true
    }
}

public struct NutritionEntryDetail: Equatable, Sendable {
    /// Verlustfreier vollständiger Eintrag (Erwartung für Update/Delete, Snapshot für Restore).
    public var entry: JSONValue
    public var id: String
    /// Ursprünglicher Arrayindex in `state.foods`.
    public var index: Int
    /// `false` bei Rohsnapshot > 24 Ki: Löschen dann nur im Web.
    public var canRestore: Bool

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let entry = o.values["entry"], case .object = entry, let id = entry["id"]?.stringValue, !id.isEmpty else {
            throw BridgeDecodingError.invalidField("result.entry")
        }
        self.entry = entry
        self.id = id
        index = max(0, o.int("index") ?? 0)
        canRestore = o.bool("canRestore") ?? false
    }

    public var grams: Double? { entry["grams"]?.doubleValue }
    public var base: String { entry["unit"]?.stringValue == "ml" ? "ml" : "g" }
    public var name: String { entry["name"]?.stringValue ?? "" }
}

public struct NutritionIngredient: Equatable, Sendable, Identifiable {
    public var id: Int
    public var name: String
    public var amount: Double?
    public var unit: String
    public var kcal: Double?
}

public struct NutritionRecipeDetail: Equatable, Sendable {
    /// Rohes Rezept einschließlich unbekannter Felder.
    public var recipe: JSONValue
    public var name: String
    public var yield: Double?
    public var ingredients: [NutritionIngredient]
    public var totals: MacroValues
    public var per100: MacroValues

    public init(json: JSONValue) throws {
        let o = Loose(json)
        guard let recipe = o.values["recipe"], case .object = recipe else { throw BridgeDecodingError.invalidField("result.recipe") }
        self.recipe = recipe
        let r = Loose(recipe)
        name = r.string("name") ?? ""
        yield = r.number("yield")
        ingredients = r.array("ingredients").enumerated().map { index, value in
            let i = Loose(value)
            return NutritionIngredient(id: index, name: i.string("name") ?? "", amount: i.number("amount"),
                                       unit: i.string("unit") == "ml" ? "ml" : "g", kcal: i.number("kcal"))
        }
        totals = o.object("totals").map { MacroValues($0) } ?? MacroValues()
        per100 = o.object("per100").map { MacroValues($0) } ?? MacroValues()
    }
}

/// Ergebnis von `parseLabelText`: fehlende Werte fehlen (keine 0). Immer prüfpflichtig.
public struct NutritionLabelParse: Equatable, Sendable {
    public var values: [String: Double]
    public var reviewRequired: Bool
    public var basis: JSONValue?
    public var warnings: [String]

    init(_ o: Loose) {
        var values: [String: Double] = [:]
        for (key, value) in o.object("values")?.values ?? [:] {
            if let number = value.doubleValue, number.isFinite { values[key] = number }
        }
        self.values = values
        reviewRequired = o.bool("reviewRequired") ?? true
        let basis = o.values["basis"]
        self.basis = basis?.isNull == false ? basis : nil
        warnings = NutritionWarnings.parse(o.values["warnings"])
    }
}

enum NutritionWarnings {
    /// `foodWarnings` liefert Texte oder Objekte mit Text; anderes wird ausgelassen.
    static func parse(_ value: JSONValue?) -> [String] {
        (value?.arrayValue ?? []).compactMap { item in
            if let text = item.stringValue { return text }
            return item["message"]?.stringValue ?? item["text"]?.stringValue
        }
        .filter { !$0.isEmpty }
    }
}
