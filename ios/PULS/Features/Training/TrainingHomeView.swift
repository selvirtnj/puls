import SwiftUI
import PULSCore

// Nativer Trainings-Tab (M4). Liest die `training`-Projektion (Routinen, Empfehlung, Bibliothek, letzte Trainings,
// Level/XP/Serie) und schreibt nur über `TrainingCoordinator` → Ops. Kalender, Rekorde und Rückblick bleiben Web.
// Titel „Training“ steht im gemeinsamen Seitenkopf (`ShellHeader`).

struct TrainingHomeHost: View {
    let coordinator: TrainingCoordinator

    var body: some View {
        TrainingHomeView(coordinator: coordinator)
            .environment(coordinator.store)
    }
}

/// Sheet-Anfrage für den Routineneditor.
private struct EditorRequest: Identifiable {
    let id: String
    let draft: RoutineDraft
    let isNew: Bool
}

struct TrainingHomeView: View {
    let coordinator: TrainingCoordinator
    /// M5: Ohne nativen Kalender/Fortschritt führt ein Eintrag zur Web-Trainingsseite (Kalender, Rekorde, Rückblick).
    var showsWebHistoryLink = true
    @State private var editor: EditorRequest?
    @State private var showsEmptyStart = false
    @State private var emptyName = ""
    @State private var deleting: TrainingRoutine?

    var body: some View {
        let text = coordinator.text
        Group {
            if let training = coordinator.training {
                content(training, text: text)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color(.systemGroupedBackground))
        .environment(\.locale, text.locale)
        .tint(.blue)
        .sheet(item: $editor) { request in
            RoutineEditorView(coordinator: coordinator, draft: request.draft, isNew: request.isNew)
        }
        .alert(text("Freies Training", "Empty workout"), isPresented: $showsEmptyStart) {
            TextField(text("Name", "Name"), text: $emptyName)
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
            Button(text("Starten", "Start")) { coordinator.startEmpty(name: emptyName) }
                .disabled(emptyName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } message: {
            Text(text("Gib deinem Training einen Namen (bis 80 Zeichen).", "Name your workout (up to 80 characters)."))
        }
        .confirmationDialog(
            text("Routine löschen?", "Delete routine?"),
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible,
            presenting: deleting
        ) { routine in
            Button(text("Löschen", "Delete"), role: .destructive) { coordinator.deleteRoutine(id: routine.id) }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        } message: { routine in
            Text(text("„\(routine.name)“ wird gelöscht. Bereits erfasste Trainings bleiben erhalten.",
                      "“\(routine.name)” will be deleted. Logged workouts are kept."))
        }
        .onChange(of: coordinator.requestsEmptyStart, initial: true) { _, requested in
            guard requested else { return }
            coordinator.requestsEmptyStart = false
            openEmptyStart(text: text)
        }
    }

    private func content(_ training: TrainingProjection, text: TrainingText) -> some View {
        let canWrite = coordinator.canWrite
        return List {
            TrainingNoticeSection(coordinator: coordinator, text: text)
            if !canWrite {
                Section {
                    Label(text("Gerade nur lesbar (Vorschau, Wiederherstellung oder Synchronisierung angehalten).",
                               "Read only right now (preview, recovery or sync paused)."), systemImage: "lock")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            if let active = training.active {
                ActiveWorkoutSection(active: active, text: text) { coordinator.openSession(workoutId: active.id) }
            }
            if let identity = training.identity {
                IdentitySection(identity: identity, text: text)
            }
            TrainingConflictSection(coordinator: coordinator, workoutId: nil, text: text)
            if training.active == nil {
                StartSection(training: training, text: text, canWrite: canWrite, isStarting: coordinator.isBusy("start"),
                             start: { coordinator.start(routineId: $0) },
                             startEmpty: { openEmptyStart(text: text) })
            }
            routinesSection(training, text: text, canWrite: canWrite)
            RecentSection(training: training, text: text)
            // Mit nativem Kalender/Fortschritt (M5) liegen diese im Bereichswähler; der Web-Eintrag bleibt dann nur
            // als Ausweg für ausgelassene Einträge.
            if showsWebHistoryLink || training.omitted.any {
                Section {
                    Button {
                        coordinator.showWebWorkout()
                    } label: {
                        if showsWebHistoryLink {
                            Label(text("Kalender, Rekorde und Rückblick", "Calendar, records and history"), systemImage: "calendar")
                        } else {
                            Label(text("Alle Einträge in PULS", "All entries in PULS"), systemImage: "arrow.up.forward.app")
                        }
                    }
                    .accessibilityHint(text("Öffnet die Trainingsseite in PULS", "Opens the training page in PULS"))
                } footer: {
                    if training.omitted.any {
                        Text(text("Nicht alle Einträge passen in diese Ansicht. Die vollständige Liste steht in PULS.",
                                  "Not every entry fits this view. The full list is in PULS."))
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .contentMargins(.top, 8, for: .scrollContent)
    }

    private func routinesSection(_ training: TrainingProjection, text: TrainingText, canWrite: Bool) -> some View {
        Section {
            if training.routines.isEmpty {
                Text(text("Erstelle deine erste eigene Routine.", "Create your first routine."))
                    .foregroundStyle(.secondary)
            }
            ForEach(training.routines) { routine in
                RoutineRow(
                    routine: routine, text: text, canWrite: canWrite,
                    isActive: training.active != nil,
                    isStarting: coordinator.isBusy("start"),
                    isDeleting: coordinator.isBusy("delete:" + routine.id),
                    start: { coordinator.start(routineId: routine.id) },
                    edit: { edit(routine.id, text: text) },
                    delete: { deleting = routine }
                )
            }
            Button {
                createRoutine(text: text)
            } label: {
                Label(text("Neue Routine", "New routine"), systemImage: "plus")
            }
            .disabled(!canWrite)
        } header: {
            Text(text("Routinen", "Routines"))
        } footer: {
            if training.routineCount > training.routines.count {
                Text(text("\(training.routineCount - training.routines.count) weitere Routinen in PULS.",
                          "\(training.routineCount - training.routines.count) more routines in PULS."))
            }
        }
    }

    private func openEmptyStart(text: TrainingText) {
        guard coordinator.canWrite else { return }
        if let active = coordinator.training?.active {
            coordinator.openSession(workoutId: active.id)
            return
        }
        emptyName = text("Mein Workout", "My workout")
        showsEmptyStart = true
    }

    private func createRoutine(text: TrainingText) {
        let id = UUID().uuidString.lowercased()
        editor = EditorRequest(id: id, draft: RoutineDraft(newID: id, name: text("Meine Routine", "My routine")), isNew: true)
    }

    private func edit(_ routineID: String, text: TrainingText) {
        guard let raw = coordinator.store.rawRoutine(id: routineID),
              let draft = RoutineDraft(raw: raw, makeID: { UUID().uuidString }) else {
            // Nicht nativ lesbar: im Web bearbeiten.
            coordinator.notice = TrainingNotice(text: text("Diese Routine lässt sich nur in PULS bearbeiten.",
                                                           "This routine can only be edited in PULS."), isWarning: false)
            coordinator.showWebWorkout()
            return
        }
        editor = EditorRequest(id: routineID, draft: draft, isNew: false)
    }
}

// MARK: - Abschnitte

/// Kurzer Hinweis oben; verschwindet nach einigen Sekunden oder per Tippen.
struct TrainingNoticeSection: View {
    let coordinator: TrainingCoordinator
    let text: TrainingText

    var body: some View {
        if let notice = coordinator.notice {
            Section {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: notice.isWarning ? "exclamationmark.triangle" : "info.circle")
                        .foregroundStyle(notice.isWarning ? Color.orange : Color.blue)
                        .accessibilityHidden(true)
                    Text(notice.text)
                        .font(.subheadline)
                    Spacer(minLength: 8)
                    Button {
                        coordinator.notice = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.footnote.weight(.semibold))
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(text("Hinweis schließen", "Dismiss"))
                }
            }
            .task(id: notice.id) { @MainActor in
                AccessibilityNotification.Announcement(notice.text).post()
                try? await Task.sleep(for: .seconds(6))
                if coordinator.notice?.id == notice.id { coordinator.notice = nil }
            }
        }
    }
}

/// Geparkte Konflikte (anderes Gerät hat inzwischen geändert): verwerfen oder mit aktuellem Stand erneut senden.
struct TrainingConflictSection: View {
    let coordinator: TrainingCoordinator
    /// `nil` = alle Trainingskonflikte, sonst nur die dieses Workouts.
    let workoutId: String?
    let text: TrainingText

    var body: some View {
        let conflicts = coordinator.store.trainingConflicts.filter { entry in
            guard let workoutId else { return true }
            return entry.command.args["workoutId"]?.stringValue == workoutId
        }
        if !conflicts.isEmpty {
            Section {
                ForEach(conflicts, id: \.command.id) { entry in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(description(entry.command.op))
                            .font(.subheadline)
                        HStack(spacing: 16) {
                            Button(text("Verwerfen", "Discard"), role: .destructive) {
                                coordinator.discardConflict(id: entry.command.id)
                            }
                            if ProfileStore.canReapply(op: entry.command.op) {
                                Button(text("Trotzdem übernehmen", "Apply anyway")) {
                                    coordinator.reapplyConflict(id: entry.command.id)
                                }
                            }
                        }
                        .buttonStyle(.borderless)
                        .frame(minHeight: 44)
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text(text("Nicht übernommen", "Not applied"))
            } footer: {
                Text(text("Der Stand wurde inzwischen an anderer Stelle geändert. Die Anzeige zeigt den aktuellen Stand.",
                          "This was changed elsewhere in the meantime. The view shows the current state."))
            }
        }
    }

    private func description(_ op: String) -> String {
        switch op {
        case TrainingOps.setUpdate: return text("Satzwerte", "Set values")
        case TrainingOps.setAdd: return text("Satz hinzufügen", "Add set")
        case TrainingOps.setRemove: return text("Satz entfernen", "Remove set")
        case TrainingOps.exerciseAdd: return text("Übung hinzufügen", "Add exercise")
        case TrainingOps.exerciseRemove: return text("Übung entfernen", "Remove exercise")
        case TrainingOps.exerciseMove: return text("Reihenfolge ändern", "Reorder exercises")
        case TrainingOps.routineSave: return text("Routine speichern", "Save routine")
        case TrainingOps.workoutFinish: return text("Training abschließen", "Finish workout")
        default: return text("Änderung", "Change")
        }
    }
}

private struct ActiveWorkoutSection: View {
    let active: ActiveWorkout
    let text: TrainingText
    let resume: () -> Void

    var body: some View {
        Section {
            Button(action: resume) {
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    HStack(spacing: 12) {
                        Image(systemName: "dumbbell.fill")
                            .foregroundStyle(.tint)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(active.name.isEmpty ? "Workout" : active.name)
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(detail)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 8)
                        if let elapsed = elapsed(at: context.date) {
                            Text(text.clock(elapsed))
                                .font(.headline)
                                .monospacedDigit()
                                .foregroundStyle(.primary)
                        }
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                            .accessibilityHidden(true)
                    }
                    .contentShape(Rectangle())
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(accessibility(at: context.date))
                }
            }
            .accessibilityHint(text("Öffnet das laufende Training", "Opens the workout in progress"))
        } header: {
            Text(text("Training läuft", "Workout in progress"))
        }
    }

    private var detail: String {
        guard let total = active.totalSets else { return text("Fortsetzen", "Resume") }
        let done = active.loggedSets ?? 0
        return text("\(done) von \(total) Sätzen erledigt", "\(done) of \(total) sets done")
    }

    private func elapsed(at date: Date) -> Double? {
        active.startedAt.map { max(0, date.timeIntervalSince1970 - $0 / 1000) }
    }

    private func accessibility(at date: Date) -> String {
        var parts = [active.name, detail]
        if let elapsed = elapsed(at: date) { parts.append(text("Dauer", "Duration") + " " + text.spokenDuration(elapsed)) }
        return parts.joined(separator: ", ")
    }
}

private struct IdentitySection: View {
    let identity: TrainingIdentity
    let text: TrainingText

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    if let level = identity.level {
                        Text(text("Level \(level)", "Level \(level)"))
                            .font(.headline)
                    }
                    Spacer(minLength: 8)
                    if let current = identity.current, let needed = identity.needed {
                        Text("\(text.number(current, digits: 0)) / \(text.number(needed, digits: 0)) XP")
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
                if let current = identity.current, let needed = identity.needed, needed > 0 {
                    ProgressView(value: min(max(current, 0), needed), total: needed)
                        .accessibilityHidden(true)
                }
                if let streak = identity.streak {
                    Label(streak == 1 ? text("1 Tag in Folge trainiert", "Trained 1 day in a row")
                                      : text("\(streak) Tage in Folge trainiert", "Trained \(streak) days in a row"),
                          systemImage: "flame")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 4)
            .accessibilityElement(children: .combine)
        }
    }
}

private struct StartSection: View {
    let training: TrainingProjection
    let text: TrainingText
    let canWrite: Bool
    let isStarting: Bool
    let start: (String) -> Void
    let startEmpty: () -> Void

    var body: some View {
        Section {
            if let nextID = training.recommendation?.nextRoutineId, let routine = training.routine(id: nextID) {
                Button {
                    start(routine.id)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "play.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.tint)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(text("Als Nächstes: \(routine.name)", "Up next: \(routine.name)"))
                                .font(.headline)
                                .foregroundStyle(.primary)
                            if let last = training.recommendation?.last {
                                Text(text("Zuletzt", "Last") + ": " + last.name + " · " + text.day(last.date, today: training.today))
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer(minLength: 8)
                        if isStarting { ProgressView() }
                    }
                    .contentShape(Rectangle())
                }
                .disabled(!canWrite || isStarting)
                .accessibilityHint(text("Startet diese Routine", "Starts this routine"))
            }
            Button(action: startEmpty) {
                Label(text("Freies Training", "Empty workout"), systemImage: "plus.circle")
            }
            .disabled(!canWrite || isStarting)
        } header: {
            Text(text("Training starten", "Start a workout"))
        }
    }
}

private struct RoutineRow: View {
    let routine: TrainingRoutine
    let text: TrainingText
    let canWrite: Bool
    let isActive: Bool
    let isStarting: Bool
    let isDeleting: Bool
    let start: () -> Void
    let edit: () -> Void
    let delete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: edit) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(routine.name.isEmpty ? text("Routine", "Routine") : routine.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(summary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .disabled(!canWrite || isDeleting)
            .accessibilityLabel(routine.name + ", " + summary)
            .accessibilityHint(text("Bearbeiten", "Edit"))
            Button(action: start) {
                Text(text("Starten", "Start"))
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 32)
            }
            .buttonStyle(.bordered)
            .disabled(!canWrite || isActive || isStarting)
            .accessibilityLabel(text("\(routine.name) starten", "Start \(routine.name)"))
        }
        .opacity(isDeleting ? 0.5 : 1)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if canWrite {
                Button(text("Löschen", "Delete"), role: .destructive, action: delete)
            }
        }
        .contextMenu {
            if canWrite {
                Button(action: start) { Label(text("Starten", "Start"), systemImage: "play") }
                    .disabled(isActive)
                Button(action: edit) { Label(text("Bearbeiten", "Edit"), systemImage: "pencil") }
                Button(role: .destructive, action: delete) { Label(text("Löschen", "Delete"), systemImage: "trash") }
            }
        }
        .accessibilityAction(named: text("Löschen", "Delete")) { if canWrite { delete() } }
    }

    private var summary: String {
        var parts = [text.exercises(routine.exerciseCount)]
        if let sets = routine.setCount { parts.append(text.sets(sets)) }
        return parts.joined(separator: " · ")
    }
}

private struct RecentSection: View {
    let training: TrainingProjection
    let text: TrainingText

    var body: some View {
        if !training.recent.isEmpty {
            Section {
                ForEach(training.recent) { workout in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(workout.name.isEmpty ? "Workout" : workout.name)
                            Spacer(minLength: 8)
                            Text(text.day(workout.date, today: training.today))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Text(detail(workout))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    .padding(.vertical, 2)
                    .accessibilityElement(children: .combine)
                }
            } header: {
                Text(text("Letzte Trainings", "Recent workouts"))
            }
        }
    }

    /// Werte wie vom Web geliefert (Dauer, Sätze, Volumen, XP); fehlende Dauer bleibt „nicht erfasst“.
    private func detail(_ workout: RecentWorkout) -> String {
        var parts: [String] = []
        parts.append(workout.durationSeconds.map(text.clock) ?? text("Dauer nicht erfasst", "Duration not recorded"))
        if let sets = workout.sets { parts.append(text.sets(sets)) }
        if let volume = workout.volume { parts.append(text.number(volume) + " kg") }
        if let xp = workout.xp, xp > 0 { parts.append("+" + text.number(xp, digits: 0) + " XP") }
        if workout.autoFinished { parts.append(text("automatisch beendet", "finished automatically")) }
        return parts.joined(separator: " · ")
    }
}
