import SwiftUI
import PULSCore

// Hybrid (Protokoll §16): Rückmeldungen nativer Fenster über der Web-Seite. Hinweise, „Rückgängig“ und geparkte Konflikte
// standen bisher in den nativen Tabs; die liegen im Hybrid verdeckt hinter der WebView und wären sonst unerreichbar.
// Die Ansicht sitzt direkt über der Tab-Leiste und ist ohne Inhalt 0 pt hoch, verdeckt die Seite also nie dauerhaft.

struct WebPagesOverlay: View {
    let store: ProfileStore
    let nutrition: NutritionCoordinator?
    let training: TrainingCoordinator?
    let progress: ProgressCoordinator?
    let activity: ActivityCoordinator?
    @State private var showsConflicts = false

    private struct Shown {
        let notice: TrainingNotice
        let clear: @MainActor () -> Void
    }

    private var text: OverviewText {
        OverviewText(language: store.document["language"]?.stringValue, locale: nil)
    }

    /// Ein Hinweis auf einmal; der nächste folgt, sobald dieser verschwunden ist.
    private var shown: Shown? {
        if let nutrition, let notice = nutrition.notice { return Shown(notice: notice) { nutrition.notice = nil } }
        if let training, let notice = training.notice { return Shown(notice: notice) { training.notice = nil } }
        if let activity, let notice = activity.notice { return Shown(notice: notice) { activity.notice = nil } }
        if let progress, let notice = progress.notice { return Shown(notice: notice) { progress.notice = nil } }
        return nil
    }

    private var conflictCount: Int {
        (nutrition?.conflicts.count ?? 0) + (training == nil ? 0 : store.trainingConflicts.count)
            + (progress?.conflicts.count ?? 0) + (activity?.conflicts.count ?? 0)
    }

    var body: some View {
        let text = text
        VStack(spacing: 8) {
            if conflictCount > 0 {
                Button {
                    showsConflicts = true
                } label: {
                    Label(text("Änderungen nicht übernommen", "Changes not applied"), systemImage: "exclamationmark.triangle")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .padding(.horizontal, 16)
                        .contentShape(Rectangle())
                }
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal, 16)
                .accessibilityHint(text("Zeigt, was entschieden werden muss", "Shows what needs a decision"))
            }
            if let shown {
                noticeBar(shown, text: text)
            }
            if let nutrition, let undo = nutrition.undoStack.last {
                NutritionUndoBar(coordinator: nutrition, item: undo, text: text)
            }
        }
        .frame(maxWidth: .infinity)
        .tint(.blue)
        .environment(\.locale, text.locale)
        .sheet(isPresented: $showsConflicts) {
            conflictSheet(text: text)
                .environment(store)
                .environment(\.locale, text.locale)
                .tint(.blue)
        }
    }

    private func noticeBar(_ shown: Shown, text: OverviewText) -> some View {
        let notice = shown.notice
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: notice.isWarning ? "exclamationmark.triangle" : "info.circle")
                .foregroundStyle(notice.isWarning ? Color.orange : Color.blue)
                .accessibilityHidden(true)
            Text(notice.text)
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                shown.clear()
            } label: {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.semibold))
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel(text("Hinweis schließen", "Dismiss"))
        }
        .padding(.leading, 16)
        .padding(.trailing, 4)
        .padding(.vertical, 4)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(.separator), lineWidth: 0.5))
        .padding(.horizontal, 16)
        .task(id: notice.id) { @MainActor in
            AccessibilityNotification.Announcement(notice.text).post()
            try? await Task.sleep(for: .seconds(6))
            if !Task.isCancelled { shown.clear() }
        }
    }

    private func conflictSheet(text: OverviewText) -> some View {
        NavigationStack {
            List {
                if let nutrition {
                    NutritionConflictSection(coordinator: nutrition, text: nutrition.text)
                }
                if let training {
                    TrainingConflictSection(coordinator: training, workoutId: nil, text: training.text)
                }
                if let progress {
                    ProgressConflictSection(coordinator: progress, text: progress.text)
                }
                if let activity, !activity.conflicts.isEmpty {
                    Section {
                        ForEach(activity.conflicts, id: \.command.id) { entry in
                            ActivityConflictRow(coordinator: activity, entry: entry, text: activity.text)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(text("Nicht übernommen", "Not applied"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Fertig", "Done")) { showsConflicts = false }
                }
            }
        }
    }
}
