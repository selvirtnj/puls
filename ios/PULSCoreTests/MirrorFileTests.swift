import Foundation
import XCTest
@testable import PULSCore

final class MirrorFileTests: XCTestCase {
    private func record(seq: Int, userId: String?, state: JSONValue) -> MirrorRecord {
        MirrorRecord(
            seq: seq, userId: userId, cloud: CloudStatus(signedIn: true, revision: 17),
            flags: .none, savedAt: fixedNow, state: state
        )
    }

    func testWriteAndReadFullProfileLosslessly() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        let profile = try Fixtures.value("profile-full")
        let written = record(seq: 42, userId: Fixtures.sessionUser, state: profile)

        try mirror.write(written)

        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent("mirror-\(Fixtures.sessionUser).json").path))
        XCTAssertEqual(mirror.read(userId: Fixtures.sessionUser), written)
        XCTAssertNil(mirror.read(userId: nil))
    }

    func testLocalProfileUsesLocalFileName() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 1, userId: nil, state: ["weights": []]))
        XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent("mirror-local.json").path))
        XCTAssertEqual(mirror.read(userId: nil)?.seq, 1)
        XCTAssertEqual(MirrorFile.fileStem(for: ""), "mirror-local")
    }

    func testFileNameCannotEscapeDirectory() {
        XCTAssertEqual(MirrorFile.fileStem(for: "../../evil/x"), "mirror-______evil_x")
        XCTAssertEqual(MirrorFile.fileStem(for: Fixtures.sessionUser), "mirror-\(Fixtures.sessionUser)")
    }

    func testRewriteKeepsPreviousCopyAndLeavesNoTemporaryFiles() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 1, userId: Fixtures.sessionUser, state: ["n": 1]))
        try mirror.write(record(seq: 2, userId: Fixtures.sessionUser, state: ["n": 2]))
        try mirror.write(record(seq: 3, userId: Fixtures.sessionUser, state: ["n": 3]))

        XCTAssertEqual(mirror.read(userId: Fixtures.sessionUser)?.seq, 3)
        let previous = try JSONValue.parse(Data(contentsOf: mirror.previousURL(for: Fixtures.sessionUser)))
        XCTAssertEqual(previous["seq"], 2)

        let files = try FileManager.default.contentsOfDirectory(atPath: directory.path).sorted()
        XCTAssertEqual(files, ["mirror-\(Fixtures.sessionUser).json", "mirror-\(Fixtures.sessionUser).prev.json"])
    }

    func testCorruptCurrentFileFallsBackToPreviousCopy() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 1, userId: nil, state: ["n": 1]))
        try mirror.write(record(seq: 2, userId: nil, state: ["n": 2]))
        // Simuliert eine halb geschriebene Datei, die es durch .atomic nicht geben dürfte.
        try Data("{\"format\":1,\"seq\":3,\"st".utf8).write(to: mirror.url(for: nil))
        XCTAssertEqual(mirror.read(userId: nil)?.seq, 1)
    }

    func testFileProtectionIsRequested() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 1, userId: nil, state: [:]))
        let attributes = try FileManager.default.attributesOfItem(atPath: mirror.url(for: nil).path)
        // Der Simulator meldet den Schutz nicht immer; wenn er ihn meldet, muss es die vereinbarte Klasse sein.
        if let protection = attributes[.protectionKey] as? FileProtectionType {
            XCTAssertEqual(protection, .completeUntilFirstUserAuthentication)
        }
    }

    func testLatestPicksMostRecentlyWrittenUser() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 5, userId: "user-a", state: ["who": "a"]))
        try mirror.write(record(seq: 6, userId: "user-b", state: ["who": "b"]))
        try FileManager.default.setAttributes(
            [.modificationDate: Date(timeIntervalSince1970: 1_000)], ofItemAtPath: mirror.url(for: "user-a").path
        )
        try FileManager.default.setAttributes(
            [.modificationDate: Date(timeIntervalSince1970: 2_000)], ofItemAtPath: mirror.url(for: "user-b").path
        )
        XCTAssertEqual(mirror.latest()?.userId, "user-b")
        XCTAssertEqual(mirror.latest()?.state["who"], "b")
    }

    func testLatestIsNilForEmptyDirectory() throws {
        XCTAssertNil(MirrorFile(directory: try makeTemporaryDirectory()).latest())
    }

    func testLatestUsesPreviousCopyWhenOnlyItExists() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 1, userId: "user-a", state: ["n": 1]))
        try mirror.write(record(seq: 2, userId: "user-a", state: ["n": 2]))
        // Absturz zwischen Aufräumen und Austausch simulieren: nur noch die Vorgängerkopie.
        try FileManager.default.removeItem(at: mirror.url(for: "user-a"))
        XCTAssertEqual(mirror.latest()?.seq, 1)
        XCTAssertEqual(mirror.read(userId: "user-a")?.seq, 1)
    }

    func testLeftoverNextFileIsIgnored() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 4, userId: nil, state: ["n": 4]))
        try Data("{halb".utf8).write(to: mirror.nextURL(for: nil))
        XCTAssertEqual(mirror.latest()?.seq, 4)
        // Der nächste Schreibvorgang überschreibt den Rest und tauscht sauber aus.
        try mirror.write(record(seq: 5, userId: nil, state: ["n": 5]))
        XCTAssertEqual(mirror.read(userId: nil)?.seq, 5)
        XCTAssertFalse(FileManager.default.fileExists(atPath: mirror.nextURL(for: nil).path))
    }

    func testTooDeepRecordIsRefusedAndOldMirrorStays() throws {
        let directory = try makeTemporaryDirectory()
        let mirror = MirrorFile(directory: directory)
        try mirror.write(record(seq: 1, userId: nil, state: ["n": 1]))
        var deep: JSONValue = [:]
        for _ in 1..<JSONLimits.maxDepth { deep = ["n": deep] }
        // state hat maxDepth Ebenen, der Datensatz darum eine mehr.
        XCTAssertThrowsError(try mirror.write(record(seq: 2, userId: nil, state: deep))) { error in
            XCTAssertEqual(error as? MirrorError, .tooDeep)
        }
        XCTAssertEqual(mirror.read(userId: nil)?.seq, 1)
    }
}
