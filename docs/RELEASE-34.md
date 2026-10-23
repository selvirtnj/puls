# PULS 34

## Aufgeräumte Oberfläche

Essen planen, Fasten, Wochen-Check-in/Coaching, Progress-Fotos und Scheiben-/Aufwärmrechner sind aus der Oberfläche entfernt. Bestehende Sicherungen bleiben kompatibel; frühere Datensätze werden durch dieses Update nicht gelöscht. Rezeptimport, Körpermaße, Biometrie und CSV-Export bleiben erreichbar.

Konto: Profil und Streak → Anmeldung/Synchronisierung → Plan → Körperentwicklung mit Gewichtstrend → adaptiver Erhalt → Design → Sprache/Icon → Klänge → Tutorial → Daten → Kontoverwaltung.

Die Übungsreihenfolge verwendet eine animierte Positionsänderung, einen schwebenden Griff beim Ziehen und eine kurze Rückmeldung beim Ablegen. Die Positionsauswahl bleibt als Alternative erhalten. Reduzierte Bewegung wird berücksichtigt.

## Vollständigerer Verlauf

Training, Ernährung, Körper und Muskelgruppen besitzen auswählbare Zeiträume und Messwerte. Enthalten sind unter anderem Volumen, Sätze, Wiederholungen, Dauer, mittlere Last, Volumen je Minute, XP, Level, persönliche Verbesserungen, Kraftindex, Kalorien, Makros, bekannte Mikronährstoffe, Wasseranteil, Gewicht, Trend, BMI und erfasste Körpermaße. Übungen erhalten eigene e1RM-, Volumen- und Satzkurven.

- Nur gespeicherte Werte werden dargestellt. Unbekannte Werte sind keine Nullmessung.
- Trainingszeit und zeitabhängige Kennzahlen berücksichtigen nur bekannte Dauern.
- e1RM bleibt die bestehende Epley-Schätzung für 1–10 Wiederholungen. Sätze mit mehr Wiederholungen zählen weiter zu Volumen und Satzanzahl.
- Kraftindex ist eine persönliche relative Entwicklung, kein Vergleichsrang anderer Menschen.
- BMI und grobe Körperfettschätzung historischer Gewichte verwenden die aktuelle Profilgröße und das aktuelle Alter. Körperfett ist keine Messung.
- Nährstoffsummen enthalten nur bekannte Werte und behaupten keine vollständige Tageserfassung.

Es werden keine neuen physiologischen Formeln als vermeintlich genauer eingeführt. Die vorhandenen Berechnungsgrenzen sind direkt bei den Diagrammen beschrieben.

## Vier weitere Designs

Terra (Naturjournal), Volt (Performance-Terminal), Blueprint (Studio-Raster) und Nocturne (Editorial) ergänzen die sechs vorhandenen Designs. Schrift, Flächen, Konturen, Anordnung und Navigation passen sich an. Daten und grundlegende Abläufe sind identisch.

## Prüfung

`npm test` prüft Syntax und lokale Regressionen, unter anderem Makro-/Nährstoffumrechnung, Importprüfung, Profilvalidierung, Sync-Konflikte mit simuliertem Server, Workout-Vorbelegung, XP, Serien und neue Diagrammaggregation. Tests verwenden keine echten Nutzerkonten.

Zusätzlich: Browserprüfung auf 390 × 844 Pixeln mit isolierten Testdaten für Konto, Übersicht, Essen, Training, Fortschritt und Designwechsel. Eine Browserprüfung ersetzt keine vollständige Prüfung sämtlicher iOS-Versionen.
