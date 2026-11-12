# PULS — Feature-Parität nativ

Status: **Web** = läuft in der WebView · **Mx geplant** · **in Arbeit** · **nativ (ungeprüft)** = gebaut, nicht auf Gerät geprüft · **nativ verifiziert** = auf iPhone und gegen Fixtures geprüft.
Ein Feature ist erst „nativ verifiziert“, wenn sein Verhalten geprüft ist — vorhandener UI-Code reicht nicht.

| Feature | Web-Quellen | Plan | Status | Verifikation |
|---|---|---|---|---|
| Zustandsbrücke, Spiegel, Outbox | `native-state.js` (neu) | M1 | Web | Unit-Tests CI, `check.cjs`, Gerät: Spiegel geschrieben |
| Navigation, Datum, Plus-Menü, Zurück | `design-system.js`, `navigation.js`, `page-slide.js`, `edge-back.js` | M3 | Web | Gerät: alle Bereiche erreichbar, Zurück-Gesten |
| Erststart | `flows.js` | M8 | Web | Fixture leeres Profil, Gerät |
| Übersicht | `design-system.js` (`home`, `ds*Group`) | M3 | Web | Fixture-Werte = Web |
| Ernährungstagebuch inkl. Undo | `flows.js`, `compact.js`, `finish.js` | M7 | Web | Snapshot-Semantik, Gerät |
| Kalorien, Makros, Mikros | `flows.js`, `design-system.js` | M3/M7 | Web | Fixture-Summen |
| Wasser, vollständiger Ernährungstag | `flows.js`, `adaptation.js`, `app-polish.js` | M7 | Web | Fixtures |
| Lebensmittelsuche (Katalog, OFF) | `food-flow.js`, `catalog-search.js`, `catalog-worker.js`, `food-upgrade.js` | M7 | Web | Ranking-Fixtures, offline |
| Portionen, Favoriten, zuletzt | `food-flow.js`, `quick-units.js`, `portions.js` | M7 | Web | Einheiten-Fixtures (g/ml nur mit Dichte) |
| Eigene Lebensmittel / Korrektur | `food-flow.js`, `products.js` | M7 | Web | Gerät |
| Barcode | `products.js`, `food-flow.js` | M7 | Web | Prüfziffer-Tests, Gerät |
| Nährwertfoto / OCR | `food-upgrade.js` | M7 | Web | Parser-Fixtures, Gerät |
| Rezepte | `recipes.js`, `food-flow.js` | M7 | Web | Nährwert-Fixtures |
| Rezeptimport | `nutrition-input.js` | M7 | Web | JSON-LD-Fixtures |
| Routinen | `training.js`, `flows.js`, `training-tabs.js` | M4 | Web | IDs erhalten |
| Übungsauswahl, eigene Übungen | `exercise-catalog.js`, `machine-library.js`, `training-polish.js`, `exercise-muscles.js` | M4 | Web | Suche, Gerät |
| Laufendes Krafttraining | `training.js`, `flows.js`, `workout-polish.js`, `session-focus.js` | M4 | Web | Sätze/Supersets, Neustart |
| Pausentimer / Workout-Zeit (Live-Aktivität) | `training.js`, `rest-popup.js`, `native-bridge.js`; `RestCoordinator.swift` | M4 | Web (+ nativ Live-Aktivität) | Gerät: genau einmal beendet |
| Training abschließen/verwerfen/wiederöffnen | `flows.js`, `interactions.js`, `lifecycle.js` | M4 | Web | 5-h-Regel, XP |
| Kalender, Trainingsrückblick | `training.js`, `training-polish.js` | M5 | Web | Fixtures |
| Fortschritt, Rekorde, XP | `insights.js`, `progress-metrics.js`, `activity-overview.js` | M5 | Web | Kennzahl-Fixtures |
| Aktivitäten live (GPS) | `run-session.js`, `running.js`, `run-metrics.js`; `RunTracker.swift` | M6 | Web (+ nativ GPS) | GPS-Fixtures, Gerät |
| Aktivitätsabschluss/-details | `running.js`, `run-session.js` | M6 | Web | Gerät |
| Karten / Routenplaner | `run-map.js` | M6 | Web | Gerät, offline |
| Aktivitätsauswertung, Wochenziele | `run-metrics.js`, `activity-overview.js` | M6 | Web | Fixtures |
| Konto: Name, Avatar, Unterseiten | `account-refresh.js`, `navigation.js`, `flows.js` | M8 | Web | Gerät |
| Profil, Ziele, Prognose | `enhancements.js`, `experience.js`, `profile-refresh.js`, `adaptation.js` | M8 | Web | Formel-Fixtures |
| Gewicht | `tracker-tools.js`, `flows.js`, `profile-refresh.js` | **M2** | Web | M2-Abnahme (Plan) |
| Körpermaße, KFA | `tracker-tools.js`, `profile-refresh.js` | M2/M8 | Web | Grenzen-Fixtures |
| Adaptiver Erhalt | `adaptation.js` | M8 | Web | Fixtures |
| Darstellung, Sprache, Klänge, Haptik | `color-scheme.js`, `comfort.js`, `i18n.js`, `haptics.js` | M3/M8 | Web | Gerät, VoiceOver |
| Anmeldung, Sync, Konflikte | `cloud.js`, `account-guide.js` | M9 (Phase B) | Web | Mock-Tests + echtes Konto nur lesend |
| Sicherung, CSV, Recovery, Reset, Kontolöschung | `app.js`, `cloud.js`, `account-guide.js`, `tracker-tools.js` | M8/M9 | Web | Import-Fixtures |
| Offline, Wiederaufnahme | `sw.js`, `connectivity.js`, `lifecycle.js` | laufend | Web | Gerät Flugmodus |

Nicht portieren (nur Daten erhalten): Meal Planning, Fasten, Coaching/Check-ins, Progress-Fotos, Scheiben-/Aufwärmrechner, alte Designauswahl, Tutorial, manuelle Aktivitätserfassung, „Nur Timer“, Text-/Spracheingabe.
