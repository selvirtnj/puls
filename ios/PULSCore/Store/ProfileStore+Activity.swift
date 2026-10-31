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

    /// Wartende bzw. vom Web gehaltene (noch nicht bestätigte) Aktivitätsbefehle `op` des aktuellen Kontos aus der
    /// persistenten Outbox, älteste zuerst; optional nur für die Aktivität `startedAt`. Damit verknüpft die Oberfläche
    /// nach einem Neustart ihre Aktionen wieder mit der ursprünglichen Befehls-ID.
    public func unconfirmedActivityEntries(op: String, startedAt: Double? = nil) -> [OutboxEntry] {
        outboxEntries.filter { entry in
            entry.status == .pending && entry.command.op == op && entry.command.userId == userId
                && (startedAt == nil || entry.command.args["startedAt"]?.doubleValue == startedAt)
        }
    }

    /// Befehl wurde in **dieser** App-Sitzung neu eingereiht, liegt wartend in der Outbox und wurde nachweislich noch nie an
    /// das Web übergeben. Nur dann darf er ohne Risiko einer späteren Ausführung verworfen werden. Aus `outbox.json`
    /// geladene Befehle gelten immer als möglicherweise gesendet (auch ohne gespeicherten Sendeversuch).
    public func isUnsent(commandId: String) -> Bool {
        sessionEnqueuedIds.contains(commandId)
            && outboxEntries.contains { $0.command.id == commandId && $0.status == .pending && $0.attempts == 0 }
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
