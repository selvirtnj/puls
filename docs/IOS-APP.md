# PULS als iOS-App (AltStore)

PULS gibt es zusätzlich als echte iOS-App für iPhone und iPad. Die App ist eine native Hülle (Swift, `WKWebView`) um die veröffentlichte Web-App `https://selvirtnj.github.io/puls/`. Dadurch kommen alle Web-Updates automatisch in der App an; eine neue `.ipa` ist nur nötig, wenn sich etwas in `ios/` ändert.

**Entscheidung 08.11.2026:** Die SwiftUI-Umstellung ist gestoppt und unter Tag `native-swiftui-archiv` archiviert. Nicht löschen oder fortsetzen. Basis der aktiven Hülle ist wieder `main`/`ios-build-9`, die geladene Web-App steht derzeit bei v83. Neue native Funktionen werden in dieser Hülle ergänzt. Die folgenden Extras sind lokal vorbereitet, noch nicht kompiliert oder veröffentlicht.

## Neue Hüllen-Extras (lokal vorbereitet)

- **Barcode:** `BarcodeScanner.swift` nutzt VisionKit DataScanner, auf nicht unterstützten Geräten bzw. bei Startfehler AVFoundation. Nur EAN/UPC/GTIN, Prüfziffernprüfung vor Übernahme; Kamera bleibt lokal. `js/native-extras.js` umschließt die letzte Web-Scannerdefinition und übergibt an denselben `lookupBarcode`-Pfad (gespeicherte Produkte/Open Food Facts/Wertekontrolle). Alte Hüllen und Safari behalten ihren Scanner. Abbrechen, Timeout und Antworten aus alten Seitenleben werden abgefangen.
- **Health:** Konto → Darstellung → iPhone-Funktionen. Nur Gewicht und abgeschlossene Trainings/Aktivitäten schreiben; keine Schritte oder sonstigen Health-Daten lesen. Berechtigungsdialog erst beim Einschalten. Auch vorhandene Einträge werden exportiert, jedoch keine Trainings ohne belegte Start-/End-/Dauerwerte und keine alten Läufe ohne erfasste Pause. Gewichte haben Tagesauflösung und erscheinen am lokalen Tagesbeginn in Health; keine genaue Messuhrzeit wird behauptet. Kein Export von Kalorienschätzungen. Stabile, pro PULS-Owner getrennte Sync-Identifier und Sync-Versionen ersetzen bei Änderungen das eigene Health-Objekt; ein lokaler Hash-Merkzettel vermeidet unveränderte Wiederholungen. Gewicht nutzt den Tag als logische Identität, weil die Web-App bei einer Tageskorrektur eine neue Messungs-ID erzeugt. Web-IDs bleiben unverändert. In PULS gelöschte Einträge werden nicht aus Health entfernt. Erneutes Einschalten löscht keine Health-Daten. Bei tatsächlichem Konto-/Lokalwechsel ist erneut einzuschalten; Reload desselben Owners erhält die Gerätefreigabe. Revisionskonflikte, Recovery-Sperre und laufende Cloud-Arbeit sperren den Export.
- **Erinnerungen:** Trainings- und Wiege-Erinnerung mit lokaler Uhrzeit und Wochentagen. Systemberechtigung erst beim expliziten Aktivieren; Ausschalten funktioniert ohne neue Anfrage. Maximal 14 wiederkehrende Kalender-Mitteilungen mit eigenen IDs; `puls-rest`, km-Mitteilungen und Live-Aktivitäten bleiben getrennt. Pläne bleiben auf demselben Gerät über App-Neustarts bestehen. Bei Ownerwechsel werden ausschließlich diese Erinnerungen entfernt. Anzeige liest den tatsächlichen Geräteplan. Cloud-Sync/Import aktiviert keine Mitteilungen automatisch; auf einem anderen Gerät ausdrücklich speichern.
- **Profilverträglichkeit:** optionale `state.nativeExtras` mit `healthEnabled` und Erinnerungswünschen wird in `validData()` geprüft. Alte Sicherungen bleiben gültig. Die Profilwerte ersetzen keine Geräteberechtigung. Auth, Supabase, Revisions-/Konfliktverfahren, Workout-/Übungs-IDs und vorhandene Nährwert-Snapshots werden nicht geändert.
- **Feature-Grenzen:** nur `barcodeScanner`, `localReminders` und bei erfolgreicher Verfügbarkeitsprüfung `healthWrite`. Kein `pulsState`-Handler, `stateBridge`, `nativeWebPages`, `nativeTabs` oder SwiftUI-Fenster. Die Web-Erweiterungen aus v74–v83 bleiben deshalb inaktiv und erhalten.

### HealthKit, kostenloses Konto und AltStore

Die [aktuelle Apple-Capability-Tabelle](https://developer.apple.com/help/account/reference/supported-capabilities-ios/) führt HealthKit auch für kostenlose „Apple Developer“-Konten auf (HealthKit-Zeile: alle drei Spalten freigegeben, geprüft 08.11.2026). Ein bezahltes Konto ist damit keine pauschale Voraussetzung. Die konkrete AltStore-Signierung bleibt zu testen: [AltStore](https://github.com/altstoreio/AltStore/blob/develop/AltStore/Operations/FetchProvisioningProfilesOperation.swift) ermittelt Fähigkeiten aus den [Binär-Entitlements](https://github.com/rileytestut/AltSign/blob/master/AltSign/Model/ALTApplication.mm), nicht aus einer lose beigelegten `.entitlements`-Datei.

`project.yml` ergänzt HealthKit-Entitlement und die beiden Health-Zwecktexte. Der `postBuildScripts`-Schritt `ios/scripts/prepare-altstore.sh` signiert beim bestehenden zertifikatsfreien iPhone-CI-Build zunächst die eingebettete Erweiterung, dann die Haupt-App **ad hoc** mit dem HealthKit-Entitlement und prüft dessen Vorhandensein. Das ist keine Apple-Identität und kein gültiges Installationsprofil; AltStore ersetzt diese Signatur. Der Workflow muss dafür nicht geändert werden. Tatsächlicher macOS-Build und `codesign` sind noch offen.

Beim App-Start wird nur das HealthKit-Flag des eingebetteten Geräteprofils geprüft, anschließend ein HealthKit-API-Preflight ohne Berechtigungsdialog. Profilinhalte/Healthwerte werden nicht protokolliert. Fehlende oder entfernte Capability, fehlendes HealthKit oder Preflight-Fehler bedeuten: kein `healthWrite`, Hülle lädt weiter. Nach spätestens drei Sekunden lädt die Web-App auch ohne Antwort des Preflights. Geräteprobe mit der neu signierten IPA bleibt erforderlich; eine Quellprüfung beweist keine AltStore-Kompatibilität.

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
- **App-Icon (lokal vorbereitet):** festes dunkles Symbol aus `icons/dark.svg`. Die Web-Auswahl Hell/Dunkel ändert das native Symbol nicht. Frühere alternative Farb-Icons entfallen; eine neue IPA ist nötig.
- **Dynamic Island / Sperrbildschirm** (ab App 1.2): Fortschrittsring links, Zeit mit fester Breite rechts (laufende Timer-Texte reservieren sonst Platz für „0:00:00“ und ziehen die Insel breit), aufgeklappt mit Übung, Satz und Balken.
- **Pausentimer außerhalb der App** (ab App 1.1 / Web 39): `native-bridge.js` meldet jede laufende Pause über `window.webkit.messageHandlers.pulsNative` (`restStart`/`restCancel`). Die App plant dann eine Mitteilung „Pause vorbei – Nächster Satz: …“ zum Pausenende und zeigt eine Live-Aktivität mit Countdown in Dynamic Island und Sperrbildschirm (Widget-Erweiterung `ios/PULSWidgets`). iOS zählt den Countdown selbst; nach Ablauf zeigt sie „Los!“ und wird beim nächsten Öffnen der App entfernt. Beim ersten Pausenstart fragt iOS einmal nach der Erlaubnis für Mitteilungen. In der offenen App bleibt es beim gewohnten Hinweis mit Ton.
- **GPS für Läufe** (ab App 1.5 / Web 62, auf Selvirs ausdrücklichen Wunsch): `ios/PULS/RunTracker.swift` zeichnet bei „Lauf mit GPS“ über `CLLocationManager` auf, auch bei gesperrtem iPhone (`UIBackgroundModes: location`, blaue Statusanzeige). Nachrichten von `js/running.js`: `runGpsStart{runKey,segment}`, `runGpsStop{clear}`, `runGpsSync{runKey,since}`; Antwort über `window.pulsRunGpsReceive`. Distanz und Strecke berechnet die Web-App. Punkte liegen bis zum Speichern/Verwerfen in `Application Support/run-track.json`. Kennzeichen `runGps` in `window.pulsNativeFeatures`; ältere Apps und der Browser nutzen `watchPosition` nur bei offener App. Rohpunkte gibt es nur auf dem Gerät, das den Lauf gestartet hat; beim Beenden holt die Web-App alle Punkte ab (`total`), beim Speichern/Verwerfen löscht `runGpsStop{clear:true}` die Datei.
- **Ab App 1.6:** GPS-Punkte mit Höhe (`[t,lat,lon,acc,seg,alt,altAcc]`, altAcc −1 = unbekannt) für Höhenmeter; `runLocate` liefert vor dem Start einmalig die Position für die Karte (eigener `CLLocationManager`, Antwort `pulsRunLocateReceive`, Kennzeichen `runLocate`). Die Live-Aktivität trägt den Namen der Aktivitätsart.
- **Lauf-Live-Aktivität und km-Mitteilungen** (ab App 1.5, Kennzeichen `runActivity`): `RunActivityCoordinator.swift` + `RunActivityWidget.swift`. Sperrbildschirm und Dynamic Island zeigen Zeit (iOS zählt selbst), Distanz, Ø Pace, letzten km und bei geplanter Route den Fortschritt. Nach jedem vollen Kilometer eine Mitteilung „Kilometer N“ mit km-Zeit, Ø Pace und Gesamtzeit. Die Distanz rechnet `RunTracker` nativ nach denselben Filtern wie `running.js`, damit Insel und Mitteilungen auch gesperrt weiterlaufen. Nachricht `runActivity{active,runKey,startedAt,pausedSeconds,pausedAt,gps,distanceKm,title,routeKm}`.
- **App 1.7, lokal vorbereitet, noch nicht veröffentlicht:** ruhige Live-Aktivitäten in Systemschrift und Apple-Blau ohne Symbol-/Zahlenanimation. `active:false` beendet mit explizitem finalem Zustand und sofortiger Entfernung. Der Laufabschluss entfernt die Insel schon an der Zusammenfassung, bewahrt die ungespeicherte Strecke und erlaubt „Weiter“. `ActivityOperations.swift` ordnet Updates und Ende und schützt den Abschluss kurz vor dem Hintergrundwechsel. Beim Laden gleicht die Web-Brücke Workout und Lauf mit dem wiederhergestellten Zustand ab und entfernt verwaiste Aktivitäten. Optionales `ended` in den nativen ContentStates akzeptiert ältere Zustände ohne dieses Feld. Mitteilungen bleiben von iOS gestaltete Systemmitteilungen. Für diese Änderungen ist eine neue IPA nötig.

## Bauen

`.github/workflows/ios-app.yml` baut bei jedem Push auf `main`, der `ios/`, `icons/dark.svg` oder den Workflow ändert, auf einem kostenlosen macOS-Runner (öffentliches Repo) und veröffentlicht ein GitHub-Release mit `PULS.ipa`. Manuell: GitHub → Actions → „iOS app“ → **Run workflow**.

Das Xcode-Projekt wird mit XcodeGen aus `ios/project.yml` erzeugt und nicht eingecheckt. Lokal bauen geht nur auf einem Mac (`brew install xcodegen && cd ios && xcodegen generate`).

## Grenzen

- Nicht im App Store; der Build erhält nur eine Ad-hoc-Signatur als Capability-Metadatum. Die installierbare Signatur und das Profil übernimmt AltStore mit Selvirs Apple-ID.
- Web-Speech-Spracheingabe hängt von der iOS-Version im WebView ab.
- Health-Export ist optional und wird bei fehlender Geräte-/Signierunterstützung nicht angeboten. Keine neuen Home-Bildschirm-Widgets. Dynamic Island gibt es nur auf unterstützten iPhones; iPad-Verhalten auf echtem Gerät prüfen.
- Die Live-Aktivität kann iOS nur beim Pausenstart in der offenen App anlegen. Verlängerungen und das Ende werden gemeldet, sobald die Web-App wieder läuft.
- Das Build-Ergebnis ist ohne echtes Gerät nur kompiliert, nicht auf iPad/iPhone getestet.
