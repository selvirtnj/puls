import ActivityKit
import SwiftUI
import WidgetKit

private let runAccent = Color(red: 0xbd / 255, green: 0x91 / 255, blue: 0xff / 255)
private let runSurface = Color(red: 0x15 / 255, green: 0x12 / 255, blue: 0x1b / 255)
private let runGreen = Color(red: 0x3d / 255, green: 0xdc / 255, blue: 0x84 / 255)

/// Laufzeit: iOS zählt selbst weiter; pausiert fester Wert. Feste Breite, damit nichts springt.
private struct RunClock: View {
    let state: RunActivityAttributes.ContentState
    let size: CGFloat
    let width: CGFloat

    var body: some View {
        Group {
            if let paused = state.pausedElapsed {
                Text(RunActivityAttributes.ContentState.clock(paused))
            } else {
                Text(state.timerStart, style: .timer)
            }
        }
        .font(.system(size: size, weight: .bold, design: .rounded))
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: width, alignment: .trailing)
        .foregroundStyle(state.isPaused ? Color.white.opacity(0.5) : runAccent)
    }
}

/// Laufsymbol; läuft der Lauf, pulsiert es (ab iOS 17).
private struct RunIcon: View {
    let paused: Bool
    let size: CGFloat

    var body: some View {
        let image = Image(systemName: paused ? "pause.circle.fill" : "figure.run")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .foregroundStyle(paused ? Color.white.opacity(0.6) : runAccent)
        if #available(iOSApplicationExtension 17.0, *), !paused {
            image.symbolEffect(.pulse, options: .repeating)
        } else {
            image
        }
    }
}

/// Zahl mit Beschriftung; Wertewechsel rollen animiert (numericText).
private struct RunMetric: View {
    let value: String
    let unit: String
    let label: String
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 1) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .foregroundStyle(.white)
                Text(unit)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.55))
            }
            Text(label)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.5))
                .lineLimit(1)
        }
    }
}

private struct RunProgress: View {
    let state: RunActivityAttributes.ContentState

    var body: some View {
        if let progress = state.routeProgress, let total = state.routeKm {
            VStack(alignment: .leading, spacing: 4) {
                ProgressView(value: progress)
                    .progressViewStyle(.linear)
                    .tint(progress >= 1 ? runGreen : runAccent)
                Text(progress >= 1 ? "Route geschafft" : "Route · noch \(String(format: "%.1f", max(0, total - state.distanceKm)).replacingOccurrences(of: ".", with: ",")) km")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.55))
            }
        }
    }
}

private struct RunLockScreen: View {
    let context: ActivityViewContext<RunActivityAttributes>

    var body: some View {
        let state = context.state
        VStack(spacing: 12) {
            HStack(alignment: .center, spacing: 10) {
                RunIcon(paused: state.isPaused, size: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.isPaused ? "PAUSIERT" : "LAUF")
                        .font(.caption2.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(state.isPaused ? Color.white.opacity(0.6) : runAccent)
                    Text(context.attributes.title)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                RunClock(state: state, size: 34, width: 120)
            }
            HStack(alignment: .top) {
                if state.gps {
                    RunMetric(value: state.distanceText, unit: "km", label: "Distanz")
                    Spacer()
                    RunMetric(value: RunActivityAttributes.ContentState.pace(state.paceSeconds), unit: "/km", label: "Ø Pace", alignment: .center)
                    Spacer()
                    RunMetric(value: RunActivityAttributes.ContentState.pace(state.lastSplitSeconds), unit: "/km", label: "Letzter km", alignment: .trailing)
                } else {
                    Text("Nur Timer · Distanz beim Beenden eintragen")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
            RunProgress(state: state)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .activityBackgroundTint(runSurface)
        .activitySystemActionForegroundColor(.white)
    }
}

struct RunActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunActivityAttributes.self) { context in
            RunLockScreen(context: context)
        } dynamicIsland: { context in
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        RunIcon(paused: state.isPaused, size: 24)
                        Text(state.isPaused ? "Pause" : "Lauf")
                            .font(.headline)
                            .foregroundStyle(.white)
                    }
                    .padding(.leading, 6)
                    .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RunClock(state: state, size: 28, width: 104)
                        .padding(.trailing, 6)
                        .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        if state.gps {
                            HStack(alignment: .top) {
                                RunMetric(value: state.distanceText, unit: "km", label: "Distanz")
                                Spacer()
                                RunMetric(value: RunActivityAttributes.ContentState.pace(state.paceSeconds), unit: "/km", label: "Ø Pace", alignment: .center)
                                Spacer()
                                RunMetric(value: RunActivityAttributes.ContentState.pace(state.lastSplitSeconds), unit: "/km", label: "Letzter km", alignment: .trailing)
                            }
                        }
                        RunProgress(state: state)
                    }
                    .padding(.horizontal, 6)
                    .padding(.top, 2)
                }
            } compactLeading: {
                RunIcon(paused: state.isPaused, size: 18)
                    .padding(.leading, 2)
            } compactTrailing: {
                if state.gps {
                    Text("\(state.distanceText) km")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .contentTransition(.numericText())
                        .foregroundStyle(runAccent)
                        .frame(width: 66, alignment: .trailing)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else {
                    RunClock(state: state, size: 15, width: 48)
                }
            } minimal: {
                RunIcon(paused: state.isPaused, size: 18)
            }
            .keylineTint(runAccent)
        }
    }
}
