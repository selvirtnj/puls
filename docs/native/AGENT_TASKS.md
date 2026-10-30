# PULS — Agentenaufgaben native Umstellung

Regeln: Branch `native-ios`. Exklusiver Dateibesitz pro Paket; fremde Dateien nur lesen. Kein Commit/Push durch Agenten — nur der Koordinator. Vertrag: [NATIVE-BRIDGE-PROTOCOL.md](NATIVE-BRIDGE-PROTOCOL.md), Fixtures `tests/fixtures/native-bridge/` (nur Koordinator ändert sie; Änderungsbedarf unter `RÜCKFRAGEN:` melden). Review immer über Kreuz.

## M1 — Fundament

### Paket B — Web-Seite (Codex, `backend`, medium)

Dateien: `js/native-state.js` (neu), `tests/check-native-state.cjs` (neu), Eintrag in `scripts/check.cjs`, `index.html` (Einbindung direkt nach `native-bridge.js`), `sw.js` (Asset). Gemeinsame Versions-/Cache-Erhöhung anschließend durch den Koordinator per `node scripts/bump-version.cjs`.

- Ohne Handler `pulsState` oder ohne `stateBridge` in `pulsNativeFeatures`: keinerlei Wirkung.
- `hello` nach vollständigem Laden; `snapshot` mit `seq` (persistiert in `puls-native-seq`), `userId`, `cloud`, `flags`, `reason`; Debounce 300 ms, Flush bei `pagehide`/`visibilitychange`.
- Auslöser: Laden, `save()`, Cloud-Übernahme, Import, Reset, Migration, Auto-Abschluss. Vorher die **zuletzt wirksame** Definition/Wrapper-Kette der jeweiligen Funktionen prüfen.
- `window.pulsNativeApply` mit Prüfung, Idempotenz (`puls-native-applied`, 200 IDs), Persistenzbestätigung durch erneutes Lesen von `puls-v1`, `ack`. Bereits in M1: `weight.upsert`/`weight.delete` gemäß Vertrag v1, einschließlich Web-Regel „ein Gewicht pro Tag“, aktueller Planneuberechnung und Rücknahme bei fehlgeschlagener Persistenz. `hello.ops` meldet beide Ops, `hello.screens` meldet `body`; die native Oberfläche und Weiterleitung folgen in M2.
- Tests in `tests/check-native-state.cjs` (VM, Mock-Handler) gegen die Fixtures: kein Effekt ohne Handler/Feature; hello/snapshot-Form; seq monoton; Gewichts-Ops samt Tagesersetzung und Idempotenz; Fehler-Fixtures; `persist_failed`; readonly in Vorschau/Recovery/Upload-Sperre. `profile-full.json` muss die vollständige wirksame `validData()`-Kette bestehen und unbekannte Zusatzfelder behalten.
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

- Paket F (Codex): Die seit M1 vorhandenen Ops `weight.upsert`/`weight.delete` mit der nativen Körperoberfläche integrieren. Native meldet `stateBridge` + **`nativeBody`**. Die letzte wirksame `openAccountSection('body')` sendet nur nach gesendetem `hello`, ohne `ownerPending`/`activating`, `openNative {screen:'body'}` anstelle der Web-Unterseite. Vorschau/Recovery/Upload-Sperre erlauben die Weiterleitung in den lesbaren nativen Bereich. Sonst unveränderter Web-Ablauf.
  - Rückweg: `window.pulsNativeNavigate({page:'account',section:'body',web:true})` nutzt die aktuellen `go`/`openAccountSection` und umgeht die Weiterleitung nur für diese Öffnung. Maße/Körperfett bleiben in M2 Web. Unbekannte Seiten/Abschnitte ignorieren. `hello.screens:['body']` und beide Gewichts-Ops bleiben erhalten.
  - Dateibesitz: `js/native-state.js`, `tests/check-native-state.cjs`, dieser M2-Abschnitt und `NATIVE-BRIDGE-PROTOCOL.md`; neue Fixtures nur bei Bedarf. Kein `ios/`, keine Versionserhöhung, kein Commit/Push. Kontomenü ist der einzige Einstieg in die Körper-Unterseite; direkte Web-Gewichtsformulare bleiben unverändert.
  - Lokal umgesetzt: VM-Tests für Feature/Handler/Bereitschaft, Anmeldung/ungeklärte Zuordnung, lesbare Zustände, aktuellen Navigationsaufruf und auf eine Öffnung begrenzte Web-Ausnahme. `node scripts/check.cjs` vollständig grün. Browserprüfung bei 390 × 844 offen: Browser-Host in der Codex-Umgebung nicht verfügbar. Unabhängiges Review und Browser-/Geräteprüfung durch Koordinator veranlassen.
- Paket E+G (Claude `puls-frontend`): `ios/PULS/Features/Body/*`, `PULSCore/Model/WeightEntry.swift` + Tests, `ios/PULS/Shell/NativeRouter.swift`.
