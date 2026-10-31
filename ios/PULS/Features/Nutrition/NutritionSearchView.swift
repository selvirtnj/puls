import SwiftUI
import PULSCore

/// Bereiche der nativen Suche: Web-Filter `all|favorites|recent` plus gespeicherte Rezepte aus der Projektion.
/// Ziele im Such-Stack.
enum NutritionRoute: Hashable {
    case product(ProductRef)
    case custom
}

enum NutritionSearchScope: String, CaseIterable, Hashable {
    case all, favorites, recent, recipes

    var filter: NutritionQueryRequest.SearchFilter? {
        switch self {
        case .all: return .all
        case .favorites: return .favorites
        case .recent: return .recent
        case .recipes: return nil
        }
    }
}

/// Inhalt der Sheets des Essen-Tabs.
struct NutritionSheetView: View {
    let coordinator: NutritionCoordinator
    let sheet: NutritionSheet

    var body: some View {
        Group {
            switch sheet {
            case .search:
                NutritionSearchSheet(coordinator: coordinator)
            case .product(let ref):
                NavigationStack {
                    NutritionProductView(coordinator: coordinator, ref: ref)
                }
            case .entry(let id):
                NutritionEntrySheet(coordinator: coordinator, entryId: id)
            case .waterGoal:
                NutritionWaterGoalSheet(coordinator: coordinator)
            case .microGoals:
                NutritionMicroGoalsSheet(coordinator: coordinator)
            case .barcode:
                NutritionBarcodeFlow(coordinator: coordinator)
            case .label:
                NutritionLabelFlow(coordinator: coordinator)
            case .custom:
                NutritionCustomSheet(coordinator: coordinator)
            }
        }
        .environment(coordinator.store)
        .environment(\.locale, coordinator.text.locale)
        .tint(.blue)
    }
}

// MARK: - Suche

private struct SearchKey: Hashable {
    let query: String
    let scope: NutritionSearchScope
    let revision: String
}

struct NutritionSearchSheet: View {
    let coordinator: NutritionCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var scope: NutritionSearchScope = .all
    @State private var phase: LoadPhase<NutritionSearchResult> = .loading
    /// Letzte gültige Treffer bleiben während einer neuen Suche sichtbar (keine Platzhalter).
    @State private var shown: NutritionSearchResult?
    @State private var path: [NutritionRoute] = []

    var body: some View {
        let text = coordinator.text
        NavigationStack(path: $path) {
            List {
                Section {
                    Picker(text("Bereich", "Scope"), selection: $scope) {
                        Text(text("Alle", "All")).tag(NutritionSearchScope.all)
                        Text(text("Favoriten", "Favourites")).tag(NutritionSearchScope.favorites)
                        Text(text("Zuletzt", "Recent")).tag(NutritionSearchScope.recent)
                        Text(text("Rezepte", "Recipes")).tag(NutritionSearchScope.recipes)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                if scope == .recipes {
                    recipeRows(text)
                } else {
                    resultRows(text)
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: text("Lebensmittel suchen", "Search foods"))
            .navigationTitle(text("Essen hinzufügen", "Add food"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Schließen", "Close")) { dismiss() }
                }
            }
            .navigationDestination(for: NutritionRoute.self) { route in
                switch route {
                case .product(let ref):
                    NutritionProductView(coordinator: coordinator, ref: ref) { dismiss() }
                case .custom:
                    NutritionProductEditor(coordinator: coordinator, mode: .custom) { dismiss() }
                }
            }
        }
        .onAppear {
            if let requested = coordinator.searchScopeRequest {
                scope = requested
                coordinator.searchScopeRequest = nil
            }
        }
        .task(id: SearchKey(query: query, scope: scope, revision: coordinator.dataRevision)) {
            await search()
        }
    }

    /// Entprellt (250 ms); jede neue Eingabe bricht die laufende Task ab, ihre Anfrage wird aufgegeben und eine späte
    /// Antwort verworfen. Das Web wartet zusätzlich selbst 150 ms und löst ältere Suchen ab.
    private func search() async {
        guard let filter = scope.filter else { return }
        var trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        // Web-Grenze 100 UTF-16-Einheiten, ohne ein Zeichen zu trennen.
        while trimmed.utf16.count > 100 { trimmed.removeLast() }
        if !trimmed.isEmpty {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
        }
        phase = .loading
        let q = trimmed
        let answered = await coordinator.search({
            NutritionQueryRequest.search(q, filter: filter, limit: 60, requestId: $0)
        }) { result in
            guard !Task.isCancelled else { return }
            shown = result
            phase = result.isFinal ? .loaded(result) : .loading
        }
        guard !Task.isCancelled else { return }
        if !answered {
            phase = .failed
        } else if case .loading = phase, let shown {
            // Abgebrochener OFF-Teil ohne Schlussmeldung: lokale Treffer bleiben gültig.
            phase = .loaded(shown)
        }
    }
    @ViewBuilder
    private func resultRows(_ text: OverviewText) -> some View {
        Section {
            if let shown {
                if shown.items.isEmpty, phase != .loading {
                    Text(text("Keine lokalen Treffer.", "No local results."))
                        .foregroundStyle(.secondary)
                }
                ForEach(shown.items) { product in
                    NavigationLink(value: NutritionRoute.product(product.ref)) {
                        NutritionProductRow(product: product, text: text)
                    }
                }
            } else if phase == .loading {
                HStack { Spacer(); ProgressView(); Spacer() }
            }
            if phase == .failed {
                Button(text("Suche erneut versuchen", "Try search again")) {
                    Task { await search() }
                }
            }
        } header: {
            if phase == .loading, shown != nil {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini)
                    Text(text("Sucht …", "Searching …"))
                }
            } else if let shown, shown.omitted > 0 {
                Text(text("\(shown.items.count) von \(shown.total) Treffern", "\(shown.items.count) of \(shown.total) results"))
            }
        } footer: {
            if let shown {
                VStack(alignment: .leading, spacing: 6) {
                    if shown.offline {
                        Text(text("Offline: lokale Lebensmittel und Katalog.", "Offline: local foods and catalogue."))
                    }
                    if !shown.catalogueError.isEmpty {
                        Text(shown.catalogueError)
                    }
                    if !shown.onlineSupported {
                        Text(text("Online-Suche (Open Food Facts) und Barcode gibt es im Web-Dialog.",
                                  "Online search (Open Food Facts) and barcode are available in the web dialog."))
                    }
                    if !shown.attribution.isEmpty { Text(shown.attribution) }
                }
            }
        }
        if let shown, shown.onlineSupported, !shown.onlineItems.isEmpty || shown.onlineStatus != nil {
            onlineRows(shown, text: text)
        }
        Section {
            if coordinator.nativeBarcode {
                NutritionLinkRow(title: text("Barcode scannen", "Scan barcode"), symbol: "barcode.viewfinder") {
                    coordinator.present(.barcode)
                }
            }
            if coordinator.nativeProductSave {
                NavigationLink(value: NutritionRoute.custom) {
                    Label(text("Eigene Werte", "Custom values"), systemImage: "square.and.pencil")
                }
            }
            if !coordinator.nativeBarcode || !coordinator.nativeProductSave {
                NutritionLinkRow(title: text("Barcode, Foto oder eigene Werte", "Barcode, photo or custom values"),
                                 symbol: "square.and.pencil", opensWeb: true) {
                    coordinator.openWebAdd()
                }
            }
        }
    }

    /// OFF-Treffer getrennt von lokalen; immer prüfpflichtig, Quelle und ODbL-Hinweis sichtbar.
    @ViewBuilder
    private func onlineRows(_ shown: NutritionSearchResult, text: OverviewText) -> some View {
        Section {
            ForEach(shown.onlineItems) { product in
                NavigationLink(value: NutritionRoute.product(product.ref)) {
                    NutritionProductRow(product: product, text: text)
                }
            }
            if shown.onlineItems.isEmpty, let status = shown.onlineStatus {
                Text(onlineStatusText(status, text: text)).foregroundStyle(.secondary)
            }
        } header: {
            Text(shown.onlineAttribution?.name ?? "Open Food Facts")
        } footer: {
            if let attribution = shown.onlineAttribution {
                VStack(alignment: .leading, spacing: 4) {
                    if let privacy = attribution.privacy { Text(privacy) }
                    if let url = attribution.licenseUrl {
                        Link(text("Daten unter \(attribution.license ?? "ODbL")", "Data under \(attribution.license ?? "ODbL")"), destination: url)
                    }
                }
            }
        }
    }

    private func onlineStatusText(_ status: String, text: OverviewText) -> String {
        switch status {
        case "pending": return text("Open Food Facts wird durchsucht …", "Searching Open Food Facts …")
        case "offline": return text("Offline: keine Online-Suche.", "Offline: no online search.")
        case "rate_limited": return text("Kurz zu viele Anfragen. Es geht gleich automatisch weiter.", "Too many requests. Retrying shortly.")
        case "timeout": return text("Open Food Facts antwortet gerade nicht.", "Open Food Facts is not responding.")
        case "unavailable": return text("Online-Suche gerade nicht verfügbar.", "Online search unavailable right now.")
        case "skipped", "disabled": return text("Online-Suche ab 3 Zeichen.", "Online search from 3 characters.")
        default: return text("Keine Online-Treffer.", "No online results.")
        }
    }

    @ViewBuilder
    private func recipeRows(_ text: OverviewText) -> some View {
        let recipes = coordinator.projection?.recipes ?? []
        let omitted = coordinator.projection?.omitted.recipes ?? 0
        Section {
            if recipes.isEmpty {
                Text(text("Noch keine Rezepte.", "No recipes yet.")).foregroundStyle(.secondary)
            }
            ForEach(recipes) { recipe in
                NavigationLink(value: NutritionRoute.product(recipe.ref)) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(recipe.name.isEmpty ? text("Rezept", "Recipe") : recipe.name)
                        let detail = [
                            recipe.yield.map { text("fertig \(text.number($0)) g", "cooked \(text.number($0)) g") },
                            recipe.per100.kcal.map { text.integer(JSMath.round($0)) + " kcal / 100 g" },
                        ].compactMap { $0 }.joined(separator: " · ")
                        if !detail.isEmpty { Text(detail).font(.footnote).foregroundStyle(.secondary) }
                    }
                }
            }
            if omitted > 0 {
                Button(text("Weitere \(omitted) im Web", "\(omitted) more in the web view")) { coordinator.openWebAdd() }
            }
        } footer: {
            Text(text("Rezepte anlegen, bearbeiten und importieren im Web-Dialog.",
                      "Create, edit and import recipes in the web dialog."))
        }
        Section {
            NutritionLinkRow(title: text("Rezepte bearbeiten", "Edit recipes"), symbol: "frying.pan", opensWeb: true) {
                coordinator.openWebAdd()
            }
        }
    }
}

struct NutritionProductRow: View {
    let product: NutritionProduct
    let text: OverviewText

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Text(product.name.isEmpty ? text("Lebensmittel", "Food") : product.name)
                if product.favorite {
                    Image(systemName: "star.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .accessibilityLabel(text("Favorit", "Favourite"))
                }
            }
            Text(detail).font(.footnote).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    /// Marke · Quelle · kcal je 100 g/ml (Web `ffMeta`); unbekannte Werte bleiben unbekannt.
    private var detail: String {
        var parts: [String] = []
        if !product.brand.isEmpty { parts.append(product.brand) }
        if !product.source.isEmpty { parts.append(product.source) }
        parts.append((product.kcal.map { text.integer(JSMath.round($0)) } ?? "–") + " kcal / 100 " + product.unit)
        if product.reviewRequired { parts.append(text("ungeprüft", "unreviewed")) }
        return parts.joined(separator: " · ")
    }
}

/// P2: eigene Werte als eigenes Sheet (aus dem Essen-Tab).
private struct NutritionCustomSheet: View {
    let coordinator: NutritionCoordinator
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            NutritionProductEditor(coordinator: coordinator, mode: .custom, onDone: { dismiss() })
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(coordinator.text("Schließen", "Close")) { dismiss() }
                    }
                }
        }
    }
}