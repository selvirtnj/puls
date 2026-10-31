import Foundation

/// Ziel für `window.pulsNativeNavigate(…)` (Protokoll Abschnitt 3). Nur die im Vertrag erlaubten Seiten,
/// Abschnitte und Aktionen; alles andere wird schon nativ verworfen, damit es keine toten Knöpfe gibt.
public enum NavigationTarget: Equatable, Hashable, Sendable {
    /// `{page, section?, web?:true}`; `section` nur bei `account`.
    case page(String, section: String? = nil, web: Bool = false)
    /// `{action, id?}`; nicht mit `page`/`section` kombinierbar.
    case action(String, id: String? = nil)

    public static let pages: Set<String> = ["workout", "home", "food", "account"]
    public static let actions: Set<String> = [
        "quickAdd", "addFood", "editFood", "resumeWorkout", "resumeRun", "startRoutine", "startWorkout", "routines", "addWeight",
    ]
    /// Aktionen, die eine nicht leere `id` brauchen.
    public static let actionsWithID: Set<String> = ["editFood", "resumeWorkout", "startRoutine"]

    /// Prüft Form und Erlaubnisliste; ungültig → `nil`.
    public init?(json: JSONValue) {
        guard case .object(let object) = json else { return nil }
        if let actionValue = object["action"] {
            guard object["page"] == nil, object["section"] == nil, case .string(let action) = actionValue else { return nil }
            var id: String?
            switch object["id"] {
            case nil, .null?: id = nil
            case .string(let text)?: id = text
            default: return nil
            }
            self.init(action: action, id: id)
            return
        }
        guard case .string(let page)? = object["page"] else { return nil }
        var section: String?
        switch object["section"] {
        case nil, .null?: section = nil
        case .string(let text)?: section = text
        default: return nil
        }
        var web = false
        switch object["web"] {
        case nil, .null?: web = false
        case .bool(let flag)?: web = flag
        default: return nil
        }
        self.init(page: page, section: section, web: web)
    }

    public init?(page: String, section: String? = nil, web: Bool = false) {
        guard Self.pages.contains(page) else { return nil }
        if let section {
            guard page == "account", !section.isEmpty else { return nil }
        }
        self = .page(page, section: section, web: web)
    }

    public init?(action: String, id: String? = nil) {
        guard Self.actions.contains(action) else { return nil }
        if Self.actionsWithID.contains(action) {
            guard let id, !id.isEmpty else { return nil }
            self = .action(action, id: id)
        } else {
            // Überzählige IDs nicht weitergeben.
            self = .action(action, id: nil)
        }
    }

    /// Seite eines Seitenziels, sonst `nil`.
    public var pageName: String? {
        if case .page(let page, _, _) = self { return page }
        return nil
    }

    public var isAction: Bool {
        if case .action = self { return true }
        return false
    }

    /// Argument für `pulsNativeNavigate` (immer über den JSON-Schreiber, nie per String-Verkettung).
    public var json: JSONValue {
        switch self {
        case .page(let page, let section, let web):
            var object: [String: JSONValue] = ["page": .string(page)]
            if let section { object["section"] = .string(section) }
            if web { object["web"] = .bool(true) }
            return .object(object)
        case .action(let action, let id):
            var object: [String: JSONValue] = ["action": .string(action)]
            if let id { object["id"] = .string(id) }
            return .object(object)
        }
    }
}

/// Projektionen, deren native Bildschirme gerade sichtbar sind (`pulsNativeSetInterest`). Nur bekannte Namen,
/// sortiert und ohne Doppelte, damit gleiche Mengen gleich serialisiert und nicht erneut gesendet werden.
/// Ohne Meldung berechnet das Web `overview`/`training` wie bisher, `progress` dagegen nie.
public struct ProjectionInterest: Equatable, Hashable, Sendable {
    public static let allowed: Set<String> = [ProjectionMessage.overviewName, TrainingProjectionMessage.trainingName,
                                              ProgressProjectionMessage.progressName, ActivityProjectionMessage.activityName]

    public let projections: [String]

    public init(_ projections: Set<String>) {
        self.projections = projections.intersection(Self.allowed).sorted()
    }

    public var json: JSONValue {
        .object(["projections": .array(projections.map(JSONValue.string))])
    }
}

/// Abgleich zwischen gewünschtem und vom Web bestätigtem Interesse. Höchstens ein Aufruf gleichzeitig; nach jeder
/// Antwort wird mit dem **neuesten** Wunsch verglichen und bei Abweichung erneut gesendet (A angenommen → B
/// ausstehend → wieder A gewünscht ⇒ nach B wird A gesendet). Eine abgelehnte Liste wird im selben Hello nicht in
/// Schleife wiederholt. Jedes neue Hello beginnt von vorn (das Web-Dokument kennt den Stand nicht).
public struct InterestSync: Equatable, Sendable {
    public private(set) var hello: Int?
    public private(set) var desired: ProjectionInterest?
    public private(set) var inFlight: ProjectionInterest?
    /// Zuletzt vom Web mit `true` bestätigt (in diesem Hello).
    public private(set) var confirmed: ProjectionInterest?
    public private(set) var rejected: ProjectionInterest?

    public init() {}

    /// Neuer Wunsch; Ergebnis = jetzt zu sendende Liste (oder `nil`).
    public mutating func want(_ interest: ProjectionInterest, hello: Int) -> ProjectionInterest? {
        if self.hello != hello {
            self.hello = hello
            inFlight = nil
            confirmed = nil
            rejected = nil
        }
        desired = interest
        return next()
    }

    /// Antwort auf `interest`; Ergebnis = als Nächstes zu sendende Liste (oder `nil`). Antworten älterer Hellos
    /// bzw. nicht ausstehender Listen werden ignoriert.
    public mutating func finished(_ interest: ProjectionInterest, accepted: Bool, hello: Int) -> ProjectionInterest? {
        guard hello == self.hello, inFlight == interest else { return nil }
        inFlight = nil
        if accepted {
            confirmed = interest
            rejected = nil
        } else {
            // Das Web behält seinen bisherigen Stand (`confirmed`).
            rejected = interest
        }
        return next()
    }

    private mutating func next() -> ProjectionInterest? {
        guard inFlight == nil, let desired, desired != confirmed, desired != rejected else { return nil }
        inFlight = desired
        return desired
    }
}

/// JavaScript für `WKWebView.evaluateJavaScript`. Alle Werte gehen als serialisiertes JSON hinein: Anführungszeichen,
/// Steuerzeichen und U+2028/U+2029 sind maskiert, Nutzerinhalte (IDs) können den Ausdruck nicht verlassen.
public enum WebCall {
    /// Ergebnis des Ausdrucks: `false`, wenn die Funktion fehlt oder das Web ablehnt (z. B. `chrome.blocking`),
    /// sonst `true` (ältere Web-Stände liefern `undefined`).
    public static func navigate(_ target: NavigationTarget) -> String {
        "(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate(\(target.json.serializedString()))!==false:false"
    }

    /// `window.pulsNativeSetChrome(visible)`: erst mit `true` blendet das Web seine Tab-Leiste aus,
    /// mit `false` zeigt es sie wieder (Rückfallweg).
    public static func setChrome(_ visible: Bool) -> String {
        "(typeof window.pulsNativeSetChrome==='function')?window.pulsNativeSetChrome(\(visible ? "true" : "false"))!==false:false"
    }

    /// M4 `window.pulsNativeSetTraining(active)`: `true` erst, wenn Native Trainingsbildschirme für den aktuellen
    /// Nutzer zeigen kann; das Web lehnt bei offenem Web-Ablauf (`chrome.blocking`) ab. `false` ist immer erlaubt.
    public static func setTraining(_ active: Bool) -> String {
        "(typeof window.pulsNativeSetTraining==='function')?window.pulsNativeSetTraining(\(active ? "true" : "false"))===true:false"
    }

    /// M4 Ausweg: Web-Session für genau diesen Aufruf (`{action:'resumeWorkout', id, web:true}`). `nil` ohne ID.
    public static func resumeWorkoutInWeb(id: String) -> String? {
        guard !id.isEmpty else { return nil }
        let argument = JSONValue.object([
            "action": .string("resumeWorkout"), "id": .string(id), "web": .bool(true),
        ]).serializedString()
        return "(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate(\(argument))!==false:false"
    }

    /// M4 `window.pulsNativeExerciseSearch(request)`; Ergebnis kommt als `exerciseSearch`-Nachricht.
    /// Der Ausdruck liefert `true`, wenn das Web die Suche gesendet hat.
    public static func exerciseSearch(_ request: ExerciseSearchRequest) -> String {
        "(typeof window.pulsNativeExerciseSearch==='function')?window.pulsNativeExerciseSearch(\(request.json.serializedString()))===true:false"
    }

    /// M5 `window.pulsNativeProgressQuery(request)`; Antwort kommt als `progressResult` mit derselben `requestId`.
    /// Der Ausdruck liefert `true` genau dann, wenn das Web die Antwort gesendet hat.
    public static func progressQuery(_ request: ProgressQueryRequest) -> String {
        "(typeof window.pulsNativeProgressQuery==='function')?window.pulsNativeProgressQuery(\(request.json.serializedString()))===true:false"
    }

    /// M5 Web-Ausweg aus Kalender/Fortschritt (`{action, id?, web:true}`, §10.5).
    public static func progressNavigate(_ target: ProgressNavigation) -> String {
        "(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate(\(target.json.serializedString()))!==false:false"
    }

    /// M6 `window.pulsNativeSetActivity(active)`: `true` erst, wenn Native Aktivitäten für den aktuellen Nutzer zeigen kann.
    /// Eine reine Web-Live-/Startansicht minimiert das Web dabei selbst; sonstige Web-Abläufe lehnen ab.
    public static func setActivity(_ active: Bool) -> String {
        "(typeof window.pulsNativeSetActivity==='function')?window.pulsNativeSetActivity(\(active ? "true" : "false"))===true:false"
    }

    /// M6 `window.pulsNativeActivityQuery(request)`; Antwort kommt als `activityResult` mit derselben `requestId`.
    public static func activityQuery(_ request: ActivityQueryRequest) -> String {
        "(typeof window.pulsNativeActivityQuery==='function')?window.pulsNativeActivityQuery(\(request.json.serializedString()))===true:false"
    }

    /// M6 Web-Ausweg (§11.5, `web:true` nur für diesen Aufruf; ohne würde der Einstieg wieder nativ umgeleitet).
    public static func activityNavigate(_ target: ActivityNavigation) -> String {
        "(typeof window.pulsNativeNavigate==='function')?window.pulsNativeNavigate(\(target.json.serializedString()))!==false:false"
    }

    /// `window.pulsNativeSetInterest({projections})`: nur die Projektionen sichtbarer nativer Bildschirme berechnen.
    /// Ältere Web-Stände ohne Funktion liefern `false` (dann gilt das bisherige Verhalten).
    public static func setInterest(_ interest: ProjectionInterest) -> String {
        "(typeof window.pulsNativeSetInterest==='function')?window.pulsNativeSetInterest(\(interest.json.serializedString()))!==false:false"
    }

    /// `nil` für keinen streng gültigen Kalendertag (`YYYY-MM-DD`, existierendes Datum).
    /// Ergebnis des Ausdrucks: `true`, wenn das Web den Tag übernommen hat, sonst `false`.
    public static func setDate(_ day: String) -> String? {
        guard WeightDay.isValid(day) else { return nil }
        let argument = JSONValue.string(day).serializedString()
        return "(typeof window.pulsNativeSetDate==='function')?window.pulsNativeSetDate(\(argument))===true:false"
    }
}
