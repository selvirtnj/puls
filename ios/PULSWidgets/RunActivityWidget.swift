import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

private let runAccent = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 10 / 255, green: 132 / 255, blue: 1, alpha: 1) : UIColor(red: 0, green: 122 / 255, blue: 1, alpha: 1) })
private let runSurface = Color(uiColor: .secondarySystemBackground)

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
        .font(.system(size: size, weight: .bold))
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: width, alignment: .trailing)
        .foregroundStyle(state.isPaused ? Color.secondary : runAccent)
    }
}

/// Ruhiges SF Symbol für laufend, pausiert oder beendet.
private struct RunIcon: View {
    let state: RunActivityAttributes.ContentState
    let size: CGFloat

    var body: some View {
        Image(systemName: state.isEnded ? "checkmark.circle" : state.isPaused ? "pause.circle" : "figure.run")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .foregroundStyle(state.isPaused ? Color.secondary : runAccent)
    }
}

/// Zahl mit ruhiger Beschriftung und gleich breiten Ziffern.
private struct RunMetric: View {
    let value: String
    let unit: String
    let label: String
    var alignment: HorizontalAlignment = .leading

    var body: some View {
        VStack(alignment: alignment, spacing: 1) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(.system(size: 22, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(.primary)
                Text(unit)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
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
                    .tint(progress >= 1 ? Color.green : runAccent)
                Text(progress >= 1 ? "Route geschafft" : "Route · noch \(String(format: "%.1f", max(0, total - state.distanceKm)).replacingOccurrences(of: ".", with: ",")) km")
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
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
                RunIcon(state: state, size: 26)
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.isEnded ? "Beendet" : state.isPaused ? "Pausiert" : "Aktivität")
                        .font(.caption2.weight(.bold))

                        .foregroundStyle(state.isPaused ? Color.secondary : runAccent)
                    Text(context.attributes.title)
                        .font(.headline)
                        .foregroundStyle(.primary)
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
                    Text("Aktivität ohne GPS")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            RunProgress(state: state)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .activityBackgroundTint(runSurface)
        .activitySystemActionForegroundColor(.primary)
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
                        RunIcon(state: state, size: 24)
                        Text(state.isEnded ? "Beendet" : state.isPaused ? "Pause" : "Aktivität")
                            .font(.headline)
                            .foregroundStyle(.primary)
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
                RunIcon(state: state, size: 18)
                    .padding(.leading, 2)
            } compactTrailing: {
                if state.gps {
                    Text("\(state.distanceText) km")
                        .font(.system(size: 14, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(runAccent)
                        .frame(width: 66, alignment: .trailing)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else {
                    RunClock(state: state, size: 15, width: 48)
                }
            } minimal: {
                RunIcon(state: state, size: 18)
            }
            .keylineTint(runAccent)
        }
    }
}
