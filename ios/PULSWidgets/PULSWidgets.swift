import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

@main
struct PULSWidgets: WidgetBundle {
    var body: some Widget {
        RestActivityWidget()
        RunActivityWidget()
    }
}

private let accent = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 10 / 255, green: 132 / 255, blue: 1, alpha: 1) : UIColor(red: 0, green: 122 / 255, blue: 1, alpha: 1) })
private let surface = Color(uiColor: .secondarySystemBackground)

private extension RestActivityAttributes.ContentState {
    var range: ClosedRange<Date> { startsAt...max(startsAt, endsAt) }
    func isOver(_ stale: Bool) -> Bool { stale || endsAt <= Date() }
    /// Keine laufende Pause (nie gestartet oder abgelaufen): dann zählt die Workout-Zeit.
    func showsWorkout(_ stale: Bool) -> Bool { isOver(stale) && workoutStartsAt != nil }
}

/// Pausen-Countdown oder Workout-Zeit, die iOS selbst weiterzählt. Feste Breite: ein laufender Timer-Text reserviert sonst Platz
/// für „0:00:00“ und schiebt Inhalte in der Dynamic Island und auf dem Sperrbildschirm aus der Mitte.
private struct RestClock: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool
    let size: CGFloat
    let width: CGFloat

    var body: some View {
        Group {
            if state.ended == true {
                Text("Beendet")
            } else if !state.isOver(isStale) {
                Text(timerInterval: state.range, countsDown: true)
            } else if let workoutStartsAt = state.workoutStartsAt {
                Text(workoutStartsAt, style: .timer)
            } else {
                Text("Los!")
            }
        }
        .font(.system(size: size, weight: .bold))
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: width, alignment: .trailing)
        .foregroundStyle(accent)
    }
}

/// Ring, der sich mit der Pause leert; ohne Pause das Trainingssymbol.
private struct RestRing: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool
    let size: CGFloat

    var body: some View {
        Group {
            if state.ended == true {
                Image(systemName: "checkmark.circle").resizable().scaledToFit()
            } else if state.showsWorkout(isStale) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .resizable()
                    .scaledToFit()
            } else if state.isOver(isStale) {
                Image(systemName: "checkmark.circle.fill")
                    .resizable()
                    .scaledToFit()
            } else {
                ProgressView(timerInterval: state.range, countsDown: true) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.circular)
            }
        }
        .tint(accent)
        .foregroundStyle(accent)
        .frame(width: size, height: size)
    }
}

private struct RestBar: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        ProgressView(timerInterval: state.range, countsDown: true) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .progressViewStyle(.linear)
        .tint(accent)
    }
}

/// Sperrbildschirm und Mitteilungsbereich.
private struct RestLockScreen: View {
    let context: ActivityViewContext<RestActivityAttributes>

    var body: some View {
        let state = context.state
        VStack(spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(state.ended == true ? "Beendet" : state.showsWorkout(context.isStale) ? "Workout · \(context.attributes.workout)" : state.isOver(context.isStale) ? "Pause vorbei" : "Pause · \(context.attributes.workout)")
                        .font(.caption2.weight(.bold))

                        .foregroundStyle(accent)
                        .lineLimit(1)
                    Text(state.exercise)
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Text(state.detail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                RestClock(state: state, isStale: context.isStale, size: 40, width: 112)
            }
            if !state.isOver(context.isStale) {
                RestBar(state: state)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .activityBackgroundTint(surface)
        .activitySystemActionForegroundColor(.primary)
    }
}

struct RestActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            RestLockScreen(context: context)
        } dynamicIsland: { context in
            let state = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        RestRing(state: state, isStale: context.isStale, size: 26)
                        Text(state.ended == true ? "Beendet" : state.showsWorkout(context.isStale) ? "Workout" : "Pause")
                            .font(.headline)
                            .foregroundStyle(.primary)
                    }
                    .padding(.leading, 6)
                    .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestClock(state: state, isStale: context.isStale, size: 30, width: 92)
                        .padding(.trailing, 6)
                        .frame(maxHeight: .infinity, alignment: .center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(state.exercise)
                                .font(.headline)
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            Spacer(minLength: 8)
                            Text(state.detail)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        if !state.isOver(context.isStale) {
                            RestBar(state: state)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.top, 4)
                }
            } compactLeading: {
                RestRing(state: state, isStale: context.isStale, size: 18)
                    .padding(.leading, 2)
            } compactTrailing: {
                RestClock(state: state, isStale: context.isStale, size: 15, width: 44)
            } minimal: {
                RestRing(state: state, isStale: context.isStale, size: 18)
            }
            .keylineTint(accent)
        }
    }
}
