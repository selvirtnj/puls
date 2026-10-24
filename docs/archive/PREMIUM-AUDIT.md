# PULS · Funktionsabgleich und Umsetzung 30

Stand: 23.10.2026. Bestehende statische Web-App auf GitHub Pages; keine Umstellung auf native Distribution.

## Code und Daten

`dist/app.js` hält den gemeinsamen `state`, Persistenz, grundlegende Ansichten und Eingaben. Erweiterungen in `training.js`, `recipes.js`, `insights.js`, `flows.js` und weiteren Dateien ergänzen dieselben Funktionen und Modelle. `cloud.js` synchronisiert diesen Zustand über Supabase Auth, RLS und revisionsgeprüfte Schreibvorgänge. Die fünf vorhandenen Tabs bleiben bestehen. Die sechs visuellen Designs teilen die Layout- und Farbvariablen.

Die Historie enthält teilweise mehrere Funktions-Wrapper. Neue Module ergänzen bestehende Ansichten und Datensätze; es gibt keine zweite App, zweite Trainingshistorie oder zweite Kalorienbilanz.

## Vorhanden und erhalten

- Manuelle und profilbasierte Kalorien/Makros; gewichtsbasiertes Nachführen; dynamische Zielgewichtsprognose als Hall-Näherung.
- 18.200 gebündelte Lebensmittel aus BLS 4.0, USDA SR Legacy/Foundation und Ciqual; Herkunftsangaben, zusätzliche Open-Food-Facts-Suche und Scanner.
- Bekannte Mikronährstoffwerte mit Datenabdeckung, DGE/ÖGE-Referenzziele und manuelle Ziele. Fehlende Werte bleiben unbekannt.
- Eigene Lebensmittel, Packungsgrößen, gewogene Rezeptportionen und Wasser aus bekannten Daten.
- Eigene Routinen ohne Mengenbegrenzung für Routinen; Übungsbibliothek, Vorher-Werte, laufende Sessions, Pausen und 5-Stunden-Abschluss.
- e1RM, PRs, persönliche Ränge, XP, Trainingsserien, Kalender, Muskelgruppen-Sätze sowie Wochen-/Monatsauswertung.
- Werbefreie Oberfläche, Quick-Add, JSON-Sicherung und vorbereitete/konfigurierte private Supabase-Konten.

## In Version 30 umgesetzt

1. Icon-Farben und Deutsch/Englisch im Konto. Die Übersetzung betrifft die Bedienoberfläche, nicht die individuellen Lebensmittel-, Übungs- und Routinennamen. Unterschiedliche Quellsprachen der Datenbanken bleiben erhalten. Zahlen und Datumsformate folgen der Sprache.
2. Bewusstes Löschen: Wischen legt eine 88-px-Aktion frei, auch ein langer Wisch löscht nicht sofort; Rückgängig bleibt erhalten.
3. Drag-and-drop im vorhandenen Sortierfenster, für Routinen und laufende Workouts. Änderungen werden erst mit Fertig übernommen; eine Positionsauswahl dient als Tastatur-/Bedienungshilfe.
4. CSV für Essen, Sätze/Workouts, Gewicht/Trend und Körpermaße; Schutz vor Tabellen-Formelinjektion in Textzellen.
5. Exponentiell geglätteter Gewichtstrend zusätzlich zu den bestehenden Wochenmitteln.
6. Körpermaße und gemessene Biometrie in `measurements`, normale Profilpersistenz und Cloud-Synchronisierung.
7. Komprimierte Progress-Fotos, nach Cloud-Benutzer getrennt lokal gespeichert, maximal 20 Bilder. Kein Cloud-Upload; separate Foto-Sicherung.
8. Meal Planning mit Schnappschuss der Nährwerte und Mengen. Erst ausdrückliches Eintragen erzeugt einen Tagebucheintrag. Einkaufsliste fasst sieben Tage zusammen.
9. Zeitstempelbasierter Fasten-Timer mit Historie. Keine Hintergrundmitteilung oder gesundheitliche Wirkung versprochen.
10. Scheibenrechner mit exakter Suche nach einer beladbaren Kombination und Aufwärmstufen als anpassbare Orientierung.
11. Supersets in Routinen und laufenden Workouts. Pause nach dem letzten Gruppenteil je Satzrunde.
12. Text-/Spracheingabe mit expliziter Prüfung von Lebensmitteltreffer und Gramm-/Millilitermenge. Spracherkennung ist browserabhängig; keine heimliche Audioaufnahme.
13. Rezeptimport über direkt erreichbare/CORS-freigegebene Recipe-JSON-LD-Daten; alternativ Einfügen von Daten/Zutaten. Keine öffentlichen CORS-Proxys, keine unkontrollierte Umrechnung von Portionen auf 100 g. Unklare Zutaten müssen im bestehenden Rezepteditor ergänzt werden.
14. Optionale TDEE-Kalibrierung aus 28 ausdrücklich vollständigen Tagen und vier Wochen mit je mindestens zwei unterschiedlichen Gewichtstagen. Keine Nullauffüllung fehlender Tage. Plausibilitätsfilter, 25-%-Beobachtungsmischung und maximal 100 kcal Änderung je sieben Tage. Nur bei berechneten Zielen und ausdrücklicher Aktivierung; gemessener Ruheumsatz hat Vorrang.
15. Sitzungszusammenfassung über das systemeigene Teilen-Menü oder als Textdatei teilen; Empfänger werden vom Nutzer gewählt. Kein automatischer Upload.
16. Regelbasierter Wochen-Check-in und optionaler Coaching-Hinweis auf der Übersicht, ohne Diagnose oder angeblichen menschlichen Coach.

## Bewusst noch nicht als fertig ausgewiesen

- Automatische Kalorienerkennung aus einem Foto: benötigt einen gewählten KI-Dienst oder ein geeignetes Modell samt Größen-/Portionsprüfung. Kein zuverlässiges kostenloses Backend vorhanden. Ein Foto allein liefert keine genaue Portionsmasse.
- Beliebige Rezept-URLs: GitHub Pages kann fremde CORS-Sperren nicht umgehen. Für einen universelleren Import wäre eine abgesicherte eigene Serverfunktion erforderlich.
- Apple Health/Watch, Health Connect, Garmin, Withings: keine Browserfunktion mit vorgetäuschter Verbindung. HealthKit benötigt eine entsprechende App-Anbindung; externe Anbieter benötigen OAuth, passende Freigaben und teilweise Verträge. Google Fit ist ein Auslaufpfad; bei Android wäre Health Connect zu prüfen.
- Soziales Feed/Freunde: separate Zustimmungs-, Sichtbarkeits- und RLS-Modelle nötig. Bestehende private Gesundheitsprofile werden nicht veröffentlicht.
- Echte iOS-Widgets und dynamischer Austausch eines bereits installierten iPhone-Web-App-Icons: keine entsprechende native Implementierung im aktuellen Web-Auftrag. Icon-Installationsseiten stellen die gewählte Farbe für einen neuen Home-Screen-Eintrag bereit. Vorher sichern; neue Installationen können getrennten lokalen Speicher haben.
- „Verifiziert“ bedeutet nicht, dass alle Lebensmittel unabhängig geprüft wurden: amtliche Katalogquellen und Community-/eigene Etikettwerte werden unterschieden, nicht mit einer falschen Prüfgarantie versehen.

## Berechnungsprüfung und Quellen

- Mifflin bleibt eine Startschätzung statt eines behaupteten universellen „neuesten besten“ Modells. Eine systematische Übersicht bei Sportlern zeigt deutliche populationsabhängige Unterschiede: https://pmc.ncbi.nlm.nih.gov/articles/PMC10687135/
- Körpergewicht reagiert dynamisch, weshalb eine fixe 7.700-kcal/kg-Regel keine exakte langfristige Prognose ist: https://pmc.ncbi.nlm.nih.gov/articles/PMC3880593/
- Die neue 28-Tage-Kalibrierung benutzt diese Energiebilanz nur als vorsichtige Beobachtungsnäherung, nicht als vollständiges NIH-Modell oder klinisch validiertes MacroFactor-Äquivalent. Mischungsgewicht, Datenfilter und Schrittbegrenzung sind dokumentierte App-Entscheidungen.
- Mikronährstoffziele bleiben Referenzwerte statt einer erfundenen Formel aus Körperkraft: https://www.dge.de/wissenschaft/referenzwerte/ · https://www.dge.de/wissenschaft/referenzwerte/eisen/ · https://www.dge.de/wissenschaft/referenzwerte/magnesium/
- Rezept-Importformat: https://schema.org/Recipe
- Home-Screen-Icons: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- Spracheingabe: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

## Validierung

Automatisierte Modell- und Integrationsprüfungen: `check-premium.cjs`, bestehende Flows, Training, Cloud-Mocks, Preview und Navigation. Mobile Browserprüfung mit Beispieldaten: Sprach-/Icon-Auswahl, Lösch-Reveal und Rückgängig, Drag-and-drop plus Übernahme, neue Dialoge und Eingaben. Reale Mikrofon-Dienste und echte Gerätedienste bleiben abhängig vom Nutzergerät; es wurden keine echten privaten Profile als Testdaten hochgeladen.
