import ActivityKit
import Foundation
import UserNotifications

/// Pausentimer außerhalb der App: geplante Mitteilung bei Pausenende und Live-Aktivität (Dynamic Island, Sperrbildschirm).
/// Die Web-App bleibt maßgeblich; sie meldet Start, Verlängerung und Ende über `native-bridge.js`.
final class RestCoordinator {
    static let shared = RestCoordinator()

    private let notificationID = "puls-rest"

    func start(workout: String, startsAt: Date, endsAt: Date, exercise: String, detail: String) {
        scheduleNotification(endsAt: endsAt, exercise: exercise, detail: detail)
        let state = RestActivityAttributes.ContentState(startsAt: min(startsAt, endsAt), endsAt: endsAt, exercise: exercise, detail: detail)
        showActivity(workout: workout, state: state)
    }

    func cancel() {
        let center = UNUserNotificationCenter.current()
        // Nur geplante Mitteilungen entfernen; eine gerade zugestellte bleibt sichtbar.
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        endActivities()
    }

    /// Beim App-Start: übrig gebliebene Live-Aktivitäten beenden; eine noch laufende Pause meldet die Web-App sofort neu.
    func endActivities() {
        for activity in Activity<RestActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }

    private func scheduleNotification(endsAt: Date, exercise: String, detail: String) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            let interval = endsAt.timeIntervalSinceNow
            guard granted, interval > 1 else { return }
            let content = UNMutableNotificationContent()
            content.title = "Pause vorbei"
            content.body = "Nächster Satz: \(exercise) · \(detail)"
            content.sound = .default
            content.threadIdentifier = "puls-rest"
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            // Gleiche ID ersetzt eine bereits geplante Mitteilung, z. B. nach „+30 s“.
            center.add(UNNotificationRequest(identifier: self.notificationID, content: content, trigger: trigger))
        }
    }

    private func showActivity(workout: String, state: RestActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let content = ActivityContent(state: state, staleDate: state.endsAt)
        let running = Activity<RestActivityAttributes>.activities
        if let current = running.first, current.attributes.workout == workout {
            Task { await current.update(content) }
            for extra in running.dropFirst() {
                Task { await extra.end(nil, dismissalPolicy: .immediate) }
            }
            return
        }
        // Anderes Workout: Attribute sind unveränderlich, also neu anlegen.
        for old in running {
            Task { await old.end(nil, dismissalPolicy: .immediate) }
        }
        do {
            _ = try Activity.request(attributes: RestActivityAttributes(workout: workout), content: content, pushType: nil)
        } catch {
            NSLog("PULS: Live-Aktivität nicht gestartet: \(error)")
        }
    }
}
