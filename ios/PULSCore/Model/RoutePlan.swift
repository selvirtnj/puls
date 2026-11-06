import Foundation

/// Ergebnis einer BRouter-Anfrage (§11.6): Linie, Distanz aus `track-length`, Anstieg aus `filtered ascend`.
public struct BRouterResult: Equatable, Sendable {
    public var line: [GeoPoint]
    public var distanceKm: Double
    public var ascentM: Double?
}

/// Derselbe kostenlose, schlüssellose Dienst und dieselben Parameter wie `runPlannerRoute` (js/run-map.js).
public enum BRouter {
    /// `nil` ohne HTTPS-Adresse bzw. mit weniger als zwei Punkten.
    public static func url(base: String, profile: String, waypoints: [GeoPoint]) -> URL? {
        guard waypoints.count >= 2, base.hasPrefix("https://") else { return nil }
        let lonlats = waypoints.map { String(format: "%.6f,%.6f", $0.lon, $0.lat) }.joined(separator: "%7C")
        return URL(string: "\(base)?lonlats=\(lonlats)&profile=\(profile)&alternativeidx=0&format=geojson")
    }

    /// `nil` = keine brauchbare Strecke (dann bleiben gerade Linien). `Number(x)` des Webs: Zahl oder Zahlentext.
    public static func parse(_ data: Data) -> BRouterResult? {
        guard let json = try? JSONValue.parse(data), let feature = json["features"]?[0],
              let coordinates = feature["geometry"]?["coordinates"]?.arrayValue, coordinates.count >= 2 else { return nil }
        var line: [GeoPoint] = []
        for item in coordinates {
            guard let lon = item[0]?.doubleValue, let lat = item[1]?.doubleValue else { return nil }
            line.append(GeoPoint(lat: lat, lon: lon))
        }
        let length = number(feature["properties"]?["track-length"]).map { $0 / 1000 } ?? 0
        let distance = length.isFinite && length != 0 ? length : RoutePlan.straightKm(line)
        return BRouterResult(line: line, distanceKm: distance, ascentM: number(feature["properties"]?["filtered ascend"]))
    }

    private static func number(_ value: JSONValue?) -> Double? {
        if let number = value?.doubleValue, number.isFinite { return number }
        if let text = value?.stringValue, let number = Double(text), number.isFinite { return number }
        return nil
    }
}

/// Stand des nativen Routenplaners. Bedienung, Grenzen und Werte wie `runPlan` im Web; Native zeichnet und speichert über `route.save`.
public struct RoutePlan: Equatable, Sendable {
    public var waypoints: [GeoPoint] = []
    public var line: [GeoPoint] = []
    public var distanceKm = 0.0
    public var ascentM: Double?

    public init() {}

    /// Vorhandene Route: Linie und Werte bleiben, bis ein Punkt geändert wird.
    public init(detail: RouteDetail) {
        waypoints = RouteLine.points(detail.waypoints)
        line = detail.points
        distanceKm = detail.distanceKm ?? 0
        ascentM = detail.ascentM
    }

    /// Exakt `runMeters` (js/running.js), wie `RunTracker.distance`; nur für gerade Linien ohne BRouter-Ergebnis.
    static func meters(_ a: GeoPoint, _ b: GeoPoint) -> Double {
        let rad = Double.pi / 180
        let dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
        let h = pow(sin(dLat / 2), 2) + cos(a.lat * rad) * cos(b.lat * rad) * pow(sin(dLon / 2), 2)
        return 12_742_000 * asin(min(1, sqrt(h)))
    }

    /// `runPlannerDistance`.
    public static func straightKm(_ line: [GeoPoint]) -> Double {
        guard line.count >= 2 else { return 0 }
        return zip(line, line.dropFirst()).reduce(0) { $0 + meters($1.0, $1.1) / 1000 }
    }

    /// Gerade Linien zwischen den Punkten, bis (bzw. falls keine) Wegeführung eintrifft.
    public mutating func straighten() {
        line = waypoints
        distanceKm = Self.straightKm(waypoints)
        ascentM = nil
    }

    public mutating func apply(_ routed: BRouterResult) {
        line = routed.line
        distanceKm = routed.distanceKm
        ascentM = routed.ascentM
    }

    /// Rundkurs: erster Punkt noch einmal am Ende, ab zwei Punkten.
    public mutating func closeLoop() {
        guard waypoints.count >= 2, let first = waypoints.first else { return }
        waypoints.append(first)
    }

    /// Angezeigte und gespeicherte Distanz wie `runPlannerSave`.
    public var roundedKm: Double { min(1000, JSMath.round2(distanceKm)) }

    /// Zeit bei gelieferter typischer Pace (`runPlannerDraw`).
    public func estimatedSeconds(pace: Double?) -> Double? {
        guard let pace, pace > 0, distanceKm > 0 else { return nil }
        return pace * distanceKm
    }

    /// Kürzen wie `runPlannerSave` (jeder n-te Punkt plus Endpunkt), garantiert höchstens `limit` Punkte.
    public static func thinned(_ line: [GeoPoint], limit: Int) -> [GeoPoint] {
        guard limit >= 2, line.count > limit else { return line }
        var step = max(1, Int((Double(line.count) / Double(limit)).rounded(.up)))
        while true {
            let last = line.count - 1
            let result = line.indices.filter { $0 % step == 0 || $0 == last }.map { line[$0] }
            if result.count <= limit { return result }
            step += 1
        }
    }

    /// Name wie `runPlannerSave`: getrimmt, leer der Standardname, höchstens 60 UTF-16-Einheiten.
    public static func name(_ input: String, fallback: String) -> String {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        return String(decoding: Array((trimmed.isEmpty ? fallback : trimmed).utf16.prefix(60)), as: UTF16.self)
    }

    /// `route.save`; `expect` ergänzt der Store aus dem Profil.
    public func saveCommand(id: String, name: String, maxLinePoints: Int) -> Command? {
        ActivityCommands.saveRoute(id: id, name: name, line: Self.thinned(line, limit: maxLinePoints), waypoints: waypoints,
                                   distanceKm: roundedKm, ascentM: ascentM.map { JSMath.round($0) })
    }
}
