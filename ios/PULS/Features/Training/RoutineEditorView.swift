import SwiftUI
import PULSCore

/// Routine erstellen/bearbeiten wie `routineForm` im Web: Name, Übungen aus der Bibliothek, Sätze, Wdh. von/bis,
/// Pause, Supersatz und Reihenfolge. Gespeichert wird die ganze rohe Routine per `routine.save` (unbekannte Felder
/// bleiben erhalten, `expect` = beim Öffnen gesehener Stand).
struct RoutineEditorView: View {
    let coordinator: TrainingCoordinator
    let isNew: Bool
    private let initial: RoutineDraft
    @State private var draft: RoutineDraft
    @State private var showsPicker = false
    @State private var showsDiscard = false
    @State private var conflictID: String?
    @State private var addingName: String?
    @Environment(\.dismiss) private var dismiss

    init(coordinator: TrainingCoordinator, draft: RoutineDraft, isNew: Bool) {
        self.coordinator = coordinator
        self.isNew = isNew
        initial = draft
        // Einmaliger Startwert des Entwurfs; spätere Projektionen ändern ihn nicht.
        _draft = State(initialValue: draft)
    }

    private var text: TrainingText { coordinator.text }
    private var isSaving: Bool { coordinator.isBusy("routine:" + draft.id) }
    private var hasChanges: Bool { draft != initial }

    var body: some View {
        let text = self.text
        NavigationStack {
            Form {
                Section {
                    TextField(text("Name", "Name"), text: $draft.name)
                        .textInputAutocapitalization(.sentences)
                        .submitLabel(.done)
                        .onChange(of: draft.name) { _, value in
                            if value.count > 80 { draft.name = String(value.prefix(80)) }
                        }
                } header: {
                    Text(text("Name", "Name"))
                }

                Section {
                    if draft.items.isEmpty {
                        Text(text("Füge Übungen zu deiner Routine hinzu.", "Add exercises to your routine."))
                            .foregroundStyle(.secondary)
                    }
                    ForEach($draft.items) { $item in
                        RoutineItemEditor(
                            item: $item,
                            index: draft.items.firstIndex(where: { $0.id == item.id }) ?? 0,
                            count: draft.items.count,
                            name: name(of: item.libraryId),
                            partners: draft.items.filter { $0.id != item.id }.map { RoutinePartner(id: $0.id, name: name(of: $0.libraryId)) },
                            partnerID: partnerID(of: item),
                            text: text,
                            move: { move(item.id, by: $0) },
                            setPartner: { partner in
                                draft.setSuperset(itemID: item.id, partnerID: partner) { UUID().uuidString.lowercased() }
                            },
                            remove: { draft.items.removeAll { $0.id == item.id } }
                        )
                    }
                    .onDelete { draft.items.remove(atOffsets: $0) }
                    Button {
                        showsPicker = true
                    } label: {
                        HStack {
                            Label(text("Übung hinzufügen", "Add exercise"), systemImage: "plus")
                            if let addingName {
                                Spacer()
                                ProgressView()
                                    .accessibilityLabel(text("\(addingName) wird angelegt", "Creating \(addingName)"))
                            }
                        }
                    }
                    .disabled(addingName != nil)
                } header: {
                    Text(text("Übungen", "Exercises"))
                } footer: {
                    Text(text("Sätze 1–12, Wiederholungen 1–100 (bis mindestens so hoch wie von), Pause bis 15 Minuten.",
                              "Sets 1–12, reps 1–100 (upper value at least the lower one), rest up to 15 minutes."))
                }
            }
            .navigationTitle(isNew ? text("Routine erstellen", "New routine") : text("Routine bearbeiten", "Edit routine"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) {
                        if hasChanges { showsDiscard = true } else { dismiss() }
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                    } else {
                        Button(text("Sichern", "Save"), action: save)
                            .disabled(!draft.isValid || !coordinator.canWrite)
                    }
                }
            }
            .sheet(isPresented: $showsPicker) {
                ExercisePickerView(
                    coordinator: coordinator,
                    title: text("Übung hinzufügen", "Add exercise"),
                    excludedLibraryIDs: Set(draft.items.map(\.libraryId)),
                    onPick: add
                )
            }
            .confirmationDialog(text("Änderungen verwerfen?", "Discard changes?"), isPresented: $showsDiscard, titleVisibility: .visible) {
                Button(text("Verwerfen", "Discard"), role: .destructive) { dismiss() }
                Button(text("Weiter bearbeiten", "Keep editing"), role: .cancel) {}
            }
            .alert(text("Routine wurde inzwischen geändert", "Routine was changed meanwhile"),
                   isPresented: Binding(get: { conflictID != nil }, set: { if !$0 { conflictID = nil } })) {
                Button(text("Meine Version speichern", "Save my version")) {
                    if let conflictID { coordinator.reapplyConflict(id: conflictID) }
                    dismiss()
                }
                Button(text("Andere Version behalten", "Keep other version"), role: .cancel) {
                    if let conflictID { coordinator.discardConflict(id: conflictID) }
                    dismiss()
                }
            } message: {
                Text(text("Die Routine wurde an anderer Stelle geändert. Welche Version soll gelten?",
                          "The routine was changed elsewhere. Which version should be kept?"))
            }
        }
        .interactiveDismissDisabled(hasChanges || isSaving)
        .environment(\.locale, text.locale)
    }

    private func name(of libraryID: String) -> String {
        coordinator.training?.libraryItem(id: libraryID)?.name
            ?? coordinator.training?.routine(id: draft.id)?.exercises.first { $0.libraryId == libraryID }?.name
            ?? text("Übung", "Exercise")
    }

    private func partnerID(of item: RoutineDraft.Item) -> String? {
        guard let group = item.superset else { return nil }
        return draft.items.first { $0.id != item.id && $0.superset == group }?.id
    }

    private func move(_ id: String, by delta: Int) {
        guard let index = draft.items.firstIndex(where: { $0.id == id }) else { return }
        let target = index + delta
        guard draft.items.indices.contains(target) else { return }
        draft.items.swapAt(index, target)
    }

    private func add(_ pick: ExercisePick) {
        switch pick {
        case .item(let item) where item.inLibrary:
            draft.append(libraryId: item.id, itemID: UUID().uuidString)
        case .item(let item):
            // Katalogeintrag: Routinen brauchen einen Bibliothekseintrag (gleichnamiger wird wiederverwendet).
            create(name: item.name)
        case .newName(let name):
            create(name: name)
        }
    }

    private func create(name: String) {
        addingName = name
        coordinator.createExercise(name: name) { libraryID in
            addingName = nil
            if let libraryID { draft.append(libraryId: libraryID, itemID: UUID().uuidString) }
        }
    }

    private func save() {
        guard draft.isValid else { return }
        let id = draft.id
        coordinator.saveRoutine(draft) { ok in
            if ok {
                dismiss()
            } else if let conflict = coordinator.store.trainingConflicts.first(where: {
                $0.command.op == TrainingOps.routineSave && $0.command.args["routine"]?["id"]?.stringValue == id
            }) {
                conflictID = conflict.command.id
            }
        }
    }
}

private struct RoutinePartner: Identifiable {
    let id: String
    let name: String
}

private struct RoutineItemEditor: View {
    @Binding var item: RoutineDraft.Item
    let index: Int
    let count: Int
    let name: String
    let partners: [RoutinePartner]
    let partnerID: String?
    let text: TrainingText
    let move: (Int) -> Void
    let setPartner: (String?) -> Void
    let remove: () -> Void

    private static let restOptions: [Int] = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 420, 600, 900]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(index + 1). \(name)")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                Menu {
                    Button { move(-1) } label: { Label(text("Nach oben", "Move up"), systemImage: "arrow.up") }
                        .disabled(index == 0)
                    Button { move(1) } label: { Label(text("Nach unten", "Move down"), systemImage: "arrow.down") }
                        .disabled(index >= count - 1)
                    Button(role: .destructive, action: remove) {
                        Label(text("Aus Routine entfernen", "Remove from routine"), systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.title3)
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(text("Aktionen für \(name)", "Actions for \(name)"))
            }
            Stepper(value: $item.sets, in: RoutineDraft.setsRange) {
                LabeledContent(text("Sätze", "Sets"), value: "\(item.sets)")
            }
            Stepper(value: Binding(get: { item.min }, set: { value in
                item.min = value
                if item.max < value { item.max = value }
            }), in: RoutineDraft.repsRange) {
                LabeledContent(text("Wdh. von", "Reps from"), value: "\(item.min)")
            }
            Stepper(value: $item.max, in: item.min...RoutineDraft.repsRange.upperBound) {
                LabeledContent(text("Wdh. bis", "Reps to"), value: "\(item.max)")
            }
            Picker(text("Pause", "Rest"), selection: $item.restSeconds) {
                Text(text("Standard", "Default")).tag(Int?.none)
                ForEach(restChoices, id: \.self) { seconds in
                    Text(text.rest(Double(seconds))).tag(Int?.some(seconds))
                }
            }
            Picker(text("Supersatz", "Superset"), selection: Binding(get: { partnerID }, set: { setPartner($0) })) {
                Text(text("Kein", "None")).tag(String?.none)
                ForEach(partners) { partner in
                    Text(text("mit \(partner.name)", "with \(partner.name)")).tag(String?.some(partner.id))
                }
            }
            .disabled(partners.isEmpty)
        }
        .padding(.vertical, 4)
    }

    private var restChoices: [Int] {
        var choices = Self.restOptions
        if let current = item.restSeconds, !choices.contains(current) {
            choices.append(current)
            choices.sort()
        }
        return choices
    }
}
