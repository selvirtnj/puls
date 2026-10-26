import Foundation

public struct OutboxEntry: Equatable, Sendable {
    public enum Status: Equatable, Sendable {
        /// Wird gesendet bzw. beim nächsten Replay erneut gesendet.
        case pending
        /// Nicht automatisch erneut senden (`wrong_user`, `unknown_op`, `conflict`); bleibt erhalten, bis der Nutzer
        /// entscheidet oder (bei `unknown_op`) das Web die Op später meldet.
        case parked(AckErrorCode)
        /// Vom Web mit `ok:true` bestätigt (in `localStorage` geschrieben, noch nicht sicher auf dem Datenträger).
        /// `session` = App-Sitzung der Bestätigung. Erst ein `load`-Snapshot einer späteren App-Sitzung mit der
        /// Wirkung des Befehls entfernt den Eintrag (Protokoll Abschnitt 7).
        case acked(session: String)
    }

    public var command: ApplyCommand
    public var status: Status
    public var createdAt: Date
    /// Anzahl Sendeversuche in dieser und früheren Sitzungen (nur Diagnose).
    public var attempts: Int
    public var lastError: AckError?
    /// Nur für `acked` (Protokoll Abschnitt 7): ob der letzte gültige Snapshot desselben Nutzers in der
    /// Ack-Sitzung die Wirkung zeigte. `nil` = seit dem Ack noch kein gültiger Snapshot.
    public var lastSeenEffect: Bool?

    public init(command: ApplyCommand, status: Status = .pending, createdAt: Date, attempts: Int = 0,
                lastError: AckError? = nil, lastSeenEffect: Bool? = nil) {
        self.command = command
        self.status = status
        self.createdAt = createdAt
        self.attempts = attempts
        self.lastError = lastError
        self.lastSeenEffect = lastSeenEffect
    }

    public var isAcked: Bool {
        if case .acked = status { return true }
        return false
    }

    public var isParked: Bool {
        if case .parked = status { return true }
        return false
    }

    init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard let commandJSON = fields["command"] else { throw BridgeDecodingError.missingField("command") }
        command = try ApplyCommand(json: commandJSON)
        switch try fields.string("status") {
        case "pending":
            status = .pending
        case "parked":
            let code = try fields.string("parkedCode")
            status = .parked(AckErrorCode(code: code))
        case "acked":
            let session = try fields.string("ackedSession")
            status = .acked(session: session)
        default:
            throw BridgeDecodingError.invalidField("status")
        }
        guard case .number(let createdMillis)? = fields["createdAt"] else { throw BridgeDecodingError.invalidField("createdAt") }
        createdAt = Date(timeIntervalSince1970: createdMillis / 1000)
        attempts = try fields.optionalInt("attempts") ?? 0
        switch fields["lastError"] {
        case nil, .null?: lastError = nil
        case let value?: lastError = try AckError(json: value)
        }
        switch fields["lastSeenEffect"] {
        case nil, .null?: lastSeenEffect = nil
        case .bool(let seen)?: lastSeenEffect = seen
        default: throw BridgeDecodingError.invalidField("lastSeenEffect")
        }
    }

    var json: JSONValue {
        var object: [String: JSONValue] = [
            "command": command.json,
            "createdAt": .number((createdAt.timeIntervalSince1970 * 1000).rounded()),
            "attempts": .number(Double(attempts)),
        ]
        switch status {
        case .pending:
            object["status"] = .string("pending")
        case .parked(let code):
            object["status"] = .string("parked")
            object["parkedCode"] = .string(code.code)
        case .acked(let session):
            object["status"] = .string("acked")
            object["ackedSession"] = .string(session)
        }
        if let lastError { object["lastError"] = lastError.json }
        if let lastSeenEffect { object["lastSeenEffect"] = .bool(lastSeenEffect) }
        return .object(object)
    }
}

/// Ergebnis einer `ack`-Nachricht für die Outbox (Protokoll Abschnitt 6).
public enum AckResolution: Equatable, Sendable {
    /// ID nicht in der Outbox, z. B. nach endgültigem Entfernen.
    case unknownCommand
    /// `ok:true`: als `acked` markiert und weiter aufbewahrt.
    case confirmed(ApplyCommand)
    /// `invalid`: entfernt, optimistische Änderung zurückrollen.
    case rejected(ApplyCommand, AckError)
    /// `wrong_user`, `unknown_op`, `conflict`: geparkt, nicht gelöscht.
    case parked(ApplyCommand, AckError)
    /// `readonly`, `persist_failed`, `not_ready` und unbekannte Codes: bleibt zum späteren Senden.
    case held(ApplyCommand, AckError)
}

public enum OutboxError: Error, Equatable, Sendable {
    /// Die vorhandene Datei konnte nicht gelesen bzw. nicht sicher beiseitegelegt werden. Schreiben ist gesperrt,
    /// damit sie nicht überschrieben wird.
    case notLoaded
    /// Inhalt zu tief verschachtelt, um wieder gelesen zu werden.
    case tooDeep
}

/// Persistente Outbox `Application Support/outbox.json`.
///
/// - Idempotent nach Befehls-ID: dieselbe ID wird nie doppelt eingereiht.
/// - Ein neuer Befehl ist erst eingereiht, wenn er auf der Platte steht.
/// - Entfernt wird nur nach `invalid`, auf Nutzerwunsch oder nach nachgewiesener Übernahme eines `acked`-Befehls;
///   Entfernen auf Wunsch bzw. nach Nachweis ist transaktional (scheitert das Schreiben, bleibt der Eintrag).
/// Nicht threadsicher; gehört dem `ProfileStore` (Main Actor). Die Datei ist klein, Schreiben erfolgt synchron.
public final class Outbox {
    public static let fileName = "outbox.json"
    static let format = 1

    public let fileURL: URL
    public private(set) var entries: [OutboxEntry] = []
    /// Lesefehler der vorhandenen Datei (Text ohne Inhalte), sonst `nil`.
    public private(set) var loadError: String?
    /// Letzter Schreibfehler nach Ack-Verarbeitung (Text ohne Inhalte), sonst `nil`.
    public private(set) var saveError: String?
    /// `true`, solange eine vorhandene Datei weder gelesen noch sicher beiseitegelegt werden konnte.
    public private(set) var isBlocked = false

    public init(directory: URL) {
        fileURL = directory.appendingPathComponent(Self.fileName)
        load()
    }

    /// Erneuter Leseversuch, falls die Datei zuvor nicht lesbar war (z. B. nach der ersten Entsperrung).
    public func reloadIfBlocked() {
        if isBlocked { load() }
    }

    private func load() {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: fileURL.path) else {
            entries = []
            isBlocked = false
            loadError = nil
            return
        }
        let data: Data
        do {
            data = try Data(contentsOf: fileURL)
        } catch {
            // Nicht lesbar ist nicht leer: nichts überschreiben.
            entries = []
            isBlocked = true
            loadError = "Outbox nicht lesbar"
            return
        }
        do {
            entries = try Self.decode(data)
            isBlocked = false
            loadError = nil
        } catch {
            // Beschädigt: beiseitelegen statt überschreiben. Nur wenn das klappt, darf neu geschrieben werden.
            let aside = fileURL.deletingLastPathComponent()
                .appendingPathComponent("outbox.corrupt-\(UUID().uuidString.lowercased()).json")
            entries = []
            do {
                try fileManager.moveItem(at: fileURL, to: aside)
                isBlocked = false
                loadError = "Outbox beschädigt, beiseitegelegt"
            } catch {
                isBlocked = true
                loadError = "Outbox beschädigt und nicht beiseitegelegt"
            }
        }
    }

    static func decode(_ data: Data) throws -> [OutboxEntry] {
        let value = try JSONValue.parse(data)
        let fields = try Fields(value)
        guard try fields.int("version") == format else { throw BridgeDecodingError.invalidField("version") }
        guard case .array(let items)? = fields["entries"] else { throw BridgeDecodingError.invalidField("entries") }
        return try items.map(OutboxEntry.init(json:))
    }

    public func save() throws {
        guard !isBlocked else { throw OutboxError.notLoaded }
        let document: JSONValue = .object([
            "version": .number(Double(Self.format)),
            "entries": .array(entries.map(\.json)),
        ])
        guard document.fitsDepth(JSONLimits.maxDepth) else { throw OutboxError.tooDeep }
        try ProtectedFile.write(document.serialized(), to: fileURL)
        saveError = nil
    }

    private func saveQuietly() {
        do {
            try save()
        } catch {
            // Schlimmstenfalls wird ein Befehl erneut gesendet; das Web beantwortet Wiederholungen derselben ID
            // ohne erneute Ausführung bzw. prüft `expect`.
            saveError = "Outbox nicht gespeichert"
        }
    }

    /// Ändert `entries` und speichert; scheitert das Speichern, wird der vorherige Stand wiederhergestellt.
    private func transaction(_ change: () -> Void) throws {
        let previous = entries
        change()
        do {
            try save()
        } catch {
            entries = previous
            saveError = "Outbox nicht gespeichert"
            throw error
        }
    }

    public func contains(id: String) -> Bool {
        entries.contains { $0.command.id == id }
    }

    /// Reiht ein und speichert sofort. `false`, wenn die ID schon vorhanden ist. Bei Schreibfehler bleibt
    /// die Outbox unverändert und der Fehler wird weitergegeben.
    @discardableResult
    public func enqueue(_ command: ApplyCommand, at date: Date) throws -> Bool {
        reloadIfBlocked()
        guard !isBlocked else { throw OutboxError.notLoaded }
        guard !contains(id: command.id) else { return false }
        guard command.args.fitsDepth(JSONLimits.bridgeDepth) else { throw OutboxError.tooDeep }
        let millis = (date.timeIntervalSince1970 * 1000).rounded()
        try transaction {
            entries.append(OutboxEntry(command: command, createdAt: Date(timeIntervalSince1970: millis / 1000)))
        }
        return true
    }

    /// Befehle zum (erneuten) Senden, in Einreihungsreihenfolge.
    public var replayableCommands: [ApplyCommand] {
        entries.filter { $0.status == .pending }.map(\.command)
    }

    /// Zählt einen Sendeversuch (wird mit dem nächsten Speichern geschrieben).
    public func markSent(id: String) {
        guard let index = entries.firstIndex(where: { $0.command.id == id }) else { return }
        entries[index].attempts += 1
    }

    /// Verarbeitet ein `ack`. `session` = aktuelle App-Sitzung (für `acked`).
    public func resolve(_ ack: AckMessage, session: String) -> AckResolution {
        guard let index = entries.firstIndex(where: { $0.command.id == ack.id }) else { return .unknownCommand }
        let command = entries[index].command
        if ack.ok {
            // Neues Ack: Beobachtung beginnt neu. Eine doppelte Bestätigung behält die bisherige Beobachtung.
            if !entries[index].isAcked { entries[index].lastSeenEffect = nil }
            entries[index].status = .acked(session: session)
            entries[index].lastError = nil
            saveQuietly()
            return .confirmed(command)
        }
        let error = ack.error ?? AckError(code: .other("missing"))
        switch error.code {
        case .invalid:
            entries.remove(at: index)
            saveQuietly()
            return .rejected(command, error)
        case .wrongUser, .unknownOp, .conflict:
            entries[index].status = .parked(error.code)
            entries[index].lastError = error
            saveQuietly()
            return .parked(command, error)
        case .readonly, .persistFailed, .notReady, .other:
            entries[index].status = .pending
            entries[index].lastError = error
            saveQuietly()
            return .held(command, error)
        }
    }

    /// Geparkte Einträge, die `predicate` erfüllen, wieder zum Senden freigeben. Liefert die Anzahl.
    @discardableResult
    public func unpark(where predicate: (OutboxEntry) -> Bool) -> Int {
        var changed = 0
        for index in entries.indices where entries[index].isParked && predicate(entries[index]) {
            entries[index].status = .pending
            changed += 1
        }
        if changed > 0 { saveQuietly() }
        return changed
    }

    /// Speichert für `acked`-Einträge, ob der jüngste gültige Snapshot die Wirkung zeigte (persistent).
    /// Liefert die Anzahl geänderter Einträge.
    @discardableResult
    public func recordSeenEffect(_ seen: [String: Bool]) -> Int {
        var changed = 0
        for index in entries.indices where entries[index].isAcked {
            guard let visible = seen[entries[index].command.id], entries[index].lastSeenEffect != visible else { continue }
            entries[index].lastSeenEffect = visible
            changed += 1
        }
        if changed > 0 { saveQuietly() }
        return changed
    }

    /// `acked`-Einträge wieder zum Senden freigeben (Wirkung nach Neustart verloren oder nie gesehen).
    @discardableResult
    public func reopen(ids: Set<String>) -> Int {
        var changed = 0
        for index in entries.indices where entries[index].isAcked && ids.contains(entries[index].command.id) {
            entries[index].status = .pending
            entries[index].lastSeenEffect = nil
            changed += 1
        }
        if changed > 0 { saveQuietly() }
        return changed
    }

    /// Entfernt `acked`-Einträge endgültig (Wirkung nachgewiesen). Transaktional.
    public func removeAcked(ids: Set<String>) throws {
        guard entries.contains(where: { $0.isAcked && ids.contains($0.command.id) }) else { return }
        try transaction {
            entries.removeAll { $0.isAcked && ids.contains($0.command.id) }
        }
    }

    /// Entfernt einen Eintrag endgültig (nur auf ausdrücklichen Nutzerwunsch). Transaktional: scheitert das
    /// Speichern, bleibt der Eintrag und der Fehler wird weitergegeben.
    @discardableResult
    public func remove(id: String) throws -> ApplyCommand? {
        guard let index = entries.firstIndex(where: { $0.command.id == id }) else { return nil }
        let command = entries[index].command
        try transaction {
            entries.remove(at: index)
        }
        return command
    }
}
