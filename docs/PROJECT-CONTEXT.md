# PULS — gemeinsamer Produktkontext

Stand der Übergabe: 24.10.2026. Dieser Text fasst die wichtigen Produktentscheidungen aus der Entwicklung mit Selvir zusammen. Er ist keine Behauptung, dass jedes Detail auf jedem Gerät fehlerfrei funktioniert. Code und neue Nutzerwünsche prüfen.

## Ziel und Nutzung

PULS ist Selvirs persönlicher Fitness-, Gewichts- und Ernährungstracker für das iPhone, zusätzlich am PC nutzbar. Die aktive Version ist eine installierbare Web-App auf GitHub Pages. Die App-Oberfläche ist öffentlich abrufbar; private Kontoprofile werden separat über Supabase gespeichert. Seit der Zielklärung am 24.10.2026 ist ausschließlich Selvirs persönliche Nutzung das Produktziel; ein Ausbau für Freunde ist nicht beauftragt. Bestehende Authentifizierung und Synchronisierung erhalten. Aktuell keine Arbeit an nativer iOS-Distribution.

Prioritäten: sofort praktisch nutzbar, kompakt und übersichtlich, kostenfrei soweit möglich, Deutsch als Standard mit Englisch als Option, schönes dunkles Originaldesign in Lila. Referenzen sind Cronometer, Liftoff, Hevy und MacroFactor; keine Behauptung einer technischen oder markenrechtlichen Verbindung.

## Navigation und Gestaltung

Neue bestätigte Richtung vom 24.10.2026: sportlich und präzise, dunkles lila Original zuerst, weniger verschachtelte Karten, mehr kompakte Zeilen und klare Typografie. Lebendige Aktionsreaktionen und gezielte Erfolgsmomente. Konto zuerst mit kompakter Übersicht und Unterseiten; danach gemeinsame Beurteilung vor Übertragung auf weitere Tabs. Einzelheiten und Abnahmekriterien: `docs/DESIGN-WORKPLAN.md`. Diese neue Kontoaufteilung ersetzt die frühere lange Liste vollständig sichtbarer Abschnitte.

Selvir hat die Konto-Vorschau ausdrücklich bestätigt und als nächsten Abschnitt die Übersicht im gleichen Stil beauftragt. Kreis/Makrobalken, Tagesnavigation, Essenvorschau, Trainingsaktionen und Gesamtfortschritt bleiben erhalten. Veröffentlichung ist noch nicht beauftragt.

Nach Bestätigung der Übersicht ist auch Training im selben Stil beauftragt: die vier Trainingtabs, laufende Session und Abschluss. Bestehende Trainingslogik und Daten bleiben maßgeblich; zunächst lokale Vorschau.

- Untere Leiste: Training | Übersicht | mittiges Plus | Essen | Konto. Symmetrische Icons und gute Touch-Ziele.
- Übersicht/Essen/Training: oben links Profil/Level/XP, Datum in der Mitte, Streak rechts. Der aktuelle Tag heißt nur „Heute“, andere Tage zeigen Wochentag/Datum.
- Konto: Profilbild, bearbeitbarer Nutzername und Streak oben; kein Datumsheader und keine riesige Profilbildkarte.
- Energie und Makros kombinieren einen sich füllenden Kalorienkreis mit Makrobalken. Restkalorien anzeigen. Auf Essen wischbare, gleich hohe Ansichten für Makros/Mikros; kompakt halten.
- Eingaben als Bottom Sheets; wo sinnvoll außerhalb antippen oder hinunterwischen zum Schließen. Tabwechsel sollen die Höhe nicht springen lassen.
- Viele kleine, stimmige Animationen und dezente schaltbare Klänge; reduzierte Bewegung berücksichtigen.
- Original plus Studio, Ledger, Forge, Orbit, Edition, Terra, Volt, Blueprint, Nocturne: zehn Designs mit unterschiedlichen visuellen Identitäten. Funktionen und grundlegende Abläufe überall erhalten. Design gilt auch für obere/untere Leiste.

## Ernährung

- Manuelle Kalorien-/Makroziele oder profilbasierte Planung, Zieltempo und geschätzter Zieltermin. Gewichtsänderungen sollen den Bedarf nachführen. Optionale Verlaufskalibrierung benötigt vollständige Daten, siehe `adaptation.js`.
- 18.200 gebündelte Lebensmittel aus BLS 4.0, USDA SR Legacy/Foundation und Ciqual 2025; ergänzende Open-Food-Facts-Produkte und Barcode-Suche. Quellen offen anzeigen; Community-Daten nicht pauschal „verifiziert“ nennen.
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
- Persönliche Verbesserungen und Level statt ungesicherter Vergleiche mit anderen Trainierenden. XP bei besseren Gewichten/Reps; steigender, moderater Levelbedarf. Drei volle Tage ohne Training unterbrechen die tägliche Serie.
- Kalender mit Routinenamen, Wochen-/Monatsrecaps, Anzahl Workouts, Durchschnittsdauer, Volumen, Reps, Muskelverteilung, e1RM und persönliche Fortschritte. Keine verbrannten Kalorien aus Trainingsvolumen erfinden.

## Konto und Körper

Profilidentität: Nutzername und optionales Profilbild. E-Mail ist kein dauerhaftes Profilheaderfeld; Supabase-Anmeldung kann E-Mail/Passwort benötigen. Profilname allein ist keine sichere geräteübergreifende Anmeldung.

Konto-Reihenfolge: Profil/Streak → Konto & Synchronisierung → Plan → Körper & Entwicklung einschließlich Gewichtstrend/Wochenmittel → adaptiver Erhalt → Design → Sprache/Icon → Klänge & Feedback → Deine Daten → Konto verwalten.

- Alle Angaben beim Erststart sind optional, einschließlich Name. Ohne vollständiges, gültiges Profil bleiben bestehende Tagesziele erhalten; es wird kein Teilprofil gespeichert. Vollständige, für automatische Planung geeignete Angaben übernehmen wie bisher Profil, Plan und Startgewicht. Nach Abschluss erscheint die Übersicht; fehlende Angaben lassen sich später im Konto ergänzen. Der Abschluss wird unabhängig vom Namen gespeichert. Das Tutorial ist vollständig entfernt; alte Tutorial-Flags bleiben für Sicherungen gültig.
- Körpergewicht, Wochenmittel, geglätteter Trend, BMI und grobe Körperfettschätzung. Körperfett deutlich als Schätzung kennzeichnen; keine Messung aus Trainingsstärke behaupten.
- Gesamtfortschritt: Woche/Monat/Halbjahr/Jahr/Gesamt, einzelne Kurven schaltbar. Zusätzliche Metrikdiagramme im Training-Fortschritt mit korrekten Einheiten und Datenlücken.
- Profil auf PC/iPhone per Supabase synchronisieren, Offline-Änderungen und Revisionskonflikte berücksichtigen. JSON-Sicherung/CSV, Reset und Kontolöschung mit klarer Bestätigung.

## Ausdrücklich entfernt / derzeit nicht beauftragt

Nicht ungefragt wieder einbauen: Essen-/Meal-Planning, Ernährung-planen-Karte, Fasten-Timer, Wochen-Check-in, Coaching-Modus, Progress-Fotos, Scheiben- und Aufwärmrechner, große separate Farben-Karte, alte „Dein Tempo/Dein Fortschritt“-Slogans, riesige Profilbildkarte, erzwungene Mahlzeitenkategorien.

Historische Funktionen/Datenfelder können für Backup-Kompatibilität noch im Code stehen. Sie sind kein Auftrag zur erneuten Anzeige. Existierende Backups nicht beim Aufräumen vernichten.

Native App, echte Dynamic Island, Apple Health/Google Fit/Garmin/Withings und native Widgets sind nicht als funktionierende Web-Features vorhanden. Benutzerwünsche dazu wurden früher diskutiert; aktuell Web-App weiterentwickeln. Auf gesperrtem iPhone sind Hintergrundtimer/-töne nicht garantiert.

## Dauerhafte Entwicklungsentscheidungen

Bestehende funktionierende Abläufe erhalten, zuerst prüfen statt doppelt implementieren. Methodik belegen und Schätzgrenzen nennen, keine „neueste/beste Formel“ ohne Begründung versprechen. Nutzer muss nur nötige Zugänge/Entscheidungen liefern. Kein unnötiges Rückfragen oder neues Abo. Neue Funktionen müssen zu Navigation, Datenmodell, Offline- und Sync-Verhalten passen.
