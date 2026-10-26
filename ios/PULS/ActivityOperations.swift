import UIKit

/// ActivityKit-Aufrufe in Nachrichtenreihenfolge ausführen. Ein Ende wartet auf vorherige Updates.
/// iOS darf den letzten Aufruf auch nach dem Wechsel in den Hintergrund noch abschließen.
final class ActivityOperations {
    private var pending: Task<Void, Never>?

    func enqueue(ending: Bool = false, _ operation: @escaping @MainActor () async -> Void) {
        let previous = pending
        pending = Task { @MainActor in
            let lease = ending ? BackgroundLease() : nil
            await previous?.value
            await operation()
            lease?.end()
        }
    }
}

@MainActor
private final class BackgroundLease {
    private var identifier: UIBackgroundTaskIdentifier = .invalid

    init() {
        identifier = UIApplication.shared.beginBackgroundTask(withName: "PULS Live Activity") { [weak self] in
            Task { @MainActor in self?.end() }
        }
    }

    func end() {
        guard identifier != .invalid else { return }
        UIApplication.shared.endBackgroundTask(identifier)
        identifier = .invalid
    }
}
