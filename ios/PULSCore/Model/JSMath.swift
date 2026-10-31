import Foundation

/// Rundung exakt wie die Web-App (JavaScript, IEEE-754-Double), damit Wirkungsprüfungen und Anzeigen gleich ausfallen.
public enum JSMath {
    /// `Math.round(x)`: kaufmännisch, aber `.5` immer Richtung +∞ (`Math.round(-2.5) == -2`).
    public static func round(_ value: Double) -> Double {
        guard value.isFinite else { return value }
        // V8: Math.round(x) ist für −0,5 ≤ x < 0 (und −0) eine negative Null, nicht +0.
        if value < 0 && value >= -0.5 { return -Double.zero }
        if value == 0 { return value }
        // Nicht `floor(x + 0.5)`: das ergäbe für 0.49999999999999994 fälschlich 1. `x - floor(x)` ist exakt.
        let lower = value.rounded(.down)
        return value - lower >= 0.5 ? lower + 1 : lower
    }

    /// `Math.round(x*10)/10` (Web `round()` und `saveRunGoal`). Gleiche Double-Arithmetik: zuerst `x*10`, dann runden.
    /// Beispiele: 25.15 → 25.2 (25.15*10 ist als Double genau 251.5), 2.675 → 2.7, -2.25 → -2.2.
    public static func round1(_ value: Double) -> Double {
        round(value * 10) / 10
    }

    /// `Math.round(x*100)/100` (Web `runPlannerSave`, `route.save`, Ersatzdistanz). Beispiele: 5.125 → 5.13
    /// (5.125*100 ist als Double genau 512.5), 1.005 → 1 (1.005*100 ist 100.49999999999999).
    public static func round2(_ value: Double) -> Double {
        round(value * 100) / 100
    }
}
