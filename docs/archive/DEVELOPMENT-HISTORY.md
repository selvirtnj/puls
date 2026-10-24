# PULS 30

Persönlicher Fitness- und Ernährungstracker als werbefreie statische Web-App. [Live öffnen](https://selvirtnj.github.io/puls/?v=30). Deutsch/Englisch, sechs Designs und private optionale Supabase-Synchronisierung. Die bestehende Web-App wird weiterentwickelt; native Distribution ist derzeit zurückgestellt.

Version 30 ergänzt Icon-Farben, kontrolliertes Wisch-Löschen, Drag-and-drop, CSV, Gewichtstrend, Körpermaße, lokale Progress-Fotos, Meal Planning, Fasten-Timer, Supersets, Scheiben-/Aufwärmrechner, Text-/Spracheingabe, eingeschränkten Recipe-Import, optionale Verlaufskalibrierung und Check-ins. [Vollständiger Abgleich, Grenzen und Quellen](docs/PREMIUM-AUDIT.md).

Code: `dist/`; Oberfläche nutzt denselben Profilzustand wie Training, Essen und Cloud. Fotos bleiben kontogetrennt lokal und werden separat exportiert. Keine Schlüssel eines privaten KI-Dienstes oder Health-Anbieters sind eingebaut.

Validierung: `node check-premium.cjs`, `node check-cloud.cjs`, `node check-preview.cjs`, `node check-tracker.cjs` und die bisherigen modulbezogenen Checks. `node bundle.cjs` erstellt die Einzeldatei; die veröffentlichte Ordnerfassung enthält Katalog, Worker und Icon-Dateien.

Die folgenden Abschnitte dokumentieren ältere Entwicklungsstände. Angaben wie „noch nicht veröffentlicht“ oder „nur lokal“ beziehen sich auf den jeweiligen damaligen Stand.

## Entwicklungshistorie

## Workout-Tracker (Version 6)

Eigene Routinen statt mitgelieferter Push-/Pull-/Legs-Vorlagen. Unter Training → Routinen eine Routine benennen und Übungen aus 876 lokal gebündelten englischen Namen wählen. Quelle: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), Unlicense (siehe EXERCISE-LICENSE.txt). Übungen lassen sich nach Namen, Muskel und Equipment suchen; eigene Übungen bleiben möglich.

Jede neu hinzugefügte Übung beginnt mit einem Satz. Weitere Sätze lassen sich im Routineneditor und im laufenden Workout hinzufügen. Die Pfeile ändern die Übungsreihenfolge. Im Workout stehen Gewicht, Reps, ein Abschluss-Häkchen und die abgeschlossenen Satzwerte des letzten passenden Trainings nebeneinander.

Die pro Übung einstellbare Pause startet beim Abhaken automatisch. 0 Sekunden deaktiviert die Pause. Pause und gesamte Workout-Dauer verwenden gespeicherte Zeitstempel; beim Zurückkehren nach Hintergrundbetrieb stimmt die Restzeit weiterhin. Ein Alarm bei gesperrtem iPhone ist nicht garantiert. Alte unvollständige Workouts ohne Zeitstempel starten ihre Zeitmessung erst bei Wiederaufnahme und werden entsprechend gekennzeichnet. Alte abgeschlossene Workouts erhalten keine erfundene Dauer.

Unter Training → Kalender sind abgeschlossene Trainings nach Datum auswählbar. Laufende Workouts erscheinen in der Workout-Ansicht zuerst. Änderungen am laufenden Workout verändern die gespeicherte Routine nicht.

Unter Essen eintragen zeigt die Übersicht die letzten fünf Einträge des gewählten Tages. Bei bekannten Packungsgrößen wird die gesamte Packung vorausgewählt, beispielsweise 500 ml bei einem entsprechend hinterlegten Getränk. Fehlt eine passende Größenangabe, bleiben 100 g/ml als editierbarer Startwert. Gramm und Milliliter werden nicht ineinander umgerechnet. Bestehende Barcode-Produkte ohne Packungsdaten versuchen bei Auswahl, diese Metadaten nachzuladen. Eigene Produkte können ebenfalls eine Packungsgröße erhalten.

## Gespeicherte Rezepte

„Ernährung → Meine Rezepte“ oder „Essen hinzufügen → Rezepte“ öffnen. Ein Rezept benennen, Zutaten aus Basislebensmitteln oder gespeicherten Barcode-Produkten hinzufügen und die verwendeten Mengen einstellen. Fehlende Zutaten können direkt mit eigenen Etikettwerten eingegeben werden.

Das gesamte fertige Gericht ohne Topf/Schüssel wiegen und dieses Endgewicht speichern. Nährwerte pro 100 g = Summe der Zutaten-Nährwerte × 100 / fertiges Gesamtgewicht. Danach das Rezept auswählen und nur das Gewicht der eigenen Portion eingeben. Für Roh-/Trockenmengen passende Roh-/Trockenwerte verwenden. Flüssige Zutaten mit ml-Werten können in ml erfasst werden; das fertige Gericht wird trotzdem separat in Gramm gewogen. Die Rechnung setzt voraus, dass die Nährstoffe erhalten bleiben und gleichmäßig verteilt sind.

Rezepte können bearbeitet, kopiert oder gelöscht werden. Bereits erfasste Tagebuchportionen ändern sich dadurch nicht. Rezepte sind in der Datensicherung enthalten; alte Sicherungen ohne Rezepte bleiben kompatibel. `node check-recipes.cjs` prüft Portionsberechnung und Speicherung.

## Erweiterung: Open Food Facts & Barcode

Unter „Essen hinzufügen → Barcode“ EAN/UPC eingeben oder in der HTTPS-Version die Kamera starten. Open Food Facts liefert Produktwerte, die einmal mit dem Etikett verglichen und bestätigt werden. Fehlende Werte müssen ergänzt werden. Bei Getränken explizit 100 ml wählen; Gramm und Milliliter werden nicht gleichgesetzt. Bestätigte Produkte werden in der lokalen Bibliothek gespeichert. Fehlt ein Produkt, kann es privat mit Barcode angelegt werden. PULS schreibt keine Daten zu Open Food Facts.

Nur Barcode-Abfragen gehen direkt an Open Food Facts; Mengen, Profile und Tagebucheinträge bleiben lokal. Die Datenbank ist Community-gepflegt und kann Fehler enthalten. Lizenz: Open Database License (ODbL), einzelne Inhalte DbCL. Herkunft und Lizenz sind in der App verlinkt. Die Schnittstelle nutzt API v3. Abfragen werden lokal begrenzt; wiederholte bestätigte Produkte kommen aus dem lokalen Speicher. Die Scanner-Bibliothek ZXing Browser (MIT) wird bei Bedarf über UNPKG geladen.

Live-Kamera und API-Verbindung sind auf einem echten iPhone noch nicht geprüft. Lokale HTML-Dateien können Kamera- und Netzwerkzugriffe einschränken. Kamerazugriff wird deshalb erst für HTTPS aktiviert. Die Veröffentlichung ist durch die Freigabeprüfung in dieser Umgebung weiterhin blockiert. `node check-products.cjs` prüft die Datenübernahme mit simulierten API-Antworten.

Persönliche Fitness-Web-App auf Deutsch. Daten bleiben im Browser, ohne Cloud-Abgleich.

## Start

Die Datei PULS.html ist die eigenständige App. Bei einem Update dieselbe Datei am selben Ort im selben Browser öffnen; für einen Browserwechsel zunächst unter „Profil & Ziele → Daten & Methoden“ exportieren und anschließend importieren. Die Browserdarstellung auf einem echten iPhone ist noch nicht geprüft. Für die Installation auf dem iPhone wird weiterhin ein erreichbarer HTTPS-Host benötigt.

## Profil & Ziele

Oben rechts „Profil & Ziele“ öffnen. Kalorien und alle Makros können ohne vollständiges Profil manuell gesetzt werden. Für Erhalt und Prognose Alter, Größe, aktuelles Gewicht, Zielgewicht, Formelparameter und durchschnittliche Aktivität erfassen. Ein gemessener Ruheumsatz kann die Mifflin-Schätzung ersetzen.

- Abnehmen: wenig −10 %, mittel −15 %, viel −20 % vom geschätzten Erhalt.
- Zunehmen: wenig +5 %, mittel +10 %, viel +15 % auf den geschätzten Erhalt.
- Halten: geschätzter Erhalt ohne Änderung.
- Makrovorschlag: Protein und Fett pro kg, verbleibende Kalorien als Kohlenhydrate. Alternativ alle Makros selbst festlegen.

Erhalt = Ruheumsatz × Aktivitätsfaktor. Sport ist im Faktor enthalten und wird nicht nochmals addiert. Es gibt keine universell genaueste Formel. Die Zielprognose nutzt eine vereinfachte Hall-Näherung, nicht das vollständige NIH-Modell. Der angezeigte Termin setzt konstante Kalorien und Aktivität voraus. Die ±10-%-Szenarien sind keine statistischen Konfidenzintervalle. Quellen und Grenzen stehen in der App unter „Daten & Methoden“.

## Routinen und persönliche Level

Unter „Training → Meine Routinen“ eigene Übungen, Reihenfolge, Sätze und Wiederholungsbereiche speichern. Jede gestartete Einheit ist eine unabhängige Kopie; spätere Routineänderungen ändern frühere Trainings nicht.

Unter „Level & Rekorde“ oder über „Kraftziel“ ein persönliches geschätztes Einwiederholungsmaximum als Ziel setzen. Abgeschlossene Sätze mit 1–10 Wiederholungen zählen zum e1RM nach Epley. Ein einzelner Wiederholungsversuch zählt mit dem tatsächlichen Gewicht. Höhere Wiederholungszahlen bleiben als Satzrekorde sichtbar.

Die Level sind persönliche App-Stufen: Bronze unter 40 %, Silber ab 40 %, Gold ab 60 %, Platin ab 80 %, Diamant ab 100 % des eigenen e1RM-Ziels. Sie sind kein Vergleich mit anderen Trainierenden. Gewichte je Übung immer gleich erfassen. Die e1RM-Schätzung ist für Körpergewichtsübungen mit Zusatzgewicht nicht geeignet.

## Quellcode

`dist/` enthält die statische App. Keine Installation oder API-Schlüssel erforderlich. Auf einem statischen HTTPS-Host bereitstellen. `node check.cjs` und `node check-v2.cjs` prüfen Berechnungen, Eingaben und Speicherung ohne Browser. `node bundle.cjs` erstellt die eigenständige HTML-Datei.

## Version 7 · Auswertung und native iPhone-Erweiterung

Training → Fortschritt zeigt Gesamtzahlen, XP, Wochenserie, Wochen-/Monatsrecaps und Muskelgruppen-Sätze. Abgeschlossene Workouts erhalten eine Auswertung. Der Performance-Verlauf jeder Übung zeigt e1RM, Satzverlauf, persönliche Rangprognosen und einen theoretischen Rep-/Gewichtsrechner. Trainingsziele, Rep-Bereich, Gewichtsschritt und Muskelzuordnung sind dort einstellbar. Gewichtsvorschläge werden nicht automatisch eingetragen. XP und Rekorde werden aus der Historie neu berechnet; Änderungen an alten Workouts ändern deshalb auch die Auswertung.

Epley-Schätzungen nutzen 1–10 Reps und nur das eingetragene externe Gewicht. Körpergewichtsübungen und Übungen ohne zusätzliches Gewicht sind damit nicht sinnvoll vergleichbar. Die lineare Rangprognose braucht mindestens drei Trainingstage über 14 Tage mit aktuellem positivem Verlauf. Persönliche Level sind kein Vergleich mit anderen Trainierenden. Volumen ist die Summe aus eingetragenen kg × Reps; bei Hanteln, Maschinen und Körpergewichtsübungen immer dieselbe Erfassungsweise verwenden.

Food Suggestions wählen aus Grund- und eigenen Lebensmitteln nach offenen Makros/Kalorien. Kein vollständiger Mikronährstoff- oder Allergieabgleich.

`native/` enthält ein vorbereitetes XcodeGen-Projekt für eine WKWebView-iPhone-App mit ActivityKit/Dynamic Island und lokalen Pausen-Mitteilungen. Siehe native/README-DE.md. Unter Windows nicht kompiliert oder am Gerät verifiziert. Installation und Signing erfolgen auf dem Mac. Safari- und native Daten sind getrennt; Sicherung zuerst exportieren und in der nativen App importieren. Im Hintergrund bleibt ein abgelaufener Pausen-Zähler bis zum nächsten Öffnen bei 0; eine lokale Mitteilung erinnert an den nächsten Satz.

Prüfung: `node check-insights.cjs` zusätzlich zu den vorhandenen Checks. App-Berechnungen und UI im mobilen Browser geprüft; native APIs benötigen den Gerätetest.


## Version 14 · Tagebuch und Trainingsablauf

Wischbare Energie-, Makro- und Nährstoffkarten, kompakte Essensliste, Eingaben als Bottom Sheet auf dem iPhone. Eigenständiger Trainingsbildschirm, Routine-Vorschau, breite Satzschaltflächen und explizite Abschlussbestätigung mit optionalem Körpergewicht. Nicht abgehakte Sätze werden nach Bestätigung verworfen; Routinen bleiben erhalten. Session-Auswertung mit Dauer, Volumen, Reps, persönlichen Bestleistungen, Tageserie und XP-Fortschritt. Die Wochenserie bleibt separat in der Statistik.

`enrich-nutrients.py` ergänzt die bereits importierten offiziellen BLS-, USDA- und Ciqual-Dateien um Wasser, Ballaststoffe, Vitamin C, Eisen, Calcium, B12, Folat, Kalium und Magnesium. Einheiten: Wasser/Ballaststoffe g, B12/Folat µg, übrige Felder mg je 100 g; numerische Null bleibt Null, unbekannte/unter Nachweisgrenze liegende Werte werden nicht erfunden. OFF-Mineral-/Vitaminwerte werden aus Gramm in die jeweiligen Einheiten umgerechnet. Wasser ist 1 g ≈ 1 ml; Werte werden beim Loggen als Portions-Snapshot gespeichert und beim Ändern der Menge proportional angepasst. Wasserwerte fehlen bei vielen Markengetränken; bei ml-Produkten kann ein bekannter Wasseranteil optional eingegeben werden. Reines Wasser wird separat erfasst. Kein pauschales Zählen unbekannter Getränke als 100 % Wasser. Für bestehende Tagebucheinträge und Rezepte ohne Nährstoffdaten keine rückwirkenden Annahmen. Eigene Tagesziele optional, keine universellen Referenzwerte vorgegeben.

Prüfung: `node check-flows.cjs`, `node check-catalog.cjs` und bestehende Checks. Nährstoffabdeckung ist immer pro Feld sichtbar. Quellen/Lizenzen bleiben in der Katalogansicht ausgewiesen.
# Lebensmittel-Erweiterung · Version 32

Unter „Essen hinzufügen → Foto“ kann eine Nährwerttabelle mit lokaler Tesseract-OCR gelesen und anschließend geprüft gespeichert werden. Plausibilitätswarnungen, Favoriten, zuletzt gegessene Produkte, quellengestützte und eigene Haushaltsportionen, deutsch priorisierte Suche und offline gespeicherte App-Dateien ergänzen die bestehenden Quellen. Text-/Spracheingabe versteht Anzahlen, erfordert für „Stück“ aber eine echte Portionsreferenz oder ein manuell eingegebenes Gesamtgewicht. Details, Grenzen und Nachweise: [FOOD-32.md](docs/FOOD-32.md).

Neue gezielte Prüfungen: `node check-food32.cjs` und `node check-food-offline.cjs`. Der Service Worker speichert keine Cloud-/OFF-Antworten. Eigene App-Skripte und Styles laden bei Verbindung aktuell und fallen offline auf lokale Dateien zurück; Katalogdateien werden nach dem ersten kontrollierten Laden zwischengespeichert. Bei Änderungen an der Offline-Shell Cacheversion und Assetliste in `dist/sw.js` mitpflegen.

# Konto und Komfort · Version 33

Neu: bestätigtes Zurücksetzen des Fitnessprofils und eigene Kontolöschung, neu geordnetes Konto, wiederholbare Einführung nach dem Erststart, gemeinsame Trainings-Werkzeugzeile, Einheitenwahl (g/kg/oz/ml/l) und erweitertes Plus-Menü. Einheiten verschiedener Dimensionen benötigen ausdrücklich bekannte Dichte. Technische Details und Grenzen: [ACCOUNT-33.md](docs/ACCOUNT-33.md). Die serverseitige Funktion aus `backend/account-delete.sql` wurde mit Zustimmung eingerichtet; die Einrichtung löscht selbst kein Konto.

