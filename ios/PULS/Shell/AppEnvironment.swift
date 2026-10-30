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
        store = ProfileStore(environment: environment)
    }
}
