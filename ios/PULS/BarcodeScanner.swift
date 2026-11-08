import UIKit
import AVFoundation
import VisionKit

/// One scanner at a time. Images never leave the camera pipeline.
final class BarcodeScanner: NSObject, DataScannerViewControllerDelegate, AVCaptureMetadataOutputObjectsDelegate, UIAdaptivePresentationControllerDelegate {
    private var completion: ((String, String?) -> Void)?
    private weak var presenter: UIViewController?
    private var navigation: UINavigationController?
    private var dataScanner: DataScannerViewController?
    private var capture: AVCaptureSession?
    private let captureQueue = DispatchQueue(label: "puls.barcode.camera")
    private var timeout: DispatchWorkItem?
    private var torchDevice: AVCaptureDevice?
    private var torchButton: UIBarButtonItem?
    private var torchOn = false

    func start(from presenter: UIViewController, completion: @escaping (String, String?) -> Void) {
        self.presenter = presenter
        self.completion = completion
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: showScanner()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
                DispatchQueue.main.async {
                    guard let self = self, self.completion != nil else { return }
                    if allowed { self.showScanner() } else { self.finish("denied") }
                }
            }
        default: finish("denied")
        }
    }

    func cancel() { finish("cancelled") }

    private func showScanner() {
        guard completion != nil, let presenter = presenter, presenter.presentedViewController == nil else {
            finish("unavailable"); return
        }
        let controller: UIViewController
        if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
            let scanner = DataScannerViewController(
                recognizedDataTypes: [.barcode(symbologies: [.ean8, .ean13, .itf14])],
                qualityLevel: .balanced, recognizesMultipleItems: false,
                isHighFrameRateTrackingEnabled: false, isPinchToZoomEnabled: true,
                isGuidanceEnabled: true, isHighlightingEnabled: true)
            scanner.delegate = self
            dataScanner = scanner
            controller = scanner
        } else {
            controller = BarcodeCameraViewController()
        }
        controller.title = "Barcode scannen"
        controller.navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancelPressed))
        let navigation = UINavigationController(rootViewController: controller)
        self.navigation = navigation
        // The AVFoundation fallback configures the torch with its real capture device in startCamera.
        if dataScanner != nil {
            configureTorch(controller, device: AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back))
        }
        navigation.presentationController?.delegate = self
        presenter.present(navigation, animated: true) { [weak self] in
            guard let self = self, self.completion != nil else { return }
            navigation.presentationController?.delegate = self
            if let scanner = self.dataScanner {
                do { try scanner.startScanning() }
                catch { self.useCameraFallback() }
            } else { self.startCamera(controller) }
        }
        let timeout = DispatchWorkItem { [weak self] in self?.finish("cancelled") }
        self.timeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 90, execute: timeout)
    }

    private func useCameraFallback() {
        guard completion != nil, let navigation = navigation else { return }
        dataScanner?.stopScanning()
        dataScanner = nil
        turnTorchOff()
        let controller = BarcodeCameraViewController()
        controller.title = "Barcode scannen"
        controller.navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancelPressed))
        navigation.setViewControllers([controller], animated: false)
        startCamera(controller)
    }

    private func startCamera(_ controller: UIViewController) {
        guard let controller = controller as? BarcodeCameraViewController,
              let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else { finish("unavailable"); return }
        let session = AVCaptureSession(), output = AVCaptureMetadataOutput()
        guard session.canAddInput(input), session.canAddOutput(output) else { finish("unavailable"); return }
        session.addInput(input)
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.ean8, .ean13, .itf14].filter { output.availableMetadataObjectTypes.contains($0) }
        guard !output.metadataObjectTypes.isEmpty else { finish("unavailable"); return }
        capture = session
        controller.attach(session)
        configureTorch(controller, device: device)
        captureQueue.async { session.startRunning() }
    }

    private func configureTorch(_ controller: UIViewController, device: AVCaptureDevice?) {
        guard let device = device, device.hasTorch, device.isTorchModeSupported(.on) else {
            navigation?.setToolbarHidden(true, animated: false)
            return
        }
        torchDevice = device
        let button = UIBarButtonItem(image: UIImage(systemName: "flashlight.off.fill"), style: .plain,
                                     target: self, action: #selector(toggleTorch))
        button.accessibilityLabel = "Taschenlampe einschalten"
        button.accessibilityValue = "Aus"
        torchButton = button
        torchOn = false
        controller.toolbarItems = [UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil), button,
                                   UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)]
        navigation?.setToolbarHidden(false, animated: false)
    }

    @objc private func toggleTorch() {
        guard completion != nil, let device = torchDevice else { return }
        let enabled = !torchOn
        torchButton?.isEnabled = false
        captureQueue.async { [weak self] in
            var active = false
            do {
                try device.lockForConfiguration()
                defer { device.unlockForConfiguration() }
                if enabled { try device.setTorchModeOn(level: AVCaptureDevice.maxAvailableTorchLevel) }
                else { device.torchMode = .off }
                active = device.torchMode == .on
            } catch { active = device.torchMode == .on }
            DispatchQueue.main.async {
                guard let self = self, self.completion != nil, self.torchDevice === device else { return }
                self.torchOn = active
                self.torchButton?.image = UIImage(systemName: active ? "flashlight.on.fill" : "flashlight.off.fill")
                self.torchButton?.accessibilityLabel = active ? "Taschenlampe ausschalten" : "Taschenlampe einschalten"
                self.torchButton?.accessibilityValue = active ? "Ein" : "Aus"
                self.torchButton?.isEnabled = true
            }
        }
    }

    private func turnTorchOff() {
        let device = torchDevice
        torchDevice = nil; torchButton = nil; torchOn = false
        captureQueue.async {
            guard let device = device, device.hasTorch else { return }
            do {
                try device.lockForConfiguration()
                defer { device.unlockForConfiguration() }
                device.torchMode = .off
            } catch { /* Stopping the capture below also releases the camera. */ }
        }
    }

    @objc private func cancelPressed() { cancel() }
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { cancel() }

    private func accept(_ value: String?) {
        guard let value = value, valid(value) else { return }
        finish("scanned", code: value)
    }

    private func valid(_ code: String) -> Bool {
        guard [8, 12, 13, 14].contains(code.count), code.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else { return false }
        let digits = code.utf8.map { Int($0 - 48) }
        let sum = digits.dropLast().reversed().enumerated().reduce(0) { $0 + $1.element * ($1.offset % 2 == 0 ? 3 : 1) }
        return (10 - sum % 10) % 10 == digits.last
    }

    func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        for item in addedItems { if case .barcode(let barcode) = item { accept(barcode.payloadStringValue) } }
    }
    func dataScanner(_ dataScanner: DataScannerViewController, didTapOn item: RecognizedItem) {
        if case .barcode(let barcode) = item { accept(barcode.payloadStringValue) }
    }
    func dataScanner(_ dataScanner: DataScannerViewController, didUpdate updatedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        for item in updatedItems { if case .barcode(let barcode) = item { accept(barcode.payloadStringValue) } }
    }
    func dataScanner(_ dataScanner: DataScannerViewController, becameUnavailableWithError error: DataScannerViewController.ScanningUnavailable) {
        useCameraFallback()
    }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        for item in metadataObjects { accept((item as? AVMetadataMachineReadableCodeObject)?.stringValue) }
    }

    private func finish(_ status: String, code: String? = nil) {
        guard let callback = completion else { return }
        completion = nil
        timeout?.cancel(); timeout = nil
        turnTorchOff()
        dataScanner?.stopScanning(); dataScanner = nil
        if let session = capture { captureQueue.async { session.stopRunning() } }
        capture = nil
        if let navigation = navigation, navigation.presentingViewController != nil {
            navigation.dismiss(animated: true) { callback(status, code) }
        } else { callback(status, code) }
        navigation = nil
    }
}

private final class BarcodeCameraViewController: UIViewController {
    private var preview: AVCaptureVideoPreviewLayer?
    override func loadView() { view = UIView(); view.backgroundColor = .black }
    func attach(_ session: AVCaptureSession) {
        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        view.layer.addSublayer(preview)
        self.preview = preview
        view.setNeedsLayout()
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
        if let orientation = view.window?.windowScene?.interfaceOrientation,
           let video = AVCaptureVideoOrientation(rawValue: orientation.rawValue),
           preview?.connection?.isVideoOrientationSupported == true { preview?.connection?.videoOrientation = video }
    }
}
