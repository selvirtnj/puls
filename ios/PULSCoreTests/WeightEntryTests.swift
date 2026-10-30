import Foundation
import XCTest
@testable import PULSCore

/// Gewichtsableitungen müssen exakt den Web-Formeln entsprechen (tracker-tools.js, flows.js, insights.js, app.js).
final class WeightEntryTests: XCTestCase {
    private func entry(_ id: String, _ date: String, _ kg: Double) -> WeightEntry {
        WeightEntry(id: id, date: date, kg: kg)
    }

    // MARK: Ableitung aus dem Profil

    func testEntriesSkipUnreadableRowsAndKeepOrder() {
        let document = ProfileDocument(root: [
            "weights": [
                ["id": "a", "date": "2026-10-20", "kg": 82.4, "extra": true],
                ["id": "", "date": "2026-10-21", "kg": 80],
                ["id": "b", "date": "2026-13-01", "kg": 80],
                ["id": "c", "date": "2026-10-22", "kg": "80"],
                ["id": "d", "date": "2026-02-29", "kg": 80],
                ["id": "e", "date": "2024-02-29", "kg": 81],
                "kaputt",
            ],
        ])
        XCTAssertEqual(WeightEntry.entries(in: document), [entry("a", "2026-10-20", 82.4), entry("e", "2024-02-29", 81)])
        XCTAssertEqual(WeightEntry.entries(in: .empty), [])
    }

    // MARK: Tage

    func testDayNumbersMatchJavaScriptDateParse() {
        XCTAssertEqual(WeightDay.dayNumber("1970-01-01"), 0)
        XCTAssertEqual(WeightDay.dayNumber("2026-10-31"), 20_757)
        XCTAssertEqual(WeightDay.string(fromDayNumber: 20_757), "2026-10-31")
        XCTAssertEqual(WeightDay.adding(days: 1, to: "2024-02-28"), "2024-02-29")
        XCTAssertEqual(WeightDay.adding(days: -1, to: "2026-01-01"), "2025-12-31")
        XCTAssertNil(WeightDay.dayNumber("2026-1-01"))
        XCTAssertNil(WeightDay.dayNumber("2026-10-31T00"))
    }

    func testWeekStartIsMonday() {
        XCTAssertEqual(WeightDay.weekStart("2026-10-26"), "2026-10-26") // Montag
        XCTAssertEqual(WeightDay.weekStart("2026-10-31"), "2026-10-26") // Samstag
        XCTAssertEqual(WeightDay.weekStart("2026-11-01"), "2026-10-26") // Sonntag
        XCTAssertEqual(WeightDay.weekStart("2026-11-02"), "2026-11-02")
        XCTAssertEqual(WeightDay.weekStart("2026-01-01"), "2025-12-29")
    }

    func testLocalDayStringAndNoon() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "Europe/Vienna"))
        let lateEvening = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 10, day: 31, hour: 23, minute: 30)))
        XCTAssertEqual(WeightDay.string(from: lateEvening, calendar: calendar), "2026-10-31")
        let noon = try XCTUnwrap(WeightDay.date(from: "2026-10-25", calendar: calendar))
        XCTAssertEqual(calendar.component(.hour, from: noon), 12)
        XCTAssertEqual(WeightDay.string(from: noon, calendar: calendar), "2026-10-25")
    }

    // MARK: Eingabe wie addWeight

    func testParseKgLikeWebForm() {
        XCTAssertEqual(WeightMath.parseKg("82,4"), 82.4)
        XCTAssertEqual(WeightMath.parseKg(" 82.4 "), 82.4)
        XCTAssertEqual(WeightMath.parseKg("82,"), 82)
        XCTAssertEqual(WeightMath.parseKg("082"), 82)
        XCTAssertNil(WeightMath.parseKg(",5"))
        XCTAssertNil(WeightMath.parseKg("82,4,1"))
        XCTAssertNil(WeightMath.parseKg("82 kg"))
        XCTAssertNil(WeightMath.parseKg("-80"))
        XCTAssertNil(WeightMath.parseKg(""))
        XCTAssertNil(WeightMath.parseKg("1e2"))
    }

    func testKgBoundsLikeWeb() {
        XCTAssertFalse(WeightMath.isValidKg(19.9))
        XCTAssertTrue(WeightMath.isValidKg(20))
        XCTAssertTrue(WeightMath.isValidKg(400))
        XCTAssertFalse(WeightMath.isValidKg(400.1))
        XCTAssertFalse(WeightMath.isValidKg(19))
        XCTAssertFalse(WeightMath.isValidKg(401))
        XCTAssertFalse(WeightMath.isValidKg(.nan))
    }

    // MARK: Trend wie weightTrend()

    func testTrendSmoothingWithGapsDuplicatesAndFuture() {
        let today = "2026-10-31"
        let points = WeightMath.trend([
            entry("z", "2026-11-05", 70), // Zukunft: ausgelassen
            entry("b", "2026-10-02", 81),
            entry("a", "2026-10-01", 80),
            entry("c1", "2026-10-03", 99),
            entry("c2", "2026-10-03", 82), // gleicher Tag: letzter in Profilreihenfolge gilt
            entry("d", "2026-12-31", 90), // Zukunft
            entry("e", "2026-10-31", 79), // 28 Tage Lücke
        ], today: today)
        XCTAssertEqual(points.map(\.date), ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-31"])
        XCTAssertEqual(points.map(\.entry.id), ["a", "b", "c2", "e"])

        let alpha1 = 1 - exp(-1.0 / 7)
        let t1 = 80.0
        let t2 = t1 + alpha1 * (81 - t1)
        let t3 = t2 + alpha1 * (82 - t2)
        let t4 = t3 + (1 - exp(-28.0 / 7)) * (79 - t3)
        XCTAssertEqual(points[0].trend, t1, accuracy: 1e-12)
        XCTAssertEqual(points[1].trend, t2, accuracy: 1e-12)
        XCTAssertEqual(points[2].trend, t3, accuracy: 1e-12)
        XCTAssertEqual(points[3].trend, t4, accuracy: 1e-12)
    }

    func testTrendGapIsCappedAtThirtyDays() {
        let points = WeightMath.trend([entry("a", "2026-01-01", 90), entry("b", "2026-06-01", 80)], today: "2026-10-31")
        XCTAssertEqual(points[1].trend, 90 + (1 - exp(-30.0 / 7)) * (80 - 90), accuracy: 1e-12)
        XCTAssertEqual(WeightMath.trend([], today: "2026-10-31"), [])
    }

    // MARK: Wochenmittel und aktuelles Gewicht

    func testWeeklyAveragesNewestFirst() {
        let weeks = WeightMath.weeklyAverages([
            entry("a", "2026-10-19", 82),
            entry("b", "2026-10-26", 81),
            entry("c", "2026-10-28", 80),
            entry("d", "2026-11-01", 79), // Sonntag, gleiche Woche
            entry("e", "2026-10-25", 83), // Sonntag der Vorwoche
        ])
        XCTAssertEqual(weeks.map(\.weekStart), ["2026-10-26", "2026-10-19"])
        XCTAssertEqual(weeks[0].count, 3)
        XCTAssertEqual(weeks[0].kg, 80, accuracy: 1e-12)
        XCTAssertEqual(weeks[1].count, 2)
        XCTAssertEqual(weeks[1].kg, 82.5, accuracy: 1e-12)
    }

    func testLatestAndLatestWeekIgnoreFuture() throws {
        let entries = [
            entry("a", "2026-10-26", 81),
            entry("b", "2026-10-28", 80),
            entry("b2", "2026-10-28", 70),
            entry("f", "2026-11-01", 60),
        ]
        let today = "2026-10-31"
        XCTAssertEqual(WeightMath.latest(entries, today: today)?.id, "b")
        let week = try XCTUnwrap(WeightMath.latestWeekAverage(entries, today: today))
        XCTAssertEqual(week.weekStart, "2026-10-26")
        XCTAssertEqual(week.count, 3)
        XCTAssertEqual(week.kg, 77, accuracy: 1e-12)
        XCTAssertNil(WeightMath.latestWeekAverage([entry("f", "2026-11-01", 60)], today: today))
    }

    func testCurrentWeightFallsBackToProfile() {
        let today = "2026-10-31"
        XCTAssertEqual(WeightMath.currentWeight(ProfileDocument(root: ["weights": [], "profile": ["weight": 84]]), today: today), 84)
        XCTAssertEqual(WeightMath.currentWeight(ProfileDocument(root: [
            "weights": [["id": "a", "date": "2026-10-30", "kg": 81.2]], "profile": ["weight": 84],
        ]), today: today), 81.2)
        XCTAssertNil(WeightMath.currentWeight(.empty, today: today))
    }

    func testNewestFirstAndRounding() {
        let list = WeightMath.newestFirst([entry("a", "2026-10-01", 80), entry("b", "2026-10-03", 81), entry("c", "2026-10-02", 82)])
        XCTAssertEqual(list.map(\.id), ["b", "c", "a"])
        XCTAssertEqual(WeightMath.round1(81.25), 81.3)
        XCTAssertEqual(WeightMath.round1(81.24), 81.2)
    }
}
