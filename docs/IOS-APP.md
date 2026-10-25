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
- **App-Icon** (ab App 1.2): Konto → Sprache & App-Icon wechselt das echte Home-Bildschirm-Symbol über `setAlternateIconName` (iOS zeigt dazu kurz eine Systemmeldung). Die Farbvarianten entstehen im Build aus `icons/<farbe>.svg`. Kein automatischer Abgleich beim Start, um wiederholte Systemmeldungen zu vermeiden: nach dem Update die gewünschte Farbe einmal antippen.
- **Dynamic Island / Sperrbildschirm** (ab App 1.2): Fortschrittsring links, Zeit mit fester Breite rechts (laufende Timer-Texte reservieren sonst Platz für „0:00:00“ und ziehen die Insel breit), aufgeklappt mit Übung, Satz und Balken.
- **Pausentimer außerhalb der App** (ab App 1.1 / Web 39): `native-bridge.js` meldet jede laufende Pause über `window.webkit.messageHandlers.pulsNative` (`restStart`/`restCancel`). Die App plant dann eine Mitteilung „Pause vorbei – Nächster Satz: …“ zum Pausenende und zeigt eine Live-Aktivität mit Countdown in Dynamic Island und Sperrbildschirm (Widget-Erweiterung `ios/PULSWidgets`). iOS zählt den Countdown selbst; nach Ablauf zeigt sie „Los!“ und wird beim nächsten Öffnen der App entfernt. Beim ersten Pausenstart fragt iOS einmal nach der Erlaubnis für Mitteilungen. In der offenen App bleibt es beim gewohnten Hinweis mit Ton.
- **GPS für Läufe** (ab App 1.5 / Web 62, auf Selvirs ausdrücklichen Wunsch): `ios/PULS/RunTracker.swift` zeichnet bei „Lauf mit GPS“ über `CLLocationManager` auf, auch bei gesperrtem iPhone (`UIBackgroundModes: location`, blaue Statusanzeige). Nachrichten von `js/running.js`: `runGpsStart{runKey,segment}`, `runGpsStop{clear}`, `runGpsSync{runKey,since}`; Antwort über `window.pulsRunGpsReceive`. Distanz und Strecke berechnet die Web-App. Punkte liegen bis zum Speichern/Verwerfen in `Application Support/run-track.json`. Kennzeichen `runGps` in `window.pulsNativeFeatures`; ältere Apps und der Browser nutzen `watchPosition` nur bei offener App. Rohpunkte gibt es nur auf dem Gerät, das den Lauf gestartet hat; beim Beenden holt die Web-App alle Punkte ab (`total`), beim Speichern/Verwerfen löscht `runGpsStop{clear:true}` die Datei.
- **Ab App 1.6:** GPS-Punkte mit Höhe (`[t,lat,lon,acc,seg,alt,altAcc]`, altAcc −1 = unbekannt) für Höhenmeter; `runLocate` liefert vor dem Start einmalig die Position für die Karte (eigener `CLLocationManager`, Antwort `pulsRunLocateReceive`, Kennzeichen `runLocate`). Die Live-Aktivität trägt den Namen der Aktivitätsart.
- **Lauf-Live-Aktivität und km-Mitteilungen** (ab App 1.5, Kennzeichen `runActivity`): `RunActivityCoordinator.swift` + `RunActivityWidget.swift`. Sperrbildschirm und Dynamic Island zeigen Zeit (iOS zählt selbst), Distanz, Ø Pace, letzten km und bei geplanter Route den Fortschritt; Zahlen rollen animiert (`numericText`), das Laufsymbol pulsiert ab iOS 17. Nach jedem vollen Kilometer eine Mitteilung „Kilometer N“ mit km-Zeit, Ø Pace und Gesamtzeit. Die Distanz rechnet `RunTracker` nativ nach denselben Filtern wie `running.js`, damit Insel und Mitteilungen auch gesperrt weiterlaufen. Nachricht `runActivity{active,runKey,startedAt,pausedSeconds,pausedAt,gps,distanceKm,title,routeKm}`; `active:false, finished:true` lässt den Endstand 4 Minuten stehen.

## Bauen

`.github/workflows/ios-app.yml` baut bei jedem Push auf `main`, der `ios/`, `icons/purple.svg` oder den Workflow ändert, auf einem kostenlosen macOS-Runner (öffentliches Repo) und veröffentlicht ein GitHub-Release mit `PULS.ipa`. Manuell: GitHub → Actions → „iOS app“ → **Run workflow**.

Das Xcode-Projekt wird mit XcodeGen aus `ios/project.yml` erzeugt und nicht eingecheckt. Lokal bauen geht nur auf einem Mac (`brew install xcodegen && cd ios && xcodegen generate`).

## Grenzen

- Nicht im App Store, unsigniert; Signatur übernimmt AltStore mit Selvirs Apple-ID.
- Web-Speech-Spracheingabe hängt von der iOS-Version im WebView ab.
- Kein HealthKit und keine Home-Bildschirm-Widgets. Dynamic Island gibt es nur auf iPhones ab 14 Pro; das iPad bekommt nur die Mitteilung.
- Die Live-Aktivität kann iOS nur beim Pausenstart in der offenen App anlegen. Verlängerungen und das Ende werden gemeldet, sobald die Web-App wieder läuft.
- Das Build-Ergebnis ist ohne echtes Gerät nur kompiliert, nicht auf iPad/iPhone getestet.
