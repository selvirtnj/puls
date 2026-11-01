import Foundation

/// Ergebnis eines nativen Rückgängig (`ProfileStore.undoNutritionDelete`); beide Fälle sind dauerhaft gespeichert.
public enum NutritionUndoState: Equatable, Sendable {
    /// `food.restore` (Befehls-ID) steht anstelle des Löschens in der Outbox bzw. wurde eingereiht.
    case restoring(String)
    /// Das Löschen war geparkt bzw. nicht wirksam; nichts wiederherzustellen.
    case notNeeded
}
extension ProfileStore {
    /// `perform` nur für Ernährungs-Ops und nur, wenn das Konto noch dasselbe ist wie beim Start der Aktion.
    @discardableResult
    public func performNutrition(_ command: Command, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard NutritionOps.isNutrition(command.op) else { throw ProfileStoreError.unsupportedOp(command.op) }
        return try perform(command)
    }

    /// Noch nicht bestätigte bzw. bestätigte, aber noch nicht im Snapshot sichtbare Ernährungsbefehle des Kontos.
    public var unconfirmedNutrition: [ApplyCommand] {
        unconfirmedCommands.filter { NutritionOps.isNutrition($0.op) && $0.userId == userId }
    }

    /// Ein Ernährungsbefehl `op` ist unterwegs (Bedienelemente bis zum Snapshot nicht erneut auslösen).
    public func hasUnconfirmedNutrition(_ op: String, where predicate: (JSONValue) -> Bool = { _ in true }) -> Bool {
        unconfirmedNutrition.contains { $0.op == op && predicate($0.args) }
    }

    /// Geparkte Ernährungskonflikte **des aktuellen Kontos**.
    public var nutritionConflicts: [OutboxEntry] {
        conflicts.filter { NutritionOps.isNutrition($0.command.op) && $0.command.userId == userId }
    }

    /// „Verwerfen“: geparkten Ernährungsbefehl entfernen; die Anzeige folgt dem Web-Stand.
    public func discardNutritionConflict(id: String, asUser expectedUser: String?) throws {
        _ = try nutritionConflict(id: id, asUser: expectedUser)
        try discardCommand(id: id)
    }

    /// „Trotzdem übernehmen“ nur für Ops, deren Erwartung der Store aus dem Profil neu bildet (Tagesabschluss,
    /// Mikro-/Wasserziel, Menge ändern). `food.add`, Wasser, Löschen, Wiederherstellen und Favorit nie: dort zeigt
    /// Native den neuen Stand und lässt neu wählen (sonst Duplikate, alte Produktwerte oder ein Undo ohne passenden
    /// Snapshot).
    @discardableResult
    public func reapplyNutritionConflict(id: String, asUser expectedUser: String?) throws -> ApplyCommand {
        let entry = try nutritionConflict(id: id, asUser: expectedUser)
        guard Self.canReapplyNutrition(op: entry.command.op) else { throw TrainingCommandError.noLongerConflict }
        var args = entry.command.args
        args["expect"] = nil
        let apply = try perform(Command(op: entry.command.op, args: args))
        try discardCommand(id: id)
        return apply
    }

    public static func canReapplyNutrition(op: String) -> Bool {
        [NutritionOps.dayComplete, NutritionOps.microGoalsSet, NutritionOps.waterGoalSet,
         NutritionOps.foodUpdate].contains(op)
    }

    private func nutritionConflict(id: String, asUser expectedUser: String?) throws -> OutboxEntry {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard let entry = conflicts.first(where: { $0.command.id == id }), NutritionOps.isNutrition(entry.command.op) else {
            throw TrainingCommandError.noLongerConflict
        }
        guard entry.command.userId == userId else { throw TrainingCommandError.userChanged }
        return entry
    }
}
