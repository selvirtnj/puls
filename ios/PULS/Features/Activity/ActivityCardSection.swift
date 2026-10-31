import SwiftUI
import MapKit
import PULSCore

// Aktivitäten im nativen Trainings-Tab, wie die Web-Karte „Aktivitäten“ unter den Routinen (`runCard`):
// laufende Aktivität bzw. „Aktivität starten“, Routen, letzte Aktivitäten (Detail/Bearbeiten/Löschen).
// Der Routenplaner selbst bleibt in dieser Version Web (`routePlanner` mit `web:true`, §11.6).

struct ActivityCardSection: View {
    let coordinator: ActivityCoordinator

    var body: some View {
        let text = coordinator.text
        let projection = coordinator.projection
        Section {
            if let active = coordinator.active {
                ActiveActivityRow(active: active, typeInfo: projection?.type(active.type), text: text) { coordinator.openStart() }
            } else {
                Button {
                    coordinator.openStart()
                } label: {
                    Label(text("Aktivität starten", "Start activity"), systemImage: "play.fill")
                        .font(.headline)
                        .frame(minHeight: 44)
                }
                .accessibilityHint(text("Laufen, Gehen, MMA und mehr", "Run, walk, MMA and more"))
            }
            if let recent = projection?.recent.prefix(5), !recent.isEmpty {
                ForEach(Array(recent)) { item in
                    Button {
                        coordinator.detail = ActivityDetailRequest(id: item.id, title: item.name)
                    } label: {
                        RecentActivityRow(item: item, typeInfo: projection?.type(item.type), today: projection?.today, text: text)
                    }
                    .buttonStyle(.plain)
                }
            }
            Button {
                coordinator.showsRoutes = true
            } label: {
                Label(text("Routen", "Routes"), systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                    .frame(minHeight: 44)
            }
            ForEach(coordinator.conflicts, id: \.command.id) { entry in
                ActivityConflictRow(coordinator: coordinator, entry: entry, text: text)
            }
        } header: {
            Text(text("Aktivitäten", "Activities"))
        } footer: {
            if let projection, projection.omitted.recent > 0 || projection.recent.count > 5 {
                Text(text("Ältere Aktivitäten stehen im Kalender.", "Older activities are in the calendar."))
            }
        }
    }
}

private struct ActiveActivityRow: View {
    let active: ActiveActivity
    let typeInfo: ActivityTypeInfo?
    let text: ActivityText
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let elapsed = active.elapsed(at: context.date)
                HStack(spacing: 12) {
                    Image(systemName: ActivitySymbols.symbol(typeInfo?.icon ?? active.type))
                        .font(.title3)
                        .foregroundStyle(.tint)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(typeInfo?.label ?? active.type).font(.headline).foregroundStyle(.primary)
                        Text(active.paused ? text("Pausiert", "Paused") : text("Läuft", "Running"))
                            .font(.footnote)
                            .foregroundStyle(active.paused ? Color.orange : Color.green)
                    }
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(text.clock(Double(elapsed))).font(.headline.monospacedDigit()).foregroundStyle(.primary)
                        if let km = active.distanceKm { Text(text.km(km) + " km").font(.footnote.monospacedDigit()).foregroundStyle(.secondary) }
                    }
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary).accessibilityHidden(true)
                }
                .contentShape(Rectangle())
                .accessibilityElement(children: .ignore)
                .accessibilityLabel([typeInfo?.label ?? active.type,
                                     active.paused ? text("Pausiert", "Paused") : text("Läuft", "Running"),
                                     text.spokenDuration(Double(elapsed))].joined(separator: ", "))
            }
        }
        .accessibilityHint(text("Öffnet die laufende Aktivität", "Opens the activity in progress"))
    }
}

private struct RecentActivityRow: View {
    let item: RecentActivity
    let typeInfo: ActivityTypeInfo?
    let today: String?
    let text: ActivityText

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: ActivitySymbols.symbol(typeInfo?.icon ?? item.type))
                .frame(width: 28)
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name.isEmpty ? (typeInfo?.label ?? item.type) : item.name).font(.body)
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary).accessibilityHidden(true)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts: [String] = []
        if let date = item.date { parts.append(text.day(date, today: today)) }
        if let km = item.distanceKm, km > 0 { parts.append(text.km(km) + " km") }
        if let seconds = item.durationSeconds { parts.append(text.clock(seconds)) }
        if let kcal = item.kcal { parts.append(text.number(kcal, digits: 0) + " kcal") }
        return parts.joined(separator: " · ")
    }
}

private struct ActivityConflictRow: View {
    let coordinator: ActivityCoordinator
    let entry: OutboxEntry
    let text: ActivityText

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(description)
                .font(.subheadline)
            Text(text("Inzwischen an anderer Stelle geändert. Die Anzeige zeigt den aktuellen Stand.",
                      "Changed elsewhere in the meantime. The view shows the current state."))
                .font(.footnote)
                .foregroundStyle(.secondary)
            HStack(spacing: 16) {
                Button(text("Verwerfen", "Discard"), role: .destructive) { coordinator.discardConflict(id: entry.command.id) }
                if ProfileStore.canReapplyActivity(op: entry.command.op) {
                    Button(text("Trotzdem übernehmen", "Apply anyway")) { coordinator.reapplyConflict(id: entry.command.id) }
                }
            }
            .buttonStyle(.borderless)
            .frame(minHeight: 44)
        }
        .padding(.vertical, 4)
    }

    private var description: String {
        switch entry.command.op {
        case ActivityOps.runEdit: return text("Aktivität bearbeiten: nicht übernommen", "Edit activity: not applied")
        case ActivityOps.runDelete: return text("Aktivität löschen: nicht übernommen", "Delete activity: not applied")
        case ActivityOps.routeDelete: return text("Route löschen: nicht übernommen", "Delete route: not applied")
        case ActivityOps.routeSave: return text("Route speichern: nicht übernommen", "Save route: not applied")
        default: return text("Änderung nicht übernommen", "Change not applied")
        }
    }
}

// MARK: - Sheets im Trainings-Tab

/// Routenliste und Aktivitätsdetail als Sheets am Trainings-Tab (nicht an einer Listenzeile).
struct ActivitySheets: ViewModifier {
    let coordinator: ActivityCoordinator?

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: routesBinding) {
                if let coordinator {
                    NavigationStack {
                        ActivityRoutesList(coordinator: coordinator, text: coordinator.text, picking: false) { id in if let id { coordinator.useRoute(id) } }
                            .toolbar {
                                ToolbarItem(placement: .confirmationAction) {
                                    Button(coordinator.text("Fertig", "Done")) { coordinator.showsRoutes = false }
                                }
                            }
                    }
                    .environment(\.locale, coordinator.text.locale)
                }
            }
            .sheet(item: detailBinding) { request in
                if let coordinator {
                    NavigationStack {
                        ActivityDetailView(coordinator: coordinator, runId: request.id, title: request.title)
                    }
                    .environment(\.locale, coordinator.text.locale)
                }
            }
    }

    private var routesBinding: Binding<Bool> {
        Binding(get: { coordinator?.showsRoutes ?? false }, set: { coordinator?.showsRoutes = $0 })
    }

    private var detailBinding: Binding<ActivityDetailRequest?> {
        Binding(get: { coordinator?.detail }, set: { coordinator?.detail = $0 })
    }
}

// MARK: - Gespeicherte Aktivität

struct ActivityDetailView: View {
    let coordinator: ActivityCoordinator
    let runId: String
    let title: String
    @State private var phase: LoadPhase<StoredActivityDetail> = .loading
    @State private var confirmsDelete = false
    @State private var editing: StoredActivityDetail?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let text = coordinator.text
        Group {
            switch phase {
            case .loading:
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            case .gone:
                ContentUnavailableView(text("Aktivität nicht gefunden", "Activity not found"), systemImage: "questionmark.circle",
                                       description: Text(text("Sie wurde inzwischen gelöscht.", "It was deleted in the meantime.")))
            case .failed:
                ContentUnavailableView {
                    Label(text("Nicht geladen", "Not loaded"), systemImage: "exclamationmark.triangle")
                } actions: {
                    Button(text("Erneut versuchen", "Try again")) { Task { await load() } }
                    Button(text("In PULS öffnen", "Open in PULS")) { coordinator.openWeb(ActivityNavigation(action: "runDetail", id: runId)) }
                }
            case .loaded(let detail):
                content(detail, text: text)
            }
        }
        .navigationTitle(title.isEmpty ? text("Aktivität", "Activity") : title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(text("Schließen", "Close")) { dismiss() }
            }
            if case .loaded(let detail) = phase, coordinator.canWrite {
                ToolbarItem(placement: .primaryAction) {
                    Button(text("Bearbeiten", "Edit")) { editing = detail }
                }
            }
        }
        .task(id: coordinator.dataRevision) { await load() }
        .sheet(item: $editing) { detail in
            NavigationStack {
                ActivityEditView(coordinator: coordinator, detail: detail)
            }
            .environment(\.locale, text.locale)
        }
        .confirmationDialog(text("Aktivität löschen?", "Delete activity?"), isPresented: $confirmsDelete, titleVisibility: .visible) {
            Button(text("Löschen", "Delete"), role: .destructive) { delete() }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        } message: {
            Text(text("Die Aktivität wird endgültig entfernt.", "The activity will be removed permanently."))
        }
    }

    private func load() async {
        let result = await coordinator.fetch { ActivityQueryRequest.detail(.run, id: runId, requestId: $0) }
        switch result {
        case .loaded(let message):
            if case .run(let detail)? = message.result { phase = .loaded(detail) } else { phase = .failed }
        case .gone: phase = .gone
        case .failed: if phase.value == nil { phase = .failed }
        case .loading: break
        }
    }

    private func delete() {
        guard case .loaded(let detail) = phase else { return }
        if coordinator.delete(id: detail.entry.id, expect: detail.editExpect) { dismiss() }
    }

    private func content(_ detail: StoredActivityDetail, text: ActivityText) -> some View {
        let entry = detail.entry
        return List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text(whenLine(detail, text: text)).font(.subheadline).foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        if let km = entry.distanceKm, km > 0 { value(text.km(km), "km") }
                        value(entry.durationSeconds.map { text.clock($0) } ?? "–", text("Dauer", "Duration"))
                        value(entry.kcal.map { text.number($0, digits: 0) } ?? "–", "kcal*")
                    }
                    if !detail.note.isEmpty { Text(detail.note).font(.body) }
                }
                .padding(.vertical, 4)
                if let route = detail.route {
                    ActivityRouteMap(segments: RouteLine.segments(route), text: text)
                        .frame(height: 220)
                        .listRowInsets(EdgeInsets())
                }
            }
            ActivityDetailRows(km: entry.distanceKm, maxSpeed: detail.maxSpeed, gain: detail.elevationGain,
                               maxElevation: detail.elevationMax, pause: detail.pauseSeconds, kcal: entry.kcal,
                               paceText: (entry.distanceKm ?? 0) > 0 ? entry.paceText : nil, text: text)
            ActivitySplitsSection(splits: detail.splits, splitRest: detail.splitRest, text: text)
            if entry.type != "mma", let duration = entry.durationSeconds {
                ActivityLapsSection(laps: detail.laps, duration: duration, text: text)
            }
            Section {
                if coordinator.canWrite {
                    Button(text("Aktivität löschen", "Delete activity"), role: .destructive) { confirmsDelete = true }
                        .disabled(coordinator.isBusy("delete:" + entry.id))
                }
                Button {
                    coordinator.openWeb(detail.navigation ?? ActivityNavigation(action: "runDetail", id: entry.id))
                } label: {
                    Label(detail.route != nil ? text("Als Route sichern oder teilen in PULS", "Save as route or share in PULS")
                                              : text("In PULS öffnen", "Open in PULS"),
                          systemImage: "arrow.up.forward.app")
                }
            } footer: {
                Text("* " + text("Kalorien sind eine Schätzung.", "Calories are an estimate."))
            }
        }
        .listStyle(.insetGrouped)
    }

    private func whenLine(_ detail: StoredActivityDetail, text: ActivityText) -> String {
        var parts: [String] = []
        if let startedAt = detail.entry.startedAt {
            parts.append(text.startDate(startedAt))
        } else if let date = detail.entry.date {
            parts.append(text.day(date, today: coordinator.projection?.today))
        }
        if let feeling = text.feeling(detail.feeling) { parts.append(feeling) }
        if let terrain = detail.terrain { parts.append(text.terrain(terrain)) }
        return parts.joined(separator: " · ")
    }

    private func value(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.weight(.bold).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.5)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

extension StoredActivityDetail: Identifiable {
    public var id: String { entry.id }
}

/// Bearbeiten wie `runEditForm`: Art, Gefühl, Untergrund, Notiz. `expect` = beim Öffnen gesehenes `editExpect`.
private struct ActivityEditView: View {
    let coordinator: ActivityCoordinator
    let detail: StoredActivityDetail
    @State private var type: String
    @State private var feeling: Int?
    @State private var terrain: String?
    @State private var note: String
    @Environment(\.dismiss) private var dismiss

    init(coordinator: ActivityCoordinator, detail: StoredActivityDetail) {
        self.coordinator = coordinator
        self.detail = detail
        // Einmaliger Startwert des Formulars aus der geladenen Aktivität.
        let edit = detail.editExpect
        _type = State(initialValue: edit?.type ?? detail.entry.type)
        _feeling = State(initialValue: edit?.feeling ?? detail.feeling)
        _terrain = State(initialValue: edit?.terrain ?? detail.terrain)
        _note = State(initialValue: edit?.note ?? detail.note)
    }

    var body: some View {
        let text = coordinator.text
        Form {
            Picker(text("Aktivität", "Activity"), selection: $type) {
                ForEach(typeOptions, id: \.id) { option in Text(option.label).tag(option.id) }
            }
            Picker(text("Gefühl", "Feeling"), selection: $feeling) {
                Text("–").tag(Int?.none)
                ForEach(text.feelings) { feeling in Text(feeling.label).tag(Int?.some(feeling.value)) }
            }
            Picker(text("Untergrund", "Terrain"), selection: $terrain) {
                Text("–").tag(String?.none)
                ForEach(ActivityOps.terrains, id: \.self) { key in Text(text.terrain(key)).tag(String?.some(key)) }
            }
            Section(text("Notiz", "Note")) {
                TextField(text("Notiz", "Note"), text: $note, axis: .vertical)
                    .lineLimit(1...4)
                    .onChange(of: note) { _, value in
                        if value.utf16.count > ActivityOps.noteLimit {
                            var limited = value
                            while limited.utf16.count > ActivityOps.noteLimit { limited.removeLast() }
                            note = limited
                        }
                    }
            }
        }
        .navigationTitle(text("Bearbeiten", "Edit"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(text("Abbrechen", "Cancel")) { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button(text("Speichern", "Save")) {
                    if coordinator.edit(id: detail.entry.id, type: type, feeling: feeling, terrain: terrain, note: note,
                                        expect: detail.editExpect) {
                        dismiss()
                    }
                }
            }
        }
    }

    /// Wählbare Arten plus bisherige (wie `runEditForm`).
    private var typeOptions: [ActivityTypeInfo] {
        var options = coordinator.projection?.types ?? []
        if !options.contains(where: { $0.id == type }) {
            options.append(ActivityTypeInfo(id: type, label: detail.entry.name.isEmpty ? type : detail.entry.name, icon: type, gps: false, category: "other"))
        }
        return options
    }
}

// MARK: - Routen

/// Gespeicherte Routen. `picking`: Auswahl für die Startansicht (inklusive „Keine Route“).
struct ActivityRoutesList: View {
    let coordinator: ActivityCoordinator
    let text: ActivityText
    let picking: Bool
    let onPick: (String?) -> Void
    @State private var deleting: ActivityRouteRow?

    var body: some View {
        let routes = coordinator.projection?.routes ?? []
        List {
            Section {
                Button {
                    coordinator.openWeb(ActivityNavigation(action: "routePlanner"))
                } label: {
                    Label(text("Neue Route planen", "Plan a new route"), systemImage: "plus")
                        .frame(minHeight: 44)
                }
                .disabled(!coordinator.canWrite)
            } footer: {
                Text(text("Der Planer öffnet sich in PULS. Die Route folgt Fuß- und Feldwegen (BRouter, OpenStreetMap).",
                          "The planner opens in PULS. The route follows footpaths and tracks (BRouter, OpenStreetMap)."))
            }
            Section {
                if picking {
                    Button(text("Keine Route", "No route")) { onPick(nil) }
                        .frame(minHeight: 44)
                }
                if routes.isEmpty {
                    Text(text("Noch keine Route gespeichert.", "No route saved yet."))
                        .foregroundStyle(.secondary)
                }
                ForEach(routes) { route in
                    if picking {
                        Button {
                            onPick(route.id)
                        } label: {
                            RouteRow(route: route, text: text, selected: coordinator.selectedRouteId == route.id)
                        }
                        .buttonStyle(.plain)
                    } else {
                        NavigationLink {
                            RouteDetailView(coordinator: coordinator, route: route, onUse: onPick)
                        } label: {
                            RouteRow(route: route, text: text, selected: false)
                        }
                        .swipeActions {
                            if coordinator.canWrite {
                                Button(text("Löschen", "Delete"), role: .destructive) { deleting = route }
                            }
                        }
                    }
                }
            } footer: {
                if let omitted = coordinator.projection?.omitted.routes, omitted > 0 {
                    Text(text("\(omitted) weitere Routen in PULS.", "\(omitted) more routes in PULS."))
                }
            }
        }
        .navigationTitle(text("Routen", "Routes"))
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(text("Diese Route löschen?", "Delete this route?"),
                            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
                            titleVisibility: .visible, presenting: deleting) { route in
            Button(text("Löschen", "Delete"), role: .destructive) { coordinator.deleteRoute(id: route.id) }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        }
    }
}

private struct RouteRow: View {
    let route: ActivityRouteRow
    let text: ActivityText
    let selected: Bool

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(route.name.isEmpty ? text("Route", "Route") : route.name).font(.body)
                Text(meta(route, text: text)).font(.footnote).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            if selected { Image(systemName: "checkmark").foregroundStyle(.tint).accessibilityHidden(true) }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Wie `runRouteMeta`: `x km · Anstieg y m`.
private func meta(_ route: ActivityRouteRow, text: ActivityText) -> String {
    var line = route.distanceKm.map { text.km($0) + " km" } ?? "–"
    if let ascent = route.ascentM { line += " · " + text("Anstieg", "Ascent") + " " + text.number(JSMath.round(ascent), digits: 0) + " m" }
    return line
}

private struct RouteDetailView: View {
    let coordinator: ActivityCoordinator
    let route: ActivityRouteRow
    let onUse: (String?) -> Void
    @State private var phase: LoadPhase<RouteDetail> = .loading
    @State private var confirmsDelete = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let text = coordinator.text
        List {
            Section {
                switch phase {
                case .loaded(let detail):
                    ActivityRouteMap(segments: [detail.points], text: text)
                        .frame(height: 260)
                        .listRowInsets(EdgeInsets())
                case .loading:
                    ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                case .gone:
                    Text(text("Diese Route gibt es nicht mehr.", "This route no longer exists.")).foregroundStyle(.secondary)
                case .failed:
                    Button(text("Karte erneut laden", "Reload map")) { Task { await load() } }
                }
                Text(meta(route, text: text)).font(.subheadline).foregroundStyle(.secondary)
            }
            Section {
                Button {
                    onUse(route.id)
                } label: {
                    Label(text("Diese Route nehmen", "Use this route"), systemImage: "play")
                        .frame(minHeight: 44)
                }
                .disabled(coordinator.active != nil || !coordinator.canWrite)
                if route.editable {
                    Button {
                        coordinator.openWeb(ActivityNavigation(action: "routePlanner", id: route.id))
                    } label: {
                        Label(text("Im Planer bearbeiten (PULS)", "Edit in planner (PULS)"), systemImage: "arrow.up.forward.app")
                            .frame(minHeight: 44)
                    }
                    .disabled(!coordinator.canWrite)
                }
                if coordinator.canWrite {
                    Button(text("Löschen", "Delete"), role: .destructive) { confirmsDelete = true }
                        .frame(minHeight: 44)
                }
            } footer: {
                if coordinator.active != nil {
                    Text(text("Während einer laufenden Aktivität kann keine Route gewählt werden.",
                              "A route cannot be chosen during an activity in progress."))
                }
            }
        }
        .navigationTitle(route.name)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: coordinator.dataRevision) { await load() }
        .confirmationDialog(text("Diese Route löschen?", "Delete this route?"), isPresented: $confirmsDelete, titleVisibility: .visible) {
            Button(text("Löschen", "Delete"), role: .destructive) {
                coordinator.deleteRoute(id: route.id)
                dismiss()
            }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        }
    }

    private func load() async {
        let result = await coordinator.fetch { ActivityQueryRequest.detail(.route, id: route.id, requestId: $0) }
        switch result {
        case .loaded(let message):
            if case .route(let detail)? = message.result { phase = .loaded(detail) } else { phase = .failed }
        case .gone: phase = .gone
        case .failed: if phase.value == nil { phase = .failed }
        case .loading: break
        }
    }
}
