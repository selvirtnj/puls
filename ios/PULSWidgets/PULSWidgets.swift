import ActivityKit
import SwiftUI
import WidgetKit

@main
struct PULSWidgets: WidgetBundle {
    var body: some Widget {
        RestActivityWidget()
    }
}

private let accent = Color(red: 0xbd / 255, green: 0x91 / 255, blue: 0xff / 255)
private let surface = Color(red: 0x15 / 255, green: 0x12 / 255, blue: 0x1b / 255)

private extension RestActivityAttributes.ContentState {
    var range: ClosedRange<Date> { startsAt...max(startsAt, endsAt) }
    func isOver(_ stale: Bool) -> Bool { stale || endsAt <= Date() }
}

/// Countdown, den iOS selbst weiterzählt. Feste Breite: ein laufender Timer-Text reserviert sonst Platz
/// für „0:00:00“ und schiebt Inhalte in der Dynamic Island und auf dem Sperrbildschirm aus der Mitte.
private struct RestClock: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool
    let size: CGFloat
    let width: CGFloat

    var body: some View {
        Group {
            if state.isOver(isStale) {
                Text("Los!")
            } else {
                Text(timerInterval: state.range, countsDown: true)
            }
        }
        .font(.system(size: size, weight: .bold, design: .rounded))
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(width: width, alignment: .trailing)
        .foregroundStyle(accent)
    }
}

/// Ring, der sich mit der Pause leert.
private struct RestRing: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool
    let size: CGFloat

    var body: some View {
        Group {
            if state.isOver(isStale) {
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
                    Text(state.isOver(context.isStale) ? "PAUSE VORBEI" : "PAUSE · \(context.attributes.workout.uppercased())")
                        .font(.caption2.weight(.bold))
                        .tracking(0.6)
                        .foregroundStyle(accent)
                        .lineLimit(1)
                    Text(state.exercise)
                        .font(.headline)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(state.detail)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.6))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                RestClock(state: state, isStale: context.isStale, size: 40, width: 112)
            }
            RestBar(state: state)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .activityBackgroundTint(surface)
        .activitySystemActionForegroundColor(.white)
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
                        Text("Pause")
                            .font(.headline)
                            .foregroundStyle(.white)
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
                                .foregroundStyle(.white)
                                .lineLimit(1)
                            Spacer(minLength: 8)
                            Text(state.detail)
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.6))
                                .lineLimit(1)
                        }
                        RestBar(state: state)
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
