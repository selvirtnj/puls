import SwiftUI
import PULSCore

// N1 §15.3: Tagebuch und Rezepte über alte Grenzen hinaus. Zeilen haben dieselbe Form wie die Projektion.

struct NutritionAllEntriesSheet: View {
    let coordinator: NutritionCoordinator
    let date: String
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let text = coordinator.text
        NavigationStack {
            Group {
                if let extras = coordinator.extras {
                    PagedList(extras: extras, query: .diary(date: date), title: text("Dein Essen", "Your food"), text: text) { _, item in
                        if let entry = NutritionEntry(pageRow: item) {
                            NutritionEntryRow(entry: entry, text: text, isDeleting: false) {
                                coordinator.present(.entry(entry.id))
                            }
                            .disabled(!coordinator.supportsEntry)
                        }
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(text("Schließen", "Close")) { dismiss() }
                }
            }
        }
    }
}

struct NutritionAllRecipesView: View {
    let coordinator: NutritionCoordinator

    var body: some View {
        let text = coordinator.text
        if let extras = coordinator.extras {
            PagedList(extras: extras, query: .recipes, title: text("Alle Rezepte", "All recipes"), text: text) { _, item in
                if let recipe = NutritionRecipeRow(pageRow: item) {
                    NavigationLink(value: NutritionRoute.product(recipe.ref)) {
                        Text(recipe.name.isEmpty ? text("Rezept", "Recipe") : recipe.name)
                    }
                }
            }
        }
    }
}

// MARK: - Konto

/// Gewichtsverlauf über 100 Einträge hinaus: historische BMI-/Alter-Schätzungen wie in der Projektion.
struct AccountAllHistoryView: View {
    let extras: ExtrasCoordinator
    let text: OverviewText

    var body: some View {
        PagedList(extras: extras, query: .bodyHistory, title: text("Gewichtsverlauf", "Weight history"), text: text,
                  footer: text("BMI und Körperfett hier sind historische Schätzungen aus BMI und Alter, keine Navy- oder Messwerte.",
                               "BMI and body fat here are historical estimates from BMI and age, not Navy or measured values.")) { _, item in
            if let row = AccountHistoryRow(pageRow: item) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(text.day(row.date) + (row.kg.map { " · " + text.kg($0) } ?? ""))
                    Text("BMI " + text.optionalNumber(row.bmi) + " · " + text("Körperfett ", "Body fat ")
                         + text.optionalNumber(row.bodyFat, unit: "%"))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// Körpermaße über 20 Einträge hinaus (nur Anzeige; Bearbeiten bleibt in der Körperseite).
struct AccountAllMeasurementsView: View {
    let extras: ExtrasCoordinator
    let fields: [AccountMeasurementField]
    let text: OverviewText

    var body: some View {
        PagedList(extras: extras, query: .measurements, title: text("Körpermaße", "Body measurements"), text: text) { _, item in
            if let row = AccountMeasurement(pageRow: item) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(text.day(row.date))
                    Text(valuesLine(row))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    private func valuesLine(_ row: AccountMeasurement) -> String {
        let parts = fields.compactMap { field -> String? in
            guard let value = row.values[field.key] else { return nil }
            return "\(field.label) \(text.number(value)) \(field.unit)"
        }
        return parts.isEmpty ? text("keine bekannten Werte", "no known values") : parts.joined(separator: " · ")
    }
}
