# PULS — Agentenaufgaben native Umstellung

Regeln: Branch `native-ios`. Exklusiver Dateibesitz pro Paket; fremde Dateien nur lesen. Kein Commit/Push durch Agenten — nur der Koordinator. Vertrag: [NATIVE-BRIDGE-PROTOCOL.md](NATIVE-BRIDGE-PROTOCOL.md), Fixtures `tests/fixtures/native-bridge/` (nur Koordinator ändert sie; Änderungsbedarf unter `RÜCKFRAGEN:` melden). Review immer über Kreuz.

## M1 — Fundament

### Paket B — Web-Seite (Codex, `backend`, medium)

Dateien: `js/native-state.js` (neu), `tests/check-native-state.cjs` (neu), Eintrag in `scripts/check.cjs`, `index.html` (Einbindung direkt nach `native-bridge.js`), `sw.js` (Asset + Cache-Version), Versionsstellen per `node scripts/bump-version.cjs`.

- Ohne Handler `pulsState` oder ohne `stateBridge` in `pulsNativeFeatures`: keinerlei Wirkung.
- `hello` nach vollständigem Laden; `snapshot` mit `seq` (persistiert in `puls-native-seq`), `userId`, `cloud`, `flags`, `reason`; Debounce 300 ms, Flush bei `pagehide`/`visibilitychange`.
- Auslöser: Laden, `save()`, Cloud-Übernahme, Import, Reset, Migration, Auto-Abschluss. Vorher die **zuletzt wirksame** Definition/Wrapper-Kette der jeweiligen Funktionen prüfen.
- `window.pulsNativeApply` mit Prüfung, Idempotenz (`puls-native-applied`, 200 IDs), Persistenzbestätigung durch erneutes Lesen von `puls-v1`, `ack`. In M1 noch ohne Ops (`hello.ops: []`), Antwort `unknown_op`; Ops kommen in M2.
- Tests in `tests/check-native-state.cjs` (VM, Mock-Handler) gegen die Fixtures: kein Effekt ohne Handler; hello/snapshot-Form; seq monoton; unknown_op; Idempotenz; readonly in Vorschau.
- Abnahme: `node scripts/check.cjs` grün.

### Paket A+D — Native Kern, Projekt, CI (Claude `puls-backend`, medium)

Dateien: `ios/PULSCore/**`, `ios/PULSCoreTests/**`, `ios/project.yml`, `.github/workflows/ios-app.yml`, `ios/PULS/Web/StateBridge.swift`; in `ios/PULS/WebViewController.swift` nur: Handler `pulsState` registrieren/entfernen, Feature `stateBridge` ergänzen, `StateBridge` halten.

- `JSONValue` (verlustfrei), `ProfileDocument`, `MirrorFile` (atomar, Dateischutz), `Outbox` (persistent, idempotent), `ProfileStore` (`@Observable @MainActor`), `BridgeMessages` (Codable nach Protokoll v1).
- Deployment Target 17.0; Targets `PULSCore` (framework.static), `PULSCoreTests` (Fixtures als Ressourcen); Scheme mit Testaktion.
- CI nach `IOS_ARCHITECTURE.md`: Tests auf Simulator, IPA-Artifact für alle Branches, Release nur `main`.
- Tests: Round-Trip `profile-full.json` (semantisch gleich, unbekannte Felder erhalten, Ganzzahlen ohne `.0`); Dekodieren aller Fixtures; ungültige Nachrichten abgelehnt; Outbox überlebt Neuladen, Replay idempotent; Spiegel atomar.
- Abnahme: CI auf `native-ios` grün mit ausgeführten Tests. App-Verhalten unverändert.

### Paket C — Cloud-Client: **erst vor Phase B**, nicht in M1.

### Reviews M1

- Paket B → Claude `puls-reviewer` (high): Wirkungslosigkeit ohne Handler, Wrapper-Kette, Persistenzbestätigung, Datenintegrität.
- Paket A+D → Codex `reviewer` (medium): JSON-Verlustfreiheit, Concurrency, Dateischutz, CI-Logik (Release nur `main`).

## M2 — Körper & Gewicht (nach M1)

- Paket F (Codex): Ops `weight.upsert`/`weight.delete` in `native-state.js` über die zuletzt wirksame Web-Gewichtslogik; Feature `native:body` → `openAccountSection('body')` sendet `openNative`. Tests.
- Paket E+G (Claude `puls-frontend`): `ios/PULS/Features/Body/*`, `PULSCore/Model/WeightEntry.swift` + Tests, `ios/PULS/Shell/NativeRouter.swift`.
