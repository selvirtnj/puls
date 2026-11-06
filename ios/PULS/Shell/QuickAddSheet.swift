import SwiftUI
import PULSCore

/// Einträge des Plus-Menüs in der Reihenfolge von `quickAddActions` (js/quick-units.js, ergänzt um „Aktivität“ aus
/// js/running.js/run-session.js). Jeder Eintrag führt in denselben nativen Ablauf wie im jeweiligen Tab.
enum QuickAddItem: String, CaseIterable, Identifiable {
    case food, barcode, label, recipe, water, weight, workout, activity, measurements

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .food: return "fork.knife"
        case .barcode: return "barcode.viewfinder"
        case .label: return "camera"
        case .recipe: return "frying.pan"
        case .water: return "drop"
        case .weight: return "scalemass"
        case .workout: return "dumbbell"
        case .activity: return "figure.run"
        case .measurements: return "ruler"
        }
    }

    func title(_ text: OverviewText) -> String {
        switch self {
        case .food: return text("Essen", "Food")
        case .barcode: return text("Barcode", "Barcode")
        case .label: return text("Nährwertfoto", "Nutrition label")
        case .recipe: return text("Rezept", "Recipe")
        case .water: return text("Wasser", "Water")
        case .weight: return text("Gewicht", "Weight")
        case .workout: return "Workout"
        case .activity: return text("Aktivität", "Activity")
        case .measurements: return text("Körpermaße", "Measurements")
        }
    }

    func note(_ text: OverviewText) -> String {
        switch self {
        case .food: return text("Lebensmittel suchen", "Search foods")
        case .barcode: return text("Produkt scannen", "Scan a product")
        case .label: return text("Tabelle auslesen", "Read the table")
        case .recipe: return text("Meine Rezepte eintragen", "Log my recipes")
        case .water: return text("Direkt +250 ml", "Add 250 ml directly")
        case .weight: return text("Messwert erfassen", "Log a measurement")
        case .workout: return text("Starten oder fortsetzen", "Start or resume")
        case .activity: return text("Laufen, Rad & mehr", "Run, ride & more")
        case .measurements: return text("Maße & Biometrie", "Measurements & biometrics")
        }
    }
}

/// Ein Eintrag mit seinem Ziel: nativ oder (ohne nativen Ablauf) Web-Ausweg; `enabled` = gerade ausführbar.
struct QuickAddEntry: Identifiable, Equatable {
    let item: QuickAddItem
    var opensWeb = false
    var enabled = true
    var id: String { item.rawValue }
}

/// Natives Plus-Menü (ersetzt das Web-`quickAddMenu`, solange die native Leiste aktiv ist).
struct QuickAddSheet: View {
    let text: OverviewText
    let entries: [QuickAddEntry]
    let onSelect: (QuickAddItem) -> Void
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(entries) { entry in
                        QuickAddRow(entry: entry, text: text) { onSelect(entry.item) }
                            .disabled(!entry.enabled)
                    }
                } footer: {
                    if entries.contains(where: \.opensWeb) {
                        Text(text("Mit ↗ markierte Einträge öffnen sich im PULS-Web-Dialog.",
                                  "Entries marked ↗ open in the PULS web dialog."))
                    }
                }
            }
            .listStyle(.insetGrouped)
            .contentMargins(.top, 4, for: .scrollContent)
            .navigationTitle(text("Schnell hinzufügen", "Quick add"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Schließen", "Close"), action: onClose)
                }
            }
        }
        .tint(.blue)
        .environment(\.locale, text.locale)
    }
}

private struct QuickAddRow: View {
    let entry: QuickAddEntry
    let text: OverviewText
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: entry.item.symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(Color.blue, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.item.title(text))
                        .foregroundStyle(.primary)
                    Text(entry.item.note(text))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Image(systemName: entry.opensWeb ? "arrow.up.forward.square" : "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint(entry.opensWeb ? text("Öffnet den PULS-Web-Dialog", "Opens the PULS web dialog") : "")
    }
}
