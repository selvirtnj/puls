import SwiftUI
import PULSCore

// M5: Übungsverlauf (Web: `performanceHistory`). e1RM-Punkte, Historie und Rekord kommen per Query (`kind:'exercise'`);
// hohe Wiederholungen ohne e1RM bleiben in der Historie ohne Punkt. Einstellungen/Ziele bleiben Web (§10.5).

struct ExerciseHistoryScreen: View {
    let coordinator: ProgressCoordinator
    let exerciseId: String
    let title: String
    @State private var phase: LoadPhase<ExerciseHistoryResult> = .loading
    @State private var reload = 0

    var body: some View {
        let text = coordinator.text
        List {
            switch phase {
            case .loaded(let history):
                content(history, text: text)
            default:
                Section {
                    QueryPhaseView(isLoading: phase == .loading, isGone: phase == .gone, text: text,
                                   retry: { reload += 1 }, openWeb: { coordinator.openWeb(action: "exerciseHistory", id: exerciseId) })
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(title.isEmpty ? text("Übung", "Exercise") : title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(exerciseId)|\(coordinator.store.progressGeneration)|\(reload)") { @MainActor in
            phase = .loading
            let outcome = await coordinator.fetch { ProgressQueryRequest.detail(.exercise, id: exerciseId, requestId: $0) }
            guard !Task.isCancelled else { return }
            switch outcome {
            case .loaded(let message):
                if case .exercise(let history)? = message.result, history.id == exerciseId { phase = .loaded(history) } else { phase = .failed }
            case .gone: phase = .gone
            default: phase = .failed
            }
        }
    }

    @ViewBuilder
    private func content(_ history: ExerciseHistoryResult, text: ProgressText) -> some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Bestes e1RM", "Best e1RM"), value: history.best.map { text.number($0) + " kg" } ?? "–")
                StatTile(title: text("Schwerster Satz", "Heaviest set"), value: heaviest(history.heaviest, text: text))
                StatTile(title: text("Trainings", "Sessions"), value: "\(history.total)")
            }
            PointSeriesChart(exercisePoints: history.points, text: text, height: 200)
            if history.pointsOmitted > 0 {
                Text(text("Gezeigt: die letzten \(history.points.count) Punkte.", "Showing the latest \(history.points.count) points."))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } header: {
            Text(text("e1RM-Verlauf", "e1RM history"))
        } footer: {
            Text(text("Sätze mit sehr vielen Wiederholungen ergeben kein e1RM und erscheinen nur in der Liste.",
                      "Sets with very high reps give no e1RM and appear only in the list."))
        }
        if history.rank?.name != nil || history.forecast != nil || history.suggestion != nil {
            Section {
                if let rank = history.rank, let name = rank.name {
                    LabeledContent(text("Rang", "Rank")) {
                        Text(name + (rank.percent.map { " · " + text.number($0, digits: 0) + " %" } ?? ""))
                    }
                }
                if let forecast = history.forecast { Text(forecast).font(.subheadline) }
                if let suggestion = history.suggestion {
                    Label(suggestion, systemImage: "arrow.up.right")
                        .font(.subheadline)
                }
            } header: {
                Text(text("Progression", "Progression"))
            }
        }
        Section {
            if history.history.isEmpty {
                Text(text("Noch kein abgeschlossenes Training mit dieser Übung.", "No finished workout with this exercise yet."))
                    .foregroundStyle(.secondary)
            }
            ForEach(history.history) { session in
                sessionRow(session, text: text)
            }
            if history.omitted > 0 {
                OmittedNote(message: text("\(history.omitted) ältere Trainings stehen in PULS.", "\(history.omitted) older sessions are in PULS."),
                            text: text) {
                    coordinator.openWeb(action: "exerciseHistory", id: history.id)
                }
            }
        } header: {
            Text(text("Trainings", "Sessions"))
        }
        Section {
            Button {
                coordinator.openWeb(action: "exerciseSettings", id: history.id)
            } label: {
                Label(text("Ziel und Progression in PULS", "Goal and progression in PULS"), systemImage: "slider.horizontal.3")
            }
            Button {
                coordinator.openWeb(action: "exerciseHistory", id: history.id)
            } label: {
                Label(text("Verlauf in PULS öffnen", "Open history in PULS"), systemImage: "arrow.up.forward.app")
            }
        }
    }

    @ViewBuilder
    private func sessionRow(_ session: ExerciseHistorySession, text: ProgressText) -> some View {
        let label = VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline) {
                Text(session.name.isEmpty ? "Workout" : session.name)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                Text(text.day(session.date))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(setsText(session, text: text))
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            Text(summary(session, text: text))
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        if let workoutId = session.workoutId, ProgressQueryRequest.isValidID(workoutId) {
            Button {
                coordinator.show(.workout(id: workoutId, name: session.name))
            } label: {
                label
            }
            .accessibilityHint(text("Öffnet den Rückblick", "Opens the review"))
        } else {
            label
        }
    }

    private func setsText(_ session: ExerciseHistorySession, text: ProgressText) -> String {
        var parts = session.sets.map { "\(text.setValue($0.kg)) × \(text.setValue($0.reps))" }
        if session.omitted > 0 { parts.append(text("+\(session.omitted) weitere", "+\(session.omitted) more")) }
        return parts.joined(separator: " / ")
    }

    private func summary(_ session: ExerciseHistorySession, text: ProgressText) -> String {
        var parts: [String] = []
        parts.append(session.e1rm.map { "e1RM " + text.number($0) + " kg" } ?? text("kein e1RM", "no e1RM"))
        if let volume = session.volume { parts.append(text("Volumen ", "Volume ") + text.number(volume) + " kg") }
        return parts.joined(separator: " · ")
    }

    private func heaviest(_ set: HeaviestSet?, text: ProgressText) -> String {
        guard let set, let kg = set.kg else { return "–" }
        return text.number(kg) + " kg" + (set.reps.map { " × " + text.number($0, digits: 0) } ?? "")
    }
}
