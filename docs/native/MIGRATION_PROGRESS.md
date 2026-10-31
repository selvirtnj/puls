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

## Nächste Schritte

1. M2 Körper & Gewicht: native Liste, Sheet, Swift-Charts-Verlauf, Reducer für `weight.upsert`/`weight.delete`, `openNative{screen:'body'}`, Store nach `AppDelegate`/`AppEnvironment`.
2. Branch-IPA auf Selvirs iPhone: App unverändert, Spiegel wird geschrieben.

## Nicht verifiziert / offen

- Kein Test auf Gerät bisher; Live-Aktivität/GPS nach iOS-17-Anhebung ungeprüft.
- Selvirs iPhone-iOS-Version (Mindestziel 17.0) noch zu bestätigen.
- `native-state.js` ist nur auf `native-ios`, nicht live; Asset-Version noch 73 (Versionserhöhung beim Merge nach `main`).
- `actions/upload-artifact@v4` läuft auf Node 20 (Deprecation-Warnung) — bei Gelegenheit auf neuere Hauptversion heben.
