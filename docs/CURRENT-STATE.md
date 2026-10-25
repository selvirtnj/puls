# PULS â€” aktueller Stand und Ãœbergabe

Aktualisiert: 24.10.2026. MaÃŸgeblicher Code: dieses Repository. Git-Historie und aktuelle CI zusÃ¤tzlich prÃ¼fen.

## Stand bei Einrichtung der Zusammenarbeit

- VerÃ¶ffentlichte App-Version: **51** (25.10.2026: Barcode auch senkrecht â€” eigener Zusatz-Scan des um 90Â° gedrehten Videobilds in `js/products.js`, da ZXings TRY_HARDER-Drehung in 0.2.1 fehlerhaft ist; auf Selvirs ausdrÃ¼cklichen Auftrag iOS-App 1.3: Live-AktivitÃ¤t/Dynamic Island zeigt ohne Pause die Workout-Zeit, nach Pausenende automatisch per staleDate, `native-bridge.js` sendet `workoutActive` nur bei `window.pulsNativeFeatures` mit `workoutTimer`, Ã¤ltere App bleibt beim alten Verhalten; Review Codex: 1 Befund behoben und nachgeprÃ¼ft). Davor 50 (25.10.2026: Konto â€” â€žDein Designâ€œ enthÃ¤lt Sprache und App-Icon direkt, Design-Kacheln schmal in drei Spalten, â€žKonto & Synchronisierungâ€œ steckt in â€žDeine Datenâ€œ, `js/account-refresh.js`/`css/account-refresh.css`; Tab-Wechsel unten mit Wisch-Animation links/rechts, `js/page-slide.js`/`css/page-slide.css`; Review Codex: 1 Befund Fokus behoben und nachgeprÃ¼ft). Davor 49 (25.10.2026: `js/workout-controls.js`/`css/workout-controls.css` â€” Linien-Symbole statt Textzeichen âŒ„ âŒƒ Ã— âœ• â€¹ â€º, knapperes Abschluss-Fenster mit Verwerfen-Warnung, âˆ’30 s und â€žPausenzeitâ€œ im laufenden Workout, Scroll-Rad fÃ¼r die Standardpause, zentriertes Datumsfeld; Review Claude-PrÃ¼fer: 4 Befunde behoben). Davor 48 (25.10.2026: Pop-up â€žPause vorbeiâ€œ mit OK und Animation, `js/rest-popup.js`/`css/rest-popup.css`, eigener `<dialog>` Ã¼ber offenen Fenstern, Vormerken bei Pausenende im Hintergrund bis 10 min; Review Claude-PrÃ¼fer: 5 Befunde behoben und nachgeprÃ¼ft). Davor 47 (25.10.2026, auf Selvirs ausdrÃ¼cklichen iOS-Auftrag: iOS-App 1.2 mit echtem App-Icon-Wechsel und neu gestalteter Dynamic Island/Live-AktivitÃ¤t; `js/native-bridge.js` sendet `setAppIcon`; Review Claude-PrÃ¼fer, da Codex und Gemini im Limit). Davor 46 (25.10.2026: Repository aufgerÃ¤umt â€” Skripte in `js/`, Styles in `css/`, alte Doku in `docs/archive/`, `archive/` entfernt, neue README; `sw.js` aktiviert neue Versionen sofort per `skipWaiting()` nach vollstÃ¤ndigem Precache; Review Codex: Offline-LÃ¼cke beim Update behoben). Davor 45 (25.10.2026: Training â€” Workout-Tab als Startseite mit kompakten Routinenzeilen, â€žHeute erledigtâ€œ abgesetzt, Routinen-Tab bleibt Verwaltung, Kalender ohne doppelte Linie; `training-tabs.js`/`.css`, alle Designs, Review Codex: EN-Befund behoben). Davor 44 (Profil-Schalter Richtung/Tempo untereinander), 43 (Profil & Ziele Ã¼berarbeitet, Logikfehler behoben), 42 (Abstand zwischen den Wischseiten), 41 (Essen im neuen Originaldesign), 40 (optionaler Erststart, Tutorial entfernt, klebender Pausentimer, ruhigere Satzzeilen), 39 (`native-bridge.js` fÃ¼r Pausen-Mitteilung und Dynamic Island; von Selvir auf iPhone und iPad bestÃ¤tigt) und 38 (Commit `0c62ef6`: Konto 36, Ãœbersicht 37, Training 38 im neuen Originaldesign).
- Live: https://selvirtnj.github.io/puls/?v=51 ; Repository: https://github.com/selvirtnj/puls .
- Davor verÃ¶ffentlicht: 35, Ausgangscommit `6e878204b677d1e9aa8f51f51f22f2df526f2c81`.
- Version 34: fokussierte OberflÃ¤che, neu geordnetes Konto, mehr Diagramme, vier zusÃ¤tzliche Designs, Archiv und Projektdokumentation.
- Version 35: 87 neue Ãœbungsvarianten, insgesamt 963; Maschinen-/Kabel-/Smith-Filter, deutsche Suchnamen und Ergebnis-Paginierung.
- Die anschlieÃŸende Team-Einrichtung Ã¤ndert Dokumentation, Agentenrollen und Entwicklungswerkzeuge, keine Runtime-Funktion der App. Deshalb bleibt die App-Version 35.
- Die bisherigen Web checks und Pages-VerÃ¶ffentlichungen fÃ¼r 35 waren erfolgreich. Das ist ein historischer PrÃ¼fstand, kein dauerhafter Live-Nachweis.

## Was jetzt eingerichtet ist

`AGENTS.md`, `docs/START-HERE.md`, Produktkontext, Backend-Ãœbergabe, Teamablauf und die Rollen `puls_frontend`, `puls_backend`, `puls_reviewer`. Ein Hauptchat koordiniert die Aufgaben. Seit 24.10.2026: Hauptchat â€žPULS Â· Hauptchatâ€œ in Claude Code koordiniert Claude, Codex (`scripts/codex-bridge.ps1`) und Gemini/Antigravity (`scripts/gemini-bridge.ps1`) nach `docs/AI-TEAM.md`; BrÃ¼cken inkl. RÃ¼ckfragen getestet. Regel: nur Web-App, `ios/` nur auf Selvirs ausdrÃ¼cklichen Wunsch. Neue Chats mÃ¼ssen die Dokumentation lesen; automatische vollstÃ¤ndige Ãœbertragung beliebiger GesprÃ¤chshistorien wird nicht vorausgesetzt.

## Sofort nutzbare Befehle

```sh
git status --short
git log -1 --oneline
node scripts/check.cjs
node scripts/check-handoff.cjs
node scripts/serve.cjs
```

`npm test` entspricht `node scripts/check.cjs`. Keine npm-AbhÃ¤ngigkeiten nÃ¶tig. Ist npm nicht im PATH, direkt Node benutzen.

## Aktueller Auftrag / nÃ¤chster Schritt

Selvir hat am 24.10.2026 die ZielklÃ¤rung bestÃ¤tigt: persÃ¶nliche iPhone-Nutzung, sportliches dunkles lila Original, weniger verschachtelte Karten, sichtbare kurze Aktionsreaktionen. Konto- und Ãœbersichts-Vorschau wurden ausdrÃ¼cklich positiv beurteilt. Alle vier Hauptbereiche (Konto, Ãœbersicht, Training, Essen) sind im neuen Originaldesign live; danach folgen Selvirs EinzelwÃ¼nsche (siehe Ãœbergaben unten). Keine automatische kontinuierliche Hintergrundarbeit. Verbindlicher Plan: `docs/DESIGN-WORKPLAN.md`.

Hauptchat ist Claude Code (â€žPULS Â· Hauptchatâ€œ); wer direkt in Codex arbeitet, findet den Einstiegsauftrag in `docs/START-HERE.md`. Projektrollen werden je nach Client nach ProjektÃ¶ffnung/neuem Chat geladen, nicht zwingend mitten in einer bestehenden Sitzung.

## Technische Orientierung

Statische Dateien: `index.html`/`sw.js` im Stamm, Skripte in `js/`, Styles in `css/` (seit 25.10.2026, siehe `docs/ARCHITECTURE.md`); kein Bundler und kein React-/Flutter-Projekt. Ã„ltere Ãœbergaben unten nennen Dateien noch ohne `js/`/`css/`-PrÃ¤fix. JS-Dateien definieren Globals und umschlieÃŸen bestehende Funktionen. Die letzte Definition in der Ladereihenfolge gewinnt; beim Ã„ndern immer die Kette prÃ¼fen. Tests verwenden VM-/DOM-/Netzwerkstubs.

`state` bleibt die gemeinsame Datenbasis. Lokales Profil: `puls-v1`. Auth-/Synchronisierungsmetadaten und gegebenenfalls alte lokale Fotos haben weitere SchlÃ¼ssel. Supabase speichert pro Nutzer ein revisionsgeprÃ¼ftes JSON-Profil. Die Backend-Dateien belegen die beabsichtigte Konfiguration, nicht den aktuellen Live-Zustand.

Katalog, Icons, Offline-Cache und PWA-Scope mÃ¼ssen bei Releases mitbedacht werden. Der bisherige Autoringsordner mit `dist/`, `release34/` und einmaligen Vorbereitungsskripten ist keine zweite aktuelle Quelle; Skripte daraus nicht unbesehen ausfÃ¼hren.

## Offene Grenzen und sinnvolle spÃ¤tere Aufgaben

Keine der folgenden Aufgaben ist durch diese Liste automatisch zur Umsetzung freigegeben:

1. Modulkopplung: langfristig Funktionen klarer aufteilen und Wrapper reduzieren, mit Tests. Kein riskanter Komplettumbau nebenbei.
2. Backend: direkte eigene Tabellen-Schreibrechte kÃ¶nnen den RPC-Revisionsweg umgehen; serverseitige Payload-Validierung ist flacher als die ClientprÃ¼fung. Siehe Backend-Ãœbergabe.
3. Geteilte GerÃ¤te: benutzerÃ¼bergreifende Backup-/RÃ¼ckkehrschlÃ¼ssel und Offline-Abmeldung ausdrÃ¼cklich testen.
4. Breitere Nutzung mit Freunden: reale Zweikonto-Isolation, Auth-Mailversand/SMTP, Limits, Offline-Sync und Restore mit eigens angelegten Testkonten prÃ¼fen. Mock-Tests allein genÃ¼gen nicht.
5. UI-/Browsergrenzen: Audio/Kamera/Sprache/OCR und Hintergrundverhalten hÃ¤ngen von iOS und Browserberechtigungen ab. Reale iPhone-Tests bleiben nÃ¶tig.
6. Einige neue Diagramm- und Beschreibungsdetails sind mÃ¶glicherweise noch nicht vollstÃ¤ndig Ã¼bersetzt. Bei englischer UI konkret prÃ¼fen, nicht pauschal VollstÃ¤ndigkeit behaupten.

## Ãœbergabe nach jeder grÃ¶ÃŸeren Aufgabe

### Profil-/Planformular â€” Schritt 1 Logik, lokal â€” 24.10.2026

- Koordinator-Auftrag auf Basis `98cadad` (Version 42): ausschlieÃŸlich Profil-/Planlogik in `enhancements.js`, `experience.js`, `adaptation.js`; Layout und Entfernen von ErklÃ¤rungstexten folgen bei Claude. Keine VerÃ¶ffentlichung, Versions-/Asset-/SW- oder iOS-Ã„nderung.
- Review-Nacharbeit nach Koordinatorentscheidung: PersÃ¶nliches mÃ¤nnliches Profil bleibt verbindlich; Laden und Formular normalisieren wie zuvor `sex` auf `male` und `special` auf `false`. `validData()` akzeptiert alte Sicherungen unverÃ¤ndert. ZusÃ¤tzliche Profil-/Planfelder bleiben erhalten. Inaktive Makroparameter und Tempo blockieren keinen Moduswechsel; ungÃ¼ltiger inaktiver RMR erhÃ¤lt den bisherigen Messwert. Dezimalwerte aus gÃ¼ltigen Sicherungen werden nicht durch HTML-Schrittweiten blockiert.
- 4/4/9-PrÃ¼fung mit 50-kcal-Toleranz bei manuellen Kalorien und bei automatischen Kalorien mit selbst gesetzten Makros: nur bei Ã„nderungen relevanter kcal-/Makrofelder oder Wechsel des Kalorien-/Makromodus. UnverÃ¤nderte unstimmige Altziele blockieren andere ProfilÃ¤nderungen nicht; keine automatische Umrechnung. Vorschau und Speichern verwenden dieselbe Validierung, auch bei teilweise ausgefÃ¼lltem Profil im manuellen Modus. Automatische Gewichtsanpassungen erhalten selbst gesetzte Makros weiterhin.
- Vorschau/Prognose verwenden den aktuellen Lern-Schalter; geÃ¤nderte Formelgrundlagen verwerfen Kalibrierung vor dem Neuberechnen. Abgewiesenes Speichern lÃ¶st keine nachtrÃ¤gliche Kalibrierung aus. Adaptive Ziele prÃ¼fen AusschlÃ¼sse, endliche Werte und Grenzen. Extremes Abnehmtempo erzeugt bei zu niedrigem Erhalt keinen Ãœberschuss; bei Wechsel auf Zunehmen gilt das bisher rechnerisch verwendete hohe Tempo auch sichtbar.
- UnverÃ¤ndertes vorbelegtes Gewicht erzeugt keine heutige Messung. Explizite Ã„nderungen behalten vorhandene Messungs-IDs; direkte ZielÃ¤nderungen werden wie adaptive Ã„nderungen tagesweise in `goalHistory` erfasst. Neue Regressionen: `tests/check-profile-planning.cjs`, im regulÃ¤ren PrÃ¼flauf eingetragen. PrÃ¼fung: `node scripts/check.cjs` und `git diff --check` bestanden.
- Grenzen/Integration: Kern vom unabhÃ¤ngigen Claude-PrÃ¼fer bestÃ¤tigt; dessen vier Nacharbeiten sind umgesetzt, NachprÃ¼fung und Browser-/iPhone-PrÃ¼fung beim Koordinator offen. VM-Tests belegen kein Layout oder Live-RLS. Claudes neue `profile-refresh.js`/`.css` wurden bei der Logik-Nacharbeit nicht verÃ¤ndert; bestehende IDs/Container bleiben Schnittstelle. Konto â†’ Deine Daten bietet JSON-Export und CSV direkt; Wiederherstellen liegt weiterhin im Sicherungs-Tab (zuvor â€žDaten & Methodenâ€œ). Versteckte `pr-sex`/`pr-special` bleiben als kompatible Formularschnittstelle erhalten.

### Version 43 â€” Profil & Ziele â€” verÃ¶ffentlicht 24.10.2026

- OberflÃ¤che (Claude): `profile-refresh.js`/`.css`, alle Designs. Abschnitte 01 KÃ¶rper, 02 Ziel, 03 Makros, 04 Automatik, 05 Ergebnis; ErklÃ¤r- und Annahmetexte ausgeblendet; Selects `pl-mode`, `pl-direction`, `pl-pace`, `pl-macros`, `pr-method` als Schalter (Selects bleiben versteckt die Quelle); im Modus irrelevante Felder ausgeblendet; Speichern und `#plan-error` fest unten; Tab â€žDaten & Methodenâ€œ heiÃŸt â€žSicherungâ€œ (nur Export, Wiederherstellen, CSV). EN-Ãœbersetzungen und `aria-label` nach Codex-Review ergÃ¤nzt.
- Logik (Codex, EintrÃ¤ge unten): 9 Fehler behoben, danach 4 Review-Punkte des Claude-PrÃ¼fers: mÃ¤nnliches Profil wieder normalisiert (Koordinator-Entscheidung gemÃ¤ÃŸ frÃ¼herer Produktentscheidung), 4/4/9-PrÃ¼fung auch bei berechneten kcal mit selbst gesetzten Makros und nur bei geÃ¤nderten Zielfeldern, Vorschau und Speichern identisch validiert.
- Reviews: Codex prÃ¼fte die OberflÃ¤che (2 Befunde behoben), Claude-PrÃ¼fer die Logik (Gemini im Kontingent-Limit bis ca. 31.10.2026). Browser 390 Ã— 844: Selbst/Berechnet, Halten, Teilprofil, 4/4/9, Speichern und WiederÃ¶ffnen, Sicherungs-Tab, Englisch. Grenzen: kein echtes iPhone, kein VoiceOver-GerÃ¤tetest.

### Version 42 â€” Wischseiten mit Abstand â€” verÃ¶ffentlicht 24.10.2026

- Selvirs Wunsch: Beim Wischen von Energie & Makros zu MikronÃ¤hrstoffen lagen die Inhalte zu dicht. Ãœbersicht und Essen (Original): .nutritiontrack reicht per margin-inline:-16px bis an den Rand, Seiten haben 16 px Innenabstand â†’ Inhalt bÃ¼ndig, 32 px Luft zwischen den Seiten; Seitenbreite = Bandbreite, daher Punkte/setNutrientSlide() unverÃ¤ndert. Browser: Einrasten, Punkte, kein Ãœberlauf auf beiden Seiten geprÃ¼ft.

### Version 41 â€” Essen im Originaldesign â€” verÃ¶ffentlicht 24.10.2026

- Letzter Abschnitt aus docs/DESIGN-WORKPLAN.md (Claude): neue food-refresh.css, nur body[data-current-page=food][data-app-design=classic]. Offene Abschnitte 01â€“05 (Energie & Makros, Dein Essen, VorschlÃ¤ge, NÃ¤hrstoffwerte, Erfassung abschlieÃŸen) mit Trennlinien statt Karten, Hauptaktion breit und zwei Nebenaktionen, Wasser als schlanke Zeile, Tagebuch als Zeilen mit deckendem Hintergrund (Wischen zum LÃ¶schen unverÃ¤ndert), kurze Animationen, reduzierte Bewegung. Kein JS/HTML/Datenmodell geÃ¤ndert.
- Review Codex: 2 Befunde behoben (Wasserknopf 44 px gegen comfort.css-!important; Innenabstand 04/05 gegen compact.css-SpezifitÃ¤t). Browser 390 Ã— 844 und 320 px ohne Ãœberlauf, Wischen-LÃ¶schen geprÃ¼ft. Grenzen: kein echtes iPhone, andere Designs bewusst unverÃ¤ndert.

### Version 40 â€” verÃ¶ffentlicht 24.10.2026 (erster Teamauftrag Claude + Codex + Gemini)

- Laufendes Workout (Claude): `session-focus.css`/`session-focus.js`. Pausentimer klebt in allen 11 Designs direkt unter der Session-Kopfzeile; deren echte HÃ¶he (Safe Area/Dynamic Island) wird als `--session-head-h` gemessen. Vorher lag `top:80px` auf dem iPhone hinter der ~128 px hohen Kopfzeile, im Original-Design zudem halbtransparent. Satzzeilen ohne Trennlinien mit 8 px Abstand; Abhak-Box sichtbar 24 px in 44 Ã— 44 px TippflÃ¤che, helles HÃ¤kchen bei dunklen Akzenten (apple, mono, terra, blueprint).
- Erststart optional + Tutorial entfernt (Codex, EintrÃ¤ge unten). Landkarte vorab von Gemini.
- Reviews: Codex prÃ¼fte `native-bridge.js` (2 Befunde behoben: geÃ¤nderte Satzangaben wÃ¤hrend der Pause, Cloud-Abgleich setzte Fortschritt zurÃ¼ck); Gemini prÃ¼fte Claudes Session-Ã„nderungen (2 Befunde behoben: HÃ¤kchen-Kontrast, 44-px-Spalte); Claude und Gemini prÃ¼ften Codex' Erststart/Tutorial (keine Befunde).
- PrÃ¼fung: `node scripts/check.cjs`, Bridge-VM-Simulation, Browser 390 Ã— 844 mit `?erststart=1` (leerer Erststart bis Ãœbersicht, Konto ohne NaN/Tutorial, Session in allen Designs mit simulierter 59-px-Safe-Area). Grenzen: kein echtes iPhone vor VerÃ¶ffentlichung, kein Live-Sync-Test.

### Optionaler Erststart und Tutorial entfernt â€” Teil von Version 40

- Koordinator-Auftrag auf Basis `2e5f450`: Name und alle Planungsangaben beim Erststart optional; Abschluss Ã¼ber `onboardingComplete`/`setupPending`, unabhÃ¤ngig vom Namen. UnvollstÃ¤ndige oder nicht automatisch planbare Eingaben speichern kein Teilprofil und verÃ¤ndern keine bestehenden Ziele. VollstÃ¤ndige geeignete Angaben nutzen die bisherigen Profil-, Plan-, Historien- und Startgewichtswege. Kontobearbeitung behÃ¤lt ihre Validierung. Avatar und Kontoname berÃ¼cksichtigen Leerzeichen.
- Tutorial samt automatischem Start, Konto-MenÃ¼, Wrappern, Ãœbersetzungen und CSS entfernt. `tutorialVersion` undefined/0/1 bleibt importierbar. Erfolgreicher Backup-Import bestimmt den lokalen Onboarding-Ablauf neu; fertige Backups bleiben nicht in der Erststart-Schleife hÃ¤ngen.
- `node scripts/check.cjs` einschlieÃŸlich neuer `tests/check-onboarding.cjs` bestanden: leerer Erststart, nur Name, vollstÃ¤ndige/unvollstÃ¤ndige/ungÃ¼ltige Profile, Neustart, unverÃ¤nderte Ziele, bisherige Kontovalidierung, alte Flags und Backup-Import. Bestehende Cloud-/Konflikttests ebenfalls bestanden. VM-Tests sind kein Layout- oder Live-RLS-Nachweis.
- Keine VerÃ¶ffentlichung, Backend- oder iOS-Ã„nderung. Versions-/Asset-/SW-Anpassungen und unabhÃ¤ngiges Review Ã¼bernimmt Claude als Koordinator. Browser hier nicht verfÃ¼gbar (`Browser is not available: iab`); PrÃ¼fung bei 390 Ã— 844, Interaktionen und Designs bleibt beim Koordinator offen. Seine bestehenden Ã„nderungen an Session-Fokus, Native Bridge, Einstieg und Service Worker bleiben unberÃ¼hrt.

### Pausen-Mitteilung und Dynamic Island â€” Web 39 / iOS-App 1.1 â€” 24.10.2026

- Selvirs Wunsch: Bei Pausenende auÃŸerhalb der App benachrichtigt werden, Countdown in der Dynamic Island (iPhone 16 Pro Max). Neue `native-bridge.js` (nur in der iOS-HÃ¼lle aktiv, im Browser wirkungslos) meldet die erste ablaufende Pause unbeendeter Workouts; `ios/PULS/RestCoordinator.swift` plant die Mitteilung und steuert die Live-AktivitÃ¤t, `ios/PULSWidgets/` zeichnet Dynamic Island und Sperrbildschirm. Keine Ã„nderung an Timer-Logik, Datenmodell oder `validData()`.
- PrÃ¼fung: `node scripts/check.cjs` grÃ¼n; VM-Simulation der BrÃ¼cke (Start, +30 s, neuer Satz, Ãœbungswechsel, Superset, zwei Workouts, Reload nach Pausenende, Workout-Ende, Browser ohne Handler). Review durch Claude-PrÃ¼fer (Codex im Nutzungslimit); alle sieben Befunde behoben.
- Grenzen: Swift nur durch CI kompiliert, nicht auf GerÃ¤t getestet. Ob AltStore mit kostenloser Apple-ID die Widget-Erweiterung behÃ¤lt, ist ungeprÃ¼ft; ohne sie gibt es nur die Mitteilung.

### Native iOS-HÃ¼lle â€” 24.10.2026

- Auf Selvirs Wunsch (echte iOS-App per AltStore auf iPad/iPhone): `ios/` enthÃ¤lt eine Swift-`WKWebView`-HÃ¼lle um die Live-Web-App; `.github/workflows/ios-app.yml` baut auf macOS eine unsignierte `PULS.ipa` und verÃ¶ffentlicht sie als GitHub-Release (`/releases/latest/download/PULS.ipa`). Anleitung und Grenzen: `docs/IOS-APP.md`.
- Keine Ã„nderung an Web-App-Dateien oder App-Version (bleibt 38). Erster CI-Build erfolgreich, IPA enthÃ¤lt App, Info.plist und Icons.
- Grenzen: nur kompiliert, noch nicht auf echtem GerÃ¤t installiert/getestet. App-Speicher ist getrennt von Safari; Daten kommen Ã¼ber Konto-Sync.

### Trainings-Vorschau 38 â€” 24.10.2026

- Nach BestÃ¤tigung der Ãœbersicht beauftragt. Neue `training-refresh.css` gestaltet ausschlieÃŸlich Training im Originaldesign sowie Original-Vollbildsessions unabhÃ¤ngig vom Hintergrundtab. Vier unterstrichene Reiter, offene Routinen-/Kalender-/Fortschrittsabschnitte, klare Typografie, flache Ergebnisgitter. Kurze Ãœbergangs-/Satzanimationen; bestehende Feieranimationen und Reduced Motion erhalten.
- Keine neue JS-Logik, Timer-/Daten-/ID-/HandlerÃ¤nderung oder BackendÃ¤nderung. Satzfelder/Checkboxen 44 px; fÃ¼nfspaltiges Raster mit schmaler Variante. Modals und Sortierghosts unverÃ¤ndert.
- Version 38 lokal konsistent in Anzeige, Package, Asset-Queries und SW-Cache; Stylesheet zuletzt und als Offline-Asset ergÃ¤nzt. Am 24.10.2026 zusammen mit 36 und 37 als Commit `0c62ef6` verÃ¶ffentlicht; GitHub Pages liefert 38 aus.
- PrÃ¼fung: `node scripts/check.cjs`, IntegrationsprÃ¼fung und `git diff --check` bestanden. UnabhÃ¤ngiges Review ohne offene belegte Befunde; letzte Select-Farbkorrektur nachgeprÃ¼ft.
- Browser mit isolierten Testdaten: alle vier Tabs, leere Ansicht und Routine mit langem Namen/zwei Ãœbungen, Start, 50 kg Ã— 8 eintragen/abhaken, automatischer Pausenstart und +30 s, Positionswechsel mit erhaltenen Satzwerten, Minimieren und Fortsetzen aus Ãœbersicht, Abschluss mit unerledigter Ãœbung einschlieÃŸlich ZurÃ¼ck sowie alle drei Abschlussansichten. Kalender zeigt Testtraining; Fortschritt 400 kg Volumen/8 Reps und Zeitraumfilter geprÃ¼ft. HauptprÃ¼fung 390 Ã— 844; Session zusÃ¤tzlich bei 320 px ohne horizontalen Ãœberlauf. Sichtbare Satzfelder und Checkboxen 44 px bestÃ¤tigt.
- Grenzen: kein reales iPhone/Safari, kein echter Touch-Drag-/Safe-Area-/Hintergrundtimer-Test, kein Offline-SW- oder Live-Sync-Lauf. Positionswechsel per Auswahlfeld geprÃ¼ft; vorhandene Drag-Logik nicht verÃ¤ndert. Reduced Motion implementiert/im Code geprÃ¼ft, nicht mit aktivierter Betriebssystemoption getestet. Andere Designs vom neuen CSS ausgeschlossen, nicht erneut vollstÃ¤ndig geprÃ¼ft.
- Selvir hat Version 38 verÃ¶ffentlichen lassen und auf dem iPhone bestÃ¤tigt. Essen folgt erst nach weiterem konkretem Auftrag.

### Ãœbersichts-Vorschau 37 â€” 24.10.2026

- Nach positiver Beurteilung des Kontos von Selvir beauftragt. `overview-refresh.css` gestaltet ausschlieÃŸlich `home` im Originaldesign: offene Abschnitte, Nummern 01â€“04, klare Typografie/Trennlinien, kompakte AktionsknÃ¶pfe, kurze Eintritts-/Kreis-/Balkenanimationen und Reduced Motion. Bestehendes HTML, Handler und Berechnungen unverÃ¤ndert; kein neues JavaScript, kein Backend oder Datenmodell.
- Letztes Stylesheet in `index.html`, Offline-Asset in `sw.js` ergÃ¤nzt. Lokale Anzeige, Asset-Queries, Package und Cache konsistent Version 37. Keine VerÃ¶ffentlichung und kein Release-Commit; verÃ¶ffentlichter Stand weiterhin 35.
- PrÃ¼fung: `node scripts/check.cjs` und `git diff --check` bestanden; unabhÃ¤ngiges Review ohne offene belegte Befunde. In der BrowserprÃ¼fung gefundene CSS-SpezifitÃ¤tskonflikte bei Nummerierung/InnenabstÃ¤nden korrigiert und unabhÃ¤ngig nachgeprÃ¼ft.
- Browser bei 390 Ã— 844 mit isolierter Erststart-Vorschau: leere und gefÃ¼llte Bilanz, Mikro-Wechsel bei unverÃ¤ndert 220 px Pane-HÃ¶he, Essen erfassen und Vorschau, Routine erstellen mit langem Namen, starten/minimieren/fortsetzen, leeres Testworkout verwerfen, Zeitraum/Kurvenfilter und Vortag/Heute geprÃ¼ft. Kein horizontaler Ãœberlauf; geprÃ¼fte AktionsknÃ¶pfe mindestens 44 px hoch. Testdaten ausschlieÃŸlich im Speicher der Vorschau.
- Grenzen: kein reales iPhone/Safari oder Offline-SW-Lauf; reduzierte Bewegung im Code geprÃ¼ft, nicht per Betriebssystemoption aktiviert. Andere neun Designs vom neuen CSS ausgeschlossen, nicht erneut vollstÃ¤ndig im Browser geprÃ¼ft. Bestehende Mock-Tests sind kein Layout- oder Live-Sync-Nachweis.
- Selvir hat die Ãœbersicht bestÃ¤tigt und Training als nÃ¤chsten Abschnitt beauftragt. Essen bleibt als spÃ¤terer Abschnitt geplant.

### Konto-Vorschau 36 â€” 24.10.2026

- BestÃ¤tigter Plan in `docs/DESIGN-WORKPLAN.md`; persÃ¶nliche iPhone-Nutzung ersetzt einen geplanten Ausbau fÃ¼r Freunde.
- Lokal umgesetzt in `account-refresh.js` und `account-refresh.css`: kompakte IdentitÃ¤t, Ziel und Gewicht/Wochenmittel; MenÃ¼zeilen zu vorhandenen Detailbereichen, ZurÃ¼ck mit Fokus/Scrollposition, kurze Animationen und Reduced-Motion-Regeln. Keine neuen persistierten Datenfelder oder BackendÃ¤nderungen.
- Originaldesign zuerst verfeinert; alle zehn Designs behalten dieselben KontoablÃ¤ufe. Bestehende Formulare, Sicherungen und Kontoverwaltung bleiben erreichbar. Tutorial an Unterseiten angepasst.
- Lokale Versionsvorbereitung 36: Anzeige, Asset-Queries, package.json und SW-Cache samt neuen Offline-Dateien. Noch nicht verÃ¶ffentlicht und kein Release-Commit; live bleibt der zuvor verÃ¶ffentlichte Stand 35.
- PrÃ¼fung: `node scripts/check.cjs` und `git diff --check` bestanden. UnabhÃ¤ngiges Review ohne offene belegte Funktionsbefunde nach Korrektur der Wochenbeschriftung; Mittelwert, Leerwerte und Ausschluss zukÃ¼nftiger Gewichte zusÃ¤tzlich mit lokalen Fixtures geprÃ¼ft.
- Echte BrowserprÃ¼fung bei 390 Ã— 844 mit `?erststart=1` und kÃ¼nstlichem Profil: alle neun in der Vorschau verfÃ¼gbaren MenÃ¼bereiche, Planformular, Gewicht speichern/Aktualisierung, ZurÃ¼ck-Fokus, Designwechsel Ã¼ber alle zehn Varianten ohne horizontalen Ãœberlauf, Sprachwechsel DE/EN und Tutorialdurchlauf. Gefundene globale CSS-Konflikte korrigiert. Keine Konsolenfehler im geprÃ¼ften Ablauf.
- Grenzen: VM-Suite deckt die neue DOM-Navigation nicht vollstÃ¤ndig ab. Kein reales iPhone/Safari, keine echte Supabase-Anmeldung/RLS und kein Offline-SW-Lauf geprÃ¼ft; Sync ist in der Erststart-Vorschau absichtlich ausgeblendet. Reduced Motion implementiert und im Code geprÃ¼ft, nicht mit aktivierter Betriebssystemoption getestet.
- Selvir hat die Konto-Vorschau positiv beurteilt und anschlieÃŸend die Ãœbersicht beauftragt. VerÃ¶ffentlichung weiterhin offen.

Hier knapp ergÃ¤nzen: Auftrag, geÃ¤nderte Bereiche, Ergebnis der PrÃ¼fungen, Integrations-/Release-Commit, noch offene Befunde. Historische Release-Dokumente nicht als aktuellen Arbeitsauftrag fortschreiben. Private Daten gehÃ¶ren nicht in diese Datei.
