import Foundation
import HealthKit
import CoreLocation
import CryptoKit

/// Read-only access to Apple Health, explicitly enabled per PULS owner on this device (separate from the
/// write switch of HealthExporter). Delivers per-day values, foreign workouts and foreign weights to the web app.
/// Missing values are omitted, never replaced by 0. Never logs health values or errors.
/// Only APIs available at the deployment target (iOS 16.2) are used.
final class HealthReader {
    private let store = HKHealthStore()
    private let defaults = UserDefaults.standard
    /// Set by the controller after the HealthExporter preflight succeeded (capability present, HealthKit available).
    var available = false
    private var currentOwner = ""
    private var busy = false
    private var authorizationRevision = 0

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [HKObjectType.workoutType(), HKSeriesType.workoutRoute()]
        let identifiers: [HKQuantityTypeIdentifier] = [.stepCount, .activeEnergyBurned, .restingHeartRate,
                                                       .heartRateVariabilitySDNN, .vo2Max, .bodyMass, .heartRate]
        for identifier in identifiers {
            if let type = HKObjectType.quantityType(forIdentifier: identifier) { types.insert(type) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        return types
    }

    private func hash(_ text: String) -> String { SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined() }
    private func enabledKey(_ owner: String) -> String { "puls.healthread.enabled." + hash(owner) }

    func setContext(_ owner: String) {
        guard currentOwner != owner else { return }
        currentOwner = owner
        authorizationRevision += 1
        // Another account or the local profile must opt in again. A reload of the same owner keeps the switch.
        let ownerHash = hash(owner)
        if defaults.string(forKey: "puls.healthread.owner") != ownerHash { defaults.set(false, forKey: enabledKey(owner)) }
        defaults.set(ownerHash, forKey: "puls.healthread.owner")
    }

    func enabled(_ owner: String) -> Bool { available && defaults.bool(forKey: enabledKey(owner)) }

    /// HealthKit never reveals whether read access was granted: "enabled" means the user completed the dialog.
    /// Denied types simply return no data.
    func setEnabled(_ enabled: Bool, owner: String, completion: @escaping (Bool) -> Void) {
        guard available, owner == currentOwner else { completion(false); return }
        authorizationRevision += 1
        let revision = authorizationRevision
        if !enabled { defaults.set(false, forKey: enabledKey(owner)); completion(false); return }
        store.requestAuthorization(toShare: [], read: readTypes) { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self = self, self.currentOwner == owner, self.authorizationRevision == revision else { completion(false); return }
                self.defaults.set(success, forKey: self.enabledKey(owner))
                completion(success)
            }
        }
    }

    // MARK: Lesen

    private final class Collected {
        private let lock = NSLock()
        private(set) var days: [String: [String: Any]] = [:]
        private(set) var weights: [[String: Any]] = []
        private(set) var workouts: [[String: Any]] = []
        private(set) var failed = false
        func merge(_ key: String, _ values: [String: Double]) {
            lock.lock(); defer { lock.unlock() }
            for (day, value) in values where value.isFinite { days[day, default: ["date": day]][key] = value }
        }
        func setWeights(_ value: [[String: Any]]) { lock.lock(); weights = value; lock.unlock() }
        func setWorkouts(_ value: [[String: Any]]) { lock.lock(); workouts = value; lock.unlock() }
        func fail() { lock.lock(); failed = true; lock.unlock() }
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar.current
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
    private static func dayKey(_ date: Date) -> String { dayFormatter.string(from: date) }

    /// Reads the last `days` local calendar days (today included). Every failure ends in "unavailable" so the web app
    /// keeps its previous values instead of replacing them with an empty answer.
    func read(days requested: Int, owner: String, completion: @escaping ([String: Any]) -> Void) {
        guard available, owner == currentOwner, enabled(owner), !busy, requested >= 1, requested <= 35 else {
            completion(["ok": false, "status": "unavailable"]); return
        }
        busy = true
        let calendar = Calendar.current
        guard let first = calendar.date(byAdding: .day, value: -(requested - 1), to: calendar.startOfDay(for: Date())) else {
            busy = false; completion(["ok": false, "status": "unavailable"]); return
        }
        let firstKey = Self.dayKey(first), lastKey = Self.dayKey(Date())
        let collected = Collected()
        let group = DispatchGroup()

        func daily(_ key: String, _ identifier: HKQuantityTypeIdentifier, _ options: HKStatisticsOptions, _ unit: HKUnit) {
            group.enter()
            dailyStatistics(identifier, options: options, unit: unit, from: first) { values, failed in
                if failed { collected.fail() } else { collected.merge(key, values) }
                group.leave()
            }
        }
        daily("steps", .stepCount, .cumulativeSum, .count())
        daily("activeKcal", .activeEnergyBurned, .cumulativeSum, .kilocalorie())
        daily("restingHr", .restingHeartRate, .discreteAverage, HKUnit.count().unitDivided(by: .minute()))
        daily("hrv", .heartRateVariabilitySDNN, .discreteAverage, .secondUnit(with: .milli))
        daily("vo2max", .vo2Max, .discreteAverage,
              HKUnit.literUnit(with: .milli).unitDivided(by: HKUnit.gramUnit(with: .kilo).unitMultiplied(by: .minute())))

        group.enter()
        readSleep(from: first) { values, failed in
            if failed { collected.fail() } else { for (key, perDay) in values { collected.merge(key, perDay) } }
            group.leave()
        }
        group.enter()
        readWeights(from: first) { rows, failed in
            if failed { collected.fail() } else { collected.setWeights(rows) }
            group.leave()
        }
        group.enter()
        readWorkouts(from: first) { rows, failed in
            if failed { collected.fail() } else { collected.setWorkouts(rows) }
            group.leave()
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { completion(["ok": false, "status": "unavailable"]); return }
            self.busy = false
            // The owner may have changed or the switch may have been turned off while HealthKit was working.
            guard !collected.failed, self.currentOwner == owner, self.enabled(owner) else {
                completion(["ok": false, "status": "unavailable"]); return
            }
            let rows = collected.days.values
                .filter { ($0["date"] as? String).map { $0 >= firstKey && $0 <= lastKey } ?? false }
                .sorted { ($0["date"] as? String ?? "") < ($1["date"] as? String ?? "") }
            completion(["ok": true, "status": "ok", "days": rows, "workouts": collected.workouts, "weights": collected.weights])
        }
    }

    private func dailyStatistics(_ identifier: HKQuantityTypeIdentifier, options: HKStatisticsOptions, unit: HKUnit, from start: Date,
                                 completion: @escaping ([String: Double], Bool) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { completion([:], true); return }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: nil, options: .strictStartDate)
        let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate, options: options,
                                                anchorDate: start, intervalComponents: DateComponents(day: 1))
        query.initialResultsHandler = { _, collection, error in
            guard error == nil, let collection = collection else { completion([:], true); return }
            var values: [String: Double] = [:]
            collection.enumerateStatistics(from: start, to: Date()) { statistics, _ in
                let quantity = options.contains(.cumulativeSum) ? statistics.sumQuantity() : statistics.averageQuantity()
                // A day without samples has no quantity; a measured zero is not worth showing either.
                if let quantity = quantity {
                    let value = quantity.doubleValue(for: unit)
                    if value.isFinite && value > 0 { values[Self.dayKey(statistics.startDate)] = value }
                }
            }
            completion(values, false)
        }
        store.execute(query)
    }

    /// Union of overlapping intervals, so several sources reporting the same night are not counted twice.
    private func unionSeconds(_ intervals: [(Date, Date)]) -> Double {
        var total = 0.0
        var current: (Date, Date)? = nil
        for interval in intervals.sorted(by: { $0.0 < $1.0 }) {
            if let open = current {
                if interval.0 <= open.1 { current = (open.0, max(open.1, interval.1)) }
                else { total += open.1.timeIntervalSince(open.0); current = interval }
            } else { current = interval }
        }
        if let open = current { total += open.1.timeIntervalSince(open.0) }
        return total
    }

    /// A night belongs to the local day on which it ends: a segment is assigned to the day of (start + 6 h),
    /// so sleep from 18:00 onwards counts for the next morning. Only asleep categories, no "in bed" or "awake".
    private func readSleep(from start: Date, completion: @escaping ([String: [String: Double]], Bool) -> Void) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { completion([:], true); return }
        let predicate = HKQuery.predicateForSamples(withStart: start.addingTimeInterval(-6 * 3600), end: nil, options: [])
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            guard error == nil else { completion([:], true); return }
            var total: [String: [(Date, Date)]] = [:]
            var deep: [String: [(Date, Date)]] = [:]
            var rem: [String: [(Date, Date)]] = [:]
            var core: [String: [(Date, Date)]] = [:]
            for case let sample as HKCategorySample in samples ?? [] {
                let day = Self.dayKey(sample.startDate.addingTimeInterval(6 * 3600)), span = (sample.startDate, sample.endDate)
                switch sample.value {
                case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: deep[day, default: []].append(span)
                case HKCategoryValueSleepAnalysis.asleepREM.rawValue: rem[day, default: []].append(span)
                case HKCategoryValueSleepAnalysis.asleepCore.rawValue: core[day, default: []].append(span)
                case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue: break
                default: continue
                }
                total[day, default: []].append(span)
            }
            func minutes(_ source: [String: [(Date, Date)]]) -> [String: Double] {
                var result: [String: Double] = [:]
                for (day, intervals) in source {
                    let value = (self.unionSeconds(intervals) / 60).rounded()
                    if value.isFinite && value > 0 { result[day] = value }
                }
                return result
            }
            completion(["sleepMinutes": minutes(total), "sleepDeep": minutes(deep), "sleepRem": minutes(rem), "sleepCore": minutes(core)], false)
        }
        store.execute(query)
    }

    /// Latest foreign body-mass sample per local day. Samples written by PULS itself are skipped.
    private func readWeights(from start: Date, completion: @escaping ([[String: Any]], Bool) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: .bodyMass) else { completion([], true); return }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: nil, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { _, samples, error in
            guard error == nil else { completion([], true); return }
            let own = Bundle.main.bundleIdentifier ?? ""
            var perDay: [String: Double] = [:]
            for case let sample as HKQuantitySample in samples ?? [] where sample.sourceRevision.source.bundleIdentifier != own {
                let kg = sample.quantity.doubleValue(for: HKUnit.gramUnit(with: .kilo))
                if kg.isFinite && kg > 0 { perDay[Self.dayKey(sample.startDate)] = kg }
            }
            let rows: [[String: Any]] = perDay.keys.sorted().map { ["date": $0, "kg": ((perDay[$0] ?? 0) * 10).rounded() / 10] }
            completion(rows, false)
        }
        store.execute(query)
    }

    // MARK: Workouts

    /// Reverse of the mapping in HealthExporter.sample(): unknown types become "other".
    private func kind(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "strength"
        case .running: return "run"
        case .walking: return "walk"
        case .hiking: return "hike"
        case .cycling: return "ride"
        case .soccer: return "soccer"
        case .tableTennis: return "tabletennis"
        case .martialArts: return "mma"
        case .tennis: return "padel"
        case .skatingSports: return "inline"
        default: return "other"
        }
    }

    private func summary(_ workout: HKWorkout) -> [String: Any]? {
        guard workout.duration.isFinite, workout.duration > 0, workout.endDate <= Date().addingTimeInterval(60) else { return nil }
        var row: [String: Any] = [
            "id": workout.uuid.uuidString,
            "kind": kind(workout.workoutActivityType),
            "startedAt": ISO8601DateFormatter().string(from: workout.startDate),
            "durationSeconds": Int(workout.duration.rounded())
        ]
        var meters = workout.statistics(for: HKQuantityType(.distanceWalkingRunning))?.sumQuantity()?.doubleValue(for: .meter())
        if meters == nil { meters = workout.statistics(for: HKQuantityType(.distanceCycling))?.sumQuantity()?.doubleValue(for: .meter()) }
        if meters == nil { meters = workout.totalDistance?.doubleValue(for: .meter()) }
        if let meters = meters, meters.isFinite, meters > 0 { row["distanceKm"] = (meters / 10).rounded() / 100 }
        // Measured active energy only; no estimate.
        var kcal = workout.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
        if kcal == nil { kcal = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) }
        if let kcal = kcal, kcal.isFinite, kcal > 0 { row["kcal"] = Int(kcal.rounded()) }
        if let heart = workout.statistics(for: HKQuantityType(.heartRate)) {
            let unit = HKUnit.count().unitDivided(by: .minute())
            if let average = heart.averageQuantity()?.doubleValue(for: unit), average.isFinite, average > 0 { row["avgHr"] = Int(average.rounded()) }
            if let maximum = heart.maximumQuantity()?.doubleValue(for: unit), maximum.isFinite, maximum > 0 { row["maxHr"] = Int(maximum.rounded()) }
        }
        return row
    }

    private func readWorkouts(from start: Date, completion: @escaping ([[String: Any]], Bool) -> Void) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: nil, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: 100, sortDescriptors: [sort]) { [weak self] _, samples, error in
            guard let self = self, error == nil else { completion([], true); return }
            let own = Bundle.main.bundleIdentifier ?? ""
            let foreign = (samples as? [HKWorkout] ?? []).filter { $0.sourceRevision.source.bundleIdentifier != own }
            var rows: [[String: Any]] = []
            var routeBudget = 40
            func next(_ index: Int) {
                guard index < foreign.count else { completion(rows, false); return }
                guard var row = self.summary(foreign[index]) else { next(index + 1); return }
                let outdoor = ["run", "walk", "hike", "ride", "inline"].contains(row["kind"] as? String ?? "")
                guard outdoor, routeBudget > 0 else { rows.append(row); next(index + 1); return }
                routeBudget -= 1
                self.route(for: foreign[index]) { points in
                    if let points = points { row["route"] = points }
                    rows.append(row)
                    next(index + 1)
                }
            }
            next(0)
        }
        store.execute(query)
    }

    /// Simplified route: at most 300 [lat, lon] pairs, accuracy filtered, always ending at the last point.
    private func route(for workout: HKWorkout, completion: @escaping ([[Double]]?) -> Void) {
        let query = HKSampleQuery(sampleType: HKSeriesType.workoutRoute(), predicate: HKQuery.predicateForObjects(from: workout),
                                  limit: 1, sortDescriptors: nil) { [weak self] _, samples, error in
            guard let self = self, error == nil, let route = (samples as? [HKWorkoutRoute])?.first else { completion(nil); return }
            var locations: [CLLocation] = []
            var finished = false
            let routeQuery = HKWorkoutRouteQuery(route: route) { _, batch, done, error in
                guard !finished else { return }
                if error != nil { finished = true; completion(nil); return }
                locations.append(contentsOf: batch ?? [])
                if done { finished = true; completion(self.simplify(locations)) }
            }
            self.store.execute(routeQuery)
        }
        store.execute(query)
    }

    private func simplify(_ locations: [CLLocation]) -> [[Double]]? {
        let usable = locations.filter {
            $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 35 && CLLocationCoordinate2DIsValid($0.coordinate)
        }
        guard usable.count >= 2 else { return nil }
        let step = max(1, Int((Double(usable.count) / 299).rounded(.up)))
        var picked = usable.enumerated().filter { $0.offset % step == 0 }.map { $0.element }
        if let last = usable.last, picked.last !== last { picked.append(last) }
        return picked.map { [$0.coordinate.latitude, $0.coordinate.longitude] }
    }
}
