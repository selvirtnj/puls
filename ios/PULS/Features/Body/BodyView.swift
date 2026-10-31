import SwiftUI
import PULSCore

/// Nativer Bereich „Körper & Gewicht“ (M2). Liest aus `ProfileStore.document`, schreibt nur per
/// `store.perform` mit `weight.upsert` / `weight.delete`. „Körpermaße & Körperfett“ bleibt im Web.
struct BodyView: View {
    @Environment(ProfileStore.self) private var store

    let onClose: () -> Void
    /// Schließt das Sheet und öffnet den Web-Bereich (`pulsNativeNavigate`, `web:true`).
    let onOpenWeb: () -> Void

    @State private var editor: WeightEditorRequest?
    @State private var range: WeightRange = .days90
    @State private var undo: DeletedWeight?
    @State private var alertMessage: String?
    @State private var activeConflict: OutboxEntry?
    @State private var savedCount = 0
    @State private var deletedCount = 0

    var body: some View {
        let text = BodyText(document: store.document)
        NavigationStack {
            Group {
                if store.hasDocument {
                    content(text: text)
                } else {
                    BodyLoadingView(text: text, onOpenWeb: onOpenWeb)
                }
            }
            .navigationTitle(text("Körper & Gewicht", "Body & weight"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Fertig", "Done"), action: onClose)
                }
                if store.hasDocument {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            openEditor(nil)
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel(text("Gewicht eintragen", "Log weight"))
                        .disabled(!BodyAccess.of(store, text: text).canEdit)
                    }
                }
            }
            .alert(
                text("Hinweis", "Notice"),
                isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(alertMessage ?? "")
            }
        }
        .tint(.blue)
        .environment(\.locale, text.locale)
        // ISO-Tage und Datumsauswahl immer gregorianisch, unabhängig vom Gerätekalender.
        .environment(\.calendar, WeightDay.calendar())
        .sheet(item: $editor) { request in
            WeightEditorSheet(request: request, text: text) { date, kg in
                save(request, date: date, kg: kg, text: text)
            }
        }
        .alert(
            text("Gewicht auf anderem Gerät geändert", "Weight changed on another device"),
            isPresented: Binding(get: { activeConflict != nil && alertMessage == nil }, set: { if !$0 { activeConflict = nil } }),
            presenting: activeConflict
        ) { conflict in
            Button(text("Wert vom anderen Gerät behalten", "Keep the other device's value"), role: .cancel) {
                keepOther(conflict, text: text)
            }
            Button(conflict.command.op == BridgeOps.weightDelete ? text("Trotzdem löschen", "Delete anyway")
                                                                 : text("Meinen Wert übernehmen", "Use my value")) {
                useMine(conflict, text: text)
            }
        } message: { conflict in
            Text(conflictMessage(conflict, text: text))
        }
        .sensoryFeedback(.success, trigger: savedCount)
        .sensoryFeedback(.impact(weight: .light), trigger: deletedCount)
        .onChange(of: store.notice, initial: true) { _, notice in
            handle(notice, text: text)
        }
        .onChange(of: conflictIDs, initial: true) { _, _ in
            showNextConflict()
        }
        .onChange(of: store.userId) { _, _ in
            // Kontowechsel: Sheet, Rückgängig und Konfliktdialog gehören zum alten Konto.
            editor = nil
            undo = nil
            scheduleNextConflict()
        }
        .onChange(of: alertMessage) { _, message in
            // Ein Hinweis hatte den Konfliktdialog verdrängt: danach wieder zeigen.
            if message == nil { scheduleNextConflict() }
        }
    }

    // MARK: Inhalt

    @ViewBuilder
    private func content(text: BodyText) -> some View {
        let data = BodyData(document: store.document, today: WeightDay.string(from: Date()))
        let access = BodyAccess.of(store, text: text)
        let pendingIDs = pendingUpsertIDs
        List {
            if case .readOnly(let reason) = access {
                Section {
                    Label(reason, systemImage: "lock")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                BodySummaryView(data: data, text: text)
            } footer: {
                let status = BodySyncStatus.of(store, text: text)
                Label(status.label, systemImage: status.symbol)
                    .font(.footnote)
            }

            if !data.trend.isEmpty {
                Section {
                    Picker(text("Zeitraum", "Range"), selection: $range) {
                        ForEach(WeightRange.allCases) { option in
                            Text(option.label(text))
                                .accessibilityLabel(option.spokenLabel(text))
                                .tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowSeparator(.hidden)

                    let visible = range.filter(data.trend, today: data.today)
                    if visible.isEmpty {
                        Text(text("Keine Messwerte in diesem Zeitraum.", "No measurements in this range."))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        WeightChartView(points: visible, text: text)
                            .padding(.vertical, 4)
                    }
                } header: {
                    Text(text("Verlauf", "History"))
                } footer: {
                    Text(text("Exponentielle Glättung mit 7-Tage-Zeitkonstante; keine erfundenen Messungen.",
                              "Exponential smoothing with a 7-day time constant; no invented measurements."))
                }
            }

            if !data.weeks.isEmpty {
                Section(text("Wochenmittel", "Weekly average")) {
                    let weeks = Array(data.weeks.prefix(4))
                    ForEach(Array(weeks.enumerated()), id: \.element.id) { index, week in
                        WeekRow(week: week, previous: index + 1 < data.weeks.count ? data.weeks[index + 1] : nil, text: text)
                    }
                }
            }

            Section {
                if data.entries.isEmpty {
                    ContentUnavailableView {
                        Label(text("Noch kein Gewicht", "No weight yet"), systemImage: "scalemass")
                    } description: {
                        Text(text("Trag dein Gewicht ein, dann erscheinen hier Verlauf und Wochenmittel.",
                                  "Log your weight to see history and weekly averages here."))
                    } actions: {
                        if access.canEdit {
                            Button(text("Gewicht eintragen", "Log weight")) { openEditor(nil) }
                                .buttonStyle(.borderedProminent)
                        }
                    }
                } else {
                    ForEach(data.entries) { entry in
                        WeightRow(entry: entry, isPending: pendingIDs.contains(entry.id), canEdit: access.canEdit, text: text) {
                            openEditor(entry)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                            if access.canEdit {
                                Button(role: .destructive) {
                                    delete(entry, text: text)
                                } label: {
                                    Label(text("Löschen", "Delete"), systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            } header: {
                Text(text("Einträge", "Entries"))
            }

            Section {
                Button(action: onOpenWeb) {
                    HStack {
                        Label(text("Körpermaße & Körperfett", "Measurements & body fat"), systemImage: "ruler")
                            .foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                            .accessibilityHidden(true)
                    }
                }
                .accessibilityHint(text("Öffnet den Bereich in PULS", "Opens the section in PULS"))
            }
        }
        .listStyle(.insetGrouped)
        .safeAreaInset(edge: .bottom) {
            if let undo {
                UndoBar(
                    message: text("Gelöscht: \(text.kg(undo.entry.kg)), \(text.day(undo.entry.date))",
                                  "Deleted: \(text.kg(undo.entry.kg)), \(text.day(undo.entry.date))"),
                    actionTitle: text("Rückgängig", "Undo")
                ) {
                    undoDelete(text: text)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.easeOut(duration: 0.2), value: undo)
        .task(id: undo?.token) {
            guard undo != nil else { return }
            try? await Task.sleep(for: .seconds(6))
            guard !Task.isCancelled else { return }
            undo = nil
        }
    }

    // MARK: Ableitungen

    private var pendingUpsertIDs: Set<String> {
        Set(store.outboxEntries.compactMap { entry in
            guard entry.status == .pending, entry.command.op == BridgeOps.weightUpsert else { return nil }
            return entry.command.args["id"]?.stringValue
        })
    }

    /// Nur Konflikte des aktuellen Kontos (`ProfileStore.weightConflicts`).
    private var conflictIDs: [String] {
        store.weightConflicts.map(\.command.id)
    }

    // MARK: Aktionen

    private func openEditor(_ entry: WeightEntry?) {
        let text = BodyText(document: store.document)
        guard BodyAccess.of(store, text: text).canEdit else { return }
        editor = WeightEditorRequest(
            original: entry,
            userId: store.userId,
            seen: WeightEntry.entries(in: store.document),
            initialDate: entry.flatMap { WeightDay.date(from: $0.date) } ?? Date(),
            initialText: entry.map { text.number($0.kg) } ?? ""
        )
    }

    private static func newID() -> String {
        UUID().uuidString.lowercased()
    }

    /// Wie `addWeight`: immer neue ID; `expect` aus dem Stand beim Öffnen, Konto muss noch dasselbe sein.
    private func save(_ request: WeightEditorRequest, date: Date, kg: Double, text: BodyText) -> String? {
        let command: Command
        if let original = request.original {
            command = WeightCommands.edit(original: original, kg: kg, newID: Self.newID())
        } else {
            command = WeightCommands.add(date: WeightDay.string(from: date), kg: kg, newID: Self.newID(), seen: request.seen)
        }
        do {
            try store.performWeight(command, asUser: request.userId)
            savedCount += 1
            return nil
        } catch {
            return text.message(for: error)
        }
    }

    private func delete(_ entry: WeightEntry, text: BodyText) {
        let userId = store.userId
        do {
            try store.performWeight(WeightCommands.delete(entry), asUser: userId)
            deletedCount += 1
            undo = DeletedWeight(entry: entry, userId: userId)
            AccessibilityNotification.Announcement(text("Eintrag gelöscht", "Entry deleted")).post()
        } catch {
            alertMessage = text.message(for: error)
        }
    }

    /// Stellt den gelöschten Eintrag mit derselben ID wieder her, aber nie über einen neueren Eintrag
    /// (gleicher Tag oder gleiche ID mit anderem Datum) und nie unter einem anderen Konto.
    private func undoDelete(text: BodyText) {
        guard let deleted = undo else { return }
        undo = nil
        guard let command = WeightCommands.restore(deleted.entry, current: WeightEntry.entries(in: store.document)) else {
            alertMessage = text.message(for: WeightCommandError.restoreBlocked)
            return
        }
        do {
            try store.performWeight(command, asUser: deleted.userId)
            savedCount += 1
        } catch {
            alertMessage = text.message(for: error)
        }
    }

    // MARK: Konflikte und Hinweise

    private func showNextConflict() {
        guard activeConflict == nil || !conflictIDs.contains(activeConflict?.command.id ?? "") else { return }
        activeConflict = store.weightConflicts.first
    }

    private func keepOther(_ conflict: OutboxEntry, text: BodyText) {
        do {
            try store.keepOtherWeight(conflictID: conflict.command.id, asUser: conflict.command.userId)
        } catch {
            alertMessage = text.message(for: error)
        }
        scheduleNextConflict()
    }

    /// Neuer Befehl mit frischem `expect` aus der aktuellen Anzeige, danach den geparkten verwerfen (im Store,
    /// der das Konto erneut prüft).
    private func useMine(_ conflict: OutboxEntry, text: BodyText) {
        do {
            try store.useMineWeight(conflictID: conflict.command.id, asUser: conflict.command.userId)
            if conflict.command.op == BridgeOps.weightUpsert { savedCount += 1 } else { deletedCount += 1 }
        } catch {
            alertMessage = text.message(for: error)
        }
        scheduleNextConflict()
    }

    /// Nächsten Konflikt erst nach dem Ausblenden des aktuellen Dialogs zeigen.
    private func scheduleNextConflict() {
        activeConflict = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(400))
            showNextConflict()
        }
    }

    private func conflictMessage(_ conflict: OutboxEntry, text: BodyText) -> String {
        let args = conflict.command.args
        let current = WeightEntry.entries(in: store.document)
        if conflict.command.op == BridgeOps.weightUpsert,
           let date = args["date"]?.stringValue, let kg = args["kg"]?.doubleValue {
            let other = current.first { $0.date == date }
            let otherText = other.map { text.kg($0.kg) } ?? text("kein Eintrag", "no entry")
            return text(
                "\(text.day(date)): Dein Wert \(text.kg(kg)) wurde nicht gespeichert. Anderes Gerät: \(otherText).",
                "\(text.day(date)): your value \(text.kg(kg)) was not saved. Other device: \(otherText)."
            )
        }
        let id = args["id"]?.stringValue ?? ""
        if let other = current.first(where: { $0.id == id }) {
            return text(
                "Der Eintrag vom \(text.day(other.date)) wurde auf einem anderen Gerät geändert (\(text.kg(other.kg))) und deshalb nicht gelöscht.",
                "The entry from \(text.day(other.date)) was changed on another device (\(text.kg(other.kg))) and was not deleted."
            )
        }
        return text("Der Eintrag wurde auf einem anderen Gerät geändert und deshalb nicht gelöscht.",
                    "The entry was changed on another device and was not deleted.")
    }

    private func handle(_ notice: StoreNotice?, text: BodyText) {
        guard let notice else { return }
        switch notice {
        case .commandRejected(_, let op, let message) where BodyOps.isWeight(op):
            alertMessage = text("Nicht gespeichert", "Not saved") + (message.map { ": \($0)" } ?? ".")
            store.clearNotice()
        case .commandParked(_, let op, let code) where BodyOps.isWeight(op):
            alertMessage = code == .wrongUser
                ? text("Der Eintrag gehört zu einem anderen Konto und wurde zurückgehalten.",
                       "The entry belongs to another account and was held back.")
                : text("Diese PULS-Version kann den Eintrag gerade nicht speichern. Er bleibt erhalten.",
                       "This PULS version cannot save the entry right now. It is kept.")
            store.clearNotice()
        case .commandConflict(_, let op) where BodyOps.isWeight(op):
            // Entscheidung läuft über `store.conflicts` (Dialog).
            store.clearNotice()
        case .outboxProblem:
            alertMessage = text("Offene Änderungen konnten nicht gelesen werden.", "Pending changes could not be read.")
            store.clearNotice()
        default:
            break
        }
    }
}

// MARK: - Bausteine

private struct BodySummaryView: View {
    let data: BodyData
    let text: BodyText

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(data.latest != nil ? text("Aktuelles Gewicht", "Current weight") : text("Profilgewicht", "Profile weight"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(data.currentWeight.map { text.kg($0) } ?? "–")
                .font(.largeTitle.weight(.semibold))
                .monospacedDigit()
            Text(data.latest.map { text("Zuletzt erfasst am \(text.day($0.date))", "Last logged on \(text.day($0.date))") }
                 ?? text("Noch kein Gewichtseintrag", "No weight logged yet"))
                .font(.footnote)
                .foregroundStyle(.secondary)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 28) { metrics }
                VStack(alignment: .leading, spacing: 8) { metrics }
            }
            .padding(.top, 6)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var metrics: some View {
        metric(text("Trend", "Trend"), data.trend.last.map { text.kg(WeightMath.round1($0.trend), maxDigits: 1) } ?? "–")
        metric(text("Wochenmittel", "Weekly average"), data.latestWeek.map { text.kg(WeightMath.round1($0.kg), maxDigits: 1) } ?? "–")
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
                .monospacedDigit()
        }
    }
}

private struct WeekRow: View {
    let week: WeeklyWeight
    let previous: WeeklyWeight?
    let text: BodyText

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(text("Woche ab \(text.day(week.weekStart))", "Week of \(text.day(week.weekStart))"))
                Text(text.measurements(week.count))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: 2) {
                Text(text.kg(WeightMath.round1(week.kg), maxDigits: 1))
                    .monospacedDigit()
                if let previous {
                    Text(text.signedKg(WeightMath.round1(week.kg - previous.kg)))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct WeightRow: View {
    let entry: WeightEntry
    let isPending: Bool
    let canEdit: Bool
    let text: BodyText
    let onEdit: () -> Void

    var body: some View {
        if canEdit {
            Button(action: onEdit) { label }
                .accessibilityHint(text("Bearbeiten", "Edit"))
        } else {
            label
        }
    }

    private var label: some View {
        HStack(spacing: 8) {
            Text(text.shortDay(entry.date))
                .foregroundStyle(.primary)
            Spacer(minLength: 12)
            if isPending {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .accessibilityLabel(text("wird gespeichert", "saving"))
            }
            Text(text.kg(entry.kg))
                .monospacedDigit()
                .foregroundStyle(.primary)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

private struct UndoBar: View {
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(message)
                .font(.subheadline)
                .lineLimit(2)
            Spacer(minLength: 8)
            Button(actionTitle, action: action)
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: 44)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color(.separator), lineWidth: 0.5)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

/// Noch kein Spiegel/Snapshot: Lade-Ansicht, nach etwa 3 s zusätzlich „Im Web öffnen“.
private struct BodyLoadingView: View {
    let text: BodyText
    let onOpenWeb: () -> Void
    @State private var isSlow = false

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(text("PULS lädt dein Gewicht …", "PULS is loading your weight …"))
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            if isSlow {
                Button(text("Im Web öffnen", "Open on the web"), action: onOpenWeb)
                    .buttonStyle(.bordered)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .task {
            try? await Task.sleep(for: .seconds(3))
            isSlow = true
        }
    }
}
