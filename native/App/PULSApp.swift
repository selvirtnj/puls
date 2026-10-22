import SwiftUI
import UIKit
import WebKit
import ActivityKit
import UserNotifications
import UniformTypeIdentifiers

final class BrowserStore: ObservableObject { weak var web: WKWebView? }
struct ShareFile: Identifiable { let id = UUID(); let url: URL }
struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

@main
struct PULSApp: App {
    var body: some Scene { WindowGroup { PULSView().preferredColorScheme(.dark) } }
}

struct PULSView: View {
    @State private var issue: String?
    @StateObject private var browser = BrowserStore()
    @State private var importing = false
    @State private var share: ShareFile?
    var body: some View {
        VStack(spacing: 0) {
            if let issue {
                Text(issue).font(.caption).padding(8).frame(maxWidth: .infinity).background(.orange.opacity(0.2))
            }
            PULSBrowser(issue: $issue, store: browser)
            HStack {
                Button("Sicherung exportieren") {
                    browser.web?.evaluateJavaScript("JSON.stringify(state)") { result, error in
                        guard let json = result as? String, error == nil else { issue = "Export fehlgeschlagen. Warte, bis PULS geladen ist."; return }
                        do {
                            let url = FileManager.default.temporaryDirectory.appendingPathComponent("puls-sicherung-\(Int(Date().timeIntervalSince1970)).json")
                            try Data(json.utf8).write(to: url, options: .atomic)
                            share = ShareFile(url: url)
                        } catch { issue = "Sicherung konnte nicht erstellt werden." }
                    }
                }
                Spacer()
                Button("Sicherung importieren") { importing = true }
            }.font(.caption).padding(10)
        }.background(Color(red: 0.06, green: 0.07, blue: 0.06))
        .sheet(item: $share) { ShareSheet(url: $0.url) }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let allowed = url.startAccessingSecurityScopedResource()
                defer { if allowed { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= 5_000_000 else { issue = "Sicherung ist zu groß (maximal 5 MB)."; return }
                let data = try Data(contentsOf: url)
                guard data.count <= 5_000_000, let web = browser.web else { issue = "Import nicht verfügbar."; return }
                let encoded = data.base64EncodedString()
                web.evaluateJavaScript("void importData(new File([Uint8Array.from(atob('\(encoded)'), c => c.charCodeAt(0))], 'sicherung.json', {type:'application/json'}))") { _, error in
                    if error != nil { issue = "Import fehlgeschlagen. Warte, bis PULS geladen ist." }
                }
            } catch { issue = "Sicherung konnte nicht gelesen werden." }
        }
    }
}

struct PULSBrowser: UIViewRepresentable {
    @Binding var issue: String?
    let store: BrowserStore
    func makeCoordinator() -> Coordinator { Coordinator(issue: $issue) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "pulsWorkout")
        let web = WKWebView(frame: .zero, configuration: config)
        store.web = web
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.load(URLRequest(url: URL(string: "https://selvirtnj.github.io/puls/?v=7")!))
        UNUserNotificationCenter.current().delegate = context.coordinator
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, UNUserNotificationCenterDelegate {
        @Binding var issue: String?
        private var scheduledEnd: Date?
        private var permissionAsked = false
        private var sequence: Task<Void, Never>?
        init(issue: Binding<String?>) { _issue = issue }
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.host == "selvirtnj.github.io",
                  message.frameInfo.securityOrigin.protocol == "https",
                  let body = message.body as? [String: Any], let active = body["active"] as? Bool else { return }
            // Serialize asynchronous ActivityKit operations so rapid set checks cannot create duplicates.
            let prior = sequence
            sequence = Task { @MainActor [weak self] in
                await prior?.value
                guard let self else { return }
                if !active { await self.end(); return }
                guard let id = body["id"] as? String, let name = body["name"] as? String,
                      let start = body["startedAt"] as? Double, start.isFinite else { return }
                let rest = (body["restEndAt"] as? Double).flatMap { $0.isFinite ? Date(timeIntervalSince1970: $0 / 1000) : nil }
                let state = WorkoutAttributes.ContentState(name: String(name.prefix(80)), startedAt: Date(timeIntervalSince1970: start / 1000), restEndAt: rest)
                if ActivityAuthorizationInfo().areActivitiesEnabled {
                    let matches = Activity<WorkoutAttributes>.activities.filter { $0.attributes.workoutID == id }
                    for old in Activity<WorkoutAttributes>.activities where old.attributes.workoutID != id {
                        await old.end(nil, dismissalPolicy: .immediate)
                    }
                    if let activity = matches.first {
                        await activity.update(ActivityContent(state: state, staleDate: rest))
                        for extra in matches.dropFirst() { await extra.end(nil, dismissalPolicy: .immediate) }
                    } else {
                        do { _ = try Activity.request(attributes: WorkoutAttributes(workoutID: id), content: ActivityContent(state: state, staleDate: rest), pushType: nil) }
                        catch { self.issue = "Live Activity konnte nicht starten: \(error.localizedDescription)" }
                    }
                } else { self.issue = "Live-Aktivitäten sind deaktiviert. Du kannst sie in den iPhone-Einstellungen für PULS erlauben." }
                await self.scheduleRest(rest)
            }
        }
        @MainActor private func scheduleRest(_ end: Date?) async {
            guard end != scheduledEnd else { return }
            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(withIdentifiers: ["puls-rest"])
            scheduledEnd = end
            guard let end, end.timeIntervalSinceNow > 0 else { return }
            do {
                if !permissionAsked {
                    permissionAsked = true
                    let allowed = try await center.requestAuthorization(options: [.alert, .sound])
                    if !allowed { issue = "Pausen-Mitteilungen sind deaktiviert. Erlaube Mitteilungen für PULS in den iPhone-Einstellungen."; return }
                }
                let content = UNMutableNotificationContent()
                content.title = "Pause vorbei"
                content.body = "Bereit für deinen nächsten Satz? Öffne dein Workout."
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, end.timeIntervalSinceNow), repeats: false)
                try await center.add(UNNotificationRequest(identifier: "puls-rest", content: content, trigger: trigger))
            } catch { issue = "Pausen-Mitteilung konnte nicht geplant werden: \(error.localizedDescription)" }
        }
        @MainActor private func end() async {
            for activity in Activity<WorkoutAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["puls-rest"])
            scheduledEnd = nil
        }
        func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "https" && url.host == "selvirtnj.github.io" && url.path.hasPrefix("/puls/") { decisionHandler(.allow) }
            else { decisionHandler(.cancel); if url.scheme == "https" { UIApplication.shared.open(url) } }
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { issue = nil }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { issue = "PULS konnte nicht geladen werden. Prüfe die Internetverbindung und starte die App erneut." }
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(origin.host == "selvirtnj.github.io" ? .prompt : .deny) }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { showDialog(message: message, confirm: false) { _ in completionHandler() } }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) { showDialog(message: message, confirm: true, completion: completionHandler) }
        private func showDialog(message: String, confirm: Bool, completion: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "PULS", message: message, preferredStyle: .alert)
            if confirm { alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completion(false) }) }
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completion(true) })
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            var root = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
            while let presented = root?.presentedViewController { root = presented }
            guard let root else { completion(false); return }
            root.present(alert, animated: true)
        }
    }
}


