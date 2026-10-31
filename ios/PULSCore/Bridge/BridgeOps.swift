import Foundation

/// Ergänzt `args` vor dem Einreihen aus dem nativen Stand, z. B. `expect` (Protokoll Abschnitt 5).
/// `document` ist die aktuelle Anzeige (Web-Spiegel plus noch offene Befehle), damit mehrere Befehle
/// hintereinander dieselbe Reihenfolge wie im Web erwarten.
public typealias CommandPreparer = @Sendable (_ args: JSONValue, _ document: ProfileDocument) -> JSONValue

/// Prüft, ob ein bestätigter Befehl im Profil wirksam ist (Protokoll Abschnitt 7). `result` ist das gespeicherte
/// `ack.result` (M4, z. B. `{workoutId}`), sonst `nil`.
public typealias EffectCheck = @Sendable (_ args: JSONValue, _ state: JSONValue, _ result: JSONValue?) -> Bool

/// Op-spezifische Regeln aus NATIVE-BRIDGE-PROTOCOL.md Abschnitt 5, 7, 9 und 10.
public enum BridgeOps {
    public static let weightUpsert = "weight.upsert"
    public static let weightDelete = "weight.delete"

    public static let defaultPreparers: [String: CommandPreparer] = {
        var map: [String: CommandPreparer] = [
            weightUpsert: prepareWeightUpsert,
            weightDelete: prepareWeightDelete,
        ]
        map.merge(trainingPreparers) { first, _ in first }
        map.merge(progressPreparers) { first, _ in first }
        return map
    }()

    public static let defaultEffectChecks: [String: EffectCheck] = {
        var map: [String: EffectCheck] = [
            weightUpsert: { args, state, _ in weightUpsertIsEffective(args, state) },
            weightDelete: { args, state, _ in weightDeleteIsEffective(args, state) },
        ]
        map.merge(trainingEffectChecks) { first, _ in first }
        map.merge(progressEffectChecks) { first, _ in first }
        return map
    }()

    /// `expect` = ID des Eintrags, den Native für `date` sieht, sonst `null`. Ein vom Aufrufer gesetztes
    /// `expect` bleibt unverändert. Mehrere Einträge am selben Tag: erste ID (das Web meldet dann `conflict`).
    @Sendable
    public static func prepareWeightUpsert(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let date = args["date"]?.stringValue else { return args }
        let sameDay = document.array("weights").filter { $0["date"]?.stringValue == date }
        var prepared = args
        if let id = sameDay.first?["id"]?.stringValue, !id.isEmpty {
            prepared["expect"] = JSONValue.string(id)
        } else {
            prepared["expect"] = JSONValue.null
        }
        return prepared
    }

    /// `expect` = Ziel-ID, wenn Native den Eintrag sieht, sonst `null` (erwartet: fehlt bereits).
    @Sendable
    public static func prepareWeightDelete(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let id = args["id"]?.stringValue else { return args }
        let exists = document.array("weights").contains { $0["id"]?.stringValue == id }
        var prepared = args
        prepared["expect"] = exists ? JSONValue.string(id) : JSONValue.null
        return prepared
    }

    /// Upsert wirksam: Eintrag mit passender ID, Datum und kg vorhanden.
    @Sendable
    public static func weightUpsertIsEffective(_ args: JSONValue, _ state: JSONValue) -> Bool {
        guard let id = args["id"]?.stringValue, let date = args["date"]?.stringValue,
              let kg = args["kg"]?.doubleValue else { return false }
        return (state["weights"]?.arrayValue ?? []).contains { entry in
            entry["id"]?.stringValue == id && entry["date"]?.stringValue == date && entry["kg"]?.doubleValue == kg
        }
    }

    /// Delete wirksam: Ziel-ID fehlt.
    @Sendable
    public static func weightDeleteIsEffective(_ args: JSONValue, _ state: JSONValue) -> Bool {
        guard let id = args["id"]?.stringValue else { return false }
        return !(state["weights"]?.arrayValue ?? []).contains { $0["id"]?.stringValue == id }
    }
}
