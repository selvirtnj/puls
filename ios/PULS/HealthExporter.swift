import Foundation
import HealthKit
import CryptoKit

/// Write-only, explicitly enabled per PULS owner on this device. Never logs health values/errors.
final class HealthExporter {
    private let store = HKHealthStore()
    private let defaults = UserDefaults.standard
    private let weight = HKQuantityType.quantityType(forIdentifier: .bodyMass)!
    private var writeTypes: Set<HKSampleType> { [weight, HKObjectType.workoutType()] }
    private(set) var available = false
    private var currentOwner = ""
    private var busy = false
    private var authorizationRevision = 0

    /// Provisioning alone is not a permission grant. A non-prompting API preflight must also succeed.
    /// Missing/stripped HealthKit capabilities fail closed; the WebView still loads normally.
    func checkAvailability(_ completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable(), provisionAllowsHealth() else { completion(false); return }
        store.getRequestStatusForAuthorization(toShare: writeTypes, read: []) { [weak self] _, error in
            DispatchQueue.main.async {
                self?.available = error == nil
                completion(error == nil)
            }
        }
    }

    private func provisionAllowsHealth() -> Bool {
        // Only inspect the capability flag; no certificate, account or device data is retained/logged.
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
              let plist = try? PropertyListSerialization.propertyList(from: data.subdata(in: start.lowerBound..<end.upperBound), format: nil),
              let dictionary = plist as? [String: Any],
              let entitlements = dictionary["Entitlements"] as? [String: Any] else { return false }
        return entitlements["com.apple.developer.healthkit"] as? Bool == true
    }

    private func hash(_ text: String) -> String { SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined() }
    private func enabledKey(_ owner: String) -> String { "puls.health.enabled." + hash(owner) }
    func setContext(_ owner: String) {
        guard currentOwner != owner else { return }
        currentOwner = owner
        authorizationRevision += 1
        // Returning to another account requires explicit opt-in again. A reload of the same owner preserves it.
        let ownerHash = hash(owner)
        if defaults.string(forKey: "puls.health.owner") != ownerHash { defaults.set(false, forKey: enabledKey(owner)) }
        defaults.set(ownerHash, forKey: "puls.health.owner")
    }
    func enabled(_ owner: String) -> Bool { available && defaults.bool(forKey: enabledKey(owner)) }

    func setEnabled(_ enabled: Bool, owner: String, completion: @escaping (Bool) -> Void) {
        guard available, owner == currentOwner else { completion(false); return }
        authorizationRevision += 1
        let revision = authorizationRevision
        if !enabled { defaults.set(false, forKey: enabledKey(owner)); completion(false); return }
        // The sole authorization request: called only by the settings switch, never by Sync/startup.
        store.requestAuthorization(toShare: writeTypes, read: []) { [weak self] success, _ in
            DispatchQueue.main.async {
                guard let self = self, self.currentOwner == owner, self.authorizationRevision == revision else { completion(false); return }
                let granted = success && self.writeTypes.contains { self.store.authorizationStatus(for: $0) == .sharingAuthorized }
                self.defaults.set(granted, forKey: self.enabledKey(owner))
                completion(granted)
            }
        }
    }

    func sync(_ rows: [[String: Any]], owner: String, completion: @escaping (String) -> Void) {
        guard available, owner == currentOwner, enabled(owner), !busy, rows.count <= 50 else { completion("unavailable"); return }
        busy = true
        var denied = false
        func next(_ index: Int) {
            guard index < rows.count, self.currentOwner == owner, self.enabled(owner) else {
                self.busy = false; completion(denied ? "denied" : "saved"); return
            }
            let row = rows[index]
            guard let key = row["key"] as? String, key.count <= 250,
                  let data = try? JSONSerialization.data(withJSONObject: row, options: [.sortedKeys]),
                  let signatureSource = String(data: data, encoding: .utf8) else { next(index + 1); return }
            let identifier = "puls." + self.hash(owner + ":" + key)
            let signature = self.hash(signatureSource), ledgerKey = "puls.health.sample." + identifier
            guard let sample = self.sample(row, identifier: identifier) else { next(index + 1); return }
            if self.store.authorizationStatus(for: sample.sampleType) != .sharingAuthorized {
                denied = true; next(index + 1); return
            }
            if self.defaults.string(forKey: ledgerKey) == signature { next(index + 1); return }
            self.store.save(sample) { success, _ in
                DispatchQueue.main.async {
                    if success { self.defaults.set(signature, forKey: ledgerKey) }
                    else { denied = true }
                    next(index + 1)
                }
            }
        }
        next(0)
    }

    private func sample(_ row: [String: Any], identifier: String) -> HKSample? {
        guard let kind = row["kind"] as? String, let startMS = row["start"] as? Double,
              let endMS = row["end"] as? Double, startMS.isFinite, endMS.isFinite,
              startMS > 0, endMS >= startMS, endMS <= Date().timeIntervalSince1970 * 1000 + 1000 else { return nil }
        let start = Date(timeIntervalSince1970: startMS / 1000), end = Date(timeIntervalSince1970: endMS / 1000)
        // HealthKit replaces this source's object with the same identifier and a newer version.
        var metadata: [String: Any] = [HKMetadataKeySyncIdentifier: identifier,
                                      HKMetadataKeySyncVersion: Int64(Date().timeIntervalSince1970 * 1000)]
        if kind == "weight" {
            guard let kg = row["kg"] as? Double, kg.isFinite, kg >= 20, kg <= 400 else { return nil }
            metadata["PULSDateResolution"] = "day"
            return HKQuantitySample(type: weight, quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kg), start: start, end: start, metadata: metadata)
        }
        guard let duration = row["duration"] as? Double, duration.isFinite, duration > 0,
              duration <= 172800, duration <= end.timeIntervalSince(start) + 1 else { return nil }
        let activity: HKWorkoutActivityType
        switch kind {
        case "strength": activity = .traditionalStrengthTraining
        case "run", "trail": activity = .running
        case "walk": activity = .walking
        case "hike", "mountain": activity = .hiking
        case "ride": activity = .cycling
        case "soccer": activity = .soccer
        case "tabletennis": activity = .tableTennis
        case "mma": activity = .martialArts
        case "padel": activity = .tennis
        case "inline": activity = .skatingSports
        default: activity = .other
        }
        var distance: HKQuantity?
        if let meters = row["distance"] as? Double, meters.isFinite, meters > 0, meters <= 1000000 {
            distance = HKQuantity(unit: .meter(), doubleValue: meters)
        }
        // No invented energy/heart-rate samples. Duration is recorded moving time, end includes known pauses.
        return HKWorkout(activityType: activity, start: start, end: end, duration: duration,
                         totalEnergyBurned: nil, totalDistance: distance, metadata: metadata)
    }
}
