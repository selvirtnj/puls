import UIKit
import WebKit

/// Native PULS-Hülle: lädt die veröffentlichte Web-App, damit Updates ohne neue App-Version ankommen.
/// Daten liegen wie im Browser im WebView-Speicher; Cloud-Sync läuft über das PULS-Konto.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    static let home = URL(string: "https://selvirtnj.github.io/puls/")!
    static let appHost = "selvirtnj.github.io"
    static let appPath = "/puls"
    static let background = UIColor(red: 0x10 / 255, green: 0x12 / 255, blue: 0x10 / 255, alpha: 1)

    private var webView: WKWebView!
    private var downloadTargets: [ObjectIdentifier: URL] = [:]

    override func loadView() {
        let config = WKWebViewConfiguration()
        // App-Bound Domain (Info.plist) schaltet den Service Worker und damit den Offline-Betrieb frei.
        config.limitsNavigationsToAppBoundDomains = true
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        // Gegenstück: native-bridge.js (window.webkit.messageHandlers.pulsNative).
        config.userContentController.add(self, name: "pulsNative")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.scrollView.backgroundColor = Self.background
        // Die Web-App nutzt viewport-fit=cover und env(safe-area-inset-*) selbst.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: Self.home))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

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
                detail: body["detail"] as? String ?? "Weiter geht's"
            )
        case "restCancel":
            RestCoordinator.shared.cancel()
        case "setAppIcon":
            setAppIcon(body["icon"] as? String ?? "purple")
        default:
            break
        }
    }

    /// Echtes App-Symbol wechseln (alternative Icons aus dem Asset-Katalog, im Build aus icons/<farbe>.svg erzeugt).
    private func setAppIcon(_ key: String) {
        let colors = ["purple", "blue", "mint", "rose", "amber", "green"]
        guard colors.contains(key), UIApplication.shared.supportsAlternateIcons else { return }
        let name: String? = key == "purple" ? nil : "AppIcon-\(key)"
        guard UIApplication.shared.alternateIconName != name else { return }
        UIApplication.shared.setAlternateIconName(name) { error in
            if let error = error { NSLog("PULS: App-Icon nicht gewechselt: \(error)") }
        }
    }

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
