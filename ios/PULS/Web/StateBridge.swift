import Foundation
import WebKit
import PULSCore

/// Zustandsbrücke Web ↔ Native, Protokoll v1 (docs/native/NATIVE-BRIDGE-PROTOCOL.md).
/// Gegenstück: js/native-state.js. Spiegelt, hält die Outbox und leitet `openNative` an den `NativeRouter` weiter.
/// Der Store kommt aus `AppEnvironment` und wird mit den nativen Bereichen geteilt.
@MainActor
final class StateBridge: NSObject, WKScriptMessageHandler {
    let store: ProfileStore
    weak var webView: WKWebView?

    private let appHost: String
    private let appPath: String
    /// Hält die Reihenfolge eingehender Nachrichten trotz Dekodierung abseits des Main-Threads ein.
    private var inboundTail: Task<Void, Never>?

    init(store: ProfileStore, appHost: String, appPath: String) {
        self.store = store
        self.appHost = appHost
        self.appPath = appPath
        super.init()
        store.sender = { [weak self] command in
            self?.send(command)
        }
    }

    /// Nach jedem `openNative` mit dem gewünschten Bereich (`NativeRouter.open`). Der Store merkt sich den Wunsch
    /// zusätzlich in `requestedScreen`.
    var onOpenNative: ((OpenNativeMessage) -> Void)?

    /// Registriert den Handler `pulsState` (ein vorhandener gleichen Namens wird vorher entfernt) und lädt den
    /// letzten Spiegel.
    func install(into controller: WKUserContentController) {
        controller.removeScriptMessageHandler(forName: BridgeProtocol.handlerName)
        controller.add(self, name: BridgeProtocol.handlerName)
        let store = store
        Task { await store.restoreMirror() }
    }

    func uninstall(from controller: WKUserContentController) {
        controller.removeScriptMessageHandler(forName: BridgeProtocol.handlerName)
    }

    // MARK: Web → Native

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Herkunft wie bei pulsNative: nur Hauptframe der eigenen Web-App.
        guard message.name == BridgeProtocol.handlerName,
              message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.host == appHost,
              message.frameInfo.securityOrigin.`protocol` == "https" else { return }
        let payload = InboundPayload(body: message.body)
        let previous = inboundTail
        inboundTail = Task { [weak self] in
            await previous?.value
            // Snapshots können mehrere MB groß sein: abseits des Main-Threads dekodieren.
            let outcome = await Task.detached(priority: .userInitiated) { payload.decode() }.value
            self?.handle(outcome)
        }
    }

    private func handle(_ outcome: InboundOutcome) {
        switch outcome {
        case .message(let message):
            store.receive(message)
            if case .openNative(let open) = message {
                onOpenNative?(open)
            }
        case .ignored:
            break
        case .failed(let reason):
            store.noteBridgeIssue(reason)
        }
    }

    // MARK: Native → Web

    /// M3: `window.pulsNativeNavigate(target)` (Seite oder feste Aktion). Nur auf der eigenen Web-App.
    /// `completion(false)`, wenn das Web ablehnt (z. B. während `chrome.blocking`) oder nicht erreichbar ist.
    func navigate(_ target: NavigationTarget, completion: (@MainActor (Bool) -> Void)? = nil) {
        evaluate(WebCall.navigate(target)) { result in completion?((result as? Bool) == true) }
    }

    /// `window.pulsNativeSetChrome(visible)`: das Web blendet seine Tab-Leiste erst nach `true` aus.
    func setChrome(_ visible: Bool, completion: (@MainActor (Bool) -> Void)? = nil) {
        evaluate(WebCall.setChrome(visible)) { result in completion?((result as? Bool) == true) }
    }

    /// M3: `window.pulsNativeSetDate(day)`; `completion(false)`, wenn das Web den Tag nicht übernimmt
    /// (ungültig, noch nicht bereit, ungeklärte Zuordnung). Die neue Ansicht kommt als Projektion `reason:'date'`.
    func setDate(_ day: String, completion: (@MainActor (Bool) -> Void)? = nil) {
        guard let script = WebCall.setDate(day) else {
            completion?(false)
            return
        }
        evaluate(script) { result in completion?((result as? Bool) == true) }
    }

    /// M4 `window.pulsNativeSetTraining(active)`; `completion(true)` nur, wenn das Web die Übernahme bestätigt.
    func setTraining(_ active: Bool, completion: (@MainActor (Bool) -> Void)? = nil) {
        evaluate(WebCall.setTraining(active)) { result in completion?((result as? Bool) == true) }
    }

    /// M4 Ausweg in die Web-Session dieses Workouts (`resumeWorkout` mit `web:true`).
    func resumeWorkoutInWeb(id: String, completion: (@MainActor (Bool) -> Void)? = nil) {
        guard let script = WebCall.resumeWorkoutInWeb(id: id) else {
            completion?(false)
            return
        }
        evaluate(script) { result in completion?((result as? Bool) == true) }
    }

    /// M4 Übungssuche; das Ergebnis kommt als `exerciseSearch` in den Store. `completion(false)`: nicht gesendet.
    func searchExercises(_ request: ExerciseSearchRequest, completion: (@MainActor (Bool) -> Void)? = nil) {
        evaluate(WebCall.exerciseSearch(request)) { result in completion?((result as? Bool) == true) }
    }

    /// M5 Fortschritts-Query; die Antwort kommt als `progressResult` in den Store. `completion(false)`: nicht gesendet
    /// (Web noch nicht bereit, ungeklärte Zuordnung, ungültige Anfrage, alter Web-Stand).
    func progressQuery(_ request: ProgressQueryRequest, completion: (@MainActor (Bool) -> Void)? = nil) {
        evaluate(WebCall.progressQuery(request)) { result in completion?((result as? Bool) == true) }
    }

    /// M5 Web-Ausweg aus Kalender/Fortschritt (§10.5, `web:true` nur für diesen Aufruf).
    func navigateProgress(_ target: ProgressNavigation, completion: (@MainActor (Bool) -> Void)? = nil) {
        evaluate(WebCall.progressNavigate(target)) { result in completion?((result as? Bool) == true) }
    }

    /// Meldet die Projektionen der sichtbaren nativen Bildschirme (`pulsNativeSetInterest`). Je Dokument/Hello nur bei
    /// Änderung; nach jedem Hello wird neu gemeldet, damit ein neues Web-Dokument den Stand kennt.
    /// Abgleich und Wiederholung regelt `InterestSync` (PULSCore, getestet).
    func setInterest(_ interest: ProjectionInterest, hello: Int) {
        if let next = interestSync.want(interest, hello: hello) { sendInterest(next, hello: hello) }
    }

    private func sendInterest(_ interest: ProjectionInterest, hello: Int) {
        evaluate(WebCall.setInterest(interest)) { [weak self] result in
            guard let self else { return }
            // `false`: abgelehnt oder älterer Web-Stand ohne Funktion (dann gilt dort das bisherige Verhalten).
            if let next = self.interestSync.finished(interest, accepted: (result as? Bool) == true, hello: hello) {
                self.sendInterest(next, hello: hello)
            }
        }
    }

    private var interestSync = InterestSync()

    /// `data-scheme` der Web-App (`light`/`dark`, js/color-scheme.js) oder `nil`.
    func readWebScheme(_ completion: @escaping @MainActor (String?) -> Void) {
        evaluate("document.documentElement.getAttribute('data-scheme')") { result in completion(result as? String) }
    }

    private func evaluate(_ script: String, completion: (@MainActor (Any?) -> Void)?) {
        guard let webView, let url = webView.url, url.host == appHost, url.path.hasPrefix(appPath) else {
            completion?(nil)
            return
        }
        guard let completion else {
            webView.evaluateJavaScript(script, completionHandler: nil)
            return
        }
        webView.evaluateJavaScript(script) { result, _ in
            MainActor.assumeIsolated { completion(result) }
        }
    }

    /// `window.pulsNativeApply(cmd)`; das Argument ist serialisiertes JSON und damit ein sicherer JS-Ausdruck
    /// (Anführungszeichen, Steuerzeichen und U+2028/U+2029 sind maskiert). Ergebnis kommt als `ack`.
    private func send(_ command: ApplyCommand) {
        guard let webView, let url = webView.url,
              url.host == appHost, url.path.hasPrefix(appPath) else { return }
        let argument = command.json.serializedString()
        webView.evaluateJavaScript(
            "window.pulsNativeApply&&window.pulsNativeApply(\(argument));void 0",
            completionHandler: nil
        )
    }
}

/// Ergebnis der Dekodierung einer Nachricht (ohne Inhalte im Fehlertext).
private enum InboundOutcome: Sendable {
    case message(InboundMessage)
    case ignored
    case failed(String)
}

/// `WKScriptMessage.body` ist ein unveränderlicher Foundation-Baum; Lesen auf einem anderen Thread ist sicher.
private struct InboundPayload: @unchecked Sendable {
    let body: Any

    func decode() -> InboundOutcome {
        do {
            guard let message = try InboundMessage.decode(foundation: body) else { return .ignored }
            return .message(message)
        } catch let error as BridgeDecodingError {
            switch error {
            case .notAnObject: return .failed("not an object")
            case .missingField(let field): return .failed("missing \(field)")
            case .invalidField(let field): return .failed("invalid \(field)")
            case .tooDeep: return .failed("too deep")
            }
        } catch JSONError.nestingTooDeep {
            // Zu tiefer Snapshot: verworfen, der letzte gute Spiegel bleibt.
            return .failed("too deep")
        } catch {
            return .failed("unreadable")
        }
    }
}
