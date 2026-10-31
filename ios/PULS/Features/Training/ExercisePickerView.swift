import SwiftUI
import PULSCore

/// Auswahl im Übungspicker.
enum ExercisePick {
    /// Treffer der Web-Suche (Bibliothek oder Katalog).
    case item(ExerciseSearchMessage.Item)
    /// „Als eigene Übung hinzufügen“ (Web-Vorschlag `canCreate`).
    case newName(String)
}

/// Übungssuche über `pulsNativeExerciseSearch` (Web-Ranking mit Aliasen, Gerätefilter). Nimmt das Web die Suche
/// nicht an, sucht Native ersatzweise nur nach Namen in der eigenen Bibliothek aus der Projektion.
struct ExercisePickerView: View {
    let coordinator: TrainingCoordinator
    let title: String
    /// Bereits gewählte Bibliotheksübungen (Routinen enthalten jede Übung höchstens einmal).
    var excludedLibraryIDs: Set<String> = []
    let onPick: (ExercisePick) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var equipment = "all"
    @State private var requestID: String?
    @State private var usesLocalSearch = false

    private var text: TrainingText { coordinator.text }

    var body: some View {
        let text = self.text
        NavigationStack {
            List {
                Section {
                    Picker(text("Gerät", "Equipment"), selection: $equipment) {
                        Text(text("Alle", "All")).tag("all")
                        Text(text("Maschine", "Machine")).tag("machine")
                        Text(text("Kabel", "Cable")).tag("cable")
                        Text("Smith").tag("smith")
                    }
                    .pickerStyle(.segmented)
                    .disabled(usesLocalSearch)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                }
                content(text: text)
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: text("Übung suchen", "Search exercises"))
            .autocorrectionDisabled()
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
            }
            .task(id: "\(query)|\(equipment)") { @MainActor in
                // Kurz entprellen: eine Suche je Tipp-Pause, nicht je Tastendruck.
                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                coordinator.searchExercises(query: query, equipment: equipment) { id in
                    if let id {
                        requestID = id
                        usesLocalSearch = false
                    } else {
                        usesLocalSearch = true
                    }
                }
            }
        }
        .environment(\.locale, text.locale)
    }

    @ViewBuilder
    private func content(text: TrainingText) -> some View {
        if usesLocalSearch {
            let items = localItems
            Section {
                if items.isEmpty { Text(text("Keine Übung gefunden.", "No exercise found.")).foregroundStyle(.secondary) }
                ForEach(items) { item in row(item, text: text) }
                createRow(name: query, show: !query.trimmingCharacters(in: .whitespaces).isEmpty
                    && !items.contains { $0.name.localizedCaseInsensitiveCompare(query.trimmingCharacters(in: .whitespaces)) == .orderedSame },
                          text: text)
            } footer: {
                Text(text("Suche in PULS gerade nicht verfügbar: nur deine Bibliothek wird durchsucht.",
                          "Search in PULS is unavailable right now: only your library is searched."))
            }
        } else if let result = coordinator.store.exerciseSearch, result.requestId == requestID {
            Section {
                createRow(name: result.query, show: result.canCreate, text: text)
                if result.items.isEmpty { Text(text("Keine Übung gefunden.", "No exercise found.")).foregroundStyle(.secondary) }
                ForEach(result.items) { item in row(item, text: text) }
            } footer: {
                if result.total > result.items.count {
                    Text(text("\(result.total - result.items.count) weitere Treffer: Suche genauer eingeben.",
                              "\(result.total - result.items.count) more results: refine your search."))
                }
            }
        } else {
            Section {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .accessibilityLabel(text("Suche läuft", "Searching"))
            }
        }
    }

    private var localItems: [ExerciseSearchMessage.Item] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        let library = coordinator.training?.library ?? []
        return library
            .filter { trimmed.isEmpty || $0.name.localizedCaseInsensitiveContains(trimmed) }
            .map { entry in
                ExerciseSearchMessage.Item(id: entry.id, name: entry.name, muscles: entry.muscles,
                                           equipment: entry.equipment, inLibrary: true)
            }
    }

    private func row(_ item: ExerciseSearchMessage.Item, text: TrainingText) -> some View {
        let excluded = item.inLibrary && excludedLibraryIDs.contains(item.id)
        return Button {
            onPick(.item(item))
            dismiss()
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .foregroundStyle(.primary)
                    if let detail = detail(item, text: text) {
                        Text(detail)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer(minLength: 8)
                if excluded {
                    Image(systemName: "checkmark")
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(text("bereits enthalten", "already added"))
                } else if item.inLibrary {
                    Image(systemName: "bookmark.fill")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(text("in deiner Bibliothek", "in your library"))
                }
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .disabled(excluded)
    }

    private func detail(_ item: ExerciseSearchMessage.Item, text: TrainingText) -> String? {
        var parts: [String] = []
        if !item.muscles.isEmpty { parts.append(item.muscles.joined(separator: ", ")) }
        if let equipment = item.equipment, !equipment.isEmpty { parts.append(equipment) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func createRow(name: String, show: Bool, text: TrainingText) -> some View {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if show, !trimmed.isEmpty, trimmed.count <= 100 {
            Button {
                onPick(.newName(trimmed))
                dismiss()
            } label: {
                Label(text("„\(trimmed)“ als eigene Übung hinzufügen", "Add “\(trimmed)” as your own exercise"), systemImage: "plus")
            }
        }
    }
}
