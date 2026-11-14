# PULS — Entscheidungen und Produktkontext

Stand der Übergabe: 24.10.2026. Dieser Text fasst die wichtigen Produktentscheidungen aus der Entwicklung mit Selvir zusammen. Er ist keine Behauptung, dass jedes Detail auf jedem Gerät fehlerfrei funktioniert. Code und neue Nutzerwünsche prüfen.

## Ziel und Nutzung

PULS ist Selvirs persönlicher Fitness-, Gewichts- und Ernährungstracker für das iPhone, zusätzlich am PC nutzbar. Die aktive Version ist eine installierbare Web-App auf GitHub Pages. Die App-Oberfläche ist öffentlich abrufbar; private Kontoprofile werden separat über Supabase gespeichert. Seit 08.11.2026 ist auch die Freundesliste beauftragt; das Produktziel umfasst damit persönliche Nutzung und den Vergleich mit Freunden. Bestehende Authentifizierung und Synchronisierung erhalten. Die iOS-App ist eine WebView-Hülle, die die Live-Web-App lädt (Entscheidung 08.11.2026); die SwiftUI-Umstellung ist gestoppt und unter Tag `native-swiftui-archiv` archiviert. Web bleibt maßgeblich für Daten, Auth und Sync.

Prioritäten: sofort praktisch nutzbar, kompakt und übersichtlich, kostenfrei soweit möglich, Deutsch als Standard mit Englisch als Option, ein einheitliches, kompaktes Design im iOS-Stil. Referenzen sind Cronometer, Liftoff, Hevy und MacroFactor; keine Behauptung einer technischen oder markenrechtlichen Verbindung.

## Navigation und Gestaltung

Entscheidung vom 09.11.2026 — Selvir will keine Erklär- oder Disclaimer-Texte in der UI. Dies ersetzt frühere Vorgaben, Schätzwerte in UI-Texten deutlich als Schätzung zu kennzeichnen. Werte selbst dürfen weiterhin nicht erfunden werden; Methodik und Grenzen bleiben in der Dokumentation festgehalten.

Stand Vollversion (09.11.2026): ein Design im iOS-Stil mit Farbschema System/Hell/Dunkel und den Farbvarianten Frisch und Mitternacht; Bereichsfarben Training blau, Essen orange, Körper grün. Weniger verschachtelte Karten, kompakte Zeilen, klare Typografie, gezielte Erfolgsmomente. Konto mit kompakter Übersicht und Unterseiten. Freunde und kraftbasierte Ränge sind Teil der App. Regeln: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md); der frühere Gestaltungsplan liegt in [archive/DESIGN-WORKPLAN.md](archive/DESIGN-WORKPLAN.md).

Kreis/Makrobalken, Tagesnavigation, Essenvorschau, Trainingsaktionen und Gesamtfortschritt bleiben erhalten; bestehende Trainingslogik und Daten bleiben maßgeblich.

- Untere Leiste: Training | Übersicht | mittiges Plus | Essen | Konto. Symmetrische Icons und gute Touch-Ziele.
- Übersicht/Essen/Training: oben links Profil/Level/XP, Datum in der Mitte, Streak rechts. Der aktuelle Tag heißt nur „Heute“, andere Tage zeigen Wochentag/Datum.
- Konto: Profilbild, bearbeitbarer Nutzername und Streak oben; kein Datumsheader und keine riesige Profilbildkarte.
- Energie und Makros kombinieren einen sich füllenden Kalorienkreis mit Makrobalken. Restkalorien anzeigen. Auf Essen wischbare, gleich hohe Ansichten für Makros/Mikros; kompakt halten.
- Eingaben als Bottom Sheets; wo sinnvoll außerhalb antippen oder hinunterwischen zum Schließen. Tabwechsel sollen die Höhe nicht springen lassen.
- Viele kleine, stimmige Animationen und dezente schaltbare Klänge; reduzierte Bewegung berücksichtigen.
- Ein Design für alle Bereiche einschließlich oberer/unterer Leiste. Alte Design-Felder in Sicherungen bleiben gültig, werden aber nicht mehr als eigene Designs angeboten.

## Ernährung

- Manuelle Kalorien-/Makroziele oder profilbasierte Planung, Zieltempo und geschätzter Zieltermin. Gewichtsänderungen sollen den Bedarf nachführen. Optionale Verlaufskalibrierung benötigt vollständige Daten, siehe `adaptation.js`.
- 20.826 gebündelte Lebensmittel aus BLS 4.0, USDA SR Legacy/Foundation, Ciqual 2025 und CNF 2026 (plus PULS-Richtwerte); CoFID 2021 und USDA FNDDS 2021–2023 am 14.11.2026 auf Selvirs Wunsch entfernt, kommen nur auf Wunsch zurück; ergänzende Open-Food-Facts-Produkte und Barcode-Suche. Quellen offen anzeigen; Community-Daten nicht pauschal „verifiziert“ nennen. Importkonventionen: [FOOD-DATABASES.md](FOOD-DATABASES.md).
- Seit Version 95 je Katalog-Lebensmittel zusätzlich bis zu 63 Nährwerte aus BLS, USDA SR Legacy/Foundation und Ciqual (Zucker und Zuckerarten, Stärke, Fettsäuren, Omega-3/6, Cholesterin, Aminosäuren, Vitamine, Mineralstoffe, Alkohol, Koffein). Ziel ist die bestmögliche frei nutzbare Lebensmitteldatenbank; lizenzpflichtige Datenbanken wie NCCDB (Cronometer) scheiden aus. Unbekannte Werte, Spuren und Werte unter der Nachweisgrenze bleiben unbekannt. Verpackte und eigene Produkte führen Zucker, gesättigte Fettsäuren und Salz vom Etikett.
- Referenzwerte für die zusätzlichen Nährstoffe nur von der DGE und nur mit belegter Quelle; für Zucker, gesättigte Fettsäuren und Salz keine Zielbalken.
- Nährwerttabelle per Foto/OCR mit vorausgefülltem Kontrollformular. Erst nach Bestätigung speichern. Fehlende Angaben bleiben unbekannt; Plausibilität prüfen.
- Deutsche/tolerante Suche, Quellenkennzeichnung, sichere Dublettenerkennung, Favoriten, zuletzt gegessen und Offline-Nutzung bereits gespeicherter Produkte.
- Gramm, kg, ounces, ml, Liter sowie tatsächlich bekannte oder manuell definierte Portionen. Keine fiktiven Stückgewichte. Keine g/ml-Umrechnung ohne Dichte.
- Bekannte Packungsgröße bevorzugen, z. B. vollständige 500-ml-Dose bei passender Quelle; Menge jederzeit änderbar und Nährwerte live aktualisieren.
- Eigene Rezepte aus Zutaten und Gesamtmenge speichern. Für gekochte Mischgerichte fertiges Gesamtgewicht erfassen, damit entnommene Gramm korrekte Anteile erhalten.
- Schmale Liste des erfassten Essens mit Menge und kcal. Nach links löschen, Rückgängig verfügbar. Keine Frühstück/Mittag/Abend-Zwangsgruppen.
- Essen-Aktionsknöpfe nebeneinander. Gesamtwasser schmal oberhalb des Tagebuchs; +Wasser addiert direkt 250 ml. Sonstige Einträge erhöhen Wasser nur mit bekanntem Wasseranteil.
- Rezeptimport sowie Text-/Spracheingabe mit Kontrolle; tatsächliche Browser-/Quellenbeschränkungen beachten. Kein eingebautes privates KI-Modell behaupten.

## Training

- Unbegrenzte eigene benennbare Routinen und eigene Übungen, keine aufgezwungenen Vorlagen. Englische Übungsnamen reichen; Bilder sind ausdrücklich nicht nötig.
- Stand 35: 963 gebündelte Übungsnamen, darunter 87 neue Maschinen-/Smith-/Kabelvarianten. Filter Alle/Maschinen/Kabelzug/Smith, deutsche Suchbegriffe und Ergebnisse nachladen. Siehe `machine-library.js`.
- Neue Übung startet mit einem Satz. Satz hinzufügen, kg/Reps eintragen, erledigt abhaken. Letzte passende abgeschlossene Werte vorbelegen bzw. per Knopf übernehmen; niemals automatisch als erledigt markieren.
- Zentrale Pause in Minuten/Sekunden, laufender Rest-Timer mit +30 Sekunden. Im laufenden Workout keine großen einzelnen Pauseneinstellungsflächen.
- Übungsreihenfolge per langem Drücken/Optionen und anschließend Drag-and-drop im Sortierfenster, mit Animation. Vor und während einer Session nutzbar.
- Laufendes Workout ist eine eigene Ansicht, minimierbar und fortsetzbar; versehentliche Sessions verwerfbar, wertvolle Einträge gegen versehentlichen Verlust schützen.
- Ende mit Bestätigung/Weiter und Kontrollschritt für unerledigte Sätze. Optional Körpergewicht; animierter Abschluss mit Dauer, Volumen, Reps, XP und Verbesserungen. Abgeschlossene Satzlisten einklappen.
- Gesamtdauer tracken. Nach fünf Stunden automatisch beenden/speichern, Zeit begrenzen und erfasste Daten erhalten.
- Kraftbasierte Ränge nach Pound-for-Pound pro Übung und gesamt, einschließlich Freunde-Vergleich (09.11.2026). Level/XP bleiben separat; XP bei besseren Gewichten/Reps mit steigendem, moderatem Levelbedarf. Drei volle Tage ohne Training unterbrechen die tägliche Serie. Modell und Standards in `docs/STRENGTH-RANKS.md`.
- Aktivitäten (Stand Version 64): auswählbar sind Laufen, Spazieren, Wandern, Berggehen, Tischtennis, Fußball, MMA, Padel; Trailrun/Radfahren/Inlineskaten/Sonstiges nur noch für alte Einträge; Gym bleibt Workout. Kalorienmodus „Klassisch“ ist Standard, „Grundbedarf + Sport“ wählbar. Plus → Vollbild mit Karte, Aktivitätsart links, Start mittig, Route rechts, Countdown, Live-Werte, Zusammenfassung mit Gefühl/Untergrund (`js/run-session.js`, Rechenwerte `js/run-metrics.js`). Manuelles Eintragen und „Nur Timer“ sind auf Selvirs Wunsch entfernt, nicht wieder einführen. Kalorien bleiben rechnerische Schätzungen; für UI-Texte gilt die Entscheidung vom 09.11.2026.
- Laufen (25.10.2026, `js/running.js`, `js/run-map.js`), Vorbild Strava/adidas Running: GPS-Lauf (Browser nur bei offener App, iOS-App auch gesperrt), Live-Karte, Detailansicht mit Karte, km-Zeiten, Ø Pace, Ø km/h, Bestzeiten 1/5/10/21 km, Routenplaner auf Wegen (BRouter, kostenlos) mit gespeicherten Routen. iOS-App: Live-Aktivität/Dynamic Island und Mitteilung je km. Wochenziel in km, Anzeige in Workout-Tab, Kalender, Fortschritt, Übersicht und Plus-Menü. Läufe halten die Trainingsserie; 25 XP bei Bestleistung ab 1 km. Keine Kalorien aus Läufen erfinden; GPS-Rohpunkte nicht ins synchronisierte Profil, am Lauf nur vereinfachte Strecke (≤ 300 Punkte). Kartenkacheln OSM ohne Schlüssel (CARTO verlangt inzwischen einen Schlüssel).
- Kalender mit Routinenamen, Wochen-/Monatsrecaps, Anzahl Workouts, Durchschnittsdauer, Volumen, Reps, Muskelverteilung, e1RM und persönliche Fortschritte. Keine verbrannten Kalorien aus Trainingsvolumen erfinden.

## Konto und Körper

Profilidentität: Nutzername und optionales Profilbild. E-Mail ist kein dauerhaftes Profilheaderfeld; Supabase-Anmeldung kann E-Mail/Passwort benötigen. Profilname allein ist keine sichere geräteübergreifende Anmeldung.

Konto-Reihenfolge: Profil/Streak → Konto & Synchronisierung → Plan → Körper & Entwicklung einschließlich Gewichtstrend/Wochenmittel → adaptiver Erhalt → Design → Sprache/Icon → Klänge & Feedback → Deine Daten → Konto verwalten.

- Alle Angaben beim Erststart sind optional, einschließlich Name. Ohne vollständiges, gültiges Profil bleiben bestehende Tagesziele erhalten; es wird kein Teilprofil gespeichert. Vollständige, für automatische Planung geeignete Angaben übernehmen wie bisher Profil, Plan und Startgewicht. Nach Abschluss erscheint die Übersicht; fehlende Angaben lassen sich später im Konto ergänzen. Der Abschluss wird unabhängig vom Namen gespeichert. Das Tutorial ist vollständig entfernt; alte Tutorial-Flags bleiben für Sicherungen gültig.
- Körpergewicht, Wochenmittel, geglätteter Trend, BMI und grobe Körperfettschätzung. Keine Körperfettmessung aus Trainingsstärke behaupten; für UI-Texte gilt die Entscheidung vom 09.11.2026.
- Gesamtfortschritt: Woche/Monat/Halbjahr/Jahr/Gesamt, einzelne Kurven schaltbar. Zusätzliche Metrikdiagramme im Training-Fortschritt mit korrekten Einheiten und Datenlücken.
- Profil auf PC/iPhone per Supabase synchronisieren, Offline-Änderungen und Revisionskonflikte berücksichtigen. JSON-Sicherung/CSV, Reset und Kontolöschung mit klarer Bestätigung.

## Ausdrücklich entfernt / derzeit nicht beauftragt

Nicht ungefragt wieder einbauen: Erholungskarte mit Muskelfigur im Training-Tab und Ziel-Knopf „Ziel kg × Wdh“ im laufenden Workout (beide am 14.11.2026 auf Selvirs Wunsch entfernt), Essen-/Meal-Planning, Ernährung-planen-Karte, Fasten-Timer, Wochen-Check-in, Coaching-Modus, Progress-Fotos, Scheiben- und Aufwärmrechner, große separate Farben-Karte, alte „Dein Tempo/Dein Fortschritt“-Slogans, riesige Profilbildkarte, erzwungene Mahlzeitenkategorien.

Historische Funktionen/Datenfelder können für Backup-Kompatibilität noch im Code stehen. Sie sind kein Auftrag zur erneuten Anzeige. Existierende Backups nicht beim Aufräumen vernichten.

Native App, echte Dynamic Island, Apple Health/Google Fit/Garmin/Withings und native Widgets sind nicht als funktionierende Web-Features vorhanden. Benutzerwünsche dazu wurden früher diskutiert. Die iOS-Hülle ergänzt über die `pulsNative`-Brücke Pausen-Mitteilung/Live-Aktivität, Haptik, Lauf-GPS, Barcode-Scanner, Apple-Health-Export (nur schreibend, Opt-in) und lokale Erinnerungen; Google Fit/Garmin/Withings bleiben nicht beauftragt. Auf gesperrtem iPhone sind Hintergrundtimer/-töne nicht garantiert.

## Dauerhafte Entwicklungsentscheidungen

Bestätigtes Aktivitäten-Paket vom 25.10.2026 (Version 64): alte Arten bleiben erhalten. Baseline-Kalorienmodus mit Alltagsfaktor und Netto-Sportzulage nach Zu-/Abschlägen. Zeitbasierte Gym-kcal nur als MET-Schätzung, keine Schätzung bei automatischem 5-Stunden-Abschluss. Dauer-XP nur für neue Sessions, gemeinsam maximal 100 pro Tag zusätzlich zu PR-XP; aktive Minuten als weiteres Wochenziel. Datenformate, Quellen, Kalibrierungsgrenze und Frontend-Schnittstellen: [ACTIVITY-DATA.md](ACTIVITY-DATA.md).

Bestehende funktionierende Abläufe erhalten, zuerst prüfen statt doppelt implementieren. Methodik belegen und Schätzgrenzen nennen, keine „neueste/beste Formel“ ohne Begründung versprechen. Nutzer muss nur nötige Zugänge/Entscheidungen liefern. Kein unnötiges Rückfragen oder neues Abo. Neue Funktionen müssen zu Navigation, Datenmodell, Offline- und Sync-Verhalten passen.

## Entscheidungen 12.11.2026

- **Ein Hauptordner:** `Documents\Projekte\puls` ist das einzige Arbeitsverzeichnis. Der alte Codex-Klon unter `Documents\Codex\PULS` wurde gelöscht, nachdem alles in dieses Repository übernommen war (der Stash liegt als Branch `sicherung/alt-klon-stash`).
- **Agenten-Setup neu:** Gemeinsame Skills in `.claude/skills/` (frontend, backend, test-runner, code-review, reflect). Claude-Agenten: `builder` (Haiku), `specialist` (Sonnet), `reviewer` (Sonnet, lesend), `scout` (Haiku, lesend). Codex und Gemini lesen dieselben Skills über `scripts/codex-bridge.ps1` und `scripts/gemini-bridge.ps1`.
- **Hauptchat:** Fable 5.2 bis 16.11.2026, danach Opus 5.5; Aufwand xhigh; automatische Kompaktierung bei 40 %.
- **Web-App im Stamm:** Die Web-App bleibt im Stamm des Repositories (kein `src/`), weil GitHub Pages den Stamm von `main` ausliefert und es keinen Build-Schritt gibt.
- **Dokumentation:** Aktueller Stand in `PROGRESS.md`, offene Punkte in `ISSUES.md`, Entscheidungen hier; die frühere `CURRENT-STATE.md` liegt unverändert unter `archive/CURRENT-STATE-bis-v95.md`.
- e1RM und Rang werten dieselben Sätze: abgeschlossen, 1 bis 12 Wiederholungen (seit Version 109, 13.11.2026).

## Entscheidungen 13.11.2026

- **Keine weiteren Lebensmitteldatenbanken.** Der Katalog bleibt bei BLS 4.0, USDA SR Legacy/Foundation, Ciqual 2025 und CNF 2026. Neue Quellen (auch Fineli) kommen nur auf Selvirs ausdrücklichen Wunsch; mehr Quellen bringen vor allem Dubletten und Ladezeit.
- **Apple Watch:** Anbindung nur über Apple Health lesen in der iOS-Hülle. Eine eigene Watch-App wird nicht vorgebaut. Tageswerte aus Health (Puls, HRV, Schlaf, Schritte) bleiben auf dem iPhone und gehen nicht ins synchronisierte Profil; importierte Workouts und Läufe werden normale PULS-Einträge.
