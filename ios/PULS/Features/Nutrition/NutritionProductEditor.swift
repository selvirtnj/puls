import SwiftUI
import UIKit
import PULSCore

// P2: Eigene Werte, Prüfung eines Barcode-/OFF-Entwurfs und Etikett-Review (§12.5 `product.save`). Native zeigt die vom
// Web gelieferten Werte und Warnungen, der Nutzer bestätigt ausdrücklich. Normalisierung, Warnungsprüfung, Quelle und
// Speichern macht allein das Web. Leere Felder bleiben leer (nie 0); g/ml muss ausdrücklich gewählt sein.

enum NutritionEditorMode: Equatable {
    case custom
    /// Barcode-/OFF-Entwurf oder vorhandenes Barcode-Produkt aus der `product`-Query.
    case review(NutritionProductDetail)
    /// Etikett: gelesene Vision-Zeilen und das Web-Parsing der gewählten Spalte.
    case label(lines: [String], parse: NutritionLabelParse, column: Int)
}

struct NutritionProductEditor: View {
    let coordinator: NutritionCoordinator
    let mode: NutritionEditorMode
    /// Nach dem bestätigten Speichern mit der gespeicherten Produkt-ID (Ansicht zeigt dann das Produkt zum Eintragen).
    var onSaved: ((String) -> Void)?
    /// Eingetragen/fertig (schließt das Sheet).
    var onDone: (() -> Void)?

    @State private var productId = NutritionOps.makeID()
    @State private var name = ""
    @State private var brand = ""
    @State private var unit: String?
    @State private var kcal = ""
    @State private var p = ""
    @State private var c = ""
    @State private var f = ""
    @State private var fiber = ""
    @State private var packageAmount = ""
    @State private var basis: NutritionOps.LabelBasis = .g
    @State private var portionAmount = ""
    @State private var column = 0
    @State private var parse: NutritionLabelParse?
    @State private var reparsing = false
    /// Bestätigungen gelten nur für genau den Formularstand, für den sie gegeben wurden; jede Änderung (Werte, Name,
    /// Bezug, Spalte, Warnungen) hebt sie sofort auf.
    @State private var labelConfirmedFor: FormSnapshot?
    @State private var warningsConfirmedFor: FormSnapshot?
    @State private var commandId: String?
    @State private var status: String?
    @State private var savedId: String?
    @State private var prefilled = false
    /// Vom Web beim Speichern gemeldete Warnung (`conflict`), die erst bestätigt werden muss.
    @State private var webWarnings: [String] = []
    /// Packungsgröße wurde beim Wechsel von g/ml geleert (sie bezog sich auf die alte Einheit).
    @State private var packageCleared = false

    init(coordinator: NutritionCoordinator, mode: NutritionEditorMode, onSaved: ((String) -> Void)? = nil, onDone: (() -> Void)? = nil) {
        self.coordinator = coordinator
        self.mode = mode
        self.onSaved = onSaved
        self.onDone = onDone
    }

    var body: some View {
        let text = coordinator.text
        Group {
            if let savedId {
                // Gespeichert: dasselbe Produkt wie aus der Suche, jetzt mit lokaler Quelle eintragbar.
                NutritionProductView(coordinator: coordinator, ref: .id(savedId), onAdded: onDone)
            } else {
                form(text)
            }
        }
        .navigationTitle(title(text))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: prefill)
        .task(id: commandId) { await awaitAck() }
    }

    private func title(_ text: OverviewText) -> String {
        switch mode {
        case .custom: return text("Eigene Werte", "Custom values")
        case .review: return text("Produkt prüfen", "Review product")
        case .label: return text("Etikett prüfen", "Review label")
        }
    }

    // MARK: Formular

    private func form(_ text: OverviewText) -> some View {
        Form {
            Section {
                TextField(text("Name", "Name"), text: $name)
                if !isLabel {
                    TextField(text("Marke (optional)", "Brand (optional)"), text: $brand)
                }
                if case .review(let detail) = mode, let code = barcode(detail) {
                    LabeledContent(text("Barcode", "Barcode"), value: code).monospacedDigit()
                }
                if isLabel {
                    Picker(text("Bezug", "Basis"), selection: $basis) {
                        Text(text("je 100 g", "per 100 g")).tag(NutritionOps.LabelBasis.g)
                        Text(text("je 100 ml", "per 100 ml")).tag(NutritionOps.LabelBasis.ml)
                        Text(text("je Portion (g)", "per serving (g)")).tag(NutritionOps.LabelBasis.portionG)
                        Text(text("je Portion (ml)", "per serving (ml)")).tag(NutritionOps.LabelBasis.portionML)
                    }
                    if basis.isPortion {
                        numberField(text("Portionsgröße (\(basis.unit))", "Serving size (\(basis.unit))"), $portionAmount)
                    }
                } else {
                    Picker(text("Werte je 100", "Values per 100"), selection: Binding(get: { unit ?? "" }, set: { changeUnit($0.isEmpty ? nil : $0) })) {
                        if unit == nil { Text(text("Bitte wählen", "Please choose")).tag("") }
                        Text("g").tag("g")
                        Text("ml").tag("ml")
                    }
                }
            } footer: {
                if !isLabel, unit == nil {
                    Text(text("Bezug unbekannt. Bitte g oder ml wählen, nichts wird umgerechnet.",
                              "Basis unknown. Please choose g or ml, nothing is converted."))
                }
            }

            if isLabel {
                Section {
                    Picker(text("Spalte", "Column"), selection: $column) {
                        Text(text("1. Spalte", "1st column")).tag(0)
                        Text(text("2. Spalte", "2nd column")).tag(1)
                        Text(text("3. Spalte", "3rd column")).tag(2)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: column) { _, value in Task { await reparse(value) } }
                    if reparsing { ProgressView() }
                } header: {
                    Text(text("Spalte auf dem Etikett", "Column on the label"))
                } footer: {
                    Text(text("Werte kommen aus der gewählten Spalte. Bitte mit dem Etikett vergleichen.",
                              "Values come from the selected column. Please compare with the label."))
                }
            }

            Section {
                numberField(text("Energie (kcal)", "Energy (kcal)"), $kcal)
                numberField(text.macroLabel("p") + " (g)", $p)
                numberField(text.macroLabel("c") + " (g)", $c)
                numberField(text.macroLabel("f") + " (g)", $f)
                if isLabel {
                    numberField(text("Ballaststoffe (g, optional)", "Fiber (g, optional)"), $fiber)
                }
            } header: {
                Text(valuesHeader(text))
            } footer: {
                Text(text("Leere Felder bleiben unbekannt und werden nicht als 0 gespeichert.",
                          "Empty fields stay unknown and are never saved as 0."))
            }

            if !isLabel {
                Section {
                    numberField(text("Packungsgröße (\(unit ?? "g/ml"), optional)", "Package size (\(unit ?? "g/ml"), optional)"), $packageAmount)
                } footer: {
                    if packageCleared {
                        Text(text("Packungsgröße geleert, weil sich die Einheit geändert hat. Bitte neu eintragen.",
                                  "Package size cleared because the unit changed. Please enter it again."))
                    }
                }
            }

            let warnings = currentWarnings
            if !warnings.isEmpty || isLabel {
                Section {
                    ForEach(warnings, id: \.self) { warning in
                        Label(warning, systemImage: "exclamationmark.triangle").foregroundStyle(.orange)
                    }
                    if isLabel {
                        Toggle(text("Name, Spalte, Bezug und Werte geprüft", "Name, column, basis and values checked"),
                               isOn: Binding(get: { labelConfirmed }, set: { labelConfirmedFor = $0 ? formSnapshot : nil }))
                            .disabled(reparsing)
                    }
                    if !warnings.isEmpty {
                        Toggle(text("Warnungen gelesen, Werte stimmen", "Warnings read, values are correct"),
                               isOn: Binding(get: { confirmWarnings }, set: { warningsConfirmedFor = $0 ? formSnapshot : nil }))
                            .disabled(reparsing)
                    }
                }
            }

            if case .review(let detail) = mode, let attribution = detail.attribution {
                Section {
                    if let privacy = attribution.privacy { Text(privacy).font(.footnote).foregroundStyle(.secondary) }
                    if let url = attribution.url { Link(attribution.name, destination: url) }
                    if let url = attribution.licenseUrl { Link(attribution.license ?? "ODbL", destination: url) }
                } header: {
                    Text(text("Quelle", "Source"))
                }
            }

            Section {
                if let status {
                    Text(status).font(.subheadline).foregroundStyle(.secondary)
                }
                Button {
                    save()
                } label: {
                    HStack {
                        Spacer()
                        if commandId != nil { ProgressView().padding(.trailing, 6) }
                        Text(text("Prüfen und speichern", "Check and save")).font(.headline)
                        Spacer()
                    }
                    .frame(minHeight: 36)
                }
                .buttonStyle(.borderedProminent)
                .disabled(command(text) == nil || commandId != nil || !coordinator.canWrite)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
        }
    }

    private struct FormSnapshot: Equatable {
        let fields: [String]
        let warnings: [String]
    }

    private var formSnapshot: FormSnapshot {
        FormSnapshot(fields: [name, brand, unit ?? "", kcal, p, c, f, fiber, packageAmount, basis.rawValue, portionAmount, String(column)],
                     warnings: currentWarnings)
    }

    private var labelConfirmed: Bool { labelConfirmedFor == formSnapshot }
    private var confirmWarnings: Bool { warningsConfirmedFor == formSnapshot }

    /// g/ml wechseln: eine eingetragene Packungsgröße bezog sich auf die alte Einheit und wird sichtbar geleert.
    private func changeUnit(_ newUnit: String?) {
        guard newUnit != unit else { return }
        // Bisher unbekannter Bezug: die Entwurfspackung gilt nur für ihre eigene Einheit (`packageUnit`).
        var packageUnit = unit
        if packageUnit == nil, case .review(let detail) = mode {
            packageUnit = detail.draft?["packageUnit"]?.stringValue ?? detail.expect?["unit"]?.stringValue
        }
        if let packageUnit, packageUnit != newUnit, !packageAmount.trimmingCharacters(in: .whitespaces).isEmpty {
            packageAmount = ""
            packageCleared = true
        }
        unit = newUnit
    }

    private var isLabel: Bool {
        if case .label = mode { return true }
        return false
    }

    private var currentWarnings: [String] {
        let base: [String]
        switch mode {
        case .custom: base = []
        case .review(let detail): base = detail.warnings
        case .label: base = parse?.warnings ?? []
        }
        return base + webWarnings.filter { !base.contains($0) }
    }

    private func valuesHeader(_ text: OverviewText) -> String {
        if isLabel {
            return basis.isPortion ? text("Werte je Portion", "Values per serving")
                                   : text("Werte je 100 \(basis.unit)", "Values per 100 \(basis.unit)")
        }
        return text("Werte je 100 \(unit ?? "g/ml")", "Values per 100 \(unit ?? "g/ml")")
    }

    private func numberField(_ title: String, _ value: Binding<String>) -> some View {
        LabeledContent(title) {
            TextField("", text: value)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
                .accessibilityLabel(title)
        }
    }

    // MARK: Vorbelegung

    private func prefill() {
        guard !prefilled else { return }
        prefilled = true
        let locale = coordinator.text.locale
        let show: (Double?) -> String = { $0.map { NutritionInput.text($0, locale: locale) } ?? "" }
        switch mode {
        case .custom:
            break
        case .review(let detail):
            // Bestehende Rohdaten vor dem OFF-Entwurf; ein unbekannter Bezug bleibt ungewählt.
            let source = detail.expect ?? detail.draft ?? .object([:])
            let string: (String) -> String? = { source[$0]?.stringValue }
            let numberValue: (String) -> Double? = { source[$0]?.doubleValue }
            if let id = detail.expect?["id"]?.stringValue, NutritionOps.isValidNewID(id) { productId = id }
            name = string("name") ?? detail.product.name
            brand = string("brand") ?? detail.product.brand
            let rawUnit = string("unit")
            unit = rawUnit == "g" || rawUnit == "ml" ? rawUnit : (detail.baseKnown ? detail.base : nil)
            kcal = show(numberValue("kcal") ?? detail.product.kcal)
            p = show(numberValue("p") ?? detail.product.p)
            c = show(numberValue("c") ?? detail.product.c)
            f = show(numberValue("f") ?? detail.product.f)
            // 0 bzw. fehlend = leeres Packungsfeld (nie „0“ vorbelegen).
            packageAmount = show(numberValue("packageAmount").flatMap { $0 > 0 ? $0 : nil })
        case .label(_, let parse, let column):
            self.parse = parse
            self.column = column
            apply(parse)
        }
    }

    private func apply(_ parse: NutritionLabelParse) {
        let locale = coordinator.text.locale
        let show: (Double?) -> String = { $0.map { NutritionInput.text($0, locale: locale) } ?? "" }
        kcal = show(parse.values["kcal"])
        p = show(parse.values["p"])
        c = show(parse.values["c"])
        f = show(parse.values["f"])
        fiber = show(parse.values["fiber"])
    }

    private func reparse(_ newColumn: Int) async {
        guard case .label(let lines, _, _) = mode else { return }
        reparsing = true
        labelConfirmedFor = nil
        warningsConfirmedFor = nil
        defer { if column == newColumn { reparsing = false } }
        let result = await coordinator.fetch { NutritionQueryRequest.labelParse(lines: lines, column: newColumn, requestId: $0) }
        // Nur die Antwort der aktuell gewählten Spalte übernehmen (schnelles Umschalten).
        guard column == newColumn else { return }
        if case .loaded(let message) = result, case .labelParse(let parsed)? = message.result {
            parse = parsed
            apply(parsed)
        }
        labelConfirmedFor = nil
        warningsConfirmedFor = nil
    }

    private func barcode(_ detail: NutritionProductDetail) -> String? {
        if case .barcode(let code) = detail.product.ref { return code }
        return detail.expect?["barcode"]?.stringValue ?? detail.draft?["barcode"]?.stringValue
    }

    // MARK: Speichern

    private func number(_ text: String) -> Double? {
        NutritionInput.number(text, locale: coordinator.text.locale)
    }

    private func command(_ text: OverviewText) -> Command? {
        guard !reparsing, let kcal = number(kcal), let p = number(p), let c = number(c), let f = number(f) else { return nil }
        let warnings = currentWarnings
        let confirm = warnings.isEmpty ? false : confirmWarnings
        if !warnings.isEmpty, !confirmWarnings { return nil }
        let trimmedPackage = packageAmount.trimmingCharacters(in: .whitespaces)
        let package: Double?? = trimmedPackage.isEmpty ? .some(nil) : number(trimmedPackage).map { .some($0) }
        switch mode {
        case .custom:
            guard let unit, let package else { return nil }
            let values = NutritionCommands.ProductValues(name: name, unit: unit, kcal: kcal, p: p, c: c, f: f,
                                                         brand: brand, packageAmount: package)
            return NutritionCommands.saveProduct(kind: .custom, id: productId, values: values, expect: nil, confirmWarnings: confirm)
        case .review(let detail):
            guard let unit, let package, let code = barcode(detail) else { return nil }
            let values = NutritionCommands.ProductValues(name: name, unit: unit, kcal: kcal, p: p, c: c, f: f,
                                                         brand: brand, barcode: code, packageAmount: package)
            return NutritionCommands.saveProduct(kind: .review, id: productId, values: values, expect: detail.expect,
                                                 draft: detail.expect == nil ? detail.draft : nil, confirmWarnings: confirm)
        case .label:
            guard labelConfirmed else { return nil }
            let trimmedFiber = fiber.trimmingCharacters(in: .whitespaces)
            let fiberValue: Double? = trimmedFiber.isEmpty ? nil : number(trimmedFiber)
            if !trimmedFiber.isEmpty, fiberValue == nil { return nil }
            let amount = basis.isPortion ? number(portionAmount) : 100
            guard let amount else { return nil }
            let values = NutritionCommands.ProductValues(name: name, unit: basis.unit, kcal: kcal, p: p, c: c, f: f, fiber: fiberValue)
            return NutritionCommands.saveProduct(kind: .label, id: productId, values: values, expect: nil,
                                                 label: (basis, amount, column), confirmWarnings: confirm)
        }
    }

    private func save() {
        guard let command = command(coordinator.text) else { return }
        status = nil
        commandId = coordinator.saveProduct(command)
    }

    /// Wartet auf das Ack des eigenen `product.save`. `conflict` = Web-Warnungen nicht bestätigt bzw. Stand geändert:
    /// geparkten Befehl verwerfen, Hinweis zeigen und erneutes Speichern erlauben. `busy`/`persist_failed` hält die Outbox.
    private func awaitAck() async {
        guard let commandId else { return }
        let text = coordinator.text
        while !Task.isCancelled {
            if let event = coordinator.ackOutcome(commandId) {
                if event.ok, let id = event.result?["productId"]?.stringValue {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    if let onSaved { onSaved(id) } else { savedId = id }
                    self.commandId = nil
                    return
                }
                switch event.code {
                case .busy?, .persistFailed?, .readonly?, .notReady?:
                    status = text("Wird gespeichert, sobald PULS bereit ist.", "Will be saved as soon as PULS is ready.")
                case .conflict?:
                    coordinator.discardOwn(commandId)
                    let warning = event.message ?? text("Bitte Warnungen prüfen.", "Please check the warnings.")
                    if !webWarnings.contains(warning) { webWarnings.append(warning) }
                    status = text("Prüfe die Werte und bestätige erneut.", "Check the values and confirm again.")
                    warningsConfirmedFor = nil
                    self.commandId = nil
                    return
                default:
                    status = text("Nicht gespeichert", "Not saved") + (event.message.map { ": \($0)" } ?? ".")
                    self.commandId = nil
                    return
                }
            }
            try? await Task.sleep(for: .milliseconds(80))
        }
    }
}
