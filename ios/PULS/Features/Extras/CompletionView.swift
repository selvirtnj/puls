import SwiftUI
import PULSCore

// N1 §15.2: nativer Abschluss für Krafttraining und Aktivität. Zeigt ausschließlich das eingefrorene Web-Ergebnis; XP, Level,
// Serien, Volumen, Pace und Strecke werden nie berechnet. Fehlende Werte bleiben unbekannt.

struct CompletionHost: View {
    let coordinator: ExtrasCoordinator
    /// Ledger-Eintrag dieser Ansicht; bestimmt Besitzer und Finish-Zyklus.
    let record: CompletionRecord
    @State private var completion: NativeCompletion
    @State private var isLoading: Bool

    init(coordinator: ExtrasCoordinator, record: CompletionRecord, completion: NativeCompletion) {
        self.coordinator = coordinator
        self.record = record
        _completion = State(initialValue: completion)
        _isLoading = State(initialValue: completion.chunked)
    }

    var body: some View {
        let progressText = ProgressText(language: coordinator.language, locale: nil)
        NavigationStack {
            List {
                if completion.unavailable {
                    Section {
                        Label(completion.kind == .workout
                              ? progressText("Dein Training ist gespeichert.", "Your workout is saved.")
                              : progressText("Deine Aktivität ist gespeichert.", "Your activity is saved."),
                              systemImage: "checkmark.circle.fill")
                    } footer: {
                        Text(progressText("Die Auswertung dieses Abschlusses ist nicht mehr erhalten. XP und Serie werden dafür nicht neu berechnet.",
                                          "The summary of this finish is no longer available. XP and streak are not recalculated for it."))
                    }
                } else {
                    CompletionHeadline(completion: completion, text: progressText)
                }
                if !completion.wins.isEmpty {
                    Section {
                        ForEach(Array(completion.wins.enumerated()), id: \.offset) { _, win in
                            Label(win, systemImage: "trophy")
                        }
                    } header: {
                        Text(progressText("Persönliche Verbesserungen", "Personal improvements"))
                    }
                }
                if isLoading {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    }
                } else if let summary = completion.workoutSummary {
                    CompletionWorkoutSection(summary: summary, text: progressText)
                } else if let detail = completion.runDetail {
                    CompletionRunSections(detail: detail, summary: completion.summary,
                                          text: ActivityText(language: coordinator.language, locale: nil))
                }
                if coordinator.offers(.share) {
                    Section {
                        NativeShareButton(coordinator: coordinator, collection: completion.kind.rawValue, id: completion.id,
                                          title: progressText("Teilen", "Share"))
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(completion.kind == .workout ? progressText("Training abgeschlossen", "Workout finished")
                                                         : progressText("Aktivität gespeichert", "Activity saved"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(progressText("Fertig", "Done")) { coordinator.closeCompletion(record) }
                }
            }
        }
        .environment(\.locale, progressText.locale)
        .tint(.blue)
        .task { await loadChunked() }
    }

    /// Großer Abschluss: Das Ack trug nur den Kopf; der Rest kommt unverändert aus dem Replay-Speicher des Webs.
    private func loadChunked() async {
        guard completion.chunked else { return }
        let kind = completion.kind
        let id = completion.id
        let result = await coordinator.assemble { cursor, requestId in
            NativeQueryRequest.completion(kind: kind, id: id, cursor: cursor, requestId: requestId)
        }
        guard !Task.isCancelled else { return }
        isLoading = false
        guard case .loaded(let content) = result else { return }
        if content.meta?["dismissed"]?.boolValue == true {
            coordinator.closeCompletion(record)
        } else if let full = NativeCompletion(json: content.parsed), let raw = content.parsed {
            completion = full
            // Dauerhaft: Nach einem Neustart zählt der ganze Abschluss, nicht der gekürzte Kopf.
            coordinator.storeFullCompletion(record, completion: raw)
        }
    }
}

private struct CompletionHeadline: View {
    let completion: NativeCompletion
    let text: ProgressText

    var body: some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                if let xp = completion.xp {
                    Text("+" + text.number(xp, digits: 0) + " XP")
                        .font(.largeTitle.bold())
                        .monospacedDigit()
                }
                if let level = completion.level {
                    HStack(alignment: .firstTextBaseline) {
                        if let number = level.level {
                            Text("Level \(number)").font(.headline)
                        }
                        Spacer(minLength: 8)
                        if let current = level.current, let needed = level.needed {
                            Text("\(text.number(current, digits: 0)) / \(text.number(needed, digits: 0)) XP")
                                .font(.subheadline)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                    }
                    if let current = level.current, let needed = level.needed, needed > 0 {
                        ProgressView(value: min(max(current, 0), needed), total: needed)
                            .accessibilityHidden(true)
                    }
                }
                HStack(spacing: 16) {
                    if let streak = completion.streak {
                        Label(text.count(streak, "Tag in Folge", "Tage in Folge", "day in a row", "days in a row"), systemImage: "flame")
                    }
                    if let weeks = completion.weekStreak {
                        Label(text.count(weeks, "Woche in Folge", "Wochen in Folge", "week in a row", "weeks in a row"), systemImage: "calendar")
                    }
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
                if !completion.week.isEmpty {
                    CompletionWeek(days: completion.week, text: text)
                }
            }
            .padding(.vertical, 4)
        }
    }
}

/// Sieben Tage wie `weekWorkoutDots`.
private struct CompletionWeek: View {
    let days: [NativeCompletion.WeekDay]
    let text: ProgressText

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(days.enumerated()), id: \.element.id) { index, day in
                VStack(spacing: 4) {
                    Text(text.weekdaySymbols.indices.contains(index) ? text.weekdaySymbols[index] : "")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Circle()
                        .fill(day.trained ? Color.accentColor : Color(.tertiarySystemFill))
                        .frame(width: 14, height: 14)
                        .overlay {
                            if day.today { Circle().strokeBorder(Color.accentColor, lineWidth: 1.5).padding(-3) }
                        }
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(text.longDay(day.date) + ", " + (day.trained ? text("trainiert", "trained") : text("kein Training", "no workout")))
            }
        }
    }
}

private struct CompletionWorkoutSection: View {
    let summary: NativeWorkoutSummary
    let text: ProgressText

    var body: some View {
        Section {
            if !summary.name.isEmpty {
                LabeledContent(text("Training", "Workout"), value: summary.name)
            }
            LabeledContent(text("Dauer", "Duration"), value: summary.durationClock ?? text("Dauer nicht erfasst", "Duration not recorded"))
            if let exercises = summary.exerciseCount {
                LabeledContent(text("Übungen", "Exercises"), value: "\(exercises)")
            }
            if let sets = summary.sets {
                LabeledContent(text("Sätze", "Sets"), value: text.number(sets, digits: 0))
            }
            if let reps = summary.reps {
                LabeledContent(text("Wiederholungen", "Reps"), value: text.number(reps, digits: 0))
            }
            if let volume = summary.volume {
                LabeledContent(text("Volumen", "Volume"), value: text.number(volume) + " kg")
            }
            if let bodyweight = summary.bodyweight {
                LabeledContent(text("Körpergewicht", "Body weight"), value: text.number(bodyweight) + " kg")
            }
        } header: {
            Text(text("Zusammenfassung", "Summary"))
        }
        .monospacedDigit()
    }
}

private struct CompletionRunSections: View {
    let detail: StoredActivityDetail
    let summary: JSONValue?
    let text: ActivityText

    var body: some View {
        let entry = detail.entry
        Section {
            if let route = detail.route {
                ActivityRouteMap(segments: RouteLine.segments(route), text: text)
                    .frame(height: 220)
                    .listRowInsets(EdgeInsets())
            }
            if !entry.name.isEmpty {
                LabeledContent(text("Aktivität", "Activity"), value: entry.name)
            }
            if let distance = summary?["distanceText"]?.stringValue, (entry.distanceKm ?? 0) > 0 {
                LabeledContent(text("Distanz", "Distance"), value: distance + " km")
            }
            if let clock = summary?["durationClock"]?.stringValue {
                LabeledContent(text("Dauer", "Duration"), value: clock)
            }
        }
        .monospacedDigit()
        ActivityDetailRows(km: entry.distanceKm, maxSpeed: detail.maxSpeed, gain: detail.elevationGain,
                           maxElevation: detail.elevationMax, pause: detail.pauseSeconds, kcal: entry.kcal,
                           paceText: (entry.distanceKm ?? 0) > 0 ? entry.paceText : nil, text: text)
        ActivitySplitsSection(splits: detail.splits, splitRest: detail.splitRest, text: text)
        if entry.type != "mma", let duration = entry.durationSeconds {
            ActivityLapsSection(laps: detail.laps, duration: duration, text: text)
        }
    }
}
