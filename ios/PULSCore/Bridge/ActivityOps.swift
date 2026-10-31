import Foundation

// M6: Aktivitäts-Ops aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §11.4 (Gegenstück: js/native-activity.js).
//
// - `expect` stammt aus dem **verlustfreien** Profil (Anzeige = Spiegel plus offene Befehle), nie aus der gekürzten
//   Projektion. Ein vom Aufrufer gesetztes `expect` (z. B. `editExpect` beim Öffnen) bleibt unverändert.
// - Optimistische Reducer nur, wo die Wirkung eindeutig ist (Verwerfen, Bearbeiten, Löschen, Einstellungen,
//   Route löschen) und `expect` zum Stand passt. Start, Pause, Runde, Abschluss und Speichern setzt allein das Web
//   (Zeitstempel, IDs, kcal, Strecke).
// - Wirkungsprüfungen (§7) lesen das gespeicherte Profil und `ack.result`. Besonders gegen doppeltes Replay:
//   `run.start` gilt als wirksam, solange die gestartete Aktivität aktiv **oder bereits gespeichert** ist;
//   `run.summary.save` verlangt die gespeicherte ID mit demselben `startedAt` und keine aktive mehr.

public enum ActivityOps {
    public static let runStart = "run.start"
    public static let runPause = "run.pause"
    public static let runResume = "run.resume"
    public static let runLap = "run.lap"
    public static let runFinish = "run.finish"
    public static let summarySave = "run.summary.save"
    public static let runDiscard = "run.discard"
    public static let runEdit = "run.edit"
    public static let runDelete = "run.delete"
    public static let settingsSet = "runSettings.set"
    public static let routeSave = "route.save"
    public static let routeDelete = "route.delete"

    public static let all: Set<String> = [
        runStart, runPause, runResume, runLap, runFinish, summarySave, runDiscard, runEdit, runDelete,
        settingsSet, routeSave, routeDelete,
    ]

    /// Steuerung der laufenden Aktivität: ein Konflikt heißt „Stand hat sich geändert“; Native zeigt den neuen Stand
    /// und bietet die Aktion neu an, statt den alten Befehl geparkt zu lassen (Koordinator-Entscheidung zu `run.start`).
    public static let liveControl: Set<String> = [
        runStart, runPause, runResume, runLap, runFinish, summarySave, runDiscard, settingsSet,
    ]

    public static func isActivity(_ op: String) -> Bool { all.contains(op) }

    /// Web `RUN_TERRAINS`.
    public static let terrains = ["road", "forest", "mixed", "trail", "track", "treadmill"]
    public static let noteLimit = 200

    // MARK: Lesen im Profil (exakte Rohwerte)

    static func nonNull(_ value: JSONValue?) -> JSONValue? {
        guard let value, !value.isNull else { return nil }
        return value
    }

    public static func activeRun(_ state: JSONValue) -> JSONValue? {
        guard case .object? = state["activeRun"] else { return nil }
        return state["activeRun"]
    }

    public static func runs(_ state: JSONValue) -> [JSONValue] {
        state["runs"]?.arrayValue ?? []
    }

    public static func run(_ state: JSONValue, id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return runs(state).first { $0["id"]?.stringValue == id }
    }

    public static func routes(_ state: JSONValue) -> [JSONValue] {
        state["runRoutes"]?.arrayValue ?? []
    }

    public static func route(_ state: JSONValue, id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return routes(state).first { $0["id"]?.stringValue == id }
    }

    /// `state.runs?.at(-1)?.id ?? null`.
    public static func lastRunId(_ state: JSONValue) -> JSONValue {
        nonNull(runs(state).last?["id"]) ?? .null
    }

    /// `run.segment || 0` (JS-Falsy: fehlend, null, 0).
    static func segment(_ run: JSONValue?) -> Double {
        guard let value = run?["segment"]?.doubleValue, value != 0, !value.isNaN else { return 0 }
        return value
    }

    static func sameStart(_ run: JSONValue?, _ startedAt: JSONValue?) -> Bool {
        guard let run, let value = run["startedAt"]?.doubleValue, let wanted = startedAt?.doubleValue else { return false }
        return value == wanted
    }

    /// Web `editable(r)`: `{type: r.type ?? 'run', feeling ?? null, terrain ?? null, note ?? ''}`.
    public static func editable(_ run: JSONValue) -> JSONValue {
        .object([
            "type": nonNull(run["type"]) ?? .string("run"),
            "feeling": nonNull(run["feeling"]) ?? .null,
            "terrain": nonNull(run["terrain"]) ?? .null,
            "note": nonNull(run["note"]) ?? .string(""),
        ])
    }

    /// Wie JS `trim()` für die Notiz.
    public static func trimmed(_ note: String) -> String {
        note.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{FEFF}")))
    }

    /// Notiz getrimmt und auf höchstens 200 UTF-16-Einheiten gekürzt (ohne Zeichen zu trennen).
    public static func limitedNote(_ note: String) -> String {
        var text = trimmed(note)
        while text.utf16.count > noteLimit { text.removeLast() }
        return trimmed(text)
    }

    /// Ziel von `run.edit`: `{type, feeling, terrain, note.trim()}`.
    static func editTarget(_ args: JSONValue) -> JSONValue? {
        guard let type = args["type"]?.stringValue, let note = args["note"]?.stringValue else { return nil }
        return .object([
            "type": .string(type),
            "feeling": args["feeling"] ?? .null,
            "terrain": args["terrain"] ?? .null,
            "note": .string(trimmed(note)),
        ])
    }

    /// Ziel von `runSettings.set`: `{...(expect || {}), lastType?, rounds?}`.
    public static func settingsTarget(_ args: JSONValue) -> JSONValue? {
        guard let expect = args["expect"] else { return nil }
        var target: [String: JSONValue]
        switch expect {
        case .null: target = [:]
        case .object(let object): target = object
        default: return nil
        }
        if let lastType = args["lastType"] { target["lastType"] = lastType }
        if let rounds = args["rounds"] { target["rounds"] = rounds }
        return .object(target)
    }

    /// Gespeicherte Koordinaten weichen höchstens um die 5-Nachkommastellen-Rundung (`toFixed(5)`) ab.
    static func sameLine(_ stored: JSONValue?, _ wanted: JSONValue?) -> Bool {
        guard let text = stored?.stringValue, let pairs = wanted?.arrayValue else { return false }
        let points = RouteLine.points(text)
        guard points.count == pairs.count, !points.isEmpty else { return false }
        for (point, pair) in zip(points, pairs) {
            guard let lat = pair[0]?.doubleValue, let lon = pair[1]?.doubleValue,
                  abs(point.lat - lat) <= 0.0000051, abs(point.lon - lon) <= 0.0000051 else { return false }
        }
        return true
    }
}

// MARK: - Preparer

extension BridgeOps {
    public static let activityPreparers: [String: CommandPreparer] = [
        ActivityOps.runStart: prepareRunStart,
        ActivityOps.runPause: prepareRunPause,
        ActivityOps.runResume: prepareRunResume,
        ActivityOps.runLap: prepareRunLap,
        ActivityOps.runEdit: prepareRunEditable,
        ActivityOps.runDelete: prepareRunEditable,
        ActivityOps.settingsSet: prepareRunSettings,
        ActivityOps.routeSave: prepareRouteSave,
        ActivityOps.routeDelete: prepareRouteDelete,
    ]

    private static func expecting(_ args: JSONValue, _ expect: JSONValue) -> JSONValue {
        var prepared = args
        prepared["expect"] = expect
        return prepared
    }

    /// `expect = {lastRunId}` (letzte gespeicherte Aktivität oder `null`).
    @Sendable
    public static func prepareRunStart(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return expecting(args, ["lastRunId": ActivityOps.lastRunId(document.root)])
    }

    /// `expect = {pausedAt:null, segment}`.
    @Sendable
    public static func prepareRunPause(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let run = ActivityOps.activeRun(document.root)
        return expecting(args, ["pausedAt": JSONValue.null, "segment": .number(ActivityOps.segment(run))])
    }

    /// `expect = {pausedAt, segment}` des angezeigten pausierten Laufs.
    @Sendable
    public static func prepareRunResume(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let run = ActivityOps.activeRun(document.root)
        return expecting(args, [
            "pausedAt": ActivityOps.nonNull(run?["pausedAt"]) ?? JSONValue.null,
            "segment": .number(ActivityOps.segment(run)),
        ])
    }

    /// `expect = {laps}` (bisherige kumulative Runden).
    @Sendable
    public static func prepareRunLap(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let laps = ActivityOps.activeRun(document.root)?["laps"]?.arrayValue ?? []
        return expecting(args, ["laps": .array(laps)])
    }

    /// `expect = editable(run)`; fehlt die Aktivität, der Web-Standard (das Web antwortet dann `gone`/noop).
    @Sendable
    public static func prepareRunEditable(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let run = ActivityOps.run(document.root, id: args["id"]?.stringValue) ?? .object([:])
        return expecting(args, ActivityOps.editable(run))
    }

    /// `expect` = rohes `runSettings` (inkl. Wochenziele/unbekannter Felder) oder `null`.
    @Sendable
    public static func prepareRunSettings(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let settings = document.root["runSettings"]
        if case .object? = settings, let settings { return expecting(args, settings) }
        return expecting(args, JSONValue.null)
    }

    @Sendable
    public static func prepareRouteSave(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return expecting(args, ActivityOps.route(document.root, id: args["route"]?["id"]?.stringValue) ?? JSONValue.null)
    }

    @Sendable
    public static func prepareRouteDelete(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return expecting(args, ActivityOps.route(document.root, id: args["id"]?.stringValue) ?? JSONValue.null)
    }
}

// MARK: - Optimistische Reducer

extension BridgeOps {
    public static let activityReducers: [String: OptimisticReducer] = [
        ActivityOps.runDiscard: reduceRunDiscard,
        ActivityOps.runEdit: reduceRunEdit,
        ActivityOps.runDelete: reduceRunDelete,
        ActivityOps.settingsSet: reduceRunSettings,
        ActivityOps.routeDelete: reduceRouteDelete,
    ]

    /// Aktive Aktivität mit diesem `startedAt` verschwindet (nicht, wenn sie schon gespeichert ist: dann `gone`).
    @Sendable
    public static func reduceRunDiscard(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, ActivityOps.sameStart(ActivityOps.activeRun(state), args["startedAt"]),
              !ActivityOps.runs(state).contains(where: { ActivityOps.sameStart($0, args["startedAt"]) }) else { return }
        state["activeRun"] = nil
    }

    /// Wie `runEditSave`: Typ (2–20 Kleinbuchstaben), Gefühl 1–5 sonst entfernt, Untergrund aus der Liste sonst
    /// entfernt, Notiz getrimmt (leer entfernt). Nur wenn `expect` zum Stand passt.
    @Sendable
    public static func reduceRunEdit(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, let expect = args["expect"],
              var list = state["runs"]?.arrayValue,
              let index = list.firstIndex(where: { $0["id"]?.stringValue == id }),
              ActivityOps.editable(list[index]) == expect,
              let type = args["type"]?.stringValue, let note = args["note"]?.stringValue else { return }
        var run = list[index]
        let typeScalars = type.unicodeScalars
        if (2...20).contains(typeScalars.count), typeScalars.allSatisfy({ $0 >= "a" && $0 <= "z" }) { run["type"] = .string(type) }
        if let feeling = args["feeling"]?.intValue, (1...5).contains(feeling) {
            run["feeling"] = .number(Double(feeling))
        } else {
            run["feeling"] = nil
        }
        if let terrain = args["terrain"]?.stringValue, ActivityOps.terrains.contains(terrain) {
            run["terrain"] = .string(terrain)
        } else {
            run["terrain"] = nil
        }
        let text = ActivityOps.limitedNote(note)
        run["note"] = text.isEmpty ? nil : JSONValue.string(text)
        list[index] = run
        state["runs"] = .array(list)
    }

    @Sendable
    public static func reduceRunDelete(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, let expect = args["expect"],
              let list = state["runs"]?.arrayValue,
              let run = list.first(where: { $0["id"]?.stringValue == id }), ActivityOps.editable(run) == expect else { return }
        state["runs"] = .array(list.filter { $0["id"]?.stringValue != id })
    }

    @Sendable
    public static func reduceRunSettings(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let target = ActivityOps.settingsTarget(args),
              (state["runSettings"] ?? .null) == args["expect"] else { return }
        state["runSettings"] = target
    }

    @Sendable
    public static func reduceRouteDelete(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, let expect = args["expect"], !expect.isNull,
              let list = state["runRoutes"]?.arrayValue,
              let route = list.first(where: { $0["id"]?.stringValue == id }), route == expect else { return }
        state["runRoutes"] = .array(list.filter { $0["id"]?.stringValue != id })
    }
}

// MARK: - Sichtbare Wirkung (§7, §11.4)

extension BridgeOps {
    public static let activityEffectChecks: [String: EffectCheck] = [
        // Aktiv mit dem Ergebnis-`startedAt` **oder** bereits gespeichert: nie ein zweiter Start per Replay.
        ActivityOps.runStart: { _, state, result in
            guard let startedAt = result?["startedAt"], startedAt.doubleValue != nil else { return false }
            return ActivityOps.sameStart(ActivityOps.activeRun(state), startedAt)
                || ActivityOps.runs(state).contains { ActivityOps.sameStart($0, startedAt) }
        },
        ActivityOps.runPause: { args, state, result in
            guard let run = ActivityOps.activeRun(state), ActivityOps.sameStart(run, args["startedAt"]),
                  let pausedAt = result?["pausedAt"]?.doubleValue, let segment = result?["segment"]?.doubleValue else { return false }
            return run["pausedAt"]?.doubleValue == pausedAt && ActivityOps.segment(run) == segment
        },
        ActivityOps.runResume: { args, state, result in
            guard let run = ActivityOps.activeRun(state), ActivityOps.sameStart(run, args["startedAt"]),
                  let segment = result?["segment"]?.doubleValue else { return false }
            return ActivityOps.nonNull(run["pausedAt"]) == nil && ActivityOps.segment(run) == segment
        },
        ActivityOps.runLap: { args, state, result in
            guard let run = ActivityOps.activeRun(state), ActivityOps.sameStart(run, args["startedAt"]),
                  let lap = result?["lap"], let seen = args["expect"]?["laps"]?.arrayValue else { return false }
            return run["laps"] == JSONValue.array(seen + [lap])
        },
        ActivityOps.runFinish: { args, state, result in
            guard let run = ActivityOps.activeRun(state), ActivityOps.sameStart(run, args["startedAt"]),
                  let pausedAt = result?["pausedAt"]?.doubleValue else { return false }
            return run["pausedAt"]?.doubleValue == pausedAt
        },
        // Gespeichert mit derselben ID und demselben `startedAt`, keine aktive mit diesem `startedAt` mehr.
        ActivityOps.summarySave: { args, state, result in
            guard let runId = result?["runId"]?.stringValue,
                  let run = ActivityOps.run(state, id: runId), ActivityOps.sameStart(run, args["startedAt"]) else { return false }
            return !ActivityOps.sameStart(ActivityOps.activeRun(state), args["startedAt"])
        },
        ActivityOps.runDiscard: { args, state, _ in
            !ActivityOps.sameStart(ActivityOps.activeRun(state), args["startedAt"])
        },
        ActivityOps.runEdit: { args, state, _ in
            guard let target = ActivityOps.editTarget(args),
                  let run = ActivityOps.run(state, id: args["id"]?.stringValue) else { return false }
            return ActivityOps.editable(run) == target
        },
        ActivityOps.runDelete: { args, state, _ in
            ActivityOps.run(state, id: args["id"]?.stringValue) == nil
        },
        ActivityOps.settingsSet: { args, state, _ in
            guard let target = ActivityOps.settingsTarget(args) else { return false }
            return state["runSettings"] == target
        },
        // Gespeicherte Web-Form: Name getrimmt, Koordinaten mit 5 Nachkommastellen, Distanz auf 0,01 km, Anstieg ganzzahlig.
        ActivityOps.routeSave: { args, state, _ in
            guard let wanted = args["route"], let id = wanted["id"]?.stringValue,
                  let route = ActivityOps.route(state, id: id),
                  let name = wanted["name"]?.stringValue, let km = wanted["distanceKm"]?.doubleValue else { return false }
            guard route["name"]?.stringValue == name.trimmingCharacters(in: .whitespacesAndNewlines),
                  route["distanceKm"]?.doubleValue == JSMath.round2(km),
                  ActivityOps.sameLine(route["line"], wanted["line"]),
                  ActivityOps.sameLine(route["waypoints"], wanted["waypoints"]) else { return false }
            if let ascent = wanted["ascentM"]?.doubleValue {
                return route["ascentM"]?.doubleValue == JSMath.round(ascent)
            }
            return route["ascentM"] == nil
        },
        ActivityOps.routeDelete: { args, state, _ in
            ActivityOps.route(state, id: args["id"]?.stringValue) == nil
        },
    ]
}

// MARK: - Befehle

/// Befehle der nativen Aktivitätsoberfläche. `expect` ergänzt der Store aus der aktuellen Anzeige.
/// `nil` = das Web würde `invalid` antworten (Grenzen aus §11.4 schon nativ geprüft).
public enum ActivityCommands {
    /// Start nach dem nativen Countdown. `routeId` nur bei GPS-Arten, `rounds` nur bei MMA.
    public static func start(type: String, routeId: String? = nil, rounds: RoundSettings? = nil) -> Command? {
        guard !type.isEmpty else { return nil }
        var args: JSONValue = ["type": .string(type)]
        if let routeId {
            guard ActivityIDs.isValid(routeId) else { return nil }
            args["routeId"] = .string(routeId)
        }
        if let rounds {
            guard type == "mma", rounds.isValid else { return nil }
            args["rounds"] = rounds.json
        }
        return Command(op: ActivityOps.runStart, args: args)
    }

    private static func target(_ op: String, _ startedAt: Double) -> Command? {
        guard startedAt.isFinite, startedAt >= 0 else { return nil }
        return Command(op: op, args: ["startedAt": .number(startedAt)])
    }

    public static func pause(startedAt: Double) -> Command? { target(ActivityOps.runPause, startedAt) }
    public static func resume(startedAt: Double) -> Command? { target(ActivityOps.runResume, startedAt) }
    public static func lap(startedAt: Double) -> Command? { target(ActivityOps.runLap, startedAt) }
    public static func finish(startedAt: Double) -> Command? { target(ActivityOps.runFinish, startedAt) }
    public static func discard(startedAt: Double) -> Command? { target(ActivityOps.runDiscard, startedAt) }

    /// Abschluss speichern. `manualKm` nur bei GPS ohne Strecke; `.none` = keine Eingabe (Feld fehlt), `.km(0)` = 0 km.
    public static func saveSummary(startedAt: Double, pausedAt: Double, feeling: Int?, terrain: String?, note: String,
                                   manualKm: ManualDistance) -> Command? {
        guard startedAt.isFinite, pausedAt.isFinite else { return nil }
        if let feeling { guard (1...5).contains(feeling) else { return nil } }
        if let terrain { guard ActivityOps.terrains.contains(terrain) else { return nil } }
        var args: JSONValue = [
            "startedAt": .number(startedAt), "pausedAt": .number(pausedAt),
            "feeling": feeling.map { JSONValue.number(Double($0)) } ?? .null,
            "terrain": terrain.map(JSONValue.string) ?? .null,
            "note": .string(ActivityOps.limitedNote(note)),
        ]
        switch manualKm {
        case .none: break
        case .km, .text:
            guard let km = manualKm.kilometres, km >= 0, km <= 1000 else { return nil }
            args["manualKm"] = .number(km)
        }
        return Command(op: ActivityOps.summarySave, args: args)
    }

    /// `expect` = beim Öffnen gesehenes `editExpect` (roh); ein inzwischen geänderter Stand führt zu `conflict`.
    public static func edit(id: String, type: String, feeling: Int?, terrain: String?, note: String, expect: ActivityEdit?) -> Command? {
        guard ActivityIDs.isValid(id), !type.isEmpty else { return nil }
        if let feeling { guard (1...5).contains(feeling) else { return nil } }
        if let terrain { guard ActivityOps.terrains.contains(terrain) else { return nil } }
        var args: JSONValue = [
            "id": .string(id), "type": .string(type),
            "feeling": feeling.map { JSONValue.number(Double($0)) } ?? .null,
            "terrain": terrain.map(JSONValue.string) ?? .null,
            "note": .string(ActivityOps.limitedNote(note)),
        ]
        if let expect { args["expect"] = expect.raw }
        return Command(op: ActivityOps.runEdit, args: args)
    }

    public static func delete(id: String, expect: ActivityEdit?) -> Command? {
        guard ActivityIDs.isValid(id) else { return nil }
        var args: JSONValue = ["id": .string(id)]
        if let expect { args["expect"] = expect.raw }
        return Command(op: ActivityOps.runDelete, args: args)
    }

    /// Mindestens Art oder Runden.
    public static func settings(lastType: String? = nil, rounds: RoundSettings? = nil) -> Command? {
        guard lastType != nil || rounds != nil else { return nil }
        var args: JSONValue = [:]
        if let lastType {
            guard !lastType.isEmpty else { return nil }
            args["lastType"] = .string(lastType)
        }
        if let rounds {
            guard rounds.isValid else { return nil }
            args["rounds"] = rounds.json
        }
        return Command(op: ActivityOps.settingsSet, args: args)
    }

    public static func deleteRoute(id: String) -> Command? {
        guard ActivityIDs.isValid(id) else { return nil }
        return Command(op: ActivityOps.routeDelete, args: ["id": .string(id)])
    }

    /// Route mit von Native erzeugter stabiler ID (Planer). Grenzen wie `route.save`.
    public static func saveRoute(id: String, name: String, line: [GeoPoint], waypoints: [GeoPoint], distanceKm: Double,
                                 ascentM: Double?) -> Command? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard ActivityIDs.isValid(id), !trimmed.isEmpty, trimmed.count <= 60,
              (2...800).contains(line.count), (2...60).contains(waypoints.count),
              distanceKm.isFinite, distanceKm >= 0, distanceKm <= 1000 else { return nil }
        let valid = { (point: GeoPoint) in abs(point.lat) <= 90 && abs(point.lon) <= 180 && point.lat.isFinite && point.lon.isFinite }
        guard line.allSatisfy(valid), waypoints.allSatisfy(valid) else { return nil }
        let pairs = { (points: [GeoPoint]) -> JSONValue in
            JSONValue.array(points.map { JSONValue.array([JSONValue.number($0.lat), JSONValue.number($0.lon)]) })
        }
        var route: JSONValue = [
            "id": .string(id), "name": .string(trimmed), "line": pairs(line), "waypoints": pairs(waypoints),
            "distanceKm": .number(distanceKm),
        ]
        if let ascentM {
            guard ascentM.isFinite, ascentM >= 0, ascentM <= 100_000 else { return nil }
            route["ascentM"] = .number(ascentM)
        }
        return Command(op: ActivityOps.routeSave, args: ["route": route])
    }
}
