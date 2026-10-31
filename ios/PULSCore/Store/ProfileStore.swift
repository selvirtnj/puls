import Foundation
import Observation

/// Optimistische Vorschau eines Befehls auf dem Profil. Muss dieselbe Wirkung haben wie die Web-Logik
/// (die maßgeblich bleibt); fehlt ein Reducer, zeigt Native den Befehl erst nach dem Snapshot.
public typealias OptimisticReducer = @Sendable (_ state: inout JSONValue, _ args: JSONValue) -> Void

/// Austauschbare Abhängigkeiten des Stores (Verzeichnis, Uhr, IDs, Sitzung, Op-Regeln, Bereichsregeln).
public struct StoreEnvironment: Sendable {
    public var directory: URL
    public var now: @Sendable () -> Date
    public var makeCommandID: @Sendable () -> String
    /// Kennung dieser App-Sitzung (pro Prozessstart neu). Damit erkennt der Store einen neuen Web-Prozess nach
    /// App-Neustart (Protokoll Abschnitt 7).
    public var sessionID: String
    public var reducers: [String: OptimisticReducer]
    /// Ergänzt `args` (z. B. `expect`) aus der aktuellen Anzeige.
    public var preparers: [String: CommandPreparer]
    /// Prüft die Wirkung bestätigter Befehle im `load`-Snapshot.
    public var effectChecks: [String: EffectCheck]
    /// Ops, die ein nativer Bereich braucht. Ein Bereich wird nur frei, wenn das Web Bereich und alle Ops meldet.
    public var screenRequirements: [String: Set<String>]

    public static let defaultScreenRequirements: [String: Set<String>] = [
        "body": [BridgeOps.weightUpsert, BridgeOps.weightDelete],
    ]

    public init(
        directory: URL,
        now: @escaping @Sendable () -> Date = { Date() },
        makeCommandID: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() },
        sessionID: String = UUID().uuidString.lowercased(),
        reducers: [String: OptimisticReducer] = [:],
        preparers: [String: CommandPreparer] = BridgeOps.defaultPreparers,
        effectChecks: [String: EffectCheck] = BridgeOps.defaultEffectChecks,
        screenRequirements: [String: Set<String>] = StoreEnvironment.defaultScreenRequirements
    ) {
        self.directory = directory
        self.now = now
        self.makeCommandID = makeCommandID
        self.sessionID = sessionID
        self.reducers = reducers
        self.preparers = preparers
        self.effectChecks = effectChecks
        self.screenRequirements = screenRequirements
    }

    /// `Application Support` der App (Protokoll Abschnitt 7), neue Sitzungskennung.
    public static func live() throws -> StoreEnvironment {
        let directory = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        )
        return StoreEnvironment(directory: directory)
    }
}

/// Schreib-API nativer Bereiche. `args` wie in Protokoll Abschnitt 5; `expect` ergänzt der Store.
public struct Command: Equatable, Sendable {
    public var op: String
    public var args: JSONValue

    public init(op: String, args: JSONValue) {
        self.op = op
        self.args = args
    }
}

public enum ProfileStoreError: Error, Equatable, Sendable {
    /// Web läuft im Vorschau-Modus (`?erststart=1`): Native zeigt nichts und sendet nichts.
    case preview
    /// Recovery oder Upload-Sperre: Bereich nur lesbar.
    case readOnly
    /// Noch kein `hello`/`snapshot` von dieser Web-Sitzung.
    case webNotReady
    case unsupportedOp(String)
    /// `args` nicht verwendbar (z. B. zu tief verschachtelt).
    case invalidArguments
    /// Outbox konnte nicht geschrieben werden; nichts wurde geändert.
    case persistence
}

public enum StoreNotice: Equatable, Sendable {
    /// `invalid`: Befehl verworfen, Anzeige zurückgerollt.
    case commandRejected(id: String, op: String, message: String?)
    /// `wrong_user` / `unknown_op`: Befehl geparkt.
    case commandParked(id: String, op: String, code: AckErrorCode)
    /// `conflict`: Befehl geparkt, Anzeige zurückgerollt; Nutzer muss den gewünschten Stand wählen.
    case commandConflict(id: String, op: String)
    /// Outbox-Datei war nicht lesbar oder beschädigt.
    case outboxProblem(String)
}

/// Ein `navigate` des Webs; `token` unterscheidet wiederholte Meldungen derselben Seite.
public struct WebNavigationEvent: Equatable, Sendable {
    public var page: String
    public var web: Bool
    public var token: Int
}

public enum DataAuthority: String, Sendable {
    /// Phase A: Web besitzt Zustand, Persistenz, Auth und Sync.
    case web
    /// Phase B (noch nicht verdrahtet).
    case native
}

/// Einziger nativer Zustand der App (Phase A: Lese-Spiegel + Outbox).
///
/// - Snapshots werden nur mit höherem `seq` übernommen. Nach `hello` (neue Web-Sitzung) gilt der nächste
///   Snapshot unabhängig von `seq`, damit ein zurückgesetzter Web-Zähler nicht dauerhaft blockiert.
/// - Vorschau-Snapshots werden weder angezeigt noch gespiegelt. Zu tief verschachtelte Snapshots werden
///   abgewiesen; der letzte gute Spiegel bleibt.
/// - Nach `hello` bzw. nach `not_ready` wird die Outbox mit dem nächsten Snapshot erneut eingespielt (das Web
///   sendet während Anmeldung/ungeklärter Profilzuordnung keine Snapshots), sofern weder Vorschau noch
///   Schreibschutz gilt; sonst sobald ein Snapshot wieder schreibbar ist.
/// - `perform` ergänzt `expect`, reiht dauerhaft ein, zeigt optimistisch an und sendet.
///   Ack `ok` → `acked` (`lastSeenEffect` wird gemerkt; der `load`-Snapshot einer späteren App-Sitzung entfernt
///   ihn oder spielt ihn bei Speicherverlust erneut ein),
///   `invalid` → entfernt und zurückgerollt, `conflict` → geparkt, zurückgerollt und in `conflicts` sichtbar.
/// - `hello` mit `ownerPending:true`: keine nativen Bereiche, Befehle nur einreihen (wie `not_ready`).
@Observable
@MainActor
public final class ProfileStore {
    /// Anzeige: Web-Stand plus optimistisch angewendete, noch offene Befehle.
    public private(set) var document: ProfileDocument = .empty
    /// Zuletzt vom Web bestätigter Stand.
    public private(set) var confirmedDocument: ProfileDocument = .empty
    public private(set) var hasDocument = false
    public private(set) var seq = 0
    public private(set) var userId: String?
    public private(set) var cloud: CloudStatus = .unknown
    public private(set) var flags: StateFlags = .none
    /// `hello` der laufenden Web-Sitzung.
    public private(set) var webInfo: HelloMessage?
    /// Alle Outbox-Einträge, auch bereits bestätigte (`acked`).
    public private(set) var outboxEntries: [OutboxEntry] = []
    public private(set) var availableScreens: Set<String> = []
    public private(set) var notice: StoreNotice?
    /// Das Web hat `not_ready` gemeldet (lädt, Anmeldung läuft, Profilzuordnung offen). Befehle werden bis zum
    /// nächsten Snapshot nur eingereiht, nicht gesendet.
    public private(set) var isWaitingForWeb = false
    /// Web meldet per `hello` eine laufende Anmeldung bzw. ungeklärte Profilzuordnung (für einen Hinweis ab M2).
    /// Solange das gilt: keine nativen Bereiche, Befehle werden nur eingereiht (wie bei `not_ready`).
    public private(set) var ownerPending = false
    /// Letzter `openNative`-Wunsch des Webs (wird von der Navigation abgeholt).
    public private(set) var requestedScreen: String?
    /// Letzter `navigate`-Seitenwechsel des Webs.
    public private(set) var currentWebPage: String?
    /// M3: letzter `navigate` als Ereignis (auch wiederholte Seite bei `web:true`), für die native Tab-Leiste.
    public private(set) var webNavigation: WebNavigationEvent?
    /// M3: `hello` des **aktuellen** Web-Dokuments (nach `webDocumentDidChange()` bis zum nächsten `hello` `nil`).
    /// Anders als `webInfo` bleibt es nicht über ein Neuladen hinweg stehen: die Web-Leiste ist dann wieder sichtbar.
    public private(set) var documentHello: HelloMessage?
    /// Steigt mit **jedem** empfangenen `hello`, auch mit identischem Inhalt (z. B. nach `pageshow`/bfcache).
    /// Das Web hat dann eine Chrome-Bestätigung widerrufen; die sichtbare native Leiste bestätigt erneut.
    public private(set) var helloCount = 0
    /// M3: zuletzt angenommene Übersichts-Projektion dieses Dokuments (nicht persistiert).
    public private(set) var projection: ProjectionMessage?
    /// M3: letzter `chrome`-Zustand dieses Dokuments (`nil` = nichts blockiert).
    public private(set) var webChrome: ChromeMessage?
    public let authority: DataAuthority = .web

    /// Übergibt einen Befehl an das Web (`StateBridge`). Ohne Sender bleibt er in der Outbox.
    @ObservationIgnored public var sender: (@MainActor (ApplyCommand) -> Void)?
    /// Kurzes Diagnose-Protokoll ohne Profilinhalte (Typ, seq, Op, Fehlercode).
    @ObservationIgnored public private(set) var diagnostics: [String] = []

    private let environment: StoreEnvironment
    private let outbox: Outbox
    private let mirror: MirrorFile

    @ObservationIgnored private var acceptAnySnapshotSeq = false
    @ObservationIgnored private var replayWhenWritable = false
    @ObservationIgnored private var unsupportedOps: Set<String> = []
    @ObservationIgnored private var awaitingSnapshot: [AwaitedCommand] = []
    @ObservationIgnored private var mirrorQueued: MirrorRecord?
    @ObservationIgnored private var mirrorTask: Task<Void, Never>?
    @ObservationIgnored public private(set) var lastMirrorError: String?
    /// Höchste angenommene `projectionSeq` des aktuellen Web-Dokuments.
    @ObservationIgnored private var lastProjectionSeq: Int?
    @ObservationIgnored private var navigationCounter = 0

    private struct AwaitedCommand {
        var command: ApplyCommand
        var seq: Int
    }

    public init(environment: StoreEnvironment) {
        self.environment = environment
        self.mirror = MirrorFile(directory: environment.directory)
        self.outbox = Outbox(directory: environment.directory)
        outboxEntries = outbox.entries
        if let problem = outbox.loadError {
            notice = .outboxProblem(problem)
        }
    }

    // MARK: Lesen

    /// Noch nicht vom Web bestätigte Befehle (wartend oder geparkt).
    public var pending: [OutboxEntry] {
        outboxEntries.filter { !$0.isAcked }
    }

    /// Befehle, die auf eine Nutzerentscheidung warten.
    public var parked: [OutboxEntry] {
        outboxEntries.filter(\.isParked)
    }

    /// Geparkte `conflict`-Befehle: Native fragt Selvir nach dem gewünschten Stand (M2).
    public var conflicts: [OutboxEntry] {
        outboxEntries.filter { $0.status == .parked(.conflict) }
    }

    public var isReadOnly: Bool { flags.isReadOnly }

    // MARK: Start

    /// Lädt den zuletzt geschriebenen Spiegel abseits des Main-Threads, solange noch kein Snapshot da ist.
    public func restoreMirror() async {
        let file = mirror
        let record = await Task.detached(priority: .utility) { file.latest() }.value
        guard let record, !hasDocument else { return }
        seq = record.seq
        userId = record.userId
        cloud = record.cloud
        flags = record.flags
        confirmedDocument = ProfileDocument(root: record.state)
        hasDocument = true
        rebuildDisplay()
        recomputeScreens()
        log("mirror restored seq=\(record.seq)")
    }

    // MARK: Web → Native

    @discardableResult
    public func receive(_ message: InboundMessage) -> Bool {
        switch message {
        case .hello(let hello):
            handleHello(hello)
            return true
        case .snapshot(let snapshot):
            return handleSnapshot(snapshot)
        case .ack(let ack):
            handleAck(ack)
            return true
        case .openNative(let open):
            requestedScreen = open.screen
            log("openNative \(open.screen)")
            return true
        case .navigate(let navigate):
            currentWebPage = navigate.page
            navigationCounter += 1
            webNavigation = WebNavigationEvent(page: navigate.page, web: navigate.web, token: navigationCounter)
            return true
        case .projection(let projection):
            return handleProjection(projection)
        case .chrome(let chrome):
            webChrome = chrome
            return true
        }
    }

    /// Aktuelle Web-Kontounterseite: `chrome` ist sofort aktuell, die Projektion folgt verzögert.
    public var webAccountSection: String? {
        if let webChrome { return webChrome.accountSection }
        return currentProjection?.accountSection
    }

    /// Ein Web-Modal oder eine Session sperrt Datums- und Tabwechsel.
    public var webBlocksNavigation: Bool { webChrome?.blocking == true }

    // MARK: M3 Übersicht und native Navigation

    /// Das Web unterstützt die native Tab-Leiste in diesem Dokument und hat die CSS-Klasse `puls-native-tabs`
    /// gesetzt (Hello mit `features:['nativeTabs']` und `ownerPending:false`).
    public var webOffersNativeTabs: Bool {
        guard let hello = documentHello, !hello.ownerPending, !ownerPending else { return false }
        return hello.features.contains(Self.nativeTabsFeature)
    }

    /// Zusätzlich kündigt das Web die Übersichts-Projektion an.
    public var webOffersOverview: Bool {
        webOffersNativeTabs && documentHello?.projections.contains(ProjectionMessage.overviewName) == true
    }

    /// Anzeigefähige Projektion: aktuelles Dokument, geklärte Zuordnung und derselbe Nutzer wie der Spiegel
    /// (Vorschau ausgenommen, deren Snapshots nie übernommen werden). Sonst `nil` → Lade-/Web-Ausweichansicht.
    public var currentProjection: ProjectionMessage? {
        guard webOffersOverview, let projection = self.projection, !projection.ownerPending else { return nil }
        guard projection.flags.preview || projection.userId == userId else { return nil }
        return projection
    }

    /// Einträge in `window.pulsNativeFeatures` (Native meldet beide; nur mit `nativeOverview` berechnet das Web
    /// die Projektion). Das Web meldet in `hello.features` nur `nativeTabs`.
    public static let nativeTabsFeature = "nativeTabs"
    public static let nativeOverviewFeature = "nativeOverview"

    /// Neues Web-Dokument (Navigation übernommen, Neuladen, Offline-Seite): Dokument-Hello, Projektion und deren
    /// Sequenzprüfung verwerfen. Spiegel, Outbox und `webInfo` bleiben unverändert (M1/M2-Regeln).
    public func webDocumentDidChange() {
        documentHello = nil
        projection = nil
        lastProjectionSeq = nil
        webNavigation = nil
        webChrome = nil
        log("web document changed")
    }

    private func handleProjection(_ message: ProjectionMessage) -> Bool {
        guard !message.ownerPending else {
            log("projection ownerPending ignored")
            return false
        }
        // Erste Projektion eines neuen Dokuments, falls der Dokumentwechsel nicht gemeldet wurde.
        let freshDocument = message.projectionSeq <= 1 && message.reason == "load"
        if let last = lastProjectionSeq, message.projectionSeq <= last, !freshDocument {
            log("projection \(message.projectionSeq) stale (have \(last))")
            return false
        }
        lastProjectionSeq = message.projectionSeq
        projection = message
        return true
    }

    public func consumeScreenRequest() -> String? {
        defer { requestedScreen = nil }
        return requestedScreen
    }

    /// Nicht auswertbare Nachricht (nur Diagnose, ohne Inhalt).
    public func noteBridgeIssue(_ reason: String) {
        log("bridge issue: \(reason)")
    }

    private func handleHello(_ hello: HelloMessage) {
        webInfo = hello
        documentHello = hello
        helloCount += 1
        // Ungeklärte Zuordnung oder Anmeldung: alte Übersicht sofort verdecken und verwerfen.
        if hello.ownerPending { projection = nil }
        acceptAnySnapshotSeq = true
        // Wiederholte Status-Hellos verwerfen weder Spiegel noch Outbox noch gespeicherte Beobachtungen.
        ownerPending = hello.ownerPending
        if hello.ownerPending { isWaitingForWeb = true }
        let ops = Set(hello.ops)
        unsupportedOps.subtract(ops)
        outbox.reloadIfBlocked()
        let unparked = outbox.unpark { entry in
            entry.status == .parked(.unknownOp) && ops.contains(entry.command.op)
        }
        syncOutbox()
        recomputeScreens()
        log("hello web=\(hello.webVersion ?? "?") ops=\(hello.ops.count) screens=\(hello.screens.count) unparked=\(unparked)")
        // Das Web sendet nach `hello` den Lade-Snapshot, sobald das Profil bereit ist. Erst der zeigt, ob diese
        // Sitzung Vorschau oder schreibgeschützt ist; deshalb wird die Outbox dort eingespielt.
        replayWhenWritable = true
    }

    private func handleSnapshot(_ snapshot: SnapshotMessage) -> Bool {
        if snapshot.flags.preview {
            // Vorschau-Profil und ihre flüchtige Sequenz nie anzeigen, spiegeln oder als Stand übernehmen.
            flags = snapshot.flags
            recomputeScreens()
            log("snapshot seq=\(snapshot.seq) preview ignored")
            return false
        }
        guard !snapshot.ownerPending else {
            // Laut Protokoll nie gesendet; vorsichtshalber nicht übernehmen.
            log("snapshot seq=\(snapshot.seq) ownerPending ignored")
            return false
        }
        guard snapshot.state.fitsDepth(JSONLimits.bridgeDepth) else {
            log("snapshot seq=\(snapshot.seq) too deep, ignored")
            return false
        }
        guard !hasDocument || acceptAnySnapshotSeq || snapshot.seq > seq else {
            log("snapshot seq=\(snapshot.seq) stale (have \(seq))")
            return false
        }
        let wasReadOnly = flags.isReadOnly
        if snapshot.userId != userId { awaitingSnapshot.removeAll() }
        acceptAnySnapshotSeq = false
        isWaitingForWeb = false
        ownerPending = false
        seq = snapshot.seq
        userId = snapshot.userId
        cloud = snapshot.cloud
        flags = snapshot.flags
        confirmedDocument = ProfileDocument(root: snapshot.state)
        hasDocument = true
        awaitingSnapshot.removeAll { $0.seq <= snapshot.seq }
        trackAcked(with: snapshot)
        syncOutbox()
        rebuildDisplay()
        recomputeScreens()
        scheduleMirrorWrite(MirrorRecord(
            seq: snapshot.seq, userId: snapshot.userId, cloud: snapshot.cloud,
            flags: snapshot.flags, savedAt: environment.now(), state: snapshot.state
        ))
        log("snapshot seq=\(snapshot.seq) reason=\(snapshot.reason) accepted")
        if !flags.isReadOnly, replayWhenWritable || wasReadOnly {
            replayWhenWritable = false
            replayOutbox()
        }
        return true
    }

    /// Protokoll Abschnitt 7 für `acked`-Befehle desselben Nutzers (Vorschau-/Recovery-Snapshots zählen nicht):
    /// - In der Ack-Sitzung speichert jeder gültige Snapshot persistent `lastSeenEffect` (zählt nur der letzte Stand).
    /// - Ein `load`-Snapshot einer anderen App-Sitzung (neuer Web-Prozess) entscheidet:
    ///   Wirkung sichtbar → ohne Replay entfernen; fehlt sie und war zuletzt `false` (bewusst geändert) → ohne
    ///   Replay entfernen; fehlt sie und war zuletzt `true` (Speicherverlust) oder `nil` → erneut senden mit
    ///   derselben ID und demselben `expect` (ein neuerer Stand führt im Web zu `conflict`, nie zum Überschreiben).
    private func trackAcked(with snapshot: SnapshotMessage) {
        guard !snapshot.flags.preview, !snapshot.flags.recovery else { return }
        let decides = snapshot.reason == "load"
        var seen: [String: Bool] = [:]
        var settled = Set<String>()
        var replay = Set<String>()
        for entry in outbox.entries {
            guard case .acked(let session) = entry.status, entry.command.userId == snapshot.userId else { continue }
            guard let check = environment.effectChecks[entry.command.op] else {
                log("acked op=\(entry.command.op) without effect check, kept")
                continue
            }
            let visible = check(entry.command.args, snapshot.state)
            if session == environment.sessionID {
                seen[entry.command.id] = visible
            } else if decides {
                if visible || entry.lastSeenEffect == false {
                    settled.insert(entry.command.id)
                } else {
                    replay.insert(entry.command.id)
                }
            }
        }
        if !seen.isEmpty {
            outbox.recordSeenEffect(seen)
        }
        if !settled.isEmpty {
            do {
                try outbox.removeAcked(ids: settled)
                log("acked settled without replay: \(settled.count)")
            } catch {
                log("acked removal not saved, kept: \(settled.count)")
            }
        }
        if !replay.isEmpty {
            outbox.reopen(ids: replay)
            replayWhenWritable = true
            log("acked effect missing after restart, resend: \(replay.count)")
        }
    }
    private func handleAck(_ ack: AckMessage) {
        switch outbox.resolve(ack, session: environment.sessionID) {
        case .unknownCommand:
            log("ack \(ack.ok ? "ok" : "error") for unknown command")
        case .confirmed(let command):
            // Optimistische Anzeige bis zum Snapshot mit dieser Änderung halten (kein Flackern).
            let target = ack.seq ?? (seq + 1)
            if target > seq {
                awaitingSnapshot.append(AwaitedCommand(command: command, seq: target))
            }
            let seqText = ack.seq.map { String($0) } ?? "-"
            log("ack ok op=\(command.op) seq=\(seqText)")
        case .rejected(let command, let error):
            notice = .commandRejected(id: command.id, op: command.op, message: error.message)
            log("ack invalid op=\(command.op)")
        case .parked(let command, let error):
            switch error.code {
            case .unknownOp:
                unsupportedOps.insert(command.op)
                recomputeScreens()
                notice = .commandParked(id: command.id, op: command.op, code: error.code)
            case .conflict:
                notice = .commandConflict(id: command.id, op: command.op)
            default:
                notice = .commandParked(id: command.id, op: command.op, code: error.code)
            }
            log("ack \(error.code.code) op=\(command.op) parked")
        case .held(let command, let error):
            switch error.code {
            case .notReady:
                // Web sendet erst nach Abschluss von Laden/Anmeldung wieder Snapshots; dann erneut senden.
                isWaitingForWeb = true
                replayWhenWritable = true
            case .readonly, .persistFailed:
                replayWhenWritable = true
            default:
                break
            }
            log("ack \(error.code.code) op=\(command.op) held")
        }
        syncOutbox()
        rebuildDisplay()
    }

    // MARK: Native → Web

    /// Ergänzt `args` (z. B. `expect` aus der aktuellen Anzeige), reiht den Befehl dauerhaft ein, zeigt ihn
    /// optimistisch an und sendet ihn an das Web (außer solange das Web `not_ready` meldet).
    @discardableResult
    public func perform(_ command: Command) throws -> ApplyCommand {
        if flags.preview { throw ProfileStoreError.preview }
        if flags.isReadOnly { throw ProfileStoreError.readOnly }
        guard let web = webInfo, hasDocument else { throw ProfileStoreError.webNotReady }
        guard web.ops.contains(command.op), !unsupportedOps.contains(command.op) else {
            throw ProfileStoreError.unsupportedOp(command.op)
        }
        guard case .object = command.args, command.args.fitsDepth(JSONLimits.bridgeDepth - 1) else {
            throw ProfileStoreError.invalidArguments
        }
        let args = environment.preparers[command.op]?(command.args, document) ?? command.args
        let apply = ApplyCommand(
            id: environment.makeCommandID(), userId: userId, baseSeq: seq, op: command.op, args: args
        )
        do {
            try outbox.enqueue(apply, at: environment.now())
        } catch {
            log("perform op=\(command.op) not persisted")
            throw ProfileStoreError.persistence
        }
        syncOutbox()
        rebuildDisplay()
        if !isWaitingForWeb { send(apply) }
        return apply
    }

    /// Erneut senden, z. B. wenn die App in den Vordergrund kommt.
    public func retryPending() {
        guard !flags.isReadOnly, !isWaitingForWeb else {
            replayWhenWritable = true
            return
        }
        replayOutbox()
    }

    /// Geparkten Befehl auf ausdrücklichen Nutzerwunsch erneut senden (bei `conflict` bleibt `expect` unverändert;
    /// für einen neuen Stand stattdessen einen neuen Befehl mit `perform` anlegen).
    public func retryParkedCommand(id: String) {
        outbox.unpark { $0.command.id == id }
        syncOutbox()
        rebuildDisplay()
        replayOutbox()
    }

    /// Befehl auf Nutzerwunsch endgültig verwerfen. Scheitert das Speichern, bleibt er erhalten.
    public func discardCommand(id: String) throws {
        do {
            try outbox.remove(id: id)
        } catch {
            log("discard not saved, kept")
            throw ProfileStoreError.persistence
        }
        syncOutbox()
        rebuildDisplay()
    }

    public func clearNotice() {
        notice = nil
    }

    private func replayOutbox() {
        guard webInfo != nil, !isWaitingForWeb else { return }
        guard !flags.isReadOnly else {
            replayWhenWritable = true
            return
        }
        let commands = outbox.replayableCommands
        guard !commands.isEmpty else { return }
        log("replay \(commands.count)")
        for command in commands {
            send(command)
        }
    }

    private func send(_ command: ApplyCommand) {
        guard let sender else { return }
        outbox.markSent(id: command.id)
        sender(command)
    }

    // MARK: Ableitungen

    private func syncOutbox() {
        outboxEntries = outbox.entries
    }

    private func rebuildDisplay() {
        var root = confirmedDocument.root
        let overlay = awaitingSnapshot.map(\.command)
            + outbox.entries.filter { $0.status == .pending }.map(\.command)
        for command in overlay where command.userId == userId {
            environment.reducers[command.op]?(&root, command.args)
        }
        document = ProfileDocument(root: root)
    }

    private func recomputeScreens() {
        guard let web = webInfo, !flags.preview, !ownerPending else {
            availableScreens = []
            return
        }
        let ops = Set(web.ops).subtracting(unsupportedOps)
        availableScreens = Set(web.screens.filter { screen in
            guard let required = environment.screenRequirements[screen] else { return false }
            return required.isSubset(of: ops)
        })
    }

    // MARK: Spiegel

    /// Schreibt seriell abseits des Main-Threads; zwischenzeitliche Stände werden zusammengefasst.
    private func scheduleMirrorWrite(_ record: MirrorRecord) {
        mirrorQueued = record
        guard mirrorTask == nil else { return }
        let file = mirror
        mirrorTask = Task { [weak self] in
            while let next = self?.takeQueuedMirrorRecord() {
                let failure: String? = await Task.detached(priority: .utility) { () -> String? in
                    do {
                        try file.write(next)
                        return nil
                    } catch {
                        return "Spiegel nicht gespeichert"
                    }
                }.value
                self?.mirrorWriteFinished(seq: next.seq, failure: failure)
            }
            self?.mirrorTask = nil
        }
    }

    private func takeQueuedMirrorRecord() -> MirrorRecord? {
        defer { mirrorQueued = nil }
        return mirrorQueued
    }

    private func mirrorWriteFinished(seq: Int, failure: String?) {
        lastMirrorError = failure
        if let failure { log("\(failure) seq=\(seq)") }
    }

    /// Wartet, bis alle angestoßenen Spiegel-Schreibvorgänge erledigt sind (Tests, App-Hintergrund).
    public func waitForMirrorWrites() async {
        while let task = mirrorTask {
            await task.value
        }
    }

    private func log(_ line: String) {
        diagnostics.append(line)
        if diagnostics.count > 100 {
            diagnostics.removeFirst(diagnostics.count - 100)
        }
    }
}
