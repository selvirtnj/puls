import Foundation
import WebKit
import PULSCore

/// Zustandsbrücke Web ↔ Native, Protokoll v1 (docs/native/NATIVE-BRIDGE-PROTOCOL.md).
/// Gegenstück: js/native-state.js. In M1 ohne sichtbare Wirkung: spiegelt nur und hält die Outbox.
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

    /// Store im Application-Support-Verzeichnis. `nil`, wenn das Verzeichnis nicht verfügbar ist; dann
    /// meldet die App `stateBridge` nicht und das Web bleibt wie bisher.
    static func makeDefault(appHost: String, appPath: String) -> StateBridge? {
        guard let environment = try? StoreEnvironment.live() else { return nil }
        return StateBridge(store: ProfileStore(environment: environment), appHost: appHost, appPath: appPath)
    }

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
        case .ignored:
            break
        case .failed(let reason):
            store.noteBridgeIssue(reason)
        }
    }

    // MARK: Native → Web

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
