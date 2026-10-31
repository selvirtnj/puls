# PULS — Fortschritt der nativen Umstellung

## 26.10.2026

- Auftrag von Selvir: native SwiftUI-App; Web-App parallel live; schrittweise Umstellung.
- Zwei unabhängige Analysen (Claude-Planagent, Codex) abgeschlossen und zusammengeführt: [NATIVE_MIGRATION_PLAN.md](NATIVE_MIGRATION_PLAN.md), [IOS_ARCHITECTURE.md](IOS_ARCHITECTURE.md), [NATIVE-BRIDGE-PROTOCOL.md](NATIVE-BRIDGE-PROTOCOL.md), [FEATURE_PARITY_CHECKLIST.md](FEATURE_PARITY_CHECKLIST.md).
- Codex-Brücke (`scripts/codex-bridge.ps1`) repariert: stderr-Warnungen brechen nicht mehr ab (Commit `5dc74cd` auf `main`, lokal).
- Arbeitsbranch `native-ios` angelegt (Basis `5dc74cd`, Web-Version 73, iOS-Projektversion 1.7).
- Gemeinsame Fixtures: `tests/fixtures/native-bridge/`.

## M1 Fundament — fertig (Commit `0a1eb18` auf `native-ios`)

- Paket B (Codex): `js/native-state.js` + `tests/check-native-state.cjs`. Zwei Review-Runden durch Claude `puls-reviewer`, alle Befunde behoben (Anmeldefenster, `expect`/`conflict`, Rollback, Owner-Sperre, Migrate-Snapshots).
- Paket A+D (Claude `puls-backend`): `ios/PULSCore` (JSONValue, Spiegel, Outbox, ProfileStore, BridgeOps), `ios/PULSCoreTests`, `StateBridge.swift`, iOS 17, CI für alle Branches, Release nur auf `main` (eigener Job). Codex-Review: 5 Befunde behoben; Unicode-Schlüsselgleichheit als bekannte Grenze dokumentiert.
- §7-Entscheidung des Koordinators: `lastSeenEffect` unterscheidet Speicherverlust (Replay) von bewusstem Löschen (kein Replay).
- Web-Regel „ein Gewicht pro Tag“ im Code bestätigt (`addWeight`).
- CI-Lauf #10 (https://github.com/selvirtnj/puls/actions/runs/40371349741): grün — XcodeGen, `xcodebuild test` PULSCore, Release-Build, IPA-Artifact `PULS-ipa-10`. Anzahl ausgeführter Tests im Log nicht eingesehen (Log nur angemeldet sichtbar).

## M2 Körper & Gewicht — gebaut, Gerätetest offen (31.10.2026)

- Paket F (Codex): Weiterleitung Konto → „Körper & Entwicklung“ per `openNative{screen:'body'}` (nur mit `nativeBody`), `window.pulsNativeNavigate({page,section,web:true})`. Claude-Review: kein Fehler; Pflicht „Native zeigt auf openNative immer etwas“ in den Vertrag aufgenommen.
- Paket E+G (Claude `puls-frontend`): `ios/PULS/Features/Body/*` (Übersicht, Swift-Charts-Verlauf 30T/90T/1J/Alle, Liste, Editor-Sheet, Wischen + Rückgängig, Konfliktdialog, Nur-lesen, Lade-/Leerzustand, DE/EN), `PULSCore/Model/WeightEntry.swift`, `Bridge/WeightOps.swift`, `Store/ProfileStore+Weight.swift`, `Shell/AppEnvironment.swift`, `Shell/NativeRouter.swift`. Codex-Review: 1×P1 (Konflikt im falschen Konto), 3×P2 (ID beim Bearbeiten, Rückgängig, Gerätekalender) — behoben und von Codex nachgeprüft.
- CI: #11 (`192beed`) grün; #12 (`40ecd9e`, Korrekturen) siehe Actions.
- Web-Seite als **Version 74 auf `main` veröffentlicht** (`1b9a208`), nur Web-Dateien, ohne `ios/`; live geprüft: lädt, wirkungslos im Browser, keine Konsolenfehler. `native-ios` per Merge auf v74 (`dc709f4`).

## M3 Übersicht + Tab-Leiste — gebaut (31.10.2026)

- Web (Codex, Paket H): Projektion `overview`, `chrome`-Meldungen, `pulsNativeSetChrome`/`SetDate`/erweitertes `Navigate`, `css/native-shell.css`; Claude-Review (4× mittel) behoben. Live als **v75**.
- Native (Claude, Paket I): `Shell/RootTabView.swift` (eine WebView, nie umgehängt; native Leiste + Kopf), `Features/Overview/*`. Codex-Review: 1× P2 behoben. CI #13/#14 grün.

## M4 Routinen + Kraftsession — gebaut (31.10.2026)

- Web (Paket J, Claude `puls-backend` als Codex-Ersatz während Codex-Limit): `js/native-training.js`, 15 Ops, gepufferte Native-Nebenwirkungen. Codex-Review: 2× P2, 1× P3 + 1× P3 Nachprüfung — behoben. `exercise.create {catalogKey}`, übersetzte Muskel-Labels. Live als **v76**.
- Native (Paket K, Claude): `Features/Training/*` (Tab, Routinen-Editor, Übungswahl, Vollbild-Session, Abschluss-Sheet), `TrainingOps/TrainingMessages/TrainingSession`. Codex-Review: 2× P2, 1× P3 behoben und nachgeprüft. CI #17 grün; Lauf für `a2283e8` siehe Actions.
- Offen nur auf dem Gerät prüfbar: ob sich `postMessage` am WKWebView-Handler umhüllen lässt (sonst ungepuffertes Altverhalten).

## Nächste Schritte

0. M5 Kalender + Fortschritt, dann M6 Aktivitäten, M7 Ernährung, M8 Konto/Profil + Phase B.
1. Selvir testet die Branch-IPA (Actions-Artifact `PULS-ipa-<Lauf>`) auf dem iPhone: Konto → „Körper & Entwicklung“ öffnet den nativen Bildschirm; Gewicht eintragen/bearbeiten/löschen erscheint im Web und auf dem PC; Live-Aktivität und GPS unverändert.
2. Nach erfolgreichem Gerätetest `native-ios` nach `main` (erzeugt Release-IPA).
3. M3: native Übersicht + native Tab-Leiste.

## Nicht verifiziert / offen

- Kein Test auf Gerät bisher; Live-Aktivität/GPS nach iOS-17-Anhebung ungeprüft.
- Selvirs iPhone-iOS-Version (Mindestziel 17.0) noch zu bestätigen.
- `native-state.js` ist nur auf `native-ios`, nicht live; Asset-Version noch 73 (Versionserhöhung beim Merge nach `main`).
- `actions/upload-artifact@v4` läuft auf Node 20 (Deprecation-Warnung) — bei Gelegenheit auf neuere Hauptversion heben.
