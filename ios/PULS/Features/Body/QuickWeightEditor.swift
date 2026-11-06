import SwiftUI
import UIKit
import PULSCore

/// „Gewicht erfassen“ aus Übersicht und Plus-Menü: dasselbe native Blatt wie im Körperbereich (M2), direkt geöffnet.
/// Speichert wie `BodyView.save` (neuer Eintrag, `weight.upsert`, ein Gewicht pro Tag); Konflikte zeigt der
/// Körperbereich beim nächsten Öffnen.
struct QuickWeightEditor: View {
    @Environment(ProfileStore.self) private var store
    let request: WeightEditorRequest
    let onClose: () -> Void

    var body: some View {
        let text = BodyText(document: store.document)
        WeightEditorSheet(request: request, text: text, onSave: { date, kg in
            save(date: date, kg: kg, text: text)
        }, onDismiss: onClose)
        .tint(.blue)
        .environment(\.locale, text.locale)
        // ISO-Tage und Datumsauswahl immer gregorianisch, unabhängig vom Gerätekalender.
        .environment(\.calendar, WeightDay.calendar())
        .onChange(of: store.userId) { _, _ in
            // Kontowechsel: das Blatt gehört zum alten Konto.
            onClose()
        }
    }

    private func save(date: Date, kg: Double, text: BodyText) -> String? {
        let command = WeightCommands.add(date: WeightDay.string(from: date), kg: kg,
                                         newID: UUID().uuidString.lowercased(), seen: request.seen)
        do {
            try store.performWeight(command, asUser: request.userId)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return nil
        } catch {
            return text.message(for: error)
        }
    }
}
