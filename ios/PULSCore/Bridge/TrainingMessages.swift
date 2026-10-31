import Foundation

// M4: `projection{name:"training"}` und `exerciseSearch` aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §9.
//
// Regeln wie bei der Übersicht: Umschlag streng (`projectionSeq`, `ownerPending`, `training` Pflicht), Inhalt
// nachsichtig (fehlend/falscher Typ = unbekannt, nie erfundene Nullen). `raw` erhält die vollständige Nachricht.
// Satzwerte bleiben exakt: `""` (leer) ist etwas anderes als `0`.

/// Gespeicherter Satzwert `kg`/`reps`: Zahl oder leer (`""`). Leer ist nicht 0.
public enum SetValue: Hashable, Sendable {
    case empty
    case number(Double)

    /// `nil` für alles außer `""` und endlichen Zahlen (dann ist der Wert für Native nicht lesbar).
    public init?(json: JSONValue?) {
        switch json {
        case .string("")?: self = .empty
        case .number(let value)? where value.isFinite: self = .number(value)
        default: return nil
        }
    }

    public var json: JSONValue {
        switch self {
        case .empty: return .string("")
        case .number(let value): return .number(value)
        }
    }

    public var number: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    public var isEmpty: Bool { self == .empty }
}

public struct TrainingProjectionMessage: Equatable, Sendable {
    public static let trainingName = "training"

    /// Dokumentlokal, gemeinsam mit der Übersicht hochgezählt; Native vergleicht je Projektionsname.
    public var projectionSeq: Int
    public var seq: Int?
    public var userId: String?
    public var ownerPending: Bool
    public var flags: StateFlags
    public var cloud: CloudStatus
    public var reason: String
    public var training: TrainingProjection
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.nonEmptyString("name") == Self.trainingName else { throw BridgeDecodingError.invalidField("name") }
        projectionSeq = try fields.int("projectionSeq")
        guard projectionSeq >= 0 else { throw BridgeDecodingError.invalidField("projectionSeq") }
        seq = try fields.optionalInt("seq")
        userId = try fields.optionalString("userId")
        ownerPending = try fields.requiredBool("ownerPending")
        flags = try StateFlags(json: fields["flags"])
        cloud = try CloudStatus(json: fields["cloud"])
        reason = try fields.optionalString("reason") ?? "unknown"
        guard let training = fields["training"] else { throw BridgeDecodingError.missingField("training") }
        self.training = try TrainingProjection(json: training)
        raw = json
    }

    public var json: JSONValue { raw }
}

extension TrainingProjectionMessage: Codable {
    public init(from decoder: Decoder) throws { try self.init(json: JSONValue(from: decoder)) }
    public func encode(to encoder: Encoder) throws { try json.encode(to: encoder) }
}

// MARK: - Nutzlast

public struct TrainingProjection: Equatable, Sendable {
    /// `de` oder `en` (Standard `de`).
    public var language: String
    public var locale: String?
    public var today: String?
    /// Standardpause in Sekunden (`state.workoutSettings.restSeconds`).
    public var restSeconds: Double?
    public var active: ActiveWorkout?
    public var routines: [TrainingRoutine]
    public var routineCount: Int
    public var recommendation: TrainingRecommendation?
    public var library: [LibraryExercise]
    public var libraryCount: Int
    public var recent: [RecentWorkout]
    public var identity: TrainingIdentity?
    public var omitted: TrainingOmitted
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        guard case .object = json else { throw BridgeDecodingError.invalidField("training") }
        let o = Loose(json)
        language = o.string("language") == "en" ? "en" : "de"
        locale = o.string("locale")
        today = o.string("today").flatMap { WeightDay.isValid($0) ? $0 : nil }
        restSeconds = o.object("settings")?.number("restSeconds")
        active = o.object("active").flatMap(ActiveWorkout.init)
        routines = o.array("routines").compactMap { TrainingRoutine(Loose($0)) }
        routineCount = o.int("routineCount") ?? routines.count
        recommendation = o.object("recommendation").map(TrainingRecommendation.init)
        library = o.array("library").compactMap { LibraryExercise(Loose($0)) }
        libraryCount = o.int("libraryCount") ?? library.count
        recent = o.array("recent").compactMap { RecentWorkout(Loose($0)) }
        identity = o.object("identity").map(TrainingIdentity.init)
        omitted = TrainingOmitted(o.object("omitted"))
        raw = json
    }

    public func routine(id: String) -> TrainingRoutine? {
        routines.first { $0.id == id }
    }

    public func libraryItem(id: String) -> LibraryExercise? {
        library.first { $0.id == id }
    }
}

public struct TrainingOmitted: Equatable, Sendable {
    public var routines: Int
    public var library: Int
    public var recent: Int

    init(_ o: Loose?) {
        routines = o?.int("routines") ?? 0
        library = o?.int("library") ?? 0
        recent = o?.int("recent") ?? 0
    }

    public var any: Bool { routines > 0 || library > 0 || recent > 0 }
}

public struct RestInfo: Equatable, Sendable {
    /// Pausenende in ms seit 1970 (Web-Uhr). Kann bereits abgelaufen sein, bis der Web-Takt sie löscht.
    public var endAt: Double
    public var exerciseId: String?

    public init(endAt: Double, exerciseId: String?) {
        self.endAt = endAt
        self.exerciseId = exerciseId
    }

    /// Aus `{endAt, exerciseId}`; ohne gültiges `endAt` keine Pause (wie `w.rest?.endAt` im Web).
    init?(_ value: JSONValue?) {
        let o = Loose(value)
        guard let endAt = o.number("endAt"), endAt > 0 else { return nil }
        self.init(endAt: endAt, exerciseId: o.string("exerciseId"))
    }

    /// Restpause in ganzen Sekunden, aufgerundet wie `restRemaining` im Web (nie negativ).
    public func remainingSeconds(at date: Date) -> Int {
        let millis = endAt - date.timeIntervalSince1970 * 1000
        return max(0, Int((millis / 1000).rounded(.up)))
    }
}

/// `previous.sets[i]` bzw. `sets[i].previous`: Web-Spalte „Vorher“. Kopieren nutzt die rohen Werte.
public struct PreviousSet: Equatable, Sendable {
    public var kg: SetValue?
    public var reps: SetValue?
    /// Web-Anzeige `n(kg)` (höchstens eine Nachkommastelle).
    public var shownKg: Double?

    public init(kg: SetValue?, reps: SetValue?, shownKg: Double?) {
        self.kg = kg
        self.reps = reps
        self.shownKg = shownKg
    }

    init?(_ value: JSONValue?) {
        guard let value, case .object = value else { return nil }
        let o = Loose(value)
        self.init(kg: SetValue(json: o.values["kg"]), reps: SetValue(json: o.values["reps"]), shownKg: o.number("shownKg"))
    }

    /// Beide Werte sind kopierbare Zahlen.
    public var isCopyable: Bool { kg?.number != nil && reps?.number != nil }
}

public struct PreviousPerformance: Equatable, Sendable {
    public var date: String?
    public var sets: [PreviousSet]

    init(_ o: Loose) {
        date = o.string("date")
        sets = o.array("sets").map { PreviousSet($0) ?? PreviousSet(kg: nil, reps: nil, shownKg: nil) }
    }
}

public struct ActiveSet: Equatable, Sendable {
    /// `nil` = nicht lesbarer Wert (weder `""` noch Zahl).
    public var kg: SetValue?
    public var reps: SetValue?
    public var done: Bool
    public var previous: PreviousSet?

    init(_ o: Loose) {
        kg = SetValue(json: o.values["kg"])
        reps = SetValue(json: o.values["reps"])
        done = o.bool("done") ?? false
        previous = PreviousSet(o.values["previous"])
    }

    public var isReadable: Bool { kg != nil && reps != nil }
}

public struct ActiveExercise: Equatable, Sendable, Identifiable {
    public var id: String
    /// Bibliothekseintrag (`exerciseId` im Profil).
    public var libraryId: String?
    public var name: String
    /// Gespeicherte Pause oder `nil` (dann Standard).
    public var restSeconds: Double?
    public var effectiveRestSeconds: Double?
    public var repMin: Double?
    public var repMax: Double?
    public var superset: String?
    /// Partner derselben Gruppe (nur bei Gruppe > 1, wie das Web-Badge).
    public var supersetWith: [String]
    public var previous: PreviousPerformance?
    public var sets: [ActiveSet]

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        libraryId = o.string("libraryId")
        name = o.string("name") ?? ""
        restSeconds = o.number("restSeconds")
        effectiveRestSeconds = o.number("effectiveRestSeconds")
        repMin = o.number("repMin")
        repMax = o.number("repMax")
        superset = o.string("superset")
        supersetWith = o.array("supersetWith").compactMap(\.stringValue)
        previous = o.object("previous").map(PreviousPerformance.init)
        sets = o.array("sets").map { ActiveSet(Loose($0)) }
    }
}

public struct ActiveWorkout: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var date: String?
    public var routineId: String?
    /// ms seit 1970; `nil` = unbekannt (dann keine Dauer anzeigen).
    public var startedAt: Double?
    /// `startedAt` + 5 h: danach beendet das Web das Workout automatisch.
    public var autoFinishAt: Double?
    public var timeApprox: Bool
    public var rest: RestInfo?
    public var loggedSets: Int?
    public var openSets: Int?
    public var totalSets: Int?
    /// `false`: das Web hat Übungen ausgelassen (zu lange IDs) → Native bietet die Web-Session an.
    public var complete: Bool
    public var exercises: [ActiveExercise]

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        date = o.string("date")
        routineId = o.string("routineId")
        startedAt = o.number("startedAt")
        autoFinishAt = o.number("autoFinishAt")
        timeApprox = o.bool("timeApprox") ?? false
        rest = RestInfo(o.values["rest"])
        loggedSets = o.int("loggedSets")
        openSets = o.int("openSets")
        totalSets = o.int("totalSets")
        exercises = o.array("exercises").compactMap { ActiveExercise(Loose($0)) }
        complete = (o.bool("complete") ?? false) && exercises.count == o.array("exercises").count
    }

    public func exercise(id: String) -> ActiveExercise? {
        exercises.first { $0.id == id }
    }
}

public struct RoutineExerciseSummary: Equatable, Sendable {
    public var libraryId: String?
    public var name: String?
    public var sets: Int?
    public var min: Int?
    public var max: Int?
    public var restSeconds: Double?
    public var superset: String?

    init(_ o: Loose) {
        libraryId = o.string("libraryId")
        name = o.string("name")
        sets = o.int("sets")
        min = o.int("min")
        max = o.int("max")
        restSeconds = o.number("restSeconds")
        superset = o.string("superset")
    }
}

public struct TrainingRoutine: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var exerciseCount: Int
    public var setCount: Int?
    public var exercises: [RoutineExerciseSummary]

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        exercises = o.array("exercises").map { RoutineExerciseSummary(Loose($0)) }
        exerciseCount = o.int("exerciseCount") ?? exercises.count
        setCount = o.int("setCount")
    }
}

public struct WorkoutReference: Equatable, Sendable {
    public var id: String
    public var name: String
    public var date: String?
    public var routineId: String?

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        date = o.string("date")
        routineId = o.string("routineId")
    }
}

/// `routineRecommendation()` des Webs; Native berechnet keine eigene Empfehlung.
public struct TrainingRecommendation: Equatable, Sendable {
    public var nextRoutineId: String?
    public var last: WorkoutReference?

    init(_ o: Loose) {
        nextRoutineId = o.string("nextRoutineId")
        last = o.object("last").flatMap(WorkoutReference.init)
    }
}

public struct LibraryExercise: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var muscles: [String]
    public var equipment: String?
    public var target: Double?
    public var repMin: Double?
    public var repMax: Double?
    public var loadStep: Double?

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        muscles = o.array("muscles").compactMap(\.stringValue)
        equipment = o.string("equipment")
        target = o.number("target")
        repMin = o.number("repMin")
        repMax = o.number("repMax")
        loadStep = o.number("loadStep")
    }
}

public struct RecentWorkout: Equatable, Sendable, Identifiable {
    public var id: String
    public var name: String
    public var date: String?
    public var routineId: String?
    /// `nil` = Dauer nicht erfasst (nicht ergänzen).
    public var durationSeconds: Double?
    public var sets: Int?
    public var reps: Int?
    /// Bereits `n`-gerundet.
    public var volume: Double?
    public var xp: Double?
    public var autoFinished: Bool

    init?(_ o: Loose) {
        guard let id = o.string("id"), !id.isEmpty else { return nil }
        self.id = id
        name = o.string("name") ?? ""
        date = o.string("date")
        routineId = o.string("routineId")
        durationSeconds = o.number("durationSeconds")
        sets = o.int("sets")
        reps = o.int("reps")
        volume = o.number("volume")
        xp = o.number("xp")
        autoFinished = o.bool("autoFinished") ?? false
    }
}

/// `xpProgress(totalWorkoutXP())` + `dailyWorkoutStreak()`.
public struct TrainingIdentity: Equatable, Sendable {
    public var level: Int?
    public var current: Double?
    public var needed: Double?
    public var total: Double?
    public var streak: Int?

    init(_ o: Loose) {
        level = o.int("level")
        current = o.number("current")
        needed = o.number("needed")
        total = o.number("total")
        streak = o.int("streak")
    }
}

// MARK: - Übungssuche

/// `{type:'exerciseSearch', requestId, query, equipment, total, canCreate, items}` (Web-Ranking `exerciseOptions`).
public struct ExerciseSearchMessage: Equatable, Sendable {
    public struct Item: Equatable, Sendable, Identifiable {
        public var id: String
        public var name: String
        public var muscles: [String]
        public var equipment: String?
        /// Anzeigetexte des Webs in `language` (gleiche Reihenfolge wie `muscles`); Native übersetzt nicht selbst.
        public var muscleLabels: [String]
        public var equipmentLabel: String?
        /// Bereits in der eigenen Bibliothek (`exerciseBook`), sonst Katalogeintrag (`exercise.create {catalogKey}`).
        public var inLibrary: Bool

        public init(id: String, name: String, muscles: [String] = [], equipment: String? = nil,
                    muscleLabels: [String] = [], equipmentLabel: String? = nil, inLibrary: Bool) {
            self.id = id
            self.name = name
            self.muscles = muscles
            self.equipment = equipment
            self.muscleLabels = muscleLabels
            self.equipmentLabel = equipmentLabel
            self.inLibrary = inLibrary
        }

        init?(_ o: Loose) {
            guard let id = o.string("id"), !id.isEmpty else { return nil }
            self.id = id
            name = o.string("name") ?? ""
            muscles = o.array("muscles").compactMap(\.stringValue)
            equipment = o.string("equipment")
            muscleLabels = o.array("muscleLabels").compactMap(\.stringValue)
            equipmentLabel = o.string("equipmentLabel")
            inLibrary = o.bool("inLibrary") ?? false
        }

        /// Anzeige: Web-Labels; ältere Web-Stände ohne Labels zeigen die gespeicherten Schlüssel.
        public var displayMuscles: [String] { muscleLabels.isEmpty ? muscles : muscleLabels }
        public var displayEquipment: String? { equipmentLabel ?? equipment }
    }

    /// Sprache der Labels (`de`/`en`).
    public var language: String?

    public var requestId: String
    public var query: String
    public var equipment: String
    public var total: Int
    /// Web-Vorschlag „Als eigene Übung hinzufügen“.
    public var canCreate: Bool
    public var items: [Item]
    public var raw: JSONValue

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        requestId = try fields.nonEmptyString("requestId")
        let o = Loose(json)
        query = o.string("query") ?? ""
        equipment = o.string("equipment") ?? "all"
        items = o.array("items").compactMap { Item(Loose($0)) }
        total = o.int("total") ?? items.count
        canCreate = o.bool("canCreate") ?? false
        language = o.string("language")
        raw = json
    }

    public var json: JSONValue { raw }
}

/// Argument für `window.pulsNativeExerciseSearch(request)` (Grenzen aus §9.3 schon nativ eingehalten).
public struct ExerciseSearchRequest: Equatable, Sendable {
    public static let equipments = ["all", "machine", "cable", "smith"]

    public var requestId: String
    public var query: String
    public var equipment: String
    public var limit: Int

    public init(requestId: String, query: String, equipment: String = "all", limit: Int = 60) {
        self.requestId = requestId
        // ≤ 100 Zeichen (UTF-16 wie im Web), Surrogatpaare nicht trennen.
        var trimmed = query
        while trimmed.utf16.count > 100 { trimmed.removeLast() }
        self.query = trimmed
        self.equipment = Self.equipments.contains(equipment) ? equipment : "all"
        self.limit = min(max(limit, 1), 200)
    }

    public var json: JSONValue {
        .object([
            "requestId": .string(requestId), "query": .string(query),
            "equipment": .string(equipment), "limit": .number(Double(limit)),
        ])
    }
}
