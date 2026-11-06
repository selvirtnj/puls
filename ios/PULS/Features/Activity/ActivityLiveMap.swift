import SwiftUI
import MapKit
import Observation

// Gerätetest ipa-42 „Keine Map bei Laufen“: Live-Karte für GPS-Aktivitäten (eigene Position, bisherige Strecke,
// automatisches Mitführen, einklappbar). Nur Anzeige: Die Punkte liest `LiveRouteModel` lesend aus `RunTracker`
// über dessen bestehende Abfrage `payload(runKey:since:)` (dieselbe wie `runGpsSync` des Webs). Aufzeichnung,
// Distanz und Speicherung bleiben unverändert bei RunTracker bzw. im Web.

/// Strecke der laufenden Aufzeichnung, höchstens alle `interval` Sekunden nachgeladen (Akku).
@Observable
@MainActor
final class LiveRouteModel {
    /// Abschnitte (Pausen trennen, wie `run.segment`), je mindestens zwei Punkte.
    private(set) var segments: [[CLLocationCoordinate2D]] = []
    @ObservationIgnored private var runKey: String?
    @ObservationIgnored private var consumed = 0
    @ObservationIgnored private var collected: [[CLLocationCoordinate2D]] = []
    @ObservationIgnored private var lastSegment: Double?

    /// Genauigkeitsgrenze wie `RunTracker.accept` (nur für die Linie; die Distanz rechnet weiter das Web).
    private static let maxAccuracy = 35.0
    private static let interval: Duration = .seconds(4)

    /// Läuft, solange die Karte sichtbar ist (`.task`); Abbruch beim Ausblenden.
    func follow(runKey key: String) async {
        reset(for: key)
        while !Task.isCancelled {
            refresh()
            try? await Task.sleep(for: Self.interval)
        }
    }

    private func reset(for key: String) {
        guard key != runKey else { return }
        runKey = key
        consumed = 0
        collected = []
        lastSegment = nil
        segments = []
    }

    private func refresh() {
        guard let key = runKey else { return }
        let tracker = RunTracker.shared
        // Nur die eigene Aufzeichnung; eine gekürzte Liste (`total < consumed`) wird unten von vorn gelesen.
        guard tracker.runKey == key else { return }
        var added = false
        // Seitenweise wie die Web-Abfrage (je höchstens 500 Punkte).
        for _ in 0..<80 {
            let payload = tracker.payload(runKey: key, since: consumed)
            let total = payload["total"] as? Int ?? 0
            if total < consumed {
                consumed = 0
                collected = []
                lastSegment = nil
                added = true
                continue
            }
            guard let points = payload["points"] as? [[Double]], !points.isEmpty else { break }
            consumed += points.count
            for point in points where point.count >= 5 {
                let accuracy = point[3], latitude = point[1], longitude = point[2], segment = point[4]
                guard accuracy >= 0, accuracy <= Self.maxAccuracy else { continue }
                let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
                guard CLLocationCoordinate2DIsValid(coordinate), latitude != 0 || longitude != 0 else { continue }
                if segment != lastSegment || collected.isEmpty {
                    collected.append([])
                    lastSegment = segment
                }
                collected[collected.count - 1].append(coordinate)
                added = true
            }
            if consumed >= total { break }
        }
        if added {
            segments = collected.filter { $0.count >= 2 }
        }
    }
}

/// Einklappbare Live-Karte. Eingeklappt bleibt nur die Kopfzeile, damit die großen Werte sichtbar bleiben.
struct ActivityLiveMap: View {
    let runKey: String
    let text: ActivityText
    @State private var route: LiveRouteModel
    @State private var position: MapCameraPosition = .userLocation(followsHeading: false, fallback: .automatic)
    @AppStorage("puls.activity.liveMapCollapsed") private var collapsed = false
    @ScaledMetric(relativeTo: .body) private var mapHeight: CGFloat = 220
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Explizit und auf dem Main Actor: das Modell ist main-actor-gebunden; SwiftUI behält nur die erste Instanz.
    @MainActor
    init(runKey: String, text: ActivityText) {
        self.runKey = runKey
        self.text = text
        _route = State(initialValue: LiveRouteModel())
    }

    var body: some View {
        VStack(spacing: 0) {
            Button {
                if reduceMotion {
                    collapsed.toggle()
                } else {
                    withAnimation(.easeInOut(duration: 0.25)) { collapsed.toggle() }
                }
            } label: {
                HStack(spacing: 8) {
                    Label(text("Karte", "Map"), systemImage: "map")
                        .font(.subheadline.weight(.semibold))
                    Spacer(minLength: 8)
                    Text(collapsed ? text("Einblenden", "Show") : text("Ausblenden", "Hide"))
                        .font(.subheadline)
                        .foregroundStyle(.tint)
                    Image(systemName: "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.tint)
                        .rotationEffect(.degrees(collapsed ? 0 : 180))
                        .accessibilityHidden(true)
                }
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(text("Karte", "Map"))
            .accessibilityValue(collapsed ? text("ausgeblendet", "hidden") : text("eingeblendet", "shown"))
            .accessibilityHint(collapsed ? text("Blendet die Karte ein", "Shows the map") : text("Blendet die Karte aus", "Hides the map"))

            if !collapsed {
                Map(position: $position) {
                    UserAnnotation()
                    ForEach(Array(route.segments.enumerated()), id: \.offset) { _, segment in
                        MapPolyline(coordinates: segment)
                            .stroke(Color.blue, lineWidth: 5)
                    }
                }
                .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
                .mapControls {
                    // Nach eigenem Verschieben führt dieser Knopf wieder automatisch mit.
                    MapUserLocationButton()
                    MapCompass()
                }
                .frame(height: mapHeight)
                .accessibilityLabel(text("Karte mit deiner Position und der bisherigen Strecke",
                                         "Map with your position and the route so far"))
                .transition(.opacity)
                .task(id: runKey) {
                    await route.follow(runKey: runKey)
                }
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
