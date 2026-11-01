import Foundation

extension ProfileStore {
    /// `perform` nur für Konto-Ops und nur, wenn das Konto noch dasselbe ist wie beim Start der Aktion.
    @discardableResult
    public func performAccount(_ command: Command, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard AccountOps.isAccount(command.op) else { throw ProfileStoreError.unsupportedOp(command.op) }
        return try perform(command)
    }

    /// Noch nicht bestätigte bzw. bestätigte, aber noch nicht im Snapshot sichtbare Kontobefehle des Kontos.
    public var unconfirmedAccount: [ApplyCommand] {
        unconfirmedCommands.filter { AccountOps.isAccount($0.op) && $0.userId == userId }
    }

    public func hasUnconfirmedAccount(_ op: String, where predicate: (JSONValue) -> Bool = { _ in true }) -> Bool {
        unconfirmedAccount.contains { $0.op == op && predicate($0.args) }
    }

    /// Gerätedarstellung, wie sie Native jetzt zeigen soll: ein unterwegs befindlicher Wunsch vor dem Snapshot-Wert.
    public var displayedScheme: AccountScheme? {
        pendingScheme ?? deviceScheme.flatMap(AccountScheme.init(rawValue:))
    }

    /// Noch nicht im Snapshot bestätigter Darstellungswunsch (für die sofortige native Umschaltung).
    public var pendingScheme: AccountScheme? {
        unconfirmedAccount.last(where: { $0.op == AccountOps.appearanceSet && $0.args["scheme"] != nil })?
            .args["scheme"]?.stringValue.flatMap(AccountScheme.init(rawValue:))
    }

    /// Geparkte Kontokonflikte **des aktuellen Kontos**.
    public var accountConflicts: [OutboxEntry] {
        conflicts.filter { AccountOps.isAccount($0.command.op) && $0.command.userId == userId }
    }

    /// Geparkte Kontobefehle anderer Gründe (`wrong_user`, `unknown_op`) des aktuellen Kontos.
    public var accountParked: [OutboxEntry] {
        parked.filter { AccountOps.isAccount($0.command.op) && $0.command.userId == userId && $0.status != .parked(.conflict) }
    }

    public func discardAccountCommand(id: String, asUser expectedUser: String?) throws {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard let entry = outboxEntries.first(where: { $0.command.id == id }), AccountOps.isAccount(entry.command.op),
              entry.command.userId == userId else { throw TrainingCommandError.noLongerConflict }
        try discardCommand(id: id)
    }

    /// „Trotzdem übernehmen“ nur für Ops, deren Erwartung der Store aus dem Spiegel neu bildet (Name, Avatar, Klänge).
    /// Profil/Plan/Maße/Darstellung nie: dort zeigt Native den neuen Stand und lässt neu wählen.
    @discardableResult
    public func reapplyAccountConflict(id: String, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw TrainingCommandError.userChanged }
        guard let entry = accountConflicts.first(where: { $0.command.id == id }), Self.canReapplyAccount(op: entry.command.op) else {
            throw TrainingCommandError.noLongerConflict
        }
        var args = entry.command.args
        args["expect"] = nil
        let apply = try perform(Command(op: entry.command.op, args: args))
        try discardCommand(id: id)
        return apply
    }

    public static func canReapplyAccount(op: String) -> Bool {
        [AccountOps.nameSet, AccountOps.avatarSet, AccountOps.soundSet].contains(op)
    }
}
