import ActivityKit
import Foundation

/// Gemeinsame Daten der Workout-Live-Aktivität (App und Widget-Erweiterung).
/// Läuft eine Pause (`endsAt` > `startsAt`), zeigt sie den Countdown; sonst die Workout-Zeit ab `workoutStartsAt`.
struct RestActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startsAt: Date
        var endsAt: Date
        var exercise: String
        var detail: String
        var workoutStartsAt: Date?
        var ended: Bool? = nil
    }

    var workout: String
}
