import SwiftUI
import MapKit
import PULSCore

// Abschluss nach `run.finish`: Werte aus dem Web-Entwurf (Projektion `summary`, Details per Query), Eingaben Gefühl,
// Untergrund, Notiz und Ersatzdistanz; Speichern (`run.summary.save`), Weiter (`run.resume`) oder Verwerfen.

struct ActivitySummaryView: View {
    let coordinator: ActivityCoordinator
    let active: ActiveActivity
    let summary: ActivitySummaryDraft
    let text: ActivityText
    @State private var confirmsDiscard = false
    @FocusState private var focused: Bool

    private var details: ActivitySummaryDraft? {
        guard let details = coordinator.summaryDetails, details.key == summary.key else { return nil }
        return details
    }

    private var typeInfo: ActivityTypeInfo? { coordinator.projection?.type(summary.type) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ActivityNoticeBanner(coordinator: coordinator, text: text)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                Section {
                    headline
                    if let route = details?.route {
                        ActivityRouteMap(segments: RouteLine.segments(route), text: text)
                            .frame(height: 200)
                            .listRowInsets(EdgeInsets())
                    }
                    if summary.manualDistanceAllowed { manualDistance }
                }
                feelingSection
                if coordinator.terrainAllowed { terrainSection }
                Section(text("Notiz (optional)", "Note (optional)")) {
                    TextField(text("z. B. Intervalle, Wetter, Schuhe", "e.g. intervals, weather, shoes"), text: noteBinding, axis: .vertical)
                        .lineLimit(2...5)
                        .focused($focused)
                }
                ActivityDetailRows(km: summary.km, maxSpeed: summary.maxSpeed, gain: summary.elevation?.gain,
                                   maxElevation: summary.elevation?.max, pause: summary.pause, kcal: summary.kcal, text: text)
                if let details {
                    ActivitySplitsSection(splits: details.splits, splitRest: details.splitRest, text: text)
                    if summary.type != "mma", let moving = summary.moving {
                        ActivityLapsSection(laps: details.laps, duration: moving, text: text)
                    }
                }
                Section {
                    EmptyView()
                } footer: {
                    Text(text("* Kalorien sind eine Schätzung aus Aktivität, Zeit, Tempo und deinem letzten Gewicht.",
                              "* Calories are an estimate from activity, time, pace and your latest body weight."))
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(text("Speichern", "Save"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Weiter", "Resume")) { coordinator.resumeRun() }
                        .disabled(coordinator.isBusy("resume") || coordinator.isBusy("save"))
                        .accessibilityHint(text("Setzt die Aktivität fort", "Resumes the activity"))
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(text("Fertig", "Done")) { focused = false }
                }
            }
            .safeAreaInset(edge: .bottom) { saveBar }
            .confirmationDialog(text("Aktivität verwerfen?", "Discard activity?"), isPresented: $confirmsDiscard, titleVisibility: .visible) {
                Button(text("Verwerfen", "Discard"), role: .destructive) { coordinator.discard() }
                Button(text("Abbrechen", "Cancel"), role: .cancel) {}
            } message: {
                Text(text("Die Aufzeichnung wird nicht gespeichert.", "The recording will not be saved."))
            }
        }
    }

    // MARK: Abschnitte

    private var headline: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(typeInfo?.label ?? summary.type, systemImage: ActivitySymbols.symbol(typeInfo?.icon ?? summary.type))
                .font(.headline)
            Text(text.startDate(active.startedAt))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                if typeInfo?.gps ?? active.gps {
                    bigValue(summary.km.map { text.km($0) } ?? "–", "km")
                }
                bigValue(summary.moving.map { text.clock($0) } ?? "–", text("Dauer", "Duration"))
                bigValue(summary.kcal.map { text.number($0, digits: 0) } ?? "–", "kcal*")
            }
        }
        .padding(.vertical, 4)
    }

    private func bigValue(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title2.weight(.bold).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.5)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private var manualDistance: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(text("GPS hat keine Strecke erfasst. Distanz in km (optional)", "GPS recorded no distance. Distance in km (optional)"))
                .font(.subheadline)
            TextField("0,00", text: manualBinding)
                .keyboardType(.decimalPad)
                .focused($focused)
                .font(.title3.monospacedDigit())
                .frame(minHeight: 44)
            if ManualKmInput.parse(coordinator.summaryForm?.manualKmText ?? "") == nil {
                Text(text("Bitte 0 bis 1000 km eingeben.", "Please enter 0 to 1000 km."))
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    private var feelingSection: some View {
        Section(text("Wie hat es sich angefühlt?", "How did it feel?")) {
            HStack(spacing: 6) {
                ForEach(text.feelings) { feeling in
                    let selected = coordinator.summaryForm?.feeling == feeling.value
                    Button {
                        update { $0.feeling = $0.feeling == feeling.value ? nil : feeling.value }
                    } label: {
                        VStack(spacing: 4) {
                            Image(systemName: feeling.symbol).font(.title3).accessibilityHidden(true)
                            Text(feeling.label).font(.caption2).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .foregroundStyle(selected ? Color.white : Color.primary)
                        .background(selected ? Color.accentColor : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(feeling.label)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var terrainSection: some View {
        Section(text("Untergrund", "Terrain")) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                ForEach(ActivityOps.terrains, id: \.self) { key in
                    let selected = coordinator.summaryForm?.terrain == key
                    Button {
                        update { $0.terrain = $0.terrain == key ? nil : key }
                    } label: {
                        Text(text.terrain(key))
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .foregroundStyle(selected ? Color.white : Color.primary)
                            .background(selected ? Color.accentColor : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var saveBar: some View {
        VStack(spacing: 8) {
            Button {
                focused = false
                coordinator.saveSummary()
            } label: {
                Group {
                    if coordinator.isBusy("save") || coordinator.isBusy("finish") {
                        ProgressView().tint(.white)
                    } else {
                        Text(text("Aktivität speichern", "Save activity")).font(.headline)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 56)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.roundedRectangle(radius: 12))
            .disabled(coordinator.isBusy("save") || coordinator.isBusy("finish") || !coordinator.canWrite)
            Button(text("Verwerfen", "Discard"), role: .destructive) { confirmsDiscard = true }
                .frame(minHeight: 44)
                .disabled(coordinator.isBusy("save") || coordinator.isBusy("discard"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(.systemGroupedBackground))
    }

    // MARK: Eingaben

    private func update(_ change: (inout ActivitySummaryForm) -> Void) {
        var form = coordinator.summaryForm ?? ActivitySummaryForm(key: summary.key, feeling: summary.feeling, terrain: summary.terrain,
                                                                  note: summary.note, manualKmText: "")
        change(&form)
        coordinator.summaryForm = form
    }

    private var noteBinding: Binding<String> {
        Binding(get: { coordinator.summaryForm?.note ?? summary.note }, set: { value in
            // Höchstens 200 Zeichen wie `maxlength=200`.
            var limited = value
            while limited.utf16.count > ActivityOps.noteLimit { limited.removeLast() }
            update { $0.note = limited }
        })
    }

    private var manualBinding: Binding<String> {
        Binding(get: { coordinator.summaryForm?.manualKmText ?? "" }, set: { value in update { $0.manualKmText = value } })
    }
}

// MARK: - Gemeinsame Detailbausteine (Abschluss und gespeicherte Aktivität)

/// Wie `runDetailRows`, aber ohne eigene Pace-/Geschwindigkeitsberechnung (nur gelieferte Werte).
struct ActivityDetailRows: View {
    let km: Double?
    let maxSpeed: Double?
    let gain: Double?
    let maxElevation: Double?
    let pause: Double?
    let kcal: Double?
    var paceText: String?
    let text: ActivityText

    init(km: Double?, maxSpeed: Double?, gain: Double?, maxElevation: Double?, pause: Double?, kcal: Double?,
         paceText: String? = nil, text: ActivityText) {
        self.km = km
        self.maxSpeed = maxSpeed
        self.gain = gain
        self.maxElevation = maxElevation
        self.pause = pause
        self.kcal = kcal
        self.paceText = paceText
        self.text = text
    }

    var body: some View {
        Section(text("Details", "Details")) {
            if let paceText { row(text("Ø Pace", "Avg pace"), paceText) }
            row(text("Max. Geschwindigkeit", "Max speed"), maxSpeed.map { text.number($0) + " km/h" } ?? "–")
            row(text("Höhenmeter", "Elevation gain"), gain.map { text.number(JSMath.round($0), digits: 0) + " m" } ?? "–")
            row(text("Max. Höhe", "Max elevation"), maxElevation.map { text.number(JSMath.round($0), digits: 0) + " m" } ?? "–")
            row(text("Pause", "Paused"), text.clock(pause ?? 0))
            row(text("Kalorien (geschätzt)", "Calories (estimate)"),
                kcal.map { text.number($0, digits: 0) + " kcal" } ?? text("– · Gewicht eintragen", "– · add body weight"))
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        LabeledContent(label) {
            Text(value).monospacedDigit()
        }
    }
}

/// Kilometerzeiten wie `runSplitsHtml` (Werte aus dem Web; nur als Uhr formatiert).
struct ActivitySplitsSection: View {
    let splits: [Double]
    let splitRest: [Double]?
    let text: ActivityText

    var body: some View {
        if !splits.isEmpty {
            let fastest = splits.min() ?? 0
            Section(text("Kilometerzeiten", "Splits")) {
                ForEach(Array(splits.enumerated()), id: \.offset) { index, seconds in
                    LabeledContent("\(index + 1)") {
                        Text(text.pace(seconds))
                            .monospacedDigit()
                            .fontWeight(seconds == fastest && splits.count > 1 ? .semibold : .regular)
                    }
                }
                if let rest = splitRest {
                    LabeledContent(text.km(rest[0] / 1000) + " km") {
                        Text(text.clock(rest[1])).monospacedDigit()
                    }
                }
            }
        }
    }
}

/// Runden wie `runLapsHtml`: Markierungen innerhalb der Dauer plus Ende, mindestens zwei Abschnitte.
struct ActivityLapsSection: View {
    let laps: [Double]
    let duration: Double
    let text: ActivityText

    var body: some View {
        let marks = laps.filter { $0 > 0 && $0 < duration } + [duration]
        let parts = marks.enumerated().map { index, mark in mark - (index > 0 ? marks[index - 1] : 0) }.filter { $0 > 0 }
        if parts.count >= 2 {
            Section(text("Runden", "Laps")) {
                ForEach(Array(parts.enumerated()), id: \.offset) { index, seconds in
                    LabeledContent("\(index + 1)") {
                        Text(text.clock(seconds)).monospacedDigit()
                    }
                }
            }
        }
    }
}

/// Aufgezeichnete Strecke bzw. geplante Route (Apple-Karte, nur Darstellung der Web-Koordinaten).
struct ActivityRouteMap: View {
    let segments: [[GeoPoint]]
    let text: ActivityText

    var body: some View {
        Map(initialPosition: .automatic) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                MapPolyline(coordinates: segment.map { CLLocationCoordinate2D(latitude: $0.lat, longitude: $0.lon) })
                    .stroke(Color.blue, lineWidth: 4)
            }
            if let first = segments.first?.first {
                Marker(text("Start", "Start"), coordinate: CLLocationCoordinate2D(latitude: first.lat, longitude: first.lon))
                    .tint(.green)
            }
            if let last = segments.last?.last, segments.count > 0 {
                Marker(text("Ziel", "Finish"), coordinate: CLLocationCoordinate2D(latitude: last.lat, longitude: last.lon))
                    .tint(.red)
            }
        }
        .mapStyle(.standard(elevation: .flat))
        .accessibilityLabel(text("Karte der Strecke", "Map of the route"))
    }
}
