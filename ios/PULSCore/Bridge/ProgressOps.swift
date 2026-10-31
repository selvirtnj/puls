import Foundation

// M5: Einstellungs-Ops aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §10.4 (Gegenstück: js/native-progress.js).
//
// - `expect` ist der exakt beobachtete Teil des **verlustfreien** Profils (Anzeige = Spiegel plus offene Befehle),
//   einschließlich unbekannter Erweiterungsfelder. Fehlendes Objekt/Feld ist `null`. Nie aus der gekürzten Projektion.
// - Die Zielwirkung ergibt sich vollständig aus `args` (bisheriges Objekt aus `expect` plus gewünschte Werte) und ist
//   damit mit dem Befehl persistent in der Outbox (§7). Projektion und `progressResult` bestätigen nichts.
// - Reducer zeigen nur diese eindeutig vorhersagbare Wirkung, und nur, wenn `expect` zum Stand passt.

public enum ProgressOps {
    public static let viewSet = "progress.view.set"
    public static let chartSet = "progress.chart.set"
    public static let goalSet = "progress.goal.set"

    public static let all: Set<String> = [viewSet, chartSet, goalSet]

    public static func isProgress(_ op: String) -> Bool { all.contains(op) }

    public static let viewKeys: Set<String> = ["group", "range", "metric"]
    public static let lineKeys = ["weight", "strength", "kcal"]

    // MARK: Lesen im Profil (exakte Rohwerte)

    /// `state.progressView ?? null` (nur Objekte; anderes kann das Web nicht vergleichen).
    public static func progressView(_ state: JSONValue) -> JSONValue {
        if case .object? = state["progressView"] { return state["progressView"] ?? .null }
        return .null
    }

    /// `{period: state.chartPeriod ?? null, lines: state.chartLines ?? null}`.
    public static func chartSettings(_ state: JSONValue) -> JSONValue {
        .object(["period": rawOrNull(state["chartPeriod"]), "lines": rawOrNull(state["chartLines"])])
    }

    /// Effektive Wochenziele wie `runGoalKm()`/`activeMinutesGoal()`: km nur als Zahl > 0, sonst `null`;
    /// Minuten `runSettings.weekMinutesGoal ?? 150`.
    public static func effectiveGoals(_ state: JSONValue) -> JSONValue {
        let settings = state["runSettings"]
        var km: JSONValue = .null
        if let value = settings?["weeklyGoalKm"]?.doubleValue, value > 0 { km = .number(value) }
        let minutes = rawOrNull(settings?["weekMinutesGoal"])
        return .object(["weeklyGoalKm": km, "weekMinutesGoal": minutes.isNull ? .number(150) : minutes])
    }

    static func rawOrNull(_ value: JSONValue?) -> JSONValue {
        value ?? .null
    }

    /// Wie `Math.round(km*10)/10` in `saveRunGoal` (gemeinsame `JSMath.round1`).
    public static func roundedKm(_ km: Double) -> Double {
        JSMath.round1(km)
    }

    // MARK: Zielwerte

    /// `progressView` nach dem Befehl: bisheriges Objekt (`expect`) plus Schlüsselpaar; `group` löscht `metric`.
    public static func viewTarget(_ args: JSONValue) -> JSONValue? {
        guard let key = args["key"]?.stringValue, viewKeys.contains(key), let value = args["value"]?.stringValue else { return nil }
        var target: [String: JSONValue] = args["expect"]?.objectValue ?? [:]
        target[key] = .string(value)
        if key == "group" { target["metric"] = nil }
        return .object(target)
    }

    /// `{period, lines}` nach dem Befehl: gewünschter oder unveränderter Rohwert, Kurven = bisheriges Objekt plus drei Booleans.
    public static func chartTarget(_ args: JSONValue) -> JSONValue? {
        guard let expect = args["expect"], case .object = expect else { return nil }
        let period = args["period"] ?? expect["period"] ?? .null
        var lines = expect["lines"] ?? .null
        if let wanted = args["lines"]?.objectValue {
            var merged = lines.objectValue ?? [:]
            for (key, value) in wanted { merged[key] = value }
            lines = .object(merged)
        }
        return .object(["period": period, "lines": lines])
    }

    /// `{weeklyGoalKm (gerundet|null), weekMinutesGoal}` nach dem Befehl.
    public static func goalTarget(_ args: JSONValue) -> JSONValue? {
        guard let minutes = args["weekMinutesGoal"]?.intValue else { return nil }
        let km: JSONValue
        switch args["weeklyGoalKm"] {
        case .null?: km = .null
        case .number(let value)?: km = .number(roundedKm(value))
        default: return nil
        }
        return .object(["weeklyGoalKm": km, "weekMinutesGoal": .number(Double(minutes))])
    }

    /// Gespeicherte Wochenziele für die Wirkungsprüfung (`runSettings.weeklyGoalKm ?? null`, `weekMinutesGoal ?? 150`).
    static func storedGoals(_ state: JSONValue) -> JSONValue {
        let settings = state["runSettings"]
        let km = rawOrNull(settings?["weeklyGoalKm"])
        let minutes = rawOrNull(settings?["weekMinutesGoal"])
        return .object(["weeklyGoalKm": km, "weekMinutesGoal": minutes.isNull ? .number(150) : minutes])
    }
}

// MARK: - Preparer

extension BridgeOps {
    public static let progressPreparers: [String: CommandPreparer] = [
        ProgressOps.viewSet: prepareProgressView,
        ProgressOps.chartSet: prepareProgressChart,
        ProgressOps.goalSet: prepareProgressGoal,
    ]

    private static func withExpect(_ args: JSONValue, _ expect: JSONValue) -> JSONValue {
        var prepared = args
        prepared["expect"] = expect
        return prepared
    }

    @Sendable
    public static func prepareProgressView(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return withExpect(args, ProgressOps.progressView(document.root))
    }

    @Sendable
    public static func prepareProgressChart(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return withExpect(args, ProgressOps.chartSettings(document.root))
    }

    @Sendable
    public static func prepareProgressGoal(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return withExpect(args, ProgressOps.effectiveGoals(document.root))
    }
}

// MARK: - Optimistische Reducer

extension BridgeOps {
    public static let progressReducers: [String: OptimisticReducer] = [
        ProgressOps.viewSet: reduceProgressView,
        ProgressOps.chartSet: reduceProgressChart,
        ProgressOps.goalSet: reduceProgressGoal,
    ]

    @Sendable
    public static func reduceProgressView(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let target = ProgressOps.viewTarget(args),
              ProgressOps.progressView(state) == (args["expect"] ?? .null) else { return }
        state["progressView"] = target
    }

    @Sendable
    public static func reduceProgressChart(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let target = ProgressOps.chartTarget(args),
              ProgressOps.chartSettings(state) == args["expect"] else { return }
        state["chartPeriod"] = target["period"]?.isNull == false ? target["period"] : nil
        state["chartLines"] = target["lines"]?.isNull == false ? target["lines"] : nil
    }

    @Sendable
    public static func reduceProgressGoal(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let target = ProgressOps.goalTarget(args),
              ProgressOps.effectiveGoals(state) == args["expect"] else { return }
        var settings = state["runSettings"]?.objectValue ?? [:]
        settings["weeklyGoalKm"] = target["weeklyGoalKm"]
        settings["weekMinutesGoal"] = target["weekMinutesGoal"]
        state["runSettings"] = .object(settings)
    }
}

// MARK: - Sichtbare Wirkung (§7, §10.4)

extension BridgeOps {
    public static let progressEffectChecks: [String: EffectCheck] = [
        ProgressOps.viewSet: { args, state, _ in
            guard let target = ProgressOps.viewTarget(args) else { return false }
            return ProgressOps.progressView(state) == target
        },
        ProgressOps.chartSet: { args, state, _ in
            guard let target = ProgressOps.chartTarget(args) else { return false }
            return ProgressOps.chartSettings(state) == target
        },
        ProgressOps.goalSet: { args, state, _ in
            guard let target = ProgressOps.goalTarget(args) else { return false }
            return ProgressOps.storedGoals(state) == target
        },
    ]
}

// MARK: - Befehle

/// Befehle der nativen Fortschrittsoberfläche. `expect` ergänzt der Store aus der aktuellen Anzeige.
/// `nil` = das Web würde `invalid` antworten (Grenzen aus §10.4 schon nativ geprüft).
public enum ProgressCommands {
    /// `key` `group|range|metric`, Wert aus den Web-Auswahllisten (Metrik ≤ 160 Zeichen).
    public static func setView(key: String, value: String) -> Command? {
        guard ProgressOps.viewKeys.contains(key), !value.isEmpty, value.utf16.count <= 160 else { return nil }
        return Command(op: ProgressOps.viewSet, args: ["key": .string(key), "value": .string(value)])
    }

    /// Mindestens Zeitraum oder alle drei Kurvenschalter.
    public static func setChart(period: String? = nil, lines: [String: Bool]? = nil) -> Command? {
        guard period != nil || lines != nil else { return nil }
        var args: JSONValue = [:]
        if let period {
            guard !period.isEmpty else { return nil }
            args["period"] = .string(period)
        }
        if let lines {
            guard Set(lines.keys) == Set(ProgressOps.lineKeys) else { return nil }
            args["lines"] = .object(lines.mapValues(JSONValue.bool))
        }
        return Command(op: ProgressOps.chartSet, args: args)
    }

    /// km `nil` (kein Ziel) oder 0,1–1000; Minuten ganzzahlig 0–10080.
    public static func setGoals(weeklyGoalKm: Double?, weekMinutesGoal: Int) -> Command? {
        guard (0...10080).contains(weekMinutesGoal) else { return nil }
        if let km = weeklyGoalKm { guard km.isFinite, km >= 0.1, km <= 1000 else { return nil } }
        return Command(op: ProgressOps.goalSet, args: [
            "weeklyGoalKm": weeklyGoalKm.map(JSONValue.number) ?? .null,
            "weekMinutesGoal": .number(Double(weekMinutesGoal)),
        ])
    }
}
