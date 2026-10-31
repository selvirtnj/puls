import Foundation

extension ProfileStore {
    /// `perform` nur für Aktivitäts-Ops und nur, wenn das Konto noch dasselbe ist wie beim Start der Aktion.
    @discardableResult
    public func performActivity(_ command: Command, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard ActivityOps.isActivity(command.op) else { throw ProfileStoreError.unsupportedOp(command.op) }
        return try perform(command)
    }

    /// Ein unbestätigter Aktivitätsbefehl erfüllt `predicate` (z. B. „Pause wird gesendet“).
    public func hasUnconfirmedActivity(_ predicate: (ApplyCommand) -> Bool) -> Bool {
        unconfirmedCommands.contains { ActivityOps.isActivity($0.op) && predicate($0) }
    }

    /// Geparkte Aktivitätskonflikte **des aktuellen Kontos**.
    public var activityConflicts: [OutboxEntry] {
        conflicts.filter { ActivityOps.isActivity($0.command.op) && $0.command.userId == userId }
    }

    public func activityResult(_ requestId: String?) -> ActivityResultMessage? {
        guard let requestId else { return nil }
        return activityResults[requestId]
    }

    /// „Verwerfen“: geparkten Aktivitätsbefehl entfernen; die Anzeige folgt dem Web-Stand.
    public func discardActivityConflict(id: String, asUser expectedUser: String?) throws {
        _ = try activityConflict(id: id, asUser: expectedUser)
        try discardCommand(id: id)
    }

    /// „Trotzdem übernehmen“: derselbe Wunsch mit frischem `expect` aus der aktuellen Anzeige (Bearbeiten, Löschen,
    /// Route löschen). Steuer-Ops der laufenden Aktivität werden nie so wiederholt: dort zeigt Native den neuen Stand.
    @discardableResult
    public func reapplyActivityConflict(id: String, asUser expectedUser: String?) throws -> ApplyCommand {
        let entry = try activityConflict(id: id, asUser: expectedUser)
        guard Self.canReapplyActivity(op: entry.command.op) else { throw TrainingCommandError.noLongerConflict }
        var args = entry.command.args
        args["expect"] = nil
        let apply = try perform(Command(op: entry.command.op, args: args))
        try discardCommand(id: id)
        return apply
    }

    public static func canReapplyActivity(op: String) -> Bool {
        [ActivityOps.runEdit, ActivityOps.runDelete, ActivityOps.routeDelete, ActivityOps.routeSave].contains(op)
    }

    private func activityConflict(id: String, asUser expectedUser: String?) throws -> OutboxEntry {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard let entry = conflicts.first(where: { $0.command.id == id }), ActivityOps.isActivity(entry.command.op) else {
            throw TrainingCommandError.noLongerConflict
        }
        guard entry.command.userId == userId else { throw TrainingCommandError.userChanged }
        return entry
    }
}
