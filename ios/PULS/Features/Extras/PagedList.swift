import SwiftUI
import Observation
import PULSCore

/// Lädt eine Sammlung seitenweise (§15.3). Cursor bleiben im Speicher. Verfällt einer, auch mitten in einer übergroßen Zeile,
/// beginnt die ganze Liste sauber neu; kommt sie dabei nicht weiter, endet sie sichtbar als unvollständig statt im Kreis zu laden.
@Observable
@MainActor
final class PagedLoader {
    enum Phase: Equatable {
        case idle, loading, failed
        /// Die Sammlung bzw. ihr Ziel gibt es nicht mehr (z. B. gelöschte Übung).
        case gone
        /// Dieser Web-Stand liefert die Sammlung nicht.
        case unavailable
        /// Abbruch nach Kreislauf: Die Liste ist nachweislich nicht vollständig.
        case incomplete
    }

    private(set) var items: [JSONValue] = []
    private(set) var total: Int?
    private(set) var phase: Phase = .loading
    private(set) var hasMore = false

    @ObservationIgnored private let extras: ExtrasCoordinator
    @ObservationIgnored private let query: NativePageQuery
    @ObservationIgnored private var cursor: String?
    @ObservationIgnored private var restartGuard = PageRestartGuard()
    /// Neuer Wert verwirft Antworten laufender Durchläufe.
    @ObservationIgnored private var token = 0

    init(extras: ExtrasCoordinator, query: NativePageQuery) {
        self.extras = extras
        self.query = query
    }

    /// Von vorn; die bisherigen Zeilen bleiben bis zur ersten Antwort sichtbar.
    func reload() async {
        restartGuard = PageRestartGuard()
        await restart()
    }

    func loadMore() async {
        guard hasMore, phase == .idle else { return }
        token += 1
        await load(replacing: false, token: token)
    }

    private func restart() async {
        cursor = nil
        hasMore = false
        token += 1
        await load(replacing: true, token: token)
    }

    private func load(replacing: Bool, token current: Int) async {
        phase = .loading
        let position = cursor
        let query = query
        let answer = await extras.fetch { requestId in
            NativeQueryRequest.page(query, cursor: position, requestId: requestId)
        }
        guard current == token else { return }
        guard !Task.isCancelled else {
            phase = .idle
            return
        }
        switch answer {
        case .ok(let result):
            guard let page = NativePage(json: result) else {
                phase = .failed
                return
            }
            await apply(page, replacing: replacing, token: current)
        case .stale:
            await handleStale(reached: replacing ? 0 : items.count)
        case .gone:
            clear(.gone)
        case .unavailable:
            clear(.unavailable)
        case .failed:
            phase = .failed
        }
    }

    private func apply(_ page: NativePage, replacing: Bool, token current: Int) async {
        switch page {
        case .items(let rows, let total, let next):
            items = NativePageRows.merging(replacing ? [] : items, rows)
            self.total = total
            cursor = next
            hasMore = next != nil
            phase = .idle
        case .largeRow(let row):
            let query = query
            let index = row.itemIndex
            let content = await extras.assembleOnce(first: row.chunk) { position, requestId in
                NativeQueryRequest.pageItem(query, itemIndex: index, cursor: position, requestId: requestId)
            }
            guard current == token else { return }
            guard !Task.isCancelled else {
                phase = .idle
                return
            }
            switch content {
            case .loaded(let assembled):
                guard let value = assembled.parsed else {
                    phase = .failed
                    return
                }
                items = NativePageRows.merging(replacing ? [] : items, [value])
                total = row.total
                cursor = row.afterItemCursor
                hasMore = row.afterItemCursor != nil
                phase = .idle
            case .stale:
                // Die alte Fortsetzung gilt nicht mehr: nie dieselbe Zeile neu anhängen, sondern ganz neu aufsetzen.
                await handleStale(reached: (replacing ? 0 : items.count) + 1)
            case .gone:
                clear(.gone)
            case .failed:
                phase = .failed
            }
        }
    }

    private func handleStale(reached: Int) async {
        if restartGuard.allowsRestart(reached: reached) {
            await restart()
        } else {
            hasMore = false
            phase = .incomplete
        }
    }

    private func clear(_ outcome: Phase) {
        items = []
        total = nil
        cursor = nil
        hasMore = false
        phase = outcome
    }
}

/// Liste mit automatischem Nachladen am Ende. Reihenfolge und Inhalt kommen unverändert aus dem Web.
struct PagedList<Row: View>: View {
    let extras: ExtrasCoordinator
    let title: String
    let text: OverviewText
    /// Hinweis unter der Liste (z. B. Herkunft der Werte).
    let footer: String?
    private let row: (Int, JSONValue) -> Row
    @State private var loader: PagedLoader

    @MainActor
    init(extras: ExtrasCoordinator, query: NativePageQuery, title: String, text: OverviewText, footer: String? = nil,
         @ViewBuilder row: @escaping (Int, JSONValue) -> Row) {
        self.extras = extras
        self.title = title
        self.text = text
        self.footer = footer
        self.row = row
        _loader = State(initialValue: PagedLoader(extras: extras, query: query))
    }

    var body: some View {
        List {
            Section {
                ForEach(Array(loader.items.enumerated()), id: \.offset) { index, item in
                    row(index, item)
                }
                status
            } header: {
                if let total = loader.total {
                    Text(text("\(loader.items.count) von \(total)", "\(loader.items.count) of \(total)"))
                }
            } footer: {
                if let footer { Text(footer) }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: extras.dataRevision) { await loader.reload() }
    }

    @ViewBuilder
    private var status: some View {
        switch loader.phase {
        case .loading:
            HStack {
                Spacer()
                ProgressView()
                Spacer()
            }
        case .idle:
            if loader.items.isEmpty {
                Text(text("Keine Einträge.", "No entries.")).foregroundStyle(.secondary)
            } else if loader.hasMore {
                // Erscheint erst beim Scrollen ans Ende (Liste ist träge).
                Color.clear
                    .frame(height: 1)
                    .onAppear {
                        Task { @MainActor in await loader.loadMore() }
                    }
            }
        case .failed:
            Text(text("Konnte nicht geladen werden.", "Could not be loaded.")).foregroundStyle(.secondary)
            retryButton
        case .gone:
            Text(text("Das gibt es nicht mehr.", "This no longer exists.")).foregroundStyle(.secondary)
        case .unavailable:
            Text(text("Diese Liste ist in dieser PULS-Version nicht verfügbar.", "This list is not available in this PULS version."))
                .foregroundStyle(.secondary)
        case .incomplete:
            Label(text("Die Liste konnte nicht vollständig geladen werden. Es fehlen weitere Einträge.",
                       "The list could not be loaded completely. More entries are missing."), systemImage: "exclamationmark.triangle")
                .foregroundStyle(.secondary)
            retryButton
        }
    }

    private var retryButton: some View {
        Button(text("Erneut versuchen", "Try again")) {
            Task { @MainActor in await loader.reload() }
        }
    }
}
