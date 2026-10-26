# PULS — native iOS-Architektur

## Ordner

```
ios/
  project.yml                  XcodeGen; Targets PULS, PULSWidgets, PULSCore, PULSCoreTests
  Shared/                      ActivityKit-Attribute (unverändert)
  PULSCore/                    framework.static, nur Foundation → hostlos testbar
    Model/    JSONValue.swift, ProfileDocument.swift, WeightEntry.swift (ab M2)
    Store/    ProfileStore.swift, MirrorFile.swift, Outbox.swift
    Bridge/   BridgeMessages.swift (Codable-Typen zu NATIVE-BRIDGE-PROTOCOL.md)
    Cloud/    (erst Phase B) SupabaseConfig, SupabaseClient, AuthSession, TokenStore, ProfileSyncEngine
  PULSCoreTests/               XCTest; Fixtures aus tests/fixtures/native-bridge als Ressourcen
  PULS/
    AppDelegate.swift          bleibt UIKit-Einstieg; hostet später SwiftUI-Shell
    WebViewController.swift    Legacy-Container (bleibt, nur minimale Erweiterungen)
    Web/StateBridge.swift      Handler pulsState, apply/hello/snapshot
    Shell/                     NativeRouter.swift (M2), RootTabView.swift (M3)
    Features/<Bereich>/        SwiftUI-Views je Bereich (Body, Home, Training, …)
    RestCoordinator.swift, RunTracker.swift, RunActivityCoordinator.swift, ActivityOperations.swift  (unverändert wiederverwendet)
  PULSWidgets/                 Live-Aktivitäten (unverändert)
```

Bestehende Dateien werden erst verschoben, wenn kein paralleler Bearbeiter sie braucht.

## Zustand

- Genau ein `ProfileStore` (`@Observable`, `@MainActor`), einmal in `AppDelegate`/`AppEnvironment` erzeugt, per `.environment` an Views.
- Hält `document: ProfileDocument`, `seq`, `userId`, `cloud`-Status, `flags`, `pending` (Outbox), `authority: .web | .native` (Phase A immer `.web`).
- Views lesen abgeleitete, typisierte Werte (`store.weights`), schreiben nur über `store.perform(Command)`.
- `perform` wendet die Änderung optimistisch auf eine Overlay-Ansicht an, legt den Befehl in die Outbox und übergibt ihn an die Brücke. Ack `ok` → aus Outbox; `invalid` → zurückrollen; sonst halten.
- Die Schreib-API bleibt beim Wechsel zu Phase B gleich.

## Persistenz

- **Datei-JSON statt SwiftData.** Gründe: Sync/Backup arbeiten mit einem ganzen JSON-Dokument per Compare-and-swap; das Web ergänzt laufend Felder, die verlustfrei erhalten bleiben müssen; Import/Export bleibt dasselbe Format; Logik ist gegen dieselben Fixtures testbar.
- `JSONValue`: verlustfreier Enum-Baum (`null, bool, number(Double), string, array, object`), Objekt-Schlüsselreihenfolge muss nicht erhalten werden, Inhalt schon. Typisierte Sichten (z. B. `WeightEntry`) lesen aus `JSONValue` und schreiben nur ihre eigenen Felder zurück; alle anderen Schlüssel bleiben unangetastet.
- Zahlen: Millisekunden-Zeitstempel < 2^53 sind als Double exakt; Ganzzahlen werden ohne `.0` ausgegeben. Round-Trip-Test sichert das.
- Dateien in `Application Support`, `.atomic`, `FileProtectionType.completeUntilFirstUserAuthentication`: `mirror-<userId|local>.json` (+ eine Vorgängerkopie), `outbox.json`.
- Kein Schreiben auf dem Main-Thread für große Dateien (`Task.detached`/eigener `actor`).

## Brücke

- `StateBridge` (`WKScriptMessageHandler`, Name `pulsState`) dekodiert Nachrichten zu `BridgeMessages`, prüft Herkunft wie `pulsNative` (Hauptframe, Host), aktualisiert den Store, ruft `pulsNativeApply` per `evaluateJavaScript` auf.
- Die WebView bleibt immer in der View-Hierarchie.

## Cloud (Phase B, noch nicht verdrahtet)

- `URLSession` (ephemeral, 15 s Timeout), Header `apikey` + `Authorization: Bearer`.
- Endpunkte identisch zu `js/cloud.js`: `/auth/v1/token?grant_type=password|refresh_token`, `/auth/v1/signup`, `/auth/v1/logout`, `GET /rest/v1/puls_profiles?select=payload,revision,updated_at&limit=1` bzw. `select=revision`, `POST /rest/v1/rpc/puls_save_profile`, `POST /rest/v1/rpc/puls_delete_own_account`.
- Refresh 60 s vor Ablauf, Single-Flight per `actor`. Tokens per `TokenStore`-Protokoll (Keychain `AfterFirstUnlockThisDeviceOnly`; In-Memory für Tests).
- `ProfileSyncEngine`: Debounce 1 s, Revision 0 legt an, `null` = Konflikt → Uploads stoppen, Nutzer wählt ganzen Stand, beide vorher sichern; Poll 30 s + Vordergrund + `NWPathMonitor`; Grenze 4 MB; ungültige Cloud-Revision merken. Nur RPC, nie direkte Tabellen-Writes.

## CI (`.github/workflows/ios-app.yml`)

- Trigger: Push auf alle Branches (Pfade `ios/**`, `icons/*.svg`, `tests/fixtures/native-bridge/**`, Workflow), `pull_request`, `workflow_dispatch`. `concurrency` pro `ref`.
- Xcode fest per `xcode-select`; Simulator per `xcrun simctl list` ermitteln.
- Schritte: XcodeGen → `xcodebuild test -scheme PULSCore` (Simulator, ohne Signatur, Result-Bundle als Artifact bei Fehler) → Release-Build → IPA → `upload-artifact` → GitHub-Release **nur** bei `refs/heads/main` und kein PR.

## Qualität

- Swift Concurrency: UI-Zustand `@MainActor`, Dateien/Netz außerhalb. Keine erzwungenen Unwraps auf Eingabedaten.
- Barrierefreiheit: Dynamic Type, VoiceOver-Labels, Kontraste nach `docs/DESIGN-SYSTEM.md`, Hell/Dunkel.
- Keine Secrets im Code außer dem öffentlichen Publishable Key (gleich `js/cloud-config.js`). Keine Tokens in Logs.
