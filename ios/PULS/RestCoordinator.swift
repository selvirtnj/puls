import ActivityKit
import Foundation
import UserNotifications

/// Pausentimer außerhalb der App: geplante Mitteilung bei Pausenende und Live-Aktivität (Dynamic Island, Sperrbildschirm).
/// Die Web-App bleibt maßgeblich; sie meldet Start, Verlängerung und Ende über `native-bridge.js`.
final class RestCoordinator {
    static let shared = RestCoordinator()

    private let notificationID = "puls-rest"
    private let operations = ActivityOperations()
    private var notificationRevision = 0

    func start(workout: String, startsAt: Date, endsAt: Date, exercise: String, detail: String, workoutStartsAt: Date?) {
        scheduleNotification(endsAt: endsAt, exercise: exercise, detail: detail)
        let state = RestActivityAttributes.ContentState(startsAt: min(startsAt, endsAt), endsAt: endsAt, exercise: exercise, detail: detail, workoutStartsAt: workoutStartsAt)
        showActivity(workout: workout, state: state)
    }

    /// Workout läuft ohne Pause: Live-Aktivität zeigt die Workout-Zeit. Eine vorzeitig beendete Pause meldet sich nicht mehr.
    func showWorkout(workout: String, workoutStartsAt: Date, exercise: String, detail: String, cancelRest: Bool) {
        if cancelRest {
            notificationRevision += 1
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationID])
        }
        let now = Date()
        let state = RestActivityAttributes.ContentState(startsAt: now, endsAt: now, exercise: exercise, detail: detail, workoutStartsAt: workoutStartsAt)
        showActivity(workout: workout, state: state)
    }

    func cancel() {
        notificationRevision += 1
        let center = UNUserNotificationCenter.current()
        // Nur geplante Mitteilungen entfernen; eine gerade zugestellte bleibt sichtbar.
        center.removePendingNotificationRequests(withIdentifiers: [notificationID])
        endActivities()
    }

    /// Beim App-Start: übrig gebliebene Live-Aktivitäten beenden; eine noch laufende Pause meldet die Web-App sofort neu.
    func endActivities() {
        operations.enqueue(ending: true) {
            for activity in Activity<RestActivityAttributes>.activities {
                await self.end(activity)
            }
        }
    }

    private func end(_ activity: Activity<RestActivityAttributes>) async {
        var state = activity.content.state
        state.ended = true
        state.endsAt = Date()
        state.workoutStartsAt = nil
        await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
    }

    private func scheduleNotification(endsAt: Date, exercise: String, detail: String) {
        notificationRevision += 1
        let revision = notificationRevision
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            DispatchQueue.main.async {
                guard revision == self.notificationRevision else { return }
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
    }

    private func showActivity(workout: String, state: RestActivityAttributes.ContentState) {
        operations.enqueue {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
            // Nach Pausenende wird die Aktivität „stale“ und das Widget wechselt von selbst zur Workout-Zeit.
            let content = ActivityContent(state: state, staleDate: state.endsAt > state.startsAt ? state.endsAt : nil)
            let running = Activity<RestActivityAttributes>.activities.filter {
                $0.activityState == .active || $0.activityState == .stale
            }
            if let current = running.first, current.attributes.workout == workout {
                await current.update(content)
                for extra in running.dropFirst() {
                    await self.end(extra)
                }
                return
            }
            // Anderes Workout: Attribute sind unveränderlich, also neu anlegen.
            for old in running {
                await self.end(old)
            }
            do {
                _ = try Activity.request(attributes: RestActivityAttributes(workout: workout), content: content, pushType: nil)
            } catch {
                NSLog("PULS: Live-Aktivität nicht gestartet: \(error)")
            }
        }
    }
}
