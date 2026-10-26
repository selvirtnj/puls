# UI/UX-Audit im Browser (Audit Phase 2 + 4)

Stand: 26.10.2026, Branch `refactor/comprehensive-app-audit`, HEAD `3a46d65`, App-Version 69. Prüfer: Claude-Subagent `puls-frontend`, nur lesend/testend (keine App-Datei geändert).

Umgebung: Claude-Browser-Pane (Chromium), `node scripts/serve.cjs` über `.claude/launch.json` (bestand bereits), `http://localhost:4173/?erststart=1`. Nur lokale Testdaten, kein Konto, keine Anmeldung. Für Befund 4 kurz ohne `?erststart` auf localhost mit frischem lokalen Testprofil gemessen; das dabei angelegte `puls-v1` wurde danach wieder entfernt (localStorage danach wie vorher: nur `puls-color-scheme`).

Grenzen: kein echtes iPhone/Safari, keine Safe-Area-Prüfung, keine echte Kamera/GPS/Audio/Haptik, keine Wischgesten, `prefers-reduced-motion` nicht emuliert (nur CSS geprüft), kein angemeldeter Sync.

## Status je Bereich (IDs = Bereichszeilen aus `TEST-MATRIX.md`)

| Bereich | Getestet (390 × 844, Dunkel und Hell) | Status |
|---|---|---|
| Grundlage/Zustand | Erststart-Vorschau schreibt nichts in localStorage; Onboarding Schritt 1 + 2 | PASS, aber UI-1 |
| Tabs/Navigation | 5 Tabs, `aria-current`, Tag vor/zurück, „Zu Heute“, Plus-Menü (10 Einträge), Seitenwechsel | PASS |
| Übersicht | Kcal-Ring, Makros, „Heute eingetragen“, Verlauf-Karte, Gewicht | PASS |
| Ernährung | Suche (lokal + BLS), Lebensmittel wählen, Menge `120,5` → 107 kcal korrekt, ungültig → „–“ und Toast „Bitte eine gültige Menge eingeben“; Eigene (Pflichtname per HTML-Validierung, Komma-Werte gespeichert), Barcode-/Rezepte-/Foto-Tab öffnen, Eintrag bearbeiten `150,5`, Wasser +250 ml | PASS (Online-Suche siehe UI-5) |
| Messungen/Fortschritt | Gewicht `abc` abgelehnt, `81,7` gespeichert; Körpermaße Taille `88,5` gespeichert; Körper & Entwicklung, Fortschritt-Tab | PASS |
| Training | Leeres Workout (Name Pflicht), Übung suchen/hinzufügen, kg `62,5`, Reps, Satz abhaken, Pause zählt, ±30 s, Pause beenden, Workout abschließen, Zusammenfassung → Serie → XP, Kalender, Routinen (leere Routine → Inline-Fehler) | PASS, aber UI-2, UI-3, UI-6 |
| Lauf/Aktivitäten | Laufansicht öffnen/schließen, Leaflet lädt, Kacheln geladen | PASS (GPS NOT TESTED) |
| Konto/Sync | Konto-Seite, Konto verwalten, Profil, Darstellung, Klänge, Plan, Adaptiver Erhalt | PASS (Login/Sync NOT TESTED) |
| Designs/Farbschema | System folgt `prefers-color-scheme` live (Dunkel `#000`, Hell `#F2F2F7`); Kontrast-Skript auf 4 Tabs in beiden Schemata: keine sichtbaren Texte unter 4,5:1 | PASS |
| Offline/Service Worker | — | NOT TESTED |
| Haptik/Ton | `navigator.vibrate` vom Browser blockiert (erwartet ohne Nutzergeste) | NOT TESTED |
| Vorschau-Modus | Banner, „Eingaben werden nicht gespeichert“, kein localStorage-Schreiben | PASS |
| Native-Bridge, Kamera | Barcode-Tab meldet „Keine geeignete Kamera gefunden“ | NOT TESTED |
| 320 × 568 | kein horizontales Überlaufen auf 4 Tabs und Plus-Menü | PASS, aber UI-4 |
| 768 × 1024 | Seitenleiste statt Tab-Leiste, kein Überlaufen | PASS |
| Reduced Motion | CSS deckt alle 3 gefundenen `animation`-Regeln (Sheet, Ring) und Splash ab | STATICALLY VERIFIED ONLY |
| Fokus | Tab-Taste: sichtbarer 2-px-Rahmen `#0A84FF` | PASS |
| Konsole | keine App-Fehler; nur CORS (UI-5) und blockiertes `vibrate` | PASS |

Barrierefreiheit (Skript über alle Tabs und Dialoge): keine Bedienelemente ohne zugänglichen Namen, alle sichtbaren Eingaben mit Label/`aria-label`. Tippflächen unter 44 px siehe UI-7.

## Befunde

| ID | Schwere | Ort | Reproduktion | Art | Vorschlag |
|---|---|---|---|---|---|
| UI-1 | mittel | Onboarding Schritt 2, `js/flows.js:80` (`commitProfile` bei `setupPending` erzwingt `mode:'auto'`), Anzeige `js/profile-refresh.js` | `?erststart=1` → Alter 34, Größe 180,5, Gewicht 82,4, Ziel 78. „Kalorienziel: Selbst“ ist aktiv (`pl-mode=manual`), Ergebnis zeigt „2.200 Dein Tagesziel“. „Weiter zur Übersicht“ → gespeichert wird `plan.mode='auto'`, 1.823 kcal / P 148 / KH 159 / F 66. | objektiver Defekt (Anzeige ≠ Gespeichertes) | Entweder im Onboarding „Berechnet“ vorwählen und Vorschau berechnen, oder die Wahl „Selbst“ respektieren. Produktentscheidung + Backend (Codex). |
| UI-2 | niedrig–mittel | Workout-Satz, `js/app.js:46` `setValue` | Reps-Feld leeren, „0“ tippen → Toast „Bitte einen gültigen Wert eingeben“, `render()`, Fokus springt auf `BODY`, Feld leer. Gleiches bei kg mit erstem Zeichen „,“ (wird zu „.“ → NaN), statisch abgeleitet. | objektiver Defekt (= Befund 5) | Zwischenwerte bei `input` nicht melden/rendern; Prüfung erst bei `change`/Abhaken. |
| UI-3 | niedrig | Workout-Satz, Kette `workout-polish.js:25` → `tracker-tools.js:42` → … → `app.js:46` | 3 Tastendrücke im Reps-Feld → 3× `save()`, 3× `localStorage.setItem('puls-v1')`, 3× `JSON.stringify` (Testprofil 0,9 kB, zusammen 0,1 ms). Ohne Anmeldung nur 1 stringify je save. | objektiv belegt (= Befund 4), Wirkung bei kleinem Profil nicht spürbar | Entprellen oder erst bei `change` speichern; Kosten mit großem Profil und angemeldet NOT TESTED. |
| UI-4 | niedrig | Übersicht-Titel 320 px (`main h1`, 34 px, `nowrap`+`ellipsis`) | 320 × 568 → Titel „Übers…“ abgeschnitten (156 > 133 px); „kcal“ bricht in eigene Zeile. Bei 390 px korrekt. | objektiver Defekt auf kleinstem iPhone (SE 1. Gen.) | Titel bei < 360 px kleiner (z. B. 28 px) oder Datumsauswahl umbrechen lassen. |
| UI-5 | niedrig | Open-Food-Facts-Suche (`cgi/search.pl`) | Suche „Banane“ → Konsole: CORS-Fehler von `localhost:4173`, Ergebnis nur lokal/BLS, keine Nutzermeldung. | NEEDS INVESTIGATION (auf `github.io` nicht geprüft) | Live-Origin prüfen; ggf. API v2 `/api/v2/search` mit CORS nutzen; Hinweis „Online-Suche nicht verfügbar“. |
| UI-6 | niedrig | Übungskatalog | Suche „Bankdrücken“: 149 Treffer, oben „Smith Machine Bench Press“, dann „45-Degree Leg Press“, „Ab Crunch Machine“; Namen und Muskeln englisch („chest · machine“) in deutscher Oberfläche. | Geschmack/UX | Deutsche Aliasse und Relevanz (exakter Begriff vor Teilwort „press“). |
| UI-7 | niedrig | mehrere | Tippflächen < 44 px: „Vorschau verlassen“/„Zurück zu deinem Konto“ (Link, 17 px hoch), Tag vor/zurück 36 × 44, „250 ml Wasser hinzufügen“ 100 × 36, „Eigenes Ziel setzen“ 125 × 26, Pausen-Buttons 53 × 40, „Standardpause … Einstellen“ 266 × 40, Segment-Schalter im Profil 170 × 40, Klänge „An“ 49 × 39, Quellen-Links „Open Food Facts“/„ODbL“ 17 px. | objektiv (Regel in `DESIGN-SYSTEM.md`: 44 × 44) | Mindesthöhe 44 px bzw. unsichtbare Tippfläche vergrößern. |
| UI-8 | niedrig | Texte | „1 Übungen · 01:42“ (Kalender), „1 Messungen“ (Körper & Entwicklung). | objektiver Textfehler | Singular/Plural. |
| UI-9 | niedrig | Zahlenanzeige in Feldern | Nach Speichern stehen Dezimalwerte mit Punkt in Feldern („120.5“ im Bearbeiten-Dialog, „62.5“ im Satz, Profilgröße „180.5“ nach Blur), Anzeigen sonst mit Komma. | Konsistenz/Geschmack | Feldwerte deutsch formatieren (Komma), Speicherung bleibt Zahl. |
| UI-10 | Hinweis | Plus-Menü, `js/quick-units.js:16` | Eintrag „Text & Sprache“ öffnet funktionierenden Dialog; `CURRENT-STATE.md` (Zeile 97) nennt „Text & Sprache“ als entfernt. | NEEDS INVESTIGATION (vermutlich nur aus Essen-Sheet entfernt) | Koordinator klärt, ob gewollt. |
| UI-11 | Geschmack | Tab-Leiste | Beschriftung „Hinzufügen“ sitzt 10 px höher als die übrigen vier (816–830 vs. 826–839). | Geschmack (wohl gewollt durch Plus-Kreis) | ggf. Grundlinie angleichen. |
| UI-12 | Geschmack | Workout-Abschluss | Nach „Workout abschließen“ drei Vollbilder nacheinander (Zusammenfassung → Trainingsserie → XP-Fortschritt). Leeres Workout verlangt Pflichtnamen ohne Vorgabe. | Geschmack | Serie/XP zusammenfassen; Namensvorschlag vorbelegen. |

### Korrekturstand (26.10.2026, `puls-frontend`, nicht committet)

| ID | Status | Änderung | Beleg |
|---|---|---|---|
| UI-1 | behoben | `js/flows.js`: Onboarding wählt „Berechnet“ vor; „Selbst“ speichert die angezeigten eigenen Ziele mit `plan.mode='manual'` (bestehendes Plan-Modell). Ungültige eigene Werte halten den Schritt offen (Fehlertext). Konto-Bearbeitung und bestehende Profile unverändert. | `tests/check-onboarding.cjs` (Vorauswahl, Vorschau-kcal = gespeichert, Selbst 2.100 → `manual`, ungültig bleibt offen). Browser 390 × 844: Vorauswahl „Berechnet“ 1.823 kcal; nach „Selbst“ Vorschau 2.200 → gespeichert `manual` / 2.200 kcal, Größe 180,5 als Zahl. |
| UI-2 / Befund 5 | behoben | `js/app.js` `setLiveValue` + Flag in `setValue`; `js/workout-polish.js` Satzfelder: `oninput` → `setLiveValue` (ungültige Zwischenwerte still), `onchange` → `setValue` (Prüfung mit Toast). | `tests/check-audit-ui.cjs`. Browser: „0“ ins Reps-Feld getippt → kein Toast, Fokus bleibt, Feld zeigt „0“; danach „12“ → State 12. |
| UI-3 / Befund 4 | behoben | `js/app.js` `scheduleSave` (400 ms) für Tippen; `change`, Abhaken und alle anderen Wege speichern sofort und verwerfen den ausstehenden Timer; `pagehide`, `beforeunload` und `visibilitychange: hidden` speichern sofort. State wird bei jedem gültigen Tastendruck sofort gesetzt. | `tests/check-audit-ui.cjs` (6 Tastendrücke → 0 Speicherungen bis Timer, dann 1; Flush bei Verlassen). Browser: ausstehender Timer nach Tippen gesetzt. Großes Profil/angemeldet weiter NOT TESTED. |
| UI-4 | behoben | `css/design-system.css`: unter 360 px Titel 28 px. | Browser 320 × 568: alle 4 Tab-Titel ohne Abschneiden (`scrollWidth` = `clientWidth`), kein horizontales Überlaufen. |
| UI-5 | offen | — (laut Auftrag nicht geändert) | — |
| UI-6 | offen | — (laut Auftrag nicht geändert) | — |
| UI-7 | teilweise | `css/design-system.css`: Textlinks „Vorschau verlassen“, „Zurück zu deinem Konto“, Open Food Facts/ODbL unsichtbar auf 45 px Tipphöhe erweitert (Padding + negativer Rand, Banner-Höhe unverändert 56 px). | Browser: Link 108 × 45, Banner 56 px mit/ohne. **Offen** (nur mit sichtbarer Größenänderung lösbar): Tag vor/zurück 36 × 44, „250 ml Wasser“ 100 × 36, „Eigenes Ziel setzen“ 125 × 26, Pausen-Buttons 53 × 40, Standardpause 266 × 40, Profil-Segmente 170 × 40, Klänge „An“ 49 × 39. |
| UI-8 | behoben | `countText()` in `js/app.js`; Übungen/Sätze/Messungen/Einträge in `flows.js`, `training.js`, `enhancements.js`, `personal.js`, `insights.js`, `finish.js`, `experience.js`. `js/i18n.js`: Einzahl nutzt die Mehrzahl-Übersetzungen und wird englisch einzahlig („1 exercise“, „1 set“, „1 entry“); Teile wie „1 Übung · 01:42“ werden jetzt auch übersetzt. | Browser: Kalender „1 Übung · 01:42“; `translatedUI('1 Übung')` = „1 exercise“, „2 Übungen“ = „2 exercises“. `app.js:49` („Deine Einträge“-Badge) bewusst nicht angefasst (Datei parallel in Arbeit). |
| UI-9 | behoben | Dezimalfelder (`js/design-system.js`): eigene `value`-Eigenschaft – Anzeige mit Komma, Lesen für alle Handler weiter mit Punkt; nach `change` auch getippte Punkte als Komma. Satz-kg-Feld zeigt `fieldDecimal()`. Speicherung bleibt Zahl. Englisch unverändert Punkt. | Browser: Bearbeiten-Dialog zeigt „120,5“ (gelesen 120.5); „150,5“ gespeichert als 150.5 g; Satz zeigt „62,5“; Profilgröße zeigt „180,5“, gespeichert 180.5. |
| UI-10 | behoben | `js/quick-units.js`: Eintrag „Text & Sprache“ aus dem Plus-Menü entfernt (jetzt 9 Einträge). `nutritionInputForm` bleibt, weil `tracker-tools.js`/`food-upgrade.js` ihn weiter aufrufen. | Browser: Plus-Menü ohne „Text & Sprache“. |
| UI-11, UI-12 | offen | Geschmack, nicht beauftragt. | — |

Kein Befund: horizontales Überlaufen (390/320/768), fehlende zugängliche Namen, Fokus-Sichtbarkeit, Kontrast, Dialoge schließen mit Escape und „Schließen“, Komma-Eingaben in Ernährung/Gewicht/Maßen/Profil/Satz.

## Befund 4 und 5 aus `QUALITY-REPORT.md`

- **Befund 4: bestätigt** (UI-3). Jeder Tastendruck im Satzfeld löst `save()` mit `localStorage.setItem` aus. Doppelte Serialisierung und Prüfsumme treten nur im angemeldeten Zustand auf: NOT TESTED. Spürbare Verzögerung bei großem Profil: NOT TESTED.
- **Befund 5: bestätigt** (UI-2). „0“ im Reps-Feld → Toast, Neuzeichnen, Fokusverlust, Eingabe verworfen.

## flows.js, visuals.js, designs-extra.js zur Laufzeit

Methode: Quelltext aller geladenen Skripte per `fetch` geholt, `toString()` der aktiven globalen Funktionen der Datei zugeordnet, DOM-Klassen der 4 Tabs gegen die Dateien abgeglichen, `validData` mit verschiedenen `appDesign`-Werten aufgerufen. `currentDesign()` ist fest `'classic'`.

| Datei | Ergebnis | Beleg |
|---|---|---|
| `js/flows.js` | **REQUIRED** | Aktive Definitionen `macroCard`, `trendData`, `currentDesign`; Onboarding-Commit (UI-1); 17 gerenderte Klassen nur in dieser Datei (`designworkouts`, `designdiary`, `watercompact`, `microgrid`, `accountidentity`, `chartperiod` …); `appDesigns` + `validData`-Wrapper: `validData({...state, appDesign:'apple'})` wird `false`, sobald der Eintrag fehlt. Nur Teile (Designwahl `designChooser`/`chooseAppDesign`, nicht genutzte Designzweige) sind toter Code. |
| `js/designs-extra.js` | **REQUIRED** (nicht entfernen) | Darstellungszweige (`terra`/`volt`/`blueprint`/`nocturne`) sind tot, aber die Datei ergänzt diese 4 Schlüssel in `appDesigns`. Test: ohne `appDesigns.terra` liefert `validData({...state, appDesign:'terra'})` **false**; ältere Sicherungen/Profile mit diesen Designs würden abgelehnt. Außerdem nutzt `color-scheme.js` `terra`/`blueprint` zur Migration, und `tests/check-refinement34.cjs` lädt die Datei. Entfernen nur nach Migration (`appDesign` → `classic` bzw. Schlüssel woanders erhalten). |
| `js/visuals.js` | **NEEDS INVESTIGATION**, Tendenz SAFE TO REMOVE | Alle Wrapper reichen bei `'classic'` durch (`nutrition`, `applyAppDesign`, `accountPage` ersetzt nur „Version 22“, kommt nicht vor); `themedFoodActions` wird von `compact.js` ersetzt; `nutrientDetailBlock` nur in toten Zweigen; `Object.assign` ändert nur Notizen bestehender Schlüssel (kein `validData`-Einfluss); keine gerenderte Klasse stammt nur aus dieser Datei. Vor Entfernung: `index.html`, `sw.js` (ASSETS), `tests/check-premium.cjs` anpassen, zugehöriges CSS (`visuals.css`) separat prüfen, dann volle Prüfung. |

## Offene Grenzen

Echtes iPhone (Safe Areas, Tastatur, Wischgesten, Kamera, GPS, Haptik), Offline/Service Worker, angemeldeter Sync, Englisch-Oberfläche und großes Profil (Befund 4) wurden nicht geprüft.
