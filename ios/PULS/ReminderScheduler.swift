import Foundation
import UserNotifications
import CryptoKit

/// Local weekly reminders. Never removes rest/km requests or changes their notification delegate.
final class ReminderScheduler {
    private let center = UNUserNotificationCenter.current()
    private var generation = 0
    private var owner = ""
    private let defaults = UserDefaults.standard
    var settings: [String: Any] { defaults.dictionary(forKey: "puls.reminders.settings") ?? [:] }
    private var ids: [String] { (defaults.stringArray(forKey: "puls.reminders.ids") ?? []) + ["training", "weight"].flatMap { key in (1...7).map { "puls-reminder-\(key)-\($0)" } } }

    func setContext(_ owner: String) {
        guard self.owner != owner else { return }
        self.owner = owner
        generation += 1
        let hash = SHA256.hash(data: Data(owner.utf8)).map { String(format: "%02x", $0) }.joined()
        if defaults.string(forKey: "puls.reminders.owner") != hash {
            center.removePendingNotificationRequests(withIdentifiers: ids)
            center.removeDeliveredNotifications(withIdentifiers: ids)
            defaults.set([], forKey: "puls.reminders.ids")
            defaults.removeObject(forKey: "puls.reminders.settings")
        }
        defaults.set(hash, forKey: "puls.reminders.owner")
    }

    func set(_ preferences: [String: Any], owner: String, completion: @escaping (Bool) -> Void) {
        guard self.owner == owner else { completion(false); return }
        var requests: [UNNotificationRequest] = []
        for key in ["training", "weight"] {
            guard let row = preferences[key] as? [String: Any], let enabled = row["enabled"] as? Bool,
                  let time = row["time"] as? String, let days = row["days"] as? [Int],
                  days.count <= 7, Set(days).count == days.count, days.allSatisfy({ (1...7).contains($0) }) else { completion(false); return }
            let parts = time.split(separator: ":").compactMap { Int($0) }
            guard time.count == 5, parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]), !enabled || !days.isEmpty else { completion(false); return }
            if !enabled { continue }
            for day in days {
                let content = UNMutableNotificationContent()
                content.title = key == "training" ? "Zeit fürs Training" : "Gewicht erfassen"
                content.body = key == "training" ? "Dein Training wartet in PULS." : "Trage dein Gewicht in PULS ein."
                content.sound = .default
                var date = DateComponents()
                date.weekday = day; date.hour = parts[0]; date.minute = parts[1]
                requests.append(UNNotificationRequest(identifier: "puls-reminder-\(key)-\(day)-\(UUID().uuidString)", content: content,
                                                       trigger: UNCalendarNotificationTrigger(dateMatching: date, repeats: true)))
            }
        }
        generation += 1
        let revision = generation
        func install() {
            guard self.generation == revision, self.owner == owner else { completion(false); return }
            self.center.removePendingNotificationRequests(withIdentifiers: self.ids)
            self.center.removeDeliveredNotifications(withIdentifiers: self.ids)
            self.defaults.set(requests.map { $0.identifier }, forKey: "puls.reminders.ids")
            self.install(requests, index: 0, revision: revision) { success in
                if revision == self.generation {
                    if success { self.defaults.set(preferences, forKey: "puls.reminders.settings") }
                    else { self.defaults.removeObject(forKey: "puls.reminders.settings") }
                }
                completion(success)
            }
        }
        if requests.isEmpty { install(); return }
        // Only an explicit enabled reminder may ask. Existing rest notification authorization is shared by iOS.
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            DispatchQueue.main.async { if granted { install() } else { completion(false) } }
        }
    }

    private func install(_ requests: [UNNotificationRequest], index: Int, revision: Int, completion: @escaping (Bool) -> Void) {
        guard revision == generation else { completion(false); return }
        guard index < requests.count else { completion(true); return }
        center.add(requests[index]) { error in
            DispatchQueue.main.async {
                guard revision == self.generation else {
                    // A late add may arrive after cancellation. IDs are unique per plan, so cleanup cannot delete a newer plan.
                    self.center.removePendingNotificationRequests(withIdentifiers: [requests[index].identifier])
                    completion(false); return
                }
                if error != nil {
                    self.center.removePendingNotificationRequests(withIdentifiers: self.ids)
                    completion(false)
                } else { self.install(requests, index: index + 1, revision: revision, completion: completion) }
            }
        }
    }
}
