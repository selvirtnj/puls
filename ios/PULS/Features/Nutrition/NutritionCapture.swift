import SwiftUI
import UIKit
import PhotosUI
import ImageIO
import Vision
import VisionKit
import PULSCore

// P2: Kamera und Vision. Native liefert ausschließlich den Barcode-String bzw. geordnete Textzeilen. Prüfziffer, Lookup
// (lokal vor OFF), Etikett-Parsing, Warnungen und Speichern bleiben Web (§12.5). Keine Bilddaten an das Web.

// MARK: - Barcode

struct NutritionBarcodeFlow: View {
    let coordinator: NutritionCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var path: [String] = []
    @State private var manual = ""
    @State private var scannerAvailable = false

    var body: some View {
        let text = coordinator.text
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                if scannerAvailable {
                    BarcodeScannerView { code in
                        guard path.isEmpty else { return }
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        path = [code]
                    }
                    .ignoresSafeArea(edges: .bottom)
                    .accessibilityLabel(text("Kamerabild für den Barcode", "Camera view for the barcode"))
                } else {
                    ContentUnavailableView(text("Scanner nicht verfügbar", "Scanner unavailable"), systemImage: "barcode.viewfinder",
                                           description: Text(text("Kamerazugriff erlauben oder den Code eintippen.",
                                                                  "Allow camera access or type the code.")))
                }
                manualEntry(text)
            }
            .navigationTitle(text("Barcode scannen", "Scan barcode"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Schließen", "Close")) { dismiss() }
                }
            }
            .onAppear { scannerAvailable = DataScannerViewController.isSupported && DataScannerViewController.isAvailable }
            .navigationDestination(for: String.self) { code in
                NutritionProductView(coordinator: coordinator, ref: .barcode(code)) { dismiss() }
            }
        }
    }

    /// Ausweg ohne Kamera: Code eintippen (nur Ziffern, höchstens 40; die Prüfziffer prüft das Web).
    private func manualEntry(_ text: OverviewText) -> some View {
        HStack(spacing: 8) {
            TextField(text("Code eintippen", "Type code"), text: $manual)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .monospacedDigit()
            Button(text("Suchen", "Look up")) {
                let code = manual.filter(\.isNumber)
                guard (8...14).contains(code.count) else { return }
                path = [code]
            }
            .buttonStyle(.borderedProminent)
            .disabled(!(8...14).contains(manual.filter(\.isNumber).count))
        }
        .padding(16)
        .background(Color(.systemGroupedBackground))
    }
}

/// VisionKit-Scanner für Produktcodes (EAN-8/13, UPC-E, ITF-14). Meldet den ersten gelesenen Code.
private struct BarcodeScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean8, .ean13, .upce, .itf14])],
            qualityLevel: .balanced, recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false, isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        context.coordinator.onCode = onCode
        if !scanner.isScanning { try? scanner.startScanning() }
    }

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    @MainActor
    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var onCode: (String) -> Void

        init(onCode: @escaping (String) -> Void) {
            self.onCode = onCode
        }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            for item in addedItems {
                if case .barcode(let barcode) = item, let code = barcode.payloadStringValue?.filter(\.isNumber), !code.isEmpty {
                    onCode(code)
                    return
                }
            }
        }
    }
}

// MARK: - Nährwertfoto

private struct LabelRoute: Hashable {
    let lines: [String]
}

struct NutritionLabelFlow: View {
    let coordinator: NutritionCoordinator
    @Environment(\.dismiss) private var dismiss
    @State private var path: [LabelRoute] = []
    @State private var pickerItem: PhotosPickerItem?
    @State private var showsCamera = false
    @State private var working = false
    @State private var message: String?
    @State private var parses: [LabelRoute: NutritionLabelParse] = [:]

    var body: some View {
        let text = coordinator.text
        NavigationStack(path: $path) {
            List {
                Section {
                    if UIImagePickerController.isSourceTypeAvailable(.camera) {
                        Button {
                            showsCamera = true
                        } label: {
                            Label(text("Etikett fotografieren", "Photograph label"), systemImage: "camera")
                        }
                    }
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label(text("Foto auswählen", "Choose photo"), systemImage: "photo")
                    }
                } footer: {
                    Text(text("Der Text wird auf dem iPhone gelesen. Nur der Text geht an PULS, kein Bild.",
                              "Text is read on this iPhone. Only the text goes to PULS, never the image."))
                }
                if working {
                    Section { HStack { ProgressView(); Text(text("Etikett wird gelesen …", "Reading label …")) } }
                }
                if let message {
                    Section { Text(message).foregroundStyle(.secondary) }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(text("Nährwertfoto", "Nutrition label photo"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Schließen", "Close")) { dismiss() }
                }
            }
            .navigationDestination(for: LabelRoute.self) { route in
                if let parse = parses[route] {
                    NutritionProductEditor(coordinator: coordinator, mode: .label(lines: route.lines, parse: parse, column: 0),
                                           onDone: { dismiss() })
                }
            }
        }
        .fullScreenCover(isPresented: $showsCamera) {
            CameraPicker { image in
                showsCamera = false
                if let image { Task { await read(image) } }
            }
            .ignoresSafeArea()
        }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    await read(image)
                } else {
                    message = text("Foto konnte nicht geladen werden.", "Could not load the photo.")
                }
                pickerItem = nil
            }
        }
    }

    private func read(_ image: UIImage) async {
        let text = coordinator.text
        working = true
        message = nil
        defer { working = false }
        let lines = await LabelTextReader.lines(from: image)
        guard !lines.isEmpty else {
            message = text("Kein Text erkannt. Bitte näher und gerade fotografieren.", "No text recognised. Please photograph closer and straight.")
            return
        }
        let result = await coordinator.fetch { NutritionQueryRequest.labelParse(lines: lines, column: 0, requestId: $0) }
        guard case .loaded(let answer) = result, case .labelParse(let parse)? = answer.result else {
            message = text("Etikett konnte nicht ausgewertet werden.", "Could not evaluate the label.")
            return
        }
        let route = LabelRoute(lines: lines)
        parses[route] = parse
        path = [route]
    }
}

/// Vision-Texterkennung, Zeilen in Lesereihenfolge (oben nach unten, je Zeile links nach rechts).
enum LabelTextReader {
    static func lines(from image: UIImage) async -> [String] {
        guard let cgImage = image.cgImage else { return [] }
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        return await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["de-DE", "en-US"]
            // Zahlen und Einheiten nicht „korrigieren“.
            request.usesLanguageCorrection = false
            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation)
            guard (try? handler.perform([request])) != nil else { return [] }
            let pieces = (request.results ?? []).compactMap { observation -> (box: CGRect, text: String)? in
                guard let text = observation.topCandidates(1).first?.string, !text.isEmpty else { return nil }
                return (observation.boundingBox, text)
            }
            return order(pieces)
        }.value
    }

    /// Fasst Stücke mit überlappender Höhe zu einer Zeile zusammen (Vision-Koordinaten: Ursprung unten links).
    static func order(_ pieces: [(box: CGRect, text: String)]) -> [String] {
        let sorted = pieces.sorted { $0.box.midY > $1.box.midY }
        var rows: [[(box: CGRect, text: String)]] = []
        for piece in sorted {
            if let last = rows.last?.first, abs(last.box.midY - piece.box.midY) < max(last.box.height, piece.box.height) * 0.5 {
                rows[rows.count - 1].append(piece)
            } else {
                rows.append([piece])
            }
        }
        let lines = rows.map { row in row.sorted { $0.box.minX < $1.box.minX }.map(\.text).joined(separator: " ") }
        // Grenzen der Query: höchstens 500 Zeilen, zusammen höchstens 15 000 Einheiten.
        var result: [String] = []
        var total = 0
        for line in lines.prefix(500) {
            let size = line.utf16.count + (result.isEmpty ? 0 : 1)
            guard total + size <= 15_000 else { break }
            total += size
            result.append(line)
        }
        return result
    }
}

private extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}

/// Systemkamera für ein einzelnes Foto (kein Speichern in der Mediathek).
private struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ picker: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onImage: (UIImage?) -> Void

        init(onImage: @escaping (UIImage?) -> Void) {
            self.onImage = onImage
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onImage(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onImage(nil)
        }
    }
}
