import ActivityKit
import Foundation

/// Gemeinsame Daten der Pausen-Live-Aktivität (App und Widget-Erweiterung).
struct RestActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var startsAt: Date
        var endsAt: Date
        var exercise: String
        var detail: String
    }

    var workout: String
}
