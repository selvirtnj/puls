import Foundation

/// Das vollständige persistierte Web-Profil (`puls-v1`), unverändert als JSON-Baum.
/// Typisierte Sichten (z. B. `WeightEntry` ab M2) lesen hieraus und schreiben nur ihre eigenen Felder.
public struct ProfileDocument: Equatable, Sendable {
    public var root: JSONValue

    public init(root: JSONValue) {
        self.root = root
    }

    public static let empty = ProfileDocument(root: .object([:]))

    public subscript(key: String) -> JSONValue? {
        root[key]
    }

    /// Liste unter `key`, leer wenn das Feld fehlt oder keine Liste ist.
    public func array(_ key: String) -> [JSONValue] {
        root[key]?.arrayValue ?? []
    }

    public var keys: [String] {
        root.objectValue.map { Array($0.keys) } ?? []
    }
}
