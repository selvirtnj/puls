import ActivityKit
import Foundation

struct WorkoutAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var name: String
        var startedAt: Date
        var restEndAt: Date?
    }
    var workoutID: String
}

