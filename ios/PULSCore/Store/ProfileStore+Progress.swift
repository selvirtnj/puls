import Foundation

extension ProfileStore {
    /// `perform` nur für Fortschritts-Ops und nur, wenn das Konto noch dasselbe ist wie beim Start der Aktion.
    @discardableResult
    public func performProgress(_ command: Command, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard ProgressOps.isProgress(command.op) else { throw ProfileStoreError.unsupportedOp(command.op) }
        return try perform(command)
    }

    /// Ein Fortschrittsbefehl ist noch nicht im Snapshot sichtbar (Einstellungen dann nicht erneut ändern).
    public func hasUnconfirmedProgress(_ op: String? = nil) -> Bool {
        unconfirmedCommands.contains { ProgressOps.isProgress($0.op) && (op == nil || $0.op == op) }
    }

    /// Geparkte Fortschrittskonflikte **des aktuellen Kontos**.
    public var progressConflicts: [OutboxEntry] {
        conflicts.filter { ProgressOps.isProgress($0.command.op) && $0.command.userId == userId }
    }

    public func progressResult(_ requestId: String?) -> ProgressResultMessage? {
        guard let requestId else { return nil }
        return progressResults[requestId]
    }

    /// „Verwerfen“: geparkten Fortschrittsbefehl entfernen; die Anzeige folgt dem Web-Stand.
    public func discardProgressConflict(id: String, asUser expectedUser: String?) throws {
        _ = try progressConflict(id: id, asUser: expectedUser)
        try discardCommand(id: id)
    }

    /// „Trotzdem übernehmen“: gleicher Wunsch mit frischem `expect` aus der aktuellen Anzeige, danach den geparkten
    /// verwerfen. Scheitert das Senden, bleibt der Konflikt erhalten.
    @discardableResult
    public func reapplyProgressConflict(id: String, asUser expectedUser: String?) throws -> ApplyCommand {
        let entry = try progressConflict(id: id, asUser: expectedUser)
        var args = entry.command.args
        args["expect"] = nil
        let apply = try perform(Command(op: entry.command.op, args: args))
        try discardCommand(id: id)
        return apply
    }

    private func progressConflict(id: String, asUser expectedUser: String?) throws -> OutboxEntry {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard let entry = conflicts.first(where: { $0.command.id == id }), ProgressOps.isProgress(entry.command.op) else {
            throw TrainingCommandError.noLongerConflict
        }
        guard entry.command.userId == userId else { throw TrainingCommandError.userChanged }
        return entry
    }
}
