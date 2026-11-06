import Foundation

/// Ein erhaltener, noch nicht bewusst geschlossener Abschluss. `completion` ist das unveränderte Web-Objekt (bei großen
/// Abschlüssen nach dem Nachladen der vollständige Inhalt). `commandId` trennt die Finish-Zyklen derselben Workout-ID.
public struct CompletionRecord: Equatable, Sendable, Identifiable {
    public var userId: String?
    public var id: String
    public var commandId: String?
    public var completion: JSONValue

    public init(userId: String?, id: String, commandId: String?, completion: JSONValue) {
        self.userId = userId
        self.id = id
        self.commandId = commandId
        self.completion = completion
    }
}

/// `completion.dismiss`, das noch nicht in der Outbox steht (Web gerade nicht bereit, nur lesbar, anderes Konto).
struct PendingCompletionDismiss: Equatable, Sendable {
    var userId: String?
    var id: String
}

/// Native hält Abschlüsse nutzergebunden selbst vor (§15.2): sie überstehen einen Neustart, und ein bewusst geschlossener
/// Finish-Zyklus öffnet sich durch einen wiederholten Ack nie erneut. Ein Zyklus ist die Finish-Befehls-ID; ein anderer
/// Befehl mit inhaltsgleichem Abschluss (Replay nach verlorener Befehls-ID) zählt als derselbe. Wird dieselbe Workout-ID
/// wirklich erneut abgeschlossen, ist das ein neuer Zyklus und wird angezeigt. Kein Profilfeld, kein Sync.
///
/// Nicht threadsicher; gehört dem `ProfileStore` (Main Actor). Klein, Schreiben erfolgt synchron.
final class CompletionLedger {
    static let fileName = "native-completions.json"
    static let recordLimit = 8
    static let dismissedLimit = 64
    static let pendingLimit = 32

    private struct DismissedCycle: Equatable {
        var userId: String?
        var id: String
        var commandId: String?
        /// Fingerabdrücke des Abschlusses (vollständig und als gekürzter Ack-Kopf).
        var prints: [String]
    }

    private let fileURL: URL
    private(set) var records: [CompletionRecord] = []
    private(set) var pendingDismissals: [PendingCompletionDismiss] = []
    private var dismissed: [DismissedCycle] = []
    /// Vorhandene Datei noch nicht lesbar (vor der ersten Entsperrung): nicht überschreiben.
    private var isBlocked = false

    init(directory: URL) {
        fileURL = directory.appendingPathComponent(Self.fileName)
        load()
    }

    func reloadIfBlocked() {
        if isBlocked { load() }
    }

    // MARK: Fingerabdruck

    /// FNV-1a über den Text mit sortierten Schlüsseln: nur zum Wiedererkennen, keine Sicherheitsfunktion.
    static func fingerprint(_ value: JSONValue) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in value.serializedString().utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 16)
    }

    /// Der Kopf, den das Ack bei großen Abschlüssen statt des ganzen Objekts trägt (§15.2).
    static func head(_ completion: JSONValue) -> JSONValue {
        var object: [String: JSONValue] = ["chunked": .bool(true)]
        for key in ["kind", "id", "xp", "durationXp", "level", "streak"] {
            if let value = completion[key] { object[key] = value }
        }
        return .object(object)
    }

    private static func prints(_ completion: JSONValue) -> [String] {
        [fingerprint(completion), fingerprint(head(completion))]
    }

    // MARK: Änderungen

    /// `true`, wenn neu aufgenommen. Geschlossene Zyklen und Wiederholungen bleiben unverändert; ein neuer Zyklus derselben ID
    /// ersetzt einen noch offenen älteren.
    @discardableResult
    func add(_ record: CompletionRecord) -> Bool {
        let unavailable = NativeCompletion(json: record.completion)?.unavailable == true
        let arrival = Self.fingerprint(record.completion)
        let closed = dismissed.filter { $0.id == record.id && $0.userId == record.userId }
        // Ersatzansicht ohne Web-Abschluss: nie über einem schon geschlossenen Abschluss derselben ID.
        if unavailable, !closed.isEmpty { return false }
        let repeatsClosed = closed.contains { cycle in
            (record.commandId != nil && cycle.commandId == record.commandId) || cycle.prints.contains(arrival)
        }
        guard !repeatsClosed else { return false }
        if let index = records.firstIndex(where: { $0.id == record.id && $0.userId == record.userId }) {
            let open = records[index]
            let sameCycle = (record.commandId != nil && open.commandId == record.commandId) || Self.prints(open.completion).contains(arrival)
            guard !sameCycle, !unavailable else { return false }
            records[index] = record
            persist()
            return true
        }
        records.append(record)
        if records.count > Self.recordLimit { records.removeFirst(records.count - Self.recordLimit) }
        persist()
        return true
    }

    /// Vollständig nachgeladenen Inhalt dauerhaft übernehmen. `false`, wenn der Abschluss nicht mehr offen ist.
    @discardableResult
    func replace(_ record: CompletionRecord, completion: JSONValue) -> Bool {
        guard let index = records.firstIndex(where: {
            $0.id == record.id && $0.userId == record.userId && $0.commandId == record.commandId
        }) else { return false }
        records[index].completion = completion
        persist()
        return true
    }

    /// Bewusst geschlossen: entfernen, Zyklus merken und `completion.dismiss` dauerhaft vormerken. Die Ersatzansicht hat im Web
    /// keinen Abschluss, dort gibt es nichts zu bestätigen.
    func dismiss(_ record: CompletionRecord) {
        records.removeAll { $0.id == record.id && $0.userId == record.userId && $0.commandId == record.commandId }
        dismissed.append(DismissedCycle(userId: record.userId, id: record.id, commandId: record.commandId,
                                        prints: Self.prints(record.completion)))
        if dismissed.count > Self.dismissedLimit { dismissed.removeFirst(dismissed.count - Self.dismissedLimit) }
        if NativeCompletion(json: record.completion)?.unavailable != true {
            let pending = PendingCompletionDismiss(userId: record.userId, id: record.id)
            if !pendingDismissals.contains(pending) { pendingDismissals.append(pending) }
            if pendingDismissals.count > Self.pendingLimit {
                pendingDismissals.removeFirst(pendingDismissals.count - Self.pendingLimit)
            }
        }
        persist()
    }

    /// Steht in der Outbox: die Vormerkung ist erledigt.
    func finishDismissal(_ pending: PendingCompletionDismiss) {
        pendingDismissals.removeAll { $0 == pending }
        persist()
    }

    // MARK: Datei

    private func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            isBlocked = false
            return
        }
        guard let data = try? Data(contentsOf: fileURL) else {
            isBlocked = true
            return
        }
        isBlocked = false
        guard let value = try? JSONValue.parse(data) else { return }
        records = (value["records"]?.arrayValue ?? []).compactMap { item -> CompletionRecord? in
            guard let id = item["id"]?.stringValue, let completion = item["completion"] else { return nil }
            return CompletionRecord(userId: item["userId"]?.stringValue, id: id, commandId: item["commandId"]?.stringValue,
                                    completion: completion)
        }
        dismissed = (value["cycles"]?.arrayValue ?? []).compactMap { item -> DismissedCycle? in
            guard let id = item["id"]?.stringValue else { return nil }
            return DismissedCycle(userId: item["userId"]?.stringValue, id: id, commandId: item["commandId"]?.stringValue,
                                  prints: (item["prints"]?.arrayValue ?? []).compactMap(\.stringValue))
        }
        pendingDismissals = (value["pendingDismissals"]?.arrayValue ?? []).compactMap { item -> PendingCompletionDismiss? in
            guard let id = item["id"]?.stringValue else { return nil }
            return PendingCompletionDismiss(userId: item["userId"]?.stringValue, id: id)
        }
    }

    private static func optional(_ text: String?) -> JSONValue {
        guard let text else { return .null }
        return .string(text)
    }

    private func persist() {
        guard !isBlocked else { return }
        let rows = records.map { record -> JSONValue in
            .object(["userId": Self.optional(record.userId), "id": .string(record.id),
                     "commandId": Self.optional(record.commandId), "completion": record.completion])
        }
        let cycles = dismissed.map { cycle -> JSONValue in
            .object(["userId": Self.optional(cycle.userId), "id": .string(cycle.id), "commandId": Self.optional(cycle.commandId),
                     "prints": .array(cycle.prints.map(JSONValue.string))])
        }
        let pending = pendingDismissals.map { item -> JSONValue in
            .object(["userId": Self.optional(item.userId), "id": .string(item.id)])
        }
        let value = JSONValue.object(["records": .array(rows), "cycles": .array(cycles), "pendingDismissals": .array(pending)])
        try? ProtectedFile.write(Data(value.serializedString().utf8), to: fileURL)
    }
}
