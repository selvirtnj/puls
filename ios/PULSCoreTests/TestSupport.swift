import Foundation
import XCTest
@testable import PULSCore

/// Gemeinsame Fixtures aus tests/fixtures/native-bridge (Ordnerreferenz „native-bridge“ im Test-Bundle).
enum Fixtures {
    static let sessionUser = "a0000000-0000-4000-8000-0000000000aa"

    static func folder() throws -> URL {
        let bundle = Bundle(for: BundleToken.self)
        return try XCTUnwrap(
            bundle.url(forResource: "native-bridge", withExtension: nil),
            "Fixture-Ordner native-bridge fehlt im Test-Bundle"
        )
    }

    static func data(_ name: String) throws -> Data {
        try Data(contentsOf: folder().appendingPathComponent(name + ".json"))
    }

    static func value(_ name: String) throws -> JSONValue {
        try JSONValue.parse(data(name))
    }

    /// Alle JSON-Fixtures ohne Endung, sortiert.
    static func allNames() throws -> [String] {
        try FileManager.default.contentsOfDirectory(at: folder(), includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
            .map { $0.deletingPathExtension().lastPathComponent }
            .sorted()
    }
}

private final class BundleToken {}

/// Foundation-Baum wie `WKScriptMessage.body` (NSDictionary/NSArray/NSNumber/NSString/NSNull).
/// Bewusst ohne JSONSerialization, damit Zahlen echte Double-NSNumbers sind wie bei WebKit.
func foundationObject(_ value: JSONValue) -> Any {
    switch value {
    case .null: return NSNull()
    case .bool(let flag): return NSNumber(value: flag)
    case .number(let number): return NSNumber(value: number)
    case .string(let text): return text as NSString
    case .array(let array): return array.map(foundationObject) as NSArray
    case .object(let object):
        let dictionary = NSMutableDictionary()
        for (key, element) in object { dictionary[key] = foundationObject(element) }
        return dictionary
    }
}

extension XCTestCase {
    /// Leeres temporäres Verzeichnis, wird nach dem Test gelöscht.
    func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("PULSCoreTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock {
            try? FileManager.default.removeItem(at: url)
        }
        return url
    }
}

/// Fortlaufende, vorhersagbare Befehls-IDs für Tests.
final class SequentialIDs: @unchecked Sendable {
    private let lock = NSLock()
    private var next = 0

    func make() -> String {
        lock.lock()
        defer { lock.unlock() }
        next += 1
        return String(format: "c0000000-0000-4000-8000-%012ld", next)
    }
}

/// Feste Uhr für Tests (ganze Sekunden, damit Millisekunden-Rundung exakt bleibt).
let fixedNow = Date(timeIntervalSince1970: 1_761_480_000)
