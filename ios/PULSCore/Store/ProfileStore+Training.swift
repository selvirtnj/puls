import Foundation

/// Fehler der Trainingsaktionen zusätzlich zu `ProfileStoreError`.
public enum TrainingCommandError: Error, Equatable, Sendable {
    /// Das Konto hat seit Beginn der Aktion gewechselt.
    case userChanged
    /// Konflikt ist bereits erledigt oder kein Trainingskonflikt.
    case noLongerConflict
}

extension ProfileStore {
    /// `perform` nur für Trainings-Ops und nur, wenn das Konto noch dasselbe ist wie beim Start der Aktion.
    @discardableResult
    public func performTraining(_ command: Command, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard TrainingOps.isTraining(command.op) else { throw ProfileStoreError.unsupportedOp(command.op) }
        return try perform(command)
    }

    /// Geparkte Trainingskonflikte **des aktuellen Kontos**.
    public var trainingConflicts: [OutboxEntry] {
        conflicts.filter { TrainingOps.isTraining($0.command.op) && $0.command.userId == userId }
    }

    /// Ein unbestätigter Trainingsbefehl erfüllt `predicate` (z. B. „Satz wird hinzugefügt“).
    public func hasUnconfirmed(_ predicate: (ApplyCommand) -> Bool) -> Bool {
        unconfirmedCommands.contains { TrainingOps.isTraining($0.op) && predicate($0) }
    }

    /// Anzeige der Session `workoutId` aus Spiegel (inkl. offener Befehle) und aktueller Projektion.
    public func trainingSession(workoutId: String) -> TrainingSessionModel? {
        TrainingSessionModel.build(workoutId: workoutId, document: document, projection: currentTraining?.training)
    }

    /// Rohe Routine aus dem Spiegel (Quelle für `routine.save`, Protokoll §9.2).
    public func rawRoutine(id: String) -> JSONValue? {
        TrainingOps.routine(document.root, id)
    }

    /// „Verwerfen“: geparkten Trainingsbefehl entfernen; die Anzeige folgt dem Web-Stand.
    public func discardTrainingConflict(id: String, asUser expectedUser: String?) throws {
        _ = try trainingConflict(id: id, asUser: expectedUser)
        try discardCommand(id: id)
    }

    /// „Trotzdem übernehmen“: derselbe Befehl mit frischem `expect` aus der aktuellen Anzeige, danach den geparkten
    /// verwerfen. Scheitert das Senden, bleibt der Konflikt erhalten. Nicht für `workout.finish` (dort entscheidet
    /// `confirmUnfinished`, nicht `expect`).
    @discardableResult
    public func reapplyTrainingConflict(id: String, asUser expectedUser: String?) throws -> ApplyCommand {
        let entry = try trainingConflict(id: id, asUser: expectedUser)
        guard Self.canReapply(op: entry.command.op) else { throw TrainingCommandError.noLongerConflict }
        var args = entry.command.args
        args["expect"] = nil
        let apply = try perform(Command(op: entry.command.op, args: args))
        try discardCommand(id: id)
        return apply
    }

    public static func canReapply(op: String) -> Bool {
        TrainingOps.isTraining(op) && op != TrainingOps.workoutFinish
    }

    private func trainingConflict(id: String, asUser expectedUser: String?) throws -> OutboxEntry {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard let entry = conflicts.first(where: { $0.command.id == id }), TrainingOps.isTraining(entry.command.op) else {
            throw TrainingCommandError.noLongerConflict
        }
        guard entry.command.userId == userId else { throw TrainingCommandError.userChanged }
        return entry
    }
}
