import SwiftUI
import PULSCore

/// Gewicht eintragen oder einen vorhandenen Tag bearbeiten. Regeln wie `addWeight` (js/app.js):
/// Komma oder Punkt, 20 bis 400 kg, ein Gewicht pro Tag (ein vorhandener Tageseintrag wird ersetzt).
/// Beim Bearbeiten bleibt der Tag fest (wie im Web ersetzt ein Eintrag nur den Wert seines Tages).
struct WeightEditorSheet: View {
    let request: WeightEditorRequest
    let text: BodyText
    /// Liefert eine Fehlermeldung oder `nil` bei Erfolg.
    let onSave: (_ date: Date, _ kg: Double) -> String?

    @Environment(\.dismiss) private var dismiss
    // Einmalige Startwerte aus `request`; danach gehört die Eingabe dem Sheet.
    @State private var date: Date
    @State private var kgText: String
    @State private var saveError: String?
    @FocusState private var kgFocused: Bool

    init(request: WeightEditorRequest, text: BodyText,
         onSave: @escaping (_ date: Date, _ kg: Double) -> String?) {
        self.request = request
        self.text = text
        self.onSave = onSave
        _date = State(initialValue: request.initialDate)
        _kgText = State(initialValue: request.initialText)
    }

    private var parsed: Double? { WeightMath.parseKg(kgText) }
    private var isValid: Bool { parsed.map(WeightMath.isValidKg) ?? false }
    private var showsInputError: Bool {
        !kgText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isValid
    }

    /// Anderer Eintrag am gewählten Tag (Stand beim Öffnen), der beim Sichern ersetzt wird.
    private var replaced: WeightEntry? {
        guard request.original == nil else { return nil }
        let day = WeightDay.string(from: date)
        return request.seen.first { $0.date == day }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if let original = request.original {
                        LabeledContent(text("Datum", "Date"), value: text.day(original.date))
                    } else {
                        DatePicker(
                            text("Datum", "Date"),
                            selection: $date,
                            in: ...WeightDay.endOfToday(),
                            displayedComponents: .date
                        )
                    }
                    HStack(spacing: 8) {
                        Text(text("Gewicht", "Weight"))
                        Spacer(minLength: 12)
                        TextField(text("z. B. 82,4", "e.g. 82.4"), text: $kgText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .focused($kgFocused)
                            .submitLabel(.done)
                            .onSubmit(save)
                            .accessibilityLabel(text("Gewicht in Kilogramm", "Weight in kilograms"))
                        Text("kg")
                            .foregroundStyle(.secondary)
                            .accessibilityHidden(true)
                    }
                } footer: {
                    if showsInputError {
                        Text(text("Bitte ein Gewicht zwischen 20 und 400 kg eingeben.", "Please enter a weight between 20 and 400 kg."))
                            .foregroundStyle(.red)
                    } else if let replaced {
                        Text(text(
                            "Für diesen Tag ist schon \(text.kg(replaced.kg)) erfasst. Pro Tag gibt es ein Gewicht, der Wert wird ersetzt.",
                            "\(text.kg(replaced.kg)) is already logged for this day. There is one weight per day, it will be replaced."
                        ))
                    }
                }

                if let saveError {
                    Section {
                        Label(saveError, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(request.original == nil ? text("Gewicht eintragen", "Log weight") : text("Gewicht bearbeiten", "Edit weight"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(text("Sichern", "Save"), action: save)
                        .disabled(!isValid)
                }
            }
            .onChange(of: kgText) { _, _ in saveError = nil }
            .onChange(of: date) { _, _ in saveError = nil }
            .task {
                // Tastatur direkt zeigen (nach dem Hochgleiten des Sheets).
                try? await Task.sleep(for: .milliseconds(350))
                kgFocused = true
            }
        }
    }

    private func save() {
        guard let kg = parsed, WeightMath.isValidKg(kg) else { return }
        if let error = onSave(date, kg) {
            saveError = error
        } else {
            dismiss()
        }
    }
}
