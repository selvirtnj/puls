import SwiftUI
import PULSCore

// Live-Ansicht: Uhr lokal aus den Zeitbasen (`runElapsed`), alle übrigen Werte aus der Projektion (`runLiveData`,
// höchstens alle 10 s bzw. 30 s aktualisiert). Native signalisiert keine MMA-Phasen und keinen Start/keine Runde selbst:
// Ton und Vibration dafür sendet das Web nach dem bestätigten Ack. Eigene Haptik nur für native Bedienelemente.

struct ActivityLiveView: View {
    let coordinator: ActivityCoordinator
    let active: ActiveActivity
    let projection: ActivityProjection
    let text: ActivityText
    @State private var finishArmed = false
    @State private var armToken = 0
    @State private var controlTaps = 0

    private var typeInfo: ActivityTypeInfo? { projection.type(active.type) }
    private var kind: ActivityLiveKind { ActivityLiveKind(type: active.type, gps: active.gps, category: typeInfo?.category) }

    var body: some View {
        ZStack {
            VStack(spacing: 0) {
                header
                ScrollView {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        let elapsed = active.elapsed(at: context.date)
                        liveContent(elapsed: elapsed, now: context.date)
                    }
                    .padding(16)
                }
                if active.controlsEnabled {
                    controlBar
                } else {
                    Label(text("Diese Aktivität zeichnet ein anderes Gerät auf. Beende sie dort.",
                               "Another device is recording this activity. Finish it there."), systemImage: "iphone.and.arrow.forward")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemGroupedBackground))
                }
            }
            .accessibilityHidden(coordinator.isLocked)
            if coordinator.isLocked {
                ActivityLockOverlay(active: active, text: text) { coordinator.isLocked = false }
                    .transition(.opacity)
            }
        }
        .background(Color(.systemGroupedBackground))
        .sensoryFeedback(.impact(weight: .medium), trigger: controlTaps)
        .sensoryFeedback(trigger: coordinator.isLocked) { _, locked in locked ? .impact(weight: .medium) : .success }
        .sensoryFeedback(.warning, trigger: finishArmed) { _, armed in armed }
    }

    // MARK: Kopf

    private var header: some View {
        HStack(spacing: 12) {
            ActivityCloseButton(label: text("Minimieren", "Minimise")) { coordinator.close() }
            HStack(spacing: 6) {
                Image(systemName: ActivitySymbols.symbol(typeInfo?.icon ?? active.type))
                    .accessibilityHidden(true)
                Text(title)
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            Text(active.paused ? text("Pausiert", "Paused") : text("Läuft", "Live"))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(active.paused ? Color.orange : Color.green)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private var title: String {
        var parts = [typeInfo?.label ?? active.type]
        if let route = projection.route(active.routeId) { parts.append(route.name) }
        return parts.joined(separator: " · ")
    }

    // MARK: Inhalt

    @ViewBuilder
    private func liveContent(elapsed: Int, now: Date) -> some View {
        VStack(spacing: 16) {
            ActivityNoticeBanner(coordinator: coordinator, text: text)
            if kind == .mma, let mma = active.mma {
                MmaBox(mma: mma, elapsed: elapsed, phaseText: active.value("phase"), doneText: active.value("roundleft"), text: text)
            }
            if kind == .run || kind == .walk {
                HStack(spacing: 12) {
                    ActivityValueTile(value: text.clock(Double(elapsed)), label: text.field("time"), prominent: true)
                    ActivityValueTile(value: value("dist", now: now), label: text.field("dist"), prominent: true)
                }
                .accessibilityElement(children: .contain)
            } else {
                bigClock(elapsed)
            }
            let more = kind == .run || kind == .walk ? Array(kind.fields.dropFirst(2)) : kind.fields
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                ForEach(more, id: \.self) { key in
                    ActivityValueTile(value: value(key, now: now), label: text.field(key), prominent: false)
                }
            }
            if let progress = active.routeProgress { routeProgress(progress) }
            if active.gps, let label = active.gpsLabel, !label.isEmpty {
                Label(label, systemImage: "location")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if active.gps && active.recordingDevice && active.controlsEnabled { lapButton(elapsed: elapsed) }
            if kind == .mma, active.controlsEnabled, active.mma?.isDone == false { nextRoundButton }
            if coordinator.finishStalled { stalledFinish }
            if kind != .mma {
                Text(text("* kcal sind eine Schätzung.", "* kcal are an estimate."))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// Web-Wert; Zeit und Uhrzeit laufen lokal, `–` = unbekannt.
    private func value(_ key: String, now: Date) -> String {
        if key == "clock" { return text.timeOfDay(now) }
        return active.value(key) ?? "–"
    }

    private func bigClock(_ elapsed: Int) -> some View {
        VStack(spacing: 4) {
            ActivityBigNumber(value: text.clock(Double(elapsed)))
            Text(text("Dauer", "Duration"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text("Dauer", "Duration") + " " + text.spokenDuration(Double(elapsed)))
        .accessibilityAddTraits(.updatesFrequently)
    }

    private func routeProgress(_ progress: RouteProgress) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if let fraction = progress.fraction {
                ProgressView(value: fraction)
            }
            if let route = progress.routeKm {
                Text((progress.distanceKm.map { text.km($0) } ?? "–") + " / " + text.km(route) + " km")
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(text("Route", "Route"))
    }

    private func lapButton(elapsed: Int) -> some View {
        let lap = active.currentLap(atElapsed: elapsed)
        return Button {
            coordinator.lap()
        } label: {
            HStack {
                Image(systemName: "flag.checkered").accessibilityHidden(true)
                Text(text("Runde", "Lap") + " \(lap.number) · " + text.clock(Double(lap.seconds)))
                    .monospacedDigit()
                Spacer(minLength: 8)
                if coordinator.isBusy("lap") { ProgressView() } else { Text(text("Markieren", "Mark")).foregroundStyle(.tint) }
            }
            .font(.headline)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(active.paused || coordinator.isBusy("lap"))
        .accessibilityLabel(text("Runde markieren", "Mark lap"))
        .accessibilityValue(text("Runde", "Lap") + " \(lap.number), " + text.spokenDuration(Double(lap.seconds)))
    }

    private var nextRoundButton: some View {
        Button {
            coordinator.lap()
        } label: {
            Text(text("Nächste Runde", "Next round"))
                .font(.title3.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 60)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.roundedRectangle(radius: 12))
        .disabled(active.paused || coordinator.isBusy("lap"))
    }

    private var stalledFinish: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(text("Die GPS-Daten kommen noch. Die Aktivität ist pausiert, nichts geht verloren.",
                      "GPS data is still arriving. The activity is paused, nothing is lost."))
                .font(.subheadline)
            Button(text("Erneut versuchen", "Try again")) { coordinator.retryFinish() }
                .buttonStyle(.bordered)
                .buttonBorderShape(.roundedRectangle(radius: 8))
                .frame(minHeight: 44)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: Steuerung

    private var finishing: Bool { coordinator.isBusy("finish") }

    private var controlBar: some View {
        HStack(spacing: 12) {
            Button {
                coordinator.isLocked = true
                finishArmed = false
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "lock.fill").font(.title3)
                    Text(text("Sperren", "Lock")).font(.caption.weight(.semibold))
                }
                .frame(maxWidth: .infinity, minHeight: 64)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.roundedRectangle(radius: 12))
            .accessibilityHint(text("Sperrt die Bedienung gegen versehentliches Tippen", "Locks the controls against accidental taps"))

            Button {
                controlTaps += 1
                if active.paused { coordinator.resumeRun() } else { coordinator.pause() }
            } label: {
                Group {
                    if coordinator.isBusy("pause") || coordinator.isBusy("resume") {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: active.paused ? "play.fill" : "pause.fill").font(.title)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 64)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.roundedRectangle(radius: 12))
            .layoutPriority(1)
            .disabled(coordinator.isBusy("pause") || coordinator.isBusy("resume") || finishing)
            .accessibilityLabel(active.paused ? text("Weiter", "Resume") : text("Pause", "Pause"))

            Button(role: .destructive) {
                tapFinish()
            } label: {
                VStack(spacing: 4) {
                    if finishing {
                        ProgressView()
                    } else {
                        Image(systemName: "stop.fill").font(.title3)
                    }
                    Text(finishLabel).font(.caption.weight(.semibold)).lineLimit(2).multilineTextAlignment(.center)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity, minHeight: 64)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.roundedRectangle(radius: 12))
            .tint(finishArmed ? Color.red : Color.primary)
            .disabled(finishing)
            .accessibilityLabel(finishLabel)
            .accessibilityHint(finishArmed ? "" : text("Zweimal tippen zum Beenden", "Tap twice to finish"))
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(Color(.secondarySystemGroupedBackground))
    }

    private var finishLabel: String {
        if finishing { return active.gps ? text("GPS wird abgeschlossen …", "Finishing GPS …") : text("Wird beendet …", "Finishing …") }
        return finishArmed ? text("Nochmal tippen", "Tap again") : text("Beenden", "Finish")
    }

    /// Wie `runFinishTap`: erstes Tippen fragt nach, zweites (innerhalb 3 s) beendet.
    private func tapFinish() {
        if finishArmed {
            finishArmed = false
            coordinator.finish()
            return
        }
        finishArmed = true
        armToken += 1
        let token = armToken
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            if armToken == token { finishArmed = false }
        }
    }
}

/// MMA-Runde: Phase und Restzeit (lokal heruntergezählt), Balken, keine eigenen Signale.
private struct MmaBox: View {
    let mma: MmaState
    let elapsed: Int
    let phaseText: String?
    let doneText: String?
    let text: ActivityText

    var body: some View {
        let remaining = mma.remaining(atElapsed: elapsed)
        let color: Color = mma.isDone ? .green : (mma.phase == "rest" ? .orange : .blue)
        VStack(spacing: 8) {
            Text(phaseText ?? (text("Runde", "Round") + " \(mma.round) / \(mma.count)"))
                .font(.headline)
                .multilineTextAlignment(.center)
            ActivityBigNumber(value: mma.isDone ? (doneText ?? text("Fertig", "Done")) : text.shortClock(remaining))
                .foregroundStyle(color)
            ProgressView(value: mma.progress(atElapsed: elapsed))
                .tint(color)
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel((phaseText ?? "") + ", " + (mma.isDone ? (doneText ?? "") : text("noch", "remaining") + " " + text.spokenDuration(remaining)))
        .accessibilityAddTraits(.updatesFrequently)
    }
}

struct ActivityBigNumber: View {
    let value: String
    @ScaledMetric(relativeTo: .largeTitle) private var size: CGFloat = 64

    var body: some View {
        Text(value)
            .font(.system(size: size, weight: .bold, design: .rounded).monospacedDigit())
            .lineLimit(1)
            .minimumScaleFactor(0.4)
    }
}

struct ActivityValueTile: View {
    let value: String
    let label: String
    let prominent: Bool

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(prominent ? .largeTitle.weight(.bold).monospacedDigit() : .title2.weight(.semibold).monospacedDigit())
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(label)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label + ": " + value)
    }
}

/// Native Sperre wie `runLockHtml`: verdeckt alle Bedienelemente; Entsperren durch 1 s Halten
/// (VoiceOver: Aktion „Entsperren“).
private struct ActivityLockOverlay: View {
    let active: ActiveActivity
    let text: ActivityText
    let unlock: () -> Void
    @State private var holding = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text(text("Gesperrt", "Locked"))
                .font(.headline)
                .foregroundStyle(.secondary)
            TimelineView(.periodic(from: .now, by: 1)) { context in
                ActivityBigNumber(value: text.clock(Double(active.elapsed(at: context.date))))
            }
            .accessibilityHidden(true)
            ZStack {
                Circle().stroke(Color(.tertiarySystemFill), lineWidth: 6)
                Circle()
                    .trim(from: 0, to: holding ? 1 : 0)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(holding ? .linear(duration: 1) : (reduceMotion ? nil : .easeOut(duration: 0.2)), value: holding)
                Image(systemName: "lock.fill").font(.title)
            }
            .frame(width: 96, height: 96)
            .contentShape(Circle())
            .onLongPressGesture(minimumDuration: 1, maximumDistance: 40) {
                holding = false
                unlock()
            } onPressingChanged: { pressing in
                holding = pressing
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text("Bildschirm gesperrt", "Screen locked"))
            .accessibilityHint(text("Zum Entsperren 1 Sekunde halten", "Hold for 1 second to unlock"))
            .accessibilityAddTraits(.isButton)
            .accessibilityAction(named: text("Entsperren", "Unlock")) { unlock() }
            Text(text("Zum Entsperren 1 s halten", "Hold 1 s to unlock"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .contentShape(Rectangle())
        .onTapGesture {}
    }
}
