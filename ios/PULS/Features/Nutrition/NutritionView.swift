import SwiftUI
import PULSCore

// Nativer Essen-Tab (M7/P1). Liest `ProfileStore.currentNutrition` (Web-Projektion `nutrition`) und für Ring/Balken die
// Übersichts-Projektion desselben Tags. Keine eigenen Ernährungsformeln: Summen, Reste, Prozent, Mikro-Abdeckung und
// Wasser (inkl. reiner Anzeigeschätzung) kommen fertig aus dem Web. Datum im gemeinsamen Seitenkopf (`ShellHeader`).

struct NutritionHost: View {
    let coordinator: NutritionCoordinator

    var body: some View {
        NutritionRoot(coordinator: coordinator)
            .environment(coordinator.store)
    }
}

private struct NutritionRoot: View {
    @Bindable var coordinator: NutritionCoordinator

    var body: some View {
        Group {
            if let projection = coordinator.projection {
                NutritionDiaryView(coordinator: coordinator, projection: projection)
            } else {
                NutritionLoadingView(text: coordinator.text, onShowWeb: coordinator.openWebDiary)
            }
        }
        .sheet(item: $coordinator.sheet) { sheet in
            NutritionSheetView(coordinator: coordinator, sheet: sheet)
        }
        .environment(\.locale, coordinator.text.locale)
        .tint(.blue)
    }
}

struct NutritionDiaryView: View {
    let coordinator: NutritionCoordinator
    let projection: NutritionProjection
    @Environment(ProfileStore.self) private var store

    var body: some View {
        let text = coordinator.text
        List {
            NutritionStatusSection(coordinator: coordinator, text: text)
            NutritionEnergySection(coordinator: coordinator, projection: projection, overview: sameDayOverview, text: text)
            NutritionAddSection(coordinator: coordinator, projection: projection, text: text)
            NutritionWaterSection(coordinator: coordinator, projection: projection, text: text)
            NutritionEntriesSection(coordinator: coordinator, projection: projection, text: text)
            NutritionDayCompleteSection(coordinator: coordinator, text: text)
            NutritionConflictSection(coordinator: coordinator, text: text)
            Section {
                Button(text("Vollständiges Tagebuch im Web", "Full diary in the web view")) { coordinator.openWebDiary() }
                // Plan-Ziele: nativer Plan im Konto-Tab; ohne natives Konto die Web-Planseite.
                Button(text("Kalorien- und Makroziele", "Calorie and macro goals")) { coordinator.openGoals() }
            } footer: {
                Text(text("Basiswerte sind Richtwerte pro 100 g. Marke, Zubereitung und Produkt können abweichen.",
                          "Base values are guide values per 100 g. Brand, preparation and product may differ."))
            }
        }
        .listStyle(.insetGrouped)
        .contentMargins(.top, 8, for: .scrollContent)
        .safeAreaInset(edge: .bottom) {
            if let undo = coordinator.undoStack.last {
                NutritionUndoBar(coordinator: coordinator, item: undo, text: text)
            }
        }
        .animation(.default, value: coordinator.undoStack.last?.id)
    }

    /// Ring/Balken der Übersicht nur, wenn sie denselben Tag zeigt (sonst ältere Werte eines anderen Tags).
    private var sameDayOverview: OverviewProjection? {
        guard let overview = store.currentProjection?.overview, overview.date == projection.date else { return nil }
        return overview
    }
}

// MARK: - Status und Hinweise

private struct NutritionStatusSection: View {
    let coordinator: NutritionCoordinator
    let text: OverviewText
    @Environment(ProfileStore.self) private var store

    var body: some View {
        let flags = coordinator.message?.flags ?? .none
        let offline = store.currentProjection?.overview.online == false
        if flags.preview || flags.recovery || flags.uploadBlocked || offline || coordinator.notice != nil {
            Section {
                if offline {
                    Label(text("Offline. Einträge bleiben auf diesem iPhone und werden später synchronisiert.",
                               "Offline. Entries stay on this iPhone and sync later."), systemImage: "wifi.slash")
                }
                if flags.preview {
                    Label(text("Vorschau: nur zur Ansicht.", "Preview: view only."), systemImage: "eye")
                }
                if flags.recovery {
                    Label(text("Wiederherstellung offen. Wähle zuerst in PULS den gewünschten Stand.",
                               "Recovery pending. Choose the version in PULS first."), systemImage: "lock")
                }
                if flags.uploadBlocked {
                    Label(text("Synchronisierung angehalten, bitte im Konto prüfen.", "Sync paused, please check Account."),
                          systemImage: "pause.circle")
                }
                if let notice = coordinator.notice {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Image(systemName: notice.isWarning ? "exclamationmark.triangle" : "info.circle")
                            .foregroundStyle(notice.isWarning ? Color.orange : Color.blue)
                            .accessibilityHidden(true)
                        Text(notice.text)
                        Spacer(minLength: 8)
                        Button {
                            coordinator.notice = nil
                        } label: {
                            Image(systemName: "xmark")
                                .frame(minWidth: 44, minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel(text("Hinweis schließen", "Dismiss notice"))
                    }
                }
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Energie und Makros

private struct NutritionEnergySection: View {
    let coordinator: NutritionCoordinator
    let projection: NutritionProjection
    let overview: OverviewProjection?
    let text: OverviewText
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .title) private var ringSize: CGFloat = 96

    var body: some View {
        Section {
            // Wie `nutritionSlides`: Seite 1 Energie & Makros, Seite 2 Mikronährstoffe (Wischen).
            if projection.micros.isEmpty {
                energyAndMacros
            } else {
                NutrientPager(text: text) {
                    energyAndMacros
                } second: {
                    MicroGrid(title: text("Mikronährstoffe & Ballaststoffe", "Micronutrients & fiber"),
                              cells: projection.micros.map { MicroCellModel(micro: $0, text: text) },
                              goalsTitle: text("Ziele", "Goals"),
                              goalsEnabled: coordinator.canWrite,
                              onGoals: { coordinator.present(.microGoals) })
                }
            }
        } footer: {
            if !projection.micros.isEmpty {
                Text(text("Zur Seite wischen für Mikronährstoffe. Ziele: eigene Werte vor Referenzwerten. Unbekannte Werte zählen nicht als 0.",
                          "Swipe for micronutrients. Goals: your own values before reference values. Unknown values do not count as 0."))
            }
        }
    }

    private var energyAndMacros: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let energy = overview?.energy {
                let layout = dynamicTypeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
                    : AnyLayout(HStackLayout(alignment: .center, spacing: 20))
                layout {
                    ring(energy)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(bigValue(energy))
                            .font(.title.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(energy.over ? AnyShapeStyle(.orange) : AnyShapeStyle(.primary))
                        Text(text.energyCaption(energy.captionKey))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 6)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(bigValue(energy) + " " + text.energyCaption(energy.captionKey) + ", "
                                    + eatenLine)
            } else {
                // Übersicht zeigt noch einen anderen Tag: nur Web-Summe und Web-Ziel, keine eigene Differenz.
                LabeledContent(text("Gegessen", "Eaten"), value: eatenLine)
                    .monospacedDigit()
            }
            ForEach(["p", "c", "f"], id: \.self) { key in
                macroRow(key)
            }
        }
        .padding(.vertical, 4)
    }

    private var eatenLine: String {
        let eaten = projection.totals.kcal.map { text.integer(JSMath.round($0)) } ?? "–"
        if let goal = projection.goals.values.kcal {
            return text("\(eaten) von \(text.integer(JSMath.round(goal))) kcal", "\(eaten) of \(text.integer(JSMath.round(goal))) kcal")
        }
        return eaten + " kcal"
    }

    private func bigValue(_ energy: EnergyFacts) -> String {
        guard let value = energy.displayValue else { return "–" }
        return (energy.over ? "+" : "") + text.integer(value) + " kcal"
    }

    private func ring(_ energy: EnergyFacts) -> some View {
        ZStack {
            Circle().stroke(Color(.systemFill), lineWidth: 10)
            Circle()
                .trim(from: 0, to: energy.ringFraction)
                .stroke(energy.over ? Color.orange : Color.blue, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text(projection.totals.kcal.map { text.integer(JSMath.round($0)) } ?? "–")
                .font(.headline)
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .padding(14)
        }
        .frame(width: ringSize, height: ringSize)
        .accessibilityHidden(true)
    }

    private func macroRow(_ key: String) -> some View {
        let bar = overview?.macros[key]
        let eaten = projection.totals[key]
        let goal = projection.goals.values[key]
        let value: String = {
            guard let eaten else { return "–" }
            // Gegessen ganzzahlig wie `dsMacroRows`, Ziel mit Web-Präzision.
            if let goal { return "\(text.integer(JSMath.round(eaten))) / \(text.number(goal)) g" }
            return "\(text.integer(JSMath.round(eaten))) g"
        }()
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(text.macroLabel(key))
                Spacer(minLength: 8)
                Text(value)
                    .monospacedDigit()
                    .foregroundStyle(bar?.over == true ? AnyShapeStyle(.orange) : AnyShapeStyle(.secondary))
            }
            .font(.subheadline)
            if let bar {
                ProgressView(value: bar.percent, total: 100)
                    .tint(bar.over ? .orange : .blue)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityValue(bar?.over == true ? text("über dem Ziel", "over target") : "")
    }
}

// MARK: - Hinzufügen

private struct NutritionAddSection: View {
    let coordinator: NutritionCoordinator
    let projection: NutritionProjection
    let text: OverviewText

    var body: some View {
        // Hauptknopf als eigener, randloser Abschnitt direkt unter der Energiekarte (wie „Essen eintragen“ in der
        // Übersicht); die weiteren Wege bilden darunter eine eigene Karte.
        Section {
            OverviewAddFoodButton(title: text("Essen hinzufügen", "Add food")) {
                coordinator.present(.search)
            }
            .disabled(!coordinator.canWrite || !coordinator.supportsSearch)
        }

        Section {
            entry(text("Barcode scannen", "Scan barcode"), symbol: "barcode.viewfinder", native: coordinator.nativeBarcode) {
                coordinator.present(.barcode)
            }
            entry(text("Nährwertfoto", "Nutrition label photo"), symbol: "camera", native: coordinator.nativeLabel) {
                coordinator.present(.label)
            }
            NutritionLinkRow(title: text("Meine Rezepte", "My recipes"), symbol: "frying.pan",
                             detail: projection.recipes.isEmpty ? nil : "\(projection.recipes.count + projection.omitted.recipes)") {
                coordinator.searchScopeRequest = .recipes
                coordinator.present(.search)
            }
            entry(text("Eigene Werte", "Custom values"), symbol: "square.and.pencil", native: coordinator.nativeProductSave) {
                coordinator.present(.custom)
            }
        } footer: {
            if !coordinator.nativeBarcode || !coordinator.nativeLabel || !coordinator.nativeProductSave {
                Text(text("Barcode, Foto und eigene Werte öffnen sich in PULS im Web-Dialog.",
                          "Barcode, photo and custom values open in the PULS web dialog."))
            }
        }
    }

    /// Native Abläufe erst mit P2; vorher derselbe Einstieg im Web-Dialog (kein toter Knopf).
    private func entry(_ title: String, symbol: String, native: Bool, action: @escaping () -> Void) -> some View {
        NutritionLinkRow(title: title, symbol: symbol, opensWeb: !native,
                         hint: native ? nil : text("Öffnet den Essensdialog von PULS", "Opens the PULS food dialog")) {
            if native { action() } else { coordinator.openWebAdd() }
        }
        .disabled(!coordinator.canWrite)
    }
}

/// Zeile mit Symbol, optionalem Wert und Chevron (bzw. Web-Hinweis).
struct NutritionLinkRow: View {
    let title: String
    let symbol: String
    var detail: String?
    var opensWeb = false
    var hint: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .foregroundStyle(.tint)
                    .frame(minWidth: 24)
                    .accessibilityHidden(true)
                Text(title)
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                if let detail {
                    Text(detail).foregroundStyle(.secondary).monospacedDigit()
                }
                Image(systemName: opensWeb ? "arrow.up.forward.square" : "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .accessibilityHint(hint ?? "")
    }
}

// MARK: - Wasser

private struct NutritionWaterSection: View {
    let coordinator: NutritionCoordinator
    let projection: NutritionProjection
    let text: OverviewText

    var body: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: "drop")
                    .foregroundStyle(.tint)
                    .frame(minWidth: 24)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(text("Wasser", "Water"))
                    Text(NutritionFormat.waterValue(projection.water, text: text))
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    if let detail = NutritionFormat.waterDetail(projection.water, text: text) {
                        Text(detail).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .accessibilityElement(children: .combine)
                Spacer(minLength: 8)
                // Kompakter Knopf direkt in der Wasserzeile (wie das Web-Glas „+250 ml“).
                if coordinator.pendingWaterCount > 0 {
                    ProgressView()
                        .controlSize(.small)
                        .accessibilityLabel(text("Wird gespeichert", "Saving"))
                }
                Button {
                    coordinator.addWater()
                } label: {
                    // Sichtbar klein, die Tippfläche bleibt 44 pt hoch (liegt im Label, sonst zählt nur die Kapsel).
                    Text("+250 ml")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .lineLimit(1)
                        .fixedSize()
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.15), in: Capsule())
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .disabled(!coordinator.canWrite)
                .accessibilityLabel(text("250 ml Wasser hinzufügen", "Add 250 ml of water"))
            }

            NutritionLinkRow(title: text("Wasserziel", "Water goal"), symbol: "target",
                             detail: projection.settings.waterGoal.flatMap { $0 > 0 ? text.number($0) + " ml" : nil }
                                ?? text("ohne Ziel", "no goal")) {
                coordinator.present(.waterGoal)
            }
            .disabled(!coordinator.canWrite)
        } footer: {
            if (projection.water?.estimated ?? 0) > 0 {
                Text(text("Schätzungen aus Getränke-Nährwerten werden nur angezeigt, nicht gespeichert.",
                          "Estimates from drink nutrients are only shown, never saved."))
            }
        }
    }
}

enum NutritionFormat {
    /// Unbekannt bleibt „unbekannt“, ein bekannter Nullwert bleibt „0“.
    static func waterValue(_ water: NutritionWater?, text: OverviewText) -> String {
        guard let water else { return "–" }
        switch water.knowledge {
        case .noEntries: return water.target.map { "– / \(text.number($0)) ml" } ?? "–"
        case .unknown: return text("unbekannt", "unknown")
        default:
            let value = water.value.map { text.number($0) } ?? "–"
            if let target = water.target { return "\(value) / \(text.number(target)) ml" }
            return value + " ml"
        }
    }

    static func waterDetail(_ water: NutritionWater?, text: OverviewText) -> String? {
        guard let water else { return nil }
        var parts: [String] = []
        if water.knowledge != .unknown, let note = text.knowledgeNote(water.knowledge) { parts.append(note) }
        if water.estimated > 0 {
            parts.append(text("davon \(text.number(water.estimated)) ml geschätzt", "incl. \(text.number(water.estimated)) ml estimated"))
        }
        if water.unknownDrinks > 0 {
            parts.append(water.unknownDrinks == 1
                         ? text("1 Getränk ohne Wasserwert", "1 drink without water value")
                         : text("\(water.unknownDrinks) Getränke ohne Wasserwert", "\(water.unknownDrinks) drinks without water value"))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    static func microValue(_ micro: NutritionMicro, text: OverviewText) -> String {
        let unit = micro.unit.map { " " + $0 } ?? ""
        switch micro.knowledge {
        case .noEntries: return micro.target.map { "– / \(text.number($0))\(unit)" } ?? "–"
        case .unknown: return text("unbekannt", "unknown")
        default:
            let value = micro.value.map { text.number($0) } ?? "–"
            if let target = micro.target { return "\(value) / \(text.number(target))\(unit)" }
            return value + unit
        }
    }

    /// Menge wie das Web-Tagebuch: `n(grams)` und Basis-Einheit.
    static func amount(_ entry: NutritionEntry, text: OverviewText) -> String? {
        entry.amount.map { "\(text.number($0)) \(entry.unit)" }
    }

    /// `P 10 · KH 10 · F 2 g` (bekannte Makros, Web `n()`).
    static func macros(p: Double?, c: Double?, f: Double?, text: OverviewText) -> String? {
        var parts: [String] = []
        if let p { parts.append(text("P", "P") + " " + text.number(p)) }
        if let c { parts.append(text("KH", "C") + " " + text.number(c)) }
        if let f { parts.append(text("F", "F") + " " + text.number(f)) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ") + " g"
    }

    /// Gespeicherte Mahlzeit (deutscher Datenwert) in der Anzeigesprache.
    static func meal(_ meal: String?, text: OverviewText) -> String? {
        switch meal {
        case "Frühstück": return text("Frühstück", "Breakfast")
        case "Mittagessen": return text("Mittagessen", "Lunch")
        case "Abendessen": return text("Abendessen", "Dinner")
        case "Snacks": return "Snacks"
        case let other?: return other.isEmpty ? nil : other
        default: return nil
        }
    }

    static func microLabel(_ micro: NutritionMicro, text: OverviewText) -> String {
        if text.isEnglish {
            switch micro.key {
            case "fiber": return "Fiber"
            case "iron": return "Iron"
            case "folate": return "Folate"
            case "potassium": return "Potassium"
            default: break
            }
        }
        return micro.label ?? micro.key
    }
}

// MARK: - Tagebuch

private struct NutritionEntriesSection: View {
    let coordinator: NutritionCoordinator
    let projection: NutritionProjection
    let text: OverviewText

    var body: some View {
        let entries = coordinator.visibleEntries
        Section {
            if entries.isEmpty {
                Text(text("Noch nichts erfasst. Tippe auf Essen hinzufügen.", "Nothing logged yet. Tap Add food."))
                    .foregroundStyle(.secondary)
            }
            ForEach(entries) { entry in
                NutritionEntryRow(entry: entry, text: text, isDeleting: coordinator.deletingEntryIds.contains(entry.id)) {
                    coordinator.present(.entry(entry.id))
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    if coordinator.canWrite, coordinator.supportsEntry {
                        Button(role: .destructive) {
                            Task { await coordinator.delete(entry) }
                        } label: {
                            Label(text("Löschen", "Delete"), systemImage: "trash")
                        }
                    }
                }
                .disabled(!coordinator.supportsEntry)
            }
            if projection.omitted.entries > 0 {
                Button(text("Alle \(projection.entryCount) im Web anzeigen", "Show all \(projection.entryCount) in the web view")) {
                    coordinator.openWebDiary()
                }
            }
        } header: {
            HStack {
                Text(text("Dein Essen", "Your food"))
                Spacer()
                Text("\(projection.entryCount)").monospacedDigit()
            }
        }
    }
}

private struct NutritionEntryRow: View {
    let entry: NutritionEntry
    let text: OverviewText
    let isDeleting: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.name.isEmpty ? text("Eintrag", "Entry") : entry.name)
                        .foregroundStyle(.primary)
                    let detail = [NutritionFormat.amount(entry, text: text),
                                  NutritionFormat.macros(p: entry.p, c: entry.c, f: entry.f, text: text)]
                        .compactMap { $0 }.joined(separator: " · ")
                    if !detail.isEmpty {
                        Text(detail).font(.footnote).foregroundStyle(.secondary).monospacedDigit()
                    }
                }
                Spacer(minLength: 8)
                if isDeleting {
                    ProgressView()
                } else {
                    // Wie das Web-Tagebuch `n(Math.round(kcal))`.
                    Text(entry.kcal.map { text.integer(JSMath.round($0)) + " kcal" } ?? "–")
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
            .contentShape(Rectangle())
        }
        .accessibilityHint(text("Menge ändern oder löschen", "Change amount or delete"))
    }
}

private struct NutritionUndoBar: View {
    let coordinator: NutritionCoordinator
    let item: NutritionUndo
    let text: OverviewText

    var body: some View {
        HStack(spacing: 12) {
            Text(text("„\(item.detail.name)“ gelöscht", "“\(item.detail.name)” deleted"))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button(text("Rückgängig", "Undo")) { coordinator.undo(item) }
                .font(.headline)
                .frame(minHeight: 44)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(.separator), lineWidth: 0.5))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .task(id: item.id) {
            // Wie das Web-Undo: nach einigen Sekunden ausblenden (der Befehl selbst bleibt unberührt).
            try? await Task.sleep(for: .seconds(8))
            if !Task.isCancelled { coordinator.dismissUndo(item) }
        }
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Tagesabschluss

private struct NutritionDayCompleteSection: View {
    let coordinator: NutritionCoordinator
    let text: OverviewText

    var body: some View {
        let done = coordinator.dayCompleteDisplayed
        Section {
            Button {
                coordinator.setDayComplete(!done)
            } label: {
                HStack {
                    Label(done ? text("Tag vollständig", "Day complete") : text("Tag als vollständig markieren", "Mark day as complete"),
                          systemImage: done ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(done ? AnyShapeStyle(.green) : AnyShapeStyle(.tint))
                    Spacer()
                    if coordinator.isDayCompletePending { ProgressView() }
                }
                .frame(minHeight: 36)
            }
            .disabled(!coordinator.canWrite || coordinator.isDayCompletePending)
            .accessibilityAddTraits(done ? .isSelected : [])
        } header: {
            Text(text("Erfassung abschließen", "Finish logging"))
        } footer: {
            Text(text("Nur markieren, wenn alle kalorienhaltigen Speisen und Getränke erfasst sind. Fehlende Tage werden nicht als 0 kcal behandelt.",
                      "Only mark when all foods and drinks with calories are logged. Missing days are not treated as 0 kcal."))
        }
    }
}

// Mikronährstoffe: Seite 2 der Energiekarte (`NutrientPager`, `MicroGrid`), Ziele über deren Knopf „Ziele“.

// MARK: - Konflikte

private struct NutritionConflictSection: View {
    let coordinator: NutritionCoordinator
    let text: OverviewText

    var body: some View {
        let conflicts = coordinator.conflicts
        if !conflicts.isEmpty {
            Section {
                ForEach(conflicts, id: \.command.id) { entry in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(coordinator.conflictTitle(entry)).font(.headline)
                        Text(text("Inzwischen anders gespeichert. Welcher Stand soll gelten?",
                                  "Saved differently in the meantime. Which version should apply?"))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                        HStack {
                            Button(text("Aktuellen Stand behalten", "Keep current")) {
                                coordinator.discardConflict(id: entry.command.id)
                            }
                            .buttonStyle(.bordered)
                            if ProfileStore.canReapplyNutrition(op: entry.command.op) {
                                Button(text("Meine Änderung übernehmen", "Apply my change")) {
                                    coordinator.reapplyConflict(id: entry.command.id)
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            } header: {
                Text(text("Nicht übernommen", "Not applied"))
            }
        }
    }
}

// MARK: - Laden

private struct NutritionLoadingView: View {
    let text: OverviewText
    let onShowWeb: () -> Void
    @State private var showsFallback = false

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text(text("Essen wird geladen …", "Loading food …"))
                .foregroundStyle(.secondary)
            if showsFallback {
                Button(text("Im Web öffnen", "Open in web view"), action: onShowWeb)
                    .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .task {
            try? await Task.sleep(for: .seconds(3))
            showsFallback = true
        }
    }
}
