import SwiftUI
import PULSCore

// Laufende Kraftsession (M4) im Vollbild über der WebView. Werte aus `ProfileStore.trainingSession` (Spiegel +
// offene Befehle, Vorher-Werte aus der Projektion). Eingaben je Satz werden erst bei Eingabeabschluss als **ein**
// `set.update` gesendet (Feld/Satz verlassen, „Weiter“/„Fertig“, Haken, Vorher übernehmen). Uhr und Restpause
// laufen lokal aus `startedAt` bzw. `rest.endAt`. Pausen-Mitteilung und Live-Aktivität steuert weiter das Web.

struct TrainingSessionHost: View {
    let coordinator: TrainingCoordinator
    let workoutId: String

    var body: some View {
        TrainingSessionView(coordinator: coordinator, workoutId: workoutId)
            .environment(coordinator.store)
    }
}

/// Ein Satz in der Session.
struct SetKey: Hashable {
    let exerciseId: String
    let index: Int
}

/// Ein Eingabefeld (kg oder Wdh.) eines Satzes.
struct SetField: Hashable {
    enum Kind: Hashable { case kg, reps }
    let key: SetKey
    let kind: Kind
}

/// Noch nicht gesendete Eingabe eines Satzes (`nil` = Feld unverändert).
private struct SetDraft {
    var kg: String?
    var reps: String?
}

private struct RemovalRequest: Identifiable {
    enum Kind { case exercise, lastSet }
    let id = UUID()
    let kind: Kind
    let exercise: TrainingSessionModel.Exercise
}

struct TrainingSessionView: View {
    let coordinator: TrainingCoordinator
    let workoutId: String

    @FocusState private var focus: SetField?
    @State private var drafts: [SetKey: SetDraft] = [:]
    @State private var showsFinish = false
    @State private var showsDiscard = false
    @State private var showsNothingDone = false
    @State private var showsPicker = false
    @State private var removal: RemovalRequest?
    @State private var doneFeedback = 0
    @State private var warningFeedback = 0

    private var store: ProfileStore { coordinator.store }
    private var text: TrainingText { coordinator.text }

    var body: some View {
        let text = self.text
        let session = store.trainingSession(workoutId: workoutId)
        NavigationStack {
            Group {
                if let session {
                    sessionList(session, text: text)
                } else {
                    SessionLoadingView(text: text,
                                       openWeb: { coordinator.fallBackToWeb(workoutId: workoutId) },
                                       close: { coordinator.minimize() })
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbar(session, text: text) }
        }
        .environment(\.locale, text.locale)
        .tint(.blue)
        .sensoryFeedback(.success, trigger: doneFeedback)
        .sensoryFeedback(.warning, trigger: warningFeedback)
        .onChange(of: focus) { old, new in
            // Satz verlassen = Eingabe abgeschlossen; Wechsel kg → Wdh. desselben Satzes sendet noch nichts.
            if let old, old.key != new?.key { commit(old.key) }
        }
        .onDisappear { commitAll() }
        .sheet(isPresented: $showsFinish) {
            if let session {
                FinishWorkoutSheet(session: session, text: text, isFinishing: coordinator.isBusy("finish")) { bodyweight in
                    coordinator.finish(workoutId: workoutId, bodyweight: bodyweight, confirmUnfinished: session.openSets > 0)
                }
            }
        }
        .sheet(isPresented: $showsPicker) {
            ExercisePickerView(coordinator: coordinator, title: text("Übung hinzufügen", "Add exercise")) { pick in
                switch pick {
                case .item(let item):
                    coordinator.perform(TrainingCommands.addExercise(workoutId: workoutId, libraryId: item.id))
                case .newName(let name):
                    coordinator.perform(TrainingCommands.addExercise(workoutId: workoutId, name: name))
                }
            }
        }
        .confirmationDialog(text("Training verwerfen?", "Discard workout?"), isPresented: $showsDiscard, titleVisibility: .visible) {
            Button(text("Verwerfen", "Discard"), role: .destructive) { coordinator.discard(workoutId: workoutId) }
            Button(text("Weiter trainieren", "Keep training"), role: .cancel) {}
        } message: {
            Text(text("Das Training und alle erfassten Sätze werden gelöscht.", "The workout and all logged sets will be deleted."))
        }
        .alert(text("Noch kein Satz abgehakt", "No set checked yet"), isPresented: $showsNothingDone) {
            Button(text("Weiter trainieren", "Keep training"), role: .cancel) {}
            Button(text("Training verwerfen", "Discard workout"), role: .destructive) { coordinator.discard(workoutId: workoutId) }
        } message: {
            Text(text("Schließe zuerst mindestens einen Satz ab oder verwirf das Training.",
                      "Complete at least one set first, or discard the workout."))
        }
        .confirmationDialog(
            removalTitle(text: text),
            isPresented: Binding(get: { removal != nil }, set: { if !$0 { removal = nil } }),
            titleVisibility: .visible,
            presenting: removal
        ) { request in
            Button(text("Entfernen", "Remove"), role: .destructive) { confirmRemoval(request) }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        } message: { request in
            Text(removalMessage(request, text: text))
        }
    }

    // MARK: Kopfzeile

    @ToolbarContentBuilder
    private func toolbar(_ session: TrainingSessionModel?, text: TrainingText) -> some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                commitAll()
                coordinator.minimize()
            } label: {
                Image(systemName: "chevron.down")
                    .font(.body.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(text("Training minimieren", "Minimize workout"))
        }
        ToolbarItem(placement: .principal) {
            if let session { SessionClock(session: session, text: text) }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            if let session {
                Menu {
                    Button(role: .destructive) { showsDiscard = true } label: {
                        Label(text("Training verwerfen", "Discard workout"), systemImage: "trash")
                    }
                    Button {
                        commitAll()
                        coordinator.fallBackToWeb(workoutId: workoutId)
                    } label: {
                        Label(text("In der Web-Ansicht öffnen", "Open in web view"), systemImage: "safari")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(text("Weitere Aktionen", "More actions"))
                Button(text("Beenden", "Finish")) {
                    commitAll()
                    focus = nil
                    if session.doneSets == 0 { showsNothingDone = true } else { showsFinish = true }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!coordinator.canWrite || coordinator.isBusy("finish"))
            }
        }
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button(text("Weiter", "Next")) { moveFocusForward(session) }
                .disabled(nextField(after: focus, in: session) == nil)
            Button(text("Fertig", "Done")) { focus = nil }
                .fontWeight(.semibold)
        }
    }

    // MARK: Inhalt

    private func sessionList(_ session: TrainingSessionModel, text: TrainingText) -> some View {
        let canWrite = coordinator.canWrite
        let structuralBusy = store.hasUnconfirmed { $0.args["workoutId"]?.stringValue == workoutId && Self.structuralOps.contains($0.op) }
        return List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.name.isEmpty ? "Workout" : session.name)
                        .font(.title2.bold())
                        .accessibilityAddTraits(.isHeader)
                    Text(summary(session, text: text))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }
            TrainingNoticeSection(coordinator: coordinator, text: text)
            statusSection(session, text: text, canWrite: canWrite)
            TrainingConflictSection(coordinator: coordinator, workoutId: workoutId, text: text)
            if let rest = session.rest {
                RestSection(rest: rest, text: text, canWrite: canWrite,
                            isBusy: store.hasUnconfirmed { $0.op == TrainingOps.restAdjust || $0.op == TrainingOps.restSkip },
                            exerciseName: rest.exerciseId.flatMap { session.exercise(id: $0)?.name },
                            adjust: { coordinator.perform(TrainingCommands.adjustRest(workoutId: workoutId, seconds: $0)) },
                            skip: { coordinator.perform(TrainingCommands.skipRest(workoutId: workoutId)) })
            }
            ForEach(Array(session.exercises.enumerated()), id: \.element.id) { index, exercise in
                exerciseSection(exercise, index: index, session: session, text: text, canWrite: canWrite,
                                structuralBusy: structuralBusy)
            }
            Section {
                Button {
                    commitAll()
                    showsPicker = true
                } label: {
                    HStack {
                        Label(text("Übung hinzufügen", "Add exercise"), systemImage: "plus")
                        if store.hasUnconfirmed({ $0.op == TrainingOps.exerciseAdd }) {
                            Spacer()
                            ProgressView()
                        }
                    }
                    .frame(minHeight: 44)
                }
                .disabled(!canWrite || structuralBusy)
            } footer: {
                Text(text("Der Resttimer startet beim Abhaken automatisch.", "The rest timer starts automatically when you check a set."))
            }
        }
        .listStyle(.insetGrouped)
        .scrollDismissesKeyboard(.interactively)
    }

    /// Ops, die Satz-/Übungsindizes verschieben: währenddessen keine weiteren Strukturänderungen.
    private static let structuralOps: Set<String> = [
        TrainingOps.setAdd, TrainingOps.setRemove, TrainingOps.exerciseAdd, TrainingOps.exerciseRemove,
        TrainingOps.exerciseMove, TrainingOps.supersetSet,
    ]

    private func summary(_ session: TrainingSessionModel, text: TrainingText) -> String {
        var parts = [text.exercises(session.exercises.count),
                     text("\(session.doneSets) von \(session.doneSets + session.openSets) Sätzen erledigt",
                          "\(session.doneSets) of \(session.doneSets + session.openSets) sets done")]
        if session.timeApprox { parts.append(text("Zeit ab Wiederaufnahme", "Time since resume")) }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func statusSection(_ session: TrainingSessionModel, text: TrainingText, canWrite: Bool) -> some View {
        if !canWrite || !session.isComplete || store.isWaitingForWebDialog {
            Section {
                if !canWrite {
                    Label(text("Gerade nur lesbar. Änderungen sind erst nach der Standwahl in PULS möglich.",
                               "Read only right now. Changes are possible after choosing the version in PULS."), systemImage: "lock")
                        .font(.subheadline)
                }
                if !session.isComplete {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(text("Nicht alle Werte lassen sich hier anzeigen.", "Not every value can be shown here."),
                              systemImage: "exclamationmark.triangle")
                            .font(.subheadline)
                        Button(text("In der Web-Ansicht öffnen", "Open in web view")) {
                            coordinator.fallBackToWeb(workoutId: workoutId)
                        }
                        .buttonStyle(.borderless)
                    }
                }
                if store.isWaitingForWebDialog {
                    VStack(alignment: .leading, spacing: 8) {
                        Label(text("In PULS ist noch ein Dialog offen. Die Änderung wird übernommen, sobald er geschlossen ist.",
                                   "A dialog is still open in PULS. The change is applied once it is closed."), systemImage: "hourglass")
                            .font(.subheadline)
                        Button(text("PULS anzeigen", "Show PULS")) {
                            commitAll()
                            coordinator.minimize()
                        }
                        .buttonStyle(.borderless)
                    }
                }
            }
        }
    }

    private func exerciseSection(_ exercise: TrainingSessionModel.Exercise, index: Int, session: TrainingSessionModel,
                                 text: TrainingText, canWrite: Bool, structuralBusy: Bool) -> some View {
        Section {
            ExerciseHeaderRow(
                exercise: exercise, index: index, count: session.exercises.count,
                partners: session.exercises.filter { $0.id != exercise.id },
                text: text, canWrite: canWrite && !structuralBusy,
                move: { delta in
                    commitAll()
                    coordinator.perform(TrainingCommands.moveExercise(workoutId: workoutId, exerciseId: exercise.id,
                                                                      toIndex: index + delta))
                },
                setPartner: { partner in
                    coordinator.perform(TrainingCommands.superset(workoutId: workoutId, exerciseId: exercise.id, partnerId: partner))
                },
                remove: {
                    commitAll()
                    removal = RemovalRequest(kind: .exercise, exercise: exercise)
                }
            )
            SetColumnsRow(text: text)
            ForEach(exercise.sets) { set in
                let key = SetKey(exerciseId: exercise.id, index: set.index)
                SetRow(
                    exerciseName: exercise.name, set: set, text: text,
                    canEdit: canWrite && set.isEditable,
                    kg: binding(key, .kg, current: set.kg, text: text),
                    reps: binding(key, .reps, current: set.reps, text: text),
                    focus: $focus, key: key,
                    toggleDone: { toggleDone(key, set: set) },
                    copyPrevious: { copyPrevious(key, set: set) }
                )
                .listRowBackground(set.done ? Color.green.opacity(0.12) : Color(.secondarySystemGroupedBackground))
            }
            HStack(spacing: 16) {
                Button {
                    commitAll()
                    coordinator.perform(TrainingCommands.addSet(workoutId: workoutId, exerciseId: exercise.id))
                } label: {
                    Label(text("Satz hinzufügen", "Add set"), systemImage: "plus")
                        .frame(minHeight: 44)
                }
                .disabled(!canWrite || structuralBusy)
                Spacer(minLength: 8)
                if exercise.sets.count > 1 {
                    Button(text("Letzten entfernen", "Remove last")) {
                        commitAll()
                        if exercise.sets.last?.done == true {
                            removal = RemovalRequest(kind: .lastSet, exercise: exercise)
                        } else {
                            coordinator.perform(TrainingCommands.removeLastSet(workoutId: workoutId, exerciseId: exercise.id))
                        }
                    }
                    .foregroundStyle(.red)
                    .disabled(!canWrite || structuralBusy)
                    .accessibilityLabel(text("Letzten Satz von \(exercise.name) entfernen", "Remove last set of \(exercise.name)"))
                }
            }
            .buttonStyle(.borderless)
        }
    }

    // MARK: Entfernen

    private func removalTitle(text: TrainingText) -> String {
        switch removal?.kind {
        case .lastSet?: return text("Abgeschlossenen letzten Satz entfernen?", "Remove the completed last set?")
        default: return text("Übung entfernen?", "Remove exercise?")
        }
    }

    private func removalMessage(_ request: RemovalRequest, text: TrainingText) -> String {
        switch request.kind {
        case .lastSet:
            return text("Der Satz wird aus \(request.exercise.name) gelöscht.", "The set is deleted from \(request.exercise.name).")
        case .exercise:
            let done = request.exercise.doneSets
            return done > 0
                ? text("\(request.exercise.name) und \(text.sets(done)) erledigt werden aus diesem Training entfernt.",
                       "\(request.exercise.name) and \(text.sets(done)) done are removed from this workout.")
                : text("\(request.exercise.name) wird aus diesem Training entfernt.", "\(request.exercise.name) is removed from this workout.")
        }
    }

    private func confirmRemoval(_ request: RemovalRequest) {
        switch request.kind {
        case .exercise:
            coordinator.perform(TrainingCommands.removeExercise(workoutId: workoutId, exerciseId: request.exercise.id))
        case .lastSet:
            coordinator.perform(TrainingCommands.removeLastSet(workoutId: workoutId, exerciseId: request.exercise.id))
        }
    }

    // MARK: Eingaben

    private func binding(_ key: SetKey, _ kind: SetField.Kind, current: SetValue?, text: TrainingText) -> Binding<String> {
        Binding(
            get: {
                let draft = drafts[key]
                switch kind {
                case .kg: return draft?.kg ?? SetInput.text(current, locale: text.locale)
                case .reps: return draft?.reps ?? SetInput.text(current, locale: text.locale)
                }
            },
            set: { value in
                var draft = drafts[key] ?? SetDraft()
                switch kind {
                case .kg: draft.kg = value
                case .reps: draft.reps = value
                }
                drafts[key] = draft
            }
        )
    }

    private func currentSet(_ key: SetKey) -> TrainingSessionModel.SessionSet? {
        guard let exercise = store.trainingSession(workoutId: workoutId)?.exercise(id: key.exerciseId),
              exercise.sets.indices.contains(key.index) else { return nil }
        return exercise.sets[key.index]
    }

    /// Entwurf prüfen: geänderte Werte (`nil` = unverändert) oder `nil` bei ungültiger Eingabe.
    private func parsedDraft(_ key: SetKey, set: TrainingSessionModel.SessionSet) -> (kg: SetValue?, reps: SetValue?)? {
        guard let draft = drafts[key] else { return (nil, nil) }
        var kg: SetValue?
        var reps: SetValue?
        if let input = draft.kg {
            guard let value = SetInput.kg(input) else { return nil }
            if value != set.kg { kg = value }
        }
        if let input = draft.reps {
            guard let value = SetInput.reps(input) else { return nil }
            if value != set.reps { reps = value }
        }
        return (kg, reps)
    }

    private func rejectInput(_ key: SetKey) {
        drafts[key] = nil
        warningFeedback += 1
        coordinator.notice = TrainingNotice(text: text("Ungültiger Wert: kg 0–1000, Wiederholungen 1–1000 als ganze Zahl.",
                                                       "Invalid value: kg 0–1000, reps 1–1000 as a whole number."))
    }

    /// Eingabe eines Satzes abschließen: genau ein `set.update` mit allen geänderten Feldern.
    private func commit(_ key: SetKey) {
        guard drafts[key] != nil else { return }
        guard let set = currentSet(key), set.isEditable else {
            drafts[key] = nil
            return
        }
        guard let parsed = parsedDraft(key, set: set) else { return rejectInput(key) }
        drafts[key] = nil
        guard parsed.kg != nil || parsed.reps != nil else { return }
        coordinator.perform(TrainingCommands.updateSet(workoutId: workoutId, exerciseId: key.exerciseId, setIndex: key.index,
                                                       kg: parsed.kg, reps: parsed.reps))
    }

    private func commitAll() {
        for key in Array(drafts.keys) { commit(key) }
    }

    /// Haken setzen/entfernen; offene Eingaben desselben Satzes gehen in dieselbe Op.
    private func toggleDone(_ key: SetKey, set: TrainingSessionModel.SessionSet) {
        guard let parsed = parsedDraft(key, set: set) else { return rejectInput(key) }
        let newDone = !set.done
        if newDone {
            let kg = parsed.kg ?? set.kg, reps = parsed.reps ?? set.reps
            guard let kg, !kg.isEmpty, let repsValue = reps?.number, repsValue >= 1 else {
                warningFeedback += 1
                coordinator.notice = TrainingNotice(text: text("Trage zuerst kg und Wiederholungen ein.", "Enter kg and reps first."))
                return
            }
        }
        drafts[key] = nil
        if focus?.key == key { focus = nil }
        coordinator.perform(TrainingCommands.updateSet(workoutId: workoutId, exerciseId: key.exerciseId, setIndex: key.index,
                                                       kg: parsed.kg, reps: parsed.reps, done: newDone))
        if newDone { doneFeedback += 1 }
    }

    /// Vorher-Werte übernehmen (rohe Werte, wie der Kopierknopf im Web); nie automatisch erledigt.
    private func copyPrevious(_ key: SetKey, set: TrainingSessionModel.SessionSet) {
        guard let previous = set.previous, previous.isCopyable, let kg = previous.kg, let reps = previous.reps else { return }
        drafts[key] = nil
        if focus?.key == key { focus = nil }
        let changedKg = kg != set.kg ? kg : nil, changedReps = reps != set.reps ? reps : nil
        guard changedKg != nil || changedReps != nil else { return }
        coordinator.perform(TrainingCommands.updateSet(workoutId: workoutId, exerciseId: key.exerciseId, setIndex: key.index,
                                                       kg: changedKg, reps: changedReps))
    }

    // MARK: Fokus

    private func fields(in session: TrainingSessionModel?) -> [SetField] {
        guard let session, coordinator.canWrite else { return [] }
        return session.exercises.flatMap { exercise in
            exercise.sets.filter(\.isEditable).flatMap { set -> [SetField] in
                let key = SetKey(exerciseId: exercise.id, index: set.index)
                return [SetField(key: key, kind: .kg), SetField(key: key, kind: .reps)]
            }
        }
    }

    private func nextField(after field: SetField?, in session: TrainingSessionModel?) -> SetField? {
        guard let field else { return nil }
        let all = fields(in: session)
        guard let index = all.firstIndex(of: field), index + 1 < all.count else { return nil }
        return all[index + 1]
    }

    private func moveFocusForward(_ session: TrainingSessionModel?) {
        focus = nextField(after: focus, in: session)
    }
}

// MARK: - Bausteine

/// Dauer im Kopf, lokal aus `startedAt` fortgeführt.
private struct SessionClock: View {
    let session: TrainingSessionModel
    let text: TrainingText

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let elapsed = session.elapsedSeconds(at: context.date)
            VStack(spacing: 0) {
                Text(session.name.isEmpty ? "Workout" : session.name)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(elapsed.map(text.clock) ?? "–")
                    .font(.headline)
                    .monospacedDigit()
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text("Dauer", "Duration") + " " + (elapsed.map(text.spokenDuration) ?? text("unbekannt", "unknown")))
        }
    }
}

/// Restpause, lokal aus `rest.endAt`. ±30 s und Überspringen als Ops; nach Ablauf nur ein Hinweis (das Web löscht
/// die Pause und spielt seinen Ton).
private struct RestSection: View {
    let rest: RestInfo
    let text: TrainingText
    let canWrite: Bool
    let isBusy: Bool
    let exerciseName: String?
    let adjust: (Int) -> Void
    let skip: () -> Void

    var body: some View {
        Section {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                RestContent(remaining: rest.remainingSeconds(at: context.date), text: text, canWrite: canWrite,
                            isBusy: isBusy, exerciseName: exerciseName, adjust: adjust, skip: skip)
            }
        }
    }
}

private struct RestContent: View {
    let remaining: Int
    let text: TrainingText
    let canWrite: Bool
    let isBusy: Bool
    let exerciseName: String?
    let adjust: (Int) -> Void
    let skip: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        let over = remaining <= 0
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
            : AnyLayout(HStackLayout(alignment: .center, spacing: 12))
        layout {
            VStack(alignment: .leading, spacing: 2) {
                Text(over ? text("Pause vorbei", "Rest over") : text("Pause", "Rest"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(over ? text("Bereit für den nächsten Satz", "Ready for the next set") : text.clock(Double(remaining)))
                    .font(over ? .headline : .title.weight(.semibold))
                    .monospacedDigit()
                if let exerciseName, !over {
                    Text(exerciseName)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(over ? text("Pause vorbei", "Rest over")
                                     : text("Pause", "Rest") + " " + text.spokenDuration(Double(remaining)))
            if !over {
                Spacer(minLength: 8)
                HStack(spacing: 8) {
                    Button(text("−30 s", "−30 s")) { adjust(-30) }
                        .accessibilityLabel(text("Pause 30 Sekunden kürzer", "Rest 30 seconds shorter"))
                    Button(text("+30 s", "+30 s")) { adjust(30) }
                        .accessibilityLabel(text("Pause 30 Sekunden länger", "Rest 30 seconds longer"))
                    Button(text("Überspringen", "Skip")) { skip() }
                }
                .buttonStyle(.bordered)
                .font(.subheadline.weight(.semibold))
                .disabled(!canWrite || isBusy)
            }
        }
        .padding(.vertical, 4)
        .sensoryFeedback(trigger: over) { old, new -> SensoryFeedback? in
            new && !old ? SensoryFeedback.impact(weight: .medium) : nil
        }
        .onChange(of: over) { _, isOver in
            if isOver { AccessibilityNotification.Announcement(text("Pause vorbei", "Rest over")).post() }
        }
    }
}

private struct ExerciseHeaderRow: View {
    let exercise: TrainingSessionModel.Exercise
    let index: Int
    let count: Int
    let partners: [TrainingSessionModel.Exercise]
    let text: TrainingText
    let canWrite: Bool
    let move: (Int) -> Void
    let setPartner: (String?) -> Void
    let remove: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(index + 1). \(exercise.name)")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Text(details)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if !exercise.supersetWith.isEmpty {
                    Label(text("Supersatz mit ", "Superset with ") + partnerNames, systemImage: "link")
                        .font(.footnote)
                        .foregroundStyle(.tint)
                }
            }
            Spacer(minLength: 8)
            Menu {
                Button { move(-1) } label: { Label(text("Nach oben", "Move up"), systemImage: "arrow.up") }
                    .disabled(index == 0)
                Button { move(1) } label: { Label(text("Nach unten", "Move down"), systemImage: "arrow.down") }
                    .disabled(index >= count - 1)
                if !partners.isEmpty {
                    Menu {
                        ForEach(partners) { partner in
                            Button {
                                setPartner(partner.id)
                            } label: {
                                if exercise.supersetWith.contains(partner.id) {
                                    Label(partner.name, systemImage: "checkmark")
                                } else {
                                    Text(partner.name)
                                }
                            }
                        }
                        if exercise.superset != nil {
                            Button(text("Kein Supersatz", "No superset")) { setPartner(nil) }
                        }
                    } label: {
                        Label(text("Supersatz", "Superset"), systemImage: "link")
                    }
                }
                Button(role: .destructive, action: remove) {
                    Label(text("Übung entfernen", "Remove exercise"), systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .disabled(!canWrite)
            .accessibilityLabel(text("Aktionen für \(exercise.name)", "Actions for \(exercise.name)"))
        }
    }

    private var partnerNames: String {
        exercise.supersetWith.compactMap { id in partners.first { $0.id == id }?.name }.joined(separator: ", ")
    }

    private var details: String {
        var parts: [String] = []
        parts.append(exercise.previousDate.map { text("Letztes Training: ", "Last workout: ") + text.day($0, today: nil) }
                     ?? text("Noch kein vorheriges Training", "No previous workout yet"))
        if let range = text.repRange(min: exercise.repMin, max: exercise.repMax) { parts.append(range) }
        if let rest = exercise.effectiveRestSeconds { parts.append(text("Pause ", "Rest ") + text.rest(rest)) }
        return parts.joined(separator: " · ")
    }
}

/// Spaltenköpfe wie im Web (Satz · Vorher · kg · Wdh. · ✓). Für VoiceOver tragen die Felder eigene Beschriftungen.
private struct SetColumnsRow: View {
    let text: TrainingText
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        if !dynamicTypeSize.isAccessibilitySize {
            HStack(spacing: 8) {
                Text(text("Satz", "Set")).frame(width: SetRow.indexWidth, alignment: .leading)
                Text(text("Vorher", "Previous")).frame(maxWidth: .infinity, alignment: .leading)
                Text("kg").frame(width: SetRow.kgWidth)
                Text(text("Wdh.", "Reps")).frame(width: SetRow.repsWidth)
                Image(systemName: "checkmark").frame(width: SetRow.checkWidth)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)
        }
    }
}

private struct SetRow: View {
    static let indexWidth: CGFloat = 28
    static let kgWidth: CGFloat = 76
    static let repsWidth: CGFloat = 60
    static let checkWidth: CGFloat = 44

    let exerciseName: String
    let set: TrainingSessionModel.SessionSet
    let text: TrainingText
    let canEdit: Bool
    let kg: Binding<String>
    let reps: Binding<String>
    let focus: FocusState<SetField?>.Binding
    let key: SetKey
    let toggleDone: () -> Void
    let copyPrevious: () -> Void
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(text("Satz \(set.index + 1)", "Set \(set.index + 1)")).font(.headline)
                    Spacer()
                    doneButton
                }
                previousButton
                HStack(spacing: 8) {
                    field(kg, kind: .kg, placeholder: "kg")
                    field(reps, kind: .reps, placeholder: text("Wdh.", "Reps"))
                }
            }
            .padding(.vertical, 4)
        } else {
            HStack(spacing: 8) {
                Text("\(set.index + 1)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: Self.indexWidth, alignment: .leading)
                    .accessibilityHidden(true)
                previousButton
                    .frame(maxWidth: .infinity, alignment: .leading)
                field(kg, kind: .kg, placeholder: "–")
                    .frame(width: Self.kgWidth)
                field(reps, kind: .reps, placeholder: "–")
                    .frame(width: Self.repsWidth)
                doneButton
                    .frame(width: Self.checkWidth)
            }
        }
    }

    private var label: String {
        text("\(exerciseName), Satz \(set.index + 1)", "\(exerciseName), set \(set.index + 1)")
    }

    @ViewBuilder
    private var previousButton: some View {
        let shown = text.previous(set.previous)
        if let previous = set.previous, previous.isCopyable, canEdit, !set.done {
            Button(action: copyPrevious) {
                Text(shown)
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(label + ", " + text("vorher", "previous") + " " + shown)
            .accessibilityHint(text("Übernimmt die Vorher-Werte", "Copies the previous values"))
        } else {
            Text(shown)
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(.tertiary)
                .lineLimit(1)
                .accessibilityLabel(label + ", " + text("vorher", "previous") + " " + (set.previous == nil ? text("keine Werte", "none") : shown))
        }
    }

    private func field(_ value: Binding<String>, kind: SetField.Kind, placeholder: String) -> some View {
        TextField(placeholder, text: value)
            .keyboardType(kind == .kg ? .decimalPad : .numberPad)
            .multilineTextAlignment(.center)
            .font(.body.monospacedDigit())
            .padding(.horizontal, 6)
            .frame(minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color(.tertiarySystemFill)))
            .focused(focus, equals: SetField(key: key, kind: kind))
            .disabled(!canEdit)
            .accessibilityLabel(label + ", " + (kind == .kg ? "kg" : text("Wiederholungen", "reps")))
    }

    private var doneButton: some View {
        Button(action: toggleDone) {
            Image(systemName: set.done ? "checkmark.circle.fill" : "circle")
                .font(.title2)
                .foregroundStyle(set.done ? Color.green : Color.secondary)
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .disabled(!canEdit)
        .accessibilityLabel(label + ", " + text("erledigt", "done"))
        .accessibilityValue(set.done ? text("abgehakt", "checked") : text("nicht abgehakt", "not checked"))
        .accessibilityAddTraits(set.done ? AccessibilityTraits.isSelected : [])
    }
}

/// Noch keine Daten für diese Session: Ladeansicht, nach etwa 3 s Web-Ausweg.
private struct SessionLoadingView: View {
    let text: TrainingText
    let openWeb: () -> Void
    let close: () -> Void
    @State private var isSlow = false

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(text("Training wird geladen …", "Loading workout …"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if isSlow {
                Button(text("In der Web-Ansicht öffnen", "Open in web view"), action: openWeb)
                    .buttonStyle(.borderedProminent)
                Button(text("Schließen", "Close"), action: close)
                    .buttonStyle(.bordered)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .task {
            try? await Task.sleep(for: .seconds(3))
            isSlow = true
        }
    }
}
