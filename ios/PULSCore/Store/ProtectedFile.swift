import Foundation

/// Atomares Schreiben mit Datei-Schutz `completeUntilFirstUserAuthentication` (Protokoll Abschnitt 7).
/// Vor der ersten Entsperrung nach einem Neustart schlagen Lesen und Schreiben fehl; Aufrufer behandeln das
/// als „noch nicht lesbar“, nie als „leer“.
enum ProtectedFile {
    static func ensureDirectory(_ directory: URL) throws {
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
    }

    /// `.atomic` schreibt in eine temporäre Datei und benennt sie dann um: Leser sehen nie eine halbe Datei.
    static func write(_ data: Data, to url: URL) throws {
        try ensureDirectory(url.deletingLastPathComponent())
        try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
}
