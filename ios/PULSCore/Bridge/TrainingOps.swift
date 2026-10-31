import Foundation

// M4: Trainings-Ops aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §9.4 (Gegenstück: js/native-training.js).
//
// - Preparer ergänzen `expect` aus der aktuellen Anzeige (Spiegel plus offene Befehle), nur wenn der Aufrufer
//   keines gesetzt hat. So bauen mehrere Befehle hintereinander auf derselben Reihenfolge auf wie im Web.
// - Optimistische Reducer nur für Ops mit eindeutig vorhersagbarer Wirkung (Satzwerte, letzten Satz entfernen,
//   Übung entfernen/verschieben, Pause beenden, Verwerfen, Routine löschen) und nur, wenn `expect` zum Stand passt.
//   Vorbelegung, neue IDs, Pausenzeiten, XP und Abschluss berechnet ausschließlich das Web.
// - Wirkungsprüfungen (Protokoll §7/§9.4 „Sichtbare Wirkung“) lesen das gespeicherte Profil und `ack.result`.

public enum TrainingOps {
    public static let workoutStart = "workout.start"
    public static let setUpdate = "set.update"
    public static let setAdd = "set.add"
    public static let setRemove = "set.remove"
    public static let exerciseAdd = "exercise.add"
    public static let exerciseRemove = "exercise.remove"
    public static let exerciseMove = "exercise.move"
    public static let supersetSet = "superset.set"
    public static let restAdjust = "rest.adjust"
    public static let restSkip = "rest.skip"
    public static let workoutFinish = "workout.finish"
    public static let workoutDiscard = "workout.discard"
    public static let routineSave = "routine.save"
    public static let routineDelete = "routine.delete"
    public static let exerciseCreate = "exercise.create"

    /// Alle 15 Ops; der native Trainingsbereich braucht jede davon.
    public static let all: Set<String> = [
        workoutStart, setUpdate, setAdd, setRemove, exerciseAdd, exerciseRemove, exerciseMove, supersetSet,
        restAdjust, restSkip, workoutFinish, workoutDiscard, routineSave, routineDelete, exerciseCreate,
    ]

    public static func isTraining(_ op: String) -> Bool { all.contains(op) }

    // MARK: Lesen im Profil

    static func workouts(_ state: JSONValue) -> [JSONValue] {
        state["workouts"]?.arrayValue ?? []
    }

    public static func workout(_ state: JSONValue, _ id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return workouts(state).first { $0["id"]?.stringValue == id }
    }

    public static func exercise(_ state: JSONValue, _ workoutId: String?, _ exerciseId: String?) -> JSONValue? {
        guard let exerciseId, !exerciseId.isEmpty else { return nil }
        return workout(state, workoutId)?["exercises"]?.arrayValue?.first { $0["id"]?.stringValue == exerciseId }
    }

    public static func routine(_ state: JSONValue, _ id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return state["routines"]?.arrayValue?.first { $0["id"]?.stringValue == id }
    }

    /// `{kg, reps, done}` eines gespeicherten Satzes (wie `setView` im Web).
    static func setView(_ set: JSONValue) -> JSONValue {
        .object(["kg": set["kg"] ?? .null, "reps": set["reps"] ?? .null, "done": set["done"] ?? .null])
    }

    static func validKg(_ value: SetValue) -> Bool {
        switch value {
        case .empty: return true
        case .number(let kg): return kg >= 0 && kg <= 1000
        }
    }

    static func validReps(_ value: SetValue) -> Bool {
        switch value {
        case .empty: return true
        case .number(let reps): return reps == reps.rounded() && reps >= 1 && reps <= 1000
        }
    }

    /// Zielzustand eines `set.update` wie die Web-Prüfung: fehlende Felder bleiben, ein geleertes kg/reps setzt
    /// „nicht erledigt“, „erledigt“ braucht kg und reps ≥ 1. `nil` = das Web würde `invalid` antworten.
    public static func setTarget(current: JSONValue, args: JSONValue) -> JSONValue? {
        let hasKg = args["kg"] != nil, hasReps = args["reps"] != nil, hasDone = args["done"] != nil
        guard hasKg || hasReps || hasDone else { return nil }
        var kg = current["kg"] ?? .null, reps = current["reps"] ?? .null, done = current["done"] ?? .null
        if hasKg {
            guard let value = SetValue(json: args["kg"]), validKg(value) else { return nil }
            kg = value.json
        }
        if hasReps {
            guard let value = SetValue(json: args["reps"]), validReps(value) else { return nil }
            reps = value.json
        }
        if hasDone {
            guard let flag = args["done"]?.boolValue else { return nil }
            done = .bool(flag)
        }
        if args["kg"] == JSONValue.string("") || args["reps"] == JSONValue.string("") {
            if args["done"]?.boolValue == true { return nil }
            done = .bool(false)
        }
        if done == .bool(true) {
            guard kg != .string(""), let repsValue = reps.doubleValue, repsValue >= 1 else { return nil }
        }
        return .object(["kg": kg, "reps": reps, "done": done])
    }

    /// Reihenfolge nach `placeExercise`: entfernen, dann bei `toIndex` einfügen.
    public static func movedOrder(_ order: [String], moving id: String, to index: Int) -> [String]? {
        guard let from = order.firstIndex(of: id), index >= 0, index < order.count else { return nil }
        var result = order
        let item = result.remove(at: from)
        result.insert(item, at: index)
        return result
    }

    // MARK: Ändern (für Reducer)

    static func updateWorkout(_ state: inout JSONValue, id: String, _ change: (inout JSONValue) -> Void) {
        guard var list = state["workouts"]?.arrayValue,
              let index = list.firstIndex(where: { $0["id"]?.stringValue == id }) else { return }
        change(&list[index])
        state["workouts"] = .array(list)
    }

    static func updateExercise(_ workout: inout JSONValue, id: String, _ change: (inout JSONValue) -> Void) {
        guard var list = workout["exercises"]?.arrayValue,
              let index = list.firstIndex(where: { $0["id"]?.stringValue == id }) else { return }
        change(&list[index])
        workout["exercises"] = .array(list)
    }
}

// MARK: - Preparer

extension BridgeOps {
    public static let trainingPreparers: [String: CommandPreparer] = [
        TrainingOps.setUpdate: prepareSetUpdate,
        TrainingOps.setAdd: prepareSetCount,
        TrainingOps.setRemove: prepareSetCount,
        TrainingOps.exerciseAdd: prepareExerciseCount,
        TrainingOps.exerciseRemove: prepareExerciseRemove,
        TrainingOps.exerciseMove: prepareExerciseMove,
        TrainingOps.restAdjust: prepareRestEndAt,
        TrainingOps.restSkip: prepareRestEndAt,
        TrainingOps.routineSave: prepareRoutineSave,
    ]

    private static func setExpect(_ args: JSONValue, _ expect: JSONValue) -> JSONValue {
        var prepared = args
        prepared["expect"] = expect
        return prepared
    }

    /// `expect = {kg, reps, done}` des angezeigten Satzes.
    @Sendable
    public static func prepareSetUpdate(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let index = args["setIndex"]?.intValue,
              let sets = TrainingOps.exercise(document.root, args["workoutId"]?.stringValue,
                                              args["exerciseId"]?.stringValue)?["sets"]?.arrayValue,
              sets.indices.contains(index) else { return args }
        return setExpect(args, TrainingOps.setView(sets[index]))
    }

    /// `expect = {setCount}` für `set.add` / `set.remove`.
    @Sendable
    public static func prepareSetCount(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil,
              let sets = TrainingOps.exercise(document.root, args["workoutId"]?.stringValue,
                                              args["exerciseId"]?.stringValue)?["sets"]?.arrayValue else { return args }
        return setExpect(args, ["setCount": .number(Double(sets.count))])
    }

    /// `expect = {exerciseCount}` für `exercise.add`.
    @Sendable
    public static func prepareExerciseCount(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil,
              let workout = TrainingOps.workout(document.root, args["workoutId"]?.stringValue) else { return args }
        let count = workout["exercises"]?.arrayValue?.count ?? 0
        return setExpect(args, ["exerciseCount": .number(Double(count))])
    }

    /// `expect = {doneSets}` der angezeigten Übung (fehlt sie, meldet das Web ohnehin `noop`).
    @Sendable
    public static func prepareExerciseRemove(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let sets = TrainingOps.exercise(document.root, args["workoutId"]?.stringValue,
                                        args["exerciseId"]?.stringValue)?["sets"]?.arrayValue ?? []
        let done = sets.filter { $0["done"]?.boolValue == true }.count
        return setExpect(args, ["doneSets": .number(Double(done))])
    }

    /// `expect = {order}` der angezeigten Übungen.
    @Sendable
    public static func prepareExerciseMove(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil,
              let exercises = TrainingOps.workout(document.root, args["workoutId"]?.stringValue)?["exercises"]?.arrayValue
        else { return args }
        let order = exercises.compactMap { $0["id"]?.stringValue }
        return setExpect(args, ["order": .array(order.map(JSONValue.string))])
    }

    /// `expect = {endAt}` der angezeigten Pause.
    @Sendable
    public static func prepareRestEndAt(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil,
              let endAt = TrainingOps.workout(document.root, args["workoutId"]?.stringValue)?["rest"]?["endAt"]?.doubleValue
        else { return args }
        return setExpect(args, ["endAt": .number(endAt)])
    }

    /// `expect` = bisherige rohe Routine (mit unbekannten Feldern) oder `null` für eine neue.
    @Sendable
    public static func prepareRoutineSave(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let id = args["routine"]?["id"]?.stringValue else { return args }
        return setExpect(args, TrainingOps.routine(document.root, id) ?? .null)
    }
}

// MARK: - Optimistische Reducer

extension BridgeOps {
    public static let trainingReducers: [String: OptimisticReducer] = [
        TrainingOps.setUpdate: reduceSetUpdate,
        TrainingOps.setRemove: reduceSetRemove,
        TrainingOps.exerciseRemove: reduceExerciseRemove,
        TrainingOps.exerciseMove: reduceExerciseMove,
        TrainingOps.restSkip: reduceRestSkip,
        TrainingOps.workoutDiscard: reduceWorkoutDiscard,
        TrainingOps.routineDelete: reduceRoutineDelete,
    ]

    private static func openWorkoutArgs(_ state: JSONValue, _ args: JSONValue) -> String? {
        guard let id = args["workoutId"]?.stringValue, let workout = TrainingOps.workout(state, id),
              workout["finished"]?.boolValue != true else { return nil }
        return id
    }

    /// Satzwerte wie `setValue`; „nicht erledigt“ beendet die Pause dieser Übung (Web-Regel). Eine neue Pause beim
    /// Abhaken startet erst mit dem Web-Snapshot.
    @Sendable
    public static func reduceSetUpdate(_ state: inout JSONValue, _ args: JSONValue) {
        guard let workoutId = openWorkoutArgs(state, args), let exerciseId = args["exerciseId"]?.stringValue,
              let index = args["setIndex"]?.intValue, index >= 0 else { return }
        var clearsRest = false
        TrainingOps.updateWorkout(&state, id: workoutId) { workout in
            TrainingOps.updateExercise(&workout, id: exerciseId) { exercise in
                guard var sets = exercise["sets"]?.arrayValue, sets.indices.contains(index),
                      let target = TrainingOps.setTarget(current: sets[index], args: args) else { return }
                let current = TrainingOps.setView(sets[index])
                if let expect = args["expect"], expect != current, target != current { return }
                sets[index]["kg"] = target["kg"]
                sets[index]["reps"] = target["reps"]
                sets[index]["done"] = target["done"]
                exercise["sets"] = .array(sets)
                clearsRest = args["done"]?.boolValue == false
            }
            if clearsRest, workout["rest"]?["exerciseId"]?.stringValue == exerciseId {
                workout["rest"] = .null
            }
        }
    }

    @Sendable
    public static func reduceSetRemove(_ state: inout JSONValue, _ args: JSONValue) {
        guard let workoutId = openWorkoutArgs(state, args), let exerciseId = args["exerciseId"]?.stringValue,
              let expected = args["expect"]?["setCount"]?.intValue, expected >= 2 else { return }
        TrainingOps.updateWorkout(&state, id: workoutId) { workout in
            TrainingOps.updateExercise(&workout, id: exerciseId) { exercise in
                guard var sets = exercise["sets"]?.arrayValue, sets.count == expected else { return }
                sets.removeLast()
                exercise["sets"] = .array(sets)
            }
        }
    }

    @Sendable
    public static func reduceExerciseRemove(_ state: inout JSONValue, _ args: JSONValue) {
        guard let workoutId = openWorkoutArgs(state, args), let exerciseId = args["exerciseId"]?.stringValue,
              let expected = args["expect"]?["doneSets"]?.intValue else { return }
        TrainingOps.updateWorkout(&state, id: workoutId) { workout in
            guard var list = workout["exercises"]?.arrayValue,
                  let index = list.firstIndex(where: { $0["id"]?.stringValue == exerciseId }) else { return }
            let done = (list[index]["sets"]?.arrayValue ?? []).filter { $0["done"]?.boolValue == true }.count
            guard done == expected else { return }
            list.remove(at: index)
            workout["exercises"] = .array(list)
            if workout["rest"]?["exerciseId"]?.stringValue == exerciseId { workout["rest"] = .null }
        }
    }

    @Sendable
    public static func reduceExerciseMove(_ state: inout JSONValue, _ args: JSONValue) {
        guard let workoutId = openWorkoutArgs(state, args), let exerciseId = args["exerciseId"]?.stringValue,
              let toIndex = args["toIndex"]?.intValue,
              let seen = args["expect"]?["order"]?.arrayValue?.compactMap(\.stringValue),
              let wanted = TrainingOps.movedOrder(seen, moving: exerciseId, to: toIndex) else { return }
        TrainingOps.updateWorkout(&state, id: workoutId) { workout in
            guard let list = workout["exercises"]?.arrayValue else { return }
            let order = list.compactMap { $0["id"]?.stringValue }
            guard order == seen, order.count == list.count else { return }
            let byId = Dictionary(list.map { ($0["id"]?.stringValue ?? "", $0) }, uniquingKeysWith: { first, _ in first })
            workout["exercises"] = .array(wanted.compactMap { byId[$0] })
        }
    }

    @Sendable
    public static func reduceRestSkip(_ state: inout JSONValue, _ args: JSONValue) {
        guard let workoutId = openWorkoutArgs(state, args), let endAt = args["expect"]?["endAt"]?.doubleValue else { return }
        TrainingOps.updateWorkout(&state, id: workoutId) { workout in
            if workout["rest"]?["endAt"]?.doubleValue == endAt { workout["rest"] = .null }
        }
    }

    @Sendable
    public static func reduceWorkoutDiscard(_ state: inout JSONValue, _ args: JSONValue) {
        guard let workoutId = openWorkoutArgs(state, args), let list = state["workouts"]?.arrayValue else { return }
        state["workouts"] = .array(list.filter { $0["id"]?.stringValue != workoutId })
    }

    @Sendable
    public static func reduceRoutineDelete(_ state: inout JSONValue, _ args: JSONValue) {
        guard let id = args["routineId"]?.stringValue, !id.isEmpty, let list = state["routines"]?.arrayValue else { return }
        state["routines"] = .array(list.filter { $0["id"]?.stringValue != id })
    }
}

// MARK: - Sichtbare Wirkung (Protokoll §9.4)

extension BridgeOps {
    public static let trainingEffectChecks: [String: EffectCheck] = [
        // Koordinator-Entscheidung (§9.4): Das gestartete Workout existiert, offen **oder bereits abgeschlossen**.
        // Ein inzwischen beendetes Workout darf nach einem Neustart kein zweites per Replay erzeugen.
        TrainingOps.workoutStart: { _, state, result in
            TrainingOps.workout(state, result?["workoutId"]?.stringValue) != nil
        },
        TrainingOps.setUpdate: { args, state, _ in
            guard let index = args["setIndex"]?.intValue,
                  let sets = TrainingOps.exercise(state, args["workoutId"]?.stringValue,
                                                  args["exerciseId"]?.stringValue)?["sets"]?.arrayValue,
                  sets.indices.contains(index), let target = TrainingOps.setTarget(current: sets[index], args: args)
            else { return false }
            return TrainingOps.setView(sets[index]) == target
        },
        TrainingOps.setAdd: { args, state, _ in
            BridgeOps.setCount(args, state).map { $0 == (args["expect"]?["setCount"]?.intValue ?? -2) + 1 } ?? false
        },
        TrainingOps.setRemove: { args, state, _ in
            BridgeOps.setCount(args, state).map { $0 == (args["expect"]?["setCount"]?.intValue ?? -2) - 1 } ?? false
        },
        TrainingOps.exerciseAdd: { args, state, result in
            TrainingOps.exercise(state, args["workoutId"]?.stringValue, result?["exerciseId"]?.stringValue) != nil
        },
        TrainingOps.exerciseRemove: { args, state, _ in
            guard TrainingOps.workout(state, args["workoutId"]?.stringValue)?["exercises"]?.arrayValue != nil else { return false }
            return TrainingOps.exercise(state, args["workoutId"]?.stringValue, args["exerciseId"]?.stringValue) == nil
        },
        TrainingOps.exerciseMove: { args, state, _ in
            guard let id = args["exerciseId"]?.stringValue, let toIndex = args["toIndex"]?.intValue,
                  let seen = args["expect"]?["order"]?.arrayValue?.compactMap(\.stringValue),
                  let wanted = TrainingOps.movedOrder(seen, moving: id, to: toIndex),
                  let list = TrainingOps.workout(state, args["workoutId"]?.stringValue)?["exercises"]?.arrayValue
            else { return false }
            return list.map { $0["id"]?.stringValue ?? "" } == wanted
        },
        TrainingOps.supersetSet: { args, state, _ in
            let workoutId = args["workoutId"]?.stringValue
            guard let exercise = TrainingOps.exercise(state, workoutId, args["exerciseId"]?.stringValue) else { return false }
            guard let partnerId = args["partnerId"]?.stringValue else { return exercise["superset"] == nil }
            let group = exercise["superset"]?.stringValue
            return group != nil && group != "" && TrainingOps.exercise(state, workoutId, partnerId)?["superset"]?.stringValue == group
        },
        TrainingOps.restAdjust: { args, state, result in
            guard let workout = TrainingOps.workout(state, args["workoutId"]?.stringValue) else { return false }
            let rest = workout["rest"]
            if result?["endAt"] == JSONValue.null { return rest == nil || rest == JSONValue.null }
            guard let endAt = result?["endAt"]?.doubleValue else { return false }
            return rest?["endAt"]?.doubleValue == endAt
        },
        TrainingOps.restSkip: { args, state, _ in
            guard let workout = TrainingOps.workout(state, args["workoutId"]?.stringValue) else { return false }
            guard let endAt = workout["rest"]?["endAt"]?.doubleValue else { return true }
            return endAt != args["expect"]?["endAt"]?.doubleValue
        },
        TrainingOps.workoutFinish: { args, state, _ in
            TrainingOps.workout(state, args["workoutId"]?.stringValue)?["finished"] == JSONValue.bool(true)
        },
        TrainingOps.workoutDiscard: { args, state, _ in
            state["workouts"]?.arrayValue != nil && TrainingOps.workout(state, args["workoutId"]?.stringValue) == nil
        },
        TrainingOps.routineSave: { args, state, _ in
            guard var target = args["routine"], case .object = target, let id = target["id"]?.stringValue,
                  let name = target["name"]?.stringValue else { return false }
            target["name"] = .string(name.trimmingCharacters(in: .whitespacesAndNewlines))
            return TrainingOps.routine(state, id) == target
        },
        TrainingOps.routineDelete: { args, state, _ in
            state["routines"]?.arrayValue != nil && TrainingOps.routine(state, args["routineId"]?.stringValue) == nil
        },
        TrainingOps.exerciseCreate: { _, state, result in
            guard let id = result?["libraryId"]?.stringValue else { return false }
            return (state["exerciseBook"]?.arrayValue ?? []).contains { $0["id"]?.stringValue == id }
        },
    ]

    static func setCount(_ args: JSONValue, _ state: JSONValue) -> Int? {
        TrainingOps.exercise(state, args["workoutId"]?.stringValue, args["exerciseId"]?.stringValue)?["sets"]?.arrayValue?.count
    }
}

// MARK: - Befehle

/// Befehle der nativen Trainingsoberfläche. `expect` ergänzt der Store aus der aktuellen Anzeige.
public enum TrainingCommands {
    /// Routine starten (`routineId`) oder freies Training mit Namen (1–80 Zeichen, getrimmt).
    public static func start(routineId: String) -> Command {
        Command(op: TrainingOps.workoutStart, args: ["routineId": .string(routineId)])
    }

    public static func startEmpty(name: String) -> Command {
        Command(op: TrainingOps.workoutStart,
                args: ["routineId": .null, "name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines))])
    }

    /// Nur die geänderten Felder eines Satzes, gebündelt in einer Op. `expect` = `{kg, reps, done}`, wie der Satz zu
    /// **Beginn** der Bearbeitung aussah (`setExpect`); ohne Angabe ergänzt der Store den aktuell angezeigten Stand.
    /// So überschreibt eine lange offene Eingabe nie still eine zwischenzeitliche Änderung eines anderen Geräts.
    public static func updateSet(workoutId: String, exerciseId: String, setIndex: Int,
                                 kg: SetValue? = nil, reps: SetValue? = nil, done: Bool? = nil,
                                 expect: JSONValue? = nil) -> Command {
        var args: JSONValue = [
            "workoutId": .string(workoutId), "exerciseId": .string(exerciseId), "setIndex": .number(Double(setIndex)),
        ]
        if let kg { args["kg"] = kg.json }
        if let reps { args["reps"] = reps.json }
        if let done { args["done"] = .bool(done) }
        if let expect { args["expect"] = expect }
        return Command(op: TrainingOps.setUpdate, args: args)
    }

    /// `expect` eines Satzes aus gesehenen Werten (`nil` = nicht lesbar → `null`, das Web antwortet dann `invalid`).
    public static func setExpect(kg: SetValue?, reps: SetValue?, done: Bool) -> JSONValue {
        ["kg": kg?.json ?? .null, "reps": reps?.json ?? .null, "done": .bool(done)]
    }

    private static func exerciseArgs(_ workoutId: String, _ exerciseId: String) -> JSONValue {
        ["workoutId": .string(workoutId), "exerciseId": .string(exerciseId)]
    }

    public static func addSet(workoutId: String, exerciseId: String) -> Command {
        Command(op: TrainingOps.setAdd, args: exerciseArgs(workoutId, exerciseId))
    }

    public static func removeLastSet(workoutId: String, exerciseId: String) -> Command {
        Command(op: TrainingOps.setRemove, args: exerciseArgs(workoutId, exerciseId))
    }

    public static func addExercise(workoutId: String, libraryId: String) -> Command {
        Command(op: TrainingOps.exerciseAdd, args: ["workoutId": .string(workoutId), "libraryId": .string(libraryId)])
    }

    public static func addExercise(workoutId: String, name: String) -> Command {
        Command(op: TrainingOps.exerciseAdd, args: [
            "workoutId": .string(workoutId), "name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines)),
        ])
    }

    public static func removeExercise(workoutId: String, exerciseId: String) -> Command {
        Command(op: TrainingOps.exerciseRemove, args: exerciseArgs(workoutId, exerciseId))
    }

    public static func moveExercise(workoutId: String, exerciseId: String, toIndex: Int) -> Command {
        var args = exerciseArgs(workoutId, exerciseId)
        args["toIndex"] = .number(Double(toIndex))
        return Command(op: TrainingOps.exerciseMove, args: args)
    }

    /// `partnerId == nil` entfernt nur diese Übung aus ihrer Gruppe (Web-Semantik).
    public static func superset(workoutId: String, exerciseId: String, partnerId: String?) -> Command {
        var args = exerciseArgs(workoutId, exerciseId)
        args["partnerId"] = partnerId.map(JSONValue.string) ?? .null
        return Command(op: TrainingOps.supersetSet, args: args)
    }

    /// `seconds` ist `30` oder `-30`.
    public static func adjustRest(workoutId: String, seconds: Int) -> Command {
        Command(op: TrainingOps.restAdjust, args: ["workoutId": .string(workoutId), "seconds": .number(seconds < 0 ? -30 : 30)])
    }

    public static func skipRest(workoutId: String) -> Command {
        Command(op: TrainingOps.restSkip, args: ["workoutId": .string(workoutId)])
    }

    public static func finish(workoutId: String, bodyweight: Double?, confirmUnfinished: Bool) -> Command {
        Command(op: TrainingOps.workoutFinish, args: [
            "workoutId": .string(workoutId),
            "bodyweight": bodyweight.map(JSONValue.number) ?? .null,
            "confirmUnfinished": .bool(confirmUnfinished),
        ])
    }

    public static func discard(workoutId: String) -> Command {
        Command(op: TrainingOps.workoutDiscard, args: ["workoutId": .string(workoutId)])
    }

    /// `routine` ist die vollständige rohe Routine (unbekannte Felder bleiben erhalten). `expect` = beim Öffnen
    /// gesehene rohe Routine bzw. `.null` für eine neue; ein inzwischen geänderter Stand führt zu `conflict`.
    public static func saveRoutine(_ routine: JSONValue, expect: JSONValue) -> Command {
        Command(op: TrainingOps.routineSave, args: ["routine": routine, "expect": expect])
    }

    public static func deleteRoutine(id: String) -> Command {
        Command(op: TrainingOps.routineDelete, args: ["routineId": .string(id)])
    }

    public static func createExercise(name: String) -> Command {
        Command(op: TrainingOps.exerciseCreate, args: ["name": .string(name.trimmingCharacters(in: .whitespacesAndNewlines))])
    }

    /// Katalogtreffer der Übungssuche (`items[].id`) als Bibliothekseintrag übernehmen (Web `ensureBook`: Name,
    /// Muskeln, Gerät bleiben erhalten). Ist der Schlüssel schon eine Bibliotheks-ID, kommt der bestehende Eintrag.
    public static func createExercise(catalogKey: String) -> Command {
        Command(op: TrainingOps.exerciseCreate, args: ["catalogKey": .string(catalogKey)])
    }
}
