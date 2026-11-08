import SwiftUI
import UIKit
import WebKit
import Observation
import PULSCore

// M3: native Tab-Leiste, Seitenkopf und native Übersicht neben der **einen** bestehenden WebView.
//
// Aufbau (alles im View von `WebViewController`, die WebView wird nie umgehängt oder versteckt):
//
//   ┌ statusFill ─────────────┐  Hintergrund unter der Statusleiste
//   ├ header (SwiftUI) ───────┤  Seitentitel + Datumsleiste (ersetzt Web-Header/Titelzeile/Datumsleiste)
//   │ webView                 │  immer in der Hierarchie, immer sichtbar (`isHidden` bleibt false)
//   │   overview (SwiftUI)    │  deckt die WebView nur ab, solange „Übersicht“ nativ gezeigt wird
//   ├ tabBar (UITabBar) ──────┤  Training | Übersicht | + | Essen | Konto
//   └─────────────────────────┘
//
// Aktiv nur, wenn das Web in **diesem Dokument** `hello{features:['nativeTabs'], ownerPending:false}` gemeldet
// hat. Sobald die native Leiste sichtbar ist, ruft Native `pulsNativeSetChrome(true)`; erst dann blendet das Web
// seine Leiste aus. Wird die native Leiste wieder entfernt (Anmeldung/ungeklärte Zuordnung), folgt
// `pulsNativeSetChrome(false)`. Lehnt das Web `true` ab, bleibt Native bis zum nächsten Dokument im Web-Modus.
// Sonst (alter Web-Stand, neues Dokument vor dem Hello, Offline-Seite) liegt die WebView wie bisher im Vollbild.
//
// `chrome{blocking:true}` sperrt Tab- und Datumswechsel; bei `reason` `session`/`run` verschwinden Kopf und
// Leiste und die WebView liegt im Vollbild (Web-Session). Die WebView endet sonst immer oberhalb der Leiste.

/// Tabs in der Reihenfolge aus `dsTabs`. `add` ist eine Aktion, keine Seite.
enum RootTab: String, CaseIterable {
    case workout, home, add, food, account

    static let defaultOrder: [RootTab] = [.workout, .home, .add, .food, .account]

    var page: String? { self == .add ? nil : rawValue }

    func label(_ text: OverviewText) -> String {
        switch self {
        case .workout: return text("Training", "Training")
        case .home: return text("Übersicht", "Overview")
        case .add: return text("Hinzufügen", "Add")
        case .food: return text("Essen", "Food")
        case .account: return text("Konto", "Account")
        }
    }

    var symbol: String {
        switch self {
        case .workout: return "dumbbell"
        case .home: return "house"
        case .add: return "plus.circle.fill"
        case .food: return "fork.knife"
        case .account: return "person.crop.circle"
        }
    }

    var selectedSymbol: String {
        switch self {
        case .workout: return "dumbbell.fill"
        case .home: return "house.fill"
        case .add: return "plus.circle.fill"
        case .food: return "fork.knife"
        case .account: return "person.crop.circle.fill"
        }
    }

    /// Das Web zeigt die Datumsleiste auf allen Seiten außer Konto (js/flows.js).
    var showsDateBar: Bool { self != .account && self != .add }
}

/// UI-Zustand der Hülle, den der SwiftUI-Kopf liest. Kein Profilzustand.
@Observable
@MainActor
final class ShellState {
    var selected: RootTab = .home
    var tabs: [RootTab] = RootTab.defaultOrder
    /// Sprache, solange noch keine Projektion vorliegt (aus dem Spiegel).
    var fallbackLanguage = "de"
    /// Web-Modal/Session offen (`chrome.blocking`): Datum und Tabs gesperrt.
    var isBlocked = false
    /// M8: natives Konto sichtbar; dann bestimmt dessen Unterseite den Seitentitel (sonst `chrome.accountSection`).
    var accountNative = false
    var nativeAccountSection: String?
}

/// Aktionen der nativen Bereiche. Bewusst kein Environment-Wert (keine Closures im Environment).
struct OverviewActions {
    var perform: (NavigationTarget) -> Void
    var setDate: (String) -> Void
    var openBody: () -> Void
    var showWebHome: () -> Void
    /// „Gewicht erfassen“: natives Gewichtsblatt (M2), sonst das übergebene Web-Ziel.
    var addWeight: (NavigationTarget) -> Void
    /// „Verlauf ansehen“: nativer Fortschritt (M5), sonst das übergebene Web-Ziel.
    var openProgress: (NavigationTarget) -> Void
}

@MainActor
final class RootTabShell: NSObject, UITabBarDelegate {
    /// **Der eine Schalter** für den Hybrid-Modus (Protokoll §16): Übersicht, Training und Essen zeigen die Web-Seite mit
    /// Web-Kopf und Datum unter der nativen Leiste; Einstiege dort öffnen native Fenster. Konto und Plus bleiben nativ.
    /// `false` = bisherige native Hauptansichten (die App meldet dann auch `nativeWebPages` nicht mehr ans Web).
    static let webPagesMode = true
    /// `openNative{screen:'window'}` des Hybrid-Modus.
    static let windowScreen = "window"

    private let store: ProfileStore
    private let bridge: StateBridge
    private let state = ShellState()
    private weak var host: UIViewController?
    private weak var webView: WKWebView?

    private let tabBar = UITabBar()
    private let statusFill = UIView()
    private var headerHost: UIHostingController<ShellHeaderHost>?
    private var overviewHost: UIHostingController<OverviewHost>?
    /// M4: nativer Trainings-Tab (Routinen, laufende Session als Banner); nur mit `TrainingCoordinator`.
    /// M5: zusätzlich Kalender und Fortschritt als Bereiche desselben Tabs (ProgressCoordinator).
    private var trainingHost: UIHostingController<WorkoutTabHost>?
    /// M7: nativer Essen-Tab (Tagebuch, Suche, Ziele); nur mit `NutritionCoordinator`.
    private var nutritionHost: UIHostingController<NutritionHost>?
    /// M8: nativer Konto-Tab; nur mit `AccountCoordinator`.
    private var accountHost: UIHostingController<AccountHost>?
    /// Feste Kopfhöhe = natürliche SwiftUI-Höhe bei aktueller Breite/Dynamic Type (`layoutHeader()`).
    private var headerHeightConstraint: NSLayoutConstraint?
    private var activeConstraints: [NSLayoutConstraint] = []
    private var inactiveConstraints: [NSLayoutConstraint] = []
    /// Hybrid: WebView vom oberen Rand (Web-Kopf mit eigener Safe Area) bis zur Leiste.
    private var webPageConstraints: [NSLayoutConstraint] = []
    /// Hybrid: Hinweise, „Rückgängig“ und Konflikte nativer Fenster direkt über der Leiste.
    private var overlayHost: UIHostingController<WebPagesOverlay>?
    private var overlayHeightConstraint: NSLayoutConstraint?
    /// Hybrid in diesem Dokument angewandt (Leiste aktiv, Web meldet `nativeWebPages`, Schalter an).
    private var webPages = false
    private var stackedWebPages: Bool?
    /// Hybrid: natives Konto beim Verlassen kurz stehen lassen, bis die Web-Seite gewechselt hat (kein Aufblitzen der Web-Kontoseite).
    private var accountHold = false
    private var accountHoldToken = 0

    /// „Übersicht“ ist ausgewählt, zeigt aber die Web-Seite (nach einer Aktion mit Web-Modal/Session,
    /// nach `navigate{web:true}` oder per Ausweichknopf), bis die native Übersicht bewusst wieder gewählt wird.
    private var homeShowsWeb = false
    /// „Training“ ist ausgewählt, zeigt aber die Web-Trainingsseite (Kalender, Rekorde, `navigate{web:true}`).
    private var workoutShowsWeb = false
    private var handledNavigation = 0
    private var handledHello = 0
    private var itemsKey = ""
    private var schemeKey = ""
    /// Zuletzt an `pulsNativeSetChrome` gemeldeter Wert in diesem Dokument.
    private var chromeSent: Bool?
    /// Das Web hat `pulsNativeSetChrome(true)` abgelehnt bzw. kennt die Funktion nicht: bis zum nächsten Dokument Web-Leiste.
    private var chromeRejected = false
    /// Leisten gerade wegen Web-Vollbild-Session ausgeblendet.
    private var barsHiddenForSession = false
    /// Eine Aktion aus der nativen Übersicht hat einen Web-Ablauf gestartet: nach dessen Ende
    /// (`chrome` blocking true → false) wieder die native Übersicht zeigen.
    private var restoreOverviewAfterFlow = false
    private var flowWasBlocking = false

    /// Native Leiste sichtbar und Web-Leiste ausgeblendet (bzw. angefordert).
    private(set) var isActive = false
    private(set) var style: UIUserInterfaceStyle = .dark
    /// Statusleiste neu bestimmen (Hell/Dunkel, aktiv/inaktiv).
    var onStyleChange: (() -> Void)?
    /// Öffnet den nativen Körperbereich (M2, `NativeRouter`).
    var openBody: (() -> Void)?
    /// M4: native Routinen und Session. Vor `install` setzen.
    var training: TrainingCoordinator?
    /// M5: nativer Kalender und Fortschritt im Trainings-Tab. Vor `install` setzen.
    var progress: ProgressCoordinator?
    /// M6: native Aktivitäten (Karte im Trainings-Tab, Vollbild-Ablauf). Vor `install` setzen.
    var activity: ActivityCoordinator?
    /// M7: native Ernährung im Essen-Tab. Vor `install` setzen.
    var nutrition: NutritionCoordinator?
    /// M8: natives Konto im Konto-Tab. Vor `install` setzen.
    var account: AccountCoordinator?
    /// M2: natives Gewichtsblatt direkt öffnen (Tag ISO oder `nil`); `false` = nativ nicht möglich.
    var openWeightEditor: ((String?) -> Bool)?
    /// Erststart: einmal, sobald die native Hülle darstellbar ist (sichtbarer Tab mit erster Projektion) oder
    /// feststeht, dass dieses Dokument im Web-Modus bleibt. Der Host blendet dann seinen Startbildschirm aus.
    var onReady: (() -> Void)?
    /// Nach jeder Neuordnung der Ebenen (Hybrid ↔ bisher): der Host holt seinen Startbildschirm wieder nach vorn.
    var onStackChange: (() -> Void)?
    private var reportedReady = false
    /// Natives Plus-Menü, solange es offen ist.
    private weak var quickAddController: UIViewController?
    /// „Konto“ ist ausgewählt, zeigt aber die Web-Seite (Web-Ausweg, `navigate{web:true}`), bis der Tab neu gewählt wird.
    private var accountShowsWeb = false
    private var accountExitUntil = Date.distantPast
    /// „Essen“ ist ausgewählt, zeigt aber die Web-Seite (`navigate{web:true}`, Web-Tagebuch), bis der Tab neu gewählt wird.
    private var foodShowsWeb = false
    /// Ein Web-Dialog aus dem nativen Essen-Tab (Essensdialog, Bearbeiten) läuft: native Ansicht bis zu dessen Ende verdecken.
    private var foodFlowHidden = false
    private var foodFlowSawBlocking = false
    private var foodFlowToken = 0
    /// M5: Ein Web-Ausweg aus Kalender/Fortschritt (Review, Aktivität, Übungsverlauf …) läuft: native Trainingsansicht
    /// verdecken, bis der Web-Ablauf endet (`chrome` blocking true → false) bzw. nach 3 s ohne Web-Ablauf.
    private var workoutFlowHidden = false
    private var workoutFlowSawBlocking = false
    private var workoutFlowToken = 0

    init(store: ProfileStore, bridge: StateBridge) {
        self.store = store
        self.bridge = bridge
        super.init()
    }

    // MARK: Aufbau

    /// `webView` muss bereits Unteransicht von `host.view` sein.
    func install(in host: UIViewController, webView: WKWebView) {
        guard let root = host.viewIfLoaded, webView.superview === root else { return }
        self.host = host
        self.webView = webView

        let actions = OverviewActions(
            perform: { [weak self] target in self?.perform(target) },
            setDate: { [weak self] day in self?.setDate(day) },
            openBody: { [weak self] in self?.openBodyScreen() },
            showWebHome: { [weak self] in self?.showWebHome() },
            addWeight: { [weak self] fallback in self?.addWeight(fallback: fallback) },
            openProgress: { [weak self] fallback in self?.openProgress(fallback: fallback) }
        )
        let header = UIHostingController(rootView: ShellHeaderHost(store: store, state: state, actions: actions))
        header.sizingOptions = .intrinsicContentSize
        // Gerätetest ipa-41: Der Kopf wurde auf ~85 % der Höhe gedehnt. Ursache: Kopf und Inhalts-Hosts (zwischen
        // header.bottom und tabBar.top) melden beide eine intrinsische Höhe mit gleicher Hugging-Priorität (250); Auto Layout
        // gab dem Inhalt seine kleine Idealhöhe und dehnte den Kopf. Der Kopf ist jetzt fest auf seine natürliche Höhe
        // gesetzt (required), die Inhalts-Hosts haben keine eigene Höhenpräferenz mehr.
        // Hohe, aber nicht required Prioritäten: maßgeblich ist die required Höhe aus `layoutHeader()` (kein Konflikt).
        header.view.setContentHuggingPriority(UILayoutPriority(999), for: .vertical)
        header.view.setContentCompressionResistancePriority(UILayoutPriority(999), for: .vertical)
        let overview = UIHostingController(rootView: OverviewHost(store: store, actions: actions))
        headerHost = header
        overviewHost = overview
        let trainingView: UIView?
        if let training {
            let hosting = UIHostingController(rootView: WorkoutTabHost(training: training, progress: progress, activity: activity))
            hosting.view.backgroundColor = .systemGroupedBackground
            trainingHost = hosting
            trainingView = hosting.view
        } else {
            trainingView = nil
        }

        let nutritionView: UIView?
        if let nutrition {
            let hosting = UIHostingController(rootView: NutritionHost(coordinator: nutrition))
            hosting.view.backgroundColor = .systemGroupedBackground
            nutritionHost = hosting
            nutritionView = hosting.view
        } else {
            nutritionView = nil
        }

        let accountView: UIView?
        if let account {
            let hosting = UIHostingController(rootView: AccountHost(coordinator: account))
            hosting.view.backgroundColor = .systemGroupedBackground
            accountHost = hosting
            accountView = hosting.view
        } else {
            accountView = nil
        }

        let overlayView: UIView?
        if Self.webPagesMode {
            let hosting = UIHostingController(rootView: WebPagesOverlay(store: store, nutrition: nutrition, training: training,
                                                                         progress: progress, activity: activity))
            hosting.sizingOptions = .intrinsicContentSize
            hosting.view.backgroundColor = .clear
            overlayHost = hosting
            overlayView = hosting.view
        } else {
            overlayView = nil
        }

        statusFill.backgroundColor = .systemGroupedBackground
        header.view.backgroundColor = .systemGroupedBackground
        overview.view.backgroundColor = .systemGroupedBackground

        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        tabBar.standardAppearance = appearance
        tabBar.scrollEdgeAppearance = appearance
        tabBar.tintColor = .systemBlue
        tabBar.delegate = self

        host.addChild(header)
        host.addChild(overview)
        if let trainingHost { host.addChild(trainingHost) }
        if let nutritionHost { host.addChild(nutritionHost) }
        if let accountHost { host.addChild(accountHost) }
        if let overlayHost { host.addChild(overlayHost) }
        webView.translatesAutoresizingMaskIntoConstraints = false
        var installed: [UIView] = [statusFill, header.view, overview.view]
        let optionalViews: [UIView?] = [trainingView, nutritionView, accountView, overlayView]
        installed += optionalViews.compactMap { $0 }
        installed.append(tabBar)
        for view in installed {
            view.translatesAutoresizingMaskIntoConstraints = false
            view.isHidden = true
            root.addSubview(view)
        }
        header.didMove(toParent: host)
        overview.didMove(toParent: host)
        // Inhaltsbereiche füllen immer genau den Platz zwischen Kopf und Leiste; ihre SwiftUI-Idealhöhe zählt nicht.
        for content in [overview.view, trainingView, nutritionView, accountView] as [UIView?] {
            content?.setContentHuggingPriority(UILayoutPriority(1), for: .vertical)
            content?.setContentCompressionResistancePriority(UILayoutPriority(1), for: .vertical)
        }
        let headerHeight = header.view.heightAnchor.constraint(equalToConstant: 60)
        headerHeight.priority = .required
        headerHeight.isActive = true
        headerHeightConstraint = headerHeight
        trainingHost?.didMove(toParent: host)
        nutritionHost?.didMove(toParent: host)
        accountHost?.didMove(toParent: host)
        overlayHost?.didMove(toParent: host)
        if let overlayView {
            let height = overlayView.heightAnchor.constraint(equalToConstant: 0)
            height.priority = .required
            overlayHeightConstraint = height
            NSLayoutConstraint.activate([
                height,
                overlayView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                overlayView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                overlayView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
            ])
        }
        if let accountView {
            NSLayoutConstraint.activate([
                accountView.topAnchor.constraint(equalTo: header.view.bottomAnchor),
                accountView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                accountView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                accountView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
            ])
        }
        if let nutritionView {
            NSLayoutConstraint.activate([
                nutritionView.topAnchor.constraint(equalTo: header.view.bottomAnchor),
                nutritionView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                nutritionView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                nutritionView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
            ])
        }
        if let trainingView {
            NSLayoutConstraint.activate([
                trainingView.topAnchor.constraint(equalTo: header.view.bottomAnchor),
                trainingView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
                trainingView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
                trainingView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
            ])
        }

        let headerView: UIView = header.view
        let overviewView: UIView = overview.view
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),

            statusFill.topAnchor.constraint(equalTo: root.topAnchor),
            statusFill.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            statusFill.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            statusFill.bottomAnchor.constraint(equalTo: headerView.topAnchor),

            headerView.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: root.trailingAnchor),

            overviewView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            overviewView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            overviewView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            overviewView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),

            // UITabBar bringt seine Höhe inklusive Home-Indikator-Bereich selbst mit.
            tabBar.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ])
        inactiveConstraints = [
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),
        ]
        activeConstraints = [
            webView.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            webView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
        ]
        webPageConstraints = [
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.bottomAnchor.constraint(equalTo: tabBar.topAnchor),
        ]
        NSLayoutConstraint.activate(inactiveConstraints)
        observeStore()
    }

    /// Kopfhöhe auf die natürliche SwiftUI-Höhe bei aktueller Breite setzen (nach jedem Layout: Drehen, Dynamic Type,
    /// Sprach-/Titelwechsel). Aufruf aus `viewDidLayoutSubviews` des Hosts.
    func layoutHeader() {
        guard let header = headerHost, let constraint = headerHeightConstraint, let root = host?.viewIfLoaded,
              root.bounds.width > 0 else { return }
        // Hybrid-Overlay: natürliche Höhe bei voller Breite (mehrzeilige Hinweise), ohne Inhalt 0 pt.
        if let overlay = overlayHost, let overlayHeight = overlayHeightConstraint {
            let size = overlay.sizeThatFits(in: CGSize(width: root.bounds.width, height: root.bounds.height / 2))
            if size.height.isFinite, size.height >= 0 {
                let height = min(ceil(size.height), root.bounds.height / 2)
                if abs(overlayHeight.constant - height) > 0.5 { overlayHeight.constant = height }
            }
        }
        let fitting = header.sizeThatFits(in: CGSize(width: root.bounds.width, height: UIView.layoutFittingExpandedSize.height))
        // Nie mehr als ein Drittel des Bildschirms; ungültige Messung → alte Höhe behalten.
        guard fitting.height.isFinite, fitting.height > 0 else { return }
        let height = min(ceil(fitting.height), max(44, root.bounds.height / 3))
        if abs(constraint.constant - height) > 0.5 {
            constraint.constant = height
        }
        #if DEBUG
        if !root.traitCollection.preferredContentSizeCategory.isAccessibilityCategory, root.bounds.height >= 600 {
            assert(header.view.bounds.height < 200, "Seitenkopf zu hoch: \(header.view.bounds.height) pt")
        }
        #endif
    }

    /// Re-registriert sich nach jeder Änderung (iOS 17: keine automatische UIKit-Beobachtung).
    private func observeStore() {
        withObservationTracking {
            applyStoreState()
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in self?.observeStore() }
        }
    }

    private func applyStoreState() {
        if store.documentHello == nil {
            // Neues Dokument: dessen Web-Leiste ist sichtbar, bis Native wieder `true` meldet.
            chromeSent = nil
            chromeRejected = false
        }
        // Jedes Hello (auch inhaltsgleich nach pagehide/pageshow) widerruft im Web die Bestätigung:
        // erneut bestätigen, sobald die Leiste sichtbar ist; eine frühere Ablehnung gilt nicht mehr.
        var reconfirm = false
        if store.helloCount != handledHello {
            handledHello = store.helloCount
            chromeSent = nil
            chromeRejected = false
            reconfirm = true
        }
        // Abgelehnte Übernahme gilt bis zum nächsten Bereitschaftswechsel (neues Hello/Dokument).
        if !store.webOffersNativeTabs { chromeRejected = false }
        let active = store.webOffersNativeTabs && !chromeRejected
        let projection = store.currentProjection
        let chrome = store.webChrome
        state.isBlocked = chrome?.blocking == true
        updateWorkoutFlow()
        updateFoodFlow()
        if restoreOverviewAfterFlow {
            if state.isBlocked {
                flowWasBlocking = true
            } else if flowWasBlocking {
                restoreOverviewAfterFlow = false
                flowWasBlocking = false
                if state.selected == .home { homeShowsWeb = false }
            }
        }
        let hideBars = active && chrome?.hidesNativeBars == true
        if let navigation = store.webNavigation, navigation.token != handledNavigation {
            handledNavigation = navigation.token
            handleWebNavigation(navigation)
        }
        state.fallbackLanguage = store.document["language"]?.stringValue == "en" ? "en" : "de"
        if let tabs = projection?.overview.tabs.compactMap({ RootTab(rawValue: $0.id) }), tabs.contains(.home) {
            state.tabs = tabs
        }
        // Einträge vor dem Einblenden setzen, damit nie eine leere Leiste bestätigt wird.
        rebuildItems(language: projection?.overview.language ?? state.fallbackLanguage)
        for item in tabBar.items ?? [] { item.isEnabled = !state.isBlocked }
        // Auch ohne native Leiste: Fenster (und damit WebView/Statusleiste) folgen dem Web-Wunsch.
        updateScheme(projection)
        applyWindowStyle()
        // Hybrid nur mit Schalter, aktiver Leiste und Web-Zusage in diesem Dokument (alter Web-Stand: bisheriges Verhalten).
        let webPages = active && Self.webPagesMode && store.webOffersWebPages
        if active != isActive || hideBars != barsHiddenForSession || webPages != self.webPages {
            setActive(active, hideBars: hideBars, webPages: webPages)
        } else if reconfirm, isActive, !barsHiddenForSession {
            sendChrome(true)
        }
        // Liest `webOffersOverview` innerhalb der Beobachtung.
        updateVisibility()
        checkReady()
    }

    /// Startbildschirm darf weg: native Leiste sichtbar und der sichtbare native Tab hat seine erste Projektion
    /// (sonst zeigt er nur „wird geladen“), oder das Dokument hat sich gemeldet und bleibt im Web-Modus
    /// (Anmeldung, ungeklärte Zuordnung, alter Web-Stand, abgelehnte Übernahme). Höchstzeit regelt der Host.
    private func checkReady() {
        guard !reportedReady, let onReady else { return }
        let ready: Bool
        if isActive {
            if barsHiddenForSession || state.isBlocked {
                ready = true
            } else if showsNativeOverview {
                ready = store.currentProjection != nil
            } else if showsNativeNutrition {
                ready = nutrition?.projection != nil
            } else if showsNativeTraining || showsNativeAccount {
                ready = true
            } else {
                // Web-Seite im Tab (z. B. Konto ohne nativen Bereich): sie ist mit dem Hello bereits gezeichnet.
                ready = store.documentHello != nil
            }
        } else {
            ready = store.documentHello != nil && (!store.webOffersNativeTabs || chromeRejected)
        }
        guard ready else { return }
        reportedReady = true
        onReady()
    }

    private func setActive(_ active: Bool, hideBars: Bool, webPages: Bool = false) {
        let wasActive = isActive
        isActive = active
        barsHiddenForSession = hideBars
        self.webPages = webPages && active
        progress?.windowsOverWeb = self.webPages
        if !self.webPages { progress?.window = nil }
        if active, !wasActive, let page = store.currentWebPage, let tab = RootTab(rawValue: page), tab != .add {
            state.selected = tab
        }
        let barsVisible = active && !hideBars
        let target = !barsVisible ? inactiveConstraints : self.webPages ? webPageConstraints : activeConstraints
        NSLayoutConstraint.deactivate(inactiveConstraints + activeConstraints + webPageConstraints)
        NSLayoutConstraint.activate(target)
        tabBar.isHidden = !barsVisible
        applyStacking()
        updateChromeViews()
        host?.view.layoutIfNeeded()
        // Sichtbar → `true`; versteckt (auch für eine Session/Aktivität) → `false`. Während `session`/`run` hält
        // das Web seine Leiste dann selbst ausgeblendet; danach bestätigt Native erneut mit `true`.
        if barsVisible {
            sendChrome(true)
        } else if store.documentHello != nil {
            sendChrome(false)
        }
        onStyleChange?()
    }

    /// `pulsNativeSetChrome`, je Dokument nur bei Änderung. Lehnt das Web `true` ab, fällt Native zurück.
    private func sendChrome(_ visible: Bool) {
        guard chromeSent != visible else { return }
        chromeSent = visible
        bridge.setChrome(visible) { [weak self] accepted in
            guard let self, visible, !accepted, self.chromeSent == true else { return }
            self.chromeRejected = true
            self.chromeSent = nil
            self.setActive(false, hideBars: false)
            self.updateVisibility()
            self.checkReady()
        }
    }

    // MARK: Hybrid (Protokoll §16)

    /// Ebenen: im Hybrid liegen Trainings- und Essen-Host **hinter** der deckenden WebView („Hinterbühne“). Sie bleiben
    /// eingeblendet, damit ihre Blätter (Session-Start, Routineneditor, Suche, Detail …) ohne doppelte Koordinatorlogik
    /// präsentiert werden können. Konto, Kopf, Overlay und Leiste liegen darüber.
    private func applyStacking() {
        guard stackedWebPages != webPages, let root = host?.viewIfLoaded, let webView else { return }
        stackedWebPages = webPages
        // Explizit getypte Teile statt eines großen Ternär-Literals (Typprüfzeit des Compilers).
        let web: UIView = webView
        let status: UIView = statusFill
        let bar: UIView = tabBar
        let overview: UIView? = overviewHost?.view
        let training: UIView? = trainingHost?.view
        let nutrition: UIView? = nutritionHost?.view
        let header: UIView? = headerHost?.view
        let account: UIView? = accountHost?.view
        let overlay: UIView? = overlayHost?.view
        var order: [UIView?] = []
        if webPages {
            order = [overview, training, nutrition, web, status, header, account, overlay, bar]
        } else {
            order = [web, status, header, overview, training, nutrition, account, overlay, bar]
        }
        for case let view? in order { root.bringSubviewToFront(view) }
        onStackChange?()
    }

    /// Statusfläche und nativer Seitenkopf: bisher auf allen Tabs, im Hybrid nur über dem nativen Konto.
    private func updateChromeViews() {
        let barsVisible = isActive && !barsHiddenForSession
        let header = barsVisible && (!webPages || showsNativeAccount || accountHold)
        statusFill.isHidden = !header
        headerHost?.view.isHidden = !header
        let accountOnTop: Bool = showsNativeAccount || accountHold
        let overlayVisible: Bool = webPages && barsVisible && !accountOnTop
        overlayHost?.view.isHidden = !overlayVisible
    }

    /// `openNative{screen:'window'}`: natives Fenster über der Web-Seite. Kann Native es nicht zeigen, führt das Web
    /// den ursprünglichen Einstieg selbst aus (`pulsNativeWebFallback(token)`) – nie ein toter Knopf.
    func openWindow(_ open: OpenNativeMessage) {
        _ = store.consumeScreenRequest()
        // Ein Blatt ist schon offen (Doppeltipp): nichts doppelt zeigen und keinen Web-Dialog darunter öffnen.
        if let host, host.presentedViewController != nil, isActive { return }
        if webPages, isActive, !barsHiddenForSession, !state.isBlocked, showWindow(open) {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            return
        }
        if let token = open.token { bridge.webFallback(token: token) }
    }

    private func showWindow(_ open: OpenNativeMessage) -> Bool {
        switch open.window {
        case "food":
            guard let nutrition, nutritionSearchAvailable, nutrition.canWrite else { return false }
            switch open.tab ?? "search" {
            case "search":
                nutrition.present(.search)
            case "recipes":
                nutrition.searchScopeRequest = .recipes
                nutrition.present(.search)
            case "barcode":
                guard nutrition.nativeBarcode else { return false }
                nutrition.present(.barcode)
            case "photo":
                guard nutrition.nativeLabel else { return false }
                nutrition.present(.label)
            case "custom":
                guard nutrition.nativeProductSave else { return false }
                nutrition.present(.custom)
            default:
                return false
            }
            return true
        case "foodEntry":
            guard let nutrition, let id = open.id else { return false }
            return nutrition.handleOverviewAction("editFood", id: id)
        case "foodProduct":
            guard let nutrition, nutritionSearchAvailable, nutrition.canWrite, let id = open.id else { return false }
            nutrition.suggestedAmount = open.amount
            nutrition.present(.product(.id(id)))
            return true
        case "waterGoal":
            guard let nutrition, nutrition.isOffered, nutrition.canWrite else { return false }
            nutrition.present(.waterGoal)
            return true
        case "weight":
            return openWeightEditor?(open.date ?? store.currentProjection?.overview.date) == true
        case "startWorkout":
            guard let training, progress != nil || trainingHost != nil else { return false }
            progress?.segment = .training
            return training.requestEmptyStart()
        case "startRoutine":
            guard let training, let id = open.id else { return false }
            return training.handleOverviewAction("startRoutine", id: id)
        case "routine":
            guard let training else { return false }
            progress?.segment = .training
            return training.openRoutineEditor(id: open.id)
        case "workoutReview":
            guard let progress, progress.offersAny, let id = open.id else { return false }
            progress.openWindow(.route(.workout(id: id, name: open.title ?? "")))
            return true
        case "exerciseHistory":
            guard let progress, progress.offersAny, let id = open.id else { return false }
            progress.openWindow(.route(.exercise(id: id, name: open.title ?? "")))
            return true
        case "indexChart":
            guard let progress, progress.offersProgress, progress.offersIndexChart else { return false }
            progress.openWindow(.route(.indexChart))
            return true
        case "weeklyGoals":
            guard let progress, progress.offersProgress, progress.canWrite else { return false }
            progress.openWindow(.weeklyGoals)
            return true
        case "runDetail":
            guard let activity, activity.isOffered, let id = open.id else { return false }
            activity.detail = ActivityDetailRequest(id: id, title: open.title ?? "")
            return true
        case "routes":
            guard let activity, activity.isOffered else { return false }
            activity.showsRoutes = true
            return true
        case "date":
            return presentDatePicker(day: open.date ?? store.currentProjection?.overview.date)
        default:
            return false
        }
    }

    /// Datumswahl wie der native Kopf, als Blatt über der Web-Seite.
    private func presentDatePicker(day: String?) -> Bool {
        guard let host, host.viewIfLoaded?.window != nil, host.presentedViewController == nil else { return false }
        let initial = day.flatMap { WeightDay.date(from: $0) } ?? Date()
        let sheet = DayPickerSheet(initial: initial, text: currentText, onPick: { [weak self] day in
            self?.host?.dismiss(animated: true)
            self?.setDate(day)
        }, onClose: { [weak self] in
            self?.host?.dismiss(animated: true)
        })
        let controller = UIHostingController(rootView: sheet)
        controller.overrideUserInterfaceStyle = style
        controller.modalPresentationStyle = .pageSheet
        controller.sheetPresentationController?.detents = [.medium(), .large()]
        host.present(controller, animated: true)
        return true
    }

    /// Essen-Seite zeigen (Hybrid: Web-Seite, sonst wie bisher der Tab).
    private func showFoodPage() {
        if let target = NavigationTarget(page: "food") { perform(target) }
    }

    // MARK: Sichtbarkeit

    private var showsNativeOverview: Bool {
        // Ein offener Web-Ablauf (`chrome.blocking`) wird nie von der nativen Übersicht überdeckt.
        !webPages && isActive && !barsHiddenForSession && !state.isBlocked && state.selected == .home && !homeShowsWeb
            && store.webOffersOverview
    }

    /// M4: nativer Trainings-Tab; nie über einem offenen Web-Ablauf oder der Web-Abschlussansicht.
    private var showsNativeTraining: Bool {
        guard !webPages, let training, isActive, !barsHiddenForSession, !state.isBlocked, state.selected == .workout,
              !workoutShowsWeb, !workoutFlowHidden else { return false }
        // M5: auch ohne Trainings-Projektion, wenn Kalender/Fortschritt nativ angeboten werden.
        // M6: nach dem Speichern einer Aktivität zeigt das Web seinen Endscreen; bis dahin nicht überdecken.
        return (training.isAvailable || progress?.offersAny == true) && !training.awaitingWebCompletion
            && activity?.awaitingWebCompletion != true
    }

    /// M8: nativer Konto-Tab; nie über einem offenen Web-Ablauf (Auth-/Bestätigungs-Sheets bleiben sichtbar).
    private var showsNativeAccount: Bool {
        guard let account, isActive, !barsHiddenForSession, !state.isBlocked, state.selected == .account,
              !accountShowsWeb else { return false }
        return account.isOffered
    }

    /// M8 Web-Ausweg aus dem Konto: native Ansicht vor dem Aufruf ausblenden; die Web-Kontoseite bleibt sichtbar, bis
    /// „Konto“ bewusst neu gewählt wird. Lehnt das Web ab (Sperre, nicht verfügbar), kehrt die native Ansicht zurück.
    func openAccountWeb(_ exit: AccountWebExit) {
        guard !state.isBlocked else { return }
        state.selected = .account
        accountShowsWeb = true
        // Ein `navigate{page:'account'}`-Echo dieses Ausstiegs (ohne `web`) darf die Web-Ansicht nicht wieder überdecken.
        accountExitUntil = Date().addingTimeInterval(3)
        updateVisibility()
        let restore: @MainActor (Bool) -> Void = { [weak self] accepted in
            guard let self, !accepted else { return }
            self.accountShowsWeb = false
            self.updateVisibility()
            if let account = self.account {
                account.notice = TrainingNotice(text: account.text("Das ist in PULS gerade nicht möglich.", "This is not possible in PULS right now."))
            }
        }
        switch exit {
        case .action(let target):
            bridge.navigateAccount(target, completion: restore)
        case .section(let section):
            guard let target = NavigationTarget(page: "account", section: section, web: true) else { return restore(false) }
            bridge.navigate(target, completion: restore)
        case .overview:
            guard let target = NavigationTarget(page: "account", web: true) else { return restore(false) }
            bridge.navigate(target, completion: restore)
        }
    }

    /// M8: Konto-Tab nativ wählen (z. B. nach `openNative{screen:'account'}`), ohne Web-Navigation.
    func selectAccountTab() {
        guard !state.isBlocked else { return }
        state.selected = .account
        accountShowsWeb = false
        updateVisibility()
    }

    /// M8: `openNative{screen:'account'}` kann nur nativ gezeigt werden, wenn Leiste und Konto aktiv sind.
    var canShowNativeAccount: Bool {
        isActive && !barsHiddenForSession && !state.isBlocked && account?.isOffered == true
    }

    /// M7: nativer Essen-Tab; nie über einem offenen Web-Ablauf.
    private var showsNativeNutrition: Bool {
        guard !webPages, let nutrition, isActive, !barsHiddenForSession, !state.isBlocked, state.selected == .food,
              !foodShowsWeb, !foodFlowHidden else { return false }
        return nutrition.isOffered
    }

    /// M7 Web-Ausweg aus dem Essen-Tab. Seiten (Web-Tagebuch, Planziele) zeigen die Web-Seite bis zur bewussten Tabwahl;
    /// Aktionen (Essensdialog, Eintrag bearbeiten) verdecken die native Ansicht nur für die Dauer des Web-Dialogs.
    func openNutritionWeb(_ target: NavigationTarget) {
        guard !state.isBlocked else { return }
        if case .page = target {
            perform(target)
            return
        }
        foodFlowHidden = true
        foodFlowSawBlocking = false
        foodFlowToken += 1
        let token = foodFlowToken
        updateVisibility()
        bridge.navigate(target) { [weak self] accepted in
            guard let self, !accepted else { return }
            self.foodFlowHidden = false
            self.updateVisibility()
            if let nutrition = self.nutrition {
                nutrition.notice = TrainingNotice(text: nutrition.text("Das ist in PULS gerade nicht möglich.",
                                                                       "This is not possible in PULS right now."))
            }
        }
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, self.foodFlowToken == token, !self.foodFlowSawBlocking, self.foodFlowHidden else { return }
            self.foodFlowHidden = false
            self.updateVisibility()
        }
    }

    private func updateFoodFlow() {
        guard foodFlowHidden else { return }
        if state.isBlocked {
            foodFlowSawBlocking = true
        } else if foodFlowSawBlocking {
            foodFlowHidden = false
            foodFlowSawBlocking = false
        }
    }

    /// M7: Essen-Tab wählen (z. B. „Essen eintragen“ aus der Übersicht), nativ.
    func selectFoodTab() {
        // Hybrid: Fenster öffnen sich über der aktuellen Web-Seite; danach steht man wieder genau dort.
        if webPages { return }
        if let target = NavigationTarget(page: "food") { perform(target) }
    }

    /// M6 Web-Ausweg aus den Aktivitäten (Routenplaner, Web-Detail). Native Ansichten sind bereits geschlossen.
    func openActivityWeb(_ target: ActivityNavigation) {
        guard !state.isBlocked else { return }
        if state.selected == .home {
            homeShowsWeb = true
            restoreOverviewAfterFlow = true
            flowWasBlocking = false
        } else {
            beginWorkoutFlow()
        }
        updateVisibility()
        bridge.navigateActivity(target) { [weak self] accepted in
            guard let self, !accepted else { return }
            self.workoutFlowHidden = false
            if self.restoreOverviewAfterFlow {
                self.restoreOverviewAfterFlow = false
                self.homeShowsWeb = false
            }
            self.updateVisibility()
            if let activity = self.activity {
                activity.notice = TrainingNotice(text: activity.text("Das ist in PULS gerade nicht möglich.", "This is not possible in PULS right now."))
            }
        }
    }

    // MARK: M5 Web-Auswege und Interesse

    /// Web-Ausweg aus Kalender/Fortschritt (§10.5). Seitenwechsel (`calendar`/`progress`/`records`/`editWorkout`) zeigen
    /// die Web-Trainingsseite bis zur bewussten Tabwahl; Dialoge/Review verdecken die native Ansicht nur für ihre Dauer.
    func openProgressWeb(_ target: ProgressNavigation) {
        guard !state.isBlocked else { return }
        let previousShowsWeb = workoutShowsWeb
        if target.changesPage {
            state.selected = .workout
            workoutShowsWeb = true
        } else {
            beginWorkoutFlow()
        }
        updateVisibility()
        bridge.navigateProgress(target) { [weak self] accepted in
            guard let self, !accepted else { return }
            // Abgelehnt (Web-Sperre, Ziel fehlt): native Ansicht wieder zeigen.
            self.workoutShowsWeb = previousShowsWeb
            self.workoutFlowHidden = false
            self.updateVisibility()
            if let progress = self.progress {
                let text = progress.text
                progress.notice = TrainingNotice(text: text("Das ist in PULS gerade nicht möglich.", "This is not possible in PULS right now."))
            }
        }
    }

    private func beginWorkoutFlow() {
        workoutFlowHidden = true
        workoutFlowSawBlocking = false
        workoutFlowToken += 1
        let token = workoutFlowToken
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            guard let self, self.workoutFlowToken == token, !self.workoutFlowSawBlocking else { return }
            self.workoutFlowHidden = false
            self.updateVisibility()
        }
    }

    private func updateWorkoutFlow() {
        guard workoutFlowHidden else { return }
        if state.isBlocked {
            workoutFlowSawBlocking = true
        } else if workoutFlowSawBlocking {
            workoutFlowHidden = false
            workoutFlowSawBlocking = false
        }
    }

    /// `pulsNativeSetInterest`: Projektionen der gerade sichtbaren nativen Bildschirme. `overview` immer, solange die
    /// native Leiste aktiv ist (Seitenkopf/Datum lesen sie auf allen Tabs). `training` für Trainings-Tab, Session,
    /// laufendes Workout und bis zur ersten Trainings-Projektion (Übersichts-Einstiege brauchen sie). `progress` nur bei
    /// sichtbarem Kalender/Fortschritt.
    private func reportInterest() {
        guard let hello = store.documentHello, !hello.ownerPending else { return }
        // Nur Projektionen, die dieses Dokument laut Hello anbietet (sonst lehnt das Web die ganze Liste ab).
        let offered = Set(hello.projections)
        let activityOffered = activity != nil && offered.contains(ActivityProjectionMessage.activityName)
        guard isActive else {
            // Ohne native Leiste gilt das Web-Standardinteresse (Übersicht + Training) unverändert. Nur wenn das Web
            // native Aktivitäten anbietet, meldet Native diesen Standard ausdrücklich, ergänzt um `activity` bei Bedarf.
            guard activityOffered, let activity else { return }
            var names: Set<String> = [ProjectionMessage.overviewName, TrainingProjectionMessage.trainingName]
            if activity.needsProjection { names.insert(ActivityProjectionMessage.activityName) }
            bridge.setInterest(ProjectionInterest(names.intersection(offered)), hello: store.helloCount)
            return
        }
        var names: Set<String> = [ProjectionMessage.overviewName]
        let workoutVisible = showsNativeTraining
        // Eine native Session verdeckt Kalender/Fortschritt vollständig.
        let sessionOpen = training?.sessionWorkoutId != nil
        // M6: Aktivitäten für Vollbild/Routen/Detail sowie die Karte im sichtbaren Bereich „Training“.
        if let activity, activityOffered {
            let cardVisible = workoutVisible && !sessionOpen && (progress?.effectiveSegment ?? .training) == .training
                && (progress?.path.isEmpty ?? true)
            if activity.needsProjection || cardVisible { names.insert(ActivityProjectionMessage.activityName) }
        }
        if let training {
            if workoutVisible || sessionOpen || training.awaitingWebCompletion
                || store.trainingProjection == nil || training.training?.active != nil {
                names.insert(TrainingProjectionMessage.trainingName)
            }
        }
        // Hybrid: Web-Einstiege (Training starten/fortsetzen) brauchen die Trainings-Projektion auf jeder Seite.
        if webPages, training != nil { names.insert(TrainingProjectionMessage.trainingName) }
        if workoutVisible || webPages, !sessionOpen, progress?.needsProgressProjection == true {
            names.insert(ProgressProjectionMessage.progressName)
        }
        // M7: Ernährung nur, solange der native Essen-Tab sichtbar ist (bei Verlassen widerrufen); im Hybrid, solange
        // ein Essen-Fenster offen ist.
        if showsNativeNutrition || (webPages && nutrition?.sheet != nil) {
            names.insert(NutritionProjectionMessage.nutritionName)
        }
        // M8: Konto nur, solange der native Konto-Tab sichtbar ist (bei Verlassen widerrufen).
        if showsNativeAccount { names.insert(AccountProjectionMessage.accountName) }
        bridge.setInterest(ProjectionInterest(names.intersection(offered)), hello: store.helloCount)
    }

    private func updateVisibility() {
        let showOverview = showsNativeOverview
        let showTraining = showsNativeTraining
        let showNutrition = showsNativeNutrition
        let showAccount = showsNativeAccount || accountHold
        // Hybrid: Hinterbühne (siehe `applyStacking`) – sichtbar für Blätter, aber nicht für VoiceOver.
        let backstage = webPages
        nutritionHost?.view.isHidden = !(showNutrition || backstage)
        nutritionHost?.view.accessibilityElementsHidden = backstage && !showNutrition
        accountHost?.view.isHidden = !showAccount
        // Seitenkopf: Unterseite des nativen Kontos bzw. der Web-Kontoseite.
        let nativeSection = showAccount ? account?.visibleSection : nil
        if state.accountNative != showAccount { state.accountNative = showAccount }
        if state.nativeAccountSection != nativeSection { state.nativeAccountSection = nativeSection }
        overviewHost?.view.isHidden = !showOverview
        // M5: Rückkehr aus einem Web-Ablauf/anderen Tab: sichtbare Monate/Details neu laden (Web könnte geändert haben).
        if showTraining, trainingHost?.view.isHidden == true { progress?.refreshToken += 1 }
        trainingHost?.view.isHidden = !(showTraining || backstage)
        trainingHost?.view.accessibilityElementsHidden = backstage && !showTraining
        // Verdeckte Web-Inhalte nicht für VoiceOver erreichbar lassen; die WebView selbst bleibt sichtbar.
        webView?.accessibilityElementsHidden = showOverview || showTraining || showNutrition || showAccount
        updateChromeViews()
        syncSelection()
        reportInterest()
    }

    /// M4: Trainings-Tab wählen (z. B. „Alle Routinen“ aus der Übersicht).
    func selectWorkoutTab() {
        if let target = NavigationTarget(page: "workout") { perform(target) }
    }

    /// M4: Web-Trainingsseite (Kalender, Rekorde, Rückblick) zeigen, bis der Tab bewusst neu gewählt wird.
    func showWebWorkout() {
        if let target = NavigationTarget(page: "workout", web: true) { perform(target) }
    }

    // MARK: Tab-Leiste

    private func rebuildItems(language: String) {
        let tabs = state.tabs
        let key = tabs.map(\.rawValue).joined(separator: ",") + "|" + language
        guard key != itemsKey else { return }
        itemsKey = key
        let text = OverviewText(language: language, locale: nil)
        tabBar.items = tabs.enumerated().map { index, tab in
            let item: UITabBarItem
            if tab == .add {
                // Gerätetest ipa-42: Plus ist eine Aktion, kein Tab. Eigenes, immer gleich aussehendes Symbol (Akzentkreis)
                // statt Auswahlzustand; die Auswahl bleibt beim aktuellen Tab (`syncSelection` im Delegate, noch vor
                // dem nächsten Zeichnen), daher wird nie ein anderer Tab markiert.
                let symbol = UIImage(systemName: "plus.circle.fill",
                                     withConfiguration: UIImage.SymbolConfiguration(scale: .large))?
                    .withTintColor(.systemBlue, renderingMode: .alwaysOriginal)
                item = UITabBarItem(title: tab.label(text), image: symbol, selectedImage: symbol)
                item.accessibilityHint = text("Öffnet das Menü zum Hinzufügen", "Opens the add menu")
                item.accessibilityTraits = .button
            } else {
                item = UITabBarItem(
                    title: tab.label(text),
                    image: UIImage(systemName: tab.symbol),
                    selectedImage: UIImage(systemName: tab.selectedSymbol)
                )
            }
            item.tag = index
            return item
        }
        syncSelection()
    }

    private func syncSelection() {
        guard let items = tabBar.items, let index = state.tabs.firstIndex(of: state.selected),
              items.indices.contains(index) else { return }
        if tabBar.selectedItem !== items[index] {
            tabBar.selectedItem = items[index]
        }
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard state.tabs.indices.contains(item.tag), !state.isBlocked else {
            syncSelection()
            return
        }
        let tab = state.tabs[item.tag]
        switch tab {
        case .add:
            // Plus ist kein Seitentab: Auswahl bleibt sofort beim aktuellen Tab, das native Menü öffnet sich darüber.
            syncSelection()
            presentQuickAdd()
        case .home:
            // Bewusste Wahl der Übersicht: wieder nativ, das Web geht im Hintergrund ebenfalls auf „home“.
            if let target = NavigationTarget(page: "home") { perform(target) }
        default:
            if let page = tab.page, let target = NavigationTarget(page: page) { perform(target) }
        }
        UISelectionFeedbackGenerator().selectionChanged()
    }

    // MARK: Plus (Schnell hinzufügen)

    private var currentText: OverviewText {
        let overview = store.currentProjection?.overview
        return OverviewText(language: overview?.language ?? state.fallbackLanguage, locale: overview?.locale)
    }

    /// Natives Plus-Menü. Kann es nicht gezeigt werden (anderes Blatt offen), bleibt das bisherige Web-Menü als Ausweg.
    func presentQuickAdd() {
        guard !state.isBlocked else { return }
        if let open = quickAddController, open.presentingViewController != nil, !open.isBeingDismissed { return }
        guard let host, host.viewIfLoaded?.window != nil, host.presentedViewController == nil, !host.isBeingDismissed else {
            if let quickAdd = NavigationTarget(action: "quickAdd") { perform(quickAdd) }
            return
        }
        let sheet = QuickAddSheet(
            text: currentText,
            entries: quickAddEntries(),
            onSelect: { [weak self] item in self?.finishQuickAdd(item) },
            onClose: { [weak self] in self?.finishQuickAdd(nil) }
        )
        let controller = UIHostingController(rootView: sheet)
        controller.overrideUserInterfaceStyle = style
        controller.modalPresentationStyle = .pageSheet
        if let presentation = controller.sheetPresentationController {
            // Neun Einträge passen bei Standardschrift ohne Scrollen; größere Schrift scrollt bzw. nutzt „groß“.
            let fitted = UISheetPresentationController.Detent.custom(identifier: .init("pulsQuickAdd")) { context in
                min(660, context.maximumDetentValue)
            }
            presentation.detents = [fitted, .large()]
            presentation.prefersGrabberVisible = true
        }
        quickAddController = controller
        host.present(controller, animated: true)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    /// Jeder Eintrag nativ, wenn der passende Ablauf gemeldet ist; sonst mit Web-Markierung.
    private func quickAddEntries() -> [QuickAddEntry] {
        let foodNative = nutritionSearchAvailable
        let canWriteFood = nutrition?.canWrite ?? true
        return QuickAddItem.allCases.map { item in
            switch item {
            case .food, .recipe:
                return QuickAddEntry(item: item, opensWeb: !foodNative, enabled: !foodNative || canWriteFood)
            case .barcode:
                return QuickAddEntry(item: item, opensWeb: !(foodNative && nutrition?.nativeBarcode == true),
                                     enabled: !foodNative || canWriteFood)
            case .label:
                return QuickAddEntry(item: item, opensWeb: !(foodNative && nutrition?.nativeLabel == true),
                                     enabled: !foodNative || canWriteFood)
            case .water:
                // Ohne native Ernährung gibt es keinen Web-Einzelaufruf für Wasser: dann der Essen-Tab (Wasserzeile).
                return QuickAddEntry(item: item, opensWeb: nutrition?.isOffered != true,
                                     enabled: nutrition?.isOffered != true || canWriteFood)
            case .weight:
                return QuickAddEntry(item: item, opensWeb: !nativeBodyAvailable)
            case .workout:
                return QuickAddEntry(item: item, opensWeb: !(training?.isAvailable == true))
            case .activity:
                return QuickAddEntry(item: item, opensWeb: !(activity?.isOffered == true))
            case .measurements:
                return QuickAddEntry(item: item, opensWeb: !canShowNativeAccount)
            }
        }
    }

    private var nutritionSearchAvailable: Bool {
        guard let nutrition else { return false }
        return nutrition.isOffered && nutrition.supportsSearch && nutrition.supportsProduct
    }

    private var nativeBodyAvailable: Bool {
        openWeightEditor != nil && !store.ownerPending && store.webInfo?.screens.contains(NativeRouter.bodyScreen) == true
    }

    /// Erst das Menü schließen, dann den Ablauf starten (Blätter/Vollbild brauchen einen freien Präsentierer).
    private func finishQuickAdd(_ item: QuickAddItem?) {
        guard let controller = quickAddController, controller.presentingViewController != nil else {
            quickAddController = nil
            if let item { runQuickAdd(item) }
            return
        }
        controller.dismiss(animated: true) { [weak self] in
            guard let self else { return }
            self.quickAddController = nil
            if let item { self.runQuickAdd(item) }
        }
    }

    private func runQuickAdd(_ item: QuickAddItem) {
        guard !state.isBlocked else { return }
        switch item {
        case .food:
            openNutritionSheet(.search, scope: nil)
        case .recipe:
            openNutritionSheet(.search, scope: .recipes)
        case .barcode:
            openNutritionSheet(nutrition?.nativeBarcode == true ? .barcode : nil, scope: nil)
        case .label:
            openNutritionSheet(nutrition?.nativeLabel == true ? .label : nil, scope: nil)
        case .water:
            addWaterQuick()
        case .weight:
            addWeight(fallback: NavigationTarget(action: "addWeight"))
        case .workout:
            // Wie `quickAddWorkout`: laufendes Training fortsetzen, sonst Trainings-Tab (Routinen, freies Training).
            if let training, let active = training.training?.active,
               training.handleOverviewAction("resumeWorkout", id: active.id) {
                return
            }
            selectWorkoutTab()
        case .activity:
            if let activity, activity.isOffered {
                activity.openStart()
            } else if let target = ActivityNavigation(action: "activity") {
                openActivityWeb(target)
            }
        case .measurements:
            if let account, canShowNativeAccount {
                account.openFromWeb(section: AccountRoute.body.rawValue)
            } else if let target = NavigationTarget(page: "account", section: NativeRouter.bodyScreen, web: true) {
                perform(target)
            }
        }
    }

    /// Essen-Tab nativ wählen und dasselbe Blatt wie dort öffnen; `nil` bzw. ohne native Suche: Web-Essensdialog.
    private func openNutritionSheet(_ sheet: NutritionSheet?, scope: NutritionSearchScope?) {
        guard let nutrition, nutritionSearchAvailable else {
            if let target = NavigationTarget(action: "addFood") { perform(target) }
            return
        }
        selectFoodTab()
        guard let sheet else {
            // Wie derselbe Eintrag im Essen-Tab, solange der native Ablauf fehlt.
            nutrition.openWebAdd()
            return
        }
        if let scope { nutrition.searchScopeRequest = scope }
        nutrition.present(sheet)
    }

    /// „Wasser +250 ml“ für den gewählten Tag. Ohne native Ernährung bzw. bei Fehler: Essen-Tab mit Wasserzeile/Hinweis.
    private func addWaterQuick() {
        guard let nutrition, nutrition.isOffered,
              let day = store.currentProjection?.overview.date ?? nutrition.projection?.date else {
            showFoodPage()
            return
        }
        if nutrition.addWater(on: day) {
            let text = currentText
            UIAccessibility.post(notification: .announcement,
                                 argument: text("250 ml Wasser hinzugefügt", "250 ml of water added"))
        } else {
            showFoodPage()
        }
    }

    /// „Gewicht erfassen“: natives Blatt (M2) für den gewählten Tag, sonst der Web-Ablauf `fallback`.
    private func addWeight(fallback: NavigationTarget?) {
        guard !state.isBlocked else { return }
        if openWeightEditor?(store.currentProjection?.overview.date) == true { return }
        if let fallback { perform(fallback) } else { openBodyScreen() }
    }

    /// „Verlauf ansehen“: der Gesamtverlauf. Nativ nur als Indexchart (N1); solange das Web ihn nicht anbietet, bleibt das
    /// bisherige Web-Ziel `fallback` (die Trainingsanalyse ist nicht derselbe Inhalt).
    private func openProgress(fallback: NavigationTarget) {
        guard !state.isBlocked else { return }
        if let progress, progress.offersProgress, progress.offersIndexChart, training != nil {
            progress.openIndexChart()
            selectWorkoutTab()
            if showsNativeTraining { return }
            progress.path = []
        }
        perform(fallback)
    }

    // MARK: Web → Native

    private func handleWebNavigation(_ navigation: WebNavigationEvent) {
        guard let tab = RootTab(rawValue: navigation.page), tab != .add else { return }
        restoreOverviewAfterFlow = false
        state.selected = tab
        // `go` meldet nur echte Seitenwechsel: ein `home` ohne `web` heißt „Übersicht wurde betreten“.
        // Mit `web:true` bleibt die Web-Übersicht sichtbar (Protokoll: Echo darf sie nicht überdecken).
        if tab == .home { homeShowsWeb = navigation.web }
        if tab == .workout { workoutShowsWeb = navigation.web }
        if tab == .food { foodShowsWeb = navigation.web }
        if tab == .account {
            if navigation.web {
                accountShowsWeb = true
            } else if Date() >= accountExitUntil {
                accountShowsWeb = false
            }
        }
    }

    // MARK: Native → Web

    /// Seiten- oder Aktionsziel. Vor Aktionen wird die native Übersicht ausgeblendet, damit Web-Modals und
    /// Vollbild-Sessions sichtbar sind.
    /// Lehnt das Web ab (`false`, z. B. während `chrome.blocking`), kehrt die Auswahl zum vorherigen Stand zurück.
    func perform(_ target: NavigationTarget) {
        guard !state.isBlocked else { return }
        // M4: Trainings-Einstiege (Fortsetzen, Routine starten, freies Training, Routinen) nativ, wenn verfügbar.
        if case .action(let action, let id) = target, let training, training.handleOverviewAction(action, id: id) {
            return
        }
        // M7: „Essen eintragen“/„Bearbeiten“ aus der Übersicht nativ, wenn verfügbar.
        if case .action(let action, let id) = target, let nutrition, nutrition.handleOverviewAction(action, id: id) {
            return
        }
        // M6: laufende Aktivität aus der Übersicht direkt nativ fortsetzen.
        if case .action("resumeRun", _) = target, let activity, activity.resume() {
            return
        }
        let previousTab = state.selected
        let previousShowsWeb = homeShowsWeb
        // Rückkehr nur vormerken, wenn die Aktion aus der sichtbaren nativen Übersicht startet
        // (nicht aus der Web-Übersicht nach „Verlauf ansehen“ o. Ä.).
        let startedFromNativeOverview = showsNativeOverview
        // Hybrid: Konto verlassen → natives Konto bleibt stehen, bis das Web die neue Seite gezeichnet hat.
        var holdToken: Int?
        if webPages, showsNativeAccount, case .page(let page, _, _) = target, page != RootTab.account.rawValue {
            accountHold = true
            accountHoldToken += 1
            holdToken = accountHoldToken
        }
        switch target {
        case .page(let page, _, let web):
            restoreOverviewAfterFlow = false
            if let tab = RootTab(rawValue: page), tab != .add {
                state.selected = tab
                if tab == .home { homeShowsWeb = web }
                if tab == .workout { workoutShowsWeb = web }
                if tab == .food {
                    foodShowsWeb = web
                    foodFlowHidden = false
                }
                if tab == .account {
                    accountShowsWeb = web
                    if !web { accountExitUntil = .distantPast }
                }
            }
        case .action:
            // Vor dem Aufruf ausblenden, damit Modal/Session sofort sichtbar sind (das `chrome` kommt später).
            if state.selected == .home { homeShowsWeb = true }
            restoreOverviewAfterFlow = startedFromNativeOverview
            flowWasBlocking = false
        }
        updateVisibility()
        bridge.navigate(target) { [weak self] accepted in
            guard let self else { return }
            if let holdToken {
                Task { @MainActor [weak self] in
                    // Ein Frame für das Zeichnen der neuen Web-Seite.
                    try? await Task.sleep(for: .milliseconds(40))
                    guard let self, self.accountHoldToken == holdToken else { return }
                    self.accountHold = false
                    self.updateVisibility()
                }
            }
            guard !accepted else { return }
            // Nur zurücksetzen, wenn inzwischen kein Web-`navigate` die Auswahl bestimmt hat.
            if self.state.selected == (RootTab(rawValue: target.pageName ?? "") ?? previousTab) {
                self.state.selected = previousTab
                self.homeShowsWeb = previousShowsWeb
                self.restoreOverviewAfterFlow = false
                self.flowWasBlocking = false
                self.updateVisibility()
            }
        }
    }

    /// Während `chrome.blocking` liefert das Web `false`; das wird still toleriert.
    private func setDate(_ day: String) {
        guard !state.isBlocked else { return }
        bridge.setDate(day, completion: nil)
    }

    private func showWebHome() {
        if let target = NavigationTarget(page: "home", web: true) { perform(target) }
    }

    private func openBodyScreen() {
        if let openBody, !store.ownerPending, store.webInfo?.screens.contains(NativeRouter.bodyScreen) == true {
            openBody()
        } else if let target = NavigationTarget(page: "account", section: NativeRouter.bodyScreen, web: true) {
            perform(target)
        }
    }

    // MARK: Hell/Dunkel

    /// Gerätewunsch des Webs (`light`/`dark`/`system`) für Fenster und native Ansichten. Die App erzwingt kein Dunkel mehr:
    /// `system` heißt `.unspecified`, dann folgen Native **und** die WebView (`prefers-color-scheme`) der iPhone-Einstellung,
    /// auch bei einem Wechsel zur Laufzeit. Bei `light`/`dark` überschreibt das Fenster, passend zur Web-Darstellung.
    private func updateScheme(_ projection: ProjectionMessage?) {
        // M8: ein gerade nativ gewählter Wunsch gilt sofort, bis der Snapshot ihn bestätigt.
        _ = projection
        let scheme = NativeAppearance.scheme(store) ?? "system"
        guard scheme != schemeKey else { return }
        schemeKey = scheme
        let newStyle: UIUserInterfaceStyle
        switch scheme {
        case "light": newStyle = .light
        case "dark": newStyle = .dark
        default: newStyle = .unspecified
        }
        applyStyle(newStyle)
    }

    /// Fenster nachziehen (beim ersten Aufruf ist die Ansicht evtl. noch nicht im Fenster).
    private func applyWindowStyle() {
        guard let window = host?.view.window, window.overrideUserInterfaceStyle != style else { return }
        window.overrideUserInterfaceStyle = style
    }

    private func applyStyle(_ newStyle: UIUserInterfaceStyle) {
        statusFill.overrideUserInterfaceStyle = newStyle
        tabBar.overrideUserInterfaceStyle = newStyle
        let hosted: [UIView?] = [headerHost?.view, overviewHost?.view, trainingHost?.view, nutritionHost?.view,
                                 accountHost?.view, overlayHost?.view]
        for case let view? in hosted {
            view.overrideUserInterfaceStyle = newStyle
        }
        overlayHost?.overrideUserInterfaceStyle = newStyle
        headerHost?.overrideUserInterfaceStyle = newStyle
        overviewHost?.overrideUserInterfaceStyle = newStyle
        trainingHost?.overrideUserInterfaceStyle = newStyle
        nutritionHost?.overrideUserInterfaceStyle = newStyle
        accountHost?.overrideUserInterfaceStyle = newStyle
        guard newStyle != style else { return }
        style = newStyle
        onStyleChange?()
    }
}

// MARK: - Seitenkopf

struct ShellHeaderHost: View {
    let store: ProfileStore
    let state: ShellState
    let actions: OverviewActions

    var body: some View {
        ShellHeader(state: state, actions: actions)
            .environment(store)
    }
}

/// Large Title der Seite und rechts die Datumsleiste (wie `dsDateBar`), für native und Web-Tabs gemeinsam.
struct ShellHeader: View {
    @Environment(ProfileStore.self) private var store
    let state: ShellState
    let actions: OverviewActions

    var body: some View {
        let overview = store.currentProjection?.overview
        let text = OverviewText(language: overview?.language ?? state.fallbackLanguage, locale: overview?.locale)
        let showsDate = state.selected.showsDateBar && overview != nil
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 8) {
                title(text)
                Spacer(minLength: 8)
                if let overview, showsDate { DateBar(overview: overview, text: text, setDate: actions.setDate) }
            }
            VStack(alignment: .leading, spacing: 2) {
                title(text)
                if let overview, showsDate { DateBar(overview: overview, text: text, setDate: actions.setDate) }
            }
        }
        // Web-Modal/Session offen: Datumswechsel gesperrt (das Web lehnt ihn dann ohnehin ab).
        .disabled(state.isBlocked)
        .padding(.horizontal, 16)
        .padding(.top, 4)
        .padding(.bottom, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Nur so hoch wie der Inhalt; der Host misst diese Höhe (`layoutHeader`).
        .fixedSize(horizontal: false, vertical: true)
        .background(Color(.systemGroupedBackground))
        .environment(\.locale, text.locale)
    }

    private func title(_ text: OverviewText) -> some View {
        let section = state.selected != .account ? nil : state.accountNative ? state.nativeAccountSection : store.webAccountSection
        return Text(section.flatMap(text.accountSectionTitle) ?? state.selected.label(text))
            .font(.largeTitle.bold())
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .accessibilityAddTraits(.isHeader)
    }
}

/// ‹ Datum › und „Zu Heute“. Neuer Tag nur über `pulsNativeSetDate`; die Anzeige folgt der nächsten Projektion.
struct DateBar: View {
    let overview: OverviewProjection
    let text: OverviewText
    let setDate: (String) -> Void
    @State private var pickerDate: Date?

    var body: some View {
        HStack(spacing: 0) {
            step(-1, symbol: "chevron.left", label: text("Vorheriger Tag", "Previous day"))
            Button {
                pickerDate = WeightDay.date(from: overview.date) ?? Date()
            } label: {
                HStack(spacing: 4) {
                    if overview.isToday {
                        Image(systemName: "calendar").accessibilityHidden(true)
                    }
                    Text(text.friendlyDay(overview.date, today: overview.today))
                        .lineLimit(1)
                }
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .accessibilityLabel(text("Datum auswählen", "Choose date") + ": " + text.friendlyDay(overview.date, today: overview.today))
            step(1, symbol: "chevron.right", label: text("Nächster Tag", "Next day"))
            if !overview.isToday {
                Button(text("Zu Heute", "Back to today")) { setDate(overview.today) }
                    .font(.subheadline)
                    .frame(minHeight: 44)
                    .padding(.leading, 4)
            }
        }
        .buttonStyle(.borderless)
        .sheet(isPresented: Binding(get: { pickerDate != nil }, set: { if !$0 { pickerDate = nil } })) {
            DayPickerSheet(initial: pickerDate ?? Date(), text: text) { day in
                pickerDate = nil
                setDate(day)
            }
        }
        .sensoryFeedback(.selection, trigger: overview.date)
    }

    private func step(_ days: Int, symbol: String, label: String) -> some View {
        Button {
            if let day = WeightDay.adding(days: days, to: overview.date) { setDate(day) }
        } label: {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(label)
    }
}

private struct DayPickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selection: Date
    let text: OverviewText
    let onPick: (String) -> Void
    /// Hybrid: von UIKit präsentiert; dann schließt der Präsentierer (nicht `dismiss` der SwiftUI-Umgebung).
    let onClose: (() -> Void)?

    init(initial: Date, text: OverviewText, onPick: @escaping (String) -> Void, onClose: (() -> Void)? = nil) {
        // Einmaliger Startwert der Auswahl.
        _selection = State(initialValue: initial)
        self.text = text
        self.onPick = onPick
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            DatePicker(text("Datum", "Date"), selection: $selection, displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .padding(.horizontal)
                .navigationTitle(text("Datum auswählen", "Choose date"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(text("Abbrechen", "Cancel")) {
                            if let onClose { onClose() } else { dismiss() }
                        }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(text("Fertig", "Done")) { onPick(WeightDay.string(from: selection)) }
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .environment(\.locale, text.locale)
        // ISO-Tage immer gregorianisch, unabhängig vom Gerätekalender.
        .environment(\.calendar, WeightDay.calendar())
    }
}
