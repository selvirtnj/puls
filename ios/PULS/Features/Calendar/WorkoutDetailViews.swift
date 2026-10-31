import SwiftUI
import PULSCore

// M5: lesbarer Workout-Rückblick (erste Seite von `completionReview`/`reviewWorkout`) und kompakte Aktivität
// (ohne Karte/GPS). Wiederöffnen, Bearbeiten, Löschen und Teilen bleiben Web-Abläufe (§10.5).

struct WorkoutReviewScreen: View {
    let coordinator: ProgressCoordinator
    let workoutId: String
    let title: String
    @State private var phase: LoadPhase<WorkoutReviewResult> = .loading
    @State private var reload = 0

    var body: some View {
        let text = coordinator.text
        List {
            switch phase {
            case .loaded(let review):
                content(review, text: text)
            default:
                Section {
                    QueryPhaseView(isLoading: phase == .loading, isGone: phase == .gone, text: text,
                                   retry: { reload += 1 },
                                   openWeb: { coordinator.openWeb(action: "reviewWorkout", id: workoutId) })
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(title.isEmpty ? "Workout" : title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(workoutId)|\(coordinator.dataRevision)|\(reload)") { @MainActor in
            // Beim Nachladen (neuer Snapshot, Rückkehr aus dem Web) bisherigen Inhalt stehen lassen.
            let hadValue = phase.value != nil
            if !hadValue { phase = .loading }
            let outcome = await coordinator.fetch { ProgressQueryRequest.detail(.workout, id: workoutId, requestId: $0) }
            guard !Task.isCancelled else { return }
            switch outcome {
            case .loaded(let message):
                if case .workout(let review)? = message.result, review.id == workoutId { phase = .loaded(review) } else { phase = .failed }
            case .gone: phase = .gone
            default: if !hadValue { phase = .failed }
            }
        }
    }

    @ViewBuilder
    private func content(_ review: WorkoutReviewResult, text: ProgressText) -> some View {
        Section {
            LabeledContent(text("Datum", "Date"), value: review.date.map(text.longDay) ?? "–")
            LabeledContent(text("Dauer", "Duration")) {
                Text(durationText(review, text: text)).monospacedDigit()
            }
            HStack(alignment: .top, spacing: 12) {
                StatTile(title: text("Übungen", "Exercises"), value: "\(review.exerciseCount ?? review.exercises.count)")
                StatTile(title: text("Sätze", "Sets"), value: "\(review.stats.sets ?? 0)")
                StatTile(title: text("Wdh.", "Reps"), value: "\(review.stats.reps ?? 0)")
                StatTile(title: text("Volumen", "Volume"), value: text.optional(review.stats.volume, unit: "kg"))
            }
            if let xp = review.xp {
                LabeledContent("XP", value: "+" + text.number(xp, digits: 0))
            }
            if let bodyweight = review.bodyweight {
                LabeledContent(text("Körpergewicht", "Bodyweight"), value: text.number(bodyweight) + " kg")
            }
        } footer: {
            if review.autoFinished {
                Text(text("Nach 5 Stunden automatisch beendet.", "Finished automatically after 5 hours."))
            }
        }
        if !review.wins.isEmpty {
            Section {
                ForEach(Array(review.wins.enumerated()), id: \.offset) { _, win in
                    Label(win, systemImage: "trophy")
                }
                if review.winsOmitted > 0 {
                    Text(text("\(review.winsOmitted) weitere in PULS.", "\(review.winsOmitted) more in PULS."))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text(text("Persönliche Verbesserungen", "Personal improvements"))
            }
        }
        ForEach(review.exercises) { exercise in
            Section {
                ForEach(exercise.sets) { set in
                    ReviewSetRow(set: set, text: text)
                }
                if exercise.omitted > 0 {
                    Text(text("\(exercise.omitted) weitere Sätze in PULS.", "\(exercise.omitted) more sets in PULS."))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if let libraryId = exercise.libraryId, ProgressQueryRequest.isValidID(libraryId) {
                    Button {
                        coordinator.show(.exercise(id: libraryId, name: exercise.name))
                    } label: {
                        Label(text("Verlauf dieser Übung", "History of this exercise"), systemImage: "chart.xyaxis.line")
                    }
                }
            } header: {
                Text(exercise.name.isEmpty ? text("Übung", "Exercise") : exercise.name)
            }
        }
        if review.omitted > 0 {
            Section {
                OmittedNote(message: text("\(review.omitted) weitere Übungen passen nicht in diese Ansicht.",
                                          "\(review.omitted) more exercises do not fit this view."), text: text) {
                    coordinator.openWeb(action: "reviewWorkout", id: review.id)
                }
            }
        }
        Section {
            Button {
                coordinator.openWeb(action: "shareWorkout", id: review.id)
            } label: {
                Label(text("Teilen in PULS", "Share in PULS"), systemImage: "square.and.arrow.up")
            }
            .accessibilityHint(text("Öffnet den Rückblick in PULS mit der Teilen-Schaltfläche",
                                    "Opens the review in PULS with its share button"))
            Button {
                coordinator.openWeb(action: "editWorkout", id: review.id)
            } label: {
                Label(text("Bearbeiten oder fortsetzen in PULS", "Edit or resume in PULS"), systemImage: "pencil")
            }
            .accessibilityHint(text("Öffnet den Trainingstag in PULS", "Opens the workout day in PULS"))
        } footer: {
            Text(text("Bearbeiten, Wiederöffnen und Löschen bleiben in PULS, damit Zeit und XP wie gewohnt geprüft werden.",
                      "Editing, reopening and deleting stay in PULS so time and XP are checked as usual."))
        }
    }

    private func durationText(_ review: WorkoutReviewResult, text: ProgressText) -> String {
        let value = text.duration(clock: review.durationClock, seconds: review.durationSeconds)
        return review.timeApprox && review.durationSeconds != nil ? text("ca. ", "approx. ") + value : value
    }
}

private struct ReviewSetRow: View {
    let set: ReviewSet
    let text: ProgressText

    var body: some View {
        HStack(spacing: 12) {
            Text("\(set.index + 1)")
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(minWidth: 24, alignment: .leading)
            Text(values)
                .monospacedDigit()
            Spacer(minLength: 8)
            if let e1rm = set.e1rm {
                Text("e1RM " + text.number(e1rm))
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
            Image(systemName: set.done ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(set.done ? Color.green : Color.secondary)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibility)
    }

    private var kgText: String {
        if let shown = set.shownKg { return text.number(shown) }
        return text.setValue(set.kg)
    }

    private var values: String {
        "\(kgText) kg × \(text.setValue(set.reps))"
    }

    private var accessibility: String {
        var parts = [text("Satz \(set.index + 1)", "Set \(set.index + 1)"), values]
        if let e1rm = set.e1rm { parts.append("e1RM " + text.number(e1rm)) }
        parts.append(set.done ? text("erledigt", "done") : text("nicht erledigt", "not done"))
        return parts.joined(separator: ", ")
    }
}

struct RunDetailScreen: View {
    let coordinator: ProgressCoordinator
    let runId: String
    let title: String
    @State private var phase: LoadPhase<RunDetailResult> = .loading
    @State private var reload = 0

    var body: some View {
        let text = coordinator.text
        List {
            switch phase {
            case .loaded(let detail):
                content(detail, text: text)
            default:
                Section {
                    QueryPhaseView(isLoading: phase == .loading, isGone: phase == .gone, text: text,
                                   retry: { reload += 1 },
                                   openWeb: { coordinator.openWeb(action: "runDetail", id: runId) })
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(title.isEmpty ? text("Aktivität", "Activity") : title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(runId)|\(coordinator.dataRevision)|\(reload)") { @MainActor in
            // Beim Nachladen (neuer Snapshot, Rückkehr aus dem Web) bisherigen Inhalt stehen lassen.
            let hadValue = phase.value != nil
            if !hadValue { phase = .loading }
            let outcome = await coordinator.fetch { ProgressQueryRequest.detail(.run, id: runId, requestId: $0) }
            guard !Task.isCancelled else { return }
            switch outcome {
            case .loaded(let message):
                if case .run(let detail)? = message.result, detail.entry.entryId == runId { phase = .loaded(detail) } else { phase = .failed }
            case .gone: phase = .gone
            default: if !hadValue { phase = .failed }
            }
        }
    }

    @ViewBuilder
    private func content(_ detail: RunDetailResult, text: ProgressText) -> some View {
        let entry = detail.entry
        Section {
            LabeledContent(text("Datum", "Date"), value: text.longDay(entry.date))
            LabeledContent(text("Dauer", "Duration")) {
                Text(text.duration(clock: entry.durationClock, seconds: entry.durationSeconds)).monospacedDigit()
            }
            if let km = entry.distanceKm, km > 0 {
                LabeledContent(text("Distanz", "Distance"), value: text.km(km))
            }
            if let pace = detail.paceText {
                LabeledContent("Pace", value: pace)
            }
            LabeledContent(text("Kalorien", "Calories"),
                           value: entry.kcal.map { text("ca. ", "approx. ") + text.number($0, digits: 0) + " kcal" } ?? text("unbekannt", "unknown"))
            if let pause = detail.pauseSeconds, pause > 0 {
                LabeledContent(text("Pause", "Paused"), value: text.clock(pause))
            }
            if let gain = detail.elevationGain {
                LabeledContent(text("Höhenmeter", "Elevation gain"), value: text.number(gain, digits: 0) + " m")
            }
            if let maximum = detail.elevationMax {
                LabeledContent(text("Höchster Punkt", "Highest point"), value: text.number(maximum, digits: 0) + " m")
            }
            if let speed = detail.maxSpeed {
                LabeledContent(text("Höchstgeschwindigkeit", "Top speed"), value: text.number(speed) + " km/h")
            }
            if let xp = detail.xp, xp > 0 {
                LabeledContent("XP", value: "+" + text.number(xp, digits: 0))
            }
        } footer: {
            if entry.estimatedKcal, entry.kcal != nil {
                Text(text("Kalorien sind geschätzte Brutto-kcal.", "Calories are estimated gross kcal."))
            }
        }
        if detail.feeling != nil || detail.terrain != nil || detail.note != nil {
            Section {
                if let feeling = text.feeling(detail.feeling) {
                    LabeledContent(text("Gefühl", "Feeling"), value: feeling)
                }
                if let terrain = text.terrain(detail.terrain) {
                    LabeledContent(text("Untergrund", "Surface"), value: terrain)
                }
                if let note = detail.note {
                    Text(note)
                }
            } header: {
                Text(text("Notizen", "Notes"))
            }
        }
        if !detail.wins.isEmpty {
            Section {
                ForEach(Array(detail.wins.enumerated()), id: \.offset) { _, win in
                    Label(win, systemImage: "trophy")
                }
            } header: {
                Text(text("Persönliche Verbesserungen", "Personal improvements"))
            }
        }
        Section {
            Button {
                coordinator.openWeb(detail.navigation ?? ProgressNavigation(action: "runDetail", id: entry.entryId))
            } label: {
                Label(detail.hasRoute ? text("Karte und Details in PULS", "Map and details in PULS")
                                      : text("Details in PULS", "Details in PULS"), systemImage: detail.hasRoute ? "map" : "list.bullet")
            }
            Button {
                coordinator.openWeb(action: "editRun", id: entry.entryId)
            } label: {
                Label(text("Bearbeiten in PULS", "Edit in PULS"), systemImage: "pencil")
            }
        }
    }
}
