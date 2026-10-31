import Foundation

/// Anzeigemodell der laufenden Kraftsession.
///
/// Satzwerte, Reihenfolge, Pause und Status kommen aus dem **Spiegel** (`ProfileStore.document`, also Web-Snapshot
/// plus optimistisch angewendete offene Befehle), damit Anzeige und `expect` immer auf demselben Stand beruhen.
/// Was nur das Web berechnet (Vorher-Werte, wirksame Pause, Vollständigkeit) kommt aus der `training`-Projektion,
/// zugeordnet über die Übungs-ID. Fehlt der Spiegel-Eintrag (z. B. kurz nach dem Start), gilt die Projektion.
/// Keine eigenen Formeln: Vorher-Werte, Vorbelegung, XP und Volumen bleiben beim Web.
public struct TrainingSessionModel: Equatable, Sendable, Identifiable {
    public struct SessionSet: Equatable, Sendable, Identifiable {
        public var index: Int
        /// `nil` = nicht lesbar (weder `""` noch Zahl): nur anzeigen, nicht bearbeiten.
        public var kg: SetValue?
        public var reps: SetValue?
        public var done: Bool
        /// Web-Spalte „Vorher“ für diesen Satzindex.
        public var previous: PreviousSet?

        public var id: Int { index }
        public var isEditable: Bool { kg != nil && reps != nil }
    }

    public struct Exercise: Equatable, Sendable, Identifiable {
        public var id: String
        public var libraryId: String?
        public var name: String
        /// Gespeicherte Pause oder `nil` (= Standardpause).
        public var restSeconds: Double?
        public var effectiveRestSeconds: Double?
        public var repMin: Double?
        public var repMax: Double?
        public var superset: String?
        /// Andere Übungen derselben Gruppe (nur bei Gruppe > 1).
        public var supersetWith: [String]
        public var previousDate: String?
        public var sets: [SessionSet]

        public var doneSets: Int { sets.filter(\.done).count }
    }

    public var id: String
    public var name: String
    public var date: String?
    public var routineId: String?
    /// ms seit 1970.
    public var startedAt: Double?
    public var autoFinishAt: Double?
    public var timeApprox: Bool
    public var rest: RestInfo?
    public var finished: Bool
    public var autoFinished: Bool
    public var exercises: [Exercise]
    /// `false`: Teile sind nativ nicht darstellbar (ausgelassene IDs, unlesbare Werte) → Web-Session anbieten.
    public var isComplete: Bool

    /// Abgehakte Sätze (Abschluss nur mit mindestens einem, wie `finishWorkout`).
    public var doneSets: Int { exercises.reduce(0) { $0 + $1.doneSets } }
    public var openSets: Int { exercises.reduce(0) { $0 + $1.sets.filter { !$0.done }.count } }

    public func exercise(id: String) -> Exercise? {
        exercises.first { $0.id == id }
    }

    /// Dauer in Sekunden wie `elapsedWorkout` (laufend aus `startedAt`), `nil` ohne Startzeit.
    public func elapsedSeconds(at date: Date) -> Double? {
        guard let startedAt else { return nil }
        return max(0, date.timeIntervalSince1970 - startedAt / 1000)
    }

    /// Baut die Sitzung `workoutId` aus Spiegel und Projektion. `nil`, wenn weder Spiegel noch Projektion sie kennen.
    public static func build(workoutId: String, document: ProfileDocument, projection: TrainingProjection?) -> TrainingSessionModel? {
        let active = projection?.active?.id == workoutId ? projection?.active : nil
        let defaultRest = projection?.restSeconds
        guard let raw = TrainingOps.workout(document.root, workoutId) else {
            guard let active else { return nil }
            return fromProjection(active, defaultRest: defaultRest)
        }
        let rawExercises = raw["exercises"]?.arrayValue ?? []
        var readable = active?.complete ?? true
        let groups = Dictionary(grouping: rawExercises.compactMap { item -> (String, String)? in
            guard let id = item["id"]?.stringValue, let group = item["superset"]?.stringValue, !group.isEmpty else { return nil }
            return (group, id)
        }, by: { $0.0 }).mapValues { pairs in pairs.map { $0.1 } }

        var exercises: [Exercise] = []
        for item in rawExercises {
            guard let id = item["id"]?.stringValue, !id.isEmpty else {
                readable = false
                continue
            }
            let meta = active?.exercise(id: id)
            let previous = meta?.previous
            let rawSets = item["sets"]?.arrayValue ?? []
            let sets = rawSets.enumerated().map { index, set -> SessionSet in
                let kg = SetValue(json: set["kg"]), reps = SetValue(json: set["reps"])
                if kg == nil || reps == nil { readable = false }
                let previousSet = previous.flatMap { $0.sets.indices.contains(index) ? $0.sets[index] : nil }
                return SessionSet(index: index, kg: kg, reps: reps, done: set["done"]?.boolValue == true,
                                  previous: previousSet ?? meta.flatMap { $0.sets.indices.contains(index) ? $0.sets[index].previous : nil })
            }
            let group = item["superset"]?.stringValue.flatMap { $0.isEmpty ? nil : $0 }
            let partners = group.flatMap { groups[$0] }.map { ids in ids.filter { $0 != id } } ?? []
            let restSeconds = item["restSeconds"]?.doubleValue
            exercises.append(Exercise(
                id: id,
                libraryId: item["exerciseId"]?.stringValue ?? meta?.libraryId,
                name: item["name"]?.stringValue ?? meta?.name ?? "",
                restSeconds: restSeconds,
                // Wie beim Abhaken im Web: gespeicherte Pause, sonst Standardpause.
                effectiveRestSeconds: restSeconds ?? meta?.effectiveRestSeconds ?? defaultRest,
                repMin: item["repMin"]?.doubleValue ?? meta?.repMin,
                repMax: item["repMax"]?.doubleValue ?? meta?.repMax,
                superset: group,
                supersetWith: partners,
                previousDate: previous?.date,
                sets: sets
            ))
        }
        let startedAt = raw["startedAt"]?.doubleValue ?? active?.startedAt
        return TrainingSessionModel(
            id: workoutId,
            name: raw["name"]?.stringValue ?? active?.name ?? "",
            date: raw["date"]?.stringValue ?? active?.date,
            routineId: raw["routineId"]?.stringValue ?? active?.routineId,
            startedAt: startedAt,
            autoFinishAt: active?.autoFinishAt,
            timeApprox: raw["timeApprox"]?.boolValue ?? active?.timeApprox ?? false,
            rest: RestInfo(raw["rest"]),
            finished: raw["finished"]?.boolValue == true,
            autoFinished: raw["autoFinished"]?.boolValue == true,
            exercises: exercises,
            isComplete: readable
        )
    }

    private static func fromProjection(_ active: ActiveWorkout, defaultRest: Double?) -> TrainingSessionModel {
        var readable = active.complete
        let exercises = active.exercises.map { exercise -> Exercise in
            let sets = exercise.sets.enumerated().map { index, set -> SessionSet in
                if !set.isReadable { readable = false }
                let previous = exercise.previous.flatMap { $0.sets.indices.contains(index) ? $0.sets[index] : nil }
                return SessionSet(index: index, kg: set.kg, reps: set.reps, done: set.done, previous: previous ?? set.previous)
            }
            return Exercise(
                id: exercise.id, libraryId: exercise.libraryId, name: exercise.name,
                restSeconds: exercise.restSeconds,
                effectiveRestSeconds: exercise.effectiveRestSeconds ?? exercise.restSeconds ?? defaultRest,
                repMin: exercise.repMin, repMax: exercise.repMax, superset: exercise.superset,
                supersetWith: exercise.supersetWith, previousDate: exercise.previous?.date, sets: sets
            )
        }
        return TrainingSessionModel(
            id: active.id, name: active.name, date: active.date, routineId: active.routineId,
            startedAt: active.startedAt, autoFinishAt: active.autoFinishAt, timeApprox: active.timeApprox,
            rest: active.rest, finished: false, autoFinished: false, exercises: exercises, isComplete: readable
        )
    }
}

/// Bearbeitbare Routine für den nativen Editor. Hält die rohen JSON-Objekte, damit unbekannte Felder der Routine
/// und ihrer Übungen beim Speichern erhalten bleiben (`routine.save` ersetzt die ganze Routine).
public struct RoutineDraft: Equatable, Sendable {
    public struct Item: Equatable, Sendable, Identifiable {
        /// Nur lokale Kennung im Editor (Routinenübungen haben im Web keine eigene ID).
        public var id: String
        public var raw: JSONValue
        public var libraryId: String
        public var sets: Int
        public var min: Int
        public var max: Int
        /// `nil` = Standardpause (Feld fehlt). Double, damit gespeicherte Bruchwerte (z. B. 45.5) verlustfrei bleiben.
        public var restSeconds: Double?
        public var superset: String?
    }

    public var id: String
    public var name: String
    public var items: [Item]
    /// Die rohe Routine beim Öffnen (`nil` = neu); zugleich `expect` für `routine.save`.
    public var original: JSONValue?
    var rawRoutine: JSONValue

    /// Neue Routine wie `routineForm()`: Name „Meine Routine“ bzw. „My routine“.
    public init(newID: String, name: String) {
        id = newID
        self.name = name
        items = []
        original = nil
        rawRoutine = .object([:])
    }

    /// Vorhandene Routine aus dem Spiegel. `nil`, wenn sie nicht lesbar ist (dann im Web bearbeiten).
    public init?(raw: JSONValue, makeID: () -> String) {
        guard case .object = raw, let id = raw["id"]?.stringValue, !id.isEmpty else { return nil }
        var items: [Item] = []
        for exercise in raw["exercises"]?.arrayValue ?? [] {
            guard let library = exercise["exerciseId"]?.stringValue, let sets = exercise["sets"]?.intValue,
                  let min = exercise["min"]?.intValue, let max = exercise["max"]?.intValue else { return nil }
            let rest = exercise["restSeconds"]
            if rest != nil, rest?.doubleValue == nil { return nil }
            items.append(Item(
                id: makeID(), raw: exercise, libraryId: library, sets: sets, min: min, max: max,
                restSeconds: rest?.doubleValue,
                superset: exercise["superset"]?.stringValue
            ))
        }
        self.id = id
        name = raw["name"]?.stringValue ?? ""
        self.items = items
        original = raw
        rawRoutine = raw
    }

    public static let setsRange = 1...12
    public static let repsRange = 1...100
    public static let restRange = 0...900

    public var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Regeln von `saveRoutine` plus `validData` (Name 1–80, mindestens eine Übung, Sätze 1–12, Wdh. 1–100 bis ≥ von,
    /// Pause 0–900 s).
    public var isValid: Bool {
        let name = trimmedName
        guard !name.isEmpty, name.count <= 80, !items.isEmpty else { return false }
        return items.allSatisfy { item in
            Self.setsRange.contains(item.sets) && Self.repsRange.contains(item.min) && Self.repsRange.contains(item.max)
                && item.max >= item.min
                && (item.restSeconds.map { $0 >= Double(Self.restRange.lowerBound) && $0 <= Double(Self.restRange.upperBound) } ?? true)
        }
    }

    public func contains(libraryId: String) -> Bool {
        items.contains { $0.libraryId == libraryId }
    }

    /// Neue Übung mit den Web-Standardwerten (3 Sätze, 6–10 Wdh.).
    public mutating func append(libraryId: String, itemID: String) {
        guard !contains(libraryId: libraryId) else { return }
        items.append(Item(id: itemID, raw: .object([:]), libraryId: libraryId, sets: 3, min: 6, max: 10,
                          restSeconds: nil, superset: nil))
    }

    /// Supersatz wie im Web: Partner mit Gruppe → deren Gruppe übernehmen, sonst neue Gruppe für beide;
    /// `nil` entfernt nur diese Übung aus ihrer Gruppe.
    public mutating func setSuperset(itemID: String, partnerID: String?, newGroup: () -> String) {
        guard let index = items.firstIndex(where: { $0.id == itemID }) else { return }
        guard let partnerID, partnerID != itemID, let partner = items.firstIndex(where: { $0.id == partnerID }) else {
            items[index].superset = nil
            return
        }
        let group = items[partner].superset ?? items[index].superset ?? newGroup()
        items[partner].superset = group
        items[index].superset = group
    }

    /// Rohe Routine für `routine.save`: bekannte Felder gesetzt, alles andere unverändert.
    public var routineJSON: JSONValue {
        var routine = rawRoutine
        routine["id"] = .string(id)
        routine["name"] = .string(trimmedName)
        routine["exercises"] = .array(items.map { item in
            var exercise = item.raw
            exercise["exerciseId"] = .string(item.libraryId)
            exercise["sets"] = .number(Double(item.sets))
            exercise["min"] = .number(Double(item.min))
            exercise["max"] = .number(Double(item.max))
            exercise["restSeconds"] = item.restSeconds.map { JSONValue.number($0) }
            exercise["superset"] = item.superset.map(JSONValue.string)
            return exercise
        })
        return routine
    }

    /// `expect` für `routine.save`: gesehene Routine oder `null` (neu).
    public var expect: JSONValue { original ?? .null }
}
