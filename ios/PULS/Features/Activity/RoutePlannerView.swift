import SwiftUI
import MapKit
import CoreLocation
import Observation
import PULSCore

// §11.6: nativer Routenplaner. Bedienung und Grenzen wie `runPlanner` (js/run-map.js), Wegeführung über denselben kostenlosen
// BRouter-Dienst mit denselben Parametern, gespeichert über `route.save`. Ohne Netz bleiben gerade Linien.

/// Hinweiszeile wie `runplan-hint`.
enum RoutePlannerHint: Equatable {
    case tapMap, calculating, following, unreachable, straight, tooManyPoints
}

@Observable
@MainActor
final class RoutePlannerModel {
    private(set) var plan: RoutePlan
    private(set) var snap = true
    private(set) var isRouting = false
    private(set) var hint: RoutePlannerHint = .tapMap

    @ObservationIgnored private let baseURL: String
    @ObservationIgnored private let profile: String
    @ObservationIgnored private let maxWaypoints: Int
    @ObservationIgnored private var routing: Task<Void, Never>?

    init(plan: RoutePlan, info: RoutePlannerInfo?) {
        self.plan = plan
        baseURL = info?.url ?? ""
        profile = info?.profile ?? ""
        maxWaypoints = info?.maxWaypoints ?? 60
    }

    func add(_ point: GeoPoint) {
        guard plan.waypoints.count < maxWaypoints else {
            hint = .tooManyPoints
            return
        }
        plan.waypoints.append(point)
        recalculate()
    }

    func undo() {
        guard !plan.waypoints.isEmpty else { return }
        plan.waypoints.removeLast()
        recalculate()
    }

    func closeLoop() {
        guard plan.waypoints.count < maxWaypoints else {
            hint = .tooManyPoints
            return
        }
        plan.closeLoop()
        recalculate()
    }

    func clear() {
        plan.waypoints = []
        recalculate()
    }

    func toggleSnap() {
        snap.toggle()
        recalculate()
    }

    func cancel() {
        routing?.cancel()
        routing = nil
        isRouting = false
    }

    private func recalculate() {
        cancel()
        plan.straighten()
        guard plan.waypoints.count >= 2 else {
            hint = .tapMap
            return
        }
        guard snap else {
            hint = .straight
            return
        }
        guard let url = BRouter.url(base: baseURL, profile: profile, waypoints: plan.waypoints) else {
            hint = .unreachable
            return
        }
        isRouting = true
        hint = .calculating
        routing = Task { @MainActor [weak self] in
            let routed = await Self.fetch(url)
            guard let self, !Task.isCancelled else { return }
            self.isRouting = false
            if let routed {
                self.plan.apply(routed)
                self.hint = .following
            } else {
                self.hint = .unreachable
            }
        }
    }

    private nonisolated static func fetch(_ url: URL) async -> BRouterResult? {
        do {
            let (data, response) = try await URLSession.shared.data(for: URLRequest(url: url, timeoutInterval: 20))
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
            return BRouter.parse(data)
        } catch {
            return nil
        }
    }
}

struct RoutePlannerView: View {
    let coordinator: ActivityCoordinator
    /// Bestehende Route (behält ihre ID); `nil` = neu.
    let existing: RouteDetail?
    @Environment(\.dismiss) private var dismiss
    @State private var model: RoutePlannerModel
    @State private var routeId: String
    @State private var name: String
    @State private var position: MapCameraPosition
    @State private var confirmsClear = false
    @State private var location = CLLocationManager()

    @MainActor
    init(coordinator: ActivityCoordinator, existing: RouteDetail?) {
        self.coordinator = coordinator
        self.existing = existing
        let plan = existing.map { RoutePlan(detail: $0) } ?? RoutePlan()
        _model = State(initialValue: RoutePlannerModel(plan: plan, info: coordinator.projection?.planner))
        _routeId = State(initialValue: existing?.id ?? UUID().uuidString.lowercased())
        _name = State(initialValue: existing?.name ?? "")
        let fallback = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: 51.2, longitude: 10.4),
                                          span: MKCoordinateSpan(latitudeDelta: 8, longitudeDelta: 8))
        let start: MapCameraPosition = existing == nil ? .userLocation(fallback: .region(fallback)) : .automatic
        _position = State(initialValue: start)
    }

    private var text: ActivityText { coordinator.text }

    private var command: Command? {
        let fallback = text("Meine Route", "My route")
        return model.plan.saveCommand(id: routeId, name: RoutePlan.name(name, fallback: fallback),
                                      maxLinePoints: coordinator.projection?.planner?.maxLinePoints ?? 800)
    }

    var body: some View {
        let text = self.text
        VStack(spacing: 0) {
            map(text)
            panel(text)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(existing == nil ? text("Route planen", "Plan route") : text("Route bearbeiten", "Edit route"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(text("Speichern", "Save")) {
                    if let command, coordinator.savePlannedRoute(command, id: routeId) { dismiss() }
                }
                .disabled(model.isRouting || command == nil || !coordinator.canWrite)
            }
        }
        .confirmationDialog(text("Alle Punkte entfernen?", "Remove all points?"), isPresented: $confirmsClear, titleVisibility: .visible) {
            Button(text("Entfernen", "Remove"), role: .destructive) { model.clear() }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        }
        .onAppear {
            if location.authorizationStatus == .notDetermined { location.requestWhenInUseAuthorization() }
        }
        .onDisappear { model.cancel() }
    }

    private func coordinate(_ point: GeoPoint) -> CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: point.lat, longitude: point.lon)
    }

    private func map(_ text: ActivityText) -> some View {
        MapReader { proxy in
            Map(position: $position) {
                UserAnnotation()
                if model.plan.line.count >= 2 {
                    MapPolyline(coordinates: model.plan.line.map { coordinate($0) })
                        .stroke(Color.blue, lineWidth: 5)
                }
                ForEach(Array(model.plan.waypoints.enumerated()), id: \.offset) { index, point in
                    Annotation(String(index + 1), coordinate: coordinate(point), anchor: .center) {
                        Circle()
                            .fill(index == 0 ? Color.green : Color.blue)
                            .frame(width: index == 0 ? 16 : 12, height: index == 0 ? 16 : 12)
                            .overlay(Circle().strokeBorder(Color.white, lineWidth: 2))
                    }
                    .annotationTitles(.hidden)
                }
            }
            .mapStyle(.standard(elevation: .flat))
            .mapControls {
                MapUserLocationButton()
                MapCompass()
                MapScaleView()
            }
            .onTapGesture { location in
                if let tapped = proxy.convert(location, from: .local) {
                    model.add(GeoPoint(lat: tapped.latitude, lon: tapped.longitude))
                }
            }
            .accessibilityLabel(text("Karte. Tippe, um Punkte zu setzen.", "Map. Tap to add points."))
        }
    }

    private func panel(_ text: ActivityText) -> some View {
        let plan = model.plan
        let pace = coordinator.projection?.planner?.typicalPaceSeconds
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                stat(text.km(plan.roundedKm) + " km", text("Distanz", "Distance"))
                stat(plan.ascentM.map { text.number(JSMath.round($0), digits: 0) + " m" } ?? "–", text("Anstieg", "Climb"))
                stat(plan.estimatedSeconds(pace: pace).map { text.clock($0) } ?? "–", text("bei deiner Pace", "at your pace"))
            }
            HStack(spacing: 6) {
                if model.isRouting { ProgressView().controlSize(.small) }
                Text(hint(text)).font(.footnote).foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { tools(text) }
                VStack(alignment: .leading, spacing: 4) { tools(text) }
            }
            TextField(text("Name der Route", "Route name"), text: $name)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel(text("Name der Route", "Route name"))
        }
        .padding(16)
    }

    @ViewBuilder
    private func tools(_ text: ActivityText) -> some View {
        Button {
            model.toggleSnap()
        } label: {
            Label(text("Wegen folgen", "Follow paths"), systemImage: model.snap ? "checkmark.circle.fill" : "circle")
        }
        .accessibilityAddTraits(model.snap ? .isSelected : [])
        Button(text("Zurück", "Undo"), systemImage: "arrow.uturn.backward") { model.undo() }
            .disabled(model.plan.waypoints.isEmpty)
        Button(text("Rundkurs", "Loop"), systemImage: "arrow.triangle.2.circlepath") { model.closeLoop() }
            .disabled(model.plan.waypoints.count < 2)
        Button(text("Löschen", "Clear"), systemImage: "trash", role: .destructive) { confirmsClear = true }
            .disabled(model.plan.waypoints.isEmpty)
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.headline.monospacedDigit()).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func hint(_ text: ActivityText) -> String {
        switch model.hint {
        case .tapMap: return text("Tippe auf die Karte, um Punkte zu setzen.", "Tap the map to add points.")
        case .calculating: return text("Route wird berechnet …", "Calculating route …")
        case .following: return text("Route folgt Wegen (BRouter, OpenStreetMap).", "Route follows paths (BRouter, OpenStreetMap).")
        case .unreachable: return text("Wegeführung nicht erreichbar, gerade Linien.", "Routing unavailable, straight lines.")
        case .straight: return text("Gerade Linien zwischen den Punkten.", "Straight lines between the points.")
        case .tooManyPoints: return text("Höchstens 60 Punkte.", "At most 60 points.")
        }
    }
}
