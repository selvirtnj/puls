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

/// Countdown, den iOS selbst weiterzählt — auch wenn die App im Hintergrund schläft.
private struct RestClock: View {
    let state: RestActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        if isStale || state.endsAt <= Date() {
            Text("Los!")
        } else {
            Text(timerInterval: state.startsAt...state.endsAt, countsDown: true)
                .monospacedDigit()
        }
    }
}

private struct RestProgress: View {
    let state: RestActivityAttributes.ContentState

    var body: some View {
        ProgressView(timerInterval: state.startsAt...state.endsAt, countsDown: true) {
            EmptyView()
        } currentValueLabel: {
            EmptyView()
        }
        .tint(accent)
    }
}

struct RestActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { context in
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.isStale ? "Pause vorbei" : "Pause · \(context.attributes.workout)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accent)
                    Text(context.state.exercise)
                        .font(.headline)
                        .lineLimit(1)
                    Text(context.state.detail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    RestProgress(state: context.state)
                }
                Spacer(minLength: 8)
                RestClock(state: context.state, isStale: context.isStale)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(accent)
                    .frame(minWidth: 90, alignment: .trailing)
            }
            .padding(16)
            .foregroundStyle(.white)
            .activityBackgroundTint(surface)
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Pause", systemImage: "timer")
                        .font(.headline)
                        .foregroundStyle(accent)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    RestClock(state: context.state, isStale: context.isStale)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(accent)
                        .frame(maxWidth: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Als Nächstes: \(context.state.exercise)")
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.state.detail)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        RestProgress(state: context.state)
                    }
                }
            } compactLeading: {
                Image(systemName: "timer")
                    .foregroundStyle(accent)
            } compactTrailing: {
                RestClock(state: context.state, isStale: context.isStale)
                    .foregroundStyle(accent)
                    .frame(maxWidth: 46, alignment: .trailing)
            } minimal: {
                Image(systemName: "timer")
                    .foregroundStyle(accent)
            }
            .keylineTint(accent)
        }
    }
}
