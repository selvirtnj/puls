import SwiftUI
import UIKit
import Observation
import PULSCore

/// System-Teilen-Blatt für Text oder eine lokale Datei.
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// „Teilen“ über Query `share` (§15.7). Der Knopf erscheint nur, wenn der Aufrufer `offers(.share)` geprüft hat.
struct NativeShareButton: View {
    let coordinator: ExtrasCoordinator
    /// `workout` oder `run`.
    let collection: String
    let id: String
    let title: String
    @State private var isLoading = false
    @State private var failed = false
    @State private var share: ShareText?

    init(coordinator: ExtrasCoordinator, collection: String, id: String, title: String) {
        self.coordinator = coordinator
        self.collection = collection
        self.id = id
        self.title = title
    }

    var body: some View {
        let text = coordinator.text
        Button {
            Task { @MainActor in await load() }
        } label: {
            HStack {
                Label(title, systemImage: "square.and.arrow.up")
                if isLoading {
                    Spacer()
                    ProgressView()
                }
            }
        }
        .disabled(isLoading)
        .sheet(item: $share) { item in
            ShareSheet(items: [item.text])
        }
        .alert(text("Konnte nicht geladen werden", "Could not be loaded"), isPresented: $failed) {
            Button(text("OK", "OK"), role: .cancel) {}
        }
    }

    private func load() async {
        isLoading = true
        let content = await coordinator.shareText(collection: collection, id: id)
        isLoading = false
        if let content {
            share = ShareText(text: content)
        } else {
            failed = true
        }
    }
}

/// Export-Ablauf der Konto-Seite: Er gehört der Seite, nicht einer Listenzeile. Abbrechen stoppt ihn und löscht die Kopie.
@Observable
final class ExportController {
    private(set) var isLoading = false
    var failed = false
    var file: ExportFile?
    @ObservationIgnored private var task: Task<Void, Never>?

    @MainActor
    func run(_ coordinator: ExtrasCoordinator, csv: NativeCSVKind?) {
        guard !isLoading else { return }
        isLoading = true
        task = Task { @MainActor [weak self] in
            let url = await coordinator.exportFile(csv: csv)
            guard !Task.isCancelled, let self else {
                ExtrasCoordinator.removeExportFiles()
                return
            }
            self.isLoading = false
            self.task = nil
            if let url {
                self.file = ExportFile(url: url)
            } else {
                self.failed = true
            }
        }
    }

    /// Seite verlassen: nichts läuft weiter, keine Datei bleibt liegen.
    @MainActor
    func cancel() {
        task?.cancel()
        task = nil
        isLoading = false
        file = nil
        ExtrasCoordinator.removeExportFiles()
    }

    /// Die Kopie gehört nur dem Teilen-Blatt.
    func sheetClosed() {
        ExtrasCoordinator.removeExportFiles()
    }
}

/// Teilen-Blatt und Fehlermeldung des Exports; an der Seite, damit sie nicht mit einer Zeile aus der Liste fallen.
struct NativeExportPresenter: ViewModifier {
    @Bindable var controller: ExportController
    let text: OverviewText

    func body(content: Content) -> some View {
        content
            .sheet(item: $controller.file, onDismiss: { controller.sheetClosed() }) { item in
                ShareSheet(items: [item.url])
            }
            .alert(text("Export fehlgeschlagen", "Export failed"), isPresented: $controller.failed) {
                Button(text("OK", "OK"), role: .cancel) {}
            }
            .onDisappear { controller.cancel() }
    }
}

/// Export (§15.6): JSON-Sicherung und die vier CSV-Arten als lokale Datei im Teilen-Blatt. Kein Upload.
struct NativeExportRows: View {
    let coordinator: ExtrasCoordinator
    let controller: ExportController
    let text: OverviewText
    @State private var choosesCSV = false

    init(coordinator: ExtrasCoordinator, controller: ExportController, text: OverviewText) {
        self.coordinator = coordinator
        self.controller = controller
        self.text = text
    }

    private var isLoading: Bool { controller.isLoading }

    var body: some View {
        Button {
            run(csv: nil)
        } label: {
            HStack {
                Label(text("Sicherung exportieren (JSON)", "Export backup (JSON)"), systemImage: "square.and.arrow.up")
                    .foregroundStyle(Color.primary)
                if isLoading {
                    Spacer()
                    ProgressView()
                }
            }
        }
        .disabled(isLoading)
        Button {
            choosesCSV = true
        } label: {
            Label(text("CSV-Export", "CSV export"), systemImage: "tablecells")
                .foregroundStyle(Color.primary)
        }
        .disabled(isLoading)
        .confirmationDialog(text("CSV-Export", "CSV export"), isPresented: $choosesCSV, titleVisibility: .visible) {
            Button(text("Essen", "Food")) { run(csv: .foods) }
            Button(text("Workouts", "Workouts")) { run(csv: .workouts) }
            Button(text("Gewicht", "Weight")) { run(csv: .weights) }
            Button(text("Körpermaße", "Body measurements")) { run(csv: .measurements) }
            Button(text("Abbrechen", "Cancel"), role: .cancel) {}
        }
    }

    private func run(csv: NativeCSVKind?) {
        controller.run(coordinator, csv: csv)
    }
}
