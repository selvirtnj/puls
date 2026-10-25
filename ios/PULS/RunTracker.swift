import CoreLocation
import Foundation

/// GPS für Läufe (js/running.js): zeichnet auch bei gesperrtem iPhone auf (UIBackgroundModes location).
/// Die Web-App fragt die Punkte per „runGpsSync“ ab und berechnet Distanz und Strecke selbst.
/// Punkte liegen zusätzlich in einer Datei, damit ein Neustart der App den laufenden Lauf nicht verliert.
final class RunTracker: NSObject, CLLocationManagerDelegate {
    static let shared = RunTracker()

    private let manager = CLLocationManager()
    private let fileURL: URL
    private(set) var runKey = ""
    private var segment = 0
    /// Zwischengespeicherte Positionen von vor dem Abschnittsbeginn verwirft die Aufzeichnung.
    private var segmentStart = Date.distantPast
    private var points: [[Double]] = []
    private var active = false
    private var lastPersist = Date.distantPast
    /// Distanz nach denselben Regeln wie runAcceptedPoints in js/running.js (Live-Aktivität und km-Mitteilungen,
    /// auch wenn die Web-App im Hintergrund schläft).
    private(set) var meters = 0.0
    private var lastAccepted: [Double]?

    override init() {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        fileURL = folder.appendingPathComponent("run-track.json")
        super.init()
        manager.delegate = self
        manager.activityType = .fitness
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 3
        manager.pausesLocationUpdatesAutomatically = false
        load()
    }

    /// Startet oder setzt die Aufzeichnung fort. Ein neuer runKey beginnt eine leere Strecke.
    func start(runKey: String, segment: Int, since: Date) {
        guard !runKey.isEmpty else { return }
        if runKey != self.runKey {
            self.runKey = runKey
            points = []
            recompute()
            persist(force: true)
        }
        self.segment = segment
        segmentStart = since
        active = true
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            begin()
        default:
            break
        }
    }

    /// Pause oder Ende. clear verwirft die gespeicherte Strecke (Lauf gespeichert oder verworfen).
    func stop(clear: Bool) {
        active = false
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        if clear {
            runKey = ""
            points = []
            recompute()
        }
        persist(force: true)
    }

    /// Antwort für pulsRunGpsReceive: höchstens 500 Punkte ab Index since.
    func payload(runKey: String, since: Int) -> [String: Any] {
        var result: [String: Any] = ["runKey": runKey, "from": since, "points": [[Double]](), "status": status(), "total": runKey == self.runKey ? points.count : 0]
        guard runKey == self.runKey, since >= 0, since <= points.count else { return result }
        result["points"] = Array(points[since..<min(points.count, since + 500)])
        return result
    }

    private func status() -> String {
        switch manager.authorizationStatus {
        case .notDetermined: return "pending"
        case .denied, .restricted: return "denied"
        default: return active ? "on" : "off"
        }
    }

    private func begin() {
        guard active else { return }
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if active { begin() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard active else { return }
        // Feste Obergrenze statt Kürzen: Die Web-App zählt Punkte per Index („since“).
        for location in locations where location.horizontalAccuracy >= 0 && location.timestamp >= segmentStart.addingTimeInterval(-1) && points.count < 30000 {
            // Format wie run-metrics.js: [t,lat,lon,acc,seg,alt,altAcc].
            // altAcc=-1 bedeutet unbekannt; alt=0 ist dann nur ein Platzhalter.
            let hasAltitude = location.altitude.isFinite && location.verticalAccuracy.isFinite && location.verticalAccuracy >= 0
            let point = [
                (location.timestamp.timeIntervalSince1970 * 1000).rounded(),
                location.coordinate.latitude,
                location.coordinate.longitude,
                location.horizontalAccuracy.rounded(),
                Double(segment),
                hasAltitude ? location.altitude : 0,
                hasAltitude ? location.verticalAccuracy : -1
            ]
            points.append(point)
            accept(point)
        }
        persist(force: false)
        RunActivityCoordinator.shared.nativeDistanceChanged(runKey: runKey, km: meters / 1000)
    }

    private func accept(_ p: [Double]) {
        guard p[3] <= 35 else { return }
        if let last = lastAccepted, last[4] == p[4] {
            let m = Self.distance(last, p), dt = (p[0] - last[0]) / 1000
            if m < 4 || dt <= 0 || m / dt > 12 { return }
            meters += m
        }
        lastAccepted = p
    }

    private func recompute() {
        meters = 0
        lastAccepted = nil
        points.forEach(accept)
    }

    /// Haversine wie runMeters in js/running.js.
    private static func distance(_ a: [Double], _ b: [Double]) -> Double {
        let rad = Double.pi / 180, dLat = (b[1] - a[1]) * rad, dLon = (b[2] - a[2]) * rad
        let h = pow(sin(dLat / 2), 2) + cos(a[1] * rad) * cos(b[1] * rad) * pow(sin(dLon / 2), 2)
        return 12_742_000 * asin(min(1, sqrt(h)))
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        NSLog("PULS: GPS-Fehler: \(error)")
    }

    private func persist(force: Bool) {
        guard force || Date().timeIntervalSince(lastPersist) > 10 else { return }
        lastPersist = Date()
        let data: [String: Any] = ["runKey": runKey, "points": points]
        if let json = try? JSONSerialization.data(withJSONObject: data) {
            try? json.write(to: fileURL, options: .atomic)
        }
    }

    private func load() {
        guard let data = try? Data(contentsOf: fileURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        runKey = json["runKey"] as? String ?? ""
        // Alte Aufzeichnungen ohne Höhe unverändert weiterverwenden.
        points = (json["points"] as? [[Double]] ?? []).filter { $0.count == 5 || $0.count == 7 }
        recompute()
    }
}
