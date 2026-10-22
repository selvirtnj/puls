import WidgetKit
import SwiftUI
import ActivityKit

private let accent = Color(red: 0.76, green: 0.95, blue: 0.42)

struct WorkoutTimers: View {
    let state: WorkoutAttributes.ContentState
    var compact = false
    var body: some View {
        if let end = state.restEndAt {
            Text(timerInterval: min(state.startedAt, end)...end, countsDown: true)
                .monospacedDigit().foregroundStyle(accent)
        } else {
            Text(state.startedAt, style: .timer).monospacedDigit().foregroundStyle(accent)
        }
    }
}

@main
struct PULSWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("PULS · \(context.state.name)").bold().lineLimit(1)
                    Spacer()
                    Text(context.state.restEndAt == nil ? "Workout" : "Pause")
                }
                WorkoutTimers(state: context.state).font(.title2.bold())
                HStack {
                    Text("Gesamt")
                    Text(context.state.startedAt, style: .timer).monospacedDigit()
                    Spacer()
                    if context.state.restEndAt != nil { Text("Bei 0: Nächster Satz").font(.caption) }
                }.font(.caption).foregroundStyle(.secondary)
            }.padding().activityBackgroundTint(Color.black).activitySystemActionForegroundColor(accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Label("PULS", systemImage: "dumbbell.fill").foregroundStyle(accent) }
                DynamicIslandExpandedRegion(.trailing) { Text(context.state.restEndAt == nil ? "Workout" : "Pause") }
                DynamicIslandExpandedRegion(.center) { Text(context.state.name).lineLimit(1) }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        WorkoutTimers(state: context.state).font(.title2.bold())
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("Gesamtdauer").font(.caption)
                            Text(context.state.startedAt, style: .timer).monospacedDigit()
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.restEndAt == nil ? "dumbbell.fill" : "timer").foregroundStyle(accent)
            } compactTrailing: {
                WorkoutTimers(state: context.state, compact: true).font(.caption).frame(width: 58)
            } minimal: {
                Image(systemName: context.state.restEndAt == nil ? "dumbbell.fill" : "timer").foregroundStyle(accent)
            }.keylineTint(accent)
        }
    }
}

