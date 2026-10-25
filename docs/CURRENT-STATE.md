# PULS — aktueller Stand und Übergabe

Aktualisiert: 24.10.2026. Maßgeblicher Code: dieses Repository. Git-Historie und aktuelle CI zusätzlich prüfen.

## Stand bei Einrichtung der Zusammenarbeit

- Veröffentlichte App-Version: **56** (25.10.2026: „Tag als vollständig markieren“ als Knopf in voller Breite mit fester Höhe, springt nicht mehr; Makro-Boxen auf der Essen-Seite gleich hoch; kein Kasten um das Fenster-X; Training: Tabs näher an der oberen Leiste, Standardpause mit 14 px oben/unten). Davor 55 (25.10.2026: Barcode-Scanner mit Blitz-Knopf in `js/food-flow.js`, nur wenn die Kamera `torch` meldet, Umschalten per `applyConstraints`; Review Codex: 1 Befund behoben). Davor 54 (25.10.2026: „Heute gegessen“ ohne Innen-Scroll, übrige kcal nur als Zahl — Essen rechts in der kcal-Zeile, Übersicht unter dem Ring, über dem Ziel „+X kcal“ in Warnfarbe; `js/app-polish.js`/`css/app-polish.css`). Davor 53 (25.10.2026: nur noch Original-Design — `state.appDesign` wird bei jedem Render auf `classic` gesetzt, Designauswahl ausgeblendet; Konto: „Konto verwalten“ bündelt Anmeldung/Sync, Sicherung und Löschen, kein „Dein Bereich“; Essen-Abläufe neu in `js/food-flow.js`/`css/food-flow.css` (Suche mit automatischer Open-Food-Facts-Suche ab 3 Zeichen, Portion, Barcode, Rezepte, eigene Werte, Foto; Claude-Frontend-Agent); Muskelgruppen eigener Übungen werden in `js/exercise-muscles.js` aus dem Namen abgeleitet, nicht gespeichert (Codex), „Diese Woche · Sätze pro Muskelgruppe“; `js/training-polish.js`: eigene Übung direkt in der Übungssuche, Kalender öffnet Auswertung, grünes „Läuft“, Standardpause als Pille; `js/app-polish.js`: Plus-Menü-Animation, X schließt animiert, Essen-Seite mit eigener Makro-Optik, Wasser von ml-Getränken ohne Wasserwert geschätzt (nur Anzeige), Scroll bleibt bei „Tag vollständig“, ohne 01/02-Nummerierung außer Konto, ohne Seitenleisten-Fuß, ohne „Nährstoffwerte & Ziele im Detail“; Suche bestraft Gerichte auch als Wortteil; auf Selvirs Auftrag iOS-App 1.4 mit echter Haptik (`haptic`-Nachricht, Feature `haptics`); Reviews: Claude-Prüfer 3+1 Befunde (Muskelgruppen), Codex 3 Befunde, alle behoben und nachgeprüft. Bekannt: Open-Food-Facts-Suche `cgi/search.pl` antwortet zeitweise mit 503 ohne CORS). Davor 52 (25.10.2026: Essenssuche mit Relevanz statt Startswith-Bonus — gleiche Regel in `js/catalog-worker.js` und `js/food-upgrade.js` (foodRelevance), nur am deutschen Namen, Grundzutaten/roh vor Gerichten, Gebäck und Innereien, neue Aliase z. B. Geschnetzeltes → Brustfilet, ODER-Ersatzsuche; Sicherung im Profil-Fenster kompakt; `js/haptics.js` Vibration bei Satz, Speichern, Start/Ende, Pause und Auswahl — native iOS-Haptik vorbereitet über `pulsNativeFeatures` 'haptics', `ios/` dafür nicht geändert; Review Codex: 3 Befunde behoben). Davor 51 (25.10.2026: Barcode auch senkrecht — eigener Zusatz-Scan des um 90° gedrehten Videobilds in `js/products.js`, da ZXings TRY_HARDER-Drehung in 0.2.1 fehlerhaft ist; auf Selvirs ausdrücklichen Auftrag iOS-App 1.3: Live-Aktivität/Dynamic Island zeigt ohne Pause die Workout-Zeit, nach Pausenende automatisch per staleDate, `native-bridge.js` sendet `workoutActive` nur bei `window.pulsNativeFeatures` mit `workoutTimer`, ältere App bleibt beim alten Verhalten; Review Codex: 1 Befund behoben und nachgeprüft). Davor 50 (25.10.2026: Konto — „Dein Design“ enthält Sprache und App-Icon direkt, Design-Kacheln schmal in drei Spalten, „Konto & Synchronisierung“ steckt in „Deine Daten“, `js/account-refresh.js`/`css/account-refresh.css`; Tab-Wechsel unten mit Wisch-Animation links/rechts, `js/page-slide.js`/`css/page-slide.css`; Review Codex: 1 Befund Fokus behoben und nachgeprüft). Davor 49 (25.10.2026: `js/workout-controls.js`/`css/workout-controls.css` — Linien-Symbole statt Textzeichen ⌄ ⌃ × ✕ ‹ ›, knapperes Abschluss-Fenster mit Verwerfen-Warnung, −30 s und „Pausenzeit“ im laufenden Workout, Scroll-Rad für die Standardpause, zentriertes Datumsfeld; Review Claude-Prüfer: 4 Befunde behoben). Davor 48 (25.10.2026: Pop-up „Pause vorbei“ mit OK und Animation, `js/rest-popup.js`/`css/rest-popup.css`, eigener `<dialog>` über offenen Fenstern, Vormerken bei Pausenende im Hintergrund bis 10 min; Review Claude-Prüfer: 5 Befunde behoben und nachgeprüft). Davor 47 (25.10.2026, auf Selvirs ausdrücklichen iOS-Auftrag: iOS-App 1.2 mit echtem App-Icon-Wechsel und neu gestalteter Dynamic Island/Live-Aktivität; `js/native-bridge.js` sendet `setAppIcon`; Review Claude-Prüfer, da Codex und Gemini im Limit). Davor 46 (25.10.2026: Repository aufgeräumt — Skripte in `js/`, Styles in `css/`, alte Doku in `docs/archive/`, `archive/` entfernt, neue README; `sw.js` aktiviert neue Versionen sofort per `skipWaiting()` nach vollständigem Precache; Review Codex: Offline-Lücke beim Update behoben). Davor 45 (25.10.2026: Training — Workout-Tab als Startseite mit kompakten Routinenzeilen, „Heute erledigt“ abgesetzt, Routinen-Tab bleibt Verwaltung, Kalender ohne doppelte Linie; `training-tabs.js`/`.css`, alle Designs, Review Codex: EN-Befund behoben). Davor 44 (Profil-Schalter Richtung/Tempo untereinander), 43 (Profil & Ziele überarbeitet, Logikfehler behoben), 42 (Abstand zwischen den Wischseiten), 41 (Essen im neuen Originaldesign), 40 (optionaler Erststart, Tutorial entfernt, klebender Pausentimer, ruhigere Satzzeilen), 39 (`native-bridge.js` für Pausen-Mitteilung und Dynamic Island; von Selvir auf iPhone und iPad bestätigt) und 38 (Commit `0c62ef6`: Konto 36, Übersicht 37, Training 38 im neuen Originaldesign).
- Live: https://selvirtnj.github.io/puls/?v=56 ; Repository: https://github.com/selvirtnj/puls .
- Davor veröffentlicht: 35, Ausgangscommit `6e878204b677d1e9aa8f51f51f22f2df526f2c81`.
- Version 34: fokussierte Oberfläche, neu geordnetes Konto, mehr Diagramme, vier zusätzliche Designs, Archiv und Projektdokumentation.
- Version 35: 87 neue Übungsvarianten, insgesamt 963; Maschinen-/Kabel-/Smith-Filter, deutsche Suchnamen und Ergebnis-Paginierung.
- Die anschließende Team-Einrichtung ändert Dokumentation, Agentenrollen und Entwicklungswerkzeuge, keine Runtime-Funktion der App. Deshalb bleibt die App-Version 35.
- Die bisherigen Web checks und Pages-Veröffentlichungen für 35 waren erfolgreich. Das ist ein historischer Prüfstand, kein dauerhafter Live-Nachweis.

## Was jetzt eingerichtet ist

`AGENTS.md`, `docs/START-HERE.md`, Produktkontext, Backend-Übergabe, Teamablauf und die Rollen `puls_frontend`, `puls_backend`, `puls_reviewer`. Ein Hauptchat koordiniert die Aufgaben. Seit 24.10.2026: Hauptchat „PULS · Hauptchat“ in Claude Code koordiniert Claude, Codex (`scripts/codex-bridge.ps1`) und Gemini/Antigravity (`scripts/gemini-bridge.ps1`) nach `docs/AI-TEAM.md`; Brücken inkl. Rückfragen getestet. Regel: nur Web-App, `ios/` nur auf Selvirs ausdrücklichen Wunsch. Neue Chats müssen die Dokumentation lesen; automatische vollständige Übertragung beliebiger Gesprächshistorien wird nicht vorausgesetzt.

## Sofort nutzbare Befehle

```sh
git status --short
git log -1 --oneline
node scripts/check.cjs
node scripts/check-handoff.cjs
node scripts/serve.cjs
```

`npm test` entspricht `node scripts/check.cjs`. Keine npm-Abhängigkeiten nötig. Ist npm nicht im PATH, direkt Node benutzen.

## Aktueller Auftrag / nächster Schritt

Selvir hat am 24.10.2026 die Zielklärung bestätigt: persönliche iPhone-Nutzung, sportliches dunkles lila Original, weniger verschachtelte Karten, sichtbare kurze Aktionsreaktionen. Konto- und Übersichts-Vorschau wurden ausdrücklich positiv beurteilt. Alle vier Hauptbereiche (Konto, Übersicht, Training, Essen) sind im neuen Originaldesign live; danach folgen Selvirs Einzelwünsche (siehe Übergaben unten). Keine automatische kontinuierliche Hintergrundarbeit. Verbindlicher Plan: `docs/DESIGN-WORKPLAN.md`.

Hauptchat ist Claude Code („PULS · Hauptchat“); wer direkt in Codex arbeitet, findet den Einstiegsauftrag in `docs/START-HERE.md`. Projektrollen werden je nach Client nach Projektöffnung/neuem Chat geladen, nicht zwingend mitten in einer bestehenden Sitzung.

## Technische Orientierung

Statische Dateien: `index.html`/`sw.js` im Stamm, Skripte in `js/`, Styles in `css/` (seit 25.10.2026, siehe `docs/ARCHITECTURE.md`); kein Bundler und kein React-/Flutter-Projekt. Ältere Übergaben unten nennen Dateien noch ohne `js/`/`css/`-Präfix. JS-Dateien definieren Globals und umschließen bestehende Funktionen. Die letzte Definition in der Ladereihenfolge gewinnt; beim Ändern immer die Kette prüfen. Tests verwenden VM-/DOM-/Netzwerkstubs.

`state` bleibt die gemeinsame Datenbasis. Lokales Profil: `puls-v1`. Auth-/Synchronisierungsmetadaten und gegebenenfalls alte lokale Fotos haben weitere Schlüssel. Supabase speichert pro Nutzer ein revisionsgeprüftes JSON-Profil. Die Backend-Dateien belegen die beabsichtigte Konfiguration, nicht den aktuellen Live-Zustand.

Katalog, Icons, Offline-Cache und PWA-Scope müssen bei Releases mitbedacht werden. Der bisherige Autoringsordner mit `dist/`, `release34/` und einmaligen Vorbereitungsskripten ist keine zweite aktuelle Quelle; Skripte daraus nicht unbesehen ausführen.

## Offene Grenzen und sinnvolle spätere Aufgaben

Keine der folgenden Aufgaben ist durch diese Liste automatisch zur Umsetzung freigegeben:

1. Modulkopplung: langfristig Funktionen klarer aufteilen und Wrapper reduzieren, mit Tests. Kein riskanter Komplettumbau nebenbei.
2. Backend: direkte eigene Tabellen-Schreibrechte können den RPC-Revisionsweg umgehen; serverseitige Payload-Validierung ist flacher als die Clientprüfung. Siehe Backend-Übergabe.
3. Geteilte Geräte: benutzerübergreifende Backup-/Rückkehrschlüssel und Offline-Abmeldung ausdrücklich testen.
4. Breitere Nutzung mit Freunden: reale Zweikonto-Isolation, Auth-Mailversand/SMTP, Limits, Offline-Sync und Restore mit eigens angelegten Testkonten prüfen. Mock-Tests allein genügen nicht.
5. UI-/Browsergrenzen: Audio/Kamera/Sprache/OCR und Hintergrundverhalten hängen von iOS und Browserberechtigungen ab. Reale iPhone-Tests bleiben nötig.
6. Einige neue Diagramm- und Beschreibungsdetails sind möglicherweise noch nicht vollständig übersetzt. Bei englischer UI konkret prüfen, nicht pauschal Vollständigkeit behaupten.

## Übergabe nach jeder größeren Aufgabe

### Profil-/Planformular — Schritt 1 Logik, lokal — 24.10.2026

- Koordinator-Auftrag auf Basis `98cadad` (Version 42): ausschließlich Profil-/Planlogik in `enhancements.js`, `experience.js`, `adaptation.js`; Layout und Entfernen von Erklärungstexten folgen bei Claude. Keine Veröffentlichung, Versions-/Asset-/SW- oder iOS-Änderung.
- Review-Nacharbeit nach Koordinatorentscheidung: Persönliches männliches Profil bleibt verbindlich; Laden und Formular normalisieren wie zuvor `sex` auf `male` und `special` auf `false`. `validData()` akzeptiert alte Sicherungen unverändert. Zusätzliche Profil-/Planfelder bleiben erhalten. Inaktive Makroparameter und Tempo blockieren keinen Moduswechsel; ungültiger inaktiver RMR erhält den bisherigen Messwert. Dezimalwerte aus gültigen Sicherungen werden nicht durch HTML-Schrittweiten blockiert.
- 4/4/9-Prüfung mit 50-kcal-Toleranz bei manuellen Kalorien und bei automatischen Kalorien mit selbst gesetzten Makros: nur bei Änderungen relevanter kcal-/Makrofelder oder Wechsel des Kalorien-/Makromodus. Unveränderte unstimmige Altziele blockieren andere Profiländerungen nicht; keine automatische Umrechnung. Vorschau und Speichern verwenden dieselbe Validierung, auch bei teilweise ausgefülltem Profil im manuellen Modus. Automatische Gewichtsanpassungen erhalten selbst gesetzte Makros weiterhin.
- Vorschau/Prognose verwenden den aktuellen Lern-Schalter; geänderte Formelgrundlagen verwerfen Kalibrierung vor dem Neuberechnen. Abgewiesenes Speichern löst keine nachträgliche Kalibrierung aus. Adaptive Ziele prüfen Ausschlüsse, endliche Werte und Grenzen. Extremes Abnehmtempo erzeugt bei zu niedrigem Erhalt keinen Überschuss; bei Wechsel auf Zunehmen gilt das bisher rechnerisch verwendete hohe Tempo auch sichtbar.
- Unverändertes vorbelegtes Gewicht erzeugt keine heutige Messung. Explizite Änderungen behalten vorhandene Messungs-IDs; direkte Zieländerungen werden wie adaptive Änderungen tagesweise in `goalHistory` erfasst. Neue Regressionen: `tests/check-profile-planning.cjs`, im regulären Prüflauf eingetragen. Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden.
- Grenzen/Integration: Kern vom unabhängigen Claude-Prüfer bestätigt; dessen vier Nacharbeiten sind umgesetzt, Nachprüfung und Browser-/iPhone-Prüfung beim Koordinator offen. VM-Tests belegen kein Layout oder Live-RLS. Claudes neue `profile-refresh.js`/`.css` wurden bei der Logik-Nacharbeit nicht verändert; bestehende IDs/Container bleiben Schnittstelle. Konto → Deine Daten bietet JSON-Export und CSV direkt; Wiederherstellen liegt weiterhin im Sicherungs-Tab (zuvor „Daten & Methoden“). Versteckte `pr-sex`/`pr-special` bleiben als kompatible Formularschnittstelle erhalten.

### Version 43 — Profil & Ziele — veröffentlicht 24.10.2026

- Oberfläche (Claude): `profile-refresh.js`/`.css`, alle Designs. Abschnitte 01 Körper, 02 Ziel, 03 Makros, 04 Automatik, 05 Ergebnis; Erklär- und Annahmetexte ausgeblendet; Selects `pl-mode`, `pl-direction`, `pl-pace`, `pl-macros`, `pr-method` als Schalter (Selects bleiben versteckt die Quelle); im Modus irrelevante Felder ausgeblendet; Speichern und `#plan-error` fest unten; Tab „Daten & Methoden“ heißt „Sicherung“ (nur Export, Wiederherstellen, CSV). EN-Übersetzungen und `aria-label` nach Codex-Review ergänzt.
- Logik (Codex, Einträge unten): 9 Fehler behoben, danach 4 Review-Punkte des Claude-Prüfers: männliches Profil wieder normalisiert (Koordinator-Entscheidung gemäß früherer Produktentscheidung), 4/4/9-Prüfung auch bei berechneten kcal mit selbst gesetzten Makros und nur bei geänderten Zielfeldern, Vorschau und Speichern identisch validiert.
- Reviews: Codex prüfte die Oberfläche (2 Befunde behoben), Claude-Prüfer die Logik (Gemini im Kontingent-Limit bis ca. 31.10.2026). Browser 390 × 844: Selbst/Berechnet, Halten, Teilprofil, 4/4/9, Speichern und Wiederöffnen, Sicherungs-Tab, Englisch. Grenzen: kein echtes iPhone, kein VoiceOver-Gerätetest.

### Version 42 — Wischseiten mit Abstand — veröffentlicht 24.10.2026

- Selvirs Wunsch: Beim Wischen von Energie & Makros zu Mikronährstoffen lagen die Inhalte zu dicht. Übersicht und Essen (Original): .nutritiontrack reicht per margin-inline:-16px bis an den Rand, Seiten haben 16 px Innenabstand → Inhalt bündig, 32 px Luft zwischen den Seiten; Seitenbreite = Bandbreite, daher Punkte/setNutrientSlide() unverändert. Browser: Einrasten, Punkte, kein Überlauf auf beiden Seiten geprüft.

### Version 41 — Essen im Originaldesign — veröffentlicht 24.10.2026

- Letzter Abschnitt aus docs/DESIGN-WORKPLAN.md (Claude): neue food-refresh.css, nur body[data-current-page=food][data-app-design=classic]. Offene Abschnitte 01–05 (Energie & Makros, Dein Essen, Vorschläge, Nährstoffwerte, Erfassung abschließen) mit Trennlinien statt Karten, Hauptaktion breit und zwei Nebenaktionen, Wasser als schlanke Zeile, Tagebuch als Zeilen mit deckendem Hintergrund (Wischen zum Löschen unverändert), kurze Animationen, reduzierte Bewegung. Kein JS/HTML/Datenmodell geändert.
- Review Codex: 2 Befunde behoben (Wasserknopf 44 px gegen comfort.css-!important; Innenabstand 04/05 gegen compact.css-Spezifität). Browser 390 × 844 und 320 px ohne Überlauf, Wischen-Löschen geprüft. Grenzen: kein echtes iPhone, andere Designs bewusst unverändert.

### Version 40 — veröffentlicht 24.10.2026 (erster Teamauftrag Claude + Codex + Gemini)

- Laufendes Workout (Claude): `session-focus.css`/`session-focus.js`. Pausentimer klebt in allen 11 Designs direkt unter der Session-Kopfzeile; deren echte Höhe (Safe Area/Dynamic Island) wird als `--session-head-h` gemessen. Vorher lag `top:80px` auf dem iPhone hinter der ~128 px hohen Kopfzeile, im Original-Design zudem halbtransparent. Satzzeilen ohne Trennlinien mit 8 px Abstand; Abhak-Box sichtbar 24 px in 44 × 44 px Tippfläche, helles Häkchen bei dunklen Akzenten (apple, mono, terra, blueprint).
- Erststart optional + Tutorial entfernt (Codex, Einträge unten). Landkarte vorab von Gemini.
- Reviews: Codex prüfte `native-bridge.js` (2 Befunde behoben: geänderte Satzangaben während der Pause, Cloud-Abgleich setzte Fortschritt zurück); Gemini prüfte Claudes Session-Änderungen (2 Befunde behoben: Häkchen-Kontrast, 44-px-Spalte); Claude und Gemini prüften Codex' Erststart/Tutorial (keine Befunde).
- Prüfung: `node scripts/check.cjs`, Bridge-VM-Simulation, Browser 390 × 844 mit `?erststart=1` (leerer Erststart bis Übersicht, Konto ohne NaN/Tutorial, Session in allen Designs mit simulierter 59-px-Safe-Area). Grenzen: kein echtes iPhone vor Veröffentlichung, kein Live-Sync-Test.

### Optionaler Erststart und Tutorial entfernt — Teil von Version 40

- Koordinator-Auftrag auf Basis `2e5f450`: Name und alle Planungsangaben beim Erststart optional; Abschluss über `onboardingComplete`/`setupPending`, unabhängig vom Namen. Unvollständige oder nicht automatisch planbare Eingaben speichern kein Teilprofil und verändern keine bestehenden Ziele. Vollständige geeignete Angaben nutzen die bisherigen Profil-, Plan-, Historien- und Startgewichtswege. Kontobearbeitung behält ihre Validierung. Avatar und Kontoname berücksichtigen Leerzeichen.
- Tutorial samt automatischem Start, Konto-Menü, Wrappern, Übersetzungen und CSS entfernt. `tutorialVersion` undefined/0/1 bleibt importierbar. Erfolgreicher Backup-Import bestimmt den lokalen Onboarding-Ablauf neu; fertige Backups bleiben nicht in der Erststart-Schleife hängen.
- `node scripts/check.cjs` einschließlich neuer `tests/check-onboarding.cjs` bestanden: leerer Erststart, nur Name, vollständige/unvollständige/ungültige Profile, Neustart, unveränderte Ziele, bisherige Kontovalidierung, alte Flags und Backup-Import. Bestehende Cloud-/Konflikttests ebenfalls bestanden. VM-Tests sind kein Layout- oder Live-RLS-Nachweis.
- Keine Veröffentlichung, Backend- oder iOS-Änderung. Versions-/Asset-/SW-Anpassungen und unabhängiges Review übernimmt Claude als Koordinator. Browser hier nicht verfügbar (`Browser is not available: iab`); Prüfung bei 390 × 844, Interaktionen und Designs bleibt beim Koordinator offen. Seine bestehenden Änderungen an Session-Fokus, Native Bridge, Einstieg und Service Worker bleiben unberührt.

### Pausen-Mitteilung und Dynamic Island — Web 39 / iOS-App 1.1 — 24.10.2026

- Selvirs Wunsch: Bei Pausenende außerhalb der App benachrichtigt werden, Countdown in der Dynamic Island (iPhone 16 Pro Max). Neue `native-bridge.js` (nur in der iOS-Hülle aktiv, im Browser wirkungslos) meldet die erste ablaufende Pause unbeendeter Workouts; `ios/PULS/RestCoordinator.swift` plant die Mitteilung und steuert die Live-Aktivität, `ios/PULSWidgets/` zeichnet Dynamic Island und Sperrbildschirm. Keine Änderung an Timer-Logik, Datenmodell oder `validData()`.
- Prüfung: `node scripts/check.cjs` grün; VM-Simulation der Brücke (Start, +30 s, neuer Satz, Übungswechsel, Superset, zwei Workouts, Reload nach Pausenende, Workout-Ende, Browser ohne Handler). Review durch Claude-Prüfer (Codex im Nutzungslimit); alle sieben Befunde behoben.
- Grenzen: Swift nur durch CI kompiliert, nicht auf Gerät getestet. Ob AltStore mit kostenloser Apple-ID die Widget-Erweiterung behält, ist ungeprüft; ohne sie gibt es nur die Mitteilung.

### Native iOS-Hülle — 24.10.2026

- Auf Selvirs Wunsch (echte iOS-App per AltStore auf iPad/iPhone): `ios/` enthält eine Swift-`WKWebView`-Hülle um die Live-Web-App; `.github/workflows/ios-app.yml` baut auf macOS eine unsignierte `PULS.ipa` und veröffentlicht sie als GitHub-Release (`/releases/latest/download/PULS.ipa`). Anleitung und Grenzen: `docs/IOS-APP.md`.
- Keine Änderung an Web-App-Dateien oder App-Version (bleibt 38). Erster CI-Build erfolgreich, IPA enthält App, Info.plist und Icons.
- Grenzen: nur kompiliert, noch nicht auf echtem Gerät installiert/getestet. App-Speicher ist getrennt von Safari; Daten kommen über Konto-Sync.

### Trainings-Vorschau 38 — 24.10.2026

- Nach Bestätigung der Übersicht beauftragt. Neue `training-refresh.css` gestaltet ausschließlich Training im Originaldesign sowie Original-Vollbildsessions unabhängig vom Hintergrundtab. Vier unterstrichene Reiter, offene Routinen-/Kalender-/Fortschrittsabschnitte, klare Typografie, flache Ergebnisgitter. Kurze Übergangs-/Satzanimationen; bestehende Feieranimationen und Reduced Motion erhalten.
- Keine neue JS-Logik, Timer-/Daten-/ID-/Handleränderung oder Backendänderung. Satzfelder/Checkboxen 44 px; fünfspaltiges Raster mit schmaler Variante. Modals und Sortierghosts unverändert.
- Version 38 lokal konsistent in Anzeige, Package, Asset-Queries und SW-Cache; Stylesheet zuletzt und als Offline-Asset ergänzt. Am 24.10.2026 zusammen mit 36 und 37 als Commit `0c62ef6` veröffentlicht; GitHub Pages liefert 38 aus.
- Prüfung: `node scripts/check.cjs`, Integrationsprüfung und `git diff --check` bestanden. Unabhängiges Review ohne offene belegte Befunde; letzte Select-Farbkorrektur nachgeprüft.
- Browser mit isolierten Testdaten: alle vier Tabs, leere Ansicht und Routine mit langem Namen/zwei Übungen, Start, 50 kg × 8 eintragen/abhaken, automatischer Pausenstart und +30 s, Positionswechsel mit erhaltenen Satzwerten, Minimieren und Fortsetzen aus Übersicht, Abschluss mit unerledigter Übung einschließlich Zurück sowie alle drei Abschlussansichten. Kalender zeigt Testtraining; Fortschritt 400 kg Volumen/8 Reps und Zeitraumfilter geprüft. Hauptprüfung 390 × 844; Session zusätzlich bei 320 px ohne horizontalen Überlauf. Sichtbare Satzfelder und Checkboxen 44 px bestätigt.
- Grenzen: kein reales iPhone/Safari, kein echter Touch-Drag-/Safe-Area-/Hintergrundtimer-Test, kein Offline-SW- oder Live-Sync-Lauf. Positionswechsel per Auswahlfeld geprüft; vorhandene Drag-Logik nicht verändert. Reduced Motion implementiert/im Code geprüft, nicht mit aktivierter Betriebssystemoption getestet. Andere Designs vom neuen CSS ausgeschlossen, nicht erneut vollständig geprüft.
- Selvir hat Version 38 veröffentlichen lassen und auf dem iPhone bestätigt. Essen folgt erst nach weiterem konkretem Auftrag.

### Übersichts-Vorschau 37 — 24.10.2026

- Nach positiver Beurteilung des Kontos von Selvir beauftragt. `overview-refresh.css` gestaltet ausschließlich `home` im Originaldesign: offene Abschnitte, Nummern 01–04, klare Typografie/Trennlinien, kompakte Aktionsknöpfe, kurze Eintritts-/Kreis-/Balkenanimationen und Reduced Motion. Bestehendes HTML, Handler und Berechnungen unverändert; kein neues JavaScript, kein Backend oder Datenmodell.
- Letztes Stylesheet in `index.html`, Offline-Asset in `sw.js` ergänzt. Lokale Anzeige, Asset-Queries, Package und Cache konsistent Version 37. Keine Veröffentlichung und kein Release-Commit; veröffentlichter Stand weiterhin 35.
- Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden; unabhängiges Review ohne offene belegte Befunde. In der Browserprüfung gefundene CSS-Spezifitätskonflikte bei Nummerierung/Innenabständen korrigiert und unabhängig nachgeprüft.
- Browser bei 390 × 844 mit isolierter Erststart-Vorschau: leere und gefüllte Bilanz, Mikro-Wechsel bei unverändert 220 px Pane-Höhe, Essen erfassen und Vorschau, Routine erstellen mit langem Namen, starten/minimieren/fortsetzen, leeres Testworkout verwerfen, Zeitraum/Kurvenfilter und Vortag/Heute geprüft. Kein horizontaler Überlauf; geprüfte Aktionsknöpfe mindestens 44 px hoch. Testdaten ausschließlich im Speicher der Vorschau.
- Grenzen: kein reales iPhone/Safari oder Offline-SW-Lauf; reduzierte Bewegung im Code geprüft, nicht per Betriebssystemoption aktiviert. Andere neun Designs vom neuen CSS ausgeschlossen, nicht erneut vollständig im Browser geprüft. Bestehende Mock-Tests sind kein Layout- oder Live-Sync-Nachweis.
- Selvir hat die Übersicht bestätigt und Training als nächsten Abschnitt beauftragt. Essen bleibt als späterer Abschnitt geplant.

### Konto-Vorschau 36 — 24.10.2026

- Bestätigter Plan in `docs/DESIGN-WORKPLAN.md`; persönliche iPhone-Nutzung ersetzt einen geplanten Ausbau für Freunde.
- Lokal umgesetzt in `account-refresh.js` und `account-refresh.css`: kompakte Identität, Ziel und Gewicht/Wochenmittel; Menüzeilen zu vorhandenen Detailbereichen, Zurück mit Fokus/Scrollposition, kurze Animationen und Reduced-Motion-Regeln. Keine neuen persistierten Datenfelder oder Backendänderungen.
- Originaldesign zuerst verfeinert; alle zehn Designs behalten dieselben Kontoabläufe. Bestehende Formulare, Sicherungen und Kontoverwaltung bleiben erreichbar. Tutorial an Unterseiten angepasst.
- Lokale Versionsvorbereitung 36: Anzeige, Asset-Queries, package.json und SW-Cache samt neuen Offline-Dateien. Noch nicht veröffentlicht und kein Release-Commit; live bleibt der zuvor veröffentlichte Stand 35.
- Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden. Unabhängiges Review ohne offene belegte Funktionsbefunde nach Korrektur der Wochenbeschriftung; Mittelwert, Leerwerte und Ausschluss zukünftiger Gewichte zusätzlich mit lokalen Fixtures geprüft.
- Echte Browserprüfung bei 390 × 844 mit `?erststart=1` und künstlichem Profil: alle neun in der Vorschau verfügbaren Menübereiche, Planformular, Gewicht speichern/Aktualisierung, Zurück-Fokus, Designwechsel über alle zehn Varianten ohne horizontalen Überlauf, Sprachwechsel DE/EN und Tutorialdurchlauf. Gefundene globale CSS-Konflikte korrigiert. Keine Konsolenfehler im geprüften Ablauf.
- Grenzen: VM-Suite deckt die neue DOM-Navigation nicht vollständig ab. Kein reales iPhone/Safari, keine echte Supabase-Anmeldung/RLS und kein Offline-SW-Lauf geprüft; Sync ist in der Erststart-Vorschau absichtlich ausgeblendet. Reduced Motion implementiert und im Code geprüft, nicht mit aktivierter Betriebssystemoption getestet.
- Selvir hat die Konto-Vorschau positiv beurteilt und anschließend die Übersicht beauftragt. Veröffentlichung weiterhin offen.

Hier knapp ergänzen: Auftrag, geänderte Bereiche, Ergebnis der Prüfungen, Integrations-/Release-Commit, noch offene Befunde. Historische Release-Dokumente nicht als aktuellen Arbeitsauftrag fortschreiben. Private Daten gehören nicht in diese Datei.
