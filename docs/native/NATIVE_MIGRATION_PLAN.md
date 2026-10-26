# PULS — Plan der nativen iOS-Umstellung

Stand 26.10.2026. Grundlage: zwei unabhängige Analysen (Claude-Planagent, Codex), Ergebnisse stimmen im Kern überein.

## Ziel und Entscheidungen von Selvir

- Ziel: echte native SwiftUI-App statt WebView-Hülle, ohne Funktions- oder Datenverlust.
- **Web-App bleibt parallel live** (PC, Safari) und synchronisiert weiter über dasselbe Supabase-Profil.
- **Schrittweise:** Die bestehende App (gleiche Bundle-ID, gleicher WKWebView-Datenspeicher) bleibt; Bereich für Bereich wird nativ ersetzt, der Rest läuft vorerst in der WebView. Die App ist jederzeit voll nutzbar.
- Codex leistet einen großen Teil von Umsetzung, Tests und Review; Prüfung immer über Kreuz.

## Rahmen

- Kein Mac lokal. Build und Unit-Tests nur über GitHub Actions (`macos-15`, XcodeGen). UI, ActivityKit, GPS, Keychain nur auf Selvirs iPhone prüfbar.
- Arbeitsbranch `native-ios`. Branch-Builds liefern eine `.ipa` als Actions-Artifact; Release-IPA nur von `main`.
- iOS-Mindestversion **17.0** (`@Observable`). Swift 5-Modus vorerst.
- Keine Drittabhängigkeiten. Supabase später per `URLSession`.

## Phase A — Web besitzt die Daten (M1 bis mindestens M6)

- Quelle der Wahrheit: `localStorage['puls-v1']` in der WKWebView. `cloud.js` bleibt einziger Auth-/Sync-Client, unverändert.
- Native: Lese-Spiegel (Snapshot-Datei) plus persistente **Outbox idempotenter Entitätsbefehle** (`weight.upsert` usw.).
- Das Web führt Befehle mit derselben Logik wie die Web-Oberfläche aus, prüft mit `validData()`, speichert und **bestätigt die Persistenz selbst** (localStorage erneut lesen), bevor es `ack ok:true` sendet.
- Snapshots nach Laden, Speichern, Cloud-Übernahme, Import, Reset, Migration und Auto-Abschluss.
- Vertrag: [NATIVE-BRIDGE-PROTOCOL.md](NATIVE-BRIDGE-PROTOCOL.md).
- Formeln (Ziele, Trends, XP) werden in Phase A, wo nötig, aus dem Web-Zustand gelesen oder per gemeinsamer Fixtures nachgebaut — nie stillschweigend abweichend.

## Phase B — Native übernimmt die Datenhoheit (eigener Meilenstein, zuletzt)

- Voraussetzung: alle häufigen Bereiche nativ; Prüfregeln (`validData`-Kette) in prüfbarer Form (eigene `js/validate.js` per JavaScriptCore oder Swift-Port mit gemeinsamen Fixtures).
- Bedingung zum Umschalten: Web meldet `dirty:false`, kein Konflikt, keine Recovery.
- Ablauf: Schreiber/Uploads anhalten → vollständige Sicherung (Profil, Pending-/Konflikt-/Recovery-Kopien, Sync-Meta, Laufdaten) → Session einmalig in die Keychain → nativer Store + `ProfileSyncEngine` (gleiche CAS-Semantik wie `cloud.js`) übernehmen → Besitzer-Marker → Web in der App ohne eigenen Sync/Token-Refresh.
- Nie zwei Sync-Engines gleichzeitig. Kein Zurückdrehen außer per Notfall-Flag.

## Meilensteine

| | Inhalt | Abnahme |
|---|---|---|
| **M1 Fundament** (für Selvir unsichtbar) | `PULSCore` (JSONValue, ProfileDocument, Spiegel, Outbox, Store, Brücken-Nachrichten) + Unit-Tests; `js/native-state.js` mit `hello`/`snapshot`; Test-Target und CI (Tests auf Simulator, Branch-IPA-Artifact, Release nur `main`); `StateBridge.swift` empfängt und spiegelt. | CI grün mit ausgeführten Tests; Round-Trip des Fixture-Profils verlustfrei (unbekannte Felder); Outbox-Replay/Idempotenz getestet; `node scripts/check.cjs` grün; Browser und alte IPA unverändert; App auf iPhone unverändert inkl. Live-Aktivität und GPS. |
| **M2 Körper & Gewicht nativ** | Native Gewichtsliste, Eintragen-Sheet, Wischen-Löschen mit Rückgängig, Swift-Charts-Verlauf (Wochenmittel/Trend). Einstieg aus Konto über `openNative{screen:"body"}`. Ops `weight.upsert`/`weight.delete`. | Native Eingabe sofort in Web-Übersicht und nach ~2 s am PC; offline eintragen → später synchron; App direkt nach Speichern beenden → Eintrag vorhanden; 19/401 kg abgelehnt; Konflikt-Banner ohne Datenverlust; alte IPA + neues Web und umgekehrt zeigen Web-Bereich; Plan/XP identisch zu Web-Eintrag. |
| **M3 Übersicht + native TabBar** | Native Tab-Leiste ersetzt `#nav` (Web-Leiste ausgeblendet per Feature), eine geteilte WebView für nicht-native Tabs; native Übersicht (Tag, Kalorien/Makros, Essenvorschau, Training fortsetzen, Gewicht). | Identische Werte zu Web für Fixtures (klassisch/Baseline, manuelle Ziele, fehlende Mikros); Web- und Cloud-Änderungen sofort sichtbar; Deep Links in Web-Bereiche; Hell/Dunkel, DE/EN, VoiceOver, Dynamic Type, 390 pt Breite. |
| **M4 Routinen + Kraftsession** | Übungsauswahl, Routinen, laufendes Workout (Sätze, Reihenfolge, Supersets, Pause mit bestehendem `RestCoordinator`), Minimieren, Abschluss/Verwerfen. | IDs/Sätze erhalten; Vorbelegung nie erledigt; 5-h-Abschluss; Hintergrund/Prozessneustart; Live-Aktivität genau einmal beendet; keine doppelte Session; XP/Abschlussdaten identisch. |
| M5 Kalender/Fortschritt | Kalender, Rückblick, Rekorde, Charts | Fixture-Parität der Kennzahlen |
| M6 Aktivitäten | Start/Live/Abschluss mit `RunTracker`/`RunActivityCoordinator`, Karten (MapKit) | GPS-Parität per Fixtures, Gerätetests |
| M7 Ernährung | Tagebuch, Suche, Barcode (VisionKit), Nährwertfoto (Vision OCR), Rezepte, Wasser | Snapshot-Semantik, Einheiten, Offline |
| M8 Konto/Einstellungen | Profil/Plan/Adaptiv, Darstellung, Sicherung/Import/Export, Konto | Import/Recovery-Pfade |
| M9 Phase B | Datenhoheit, Auth/Sync nativ, Keychain | siehe Phase B |

Native Integrationen nur, wo sie echten Nutzen bringen (z. B. Haptik, Live-Aktivitäten vorhanden, App Intents/Kurzbefehle für „Gewicht eintragen“ nach M2, Share-Sheet für Export). Keine neuen Berechtigungen ohne Bedarf. Health/Widgets nicht beauftragt.

## Größte Risiken

1. Feldverlust durch Swift-Serialisierung → verlustfreies `JSONValue`, Round-Trip-Tests.
2. Zwei Schreiber/Sync-Engines → Phase A strikt, Phase B atomar.
3. Abweichende Prüfregeln/Formeln (~25 `validData`-Wrapper) → Web prüft in Phase A; gemeinsame Fixtures.
4. Versionsversatz Web ↔ IPA → `hello`/Feature-Flags Pflicht, Web bleibt abwärtskompatibel.
5. Aktive Sessions während Teilmigration (GPS-Cursor, Endmarker, Pausen).
6. Installationskontinuität: gleiche Bundle-ID und WK-Datenspeicher; lokale Daten ohne Cloud nicht verlieren.
7. Prüflücke ohne Mac: CI-Kompilation und Unit-Tests ersetzen keine Gerätetests — Einschränkungen immer offen nennen.
8. WebView-Drosselung, wenn sie aus der Hierarchie fällt.
9. Tokens in Phase A weiter im localStorage; sichere Keychain-Übergabe erst in Phase B.
