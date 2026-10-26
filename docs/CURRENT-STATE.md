# PULS — aktueller Stand und Übergabe

### Gesamt-Audit 26.10.2026 — veröffentlicht als Version 70

- Branch `refactor/comprehensive-app-audit` ab Tag `audit-baseline-v69`, auf Selvirs Freigabe per Fast-forward nach `main` übernommen und als v70 veröffentlicht.
- Sync/Speicher gehärtet (`js/cloud.js`, `js/app.js`): Beschädigungs-Sicherung, dauerhafte Upload-Sperre, Recovery-Arbeitskopie `puls-v1-recovered`, Rotation, 4-MB-Grenze, Konfliktkopien. Nur Mock-Tests, keine Live-RLS.
- UI: Onboarding wählt „Berechnet“ vor, ruhige Live-Eingabe, entprelltes Speichern, Singular/Plural, Dezimalkomma; „Text & Sprache“ aus Plus-Menü entfernt. Offen: UI-5, UI-6, UI-7 (Rest), UI-11/12.
- `js/visuals.js` und `css/visuals.css` entfernt; `designs-extra.js` bleibt (alte Designschlüssel in `validData`).
- Letzter `node scripts/check.cjs`: Exit 0 auf `b2ae598`. Codex-Abschlussreview und Nachprüfung: Merge-Empfehlung ja. Gemini nicht beteiligt.
- Nicht getestet: echtes iPhone, Live-Supabase/RLS, echter Offline-SW, GPS, Kamera. iPhone-Checkliste aus dem Abschlussbericht steht noch aus.
- Details und iPhone-Checkliste: `docs/audit/FINAL-REPORT.md`.
### Konto, Speichern und Navy-KFA, lokal vorbereitet (26.10.2026)

- Koordinator-Auftrag an Codex auf Basis `2c8fdae`; vorhandene ungestagte Änderungen erhalten. Kein Commit, Push, Versionswechsel oder Live-Backend-Eingriff.
- Online-Sync-Hinweis aus `js/design-system.js` entfernt. Offline-Zeile bleibt als fest positionierter Status über der Tab-Leiste ohne Layoutverschiebung. Weitere automatische „Wird synchronisiert“-Toasts beim Einstellungsspeichern wurden nicht gefunden; bestehende Schutzmeldungen beim Abmelden/Zurücksetzen bleiben.
- Profil- und Messformular verwenden deckende Speichernleisten mit Haarlinie, Safe Area und Abstand. Der Profil-Scroller wird gesondert berücksichtigt. Doppelte Überschrift im Körper-Unterbereich entfernt.
- „Konto verwalten“ verwendet gruppierte Zeilen für Anmeldung/Sync, Daten und Gerät sowie eine einzelne rote Löschaktion am Ende. Vorhandene Handler, Konflikt-ID, Importprüfung, Reset- und Passwort-/Löschbestätigungen bleiben maßgeblich. Keine Änderungen an Cloud-Logik oder gemeinsamem Zustand.
- Navy-KFA ausschließlich für Männer aus Größe, Hals und Taille; keine Hüftabhängigkeit. Alte `sex`-Felder und manuelle KFA bleiben gültig. Körpermaß-CSV ergänzt `neck_cm` am Ende, fehlende Werte bleiben leer. DE/EN-Texte ergänzt.
- Gesamtsuite und gezielte Navy-/CSV-/Konto-/Sync-VM-Tests grün, `git diff --check` sauber. Kein Browser verfügbar (Inventar leer, In-App-Browser nicht verfügbar), daher 390 × 844 Hell/Dunkel und echte iPhone-Safe-Areas ungeprüft. Integrierte visuelle Prüfung und Release-Versionierung beim Koordinator.
- Gezieltes unabhängiges Review: fehlenden Gerätesymbol-Schlüssel durch registriertes `database` ersetzt und nachgeprüft; keine weiteren belegten Befunde im geprüften Umfang.

### App-Icons Hell/Dunkel, lokal vorbereitet (26.10.2026)

- Nur zwei Varianten: blauer Pulsstrich auf #F2F2F7 bzw. #1C1C1E, ohne Effekte oder eigene PNG-Rundung. SVG, RGB-PNG 180/512, Manifestvarianten; Standard Dunkel. Reproduzierbar ohne npm mit `node scripts/generate-app-icons.cjs` (erzeugt auch natives PNG 1024).
- Alte sechs `iconColor`-Werte bleiben in Profil und Sicherungen gültig und unverändert; Anzeige liest sie als Dunkel. URL-Auswahl speichert beim Start nicht mehr. Erst explizite Icon-Wahl schreibt ins vorhandene Feld. Ohne Wahl folgt das Web-Icon dem lokalen Farbschema einschließlich Systemwechsel; Browser-/Touch-Icon und Manifest werden gemeinsam gesetzt.
- iOS-Workflow/Asset verwenden fest Dunkel; alternative native Icons entfernt, alte Bridge-Nachrichten wirkungslos. Neue IPA erforderlich. Bestehende Home-Bildschirm-Web-Icons lassen sich nicht zuverlässig dynamisch ändern; Installationsseite verwendet die explizite Variante.
- Prüfung: Gesamtsuite und gezielte neue Icon-Tests grün; PNGs visuell und auf Größe/Opazität geprüft. Keine schmale Browserprüfung möglich: keine verbundenen Browser, In-App-Browser nicht verfügbar. Kein echter iPhone-/Xcode-Build-Test. Unabhängiges Review durch Koordinator ausstehend.
- Keine Versionsänderung, kein Commit/Push. Gemeinsame ungestagte Fremdänderungen erhalten; Koordinator integriert und erhöht die Release-Version gesammelt.


Aktualisiert: 24.10.2026. Maßgeblicher Code: dieses Repository. Git-Historie und aktuelle CI zusätzlich prüfen.

## Stand bei Einrichtung der Zusammenarbeit

- Veröffentlichte App-Version: **64** (25.10.2026: Aktivitäten-Paket — Katalog mit MMA/Padel, Live-Werte je Art, Vollbild-Karte mit hochziehbarer Wertekarte, Sperre, Runde, MMA-Runden-Timer, Wanderwege-Ebene (Waymarked Trails), Kalorien-Baseline-Modus, Gym-kcal, Dauer-XP, Wochenziel aktive Minuten, Bereich „Aktivitäten“ im Fortschritt; Reviews: Claude-Prüfer 4 Befunde Daten, Codex 3 Befunde UI, alle behoben und nachgeprüft). Davor 63 mit iOS-App 1.6 (25.10.2026: Aktivitäten im Vollbild mit Countdown, Live-Werten und Zusammenfassung; Codex-Review 7 Befunde behoben). Davor 62 mit iOS 1.5 (Laufen mit GPS, Karte, Routenplaner, Live-Aktivität; siehe Übergabe unten). Davor 58–61 kleine Korrekturen, davor 57 (25.10.2026: keine Linie unter der letzten Routine im Workout- und Routinen-Tab, `css/training-polish.css`). Davor 56 (25.10.2026: „Tag als vollständig markieren“ als Knopf in voller Breite mit fester Höhe, springt nicht mehr; Makro-Boxen auf der Essen-Seite gleich hoch; kein Kasten um das Fenster-X; Training: Tabs näher an der oberen Leiste, Standardpause mit 14 px oben/unten). Davor 55 (25.10.2026: Barcode-Scanner mit Blitz-Knopf in `js/food-flow.js`, nur wenn die Kamera `torch` meldet, Umschalten per `applyConstraints`; Review Codex: 1 Befund behoben). Davor 54 (25.10.2026: „Heute gegessen“ ohne Innen-Scroll, übrige kcal nur als Zahl — Essen rechts in der kcal-Zeile, Übersicht unter dem Ring, über dem Ziel „+X kcal“ in Warnfarbe; `js/app-polish.js`/`css/app-polish.css`). Davor 53 (25.10.2026: nur noch Original-Design — `state.appDesign` wird bei jedem Render auf `classic` gesetzt, Designauswahl ausgeblendet; Konto: „Konto verwalten“ bündelt Anmeldung/Sync, Sicherung und Löschen, kein „Dein Bereich“; Essen-Abläufe neu in `js/food-flow.js`/`css/food-flow.css` (Suche mit automatischer Open-Food-Facts-Suche ab 3 Zeichen, Portion, Barcode, Rezepte, eigene Werte, Foto; Claude-Frontend-Agent); Muskelgruppen eigener Übungen werden in `js/exercise-muscles.js` aus dem Namen abgeleitet, nicht gespeichert (Codex), „Diese Woche · Sätze pro Muskelgruppe“; `js/training-polish.js`: eigene Übung direkt in der Übungssuche, Kalender öffnet Auswertung, grünes „Läuft“, Standardpause als Pille; `js/app-polish.js`: Plus-Menü-Animation, X schließt animiert, Essen-Seite mit eigener Makro-Optik, Wasser von ml-Getränken ohne Wasserwert geschätzt (nur Anzeige), Scroll bleibt bei „Tag vollständig“, ohne 01/02-Nummerierung außer Konto, ohne Seitenleisten-Fuß, ohne „Nährstoffwerte & Ziele im Detail“; Suche bestraft Gerichte auch als Wortteil; auf Selvirs Auftrag iOS-App 1.4 mit echter Haptik (`haptic`-Nachricht, Feature `haptics`); Reviews: Claude-Prüfer 3+1 Befunde (Muskelgruppen), Codex 3 Befunde, alle behoben und nachgeprüft. Bekannt: Open-Food-Facts-Suche `cgi/search.pl` antwortet zeitweise mit 503 ohne CORS). Davor 52 (25.10.2026: Essenssuche mit Relevanz statt Startswith-Bonus — gleiche Regel in `js/catalog-worker.js` und `js/food-upgrade.js` (foodRelevance), nur am deutschen Namen, Grundzutaten/roh vor Gerichten, Gebäck und Innereien, neue Aliase z. B. Geschnetzeltes → Brustfilet, ODER-Ersatzsuche; Sicherung im Profil-Fenster kompakt; `js/haptics.js` Vibration bei Satz, Speichern, Start/Ende, Pause und Auswahl — native iOS-Haptik vorbereitet über `pulsNativeFeatures` 'haptics', `ios/` dafür nicht geändert; Review Codex: 3 Befunde behoben). Davor 51 (25.10.2026: Barcode auch senkrecht — eigener Zusatz-Scan des um 90° gedrehten Videobilds in `js/products.js`, da ZXings TRY_HARDER-Drehung in 0.2.1 fehlerhaft ist; auf Selvirs ausdrücklichen Auftrag iOS-App 1.3: Live-Aktivität/Dynamic Island zeigt ohne Pause die Workout-Zeit, nach Pausenende automatisch per staleDate, `native-bridge.js` sendet `workoutActive` nur bei `window.pulsNativeFeatures` mit `workoutTimer`, ältere App bleibt beim alten Verhalten; Review Codex: 1 Befund behoben und nachgeprüft). Davor 50 (25.10.2026: Konto — „Dein Design“ enthält Sprache und App-Icon direkt, Design-Kacheln schmal in drei Spalten, „Konto & Synchronisierung“ steckt in „Deine Daten“, `js/account-refresh.js`/`css/account-refresh.css`; Tab-Wechsel unten mit Wisch-Animation links/rechts, `js/page-slide.js`/`css/page-slide.css`; Review Codex: 1 Befund Fokus behoben und nachgeprüft). Davor 49 (25.10.2026: `js/workout-controls.js`/`css/workout-controls.css` — Linien-Symbole statt Textzeichen ⌄ ⌃ × ✕ ‹ ›, knapperes Abschluss-Fenster mit Verwerfen-Warnung, −30 s und „Pausenzeit“ im laufenden Workout, Scroll-Rad für die Standardpause, zentriertes Datumsfeld; Review Claude-Prüfer: 4 Befunde behoben). Davor 48 (25.10.2026: Pop-up „Pause vorbei“ mit OK und Animation, `js/rest-popup.js`/`css/rest-popup.css`, eigener `<dialog>` über offenen Fenstern, Vormerken bei Pausenende im Hintergrund bis 10 min; Review Claude-Prüfer: 5 Befunde behoben und nachgeprüft). Davor 47 (25.10.2026, auf Selvirs ausdrücklichen iOS-Auftrag: iOS-App 1.2 mit echtem App-Icon-Wechsel und neu gestalteter Dynamic Island/Live-Aktivität; `js/native-bridge.js` sendet `setAppIcon`; Review Claude-Prüfer, da Codex und Gemini im Limit). Davor 46 (25.10.2026: Repository aufgeräumt — Skripte in `js/`, Styles in `css/`, alte Doku in `docs/archive/`, `archive/` entfernt, neue README; `sw.js` aktiviert neue Versionen sofort per `skipWaiting()` nach vollständigem Precache; Review Codex: Offline-Lücke beim Update behoben). Davor 45 (25.10.2026: Training — Workout-Tab als Startseite mit kompakten Routinenzeilen, „Heute erledigt“ abgesetzt, Routinen-Tab bleibt Verwaltung, Kalender ohne doppelte Linie; `training-tabs.js`/`.css`, alle Designs, Review Codex: EN-Befund behoben). Davor 44 (Profil-Schalter Richtung/Tempo untereinander), 43 (Profil & Ziele überarbeitet, Logikfehler behoben), 42 (Abstand zwischen den Wischseiten), 41 (Essen im neuen Originaldesign), 40 (optionaler Erststart, Tutorial entfernt, klebender Pausentimer, ruhigere Satzzeilen), 39 (`native-bridge.js` für Pausen-Mitteilung und Dynamic Island; von Selvir auf iPhone und iPad bestätigt) und 38 (Commit `0c62ef6`: Konto 36, Übersicht 37, Training 38 im neuen Originaldesign).
- Live: https://selvirtnj.github.io/puls/?v=71 ; Repository: https://github.com/selvirtnj/puls .
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

**Seit 25.10.2026 gilt das Apple-Redesign nach `docs/DESIGN-SYSTEM.md` (ersetzt das lila Original und alle 11 Designs).** Schritt 1 (Version 65) und Schritt 2 (Version 66, alle übrigen Bildschirme) sind live. Nächstes: Selvirs iPhone-Rückmeldung abwarten. Der folgende Absatz ist historisch.

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

### Lokal vorbereitet: integrierte OFF-Suche und Navy-KFA, 26.10.2026

- Koordinator-Auftrag an Codex auf Basis `2c8fdae` (68), ohne Commit, Veröffentlichung oder Versionsänderung. Parallel bearbeitete Trainings-/Laufdateien und `CLAUDE.md` wurden von Codex nicht verändert.
- Letzte Suchdefinition in `js/food-flow.js`: gespeicherte Treffer sofort, Katalog asynchron, OFF ab drei Zeichen nach 450 ms nur online. Abbruch bei neuer Eingabe, Tabwechsel und Schließen; alte Antworten werden verworfen. Bestehende Feldauswahl, `app_name=PULS` und Sitzungscache bleiben. Nach Review zehn tatsächlich gestartete Netzabfragen pro Minute: vor Versand abgebrochene Vorgänge zählen nicht, gesendete und danach abgebrochene zählen weiter. Bei Grenze dezenter Hinweis und automatische Wiederaufnahme des aktuellen Begriffs nach Fensterablauf. Timeout mit kurzem Hinweis, keine Fehlerwiederholungen. Enter, erneutes Anzeigen derselben Suche und Katalog-Nachladen duplizieren laufende Anfragen nicht; ausgewählte Sammlungen ohne Suchbegriff bleiben erhalten. OFF unter lokalen Treffern, Dubletten nach Barcode oder normalisiertem Namen plus Marke entfernt. Kein separater Suchknopf und kein Text-/Sprache-Chip. Übernahme weiter über `chooseOnlineFood` und Produktprüfung, keine erfundenen Werte.
- `js/profile-refresh.js`: optionales Halsmaß ergänzt die bestehende Messfeldregistrierung; `validData()` prüft damit auch Halswerte, alte Sicherungen ohne Hals bleiben gültig. US-Navy-KFA verwendet cm nach Inch-Umrechnung und vollständige Maße eines Tages, Formel unterstützt Frauen zusätzlich mit Hüfte; im Produkt gilt weiter das persönliche männliche Profil. Kein Zusammenmischen verschiedener Messtage, keine Zukunftswerte. Nach Review gewinnt der neuere manuelle oder geschätzte KFA, bei gleichem Datum der manuelle Wert. Anzeige in der Maß-Eingabe und im aktuellen Körperbereich mit Datum und Schätzkennzeichnung, keine Speicherung als Messung. Historische BMI-/Deurenberg-Kurven und Kalorienplanung unverändert; kein bestehender Magermasse-/Katch-McArdle-Verbraucher gefunden. Die Änderung an `js/experience.js` wurde auf Koordinatorentscheidung vollständig zurückgenommen: Laden und Formular normalisieren wie bisher auf männlich, kein neuer Start-Speichervorgang. Englische Hals-/KFA-/Hinweistexte einschließlich Suchfehler und Timeout ergänzt. CSV ausdrücklich nicht Teil dieser Nacharbeit.
- Prüfung: `C:\Program Files\nodejs\node.exe scripts/check.cjs` grün, einschließlich neuer Mock-fetch-Suchtests, Navy-Formel/Grenzfälle, Hals-Validierung und alter Sicherungen. Browserinventar des Computer-Use-Werkzeugs meldet keine verfügbaren Browser; daher kein 390×844-Layouttest, kein echtes iPhone und keine Live-OFF-/RLS-Prüfung. Unabhängiges Review, integrierte Browserprüfung und spätere Release-Versionierung liegen beim Claude-Koordinator.

### Lokaler Koordinator-Auftrag: native Live-Aktivitäten und Scanner, 26.10.2026

- Codex auf Basis `6a7c055`, noch nicht committet/veröffentlicht; Web-Version unverändert. Native Zielversion 1.7 (`ios/project.yml`), neue IPA nach macOS-Build und AltStore-Installation erforderlich.
- Live-Aktivitäten: Systemschrift, dynamisches Apple-Blau/Systemflächen, SF Symbols, keine pulsierenden/rollenden Effekte und keine Emojis in km-Mitteilungen. Mitteilungen selbst zeichnet iOS im Systemstil.
- Fehlerursache „Pausiert“: eingefrorener Endstand wurde über dasselbe Feld wie eine Pause dargestellt und vier Minuten behalten. Expliziter optionaler Endzustand, sofortiges `Activity.end` mit finalem Content, geordnete native Updates/Enden mit kurzem Hintergrundbudget. Workout-Abgleich synchron bei `save`/`render`, Start und Seitenwechsel. Lauf endet bereits an der Zusammenfassung; lokaler Endmarker verhindert Wiedereröffnung durch Takte/Neuladen, „Weiter“ aktiviert erneut. Keine neuen synchronisierten Profilfelder, Strecke bleibt bis Speichern/Verwerfen erhalten. Verspätete Mitteilungsfreigabe kann eine abgebrochene Pause nicht erneut planen.
- Scanner `js/products.js`: Zusatzbilder abwechselnd 90° und 270° (Review-Korrektur, 180° bringt bei 1D nichts), voller Bildbereich, höchstens 960 px und ein Versuch je 400 ms, ausgesetzt im Hintergrund. Der sichtbare Rahmen liegt in den parallel belegten Dateien `js/food-flow.js`/`css/food-flow.css` und ist dem Claude-Koordinator zur Änderung übergeben.
- Prüfung: `C:\Program Files\nodejs\node.exe scripts/check.cjs` grün einschließlich neuer Bridge-/Scanner- und Laufabschluss-Regressionen mit Fixtures. Unabhängiger Codex-Prüfer: Vorschau-Endmarker-Befund behoben und nachgeprüft, keine offenen belegten Befunde. Kein Swift-Build unter Windows, kein echtes ActivityKit-/Sperrbildschirm-/Kamera-/iPhone-Layout-Testergebnis. Abschließendes integriertes Review und Gerätetest beim Koordinator.

### Version 71: Plus-Knopf in der Tab-Reihe — 26.10.2026

- Untere Leiste (≤ 760 px): Plus-/Hinzufügen-Knopf sitzt auf derselben Höhe wie die übrigen Tabs (`css/design-system.css`; `polish.css` hatte Padding/Gap auf 0 gesetzt). Browser-Messung 390×844 und 320×568: Symbolmitte aller fünf Knöpfe gleich. Bekannt, unverändert: Plus dreht sich beim Öffnen nicht zum ×.

### Version 70: Gesamt-Audit — 26.10.2026

- Sync-/Speicher-Härtung, UI-Korrekturen aus dem Audit, `visuals.js`/`visuals.css` entfernt, README neu. Details: Abschnitt „Gesamt-Audit“ oben und `docs/audit/FINAL-REPORT.md`.

### Version 69: Training, Datum, Icons, Konto — 26.10.2026

- Sonnet: Übungssuche feste Höhe, Satzspalten mittig, Pausen-Stepper, Kalender-Rückblick nur Seite 1 (`reviewWorkout`), Segmentleiste unter Safe Area, Fortschritt ohne e1RM/Gruppen, Aktivitäts-Endscreen mit XP (`activityDoneShow`); Datum rechts neben dem Large Title (`dsDateBar`), Tab-Leiste 54 px, Datumsfelder linksbündig.
- Codex: OFF in der normalen Suche (10 Anfragen/min, Wiederaufnahme), „Text & Sprache“ entfernt, KFA nach US-Navy nur männlich (Hals, neuere Messung gewinnt), Profil bleibt männlich; App-Icons nur `light`/`dark` (alte Werte → dark, iOS festes dunkles Icon); Konto verwalten neu, deckende Speichern-Leisten, „Wird synchronisiert“ entfernt, Offline-Hinweis fixed, CSV mit Hals.
- Prüfung: Claude-Reviewer (OFF/KFA), Claude-Sonnet-Reviewer (Rest; Codex/Gemini im Limit). Offen, niedrig: `js/personal.js:11` „Auswertung ansehen“ zeigt noch alle Abschlussseiten.

### Version 68 / iOS-App 1.7 (lokal vorbereitet): iPhone-Rückmeldung — 26.10.2026

- Claude (Sonnet) UI: Konto-Listen (alte `nav{display:grid}`-Regel traf `.dsgroup`), gruppierte Ergebnislisten, Lupe-Einzug, Chips ohne Stern, Foto-Bereich „Foto aufnehmen“/„Aus Fotos wählen“, Einheiten-Segment, Datumsfelder, Dezimalfelder mit Komma (`type=text inputmode=decimal`, strenges Muster, `dsRecheckDecimals`), Zeitraum-Abstand, Wisch-Löschen auf der Übersicht, Startbildschirm 1,2 s, quadratischer Scanrahmen.
- Claude (Sonnet) Workout: Verwerfen in der Titelzeile, Drei-Punkte-Aktionsfenster (Supersatz, Verschieben, Entfernen), langes Drücken 500 ms, kg-Satzfeld mit Komma.
- Codex: siehe Abschnitt „native Live-Aktivitäten und Scanner“ unten; Review-Korrekturen: nur aktive Activities aktualisieren, Feature `runActivityEndState` für App-1.6-Verträglichkeit, Bridge-Ausnahmen abgefangen.
- Prüfung: Claude-Reviewer (iOS), Codex-Reviewer (Web), alle Befunde behoben; `check.cjs` grün. Kein Swift-Build, kein echtes iPhone.

### Version 67: Kurzreview nach Redesign — 26.10.2026

- Codex (5-Minuten-Fehlersuche): Suchchips und Diagrammschalter auf 44 px Mindesthöhe; Makrobalken mit gültigen ARIA-Werten und `aria-valuetext`, auch ohne Ziel. Claude `puls-frontend`: Platzhalterkontrast hell/dunkel auf mindestens 4,5:1.
- Prüfung: `check.cjs` grün, Diff vom Koordinator gesehen. Kein Browser-/iPhone-Test dieser Kleinigkeiten.

### Version 66: Apple-Redesign Schritt 2 — 26.10.2026

- Claude `puls-frontend`: Essen (Segmentsteuerung, Makrobalken in Akzent, Aktionsliste, Wasserzeile), Hinzufügen-Fenster als Aktionsliste, Training (Segmentsteuerung, ruhiger Kopf, Workout-Karten), Laufen (Phosphor je Aktivität), Konto als iOS-Einstellungsliste mit Chevron, einheitliche Sheets, gestaltete Dateiknöpfe, Select-Chevron, Startbildschirm nur „PULS“ (max. 0,6 s). Emojis im Quellcode durch `pulsIcon`/`uiIcon` (`js/app.js`) ersetzt, DOM-Emoji-Ersatz entfernt. `css/food-refresh.css`, `overview-refresh.css`, `training-refresh.css`, `account-refresh.css` neu und schlank.
- Entscheidung Koordinator: gefüllte Knöpfe `#0071E3` (weiße Schrift 4,7:1) statt `#007AFF` (4,0:1); Akzenttext über `--ds-accent-text`.
- Prüfung: Codex-Review (1 Kontrastbefund, behoben), `check.cjs` grün, Browser 390 px hell/dunkel durch den Frontend-Agenten. Kein echtes iPhone, kein VoiceOver, keine echte Safari-Dateiauswahl.
- Bekannte Grenzen: Segmentknöpfe 44 px hoch, Tab-Beschriftung 10 px, Diagrammfarben zur Laufzeit als Hex (`dsSeriesColors`), einige abgeschaltete Altfunktionen enthalten noch Zeichen wie ＋/→ (nicht sichtbar).

### Version 65: Apple-Redesign Schritt 1, Offline, Passwort anzeigen — 25.10.2026

- Regeln: `docs/DESIGN-SYSTEM.md` (Verbotsliste, Farben, Schrift, Radien, Phosphor-Icons). Skill `apple-design` und `swiftui-expert` liegen lokal unter `~/.claude/skills/` (nicht im Repo, Lizenz der HIG-Texte).
- Daten (Codex): Farbschema ist Geräteeinstellung in `localStorage['puls-color-scheme']` (`js/color-scheme.js`: `getColorScheme`, `setColorScheme`, `applyColorScheme`, `data-scheme` auf `<html>`), nicht synchronisiert, beim Start keine State-Änderung (sonst Sync-Konflikt auf Zweitgerät). Alte Felder `appDesign`/`colorTheme` bleiben wirkungslos erhalten; `js/designs-extra.js` bleibt wegen `validData`. `js/connectivity.js`: `window.pulsConnectivity` + Event `puls:connectivity`. `sw.js`: Katalog (5,5 MB) im eigenen Cache `puls-catalog-v1`, nur bei Katalogänderung erhöhen.
- UI (Claude `puls-frontend`): `css/design-system.css` als letzte Schicht, `js/icons.js` (Phosphor, MIT), `js/design-system.js` als letztes Skript (Tab-Leiste, neue Übersicht, Passwort-Knopf für alle Passwortfelder in Fenstern, Offline-Hinweis, Darstellung System/Hell/Dunkel). Alle CSS-Dateien mechanisch bereinigt (Schatten, Verläufe, Blur, Hover, Animationen weg; classic-Regeln als Basis übernommen, andere Designs entfernt). `css/designs-extra.css` gelöscht.
- Prüfung: Claude-Reviewer (Daten, 2 Runden), Codex-Reviewer (UI, 2 Runden), alle Befunde behoben; `check.cjs` grün; Browser 390×844 hell/dunkel durch den Frontend-Agenten. Kein echter iPhone-Test, kein echter Safari-SW-Test.
- Schritt 2 offen: Essen (Makrokacheln, Wasser, Vorschläge), Hinzufügen-Fenster (Kachelraster), Training-Kopf, Konto (Nummern, Wortmarke, Pfeile), etwa 40 Emoji/Unicode-Stellen in JS, Pastell-Inline-Farben, Selects ohne Pfeil, Laufen-Bildschirm, Typo-Stufen in Altbildschirmen.

### Version 64: Aktivitäten-Paket — 25.10.2026

- UI-Teil (Claude): neue Datei `js/activity-overview.js` (Bereich „Aktivitäten“ im Fortschritt, Darstellungs-Wrapper für `baselineEnergyLine`); `js/run-session.js` (Live-Ansicht je Art, hochziehbare Wertekarte, Leiste Sperre · Pause · Beenden mit Doppeltipp, Sperre inert + 1 s Halten, Runde als Pille, MMA-Rundenbox mit Ton/Haptik, Runden in der Zusammenfassung); `js/run-map.js` (Wanderwege-Ebene, Zustand pro Gerät in localStorage `puls-map-trails`); `js/running.js` (Wochenzeile aktive Minuten, Zielformular); `js/profile-refresh.js` (Schalter Kalorienberechnung/Alltagsfaktor).
- Grenzen: kein echter iPhone-Test (Touch-Drag, 1-s-Halten, GPS). MMA-Signale nicht bei gesperrtem iPhone/Hintergrund, Ton still bei Stummschalter. Wanderwege-Kacheln nur online, externer kostenloser Dienst. Kalibrierung im Baseline-Modus aus. Übergang: Geräte mit alter Version im Cache rechnen das Ziel klassisch, bis aktualisiert.
- Später, eigene Pakete: Uhr-Anbindung, Routensuche à la Komoot.
- Review-Nacharbeit im inzwischen integrierten UI-Stand: Baseline-Ziele warten beim Start auf die vollständig geladene Aktivitätslogik; kein vorübergehender Speicherstand ohne Sport. Aufteilungszeile nur für tatsächlich berechnete Baseline-Ziele, übrige Zielanzeigen und Essensvorschläge auf das gewählte Tagesziel umgestellt. Claudes Darstellung bleibt erhalten. MMA-Weiterschaltmarken sind mit den bisherigen Laps-Regeln vereinbar und zusätzlich getestet; siehe `ACTIVITY-DATA.md`.

- Koordinator-Auftrag von Claude Code, Basis `54e0725`; keine Veröffentlichung/Versionsänderung, kein Live-Backend und keine Änderung an `ios/`.- Neue MMA-/Padel-Katalogeinträge mit Compendium-Näherungen, Picker-Flag, sicherer Fallback unbekannter Typen sowie Erhalt alter/ausgeblendeter Typen beim Bearbeiten. Optionale Uhr-/Puls-/Lap-/MMA-Rundenfelder und Minuten-Wochenziel werden verlustfrei validiert.
- Brutto-Gym-Schätzung nach Zeit/MET/Gewicht, Netto-Sportbedarf einschließlich Gym, Baseline-Modus mit Tages-Sportzulage nach dem Zu-/Abschlag (auch Extrem); klassische/manuelle Ziele erhalten. Verlaufskalibrierung im Baseline-Modus ausdrücklich deaktiviert. Neue Sessions erhalten Dauer-XP mit gemeinsamem Tageslimit 100, zusätzlich zu bisherigen PR-XP; alte Einträge werden nicht nachträglich markiert.
- Wochen-/Monatsaggregation nach Art einschließlich Gym und Recap ergänzt. Ausführliche Datenformate, globale Schnittstellen, Rechengrenzen und Integrationsschritte: [ACTIVITY-DATA.md](ACTIVITY-DATA.md).
- Prüfung: gezielte Daten-/Metrik-/Planner-/Regressionstests und `node scripts/check.cjs` lokal grün. Echter iPhone-Test steht aus (siehe Grenzen oben). Mock-Tests sind kein Live-RLS-Nachweis.

### Version 63 / iOS-App 1.6: Aktivitäten im Vollbild — 25.10.2026

- Selvirs Wunsch nach Vergleich mit adidas Running/Strava: Plus → „Aktivität“ öffnet direkt eine eigene Vollbild-Ansicht (`js/run-session.js`, wie das laufende Workout) mit Karte, links Aktivitätsart (Laufen, Trailrun, Spazieren, Wandern, Berggehen, Radfahren, Tischtennis, Fußball, Inlineskaten, Sonstiges), mittig Start, rechts Route. Countdown 10 s mit „+10 Sekunden“ und „Jetzt starten“. Live: Dauer, Distanz, Kalorien (geschätzt), Ø Pace, Karte, Pause; pausiert Beenden/Weiter. Zusammenfassung: Gefühl (5 Stufen), Untergrund, Notiz, Ø/Max-Geschwindigkeit, Höhenmeter, max. Höhe, Pause, km-Zeiten; Weiter/Speichern/Verwerfen. „Nur Timer“ und „Lauf eintragen“ entfernt; alte Einträge bleiben sichtbar und lassen sich bearbeiten (Art, Gefühl, Untergrund, Notiz) oder löschen.
- Codex (backend): `js/run-metrics.js` mit Aktivitätskatalog, Kalorien nach Compendium of Physical Activities (Brutto, MET × kg × h, Laufen/Gehen tempoabhängig, letztes Gewicht nötig), Höhe (geglättet, Hysterese), Max-Geschwindigkeit (20-s-Fenster); `tests/check-run-metrics.cjs`. GPS-Punkte jetzt `[t,lat,lon,acc,seg,alt,altAcc]` (altAcc −1 = unbekannt, alte 5er-Punkte gültig).
- Neue optionale Felder an `state.runs[]`: `type`, `startedAt`, `pauseSeconds`, `kcal`, `feeling`, `terrain`, `elevationGain`, `elevationMax`, `maxSpeed`; `distanceKm` darf 0 sein (Tischtennis). `activeRun.type`, `runSettings.lastType`. Wochenziel, Bestzeiten und XP nur für Laufen/Trailrun; alle Aktivitäten zählen für die Serie.
- iOS 1.6: Höhe in `RunTracker`, Standort vor dem Start (`runLocate` → `pulsRunLocateReceive`), Live-Aktivität mit Aktivitätsname.
- Grenzen: Kalorien sind Schätzungen; Höhe aus GPS ist ungenau (Barometer nicht genutzt). Gerätetest (GPS, Hintergrund, Live-Aktivität) nur auf dem iPhone möglich.

### Version 62 / iOS-App 1.5: Laufen — 25.10.2026

- Auf Selvirs Wunsch (Vorbild Strava/adidas Running, iOS-Änderungen ausdrücklich erlaubt): `js/running.js`, `js/run-map.js`, `css/running.css`, Leaflet 1.9.4 lokal in `js/vendor/`/`css/vendor/` (nur beim Öffnen einer Karte geladen). Läufe eintragen, Timer oder Lauf mit GPS, Live-Karte, Detailansicht (Karte, km-Zeiten, Ø Pace, Ø km/h), Bestzeiten 1/5/10/21 km, Wochenziel in km, Routenplaner über BRouter (kostenlos, Profil Wandern) mit gespeicherten Routen und „Mit dieser Route laufen“. Anzeige im Workout-Tab, Kalender, Fortschritt, Übersicht und Plus-Menü. Läufe halten Tages-/Wochenserie, 25 XP bei Bestleistung ab 1 km.
- Daten (alle optional, `validData()` geprüft, alte Sicherungen gültig): `state.runs[]` (`distanceKm`, `durationSeconds`, `note`, `source:'gps'`, `route` ≤ 300 Punkte, `splits`, `splitRest`), `state.activeRun`, `state.runSettings.weeklyGoalKm`, `state.runRoutes[]`. GPS-Rohpunkte nur lokal (`puls-run-track`, Gerätezuordnung `puls-run-device`), nicht synchronisiert; nur das startende Gerät misst.
- iOS 1.5: `RunTracker.swift` (Hintergrund-GPS, `UIBackgroundModes: location`), `RunActivityCoordinator.swift` + `RunActivityWidget.swift` (Live-Aktivität/Dynamic Island, animierte Zahlen, Mitteilung je km), Kennzeichen `runGps`/`runActivity`. Details in `docs/IOS-APP.md`.
- Kartenkacheln: OpenStreetMap mit CSS-Dunkelfilter; CARTO-Dunkelkacheln verlangen inzwischen einen Schlüssel.
- Prüfung: `tests/check-running.cjs` (Datenprüfung, XP, Serie, GPS-Filter, Splits, Strecke, Brücke), `node scripts/check.cjs` grün; Browser 390 × 844 mit simuliertem Standort (GPS-Lauf, Live-Karte, Detail, Planer mit echtem BRouter). Codex-Reviews in 4 Runden, 13 Befunde behoben (u. a. XSS über Lauf-ID, Datenverlust beim Abschluss, fremdes Gerät startet GPS, Rohpunkte nicht gelöscht, doppelte km-Mitteilung).
- Grenzen: Swift nur statisch geprüft, Kompilierung erst im CI; echtes GPS, Hintergrundbetrieb, Live-Aktivität und Mitteilungen nur auf dem iPhone prüfbar. Im Browser misst GPS nur bei offener App. OSM-Kacheln und BRouter brauchen Netz.

### Version 58–61: kleine Web-Korrekturen — live — 25.10.2026

- Koordinator-Auftrag von Claude Code, Basis `cf4725f`: drei kleine Korrekturen. `js/app-polish.js` berechnet den Kalorienüberschuss aus Tageswert/Ziel statt aus bereits übersetztem Text; dadurch bleibt `+X kcal` auch auf Englisch erhalten. `js/food-flow.js` verwirft alte Zutaten-Suchantworten schon bei der nächsten Eingabe und bindet verzögerte Suchen an den ursprünglichen Ergebnisbereich. Die Rezept-Löschbestätigung berücksichtigt Deutsch/Englisch.
- Neue `tests/check-small-polish.cjs`, im regulären Check eingebunden: beide Sprachen/Seiten, Überschuss/Rest/exaktes Ziel, Antworten während der Tipp-Pause, ersetzte Suchfenster, Löschabbruch und erhaltene Tagebucheinträge. Nach jeder der drei Korrekturen `node scripts/check.cjs` bestanden.
- Keine CSS-/Layout-, Datenmodell-, iOS- oder Backendänderung; kein Commit/Push. Version bleibt 57, Release-Versionierung übernimmt Claude. Nur synthetische VM-Fixtures; Browser-/390-px-/iPhone-Prüfung und integrierte Prüfung beim Koordinator offen.
- Runde 2, lokal auf Basis `0796122` (Version 58): zwei weitere kleine Korrekturen. Checkbox-Auswahlhaptik läuft erst beim hochgereichten `change`, damit die Satz-Haptik nicht vom vorherigen Klick gedrosselt wird (`js/haptics.js`). OCR übernimmt Kalorien mit Ungleichheitszeichen/negativem Vorzeichen nicht mehr als exakte positive Werte; Spaltenpositionen bleiben erhalten (`js/food-upgrade.js`). Beide Fehler zuerst mit roten Regressionen in `tests/check-small-polish.cjs` reproduziert; nach jeder Korrektur vollständiger Check bestanden. Keine Versionserhöhung, Veröffentlichung oder Backend-/iOS-Änderung; echte Gerätehaptik/Kamera und Browserlayout nicht geprüft.

- Runde 3, lokal auf Basis `319a692` (Version 59): zwei kleine Korrekturen. Der Workout-Abschlussdialog zählt Sätze und warnt vor offenen Sätzen anhand der exakt übergebenen Workout-ID statt einer Teiltextsuche im Formular-Handler (`js/workout-controls.js`); überlappende IDs aus Sicherungen liefern dadurch keine fremde Übersicht. Ein im Hintergrund vorgemerkter Pausenhinweis erscheint nach Zustandswechsel nur noch, wenn sein ursprüngliches Workout weiterhin vorhanden ist (`js/rest-popup.js`). Beide Fehler zuerst mit roten Regressionen in `tests/check-small-polish.cjs` reproduziert; DE/EN-Abschlusswarnungen sowie unverändertes/entferntes/ersetztes/beendetes Workout und neu gestartete Pause geprüft. Vollständiger Check nach jeder Korrektur bestanden. Keine Versionserhöhung, Veröffentlichung, Datenmodell-, Backend- oder iOS-Änderung; Browser-/Geräteprüfung offen.

- Runde 4 (letzte), lokal auf Basis `58ebda7` (Version 60): eine kleine Produktkorrektur in `js/products.js`. Nährwertfelder mit ausschließlich Leerraum bleiben unbekannt (`null`), statt durch `Number()` als bekannte Null zu erscheinen. Rote Regression in `tests/check-small-polish.cjs` zuerst reproduziert; nach Korrektur vollständiger Check bestanden. Prüft Leerzeichen/Tab/Zeilenumbruch/geschütztes Leerzeichen, echte Nullwerte/Zahlen und den bestehenden kJ-Fallback. Keine Versionserhöhung, Veröffentlichung, Datenmodell-, Backend- oder iOS-Änderung. Nur VM-Fixtures; reale Barcode-/Kameraprüfung nicht durchgeführt. Wegen knappem Kontingent bei diesem vollständig geprüften Befund abgeschlossen.

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
