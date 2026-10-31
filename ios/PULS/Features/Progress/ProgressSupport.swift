import Foundation
import SwiftUI
import PULSCore

/// Texte DE/EN und Formate für Kalender und Fortschritt. Formatiert nur fertige Web-Werte; keine Kennzahlformeln.
struct ProgressText {
    let base: OverviewText

    init(language: String?, locale: String?) {
        base = OverviewText(language: language, locale: locale)
    }

    var locale: Locale { base.locale }
    var isEnglish: Bool { base.isEnglish }

    func callAsFunction(_ german: String, _ english: String) -> String {
        base(german, english)
    }

    /// Wie `n()`: höchstens eine Nachkommastelle (Web-Werte sind bereits gerundet).
    func number(_ value: Double, digits: Int = 1) -> String {
        base.number(value, digits: digits)
    }

    func optional(_ value: Double?, digits: Int = 1, unit: String = "") -> String {
        guard let value else { return self("unbekannt", "unknown") }
        return number(value, digits: digits) + (unit.isEmpty ? "" : " " + unit)
    }

    /// Laufdistanz wie `runKm()` (höchstens zwei Nachkommastellen).
    func km(_ value: Double?) -> String {
        guard let value else { return "–" }
        return number(value, digits: 2) + " km"
    }

    func kcal(_ value: Double?) -> String {
        guard let value else { return self("kcal unbekannt", "kcal unknown") }
        return number(value, digits: 0) + " kcal"
    }

    func count(_ value: Int, _ singularDE: String, _ pluralDE: String, _ singularEN: String, _ pluralEN: String) -> String {
        "\(value) " + (value == 1 ? self(singularDE, singularEN) : self(pluralDE, pluralEN))
    }

    func workouts(_ value: Int) -> String { count(value, "Training", "Trainings", "workout", "workouts") }
    func activities(_ value: Int) -> String { count(value, "Aktivität", "Aktivitäten", "activity", "activities") }
    func sets(_ value: Int) -> String { count(value, "Satz", "Sätze", "set", "sets") }

    func day(_ day: String?) -> String {
        guard let day else { return "" }
        return base.shortDay(day)
    }

    /// „Dienstag, 27. Okt.“
    func longDay(_ day: String) -> String {
        guard let date = WeightDay.date(from: day) else { return day }
        return date.formatted(.dateTime.weekday(.wide).day().month(.abbreviated).locale(locale))
    }

    func range(_ start: String?, _ end: String?) -> String {
        guard let start, let end else { return "" }
        return base.shortDay(start) + self(" bis ", " to ") + base.shortDay(end)
    }

    func monthTitle(_ month: String) -> String {
        guard let date = CalendarMonth.firstDay(month).flatMap({ WeightDay.date(from: $0) }) else { return month }
        return date.formatted(.dateTime.month(.wide).year().locale(locale))
    }

    /// Wochentage ab Montag wie `trainingCalendar`.
    var weekdaySymbols: [String] {
        isEnglish ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
    }

    var weekdayNames: [String] {
        isEnglish ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            : ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
    }

    /// Uhr wie `formatClock` für Web-Sekundenwerte ohne fertige Clock.
    func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded(.down)))
        let hours = total / 3600, minutes = (total % 3600) / 60, secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%02d:%02d", minutes, secs)
    }

    /// Dauer einer Zeile; unbekannt bleibt ausdrücklich unbekannt.
    func duration(clock: String?, seconds: Double?) -> String {
        if let clock { return clock }
        if let seconds { return self.clock(seconds) }
        return self("Dauer nicht erfasst", "Duration not recorded")
    }

    /// Zeitraumschlüssel (`periods19` bzw. `progressRanges`); unbekannte Schlüssel unverändert.
    func period(_ key: String) -> String {
        switch key {
        case "week": return self("Woche", "Week")
        case "month": return self("Monat", "Month")
        case "half": return self("Halbjahr", "Half year")
        case "year": return self("Jahr", "Year")
        case "all": return self("Gesamt", "All time")
        default: return key
        }
    }

    func line(_ key: String) -> String {
        switch key {
        case "weight": return self("Gewicht", "Weight")
        case "strength": return self("Kraft", "Strength")
        case "kcal": return self("Kalorien", "Calories")
        default: return key
        }
    }

    /// Gefühl 1–5 wie `RUN_FEELINGS` im Web.
    func feeling(_ value: JSONValue?) -> String? {
        guard let value else { return nil }
        switch value.intValue {
        case 1?: return self("Erschöpft", "Exhausted")
        case 2?: return self("Schwer", "Hard")
        case 3?: return "Normal"
        case 4?: return self("Gut", "Good")
        case 5?: return self("Stark", "Strong")
        default: return value.stringValue ?? value.doubleValue.map { number($0) }
        }
    }

    /// Untergrund wie `RUN_TERRAINS` im Web.
    func terrain(_ key: String?) -> String? {
        guard let key else { return nil }
        switch key {
        case "road": return self("Straße", "Road")
        case "forest": return self("Wald", "Forest")
        case "mixed": return self("Gemischt", "Mixed")
        case "trail": return "Trail"
        case "track": return self("Bahn", "Track")
        case "treadmill": return self("Laufband", "Treadmill")
        default: return key
        }
    }

    /// Satzwert: leer bleibt leer, nicht lesbar „?“.
    func setValue(_ value: SetValue?) -> String {
        switch value {
        case .number(let amount)?: return number(amount, digits: 2)
        case .empty?: return "–"
        case nil: return "?"
        }
    }
}

/// Lade-, Fehler- und „gibt es nicht mehr“-Zustand einer Query-Ansicht, jeweils mit Ausweg.
struct QueryPhaseView: View {
    let isLoading: Bool
    let isGone: Bool
    let text: ProgressText
    let retry: () -> Void
    let openWeb: (() -> Void)?

    var body: some View {
        if isLoading {
            VStack(spacing: 12) {
                ProgressView()
                Text(text("Wird geladen …", "Loading …"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 160)
            .accessibilityElement(children: .combine)
        } else {
            ContentUnavailableView {
                Label(isGone ? text("Nicht mehr vorhanden", "No longer available") : text("Nicht geladen", "Not loaded"),
                      systemImage: isGone ? "questionmark.folder" : "exclamationmark.triangle")
            } description: {
                Text(isGone ? text("Dieser Eintrag wurde inzwischen geändert oder gelöscht.",
                                   "This entry was changed or deleted in the meantime.")
                            : text("PULS hat nicht rechtzeitig geantwortet.", "PULS did not answer in time."))
            } actions: {
                if !isGone {
                    Button(text("Erneut versuchen", "Try again"), action: retry)
                        .buttonStyle(.borderedProminent)
                }
                if let openWeb, !isGone {
                    Button(text("In PULS öffnen", "Open in PULS"), action: openWeb)
                }
            }
        }
    }
}

/// Hinweis bei gekürzten Daten mit vollständigem Web-Ausweg.
struct OmittedNote: View {
    let message: String
    let text: ProgressText
    let openWeb: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(message, systemImage: "info.circle")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button(text("Vollständig in PULS ansehen", "See everything in PULS"), action: openWeb)
                .font(.footnote.weight(.semibold))
                .buttonStyle(.borderless)
                .frame(minHeight: 44, alignment: .leading)
        }
    }
}

/// Kurzer Hinweis oben in Kalender/Fortschritt (verschwindet nach einigen Sekunden oder per Tippen).
struct ProgressNoticeSection: View {
    let coordinator: ProgressCoordinator

    var body: some View {
        if let notice = coordinator.notice {
            let text = coordinator.text
            Section {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Image(systemName: notice.isWarning ? "exclamationmark.triangle" : "info.circle")
                        .foregroundStyle(notice.isWarning ? Color.orange : Color.blue)
                        .accessibilityHidden(true)
                    Text(notice.text).font(.subheadline)
                    Spacer(minLength: 8)
                    Button {
                        coordinator.notice = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.footnote.weight(.semibold))
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(text("Hinweis schließen", "Dismiss"))
                }
            }
            .task(id: notice.id) { @MainActor in
                AccessibilityNotification.Announcement(notice.text).post()
                try? await Task.sleep(for: .seconds(6))
                if coordinator.notice?.id == notice.id { coordinator.notice = nil }
            }
        }
    }
}

/// Lesemodus (Vorschau, Wiederherstellung, Upload-Sperre).
struct ReadOnlyNote: View {
    let text: ProgressText

    var body: some View {
        Label(text("Gerade nur lesbar (Vorschau, Wiederherstellung oder Synchronisierung angehalten).",
                   "Read only right now (preview, recovery or sync paused)."), systemImage: "lock")
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }
}

/// Wert mit Beschriftung in einer Kennzahlenzeile.
struct StatTile: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}
