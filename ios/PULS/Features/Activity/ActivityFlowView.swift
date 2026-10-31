import SwiftUI
import PULSCore

// Vollbild-Ablauf der nativen Aktivität: Artwahl → Countdown → Live → Abschluss (docs/native §11).
// Die WebView liegt darunter weiter in der Hierarchie (GPS, Live-Aktivität, Sync laufen dort unverändert).

struct ActivityFlowHost: View {
    let coordinator: ActivityCoordinator

    var body: some View {
        ActivityFlowView(coordinator: coordinator)
            .environment(coordinator.store)
    }
}

struct ActivityFlowView: View {
    let coordinator: ActivityCoordinator

    var body: some View {
        let text = coordinator.text
        Group {
            if let projection = coordinator.projection {
                content(projection, text: text)
            } else {
                ActivityLoadingView(coordinator: coordinator, text: text, showsFallback: coordinator.offersWebFallback)
            }
        }
        .environment(\.locale, text.locale)
        .tint(.blue)
    }

    @ViewBuilder
    private func content(_ projection: ActivityProjection, text: ActivityText) -> some View {
        switch coordinator.stage {
        case .start:
            if projection.active != nil {
                ActivityActiveView(coordinator: coordinator, projection: projection, text: text)
            } else {
                ActivityStartView(coordinator: coordinator, projection: projection, text: text)
            }
        case .countdown(let endsAt):
            ActivityCountdownView(coordinator: coordinator, endsAt: endsAt, label: coordinator.currentType?.label ?? "", text: text)
        case .starting:
            ActivityWaitingView(title: text("Aktivität startet …", "Starting activity …"), coordinator: coordinator, text: text)
        case .active:
            ActivityActiveView(coordinator: coordinator, projection: projection, text: text)
        }
    }
}

/// Live-Ansicht oder Abschluss, je nach Projektion.
private struct ActivityActiveView: View {
    let coordinator: ActivityCoordinator
    let projection: ActivityProjection
    let text: ActivityText

    var body: some View {
        if let active = projection.active {
            if let summary = projection.currentSummary {
                ActivitySummaryView(coordinator: coordinator, active: active, summary: summary, text: text)
            } else {
                ActivityLiveView(coordinator: coordinator, active: active, projection: projection, text: text)
            }
        } else {
            ActivityWaitingView(title: text("Aktivität wird geladen …", "Loading activity …"), coordinator: coordinator, text: text)
                .task {
                    try? await Task.sleep(for: .seconds(3.5))
                    coordinator.reconcile()
                }
        }
    }
}

/// Kurzer Hinweis oben; verschwindet nach einigen Sekunden oder per Tippen.
struct ActivityNoticeBanner: View {
    let coordinator: ActivityCoordinator
    let text: ActivityText

    var body: some View {
        if let notice = coordinator.notice {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: notice.isWarning ? "exclamationmark.triangle" : "info.circle")
                    .foregroundStyle(notice.isWarning ? Color.orange : Color.blue)
                    .accessibilityHidden(true)
                Text(notice.text)
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    coordinator.notice = nil
                } label: {
                    Image(systemName: "xmark")
                        .font(.footnote.weight(.semibold))
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(text("Hinweis schließen", "Dismiss"))
            }
            .padding(.leading, 12)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            .task(id: notice.id) { @MainActor in
                AccessibilityNotification.Announcement(notice.text).post()
                try? await Task.sleep(for: .seconds(6))
                if coordinator.notice?.id == notice.id { coordinator.notice = nil }
            }
        }
    }
}

/// Runder Schließen-/Minimieren-Knopf oben links (44 pt).
struct ActivityCloseButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.down")
                .font(.body.weight(.semibold))
                .frame(width: 44, height: 44)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

private struct ActivityLoadingView: View {
    let coordinator: ActivityCoordinator
    let text: ActivityText
    let showsFallback: Bool

    var body: some View {
        VStack(spacing: 20) {
            HStack {
                ActivityCloseButton(label: text("Schließen", "Close")) { coordinator.close() }
                Spacer()
            }
            Spacer()
            ProgressView()
                .controlSize(.large)
            Text(text("Aktivitäten werden geladen …", "Loading activities …"))
                .font(.headline)
            if showsFallback {
                Text(text("Das dauert ungewöhnlich lange.", "This is taking unusually long."))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Button(text("In PULS öffnen", "Open in PULS")) { coordinator.fallBackToWeb() }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: 8))
                    .controlSize(.large)
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }
}

private struct ActivityWaitingView: View {
    let title: String
    let coordinator: ActivityCoordinator
    let text: ActivityText

    var body: some View {
        VStack(spacing: 16) {
            ActivityNoticeBanner(coordinator: coordinator, text: text)
            Spacer()
            ProgressView()
                .controlSize(.large)
            Text(title)
                .font(.headline)
            if !coordinator.store.pending.isEmpty, coordinator.store.isWaitingForWebDialog || coordinator.store.isWaitingForWeb {
                Text(text("Wartet, bis PULS bereit ist.", "Waiting until PULS is ready."))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Countdown

/// 10 s nativer Countdown: „+10 Sekunden“, „Jetzt starten“, „Abbrechen“. Bei 0 startet der Koordinator.
struct ActivityCountdownView: View {
    let coordinator: ActivityCoordinator
    let endsAt: Date
    let label: String
    let text: ActivityText
    @ScaledMetric(relativeTo: .largeTitle) private var digitSize: CGFloat = 120

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text(label)
                .font(.title2.weight(.semibold))
                .foregroundStyle(.secondary)
            TimelineView(.periodic(from: .now, by: 0.2)) { context in
                let left = max(0, Int(endsAt.timeIntervalSince(context.date).rounded(.up)))
                Text("\(left)")
                    .font(.system(size: digitSize, weight: .bold, design: .rounded).monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.4)
                    .contentTransition(.numericText(countsDown: true))
                    .accessibilityLabel(text("Start in \(left) Sekunden", "Starting in \(left) seconds"))
                    .accessibilityAddTraits(.updatesFrequently)
                    .sensoryFeedback(trigger: left) { _, value in
                        (1...3).contains(value) ? .impact(weight: .light) : nil
                    }
            }
            VStack(spacing: 12) {
                Button {
                    coordinator.startNow()
                } label: {
                    Label(text("Jetzt starten", "Start now"), systemImage: "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 56)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 12))
                Button {
                    coordinator.extendCountdown()
                } label: {
                    Text(text("+10 Sekunden", "+10 seconds"))
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 56)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.roundedRectangle(radius: 12))
                Button(text("Abbrechen", "Cancel"), role: .cancel) { coordinator.cancelCountdown() }
                    .frame(minHeight: 44)
            }
            .padding(.horizontal, 24)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

// MARK: - Startansicht

struct ActivityStartView: View {
    let coordinator: ActivityCoordinator
    let projection: ActivityProjection
    let text: ActivityText
    @State private var editsRounds = false
    @State private var picksRoute = false

    var body: some View {
        let selected = coordinator.currentType
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    ActivityNoticeBanner(coordinator: coordinator, text: text)
                    if !coordinator.canWrite {
                        Label(text("Gerade nur lesbar (Wiederherstellung oder Synchronisierung angehalten).",
                                   "Read only right now (recovery or sync paused)."), systemImage: "lock")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    typeGrid(selected: selected)
                    if selected?.id == "mma" { roundsPanel }
                    if selected?.gps == true { routePanel }
                }
                .padding(16)
            }
            .background(Color(.systemGroupedBackground))
            .safeAreaInset(edge: .bottom) { startBar(selected: selected) }
            .navigationTitle(text("Aktivität starten", "Start activity"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Schließen", "Close")) { coordinator.close() }
                }
            }
            .sheet(isPresented: $editsRounds) {
                RoundsEditor(initial: coordinator.currentRounds, text: text) { coordinator.applyRounds($0) }
            }
            .sheet(isPresented: $picksRoute) {
                NavigationStack {
                    ActivityRoutesList(coordinator: coordinator, text: text, picking: true) { id in
                        if let id { coordinator.preselect(route: id) } else { coordinator.selectedRouteId = nil }
                        picksRoute = false
                    }
                }
                .environment(\.locale, text.locale)
            }
        }
    }

    private func typeGrid(selected: ActivityTypeInfo?) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            ForEach(projection.types) { type in
                let isSelected = type.id == selected?.id
                Button {
                    coordinator.choose(type: type)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: ActivitySymbols.symbol(type.icon))
                            .font(.title2)
                            .frame(width: 32)
                            .accessibilityHidden(true)
                        Text(type.label)
                            .font(.body.weight(.semibold))
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        if isSelected {
                            Image(systemName: "checkmark")
                                .font(.body.weight(.semibold))
                                .accessibilityHidden(true)
                        }
                    }
                    .foregroundStyle(isSelected ? Color.accentColor : Color.primary)
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
                    }
                    .contentShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
                .accessibilityHint(type.gps ? text("Mit GPS", "With GPS") : "")
            }
        }
    }

    private var roundsPanel: some View {
        let rounds = coordinator.currentRounds
        return Button {
            editsRounds = true
        } label: {
            HStack(spacing: 0) {
                roundValue("\(rounds.count)", text("Runden", "Rounds"))
                roundValue(text.shortClock(Double(rounds.work)), text("Rundenlänge", "Round length"))
                roundValue(text.shortClock(Double(rounds.rest)), text("Pause", "Rest"))
                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(text("Runden einstellen", "Set rounds") + ": \(rounds.count), "
                            + text.shortClock(Double(rounds.work)) + ", " + text.shortClock(Double(rounds.rest)))
    }

    private func roundValue(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title3.weight(.semibold).monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var routePanel: some View {
        HStack(spacing: 12) {
            Button {
                picksRoute = true
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "point.topleft.down.to.point.bottomright.curvepath")
                        .accessibilityHidden(true)
                    if let route = coordinator.currentRoute {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(route.name).font(.body.weight(.semibold))
                            if let km = route.distanceKm { Text(text.km(km) + " km").font(.footnote).foregroundStyle(.secondary) }
                        }
                    } else {
                        Text(text("Route wählen (optional)", "Choose route (optional)"))
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right").foregroundStyle(.tertiary).accessibilityHidden(true)
                }
                .padding(14)
                .frame(minHeight: 56)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if coordinator.currentRoute != nil {
                Button {
                    coordinator.selectedRouteId = nil
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(text("Route entfernen", "Remove route"))
            }
        }
    }

    private func startBar(selected: ActivityTypeInfo?) -> some View {
        Button {
            coordinator.beginCountdown()
        } label: {
            Label(text("Start", "Start"), systemImage: "play.fill")
                .font(.title3.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 60)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 12))
        .disabled(!coordinator.canWrite || selected == nil)
        .accessibilityHint(text("Startet nach 10 Sekunden Countdown", "Starts after a 10 second countdown"))
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(.systemGroupedBackground))
    }
}

/// MMA-Runden wie `runRoundsForm` (gleiche Auswahllisten).
private struct RoundsEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var work: Int
    @State private var rest: Int
    @State private var count: Int
    let text: ActivityText
    let onApply: (RoundSettings) -> Void

    init(initial: RoundSettings, text: ActivityText, onApply: @escaping (RoundSettings) -> Void) {
        // Einmaliger Startwert des Formulars.
        _work = State(initialValue: initial.work)
        _rest = State(initialValue: initial.rest)
        _count = State(initialValue: initial.count)
        self.text = text
        self.onApply = onApply
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker(text("Rundenlänge", "Round length"), selection: $work) {
                    ForEach(RoundOptions.work(work), id: \.self) { Text(text.shortClock(Double($0)) + " min").tag($0) }
                }
                Picker(text("Pause zwischen Runden", "Rest between rounds"), selection: $rest) {
                    ForEach(RoundOptions.rest(rest), id: \.self) { value in
                        Text(value == 0 ? text("Keine", "None") : text.shortClock(Double(value)) + " min").tag(value)
                    }
                }
                Picker(text("Anzahl Runden", "Number of rounds"), selection: $count) {
                    ForEach(RoundOptions.count(count), id: \.self) { Text("\($0)").tag($0) }
                }
                Section {
                    EmptyView()
                } footer: {
                    Text(text("Beim Wechsel zwischen Runde und Pause gibt es Ton und Vibration. „Nächste Runde“ springt sofort weiter.",
                              "Sound and vibration mark each switch between round and rest. “Next round” skips ahead immediately."))
                }
            }
            .navigationTitle(text("Runden", "Rounds"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Übernehmen", "Apply")) {
                        onApply(RoundSettings(work: work, rest: rest, count: count))
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .environment(\.locale, text.locale)
    }
}
