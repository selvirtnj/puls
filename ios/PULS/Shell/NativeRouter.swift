import SwiftUI
import UIKit
import WebKit
import PULSCore

/// Zeigt native Bereiche als Sheet über der WebView (die WebView bleibt in der Hierarchie, Protokoll Abschnitt 7).
///
/// Vertrag M2: Auf jedes `openNative{screen:"body"}` zeigt Native etwas an, weil das Web die eigene Unterseite dann
/// nicht mehr öffnet. Kann das Sheet nicht dargestellt werden (z. B. ein anderes Sheet ist offen), fällt Native
/// sofort per `pulsNativeNavigate({page:'account', section:'body', web:true})` auf den Web-Bereich zurück.
/// Unbekannte Bereiche werden ignoriert.
@MainActor
final class NativeRouter {
    static let bodyScreen = "body"

    private let store: ProfileStore
    private weak var host: UIViewController?
    private weak var webView: WKWebView?
    private let appHost: String
    private let appPath: String
    private weak var presented: UIViewController?
    private var isPresenting = false
    private var schemeToken = 0

    init(store: ProfileStore, host: UIViewController, webView: WKWebView, appHost: String, appPath: String) {
        self.store = store
        self.host = host
        self.webView = webView
        self.appHost = appHost
        self.appPath = appPath
    }

    /// Wird von `StateBridge` nach jedem `openNative` aufgerufen.
    func open(_ screen: String) {
        _ = store.consumeScreenRequest()
        guard screen == Self.bodyScreen else { return }
        // Bereits offen oder gerade im Aufbau: nichts doppelt zeigen.
        if isPresenting { return }
        if let controller = presented, controller.presentingViewController != nil, !controller.isBeingDismissed { return }
        guard let host, host.viewIfLoaded?.window != nil, host.presentedViewController == nil, !host.isBeingDismissed else {
            openInWeb(page: "account", section: Self.bodyScreen)
            return
        }
        isPresenting = true
        resolveWebScheme { [weak self] style in
            self?.presentBody(on: host, style: style)
        }
    }

    private func presentBody(on host: UIViewController, style: UIUserInterfaceStyle) {
        isPresenting = false
        // Zwischenzeitlich (Rückruf aus der WebView) könnte etwas anderes präsentiert worden sein.
        guard host.presentedViewController == nil, host.viewIfLoaded?.window != nil else {
            openInWeb(page: "account", section: Self.bodyScreen)
            return
        }
        let view = BodyView(
            onClose: { [weak self] in self?.dismiss() },
            onOpenWeb: { [weak self] in
                self?.dismiss { self?.openInWeb(page: "account", section: Self.bodyScreen) }
            }
        )
        .environment(store)
        let controller = UIHostingController(rootView: view)
        controller.overrideUserInterfaceStyle = style
        controller.modalPresentationStyle = .pageSheet
        controller.sheetPresentationController?.prefersGrabberVisible = true
        presented = controller
        host.present(controller, animated: true)
    }

    /// Schließt den nativen Bereich; `completion` läuft danach (auch wenn nichts offen war).
    func dismiss(completion: (() -> Void)? = nil) {
        guard let controller = presented, controller.presentingViewController != nil else {
            presented = nil
            completion?()
            return
        }
        controller.dismiss(animated: true) { [weak self] in
            self?.presented = nil
            completion?()
        }
    }

    /// `window.pulsNativeNavigate({page, section, web:true})`: der Web-Bereich öffnet sich ohne erneutes `openNative`.
    /// Immer erst nach dem Schließen des eigenen Sheets aufrufen.
    func openInWeb(page: String, section: String) {
        guard let webView, let url = webView.url, url.host == appHost, url.path.hasPrefix(appPath) else { return }
        let argument = JSONValue.object([
            "page": .string(page), "section": .string(section), "web": .bool(true),
        ]).serializedString()
        webView.evaluateJavaScript(
            "window.pulsNativeNavigate&&window.pulsNativeNavigate(\(argument));void 0",
            completionHandler: nil
        )
    }

    /// Übernimmt Hell/Dunkel der Web-App (`data-scheme` aus js/color-scheme.js); sonst Dunkel wie die App.
    private func resolveWebScheme(_ completion: @escaping @MainActor (UIUserInterfaceStyle) -> Void) {
        guard let webView else {
            completion(.dark)
            return
        }
        schemeToken += 1
        let token = schemeToken
        // Nur die erste Antwort (WebView oder Zeitlimit) zählt.
        let finish: @MainActor (UIUserInterfaceStyle) -> Void = { [weak self] style in
            guard let self, self.schemeToken == token else { return }
            self.schemeToken += 1
            completion(style)
        }
        // Antwortet die WebView nicht zügig (z. B. beschäftigt), nicht auf sie warten.
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 300_000_000)
            finish(.dark)
        }
        webView.evaluateJavaScript("document.documentElement.getAttribute('data-scheme')") { result, _ in
            let isLight = (result as? String) == "light"
            MainActor.assumeIsolated {
                finish(isLight ? .light : .dark)
            }
        }
    }
}
