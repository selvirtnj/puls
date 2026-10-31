import SwiftUI
import PULSCore

// Nativer Trainings-Tab mit den Bereichen wie die Web-Unterseiten (`trainTab`): Training (Workout + Routinen, M4),
// Kalender und Fortschritt (M5). Unterseiten (Rückblick, Aktivität, Übungsverlauf) im selben NavigationStack; der
// Seitentitel „Training“ steht im gemeinsamen Seitenkopf (`ShellHeader`).

struct WorkoutTabHost: View {
    let training: TrainingCoordinator
    let progress: ProgressCoordinator?

    var body: some View {
        Group {
            if let progress {
                WorkoutTabView(training: training, progress: progress)
            } else {
                TrainingHomeView(coordinator: training)
            }
        }
        .environment(training.store)
    }
}

struct WorkoutTabView: View {
    let training: TrainingCoordinator
    @Bindable var progress: ProgressCoordinator

    var body: some View {
        let text = progress.text
        NavigationStack(path: $progress.path) {
            VStack(spacing: 0) {
                if progress.offersAny {
                    Picker(text("Bereich", "Section"), selection: segmentBinding) {
                        Text(text("Training", "Training")).tag(WorkoutSegment.training)
                        if progress.offersCalendar {
                            Text(text("Kalender", "Calendar")).tag(WorkoutSegment.calendar)
                        }
                        if progress.offersProgress {
                            Text(text("Fortschritt", "Progress")).tag(WorkoutSegment.progress)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                switch progress.effectiveSegment {
                case .training:
                    trainingContent(text: text)
                case .calendar:
                    CalendarScreen(coordinator: progress)
                case .progress:
                    ProgressScreen(coordinator: progress)
                }
            }
            .background(Color(.systemGroupedBackground))
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: ProgressRoute.self) { route in
                destination(route)
                    .background(Color(.systemGroupedBackground))
            }
        }
        .environment(\.locale, text.locale)
        .tint(.blue)
    }

    private var segmentBinding: Binding<WorkoutSegment> {
        Binding(get: { progress.effectiveSegment }, set: { progress.segment = $0 })
    }

    @ViewBuilder
    private func trainingContent(text: ProgressText) -> some View {
        if training.isAvailable {
            TrainingHomeView(coordinator: training, showsWebHistoryLink: !progress.offersAny)
        } else {
            // Nur Kalender/Fortschritt nativ (Web ohne `nativeTraining`): Training bleibt im Web erreichbar.
            ContentUnavailableView {
                Label(text("Training in PULS", "Training in PULS"), systemImage: "dumbbell")
            } description: {
                Text(text("Routinen und laufende Trainings öffnen sich hier in PULS.", "Routines and workouts open in PULS here."))
            } actions: {
                Button(text("Training öffnen", "Open training")) { training.showWebWorkout() }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    @ViewBuilder
    private func destination(_ route: ProgressRoute) -> some View {
        switch route {
        case .workout(let id, let name):
            WorkoutReviewScreen(coordinator: progress, workoutId: id, title: name)
        case .run(let id, let name):
            RunDetailScreen(coordinator: progress, runId: id, title: name)
        case .exercise(let id, let name):
            ExerciseHistoryScreen(coordinator: progress, exerciseId: id, title: name)
        }
    }
}
