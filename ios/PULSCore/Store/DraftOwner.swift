import Foundation

/// Besitzer eines offenen nativen Entwurfs (Routenplaner, Rezept-Editor, Rezept-Import): Konto und Dokument-Generation beim
/// Öffnen. Die Generation steigt bei neuem Dokument, ungeklärter Zuordnung und Kontowechsel; danach gehört der Entwurf zu
/// keinem aktuellen Stand mehr und darf nicht gespeichert werden.
public struct DraftOwner: Equatable, Sendable {
    public let userId: String?
    public let generation: Int

    public init(userId: String?, generation: Int) {
        self.userId = userId
        self.generation = generation
    }
}

extension ProfileStore {
    public var activityDraftOwner: DraftOwner { DraftOwner(userId: userId, generation: activityGeneration) }
    public var nutritionDraftOwner: DraftOwner { DraftOwner(userId: userId, generation: nutritionGeneration) }

    /// Speichert einen Entwurf nur für den Besitzer, unter dem er geöffnet wurde.
    @discardableResult
    public func performActivity(_ command: Command, owner: DraftOwner) throws -> ApplyCommand {
        guard !ownerPending, activityDraftOwner == owner else { throw TrainingCommandError.userChanged }
        return try performActivity(command, asUser: owner.userId)
    }

    /// Speichert einen Entwurf nur für den Besitzer, unter dem er geöffnet wurde.
    @discardableResult
    public func performNutrition(_ command: Command, owner: DraftOwner) throws -> ApplyCommand {
        guard !ownerPending, nutritionDraftOwner == owner else { throw TrainingCommandError.userChanged }
        return try performNutrition(command, asUser: owner.userId)
    }
}
