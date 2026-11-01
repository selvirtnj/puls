import Foundation

// M8/S: Konto-Ops aus docs/native/NATIVE-BRIDGE-PROTOCOL.md §13.4 (Gegenstück: js/native-account.js).
//
// - Erwartungen sind Rohwerte aus dem verlustfreien Spiegel (Name, Avatar, Maße, Klänge) bzw. der vollständige
//   Planner-Kontext aus `pulsNativeAccountQuery` (Profil, Plan, adaptiver Erhalt), nie aus der gekürzten Projektion.
// - Optimistische Reducer nur, wo die Wirkung eindeutig ist (Name, Avatar entfernen, Maße mergen/löschen, Sprache,
//   Klänge). Profil/Plan/Ziele, Avatar-Bild und Gerätedarstellung setzt allein das Web.
// - Wirkungsprüfungen (§7) lesen das gespeicherte Profil, `ack.result` und für `appearance.set` `snapshot.device`.

/// Prüft eine Wirkung mit dem ganzen Snapshot (z. B. `device` neben `state`). Vorrang vor `EffectCheck`.
public typealias SnapshotEffectCheck = @Sendable (_ args: JSONValue, _ snapshot: SnapshotMessage, _ result: JSONValue?) -> Bool

public enum AccountOps {
    public static let nameSet = "profile.name.set"
    public static let avatarSet = "profile.avatar.set"
    public static let profileSet = "profile.set"
    public static let planSet = "plan.set"
    public static let adaptiveSet = "adaptive.set"
    public static let measurementsSave = "measurements.save"
    public static let measurementsDelete = "measurements.delete"
    public static let appearanceSet = "appearance.set"
    public static let soundSet = "sound.set"

    public static let all: Set<String> = [
        nameSet, avatarSet, profileSet, planSet, adaptiveSet, measurementsSave, measurementsDelete, appearanceSet, soundSet,
    ]

    public static func isAccount(_ op: String) -> Bool { all.contains(op) }

    /// Web `JSON.stringify(a).length <= 24*1024`.
    public static let argsLimit = 24 * 1024
    public static let defaultVolume: Double = 35
    public static let maxVolume: Double = 70

    // MARK: Lesen im Profil

    /// Web `(state.displayName ?? null)`.
    public static func rawName(_ state: JSONValue) -> JSONValue {
        guard let value = state["displayName"], !value.isNull else { return .null }
        return value
    }

    public static func rawAvatar(_ state: JSONValue) -> JSONValue {
        guard let value = state["avatarImage"], !value.isNull else { return .null }
        return value
    }

    public static func measurements(_ state: JSONValue) -> [JSONValue] {
        state["measurements"]?.arrayValue ?? []
    }

    public static func measurement(_ state: JSONValue, id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return measurements(state).first { $0["id"]?.stringValue == id }
    }

    public static func measurements(_ state: JSONValue, date: String) -> [JSONValue] {
        measurements(state).filter { $0["date"]?.stringValue == date }
    }

    /// Web `language === 'en' ? 'en' : 'de'`.
    public static func language(_ state: JSONValue) -> String {
        state["language"]?.stringValue == "en" ? "en" : "de"
    }

    /// Web `{enabled: soundEnabled !== false, volume: soundVolume ?? 35}` (Rohwert, auch Nicht-Zahl).
    public static func sound(_ state: JSONValue) -> (enabled: Bool, volume: JSONValue) {
        let enabled = state["soundEnabled"] != .bool(false)
        if let raw = state["soundVolume"], !raw.isNull { return (enabled, raw) }
        return (enabled, .number(defaultVolume))
    }

    /// Zielzeile von `measurements.save`: `{...(expect || {id,date}), ...values}`.
    public static func measurementTarget(_ args: JSONValue) -> JSONValue? {
        guard let id = args["id"]?.stringValue, let date = args["date"]?.stringValue, let values = args["values"]?.objectValue else {
            return nil
        }
        var target: [String: JSONValue]
        switch args["expect"] {
        case .object(let old)?: target = old
        case .null?, nil: target = ["id": .string(id), "date": .string(date)]
        default: return nil
        }
        for (key, value) in values { target[key] = value }
        return .object(target)
    }

    /// Web `!!s.measurements?.find(...)` usw.: erster Treffer in einer Liste nach `date` (`Array.find`).
    static func firstRecord(_ state: JSONValue, _ key: String, date: String) -> JSONValue {
        (state[key]?.arrayValue ?? []).first { $0["date"]?.stringValue == date } ?? .null
    }

    static func normalized(_ value: JSONValue?) -> JSONValue {
        value ?? .null
    }

    /// Planner-/Zielwirkung exakt wie Web `plannerEffective` bzw. `goals.set.effective`: Profil, Plan, Ziele und Kalibrierung
    /// wie im Result; die **ersten** Verlaufseinträge des `effect.date` gleich den Records (fehlend = `null`).
    public static func plannerEffectIsVisible(_ state: JSONValue, _ result: JSONValue?) -> Bool {
        guard let effect = result?["effect"], case .object = effect, let date = effect["date"]?.stringValue else { return false }
        for key in ["profile", "plan", "goals", "tdeeCalibration"] {
            guard normalized(state[key]) == normalized(effect[key]) else { return false }
        }
        return firstRecord(state, "goalHistory", date: date) == normalized(effect["goalRecord"])
            && firstRecord(state, "profileHistory", date: date) == normalized(effect["profileRecord"])
    }

    static func serializedLength(_ value: JSONValue) -> Int {
        value.serializedString().utf16.count
    }

    public static func makeID() -> String {
        UUID().uuidString.lowercased()
    }
}

// MARK: - Preparer

extension BridgeOps {
    public static let accountPreparers: [String: CommandPreparer] = [
        AccountOps.nameSet: prepareAccountName,
        AccountOps.avatarSet: prepareAccountAvatar,
        AccountOps.measurementsSave: prepareMeasurementSave,
        AccountOps.measurementsDelete: prepareMeasurementDelete,
        AccountOps.soundSet: prepareSound,
    ]

    private static func withExpect(_ args: JSONValue, _ expect: JSONValue) -> JSONValue {
        var prepared = args
        prepared["expect"] = expect
        return prepared
    }

    /// `expect` = bisheriger Rohname oder `null`.
    @Sendable
    public static func prepareAccountName(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return withExpect(args, AccountOps.rawName(document.root))
    }

    /// `expect` = bisheriges gespeichertes JPEG oder `null`.
    @Sendable
    public static func prepareAccountAvatar(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        return withExpect(args, AccountOps.rawAvatar(document.root))
    }

    /// `expect` = vollständiger Tagesrecord (einziger Eintrag des Tages) oder `null`.
    @Sendable
    public static func prepareMeasurementSave(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let date = args["date"]?.stringValue else { return args }
        return withExpect(args, AccountOps.measurements(document.root, date: date).first ?? .null)
    }

    /// `expect` = vollständiger Rohrecord; fehlt er schon, `{id}` (das Web bestätigt dann als Noop).
    @Sendable
    public static func prepareMeasurementDelete(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil, let id = args["id"]?.stringValue else { return args }
        return withExpect(args, AccountOps.measurement(document.root, id: id) ?? ["id": .string(id)])
    }

    @Sendable
    public static func prepareSound(_ args: JSONValue, _ document: ProfileDocument) -> JSONValue {
        guard args["expect"] == nil else { return args }
        let sound = AccountOps.sound(document.root)
        return withExpect(args, ["enabled": .bool(sound.enabled), "volume": sound.volume])
    }
}

// MARK: - Optimistische Reducer

extension BridgeOps {
    public static let accountReducers: [String: OptimisticReducer] = [
        AccountOps.nameSet: reduceAccountName,
        AccountOps.avatarSet: reduceAccountAvatar,
        AccountOps.measurementsSave: reduceMeasurementSave,
        AccountOps.measurementsDelete: reduceMeasurementDelete,
        AccountOps.appearanceSet: reduceAppearanceLanguage,
        AccountOps.soundSet: reduceSound,
    ]

    @Sendable
    public static func reduceAccountName(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let name = args["name"]?.stringValue, let expect = args["expect"],
              AccountOps.rawName(state) == expect else { return }
        state["displayName"] = .string(JSString.trim(name))
    }

    /// Nur das Entfernen ist eindeutig; ein neues Bild normalisiert allein das Web (160 px JPEG).
    @Sendable
    public static func reduceAccountAvatar(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, args["dataUrl"] == .null, let expect = args["expect"],
              AccountOps.rawAvatar(state) == expect else { return }
        state["avatarImage"] = nil
    }

    @Sendable
    public static func reduceMeasurementSave(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let date = args["date"]?.stringValue, let id = args["id"]?.stringValue,
              let target = AccountOps.measurementTarget(args) else { return }
        var list = AccountOps.measurements(state)
        let sameDay = list.indices.filter { list[$0]["date"]?.stringValue == date }
        switch (sameDay.count, args["expect"]) {
        case (0, .null?):
            guard !list.contains(where: { $0["id"]?.stringValue == id }) else { return }
            list.append(target)
        case (1, let expect?):
            guard list[sameDay[0]] == expect, expect["id"]?.stringValue == id else { return }
            list[sameDay[0]] = target
        default:
            return
        }
        state["measurements"] = .array(list)
    }

    @Sendable
    public static func reduceMeasurementDelete(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let id = args["id"]?.stringValue, let expect = args["expect"],
              let list = state["measurements"]?.arrayValue,
              let row = list.first(where: { $0["id"]?.stringValue == id }), row == expect else { return }
        state["measurements"] = .array(list.filter { $0["id"]?.stringValue != id })
    }

    /// Nur die Sprache (Profilfeld); das Gerätefarbschema liegt außerhalb des Profils.
    @Sendable
    public static func reduceAppearanceLanguage(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let language = args["language"]?.stringValue, ["de", "en"].contains(language),
              let expected = args["expect"]?["language"]?.stringValue, AccountOps.language(state) == expected else { return }
        state["language"] = .string(language)
    }

    @Sendable
    public static func reduceSound(_ state: inout JSONValue, _ args: JSONValue) {
        guard case .object = state, let enabled = args["enabled"]?.boolValue, let volume = args["volume"], volume.doubleValue != nil,
              let expect = args["expect"] else { return }
        let current = AccountOps.sound(state)
        guard expect["enabled"] == .bool(current.enabled), expect["volume"] == current.volume else { return }
        state["soundEnabled"] = .bool(enabled)
        state["soundVolume"] = volume
    }
}

// MARK: - Sichtbare Wirkung (§7, §13.4)

extension BridgeOps {
    public static let accountEffectChecks: [String: EffectCheck] = [
        AccountOps.nameSet: { args, state, _ in
            guard let name = args["name"]?.stringValue else { return false }
            return state["displayName"] == .string(JSString.trim(name))
        },
        // Exaktes vom Web gespeichertes JPEG (`result.avatarImage`) bzw. fehlendes Feld.
        AccountOps.avatarSet: { args, state, result in
            let wanted: JSONValue
            if let image = result?["avatarImage"] {
                wanted = image
            } else if args["dataUrl"] == .null {
                wanted = .null
            } else {
                return false
            }
            return AccountOps.rawAvatar(state) == wanted
        },
        AccountOps.profileSet: { _, state, result in AccountOps.plannerEffectIsVisible(state, result) },
        AccountOps.planSet: { _, state, result in AccountOps.plannerEffectIsVisible(state, result) },
        AccountOps.adaptiveSet: { _, state, result in AccountOps.plannerEffectIsVisible(state, result) },
        // Vollständige Zielzeile einschließlich unveränderter unbekannter Felder des alten Records.
        AccountOps.measurementsSave: { args, state, _ in
            guard let target = AccountOps.measurementTarget(args) else { return false }
            return AccountOps.measurement(state, id: args["id"]?.stringValue) == target
        },
        AccountOps.measurementsDelete: { args, state, _ in
            guard let id = args["id"]?.stringValue else { return false }
            return AccountOps.measurement(state, id: id) == nil
        },
        AccountOps.soundSet: { args, state, _ in
            guard let enabled = args["enabled"]?.boolValue, let volume = args["volume"] else { return false }
            let current = AccountOps.sound(state)
            return current.enabled == enabled && current.volume.doubleValue != nil && current.volume.doubleValue == volume.doubleValue
        },
    ]

    /// `snapshot.device.scheme === result.scheme` und normalisierte Sprache === `result.language`.
    public static let accountSnapshotEffectChecks: [String: SnapshotEffectCheck] = [
        AccountOps.appearanceSet: { args, snapshot, result in
            guard let target = AccountCommands.appearanceTarget(args: args, result: result) else { return false }
            return snapshot.deviceScheme == target.scheme.rawValue && AccountOps.language(snapshot.state) == target.language
        },
    ]
}

// MARK: - Befehle

/// Befehle der nativen Kontooberfläche. `nil` = das Web würde `invalid` antworten (Grenzen aus §13.4 nativ geprüft).
public enum AccountCommands {
    /// Getrimmt 1–40 UTF-16-Einheiten wie Web; `expect` ergänzt der Store aus dem Spiegel.
    public static func name(_ name: String) -> Command? {
        let trimmed = JSString.trim(name)
        guard (1...40).contains(JSString.length(trimmed)) else { return nil }
        return Command(op: AccountOps.nameSet, args: ["name": .string(name)])
    }

    /// Eingangsbild als JPEG/PNG/WebP-Daten-URL (≤ 512 Ki Zeichen) oder `nil` zum Entfernen. Zuschnitt/JPEG im Web.
    public static func avatar(_ dataUrl: String?) -> Command? {
        if let dataUrl {
            guard AccountAvatar.isValidInput(dataUrl) else { return nil }
            return Command(op: AccountOps.avatarSet, args: ["dataUrl": .string(dataUrl)])
        }
        return Command(op: AccountOps.avatarSet, args: ["dataUrl": .null])
    }

    public static let profileKeys: Set<String> = ["age", "height", "target", "activity", "method", "rmr", "kcalMode", "baselineFactor"]
    public static let planKeys: Set<String> = ["mode", "direction", "pace", "macroMode", "protein", "fat", "adaptive", "learnTdee"]

    /// Nur geänderte Körperprofilfelder; **kein Gewicht** (Gewicht bleibt M2). `expect` = vollständiger Planner-Kontext.
    public static func profile(_ fields: [String: JSONValue], context: PlannerContext) -> Command? {
        guard !fields.isEmpty, Set(fields.keys).isSubset(of: profileKeys) else { return nil }
        let args: JSONValue = ["profile": .object(fields), "expect": context.raw]
        guard AccountOps.serializedLength(args) <= AccountOps.argsLimit else { return nil }
        return Command(op: AccountOps.profileSet, args: args)
    }

    /// `plan.set` (Delegation an M7 `goals.set`): Planfelder plus vier Makros; manuell 1–20 000 kcal, Makros 0–2000.
    public static func plan(_ plan: [String: JSONValue], goals: [String: Double], context: PlannerContext) -> Command? {
        guard Set(plan.keys).isSubset(of: planKeys), Set(goals.keys) == ["kcal", "p", "c", "f"],
              goals.allSatisfy({ entry in
                  entry.value.isFinite && entry.value >= (entry.key == "kcal" ? 1 : 0) && entry.value <= (entry.key == "kcal" ? 20_000 : 2000)
              }) else {
            return nil
        }
        for key in ["adaptive", "learnTdee"] where plan[key] != nil { guard plan[key]?.boolValue != nil else { return nil } }
        for key in ["protein", "fat"] where plan[key] != nil { guard plan[key]?.doubleValue != nil else { return nil } }
        let args: JSONValue = ["plan": .object(plan), "goals": .object(goals.mapValues { JSONValue.number($0) }), "expect": context.raw]
        guard AccountOps.serializedLength(args) <= AccountOps.argsLimit else { return nil }
        return Command(op: AccountOps.planSet, args: args)
    }

    /// Nur die zwei Automatik-Felder; Makros bleiben die beobachteten des Kontexts (Web).
    public static func adaptive(adaptive: Bool, learnTdee: Bool, context: PlannerContext) -> Command? {
        let args: JSONValue = ["adaptive": .bool(adaptive), "learnTdee": .bool(learnTdee), "expect": context.raw]
        guard AccountOps.serializedLength(args) <= AccountOps.argsLimit else { return nil }
        return Command(op: AccountOps.adaptiveSet, args: args)
    }

    /// Ausgefüllte Felder in den Tagesrecord mergen (leere/nicht genannte bleiben). Gibt es am Tag schon genau einen Record,
    /// werden dessen ID und vollständiger Rohinhalt als `expect` verwendet; sonst neue stabile ID und `expect:null`.
    /// Tag ≤ heute, mindestens ein Wert, jeder innerhalb der Web-Registry.
    public static func saveMeasurement(date: String, values: [String: Double], fields: [AccountMeasurementField],
                                       document: ProfileDocument, today: String, newID: String = AccountOps.makeID()) -> Command? {
        guard WeightDay.isValid(date), WeightDay.isValid(today), date <= today, !values.isEmpty else { return nil }
        for (key, value) in values {
            guard let field = fields.first(where: { $0.key == key }), field.accepts(value) else { return nil }
        }
        let rows = AccountOps.measurements(document.root, date: date)
        guard rows.count <= 1 else { return nil }
        let id: String
        let expect: JSONValue
        if let row = rows.first {
            guard let existing = row["id"]?.stringValue, ActivityIDs.isValid(existing) else { return nil }
            id = existing
            expect = row
        } else {
            guard ActivityIDs.isValid(newID), AccountOps.measurement(document.root, id: newID) == nil else { return nil }
            id = newID
            expect = .null
        }
        let args: JSONValue = [
            "id": .string(id), "date": .string(date), "values": .object(values.mapValues { JSONValue.number($0) }), "expect": expect,
        ]
        guard AccountOps.serializedLength(args) <= AccountOps.argsLimit else { return nil }
        return Command(op: AccountOps.measurementsSave, args: args)
    }

    /// Nativ bestätigtes Löschen mit vollständigem Rohrecord.
    public static func deleteMeasurement(id: String, document: ProfileDocument) -> Command? {
        guard let row = AccountOps.measurement(document.root, id: id) else { return nil }
        let args: JSONValue = ["id": .string(id), "expect": row]
        guard AccountOps.serializedLength(args) <= AccountOps.argsLimit else { return nil }
        return Command(op: AccountOps.measurementsDelete, args: args)
    }

    /// Mindestens ein Wunsch; `expect` = aktueller Gerätewunsch und normalisierte Sprache.
    public static func appearance(scheme: AccountScheme? = nil, language: String? = nil,
                                  expect: (scheme: AccountScheme, language: String)) -> Command? {
        guard scheme != nil || language != nil, ["de", "en"].contains(expect.language) else { return nil }
        if let language { guard ["de", "en"].contains(language) else { return nil } }
        var args: JSONValue = ["expect": ["scheme": .string(expect.scheme.rawValue), "language": .string(expect.language)]]
        if let scheme { args["scheme"] = .string(scheme.rawValue) }
        if let language { args["language"] = .string(language) }
        return Command(op: AccountOps.appearanceSet, args: args)
    }

    /// Zielstand `{...expect, scheme?, language?}`; das Ack-Result hat Vorrang.
    public static func appearanceTarget(args: JSONValue, result: JSONValue?) -> (scheme: AccountScheme, language: String)? {
        if let scheme = result?["scheme"]?.stringValue.flatMap(AccountScheme.init(rawValue:)),
           let language = result?["language"]?.stringValue, ["de", "en"].contains(language) {
            return (scheme, language)
        }
        guard let expect = args["expect"],
              let scheme = (args["scheme"] ?? expect["scheme"])?.stringValue.flatMap(AccountScheme.init(rawValue:)),
              let language = (args["language"] ?? expect["language"])?.stringValue, ["de", "en"].contains(language) else { return nil }
        return (scheme, language)
    }

    /// Lautstärke 0–70; `expect` ergänzt der Store aus dem Spiegel.
    public static func sound(enabled: Bool, volume: Double) -> Command? {
        guard volume.isFinite, volume >= 0, volume <= AccountOps.maxVolume else { return nil }
        return Command(op: AccountOps.soundSet, args: ["enabled": .bool(enabled), "volume": .number(volume)])
    }
}
