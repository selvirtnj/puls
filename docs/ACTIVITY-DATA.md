# Aktivitäten: Daten- und Logikschnittstelle

Lokal vorbereiteter Backend-Anteil für das bestätigte Aktivitäten-Paket vom 25.10.2026, Basis `54e0725`. Noch nicht veröffentlicht. Die Reihenfolge in `index.html` bleibt erhalten: `running.js` → `run-metrics.js` → `run-map.js` → `run-session.js`. Keine neuen Runtime-Dateien.

## Daten und Kompatibilität

Alle neuen Felder sind optional. `validData()` verändert Sicherungen nicht; es gibt keine Migration, die historische Einträge umschreibt.

- `runs[].source`: `gps`, `manual`, `watch`; fehlend bleibt erlaubt. Keine Uhr-Integration.
- `runs[].avgHr`, `maxHr`: optionale endliche bpm-Werte zwischen 20 und 250, `maxHr >= avgHr`, wenn beide vorhanden.
- `runs[].laps`, `activeRun.laps`: höchstens 1000 streng steigende positive **kumulative aktive Sekunden** ab Start, ohne Nutzerpausen. Beim gespeicherten Eintrag höchstens `durationSeconds`; unabhängig von GPS-km-`splits`. Beispiel: `[180, 420]` bedeutet Abschnitte von 180 und 240 Sekunden. Beim Abschluss übernommen.
  Die UI nutzt `activeRun.laps` bei MMA für „Nächste Runde“: `runMmaState()` in `run-session.js` verarbeitet die tatsächlich verstrichenen aktiven Sekunden als manuelle Weiterschaltmarken, zusätzlich zu den automatischen Phasenwechseln. Die bisherigen Validierungsregeln passen dazu: streng steigend, beim Speichern ≤ Dauer (Gleichheit erlaubt); `runAddLap()` verhindert Doppeltippen innerhalb derselben Sekunde. Keine vorgezogenen/fiktiven Zeitpunkte nötig.
- `activeRun.rounds`, `runSettings.rounds`: `{work, rest, count}`, Zeitwerte in Sekunden; ganze Zahlen, work 10–3600, rest 0–1800, count 1–100. Standard `{work:180,rest:60,count:5}`. Neue MMA-Sessions erhalten eine Kopie der zuletzt gespeicherten Einstellung. Die Phasen laufen mit der aktiven Sessionzeit; die letzte Runde hat keine nachfolgende Pause. Manuelles Weiterschalten und Signale integriert das Frontend.
- `runSettings.weekMinutesGoal`: 0–10080 Minuten, Standard über Getter 150; 0 kann als deaktiviertes Ziel angezeigt werden. Lauf-km-Ziel unverändert.
- `profile.kcalMode`: `classic` (fehlend = classic) oder `baseline`; `profile.baselineFactor`: 1.2, 1.3, 1.4 (fehlend = 1.2).
- `durationXpVersion:1` an **neu gestarteten** Workouts und aktiven Aktivitäten; beim Aktivitätsabschluss übernommen. Keine nachträgliche Markierung bei Import, Bearbeiten, Wiederöffnen oder Abschluss einer alten aktiven Session. Damit sind Dauer-XP unabhängig von einer Geräteuhr oder einem angenommenen Veröffentlichungszeitpunkt. PR-XP bleiben bestehen und werden weiter abgeleitet.

`mma` und `padel` sind neue Katalog-IDs. Auswählbar: run, walk, hike, mountain, tabletennis, soccer, mma, padel. trail, ride, inline, other bleiben für alte Einträge verfügbar. Fehlender Typ bedeutet run; unbekannter Typ wird wie other behandelt (keine Laufwertung, GPS oder geschätzte kcal). Der gespeicherte unbekannte/ausgeblendete Typ bleibt beim Bearbeiten erhalten.

## Schätzungen und Ziele

MET-Quellen: [2024 Adult Compendium Sports](https://pacompendium.com/sports/) — MMA als Näherung durch Box-Sparring, Code 15120, 7.8 MET; Padel durch Tennis-Doppel, Code 15680, 6 MET. Keine Behauptung sportspezifischer MMA-/Padel-Messwerte. Gym: [Conditioning Exercise](https://pacompendium.com/conditioning-exercise/), Code 02054, 3.5 MET (mehrere Kraftübungen, wechselnder Widerstand). Lauf-/Geh-MET bleiben tempo-/höhenabhängig wie bisher.

Brutto-kcal = MET × kg × Stunden; Netto-kcal = (MET − 1) × kg × Stunden. Letztes tatsächlich erfasstes Gewicht am oder vor dem Eintragsdatum, kein Profilgewicht als Ersatz für diese Sport-Schätzung. Fehlende Dauer/Gewicht oder unbekannter Typ ergeben `null`; Summen addieren nur bekannte Werte. Workout-`autoFinished` ist bereits vorhanden; solche automatischen 5-Stunden-Abschlüsse liefern keine kcal, Dauer-XP oder aktiven Minuten. Ihre Einträge und erfassten Sätze bleiben erhalten; Aggregationen weisen die unbrauchbare Dauer als unbekannt aus. Normale Gym-Sessiondauer schließt Satzpausen ein, da keine separate gemessene Bewegungszeit vorliegt.

Gespeicherte `kcal`-Snapshots bleiben unverändert. Brutto-Übersichten bevorzugen diese Werte; Netto-Bedarf wird aus den ursprünglichen Rechenparametern neu geschätzt, nicht durch Subtraktion von einem eventuell gerundeten/bearbeiteten Snapshot.

Baseline: Grundbedarf = Ruheumsatz × Alltagsfaktor. Zu-/Abschlag sowie Extrem-Defizit und 1500-kcal-Untergrenze wirken auf diesen Grundbedarf; anschließend kommen bekannte Netto-Sport-kcal des Tages dazu. Manuelle Kalorienziele bleiben manuell. `dayGoals()` projiziert das Ziel für den gewählten Tagebuchtag ohne Speicherung. Die Anzeige über `combinedNutrition()` und `macroProgress()` sowie die spätere Überschussdarstellung nutzen diese Projektion. Die automatische Pflege von `state.goals` betrifft weiter heute; im Baseline-Modus bleibt die Sportzulage auch bei ausgeschalteter Gewichtsanpassung aktuell.

Beim Start warten `adaptiveGoals()` und `dayGoals()` im Baseline-Modus auf `dayActivityKcal()`. Bis dahin bleibt das gespeicherte Ziel unverändert. Am Ende von `run-metrics.js` folgt ein Render mit vollständig geladener Aktivitätslogik: ein korrigierter Speicherstand bei veraltetem Ziel, keiner bei bereits korrektem Ziel. `baselineEnergyLine()` bleibt bei manuellen Zielen oder jedem Fallback auf `state.goals` leer; der Darstellungs-Wrapper in `activity-overview.js` bleibt erhalten. Auch Essensvorschläge, Konto-/Zielkarten und Zielprognose verwenden das Ziel des gewählten Tages.

Verlaufskalibrierung ist im Baseline-Modus vorerst deaktiviert (Berechnung, Aktualisierung und Formular). Bisherige Kalibrierungen schätzen einen Gesamtverbrauch; unbekannte/fehlende Sportaufzeichnungen lassen sich daraus nicht zuverlässig isolieren. Bestehende Kalibrierungsdaten werden beim reinen Lesen nicht verändert. Ein Moduswechsel beim Profilspeichern invalidiert sie über `profileEnergyKey()` wie andere Energieparameteränderungen.

Dauer-XP = round(Minuten × MET / 5), gemeinsam höchstens 100 pro Eintragsdatum für Gym und Aktivitäten. Zuordnung stabil nach Datum, Start-/Abschluss-/Erstellzeit, ID. Bestehende 25 XP pro Übungsverbesserung oder Laufbestleistung kommen hinzu; `workoutAwards()` ist weiterhin die zentrale Summe für `totalWorkoutXP()` und `xpProgress()`. Keine XP-Persistenz oder neue Levelkurve.

## Globale Funktionen für das Frontend

| Funktion | Rückgabe / Wirkung |
|---|---|
| `runPickableActivities()` | Frisches Array der acht auswählbaren, eingefrorenen Katalogobjekte (`pick:true`); volle Liste bleibt `RUN_ACTIVITIES`. |
| `runActivityType(id)` | Katalogobjekt; fehlend → run, unbekannt → other. Bestehende Funktion mit korrigiertem Fallback. |
| `runTypeUsesGps(type)` | Boolean; erhält alte GPS-Arten, unbekannt → false. |
| `runActivityMet({type,movingSeconds,distanceKm,ascentM}={})` | Effektiver MET-Wert oder null; gemeinsame Basis für Brutto, Netto und Dauer-XP. |
| `workoutKcalEstimate(workout)` | Gerundete Brutto-kcal oder null. |
| `activityNetKcal(entry)` | Gerundete Netto-kcal oder null; akzeptiert Aktivität oder abgeschlossenes Workout. |
| `dayActivityKcal(dateKey)` | Summe bekannter Netto-kcal aller abgeschlossenen Aktivitäten/Workouts dieses Tages; 0 ohne bekannte Werte. |
| `activityEntries(start,end)` | Sortierte `{kind:'activity'|'workout',type,entry}`-Zeilen; Gym hat `type:'gym'`, `entry` verweist auf den bestehenden Eintrag. Keine Kopie als persistenter Parallelzustand. Zukünftige Tage ausgeschlossen. |
| `activityPeriodRange(mode='week',dateKey=today(),offset=0)` | `{start,end}` inklusiv als lokale ISO-Daten. mode week/month, Woche beginnt Montag. |
| `activityStatsBetween(start,end)` | `{count,durationSeconds,minutes,unknownDurationCount,distanceKm,kcal,netKcal,unknownKcalCount,byType,activeDays,entries}`. `kcal` = bekannte Brutto-Summe. `byType[type]` enthält dieselben Summen ohne minutes/days/entries. `activeDays` = sortierte eindeutige ISO-Daten. |
| `activityPeriodStats(mode='week',dateKey=today(),offset=0)` | `{start,end,...activityStatsBetween(...)}`. |
| `activeMinutesWeek(dateKey=today())` | Zahl, Sekunden-Summe der Woche ÷ 60 (nicht vorzeitig gerundet). |
| `activeMinutesGoal()` | Gespeichertes Minuten-Ziel oder 150. |
| `setActiveMinutesGoal(minutes)` | Boolean; prüft Bereich, erhält übrige runSettings und speichert. |
| `activityDurationAwards()` | Objekt `id → {xp,durationXp,wins:[],run:boolean}` nur für markierte Einträge. Zentrales `workoutAwards()` kombiniert dies mit PR-XP. |
| `runRoundsSettings()` | Frische Kopie `{work,rest,count}` der Einstellungen oder Defaults. |
| `runSetRounds(rounds)` | Boolean; prüft, kopiert und speichert zuletzt genutzte Einstellung. Ändert keine laufende Session. |
| `runRoundState(run=state.activeRun,elapsed=runElapsed(run))` | `{round,count,phase:'work'|'rest'|'done',remainingSeconds,totalSeconds}`, round ab 1; reine Ableitung, keine Timer-/Ton-/UI-Effekte. |
| `runAddLap()` | Neue kumulative aktive Sekunde oder null bei ungültiger/gleicher Zeit; speichert in activeRun.laps. |
| `energyFor(p,weight=p.weight,plan=state.plan,dateKey=today())` | Weiter `{rmr,tdee}`, im Baseline-Modus zusätzlich `{baseline,sport}`. Datum wird durch den Adaptation-Wrapper gereicht. |
| `planNumbers(p,plan,manual=state.goals,dateKey=today())` | Bisheriges Ergebnis mit korrekter Baseline-Zielkette, ggf. baseline/sport; Extrem-Wrapper reicht Datum durch. |
| `dayGoals(dateKey=today())` | `{kcal,p,c,f}` für Anzeige; klassisch/manuell unverändert `state.goals`. Keine Speicherung. |
| `baselineEnergyLine(dateKey=today())` | Kleine DE/EN-HTML-Zeile „Grundbedarf X + Sport Y kcal · geschätzt“, sonst leer. |
| `activityRecapHtml(start,end)` | Kleine DE/EN-Erweiterung für den bestehenden Wochen-/Monatsrecap in insights.js; leer ohne Einträge. |

## Integration und Prüfung

Claude integriert Live-Ansicht, Karte/Leiste, manuelle MMA-Rundensteuerung, Minuten-Zieleingabe, kurze Wochenzeilen und Fortschritt-Bereich. Katalog-Picker und Bearbeiten-Erhalt sind bereits minimal angepasst. Neue Symbole `mma`/`padel` sind Katalogschlüssel; bis zur UI-Integration greift der vorhandene allgemeine Symbol-Fallback.

Lokale Prüfungen: `node tests/check-run-metrics.cjs`, `node tests/check-running.cjs`, `node tests/check-profile-planning.cjs`, `node tests/check-small-polish.cjs`, vollständiger `node scripts/check.cjs`. Nur synthetische Fixtures/Mischungen aus realen Wrappern und DOM-Mocks. Keine Browser-/Geräteprüfung und keine Live-RLS-Prüfung in diesem Teilauftrag. Unabhängiges Review, UI-Prüfung sowie Versions-/Cache-Erhöhung und Veröffentlichung sind Aufgaben des Koordinators.
