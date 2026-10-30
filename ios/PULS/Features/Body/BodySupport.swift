import Foundation
import PULSCore

/// Texte DE/EN nach `state.language` (wie js/i18n.js; Standard Deutsch). Zahlen und Daten im passenden Gebietsschema.
struct BodyText {
    let isEnglish: Bool

    init(document: ProfileDocument) {
        isEnglish = document["language"]?.stringValue == "en"
    }

    var locale: Locale { Locale(identifier: isEnglish ? "en_GB" : "de_DE") }

    func callAsFunction(_ german: String, _ english: String) -> String {
        isEnglish ? english : german
    }

    /// Zahl wie `n()` im Web (bis zu drei Nachkommastellen, ohne Tausendertrennung).
    func number(_ value: Double, maxDigits: Int = 3) -> String {
        value.formatted(.number.precision(.fractionLength(0...maxDigits)).grouping(.never).locale(locale))
    }

    func kg(_ value: Double, maxDigits: Int = 3) -> String {
        number(value, maxDigits: maxDigits) + " kg"
    }

    /// Differenz mit Vorzeichen, eine Nachkommastelle.
    func signedKg(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)).sign(strategy: .always()).grouping(.never).locale(locale)) + " kg"
    }

    func day(_ text: String) -> String {
        guard let date = WeightDay.date(from: text) else { return text }
        return date.formatted(.dateTime.day().month(.abbreviated).year().locale(locale))
    }

    func shortDay(_ text: String) -> String {
        guard let date = WeightDay.date(from: text) else { return text }
        return date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(locale))
    }

    func measurements(_ count: Int) -> String {
        count == 1 ? self("1 Messung", "1 measurement") : self("\(count) Messungen", "\(count) measurements")
    }

    /// Fehler aus `ProfileStore.perform` für Selvir verständlich.
    func message(for error: Error) -> String {
        switch error as? ProfileStoreError {
        case .preview?, .readOnly?:
            return self("Gerade nur lesbar. Nichts wurde geändert.", "Read-only right now. Nothing was changed.")
        case .webNotReady?:
            return self("PULS lädt noch. Bitte gleich noch einmal versuchen.", "PULS is still loading. Please try again in a moment.")
        case .unsupportedOp(_)?:
            return self("Diese PULS-Version kann das Gewicht hier nicht speichern. Öffne den Bereich bitte im Web.",
                        "This PULS version cannot save weight here. Please open the section on the web.")
        case .persistence?:
            return self("Konnte nicht sicher gespeichert werden. Nichts wurde geändert.", "Could not be saved safely. Nothing was changed.")
        default:
            return self("Nicht gespeichert.", "Not saved.")
        }
    }
}

/// Alle Werte, die der Bildschirm aus dem Profil ableitet (einmal pro Auswertung).
struct BodyData {
    let today: String
    /// Neuester Tag zuerst.
    let entries: [WeightEntry]
    let trend: [WeightTrendPoint]
    let weeks: [WeeklyWeight]
    let latest: WeightEntry?
    let latestWeek: WeeklyWeight?
    let currentWeight: Double?

    init(document: ProfileDocument, today: String) {
        let all = WeightEntry.entries(in: document)
        self.today = today
        entries = WeightMath.newestFirst(all)
        trend = WeightMath.trend(all, today: today)
        weeks = WeightMath.weeklyAverages(all)
        latest = WeightMath.latest(all, today: today)
        latestWeek = WeightMath.latestWeekAverage(all, today: today)
        currentWeight = latest?.kg ?? document["profile"]?["weight"]?.doubleValue
    }
}

/// Darf der Bildschirm schreiben? Lesbar bleibt er immer.
enum BodyAccess: Equatable {
    case editable
    case readOnly(String)

    var canEdit: Bool { self == .editable }

    @MainActor
    static func of(_ store: ProfileStore, text: BodyText) -> BodyAccess {
        if store.flags.preview {
            return .readOnly(text("Vorschau: Hier werden deine gespeicherten Gewichte nur angezeigt.",
                                  "Preview: your saved weights are shown read-only."))
        }
        if store.flags.recovery {
            return .readOnly(text("Wiederherstellung offen. Wähle zuerst in PULS den gewünschten Stand, bis dahin nur lesbar.",
                                  "Recovery pending. Choose the version in PULS first; until then read-only."))
        }
        if store.flags.uploadBlocked {
            return .readOnly(text("Synchronisierung angehalten. Gewichte sind bis zur Klärung nur lesbar.",
                                  "Sync paused. Weights are read-only until this is resolved."))
        }
        if store.ownerPending {
            return .readOnly(text("Kontozuordnung wird geklärt. Gewichte sind bis dahin nur lesbar.",
                                  "Account assignment is being resolved. Weights are read-only until then."))
        }
        if store.webInfo == nil {
            return .readOnly(text("PULS lädt noch. Eintragen ist gleich möglich.", "PULS is still loading. Logging is available shortly."))
        }
        if !store.availableScreens.contains(NativeRouter.bodyScreen) {
            return .readOnly(text("Diese PULS-Version kann Gewichte hier gerade nicht speichern. Öffne den Bereich im Web.",
                                  "This PULS version cannot save weight here right now. Open the section on the web."))
        }
        return .editable
    }
}

/// Unaufdringlicher Speicher-/Sync-Hinweis.
struct BodySyncStatus: Equatable {
    let label: String
    let symbol: String

    @MainActor
    static func of(_ store: ProfileStore, text: BodyText) -> BodySyncStatus {
        let pendingWeight = store.outboxEntries.contains { $0.status == .pending && BodyOps.isWeight($0.command.op) }
        if pendingWeight && store.isWaitingForWeb {
            return BodySyncStatus(label: text("Wartet auf PULS, wird danach gespeichert", "Waiting for PULS, will be saved then"), symbol: "clock")
        }
        if pendingWeight {
            return BodySyncStatus(label: text("Wird gespeichert …", "Saving …"), symbol: "arrow.triangle.2.circlepath")
        }
        guard store.cloud.signedIn else {
            return BodySyncStatus(label: text("Auf diesem iPhone gespeichert", "Saved on this iPhone"), symbol: "iphone")
        }
        if store.cloud.conflict {
            return BodySyncStatus(label: text("Sync-Konflikt, bitte im Konto klären", "Sync conflict, please resolve in Account"),
                                  symbol: "exclamationmark.triangle")
        }
        if store.cloud.dirty {
            return BodySyncStatus(label: text("Wird synchronisiert …", "Syncing …"), symbol: "arrow.triangle.2.circlepath")
        }
        return BodySyncStatus(label: text("Synchronisiert", "Synced"), symbol: "checkmark.icloud")
    }
}

enum BodyOps {
    static func isWeight(_ op: String) -> Bool {
        op == BridgeOps.weightUpsert || op == BridgeOps.weightDelete
    }
}

/// Zeitraum des Verlaufsdiagramms.
enum WeightRange: String, CaseIterable, Identifiable {
    case days30, days90, year, all

    var id: String { rawValue }

    var days: Int? {
        switch self {
        case .days30: return 30
        case .days90: return 90
        case .year: return 365
        case .all: return nil
        }
    }

    func label(_ text: BodyText) -> String {
        switch self {
        case .days30: return text("30 T", "30 d")
        case .days90: return text("90 T", "90 d")
        case .year: return text("1 J", "1 y")
        case .all: return text("Alle", "All")
        }
    }

    func spokenLabel(_ text: BodyText) -> String {
        switch self {
        case .days30: return text("30 Tage", "30 days")
        case .days90: return text("90 Tage", "90 days")
        case .year: return text("1 Jahr", "1 year")
        case .all: return text("Gesamter Verlauf", "All time")
        }
    }

    func filter(_ points: [WeightTrendPoint], today: String) -> [WeightTrendPoint] {
        guard let days, let start = WeightDay.adding(days: -(days - 1), to: today) else { return points }
        return points.filter { $0.date >= start }
    }
}

/// Gelöschter Eintrag für „Rückgängig“.
struct DeletedWeight: Equatable {
    let entry: WeightEntry
    let token = UUID()
}

/// Öffnet das Eintragen-Sheet (neu oder vorhandenen Tag bearbeiten).
struct WeightEditorRequest: Identifiable {
    let id = UUID()
    let original: WeightEntry?
    let initialDate: Date
    let initialText: String
}
