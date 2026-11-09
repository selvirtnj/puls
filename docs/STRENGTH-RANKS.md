# Kraft-Ränge, Paket C für v88

Lokal vorbereitet am 09.11.2026, Basis `86779c6`, ohne Veröffentlichung/Live-SQL. Die Schwellen sind Produktstandards, keine Bevölkerungsperzentile. XP/Level bleiben unabhängig.

## Modell

Abgeschlossene Workouts bis zum angefragten Tag, inklusive CSV-Import, mit erledigten Sätzen und bekannten kg/1–12 ganzzahligen Reps. Eine Wiederholung verwendet die tatsächliche Last, sonst Epley `Last × (1 + Reps / 30)`. Je kanonischer Übung zählt das höchste e1RM, bei Gleichstand das höhere Verhältnis. Divisor: jüngste Gewichtsmessung am/vor dem Workoutdatum (bei gleichem Datum letzter Eintrag), sonst Profilgewicht. Fehlen beide Quellen, dient die früheste vorhandene gültige Körpergewichtsmessung als Näherung für ältere Trainings (bei gleichem Datum letzter Eintrag). Dieser letzte Rückfall berechnet ausschließlich Ränge und speichert weder ein Teilprofil noch rückdatierte Messungen. Ohne Körpergewicht aus einer dieser Quellen kein Übungsrang.

Freie Klimmzüge/Dips verwenden Körpergewicht plus explizites Zusatzgewicht (0 gültig; leer unbekannt); unterstützte Varianten bleiben ungewertet. Kurzhanteln werden je Hand erfasst und verdoppelt, auch bei einarmigen Varianten. Nicht sinnvoll zuordenbare Übungen und Goblet-/Einzelhantel-Spezialvarianten bleiben ungewertet. Bestehende Profile, Sicherungen und Übungs-/Workout-IDs werden nicht umgeschrieben.

Review-Korrektur v92: Namen/Geräte mit `assist*`, `unterstützt`, Gravitron, Negativ/Negative/Eccentric, Australian/Inverted sowie Band/Bands/Banded bleiben ausgeschlossen. Klimmzüge/Chin-ups und Dips mit Machine/Maschine im Namen oder Gerät werden ebenfalls nicht gewertet: eingetragene Unterstützung ist kein Zusatzgewicht. Freie Varianten mit ausdrücklich erfasstem Zusatzgewicht bleiben rangfähig.

## Standards

Neun Untergrenzen, jeweils e1RM/Körpergewicht, in Reihenfolge High Estrogen, Low Estrogen, Low Melanin, High Melanin, Protein Farter, BPC-157 Considerer, Batman Cycle, Superman Cycle, Tren Cougher. Weibliche Schwellen = männlich × Faktor; ohne `profile.sex === 'female'` gilt männlich. Drei gleich breite Intervalle zwischen Ranggrenzen ergeben I/II/III. Tren Cougher ohne Unterstufen: insgesamt 25 Stufen, Index 0–24.

| Übung | Schwellen männlich | Faktor weiblich |
|---|---|---|
| Bankdrücken | 0 / .4 / .65 / .9 / 1.15 / 1.4 / 1.65 / 1.9 / 2.2 | .65 |
| Schrägbank | 0 / .35 / .55 / .75 / 1 / 1.2 / 1.4 / 1.65 / 1.9 | .65 |
| Kniebeuge | 0 / .6 / .9 / 1.2 / 1.5 / 1.8 / 2.1 / 2.5 / 3 | .75 |
| Kreuzheben | 0 / .8 / 1.1 / 1.5 / 1.8 / 2.2 / 2.6 / 3 / 3.5 | .75 |
| Rumänisches KH | 0 / .6 / .85 / 1.1 / 1.4 / 1.7 / 2 / 2.3 / 2.7 | .75 |
| Schulterdrücken | 0 / .25 / .4 / .55 / .7 / .85 / 1 / 1.15 / 1.35 | .65 |
| Rudern | 0 / .35 / .55 / .75 / 1 / 1.2 / 1.4 / 1.65 / 1.9 | .65 |
| Klimmzug, Gesamtlast | 0 / .65 / .85 / 1 / 1.2 / 1.4 / 1.6 / 1.85 / 2.1 | .75 |
| Latzug | 0 / .4 / .6 / .8 / 1 / 1.2 / 1.4 / 1.65 / 1.9 | .65 |
| Dips, Gesamtlast | 0 / .65 / .85 / 1 / 1.2 / 1.45 / 1.7 / 2 / 2.3 | .70 |
| Beinpresse | 0 / 1 / 1.5 / 2 / 2.75 / 3.5 / 4.25 / 5 / 6 | .75 |
| Curls | 0 / .2 / .3 / .42 / .55 / .68 / .82 / 1 / 1.2 | .60 |
| Trizeps | 0 / .25 / .38 / .5 / .65 / .8 / .95 / 1.12 / 1.35 | .65 |
| Seitheben | 0 / .12 / .2 / .27 / .33 / .4 / .5 / .62 / .75 | .65 |
| Fly | 0 / .22 / .38 / .55 / .72 / .9 / 1.1 / 1.32 / 1.55 | .65 |
| Beinbeuger | 0 / .25 / .4 / .55 / .7 / .9 / 1.1 / 1.3 / 1.5 | .75 |
| Beinstrecker | 0 / .3 / .5 / .7 / .9 / 1.1 / 1.3 / 1.55 / 1.8 | .75 |
| Hip Thrust | 0 / .6 / 1 / 1.4 / 1.8 / 2.2 / 2.6 / 3 / 3.5 | .80 |

Nachkalibrierung v90: Curls, Trizeps, Seitheben und Fly waren deutlich großzügiger als die Grundübungen (Seitheben 12 kg Kurzhantel × 12 bei 85 kg ergab Superman Cycle III, 27 kg Maschine × 12 Tren Cougher) und hoben den Gesamtrang. Mit den neuen Schwellen landen diese Beispiele bei Protein Farter III bzw. BPC-157 Considerer II; Grundübungen, Beinbeuger und Beinstrecker sind unverändert. Bestehende Workouts werden nicht umgeschrieben, Ränge werden nur neu berechnet.

Gerätefaktoren auf Schwellen: Smith 1.05, Maschinen 1.15, Kabel .9. Kurzhantel-Pressen .8, Kurzhantel-Rudern/Kniebeuge/Heben .9, Kurzhantel-Fly .75, sonst 1. Maschinen-Isolationen, Latzug und Beinpresse haben eigene Standards, Faktor 1. Einarmige/einbeinige Maschinen/Kabel halbieren Schwellen; Kurzhanteln verwenden die verdoppelte Handlast. Frontkniebeuge zusätzlich .8. Zuordnung über Bibliothek, Übungsbuch, Name und Gerät; Maschinenhebel bleiben Näherungen.

## Gesamt und Freunde

Gruppen: Brust, Quadrizeps, hintere Kette, Rücken, Schultern, Bizeps, Trizeps. Je Gruppe gewinnt eine Übung nach kontinuierlichem Stufenwert, dann Verhältnis. Ab der ersten gerankten Übung zählen die besten höchstens fünf vorhandenen Gruppen gleich gewichtet. Ihr arithmetischer Mittelwert der kontinuierlichen Stufenwerte ergibt Gesamtrang/Fortschritt: fehlende Gruppen liefern weder Punkte noch einen Bonus, mehrere Übungen derselben Gruppe erhalten keine zusätzlichen Stimmen. Der Mittelwert bleibt zwischen dem kleinsten und größten berücksichtigten Gruppenwert; neue schwächere Gruppen können ihn senken. Ohne gerankte Übung bleibt „Rang unbekannt“. Die kg-Anzeige berechnet die nötige Verbesserung einer gewählten Übung bei gleicher Wiederholungszahl/Körpergewicht; eine neue Auswahl der besten Übungen/Gruppen kann das Ziel ändern.

Ersttraining (v92, lokal): Ein vollständig gespeichertes Onboarding-Profil mit Gewicht genügt als Gewichtsquelle, eine Messreihe ist nicht nötig. Bisher sperrten weniger als drei Gruppen den Gesamtrang, während einzelne bekannte Übungen bereits Ränge erhielten. Nach Skip ohne Profilgewicht/Messung fehlen dagegen alle Übungsränge. Nicht zugeordnete Namen, unerledigte Sätze sowie Wiederholungen außerhalb 1–12 bleiben weitere Ausschlussgründe. Ergänzte gezielte Namen: Cable Crossover/Cross-Over, Peck Deck, Hamstring Curl, Knee Extension sowie Latziehen, Beinbeugen/Beinstrecken, Brustdrücken und Schulterdrücken; bestehende Maschinen-/Kabel-/Kurzhantelfaktoren bleiben maßgeblich. Bodyweight-/Band-/Assisted- und nicht vergleichbare Spezialvarianten werden dadurch nicht neu freigegeben (bestehende ausdrücklich geloggte Klimmzüge/Dips bleiben erhalten; Straight-Arm Pulldowns sind keine normalen Latzüge).

Ohne Körpergewicht bietet die Abschluss-Rangseite „Gewicht eintragen“ und öffnet das bestehende Gewichtsformular am Workoutdatum. Die Rangansicht bietet denselben Knopf und kehrt nach erfolgreichem Speichern zur neu berechneten Ansicht zurück. Keine Ersatzgewichte oder neuen Profilfelder. Beim ersten Übungsrang steht „Neu“, ohne Aufstiegsbehauptung/-ton; der Balken beginnt bei null und füllt sich bis zum tatsächlichen Fortschritt in der aktuellen Stufe (an einer exakten Stufengrenze bleibt er null). Reduzierte Bewegung zeigt direkt den Endstand.

Auf der Abschlussseite erscheint „Gewicht eintragen“ nur für nach `classify()` grundsätzlich rangfähige Übungen; Push-ups und andere ausgeschlossene Varianten zeigen auch ohne Körpergewicht „ohne Rang“. Die Gesamtrang-Feier verwendet `display.lastRankSeen` als Hochwassermarke: sinkende Ränge werden nicht gespeichert, das erneute Erreichen eines bereits gesehenen Rangs löst keine Feier aus. Profilwechsel behalten ihre eigene Ausgangsbasis. Bestehende Werte 25/26 bleiben unverändert gültig und werden nicht abgesenkt; es gibt kein neues Profilfeld und keine Schemaänderung.

Freunde: Gesamtrang-Stufenindex, Gleichstand Mittel der veröffentlichten Übungsverhältnisse (max. 40), danach eigene Person/Name. Übungsvergleich: Stufenindex und Verhältnis der gewählten Übung. Geräte-/Namensvarianten behalten getrennte kanonische Schlüssel; Synonyme werden nicht geraten. Geteilte Leistungen sind Clientangaben, keine serverseitig verifizierten Werte.

## API und Migration

`strength-ranks.js` nach Bibliothek/Training/Freunde, vor `puls-data-v87.js` und `friends-board.js`. `pulsStrength`: `ranks`, `standards`, `classify`, `weightAt`, `rankAt(score)`, `all(source?, until?)`, `exerciseRank(exId, source?, until?)`, `overall(source?, until?)`, `summary(source?, until?)`. Ergebnis: `index` (Gruppe 0–8), `rankIndex` (Stufe 0–24), `score` (kontinuierlich), Name/Stufe/Verhältnis/nächste Grenze/Fortschritt; Übungen ergänzen Name/Schlüssel, Gesamt ergänzt gewählte Übungen/`nextLift`. Keine Speicher-/Profilmutation. Bisherige `pulsData87.rankFor*` und `PULS_RANKS` liefern Kraftränge; `userLevel`/`level` bleiben XP-basiert. `display.lastRankSeen` speichert die Stufe, alte Werte bis 26 bleiben importierbar.

`summary`: `{strength_rank,lift_ranks:[{key,name,rankIndex,ratio}]}`, max. 40, Ratio auf zwei Nachkommastellen. Keine zusätzlichen absoluten Lasten/Gewichte/Geschlechtsdaten. Dirty-, Konflikt-, Recovery-, Revisions- und Konto-Wechsel-Sperren bleiben erhalten. Alter Server: zuerst ohne `p_strength`, nötigenfalls danach ohne `p_xp`; fremde fehlende Kraftränge bleiben unbekannt.

SQL-Quellprüfung v92: `backend/friends-strength.sql` verlangt keine Mindestanzahl von Übungen/Muskelgruppen. Ein Gesamtrang 0–24 mit nur einem oder zwei gültigen Lift-Einträgen erfüllt unverändert die Payload-Regeln. Keine SQL-Änderung oder Live-Ausführung; dies belegt keine Live-RLS.

Manuelle Reihenfolge: vorhandene `friends.sql` → `friends-ranks.sql` → neue [friends-strength.sql](../backend/friends-strength.sql). Wiederholbare Transaktion, entfernt alte Publish-Signaturen; ein optionaler JSON-Parameter. NULL erhält frühere Kraftdaten, `{strength_rank:null,lift_ranks:[]}` löscht sie explizit. JSON-Prüfung: Struktur, Typen, Duplikate, Grenzen, Dezimalstellen, 32 KiB. Snapshot nur self/angenommene Freunde. SECURITY DEFINER, leerer search_path, `auth.uid()`, RPC-only und Revisionsprüfung bleiben erhalten.

Prüfungen: `check-strength-ranks.cjs`, erweiterte Freunde-/Board-/v87-Datentests und Gesamtsuite. VM-/Quelltests führen PostgreSQL nicht aus und belegen keine Live-RLS. 390 × 844, Hell/Dunkel-Kontrast und unabhängiges Review bleiben beim Koordinator: Browserhost/native Pipe hier nicht verfügbar. Vor Veröffentlichung zentral versionieren; dieses Paket erhöht keine Version. Parallele `quick-account-v87`-Dateien unverändert, Konto-Rangzeile weiterhin in `friends-board.js`.
