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
}

/// Aktionen der nativen Bereiche. Bewusst kein Environment-Wert (keine Closures im Environment).
struct OverviewActions {
    var perform: (NavigationTarget) -> Void
    var setDate: (String) -> Void
    var openBody: () -> Void
    var showWebHome: () -> Void
}

@MainActor
final class RootTabShell: NSObject, UITabBarDelegate {
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
    private var activeConstraints: [NSLayoutConstraint] = []
    private var inactiveConstraints: [NSLayoutConstraint] = []

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
            showWebHome: { [weak self] in self?.showWebHome() }
        )
        let header = UIHostingController(rootView: ShellHeaderHost(store: store, state: state, actions: actions))
        header.sizingOptions = .intrinsicContentSize
        let overview = UIHostingController(rootView: OverviewHost(store: store, actions: actions))
        headerHost = header
        overviewHost = overview
        let trainingView: UIView?
        if let training {
            let hosting = UIHostingController(rootView: WorkoutTabHost(training: training, progress: progress))
            hosting.view.backgroundColor = .systemGroupedBackground
            trainingHost = hosting
            trainingView = hosting.view
        } else {
            trainingView = nil
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
        webView.translatesAutoresizingMaskIntoConstraints = false
        for view in ([statusFill, header.view, overview.view, trainingView, tabBar] as [UIView?]).compactMap({ $0 }) {
            view.translatesAutoresizingMaskIntoConstraints = false
            view.isHidden = true
            root.addSubview(view)
        }
        header.didMove(toParent: host)
        overview.didMove(toParent: host)
        trainingHost?.didMove(toParent: host)
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
        NSLayoutConstraint.activate(inactiveConstraints)
        observeStore()
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
        if active { updateScheme(projection) }
        if active != isActive || hideBars != barsHiddenForSession {
            setActive(active, hideBars: hideBars)
        } else if reconfirm, isActive, !barsHiddenForSession {
            sendChrome(true)
        }
        // Liest `webOffersOverview` innerhalb der Beobachtung.
        updateVisibility()
    }

    private func setActive(_ active: Bool, hideBars: Bool) {
        let wasActive = isActive
        isActive = active
        barsHiddenForSession = hideBars
        if active, !wasActive, let page = store.currentWebPage, let tab = RootTab(rawValue: page), tab != .add {
            state.selected = tab
        }
        let barsVisible = active && !hideBars
        NSLayoutConstraint.deactivate(barsVisible ? inactiveConstraints : activeConstraints)
        NSLayoutConstraint.activate(barsVisible ? activeConstraints : inactiveConstraints)
        for view in [statusFill, headerHost?.view, tabBar] as [UIView?] {
            view?.isHidden = !barsVisible
        }
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
        }
    }

    // MARK: Sichtbarkeit

    private var showsNativeOverview: Bool {
        // Ein offener Web-Ablauf (`chrome.blocking`) wird nie von der nativen Übersicht überdeckt.
        isActive && !barsHiddenForSession && !state.isBlocked && state.selected == .home && !homeShowsWeb
            && store.webOffersOverview
    }

    /// M4: nativer Trainings-Tab; nie über einem offenen Web-Ablauf oder der Web-Abschlussansicht.
    private var showsNativeTraining: Bool {
        guard let training, isActive, !barsHiddenForSession, !state.isBlocked, state.selected == .workout,
              !workoutShowsWeb, !workoutFlowHidden else { return false }
        // M5: auch ohne Trainings-Projektion, wenn Kalender/Fortschritt nativ angeboten werden.
        return (training.isAvailable || progress?.offersAny == true) && !training.awaitingWebCompletion
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
        guard isActive, let hello = store.documentHello, !hello.ownerPending else { return }
        var names: Set<String> = [ProjectionMessage.overviewName]
        let workoutVisible = showsNativeTraining
        if let training {
            if workoutVisible || training.sessionWorkoutId != nil || training.awaitingWebCompletion
                || store.trainingProjection == nil || training.training?.active != nil {
                names.insert(TrainingProjectionMessage.trainingName)
            }
        }
        if workoutVisible, progress?.needsProgressProjection == true {
            names.insert(ProgressProjectionMessage.progressName)
        }
        bridge.setInterest(ProjectionInterest(names), hello: store.helloCount)
    }

    private func updateVisibility() {
        let showOverview = showsNativeOverview
        let showTraining = showsNativeTraining
        overviewHost?.view.isHidden = !showOverview
        trainingHost?.view.isHidden = !showTraining
        // Verdeckte Web-Inhalte nicht für VoiceOver erreichbar lassen; die WebView selbst bleibt sichtbar.
        webView?.accessibilityElementsHidden = showOverview || showTraining
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
            let item = UITabBarItem(
                title: tab.label(text),
                image: UIImage(systemName: tab.symbol),
                selectedImage: UIImage(systemName: tab.selectedSymbol)
            )
            item.tag = index
            if tab == .add {
                item.accessibilityHint = text("Öffnet das Menü zum Hinzufügen", "Opens the add menu")
            }
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
            // Plus ist kein Seitentab: Auswahl bleibt, das Web-Menü öffnet sich über der aktuellen Seite.
            syncSelection()
            if let quickAdd = NavigationTarget(action: "quickAdd") { perform(quickAdd) }
        case .home:
            // Bewusste Wahl der Übersicht: wieder nativ, das Web geht im Hintergrund ebenfalls auf „home“.
            if let target = NavigationTarget(page: "home") { perform(target) }
        default:
            if let page = tab.page, let target = NavigationTarget(page: page) { perform(target) }
        }
        UISelectionFeedbackGenerator().selectionChanged()
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
        let previousTab = state.selected
        let previousShowsWeb = homeShowsWeb
        // Rückkehr nur vormerken, wenn die Aktion aus der sichtbaren nativen Übersicht startet
        // (nicht aus der Web-Übersicht nach „Verlauf ansehen“ o. Ä.).
        let startedFromNativeOverview = showsNativeOverview
        switch target {
        case .page(let page, _, let web):
            restoreOverviewAfterFlow = false
            if let tab = RootTab(rawValue: page), tab != .add {
                state.selected = tab
                if tab == .home { homeShowsWeb = web }
                if tab == .workout { workoutShowsWeb = web }
            }
        case .action:
            // Vor dem Aufruf ausblenden, damit Modal/Session sofort sichtbar sind (das `chrome` kommt später).
            if state.selected == .home { homeShowsWeb = true }
            restoreOverviewAfterFlow = startedFromNativeOverview
            flowWasBlocking = false
        }
        updateVisibility()
        bridge.navigate(target) { [weak self] accepted in
            guard let self, !accepted else { return }
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

    /// `light`/`dark` direkt aus der Projektion; bei `system` wie die Web-App (`data-scheme`).
    private func updateScheme(_ projection: ProjectionMessage?) {
        let scheme = projection?.overview.colorScheme ?? "system"
        let key = "\(scheme)#\(projection?.projectionSeq ?? -1)"
        guard key != schemeKey else { return }
        schemeKey = key
        switch scheme {
        case "light": applyStyle(.light)
        case "dark": applyStyle(.dark)
        default:
            bridge.readWebScheme { [weak self] value in
                self?.applyStyle(value == "light" ? .light : .dark)
            }
        }
    }

    private func applyStyle(_ newStyle: UIUserInterfaceStyle) {
        for view in [statusFill, tabBar, headerHost?.view, overviewHost?.view, trainingHost?.view] as [UIView?] {
            view?.overrideUserInterfaceStyle = newStyle
        }
        headerHost?.overrideUserInterfaceStyle = newStyle
        overviewHost?.overrideUserInterfaceStyle = newStyle
        trainingHost?.overrideUserInterfaceStyle = newStyle
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
        .background(Color(.systemGroupedBackground))
        .environment(\.locale, text.locale)
    }

    private func title(_ text: OverviewText) -> some View {
        let section = state.selected == .account ? store.webAccountSection : nil
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

    init(initial: Date, text: OverviewText, onPick: @escaping (String) -> Void) {
        // Einmaliger Startwert der Auswahl.
        _selection = State(initialValue: initial)
        self.text = text
        self.onPick = onPick
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
                        Button(text("Abbrechen", "Cancel")) { dismiss() }
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
