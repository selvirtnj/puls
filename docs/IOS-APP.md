# PULS als iOS-App (AltStore)

PULS gibt es zusätzlich als echte iOS-App für iPhone und iPad. Die App ist eine native Hülle (Swift, `WKWebView`) um die veröffentlichte Web-App `https://selvirtnj.github.io/puls/`. Dadurch kommen alle Web-Updates automatisch in der App an; eine neue `.ipa` ist nur nötig, wenn sich etwas in `ios/` ändert.

## Installieren

Voraussetzung: AltServer läuft auf dem Windows-PC, AltStore ist auf dem Gerät, beide im selben WLAN.

1. Auf dem iPad/iPhone in Safari öffnen: https://github.com/selvirtnj/puls/releases/latest/download/PULS.ipa — die Datei landet in „Dateien“ → Downloads.
2. AltStore öffnen → Tab **Meine Apps** → **+** oben links → `PULS.ipa` auswählen. Gegebenenfalls Apple-ID-Daten in AltStore selbst eingeben.
3. PULS öffnen und unter **Konto** mit dem PULS-Konto anmelden. Die App hat einen eigenen Speicher, getrennt von Safari/der Home-Bildschirm-Web-App; die Daten kommen über den Cloud-Sync.

Mit einer kostenlosen Apple-ID läuft die Signatur nach 7 Tagen ab. AltStore erneuert sie automatisch im Hintergrund, solange AltServer auf dem PC läuft und das Gerät im selben WLAN ist (oder manuell: AltStore → Meine Apps → **Refresh All**).

## Was die Hülle kann

- Lädt nur PULS selbst; fremde Links öffnen in Safari.
- App-Bound Domain `selvirtnj.github.io` schaltet den Service Worker frei → Offline-Betrieb wie in der Web-App.
- Kamera/Mikrofon für Barcode-Scan und Spracheingabe (iOS fragt einmal).
- Downloads (Sicherung, CSV) öffnen das Teilen-Menü → „In Dateien sichern“.
- `alert`/`confirm`/`prompt` als native Dialoge; iPad in allen Ausrichtungen und mit Split View.

## Bauen

`.github/workflows/ios-app.yml` baut bei jedem Push auf `main`, der `ios/`, `icons/purple.svg` oder den Workflow ändert, auf einem kostenlosen macOS-Runner (öffentliches Repo) und veröffentlicht ein GitHub-Release mit `PULS.ipa`. Manuell: GitHub → Actions → „iOS app“ → **Run workflow**.

Das Xcode-Projekt wird mit XcodeGen aus `ios/project.yml` erzeugt und nicht eingecheckt. Lokal bauen geht nur auf einem Mac (`brew install xcodegen && cd ios && xcodegen generate`).

## Grenzen

- Nicht im App Store, unsigniert; Signatur übernimmt AltStore mit Selvirs Apple-ID.
- Web-Speech-Spracheingabe hängt von der iOS-Version im WebView ab.
- Kein HealthKit, keine Widgets/Dynamic Island, keine Hintergrundalarme — das wären spätere native Erweiterungen.
- Das Build-Ergebnis ist ohne echtes Gerät nur kompiliert, nicht auf iPad/iPhone getestet.
