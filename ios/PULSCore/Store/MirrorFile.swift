import Foundation

/// Ein gespiegelter Web-Stand, wie er auf der Platte liegt.
public struct MirrorRecord: Equatable, Sendable {
    public static let format = 1

    public var seq: Int
    public var userId: String?
    public var cloud: CloudStatus
    public var flags: StateFlags
    public var savedAt: Date
    /// Vollständiges Profil, unverändert inklusive unbekannter Felder.
    public var state: JSONValue

    public init(seq: Int, userId: String?, cloud: CloudStatus, flags: StateFlags, savedAt: Date, state: JSONValue) {
        self.seq = seq
        self.userId = userId
        self.cloud = cloud
        self.flags = flags
        self.savedAt = savedAt
        self.state = state
    }

    public init(json: JSONValue) throws {
        let fields = try Fields(json)
        guard try fields.int("format") == Self.format else { throw BridgeDecodingError.invalidField("format") }
        seq = try fields.int("seq")
        userId = try fields.optionalString("userId")
        guard case .number(let savedMillis)? = fields["savedAt"] else { throw BridgeDecodingError.invalidField("savedAt") }
        savedAt = Date(timeIntervalSince1970: savedMillis / 1000)
        cloud = try CloudStatus(json: fields["cloud"])
        flags = try StateFlags(json: fields["flags"])
        guard let state = fields["state"], case .object = state else { throw BridgeDecodingError.invalidField("state") }
        self.state = state
    }

    public var json: JSONValue {
        .object([
            "format": .number(Double(Self.format)),
            "seq": .number(Double(seq)),
            "userId": userId.map(JSONValue.string) ?? .null,
            "savedAt": .number((savedAt.timeIntervalSince1970 * 1000).rounded()),
            "cloud": cloud.json,
            "flags": flags.json,
            "state": state,
        ])
    }
}

public enum MirrorError: Error, Equatable, Sendable {
    /// Stand zu tief verschachtelt, um wieder gelesen zu werden; der bisherige Spiegel bleibt.
    case tooDeep
}

/// Lese-Spiegel `Application Support/mirror-<userId|local>.json` plus eine Vorgängerkopie `….prev.json`.
///
/// Synchron und ohne eigenen Zustand: Aufrufer schreiben abseits des Main-Threads und serialisieren selbst
/// (siehe `ProfileStore`). Ablauf: neuen Stand vollständig in `….next.json` schreiben, dann den bisherigen als
/// Vorgängerkopie sichern und zuletzt atomar austauschen. Die aktuelle Datei existiert dabei durchgehend.
/// Beim Lesen wird bei fehlender oder beschädigter Datei die Vorgängerkopie genommen.
public struct MirrorFile: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    /// Dateiname ohne Pfadanteile: nur `A–Z a–z 0–9 - _`, sonst `_`; ohne Konto `local`.
    public static func fileStem(for userId: String?) -> String {
        guard let userId, !userId.isEmpty else { return "mirror-local" }
        let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")
        let safe = String(userId.prefix(128).map { allowed.contains($0) ? $0 : "_" })
        return "mirror-" + safe
    }

    public func url(for userId: String?) -> URL {
        directory.appendingPathComponent(Self.fileStem(for: userId) + ".json")
    }

    public func previousURL(for userId: String?) -> URL {
        directory.appendingPathComponent(Self.fileStem(for: userId) + ".prev.json")
    }

    func nextURL(for userId: String?) -> URL {
        directory.appendingPathComponent(Self.fileStem(for: userId) + ".next.json")
    }

    public func write(_ record: MirrorRecord) throws {
        let json = record.json
        guard json.fitsDepth(JSONLimits.maxDepth) else { throw MirrorError.tooDeep }
        let data = json.serialized()
        let fileManager = FileManager.default
        let current = url(for: record.userId)
        let previous = previousURL(for: record.userId)
        let next = nextURL(for: record.userId)

        // 1. Neuen Stand vollständig schreiben. Scheitert das, bleibt alles wie es war.
        try ProtectedFile.write(data, to: next)

        guard fileManager.fileExists(atPath: current.path) else {
            try fileManager.moveItem(at: next, to: current)
            return
        }
        // 2. Bisherigen Stand als Vorgängerkopie sichern (harter Link, sonst Kopie). Die aktuelle Datei bleibt.
        //    Gelingt das nicht, wird trotzdem ausgetauscht: der neue Stand ist wichtiger als die Kopie.
        if fileManager.fileExists(atPath: previous.path) {
            try? fileManager.removeItem(at: previous)
        }
        if (try? fileManager.linkItem(at: current, to: previous)) == nil {
            try? fileManager.copyItem(at: current, to: previous)
        }
        // 3. Atomar austauschen: rename(2) ersetzt den Verzeichniseintrag; die Vorgängerkopie behält den alten Inhalt.
        guard rename(next.path, current.path) == 0 else {
            throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
        }
    }

    /// Aktueller Spiegel, bei fehlender oder beschädigter Datei die Vorgängerkopie; `nil`, wenn keiner lesbar ist.
    public func read(userId: String?) -> MirrorRecord? {
        Self.load(url(for: userId)) ?? Self.load(previousURL(for: userId))
    }

    /// Zuletzt geschriebener Spiegel über alle Nutzer (nach Änderungsdatum), z. B. für den App-Start.
    /// Berücksichtigt auch Nutzer, von denen nur noch die Vorgängerkopie vorhanden ist.
    public func latest() -> MirrorRecord? {
        let keys: Set<URLResourceKey> = [.contentModificationDateKey]
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory, includingPropertiesForKeys: Array(keys), options: [.skipsHiddenFiles]
        ) else { return nil }
        var newestByStem: [String: Date] = [:]
        for file in files {
            let name = file.lastPathComponent
            guard name.hasPrefix("mirror-"), name.hasSuffix(".json"), !name.hasSuffix(".next.json") else { continue }
            let stem = name.hasSuffix(".prev.json")
                ? String(name.dropLast(".prev.json".count))
                : String(name.dropLast(".json".count))
            let date = (try? file.resourceValues(forKeys: keys).contentModificationDate) ?? .distantPast
            newestByStem[stem] = max(newestByStem[stem] ?? .distantPast, date)
        }
        for (stem, _) in newestByStem.sorted(by: { $0.value > $1.value }) {
            if let record = Self.load(directory.appendingPathComponent(stem + ".json")) { return record }
            if let record = Self.load(directory.appendingPathComponent(stem + ".prev.json")) { return record }
        }
        return nil
    }

    static func load(_ url: URL) -> MirrorRecord? {
        guard let data = try? Data(contentsOf: url),
              let value = try? JSONValue.parse(data) else { return nil }
        return try? MirrorRecord(json: value)
    }
}