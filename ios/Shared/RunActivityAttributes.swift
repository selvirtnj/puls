import ActivityKit
import Foundation

/// Gemeinsame Daten der Lauf-Live-Aktivität (App und Widget-Erweiterung).
/// Läuft der Lauf, zählt iOS die Zeit ab `timerStart` selbst (Pausen sind dort schon herausgerechnet);
/// pausiert zeigt sie `pausedElapsed` fest an.
struct RunActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var timerStart: Date
        var pausedElapsed: Double?
        var distanceKm: Double
        var paceSeconds: Double?
        var lastSplitSeconds: Double?
        var routeKm: Double?
        var gps: Bool
    }

    var title: String
}

extension RunActivityAttributes.ContentState {
    var isPaused: Bool { pausedElapsed != nil }

    static func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded()))
        let h = total / 3600, m = total % 3600 / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%02d:%02d", m, s)
    }

    static func pace(_ seconds: Double?) -> String {
        guard let seconds = seconds, seconds.isFinite, seconds > 0, seconds < 3600 else { return "–" }
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    var distanceText: String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: distanceKm)) ?? String(format: "%.2f", distanceKm)
    }

    var routeProgress: Double? {
        guard let routeKm = routeKm, routeKm > 0 else { return nil }
        return min(1, distanceKm / routeKm)
    }
}
