import SwiftUI
import PULSCore

/// Abschluss wie das Web-Sheet `finishWorkout`: Zahl absolvierter und nicht abgehakter Sätze, Hinweis zum Verwerfen
/// offener Sätze, optionales Körpergewicht (20–400 kg, ersetzt den Gewichtseintrag des Trainingstags).
/// Nach dem Ack zeigt das Web seine Abschlussansicht (XP, Serie, Teilen).
struct FinishWorkoutSheet: View {
    let session: TrainingSessionModel
    let text: TrainingText
    let isFinishing: Bool
    let onConfirm: (Double?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var bodyweight = ""
    @State private var showsError = false
    @FocusState private var weightFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(session.name.isEmpty ? "Workout" : session.name)
                        .font(.headline)
                    LabeledContent(text("Absolvierte Sätze", "Completed sets"), value: "\(session.doneSets)")
                    if session.openSets > 0 {
                        LabeledContent(text("Nicht abgehakte Sätze", "Unchecked sets"), value: "\(session.openSets)")
                    }
                } footer: {
                    if session.openSets > 0 {
                        Text(text("Nicht abgehakte Sätze werden beim Abschließen verworfen. Mit „Zurück“ kannst du sie weiter bearbeiten.",
                                  "Unchecked sets are discarded when you finish. Go back to keep editing them."))
                    }
                }
                Section {
                    TextField(text("z. B. 84", "e.g. 84"), text: $bodyweight)
                        .keyboardType(.decimalPad)
                        .focused($weightFocused)
                        .accessibilityLabel(text("Körpergewicht nach dem Training in kg, optional", "Body weight after the workout in kg, optional"))
                } header: {
                    Text(text("Körpergewicht nach dem Training · kg (optional)", "Body weight after the workout · kg (optional)"))
                } footer: {
                    if showsError {
                        Text(text("Bitte ein Gewicht zwischen 20 und 400 kg eingeben.", "Please enter a weight between 20 and 400 kg."))
                            .foregroundStyle(.red)
                    } else {
                        Text(text("Ein eingegebener Wert ersetzt den Gewichtseintrag dieses Trainingstags.",
                                  "An entered value replaces the weight entry for this workout day."))
                    }
                }
                Section {
                    Button(action: confirm) {
                        HStack {
                            Spacer()
                            if isFinishing {
                                ProgressView()
                            } else {
                                Text(text("Workout abschließen", "Finish workout"))
                                    .font(.headline)
                            }
                            Spacer()
                        }
                        .frame(minHeight: 44)
                    }
                    .disabled(isFinishing)
                    Button(text("Zurück zum Training", "Back to workout")) { dismiss() }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .disabled(isFinishing)
                }
            }
            .navigationTitle(text("Workout abschließen", "Finish workout"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(text("Fertig", "Done")) { weightFocused = false }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(isFinishing)
        .environment(\.locale, text.locale)
    }

    private func confirm() {
        switch SetInput.bodyweight(bodyweight) {
        case .success(let value):
            showsError = false
            weightFocused = false
            onConfirm(value)
        case .failure:
            showsError = true
        }
    }
}
