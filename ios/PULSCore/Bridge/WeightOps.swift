import Foundation

/// Optimistische Vorschau für `weight.upsert` / `weight.delete` (Protokoll Abschnitt 5).
/// Exakt dieselbe Mutation wie das Web (js/native-state.js nach app.js `addWeight` bzw. finish.js `removeEntry`):
/// Upsert entfernt Einträge mit derselben `id` **oder** demselben Tag und hängt `{id, date, kg}` an (ein Gewicht pro
/// Tag); Delete filtert nach `id`. `expect` prüft nur das Web; ein `conflict` rollt die Vorschau im Store zurück.
extension BridgeOps {
    public static let weightReducers: [String: OptimisticReducer] = [
        weightUpsert: reduceWeightUpsert,
        weightDelete: reduceWeightDelete,
    ]

    /// `args` für `weight.upsert`; `expect` ergänzt `prepareWeightUpsert` beim `perform`.
    public static func weightUpsertArgs(id: String, date: String, kg: Double) -> JSONValue {
        .object(["id": .string(id), "date": .string(date), "kg": .number(kg)])
    }

    /// `args` für `weight.upsert` mit ausdrücklichem `expect` (`nil` → JSON `null`). Der Preparer überschreibt ein
    /// gesetztes `expect` nicht; so gilt der Stand, den Selvir beim Öffnen gesehen hat.
    public static func weightUpsertArgs(id: String, date: String, kg: Double, expect: String?) -> JSONValue {
        var args = weightUpsertArgs(id: id, date: date, kg: kg)
        args["expect"] = expect.map(JSONValue.string) ?? .null
        return args
    }

    /// `args` für `weight.delete`; `expect` ergänzt `prepareWeightDelete` beim `perform`.
    public static func weightDeleteArgs(id: String) -> JSONValue {
        .object(["id": .string(id)])
    }

    /// Ungültige `args` (die das Web mit `invalid` ablehnen würde) ändern die Vorschau nicht.
    @Sendable
    public static func reduceWeightUpsert(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state,
              let id = args["id"]?.stringValue, !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let date = args["date"]?.stringValue, WeightDay.isValid(date),
              let kg = args["kg"]?.doubleValue, WeightMath.isValidKg(kg) else { return }
        var weights = (state["weights"]?.arrayValue ?? []).filter { item in
            item["id"]?.stringValue != id && item["date"]?.stringValue != date
        }
        weights.append(.object(["id": .string(id), "date": .string(date), "kg": .number(kg)]))
        state["weights"] = .array(weights)
    }

    @Sendable
    public static func reduceWeightDelete(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, !id.isEmpty,
              let weights = state["weights"]?.arrayValue else { return }
        state["weights"] = .array(weights.filter { $0["id"]?.stringValue != id })
    }
}
