import Foundation

/// Fehler der Gewichtsaktionen zusätzlich zu `ProfileStoreError`.
public enum WeightCommandError: Error, Equatable, Sendable {
    /// Das Konto hat seit Beginn der Aktion (Sheet geöffnet, gelöscht, Konflikt angezeigt) gewechselt.
    case userChanged
    /// Konflikt ist bereits erledigt oder kein Gewichtskonflikt.
    case noLongerConflict
    /// Rückgängig nicht möglich: Tag oder ID ist inzwischen wieder belegt.
    case restoreBlocked
}

/// Befehle für den nativen Gewichtsbereich mit ausdrücklichem `expect` (Stand beim Start der Aktion).
public enum WeightCommands {
    /// Neuer Eintrag: neue ID (wie `addWeight`), `expect` = Tageseintrag in `seen` (Stand beim Öffnen), sonst `null`.
    public static func add(date: String, kg: Double, newID: String, seen: [WeightEntry]) -> Command {
        let expect = seen.first { $0.date == date }?.id
        return Command(op: BridgeOps.weightUpsert,
                       args: BridgeOps.weightUpsertArgs(id: newID, date: date, kg: kg, expect: expect))
    }

    /// Bearbeiten eines Tages: neue ID wie im Web (`addWeight` vergibt immer eine neue), gleicher Tag,
    /// `expect` = ursprüngliche ID. Hat ein anderes Gerät den Tag inzwischen geändert, meldet das Web `conflict`.
    public static func edit(original: WeightEntry, kg: Double, newID: String) -> Command {
        Command(op: BridgeOps.weightUpsert,
                args: BridgeOps.weightUpsertArgs(id: newID, date: original.date, kg: kg, expect: original.id))
    }

    /// Löschen des gesehenen Eintrags (`expect` = seine ID).
    public static func delete(_ entry: WeightEntry) -> Command {
        var args = BridgeOps.weightDeleteArgs(id: entry.id)
        args["expect"] = .string(entry.id)
        return Command(op: BridgeOps.weightDelete, args: args)
    }

    /// Rückgängig nach dem Löschen: dieselben Werte und dieselbe ID, `expect` = `null`.
    /// `nil`, wenn der Tag inzwischen belegt ist oder die ID (z. B. mit anderem Datum) wieder existiert:
    /// dann würde die Wiederherstellung einen neueren Eintrag überschreiben.
    public static func restore(_ deleted: WeightEntry, current: [WeightEntry]) -> Command? {
        guard !current.contains(where: { $0.date == deleted.date || $0.id == deleted.id }) else { return nil }
        return Command(op: BridgeOps.weightUpsert,
                       args: BridgeOps.weightUpsertArgs(id: deleted.id, date: deleted.date, kg: deleted.kg, expect: nil))
    }

    public static func isWeightOp(_ op: String) -> Bool {
        op == BridgeOps.weightUpsert || op == BridgeOps.weightDelete
    }
}

extension ProfileStore {
    /// Geparkte Gewichtskonflikte **des aktuellen Kontos**. Konflikte eines anderen Kontos bleiben in der Outbox,
    /// werden aber nie unter diesem Konto angezeigt oder entschieden.
    public var weightConflicts: [OutboxEntry] {
        conflicts.filter { WeightCommands.isWeightOp($0.command.op) && $0.command.userId == userId }
    }

    /// `perform` nur, wenn das Konto noch dasselbe ist wie beim Start der Aktion.
    @discardableResult
    public func performWeight(_ command: Command, asUser expectedUser: String?) throws -> ApplyCommand {
        guard userId == expectedUser else { throw WeightCommandError.userChanged }
        guard WeightCommands.isWeightOp(command.op) else { throw ProfileStoreError.unsupportedOp(command.op) }
        return try perform(command)
    }

    /// „Wert vom anderen Gerät behalten“: geparkten Befehl verwerfen.
    public func keepOtherWeight(conflictID: String, asUser expectedUser: String?) throws {
        _ = try weightConflict(id: conflictID, asUser: expectedUser)
        try discardCommand(id: conflictID)
    }

    /// „Meinen Wert übernehmen“: neuer Befehl mit frischem `expect` aus der aktuellen Anzeige, danach den geparkten
    /// verwerfen. Scheitert das Senden, bleibt der Konflikt erhalten.
    @discardableResult
    public func useMineWeight(conflictID: String, asUser expectedUser: String?) throws -> ApplyCommand {
        let entry = try weightConflict(id: conflictID, asUser: expectedUser)
        var args = entry.command.args
        args["expect"] = nil
        let apply = try perform(Command(op: entry.command.op, args: args))
        try discardCommand(id: conflictID)
        return apply
    }

    private func weightConflict(id: String, asUser expectedUser: String?) throws -> OutboxEntry {
        guard userId == expectedUser else { throw WeightCommandError.userChanged }
        guard let entry = conflicts.first(where: { $0.command.id == id }),
              WeightCommands.isWeightOp(entry.command.op) else { throw WeightCommandError.noLongerConflict }
        guard entry.command.userId == userId else { throw WeightCommandError.userChanged }
        return entry
    }
}
