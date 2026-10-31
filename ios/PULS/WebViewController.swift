import UIKit
import WebKit
import CoreLocation
import PULSCore

/// Native PULS-Hülle: lädt die veröffentlichte Web-App, damit Updates ohne neue App-Version ankommen.
/// Daten liegen wie im Browser im WebView-Speicher; Cloud-Sync läuft über das PULS-Konto.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {
    static let home = URL(string: "https://selvirtnj.github.io/puls/")!
    static let appHost = "selvirtnj.github.io"
    static let appPath = "/puls"
    static let background = UIColor(red: 0x10 / 255, green: 0x12 / 255, blue: 0x10 / 255, alpha: 1)

    private var webView: WKWebView!
    private var downloadTargets: [ObjectIdentifier: URL] = [:]
    // Eigenständige Einmal-Ortung: verändert weder Manager noch Punkte von RunTracker.
    private var locateManager: CLLocationManager?
    private var locatePending = false
    private var locateTimeout: DispatchWorkItem?
    // Zustandsbrücke pulsState (Web/StateBridge.swift); nil = nicht verfügbar, Feature wird nicht gemeldet.
    private var stateBridge: StateBridge?
    // Native Bereiche als Sheet über der WebView (Shell/NativeRouter.swift); nil ohne Zustandsbrücke.
    private var nativeRouter: NativeRouter?
    // M3: native Tab-Leiste, Seitenkopf und Übersicht neben der WebView (Shell/RootTabView.swift); nil ohne Brücke.
    private var tabShell: RootTabShell?
    // M4: native Routinen und Kraftsession (Features/Training); nil ohne Brücke.
    private var trainingCoordinator: TrainingCoordinator?
    // M5: nativer Kalender und Fortschritt (Features/Calendar, Features/Progress); nil ohne Brücke.
    private var progressCoordinator: ProgressCoordinator?
    // M6: native Aktivitäten (Features/Activity); nil ohne Brücke. GPS und Live-Aktivität bleiben unten bei pulsNative.
    private var activityCoordinator: ActivityCoordinator?
    private let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) wird nicht verwendet")
    }

    override func loadView() {
        let config = WKWebViewConfiguration()
        // App-Bound Domain (Info.plist) schaltet den Service Worker und damit den Offline-Betrieb frei.
        config.limitsNavigationsToAppBoundDomains = true
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        // Gegenstück: native-bridge.js (window.webkit.messageHandlers.pulsNative).
        config.userContentController.add(self, name: "pulsNative")
        // Gegenstück: native-state.js (window.webkit.messageHandlers.pulsState), docs/native/NATIVE-BRIDGE-PROTOCOL.md.
        if let store = environment.store {
            stateBridge = StateBridge(store: store, appHost: Self.appHost, appPath: Self.appPath)
        }
        stateBridge?.install(into: config.userContentController)
        // Kennzeichen für native-bridge.js: diese App-Version zeigt die Workout-Zeit in der Live-Aktivität.
        // 'nativeBody' (M2) nur mit Zustandsbrücke: dann leitet das Web „Körper & Gewicht“ per openNative weiter.
        // 'nativeTabs'/'nativeOverview' (M3): native Leiste und Übersicht; das Web blendet seine Leiste trotzdem
        // erst nach pulsNativeSetChrome(true) aus.
        // 'nativeTraining' (M4): Routinen und Kraftsession nativ; nur zusammen mit 'stateBridge'. Das Web leitet seine
        // Session-Einstiege erst nach pulsNativeSetTraining(true) per openNative{screen:'training'} weiter.
        // 'nativeProgress' (M5): Kalender und Fortschritt nativ im Trainings-Tab; das Web berechnet die Projektion
        // 'progress' nur nach pulsNativeSetInterest({projections:['progress',…]}).
        // 'nativeActivity' (M6): Aktivitäten nativ (Start, Countdown, Live, Abschluss, Details, Routen). GPS bleibt
        // RunTracker, Live-Aktivität bleibt runActivity aus running.js; das Web leitet openRunView erst nach
        // pulsNativeSetActivity(true) per openNative{screen:'activity'} weiter.
        let stateFeature = stateBridge == nil ? "" : ",'stateBridge','nativeBody','nativeTabs','nativeOverview','nativeTraining','nativeProgress','nativeActivity'"
        config.userContentController.addUserScript(WKUserScript(source: "window.pulsNativeFeatures=['workoutTimer','haptics','runGps','runActivity','runActivityEndState','runLocate'\(stateFeature)];", injectionTime: .atDocumentStart, forMainFrameOnly: true))

        webView = WKWebView(frame: .zero, configuration: config)
        stateBridge?.webView = webView
        if let store = environment.store, let stateBridge {
            let router = NativeRouter(store: store, host: self, webView: webView, appHost: Self.appHost, appPath: Self.appPath)
            nativeRouter = router
            let training = TrainingCoordinator(store: store, bridge: stateBridge, host: self)
            trainingCoordinator = training
            let activity = ActivityCoordinator(store: store, bridge: stateBridge, host: self)
            activityCoordinator = activity
            stateBridge.onOpenNative = { [weak router, weak training, weak activity] open in
                if open.screen == TrainingCoordinator.screen {
                    training?.openFromWeb(workoutId: open.workoutId)
                } else if open.screen == ActivityCoordinator.screen {
                    activity?.openFromWeb(startedAt: open.startedAt, routeId: open.routeId)
                } else {
                    router?.open(open.screen)
                }
            }
            let shell = RootTabShell(store: store, bridge: stateBridge)
            shell.openBody = { [weak router] in router?.open(NativeRouter.bodyScreen) }
            shell.onStyleChange = { [weak self] in self?.setNeedsStatusBarAppearanceUpdate() }
            shell.training = training
            let progress = ProgressCoordinator(store: store, bridge: stateBridge)
            progressCoordinator = progress
            shell.progress = progress
            progress.onOpenWeb = { [weak shell] target in shell?.openProgressWeb(target) }
            training.onSelectWorkoutTab = { [weak shell] in shell?.selectWorkoutTab() }
            training.onShowWebWorkout = { [weak shell] in shell?.showWebWorkout() }
            training.styleProvider = { [weak shell] in
                guard let shell, shell.isActive else { return .dark }
                return shell.style
            }
            shell.activity = activity
            activity.onOpenWeb = { [weak shell] target in shell?.openActivityWeb(target) }
            activity.styleProvider = { [weak shell] in
                guard let shell, shell.isActive else { return .dark }
                return shell.style
            }
            tabShell = shell
        }
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.scrollView.backgroundColor = Self.background
        // Die Web-App nutzt viewport-fit=cover und env(safe-area-inset-*) selbst.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        // Behälter statt `view = webView`: die WebView bleibt dauerhaft dessen Unteransicht (nie umgehängt);
        // ohne aktive native Leiste füllt sie ihn wie bisher vollständig aus.
        let container = UIView()
        container.backgroundColor = Self.background
        webView.frame = container.bounds
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        container.addSubview(webView)
        view = container
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        tabShell?.install(in: self, webView: webView)
        webView.load(URLRequest(url: Self.home))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        guard let tabShell, tabShell.isActive else { return .lightContent }
        return tabShell.style == .light ? .darkContent : .lightContent
    }

    private func isAppURL(_ url: URL) -> Bool {
        if ["blob", "data", "about"].contains(url.scheme ?? "") { return true }
        return url.host == Self.appHost && url.path.hasPrefix(Self.appPath)
    }

    private func presentOnTop(_ controller: UIViewController) {
        var top: UIViewController = self
        while let presented = top.presentedViewController { top = presented }
        if let popover = controller.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }
        top.present(controller, animated: true)
    }

    private func showOffline() {
        let html = """
        <!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101210;color:#eee;font:17px -apple-system,sans-serif;text-align:center}
        a{display:inline-block;margin-top:18px;padding:12px 22px;border-radius:14px;background:#bd91ff;color:#15121b;text-decoration:none;font-weight:600}</style></head>
        <body><div><b>Keine Verbindung</b><br>PULS konnte nicht geladen werden.<br><a href="\(Self.home.absoluteString)">Erneut versuchen</a></div></body></html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: Nachrichten der Web-App

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == Self.appHost,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        switch type {
        case "restStart":
            guard let endsAt = body["endsAt"] as? Double else { return }
            let startsAt = body["startsAt"] as? Double ?? Date().timeIntervalSince1970 * 1000
            RestCoordinator.shared.start(
                workout: body["workout"] as? String ?? "Workout",
                startsAt: Date(timeIntervalSince1970: startsAt / 1000),
                endsAt: Date(timeIntervalSince1970: endsAt / 1000),
                exercise: body["exercise"] as? String ?? "Nächster Satz",
                detail: body["detail"] as? String ?? "Weiter geht's",
                workoutStartsAt: (body["workoutStartsAt"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) }
            )
        case "workoutActive":
            guard let workoutStartsAt = body["workoutStartsAt"] as? Double else { return }
            RestCoordinator.shared.showWorkout(
                workout: body["workout"] as? String ?? "Workout",
                workoutStartsAt: Date(timeIntervalSince1970: workoutStartsAt / 1000),
                exercise: body["exercise"] as? String ?? "Workout",
                detail: body["detail"] as? String ?? "",
                cancelRest: body["cancelRest"] as? Bool ?? false
            )
        case "restCancel":
            RestCoordinator.shared.cancel()
        case "setAppIcon":
            setAppIcon(body["icon"] as? String ?? "dark")
        case "haptic":
            playHaptic(body["style"] as? String ?? "light")
        case "runGpsStart":
            guard let runKey = body["runKey"] as? String else { return }
            let since = (body["since"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) } ?? Date()
            RunTracker.shared.start(runKey: runKey, segment: body["segment"] as? Int ?? 0, since: since)
        case "runLocate":
            locateRunMap()
        case "runGpsStop":
            RunTracker.shared.stop(clear: body["clear"] as? Bool ?? false)
        case "runActivity":
            RunActivityCoordinator.shared.update(body)
        case "runGpsSync":
            guard let runKey = body["runKey"] as? String else { return }
            sendRunGps(RunTracker.shared.payload(runKey: runKey, since: body["since"] as? Int ?? 0))
        default:
            break
        }
    }

    /// GPS-Punkte an running.js (window.pulsRunGpsReceive) zurückgeben.
    private func sendRunGps(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.pulsRunGpsReceive&&window.pulsRunGpsReceive(\(json))", completionHandler: nil)
    }

    /// Nur auf explizite Web-Nachricht; gleichzeitige Anfragen werden zusammengefasst.
    private func locateRunMap() {
        guard !locatePending else { return }
        let manager = CLLocationManager()
        locateManager = manager
        locatePending = true
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        continueRunLocate(manager)
    }

    private func continueRunLocate(_ manager: CLLocationManager) {
        guard locatePending, manager === locateManager else { return }
        switch manager.authorizationStatus {
        case .notDetermined:
            // Kein Timeout während des Systemdialogs: nach Zustimmung fortsetzen.
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            guard locateTimeout == nil else { return }
            let timeout = DispatchWorkItem { [weak self] in
                self?.finishRunLocate(["status": "unavailable"])
            }
            locateTimeout = timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 30, execute: timeout)
            manager.requestLocation()
        case .denied, .restricted:
            finishRunLocate(["status": "denied"])
        @unknown default:
            finishRunLocate(["status": "unavailable"])
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        continueRunLocate(manager)
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard locatePending, manager === locateManager else { return }
        guard let location = locations.last(where: {
            $0.horizontalAccuracy.isFinite && $0.horizontalAccuracy >= 0 &&
            CLLocationCoordinate2DIsValid($0.coordinate) && abs($0.timestamp.timeIntervalSinceNow) <= 30
        }) else {
            finishRunLocate(["status": "unavailable"])
            return
        }
        finishRunLocate(["lat": location.coordinate.latitude, "lon": location.coordinate.longitude,
                         "acc": location.horizontalAccuracy, "status": "on"])
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard locatePending, manager === locateManager else { return }
        let denied = manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted
        finishRunLocate(["status": denied ? "denied" : "unavailable"])
    }

    private func finishRunLocate(_ payload: [String: Any]) {
        guard locatePending else { return }
        locatePending = false
        locateTimeout?.cancel()
        locateTimeout = nil
        locateManager?.delegate = nil
        locateManager = nil
        guard let url = webView.url, url.host == Self.appHost, url.path.hasPrefix(Self.appPath),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.pulsRunLocateReceive&&window.pulsRunLocateReceive(\(json))", completionHandler: nil)
    }

    /// iPhone-Haptik für Aktionen der Web-App (haptics.js); WebKit selbst kennt keine Web-Vibration.
    private func playHaptic(_ style: String) {
        switch style {
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "warning": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "error": UINotificationFeedbackGenerator().notificationOccurred(.error)
        case "selection": UISelectionFeedbackGenerator().selectionChanged()
        case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "heavy": UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    /// Legacy bridge messages are ignored; the app has one fixed dark icon.
    private func setAppIcon(_ key: String) {}

    // MARK: Navigation

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if navigationAction.targetFrame?.isMainFrame == false || isAppURL(url) {
            decisionHandler(.allow)
            return
        }
        // Fremde Links (Supabase-Mails, Quellen, mailto:) gehören in Safari bzw. die passende App.
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    /// Neues Dokument (Laden, Neuladen, Offline-Seite): Dokument-Hello, Projektion und `chrome` gelten nicht mehr;
    /// bis zum nächsten Hello zeigt das neue Dokument seine eigene Leiste.
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        environment.store?.webDocumentDidChange()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showOffline() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: Self.home))
    }

    // MARK: Downloads (Sicherung, CSV-Export) -> Teilen-Menü, z. B. „In Dateien sichern“

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let target = folder.appendingPathComponent(suggestedFilename.isEmpty ? "PULS-Export" : suggestedFilename)
        downloadTargets[ObjectIdentifier(download)] = target
        completionHandler(target)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let file = downloadTargets.removeValue(forKey: ObjectIdentifier(download)) else { return }
        presentOnTop(UIActivityViewController(activityItems: [file], applicationActivities: nil))
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadTargets.removeValue(forKey: ObjectIdentifier(download))
    }

    // MARK: Fenster, Kamera und JavaScript-Dialoge

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isAppURL(url) { webView.load(navigationAction.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == Self.appHost ? .grant : .prompt)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        presentOnTop(alert)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        presentOnTop(alert)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        presentOnTop(alert)
    }
}
