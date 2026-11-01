import Foundation
import PULSCore

/// Gemeinsame App-Abhängigkeiten: genau ein `ProfileStore` für Brücke (`StateBridge`) und native Bereiche.
@MainActor
final class AppEnvironment {
    /// `nil`, wenn `Application Support` nicht verfügbar ist; dann meldet die App weder `stateBridge` noch
    /// native Bereiche und das Web bleibt wie bisher.
    let store: ProfileStore?

    init() {
        guard var environment = try? StoreEnvironment.live() else {
            store = nil
            return
        }
        // Optimistische Vorschau für die Gewichts-Ops (gleiche Mutation wie das Web).
        environment.reducers.merge(BridgeOps.weightReducers) { _, new in new }
        // M4: Vorschau nur für eindeutig vorhersagbare Trainings-Ops (Satzwerte, Entfernen, Verschieben, Pause beenden).
        environment.reducers.merge(BridgeOps.trainingReducers) { _, new in new }
        // M5: Einstellungs-Ops (Ansicht, Kurven, Wochenziele) zeigen ihren eindeutigen Zielwert sofort.
        environment.reducers.merge(BridgeOps.progressReducers) { _, new in new }
        // M6: nur eindeutige Aktivitäts-Wirkungen (Verwerfen, Bearbeiten, Löschen, Einstellungen, Route löschen).
        environment.reducers.merge(BridgeOps.activityReducers) { _, new in new }
        // M7: nur eindeutige Ernährungs-Wirkungen (Löschen/Wiederherstellen, Wasser, Tagesabschluss, Ziele, Favorit).
        environment.reducers.merge(BridgeOps.nutritionReducers) { _, new in new }
        // M8: nur eindeutige Konto-Wirkungen (Name, Avatar entfernen, Maße, Sprache, Klänge).
        environment.reducers.merge(BridgeOps.accountReducers) { _, new in new }
        store = ProfileStore(environment: environment)
    }
}
