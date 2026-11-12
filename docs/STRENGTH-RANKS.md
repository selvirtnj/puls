# Kraft-Ränge, Vorbereitung v94

Lokal vorbereitet am 09.11.2026, Basis `a974a65`, ohne Veröffentlichung/Live-SQL. Die Schwellen sind Produktstandards, keine Bevölkerungsperzentile. XP/Level bleiben unabhängig.

## Modell

Abgeschlossene Workouts bis zum angefragten Tag, inklusive CSV-Import, mit erledigten Sätzen und bekannten kg/1–12 ganzzahligen Reps. Eine Wiederholung verwendet die tatsächliche Last, sonst Epley `Last × (1 + Reps / 30)`. Je kanonischer Übung zählt das höchste e1RM, bei Gleichstand das höhere Verhältnis. Divisor: jüngste Gewichtsmessung am/vor dem Workoutdatum (bei gleichem Datum letzter Eintrag), sonst Profilgewicht. Fehlen beide Quellen, dient die früheste vorhandene gültige Körpergewichtsmessung als Näherung für ältere Trainings (bei gleichem Datum letzter Eintrag). Dieser letzte Rückfall berechnet ausschließlich Ränge und speichert weder ein Teilprofil noch rückdatierte Messungen. Ohne Körpergewicht aus einer dieser Quellen kein Übungsrang.

Freie Klimmzüge/Dips verwenden Körpergewicht plus explizites Zusatzgewicht (0 gültig; leer unbekannt); unterstützte Varianten bleiben ungewertet. Kurzhanteln werden je Hand erfasst und verdoppelt, auch bei einarmigen Varianten. Nicht sinnvoll zuordenbare Übungen und Goblet-/Einzelhantel-Spezialvarianten bleiben ungewertet. Bestehende Profile, Sicherungen und Übungs-/Workout-IDs werden nicht umgeschrieben.

Review-Korrektur v92: Namen/Geräte mit `assist*`, `unterstützt`, Gravitron, Negativ/Negative/Eccentric, Australian/Inverted sowie Band/Bands/Banded bleiben ausgeschlossen. Klimmzüge/Chin-ups und Dips mit Machine/Maschine im Namen oder Gerät werden ebenfalls nicht gewertet: eingetragene Unterstützung ist kein Zusatzgewicht. Freie Varianten mit ausdrücklich erfasstem Zusatzgewicht bleiben rangfähig.

## Standards, Vorbereitung v94 auf Skala 2

18 Eigennamen, in DE und EN identisch. Genau 40 Stufen, Index 0 bis 39 und unverändert rank_scale 2. Die ersten fünf Ränge haben je drei Stufen, die folgenden zwölf je zwei, Mr. Olympia eine. Anzeigename aus Rangname und I/II/III, beim letzten Rang ohne Zusatz.

| Rang | Stufenindex | Zusatz |
|---|---|---|
| Gym Tourist | 0, 1, 2 | I / II / III |
| High Estrogen | 3, 4, 5 | I / II / III |
| Low Estrogen | 6, 7, 8 | I / II / III |
| Low Melanin | 9, 10, 11 | I / II / III |
| High Melanin | 12, 13, 14 | I / II / III |
| Pre-Workout Itcher | 15, 16 | I / II |
| Creatine Bloater | 17, 18 | I / II |
| Protein Farter | 19, 20 | I / II |
| Test Booster Believer | 21, 22 | I / II |
| BPC-157 Considerer | 23, 24 | I / II |
| Blast & Cruiser | 25, 26 | I / II |
| Batman Cycle | 27, 28 | I / II |
| Superman Cycle | 29, 30 | I / II |
| Tren Cougher | 31, 32 | I / II |
| Insulin Gambler | 33, 34 | I / II |
| HGH Gut | 35, 36 | I / II |
| Open Class Monster | 37, 38 | I / II |
| Mr. Olympia | 39 | ohne Zusatz |

Die sechs Kalibrierpunkte pro Übung liegen bei Stufe 7/13/20/27/35/39 für Anfänger, erste Erfahrung, mehrjähriges Hobbytraining, sehr fortgeschritten, Elite und außergewöhnliches Wettkampfniveau. Dazwischen werden die Ranguntergrenzen linear interpoliert, innerhalb eines Rangs ebenfalls linear nach dessen tatsächlicher Stufenanzahl. Rundung der Verhältnisschwellen auf vier Dezimalstellen. Orientierung an öffentlichen Standards, mit bewusst eigener Produktkalibrierung. Bankdrücken etwa 1,2 bei Stufe 20, 1,6 bei 27, 2 bei 35 und 2,4 bei 39. Kniebeuge entsprechend 1,55 / 2,05 / 2,6 / 3,1, Kreuzheben 1,85 / 2,4 / 3 / 3,5. Spätere Leistungsbereiche verlangen größere Lastsprünge. Die ersten 13 Stufen liegen unter dem Novizenanker. Einzelne Stufenabstaende sind uebungsabhaengig.

Referenz für die Größenordnung sind Strength Levels e1RM/KG-Tabellen für [Bankdrücken](https://strengthlevel.com/strength-standards/bench-press), [Kniebeuge](https://strengthlevel.com/strength-standards/squat) und [Seitheben](https://strengthlevel.com/strength-standards/dumbbell-lateral-raise), abgerufen am 09.11.2026. Die Seitheben-Referenz verwendet eine Hantel, PULS weiterhin beide Hanteln zusammen. Isolationsübungen haben niedrigere absolute Verhältnisse als Grunduebungen. Die Standards sind keine Bevölkerungsperzentile und keine Prüfung von Wettkampfregeln oder Bodybuilding-Erfolgen. Die oberste sechste Schwelle ist eine zusätzliche PULS-Produktgrenze.

Zusaetzliche Produktentscheidung in diesem Paket, aus dem unfertigen Agentenansatz uebernommen: Maschinen, Kabel, Smith und erkennbare Stack-/Hebeluebungen können höchstens Stufe 22 erreichen. Verschiedene Hebel, Umlenkungen und Stackbeschriftungen liefern keine ausreichend vergleichbare Grundlage für Elite-Ränge. Oberhalb davon werden freie Gewichte oder freie Klimmzuege/Dips benoetigt. Das betrifft auch Einzeluebungsraenge. Der Mittelwert des Gesamtrangs bleibt unverändert und kann mit höheren freien Leistungen ueber 22 steigen. Es gibt keine neue Mindestzahl an Muskelgruppen. Gespeicherte Lasten und IDs bleiben erhalten. Erreicht eine Übung ihr Limit, liefert sie kein weiteres kg-Ziel; eine Verbesserung ueber das Limit wird auch für das Gesamtziel ausgeschlossen. Ohne passende andere Übung bleibt nextLift null.

Kabel-/Maschinen-/Rope-Hammercurls verwenden die eingetragene Gesamtlast, freie Hammercurls wie bisher je Hand. Das korrigiert eine bisherige Verdoppelung von Stacklasten. Kanonische Schlüssel folgen weiterhin Gerät und Übungsname; dadurch kann der zuvor falsch als dumbbell klassifizierte Kabel-Hammercurl einen korrigierten Vergleichsschluessel erhalten. Lokale Uebungs- und Workout-IDs werden nie geaendert.

Männliche Ranguntergrenzen, e1RM/KG, in der Reihenfolge der 18 Ränge oben. Weibliche Faktoren pro Typ wie bisher, .6 bis .8. Ohne profile.sex female gelten männliche Schwellen. Gerätefaktoren bleiben Smith 1.05, Maschine 1.15, Kabel .9. Eigene Maschinenstandards für Isolationen, Latzug und Beinpresse verwenden Faktor 1. Kurzhantel-Pressen .8, Rudern/Kniebeuge/Heben .9, Fly .75, sonst 1. Einseitige Maschinen/Kabel halbieren Schwellen, Frontkniebeuge zusaetzlich .8.

| Typ | Männliche Ranguntergrenzen |
|---|---|
| bench | 0 / 0.2571 / 0.5143 / 0.6833 / 0.8083 / 0.95 / 1.05 / 1.15 / 1.2571 / 1.3714 / 1.4857 / 1.6 / 1.7 / 1.8 / 1.9 / 2 / 2.2 / 2.4 |
| incline | 0 / 0.2143 / 0.4286 / 0.5733 / 0.6833 / 0.8 / 0.88 / 0.96 / 1.05 / 1.15 / 1.25 / 1.35 / 1.4375 / 1.525 / 1.6125 / 1.7 / 1.875 / 2.05 |
| squat | 0 / 0.3429 / 0.6857 / 0.9167 / 1.0917 / 1.2643 / 1.3786 / 1.4929 / 1.6214 / 1.7643 / 1.9071 / 2.05 / 2.1875 / 2.325 / 2.4625 / 2.6 / 2.85 / 3.1 |
| deadlift | 0 / 0.4286 / 0.8571 / 1.1333 / 1.3333 / 1.5286 / 1.6571 / 1.7857 / 1.9286 / 2.0857 / 2.2429 / 2.4 / 2.55 / 2.7 / 2.85 / 3 / 3.25 / 3.5 |
| rdl | 0 / 0.3429 / 0.6857 / 0.9167 / 1.0917 / 1.2643 / 1.3786 / 1.4929 / 1.6143 / 1.7429 / 1.8714 / 2 / 2.125 / 2.25 / 2.375 / 2.5 / 2.7 / 2.9 |
| overhead | 0 / 0.1714 / 0.3429 / 0.4567 / 0.5417 / 0.63 / 0.69 / 0.75 / 0.8157 / 0.8871 / 0.9586 / 1.03 / 1.0975 / 1.165 / 1.2325 / 1.3 / 1.425 / 1.55 |
| row | 0 / 0.2143 / 0.4286 / 0.5667 / 0.6667 / 0.7771 / 0.8543 / 0.9314 / 1.0171 / 1.1114 / 1.2057 / 1.3 / 1.3875 / 1.475 / 1.5625 / 1.65 / 1.825 / 2 |
| pullup | 0 / 0.4286 / 0.8571 / 1.0433 / 1.1083 / 1.2014 / 1.2729 / 1.3443 / 1.4186 / 1.4957 / 1.5729 / 1.65 / 1.725 / 1.8 / 1.875 / 1.95 / 2.1 / 2.25 |
| pulldown | 0 / 0.2143 / 0.4286 / 0.5667 / 0.6667 / 0.7771 / 0.8543 / 0.9314 / 1.0171 / 1.1114 / 1.2057 / 1.3 / 1.3875 / 1.475 / 1.5625 / 1.65 / 1.825 / 2 |
| dip | 0 / 0.4286 / 0.8571 / 1.0667 / 1.1667 / 1.2714 / 1.3429 / 1.4143 / 1.4929 / 1.5786 / 1.6643 / 1.75 / 1.8375 / 1.925 / 2.0125 / 2.1 / 2.275 / 2.45 |
| legpress | 0 / 0.4714 / 0.9429 / 1.3 / 1.6 / 1.9286 / 2.1571 / 2.3857 / 2.6429 / 2.9286 / 3.2143 / 3.5 / 3.775 / 4.05 / 4.325 / 4.6 / 5.1 / 5.6 |
| curl | 0 / 0.1071 / 0.2143 / 0.2933 / 0.3583 / 0.4286 / 0.4771 / 0.5257 / 0.5829 / 0.6486 / 0.7143 / 0.78 / 0.835 / 0.89 / 0.945 / 1 / 1.1 / 1.2 |
| triceps | 0 / 0.0857 / 0.1714 / 0.2433 / 0.3083 / 0.3786 / 0.4271 / 0.4757 / 0.5314 / 0.5943 / 0.6571 / 0.72 / 0.7775 / 0.835 / 0.8925 / 0.95 / 1.05 / 1.15 |
| lateral | 0 / 0.0514 / 0.1029 / 0.1533 / 0.2033 / 0.26 / 0.3 / 0.34 / 0.3857 / 0.4371 / 0.4886 / 0.54 / 0.5925 / 0.645 / 0.6975 / 0.75 / 0.825 / 0.9 |
| fly | 0 / 0.15 / 0.3 / 0.4267 / 0.5417 / 0.6714 / 0.7629 / 0.8543 / 0.9571 / 1.0714 / 1.1857 / 1.3 / 1.4125 / 1.525 / 1.6375 / 1.75 / 1.925 / 2.1 |
| legcurl | 0 / 0.15 / 0.3 / 0.41 / 0.5 / 0.5986 / 0.6671 / 0.7357 / 0.8129 / 0.8986 / 0.9843 / 1.07 / 1.16 / 1.25 / 1.34 / 1.43 / 1.59 / 1.75 |
| legextension | 0 / 0.1629 / 0.3257 / 0.46 / 0.58 / 0.7086 / 0.7971 / 0.8857 / 0.9829 / 1.0886 / 1.1943 / 1.3 / 1.4075 / 1.515 / 1.6225 / 1.73 / 1.915 / 2.1 |
| hipthrust | 0 / 0.2571 / 0.5143 / 0.75 / 0.975 / 1.2071 / 1.3643 / 1.5214 / 1.7 / 1.9 / 2.1 / 2.3 / 2.5 / 2.7 / 2.9 / 3.1 / 3.4 / 3.7 |

Legacy-Konvertierung bleibt numerisch exakt wie v93. fromLegacy ergibt für 0 bis 24 die Werte 0,2,4,6,7,8,9,10,11,12,14,16,18,20,22,24,26,28,30,32,34,36,37,38,39. toLegacy bleibt die zugehoerige inverse Intervallabbildung. Aufgrund der neuen Kalibrierung und Rangverteilung sind alte und neue Rangnamen an diesen Indizes verschieden. Ältere v93-Freundezusammenfassungen haben dieselbe Skala 2 und bleiben bis zur nächsten Veroeffentlichung durch den jeweiligen Client nach alten Schwellen berechnet. Aus dem geteilten Index allein kann die App dies nicht nachtraeglich rekonstruieren.

## Gesamt und Freunde

Gruppen: Brust, Quadrizeps, hintere Kette, Rücken, Schultern, Bizeps, Trizeps. Je Gruppe gewinnt eine Übung nach kontinuierlichem Stufenwert, dann Verhältnis. Ab der ersten gerankten Übung zählen die besten höchstens fünf vorhandenen Gruppen gleich gewichtet. Ihr arithmetischer Mittelwert der kontinuierlichen Stufenwerte ergibt Gesamtrang/Fortschritt: fehlende Gruppen liefern weder Punkte noch einen Bonus, mehrere Übungen derselben Gruppe erhalten keine zusätzlichen Stimmen. Der Mittelwert bleibt zwischen dem kleinsten und größten berücksichtigten Gruppenwert; neue schwächere Gruppen können ihn senken. Ohne gerankte Übung bleibt „Rang unbekannt“. Die kg-Anzeige berechnet die nötige Verbesserung einer gewählten Übung bei gleicher Wiederholungszahl/Körpergewicht; eine neue Auswahl der besten Übungen/Gruppen kann das Ziel ändern.

Ersttraining (v92, lokal): Ein vollständig gespeichertes Onboarding-Profil mit Gewicht genügt als Gewichtsquelle, eine Messreihe ist nicht nötig. Bisher sperrten weniger als drei Gruppen den Gesamtrang, während einzelne bekannte Übungen bereits Ränge erhielten. Nach Skip ohne Profilgewicht/Messung fehlen dagegen alle Übungsränge. Nicht zugeordnete Namen, unerledigte Sätze sowie Wiederholungen außerhalb 1–12 bleiben weitere Ausschlussgründe. Ergänzte gezielte Namen: Cable Crossover/Cross-Over, Peck Deck, Hamstring Curl, Knee Extension sowie Latziehen, Beinbeugen/Beinstrecken, Brustdrücken und Schulterdrücken; bestehende Maschinen-/Kabel-/Kurzhantelfaktoren bleiben maßgeblich. Bodyweight-/Band-/Assisted- und nicht vergleichbare Spezialvarianten werden dadurch nicht neu freigegeben (bestehende ausdrücklich geloggte Klimmzüge/Dips bleiben erhalten; Straight-Arm Pulldowns sind keine normalen Latzüge).

Ohne Körpergewicht bietet die Abschluss-Rangseite „Gewicht eintragen“ und öffnet das bestehende Gewichtsformular am Workoutdatum. Die Rangansicht bietet denselben Knopf und kehrt nach erfolgreichem Speichern zur neu berechneten Ansicht zurück. Keine Ersatzgewichte oder neuen Profilfelder. Beim ersten Übungsrang steht „Neu“, ohne Aufstiegsbehauptung/-ton; der Balken beginnt bei null und füllt sich bis zum tatsächlichen Fortschritt in der aktuellen Stufe (an einer exakten Stufengrenze bleibt er null). Reduzierte Bewegung zeigt direkt den Endstand.

Auf der Abschlussseite erscheint „Gewicht eintragen“ nur für nach `classify()` grundsätzlich rangfähige Übungen; Push-ups und andere ausgeschlossene Varianten zeigen auch ohne Körpergewicht „ohne Rang“. Die Gesamtrang-Feier verwendet `display.lastRankSeen` als Hochwassermarke: sinkende Ränge werden nicht gespeichert, das erneute Erreichen eines bereits gesehenen Rangs löst keine Feier aus. Profilwechsel behalten ihre eigene Ausgangsbasis.

Migration v93: `display.rankScale: 2` kennzeichnet die 40-Stufen-Skala (optionales Feld, alte Sicherungen ohne Feld bleiben gültig). `pulsData87.migrate()` (Start, Render, Import, Cloud-Übernahme) und vorsorglich `celebrate()` bilden einen unmarkierten Wert einmalig ab: alte Stufe 0–24 → `max(fromLegacy(alt), aktueller Rang)`, damit geteilte Stufen nach dem Update keine Feier auslösen; Altwerte 25/26 (und unmögliche Werte) gelten als „noch nicht gesehen“, der aktuelle Rang wird Ausgangspunkt (ohne Rang: Feld entfällt). Danach `rankScale: 2`, keine zweite Migration. Speichern erst mit dem nächsten regulären Speichern. `validData()` akzeptiert `lastRankSeen` 0–39 und `rankScale` nur als 2. Grenze: Eine alte App-Version (≤ 92) entfernt `rankScale` als unbekanntes Feld; synchronisiert sie das Profil zurück, wird der Wert erneut als alte Skala gelesen. Folge ist höchstens eine ausbleibende Feier, keine falsche.

Freunde: Gesamtrang-Stufenindex, Gleichstand Mittel der veröffentlichten Übungsverhältnisse (max. 40), danach eigene Person/Name. v93: Zusammenfassungen tragen `rank_scale: 2`. Fremde Zeilen ohne `rank_scale` (alte App-Version oder alter Server) gelten als Skala 1, werden in `friends.js` auf 0–24 geprüft und in `friends-board.js` per `fromLegacy` angezeigt; Skala-2-Zeilen werden auf 0–39 geprüft. Embleme v94: vier weitere Motive für Insulin Gambler (Würfel), HGH Gut (Bauch), Open Class Monster (Monster) und Mr. Olympia (Pokal), mit eigenen Farben und Formen. Stufenpunkte und Rangliste richten sich nach der tatsächlichen Stufenanzahl. Embleme v93: eigene Embleme für Gym Tourist (Stein, Kreis, Kamera), Pre-Workout Itcher (Orange, Sechseck, Messlöffel), Creatine Bloater (Oliv, Sechseck mit Ring, Ballon), Test Booster Believer (Bronze, Wappen mit Ring, Kapsel), Blast & Cruiser (Petrol, Wappen mit Flügeln und Ring, Kreislaufpfeile); bestehende Embleme unverändert. Übungsvergleich: Stufenindex und Verhältnis der gewählten Übung. Geräte-/Namensvarianten behalten getrennte kanonische Schlüssel; Synonyme werden nicht geraten. Geteilte Leistungen sind Clientangaben, keine serverseitig verifizierten Werte.

## API und Migration

`strength-ranks.js` nach Bibliothek/Training/Freunde, vor `puls-data-v87.js` und `friends-board.js`. `pulsStrength`: `ranks`, `standards`, `classify`, `weightAt`, `rankAt(score)`, `all(source?, until?)`, `exerciseRank(exId, source?, until?)`, `overall(source?, until?)`, `summary(source?, until?)`, `scale` (2), `maxRankIndex` (39), `fromLegacy(i)`, `toLegacy(n)`. Ergebnis: `index` (Gruppe 0–17), `rankIndex` (Stufe 0–39), `score` (kontinuierlich), Name/Stufe/Verhältnis/nächste Grenze/Fortschritt; Übungen ergänzen Name/Schlüssel, Gesamt ergänzt gewählte Übungen/`nextLift`. Keine Speicher-/Profilmutation. Bisherige `pulsData87.rankFor*` und `PULS_RANKS` liefern Kraftränge; `userLevel`/`level` bleiben XP-basiert. `display.lastRankSeen` speichert die Stufe (Skala 2, Migration siehe oben).

`summary`: `{strength_rank,lift_ranks:[{key,name,rankIndex,ratio}],rank_scale:2}`, max. 40, Ratio auf zwei Nachkommastellen. Keine zusätzlichen absoluten Lasten/Gewichte/Geschlechtsdaten. Dirty-, Konflikt-, Recovery-, Revisions- und Konto-Wechsel-Sperren bleiben erhalten. Fallback-Kette: Server vor v2 (`friends-strength.sql`) lehnt `rank_scale`/Stufen > 24 mit 400/22023 „Invalid strength …“ ab → einmal je Seite `toLegacy`-Indizes ohne `rank_scale` senden; Server ohne `p_strength` (404/PGRST202) → ohne `p_strength`; danach nötigenfalls ohne `p_xp`. Ein nicht umrechenbarer Rang sendet kein `p_strength` (NULL erhält den alten Serverstand), nie die explizite Löschung. Fremde fehlende Kraftränge bleiben unbekannt.

SQL v93: [friends-strength-v2.sql](../backend/friends-strength-v2.sql) (laut Archiv (docs/archive/CURRENT-STATE-bis-v95.md) v93 bereits eingerichtet, hier nicht live geprüft) ersetzt `friends-strength.sql` vollständig: Spalte `rank_scale smallint` (NULL = Skala 1, 2 = Skala 2), Constraints `strength_rank` 0–24 bzw. 0–39 je Skala, Validator `puls_valid_lift_ranks(jsonb,integer)` ersetzt die alte Ein-Argument-Version (keine Überladung), `p_strength` mit 2 Schlüsseln oder optional `rank_scale: 2`, Rang/Übungen/Skala werden immer gemeinsam gesetzt (alte Clients setzen die Skala zurück auf NULL), Snapshot liefert `rank_scale` für self/angenommene Freunde. Publish-Signatur unverändert, SECURITY DEFINER, leerer search_path, `auth.uid()`, Revisionsprüfung und RPC-only bleiben. Reihenfolge: `friends.sql` → `friends-ranks.sql` → (optional `friends-strength.sql`) → `friends-strength-v2.sql`; danach nicht erneut `friends-strength.sql` einspielen. Grenze: App-Versionen ≤ 92 lesen Skala-2-Werte eines v93-Freundes als alte Stufen (Werte > 24 als „Rang unbekannt“), bis sie aktualisiert sind.

SQL-Quellprüfung v92: `backend/friends-strength.sql` verlangt keine Mindestanzahl von Übungen/Muskelgruppen. Ein Gesamtrang 0–24 (v2: 0–39 mit `rank_scale` 2) mit nur einem oder zwei gültigen Lift-Einträgen erfüllt unverändert die Payload-Regeln. Keine SQL-Änderung oder Live-Ausführung; dies belegt keine Live-RLS.

Manuelle Reihenfolge: vorhandene `friends.sql` → `friends-ranks.sql` → neue [friends-strength.sql](../backend/friends-strength.sql). Wiederholbare Transaktion, entfernt alte Publish-Signaturen; ein optionaler JSON-Parameter. NULL erhält frühere Kraftdaten, `{strength_rank:null,lift_ranks:[]}` löscht sie explizit. JSON-Prüfung: Struktur, Typen, Duplikate, Grenzen, Dezimalstellen, 32 KiB. Snapshot nur self/angenommene Freunde. SECURITY DEFINER, leerer search_path, `auth.uid()`, RPC-only und Revisionsprüfung bleiben erhalten.

Prüfungen: `check-strength-ranks.cjs`, erweiterte Freunde-/Board-/v87-Datentests und Gesamtsuite. VM-/Quelltests führen PostgreSQL nicht aus und belegen keine Live-RLS. 390 × 844, Hell/Dunkel-Kontrast und unabhängiges Review bleiben beim Koordinator: Browser-/iPhone-Prüfung in diesem Paket nicht durchgeführt. Vor Veröffentlichung zentral versionieren; dieses Paket erhöht keine Version. Parallele `quick-account-v87`-Dateien unverändert, Konto-Rangzeile weiterhin in `friends-board.js`.

## Prüfung und Integration dieses Pakets

Synthetische Regressionen für Anfänger, guten Hobby-Lifter, sehr Fortgeschrittene und Elite sowie alle 40 Stufennamen, Grenzen, Legacy-Konvertierung, Stack-Hammercurls und Gerätelimits. Migrationstest mit rankScale 2 und lastRankSeen 39 bei niedrigerem aktuellen Rang. Der gespeicherte Höchststand bleibt identisch, keine Feier, kein Speichern und keine Anzeige des alten Höchststands als aktuellen Rang. Auch beim Wiedererreichen bleibt die Feier aus. Profile und Sicherungen werden für v94 nicht migriert. Die bestehende v93-Migration gilt weiterhin für unmarkierte Altprofile.

Koordinator integriert Review, PROGRESS-Nachtrag, zentrale Release-Versionierung und Browser-/iPhone-Prüfung bei 390 x 844 in Hell/Dunkel. In diesem Paket keine Änderung an Server-SQL, Auth, Sync, Cache-Version oder produktiven Daten. Private CSV-Vergleiche ausschließlich im Arbeitsspeicher, ohne Datenauszuege oder persönliche Rangwerte im Repository.
