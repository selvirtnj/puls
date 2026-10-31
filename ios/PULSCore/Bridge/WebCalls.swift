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
                                              ProgressProjectionMessage.progressName]

    public let projections: [String]

    public init(_ projections: Set<String>) {
        self.projections = projections.intersection(Self.allowed).sorted()
    }

    public var json: JSONValue {
        .object(["projections": .array(projections.map(JSONValue.string))])
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
