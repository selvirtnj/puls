# PULS â€” aktueller Stand und Ãœbergabe

### Version 91 (09.11.2026, veröffentlicht)

- Makro-Folie im Essen-Tab wieder mit neutraler grauer Kartenfläche statt oranger Tönung.

### Version 90 = Vollversion 1.0 (09.11.2026, verÃ¶ffentlicht, Git-Tag `v1.0`)

- Bereichsfarben: Training Blau, Essen Orange, KÃ¶rper GrÃ¼n (alle vier Schemata, Kontraste geprÃ¼ft); â€žZiel Ã¼berschrittenâ€œ im Essen-Bereich Rot. GrÃ¶ÃŸere Makro-Folie, wÃ¤rmerer Essen-Tab. Handy-Layout: ZurÃ¼ck-Pfeil Konto nicht mehr abgeschnitten, TippflÃ¤chen â‰¥44 px, Zentrierung 16/16 px (`css/v90-ui.css`).
- ErklÃ¤rtexte entfernt (kurze Datenschutz-/Zustimmungshinweise bleiben), EN-Ãœbersetzungen ergÃ¤nzt, Undo-Hinweise einheitlich. Doku: DESIGN-WORKPLAN und `docs/audit/` nach `docs/archive/`, README als Vollversion.
- Logik: MengenÃ¤nderung skaliert ungerundet; adaptiver Erhalt zÃ¤hlt vergangene Tage mit â‰¥60 % kcal-Ziel automatisch, Wochen-Check-in entfernt; Wasser nicht mehr in â€žHeute eingetragenâ€œ; Wasser-Minus entfernt genau ein Glas mit validData-sicherem Rest und konfliktgeprÃ¼ftem Undo; Strong/Hevy-Aliase; strengere Rangschwellen fÃ¼r IsolationsÃ¼bungen (Freunde sehen neue Werte nach nÃ¤chster VerÃ¶ffentlichung); leeres Workout aus Plus direkt; `designs-extra.js` und Versions-.replace-Kette entfernt (alte `appDesign`-Werte bleiben gÃ¼ltig).
- PrÃ¼fung: Gesamtaudit (Claude), Review Codex mit 2 P2 â†’ behoben und nachgeprÃ¼ft; Browser 390 Ã— 844. Codex/Gemini zeitweise im Limit (Gemini bis ca. 15.11.). Offen: iPhone-Test, Freunde mit zwei echten Konten.

### Version 89 (09.11.2026, verÃ¶ffentlicht)

- UI (Paket B, `agent/v89-ui`): Kategoriefarben Koralle/Tiefblau/Bernstein/Salbei/SportgrÃ¼n in allen Tabs inkl. laufendem Workout; neue gerÃ¤telokale Farbschemata â€žFrischâ€œ (hell) und â€žMitternachtâ€œ (dunkel) Ã¼ber `data-palette`; Tab-Titel einheitlich oben links inkl. â€žEssenâ€œ; kÃ¼rzeres Datum; Plus-MenÃ¼ mit KI-Foto neben Barcode statt Wasser; â€žSkipâ€œ statt X im Erststart; â€žâˆ’â€œ auf dem letzten vollen Wasserglas. Review Gemini ohne Befunde.
- Import/RÃ¤nge (Paket A, `agent/v89-import`), Review Claude, P3-Korrekturen von Codex: Nullwerte (Distanz/Sekunden) werden nicht gespeichert, Sessions ohne Ãœbungen werden wie in v88 Ã¼bersprungen, `routineId` nur bei Ã¼bernommenen Routinen, Rangseite mit Cache und Fehler-Fallback. Rangseite im Browser bei 390 Ã— 844 geprÃ¼ft (Testdaten).
- Offen: iPhone-Test, laufendes Workout mit echten SÃ¤tzen in den neuen Farben, Freunde-Tab mit Konto.

Details Paket A: CSV-Import ergÃ¤nzt Routinen Ã¼ber das bestehende Modell. Benannte Trainings bilden eine Routine pro Name, unbenannte wiederkehrende Muskelgruppenmuster bilden Push/Pull/Beine/Rumpf/OberkÃ¶rper/GanzkÃ¶rper. Ãœbungen mÃ¼ssen mindestens zweimal und in mindestens 30 % der Gruppe vorkommen. Verwendet werden die im letzten Training vorhandenen regelmÃ¤ÃŸigen Ãœbungen, die durchschnittliche Quellreihenfolge und dessen Satzanzahl/Wiederholungen/Gewichte. Einzeltrainings ohne Namen erzeugen keine Routine. Das Routinenmodell begrenzt die Vorlage auf zwÃ¶lf SÃ¤tze, die importierte Historie behÃ¤lt alle SÃ¤tze.
- Vorschau mit standardmÃ¤ÃŸig aktivem â€žRoutinen Ã¼bernehmenâ€œ, DE/EN und unverÃ¤nderter kg/lbs-Auswahl. Wiederimport erhÃ¤lt vorhandene IDs und lokale Ã„nderungen, Routinen lassen sich nach frÃ¼herem Opt-out ergÃ¤nzen. Optionale `routine.importWorkoutId` verweist auf die Vorbelegung aus der Historie, ohne einen parallelen Satzspeicher anzulegen. Die Import-Erweiterung von `prefillExerciseSets()` verwendet bei solchen Routinen deren letzte Session, anschlieÃŸend den bestehenden Ablauf.
- Optionale validierte `set.csvFields` erhalten Zusatzspalten einschlieÃŸlich RPE, Notizen, Distanz, Sekunden und Satztyp in Quellschreibweise/Einheiten. `set.setOrder` erhÃ¤lt auch Buchstaben. Ãœbungen fehlen vollstÃ¤ndig in einzelnen Export-Sessions, diese bleiben mit Datum/Dauer und validierten `workout.csvRows` erhalten. Bestehende Sicherungen und frÃ¼here Import-IDs bleiben gÃ¼ltig. Zusatzfelder bleiben in Backup/Sync erhalten, der bestehende Kraftsatz-Editor zeigt sie derzeit nicht an.
- Neue vierte Workout-Abschlussseite in `workout-ranks.js`/`workout-ranks.css`, nach Zusammenfassung/Serie/XP. Verwendet die Embleme von `friends-board.js` und reine neue `pulsStrength.workoutProgress()`-/`progressToNext()`-Projektionen. Rangberechnung unverÃ¤ndert. Vergleich schlieÃŸt dieses und spÃ¤tere Trainings aus dem Vorher-Stand aus, auch am gleichen Datum. Balken und Emblemwechsel Ã¼ber Web Animations bzw. `pulsMotion`, reduzierten Bewegungsmodus beachten. Rangaufstieg nutzt `rankUp` mit bestehender Klang-/Haptiksteuerung. Historische Kurzansicht bleibt erhalten.
- Regressionstests in `check-workout-import.cjs` erweitert und `check-workout-ranks.cjs` registriert. `node scripts/check.cjs` und `git diff --check` bestanden, einschlieÃŸlich echtem Abschluss-Wrapper-Ablauf im VM-Harness, Altprofil-/Restore-/Opt-out-FÃ¤llen und gemocktem Sync-Konflikt. BrowserprÃ¼fung 390 Ã— 844 hier offen, Browserinventar leer und Browserhost nicht erreichbar. Koordinator Ã¼bernimmt unabhÃ¤ngiges Review, echte Hell-/Dunkel-/iPhone-PrÃ¼fung und zentrale Versionierung. Keine VersionserhÃ¶hung, kein Commit/Push und kein Live-Backend-Eingriff in diesem Paket.

### Version 88 (09.11.2026)

- Im Arbeitsstand integriert (Verlauf `e90e86a..174b100`); VerÃ¶ffentlichung durch den Koordinator noch offen.
- Essen kompakter mit Energie-Folie vor Makros, Makros als Startansicht, Wasser in einer Reihe und mittigem Datum. Tageshaken und â€žAls Kombiâ€œ entfernt; Detailseite bÃ¼ndig ohne Dreipunkt-MenÃ¼.
- ErklÃ¤r- und Disclaimer-Texte app-weit entfernt. Plus-MenÃ¼ mit Wasser statt KI-Foto-Kachel, â€žEssen suchenâ€œ, AktivitÃ¤t mittig und KÃ¶rpermaÃŸe unten.
- Profil als EinzelblÃ¤tter, KÃ¶rperfett-Fallback nach Deurenberg, neue Zielseite, Konto ohne doppelte EintrÃ¤ge sowie KÃ¶rpermaÃŸe & Biometrie. Geschlecht bleibt nach Neustart erhalten; Ziel/Richtung und RMR nach Review korrigiert.
- Kraft-RÃ¤nge pro Ãœbung und gesamt nach Pound-for-Pound, unabhÃ¤ngig von Level/XP. Neun RÃ¤nge von High Estrogen bis Tren Cougher mit insgesamt 25 Stufen; Gesamtrang aus mindestens drei und hÃ¶chstens fÃ¼nf verschiedenen Muskelgruppen. Freunde-Vergleich pro Ãœbung und kg-Ziel zur nÃ¤chsten Stufe. Historische/importierte Workouts und bestehende IDs bleiben erhalten. [Modell und Standards](STRENGTH-RANKS.md).
- Tiefere, weichere und leisere KlÃ¤nge.
- Vorhandene Paket-C-PrÃ¼fung laut Ãœbergabe mit `node scripts/check.cjs` und `git diff --check` bestanden; VM-/Quelltests belegen keine Live-RLS. Dieser Doku-Nachtrag bestÃ¤tigt keine neuen Funktionstests.
- **OFFEN / Grenzen** â€” `backend/friends-strength.sql` live einspielen (nach `friends-ranks.sql`); bis dahin Client-Fallback auf Ã¤ltere RPC-Signaturen, fehlende fremde KraftrÃ¤nge bleiben unbekannt. Muskel-Erholungsfigur auf Nutzerwunsch vorerst zurÃ¼ckgestellt. Kein iPhone-Test; BrowserprÃ¼fung 390 Ã— 844 in Hell/Dunkel im Paket-C-Lauf wegen fehlendem Browserhost blockiert.

### Version 87 (09.11.2026)

- Im Arbeitsstand integriert (Verlauf `e8ce137..68da462`); VerÃ¶ffentlichung durch den Koordinator noch offen.
- Essen wie Diary: wischbare Ãœbersicht mit Makro-Zielen zuerst, WasserglÃ¤ser mit berechnetem Ziel und chronologisches Tagebuch ohne feste Mahlzeitenkategorien.
- HinzufÃ¼gen als Vollseite mit neun Reitern, Sortierung/Datenbankfiltern, Detailansicht mit Portionen und automatischer g/ml-Wahl nach Lebensmittelbasis, Scanner-UI sowie eigenen Kombis aus mehreren Lebensmitteln (`state.meals`). Keine g/ml-Umrechnung ohne Dichte.
- Plus-MenÃ¼ mit Suchen/Barcode/Foto/Training, eigener Mahlzeit, Rezept und Lebensmittel; ohne Voice/Notiz. Training Ã¶ffnet ein Auswahlblatt fÃ¼r bestehende TrainingsablÃ¤ufe.
- Konto als Mehr-Ãœbersicht mit Konto, Profil, Ziele, Darstellung und Entdecken; Makroziele wahlweise in Gramm oder als VerhÃ¤ltnis.
- Freunde: Bestenliste mit Podium, Embleme und zehn XP-basierte Ranggruppen von High Estrogen Iâ€“III bis Tren Cougher; Slacking-Warnen erst nach BestÃ¤tigung, Rangaufstieg mit einmaliger Feier.
- Neue synthetische WebAudio-KlÃ¤nge, zugeordnete Haptik mit eigenem Schalter und gemeinsame Bewegungsschicht `pulsMotion` mit reduzierter Bewegung.
- Workout-Tab verfeinert: Routinen-Karten, leeres Workout starten und Routinen Ã¼ber den bestehenden Editor duplizieren; vorhandene Sessions und IDs bleiben erhalten.
- Workout-CSV-Import fÃ¼r Liftoff/Hevy/Strong mit Vorschau, Einheitenwahl, Ãœbungszuordnung, Dublettenschutz und BestÃ¤tigung; historische Imports erhalten keine rÃ¼ckwirkenden XP, bleiben aber fÃ¼r Historie/e1RM/Vorbelegung nutzbar.
- Neue optionale Profilfelder: `water`, `meals`, `display`, `plan.macroInput`/`plan.ratio` und `foodSearch`; validierte Vorgaben und Migration im bestehenden Zustand, alte Sicherungen bleiben akzeptiert.
- **OFFEN / Grenzen:** `backend/friends-ranks.sql` muss live in Supabase eingespielt werden; bis dahin bei Freunden â€žRang unbekanntâ€œ. Kein iPhone-Test von Touch-Wischen, Kamera, Klang oder Haptik. Laut Agenten haben Designs auÃŸer Hell/Dunkel keine eigene Wirkung mehr; noch zu prÃ¼fen. Dieser Doku-Nachtrag bestÃ¤tigt keine neuen Funktions- oder Live-Tests.

### Workout-CSV-Import, lokal vorbereitet (09.11.2026)

- Review-Korrekturen: Importierte Workouts dÃ¼rfen Ã¼ber den bestehenden Handler wieder geÃ¶ffnet werden (`finished:false` bleibt gÃ¼ltig). `insights.js` nimmt Imports ausschlieÃŸlich aus der PR-XP-Grundlage heraus; vorhandene Workout-XP bleiben stabil, gemeinsame Historie/e1RM/Vorbelegung bleiben erhalten. Mapping ergÃ¤nzt Singular/Plural, Pull-ups und die vom Koordinator benannten 19 gezielten Aliase mit exakt geprÃ¼ften Bibliothekszielen. Mehrdeutige Bench Press/Squat/Lat Pulldown ohne Equipment werden weiter eigene Ãœbungen. Strong-Buchstaben in Set Order (z. B. W) werden als normaler Satz mit Originalwerten und Dateireihenfolge akzeptiert. Tests ergÃ¤nzt; in einer temporÃ¤ren Quellkopie geprÃ¼ft, weil die Sitzung nur den Hauptklon als Schreibbereich freigibt. Patch-Anwendung und NachprÃ¼fung im Worktree beim Koordinator; private CSV unverÃ¤ndert.

- Koordinator-Auftrag auf `agent/backend-liftoff-import`, Basis `e8ce137`. Neue `js/workout-import.js`, Einbindung zuletzt in `index.html` und in der Offline-Liste von `sw.js`; keine VersionsÃ¤nderung, kein Commit/Push oder Live-Backend-Eingriff.
- Konto â†’ Konto verwalten â†’ Daten: CSV-Dateiauswahl, Vorschau mit Zeitraum/Sessions/SÃ¤tzen/zugeordneten und neuen Ãœbungen/Dubletten, Einheitenwahl lbs/kg und ausdrÃ¼ckliche BestÃ¤tigung. Liftoff-Header wÃ¤hlen lbs, explizite kg-/lbs-Header haben Vorrang; Ã¤hnliche Hevy-/Strong-Header und Semikolon-CSV werden akzeptiert. Fehlende Ãœbungsnamen werden mit sichtbarer Anzahl Ã¼bersprungen. Nicht unterstÃ¼tzte Satzfelder (Distanz, Zeit, RPE, Notizen, Satztyp) werden sichtbar angekÃ¼ndigt ausgelassen.
- Exakte Namen/Aliase und identische Namenstokens unabhÃ¤ngig von Klammern/Reihenfolge werden auf Bibliothek/eigene Ãœbungen abgebildet; keine unscharfen Muskel-/GerÃ¤tevermutungen. Vorhandene Ãœbungs-IDs bleiben maÃŸgeblich. Neue Ãœbungen erhalten stabile IDs. Umrechnung lbs Ã· 2.20462262185, Rundung auf 0,1 kg, exakte Viertel-kg bleiben erhalten.
- Import ergÃ¤nzt ausschlieÃŸlich abgeschlossene Workouts. Stabile SHA-256-Workout-ID aus lokalem Datum, Namen, Dauer und kanonischen Satzinhalten verhindert erneuten Import auch nach JSON-Sicherung/Wiederherstellung. `importSource: 'workout-csv'` wird optional in der letzten `validData()`-Erweiterung geprÃ¼ft; alte Profile bleiben gÃ¼ltig. Fehlende Dauer/Uhrzeit bleiben unbekannt. Keine neuen Routinen, Messungen, Gewichte oder parallelen ZustÃ¤nde.
- Bestehende Kalender-/Streak-/Statistik-/Vorbelegungslogik nutzt die importierte Historie. Imports zÃ¤hlen nicht zur PR-XP-Grundlage; der letzte `workoutAwards()`-Wrapper setzt zusÃ¤tzlich deren XP/PR-Feiern auf null, kein `durationXpVersion` fÃ¼r historische Imports. Historie bleibt fÃ¼r e1RM und Vorbelegung erhalten. Auth/Sync unverÃ¤ndert: einmal normal `save()` nach BestÃ¤tigung, Profil-/Owner-PrÃ¼fung bei verspÃ¤teten Dateizugriffen, aktuelle lokale Ã„nderungen bleiben erhalten, Konflikte stoppen weiter Uploads.
- `tests/check-workout-import.cjs` mit rein synthetischen Fixtures in `scripts/check.cjs`: Vorschau/Abbruch, Einheiten, Mapping, fehlende Werte, fehlerhafte CSV, Dateireihenfolge, Dubletten nach Restore, Owner-/Profilwechsel und reale Save-/Cloud-Wrapper mit gemocktem CAS-Konflikt und Offline-Pending-Sicherung. Gesamtsuite bestanden; kein Live-RLS-Nachweis. Die bereitgestellte private Datei wurde ausschlieÃŸlich lokal im Speicher geprÃ¼ft und nicht ins Repository kopiert.
- Integration beim Koordinator: unabhÃ¤ngiges Review (besonders optionale Metadaten, Awards-Wrapper und Append-/Sync-Verhalten), echte UI-PrÃ¼fung bei 390 Ã— 844 in Hell/Dunkel sowie Dateiauswahl/BestÃ¤tigung. BrowserprÃ¼fung hier blockiert: Browserinventar leer, native Pipe/Browserhost nicht verfÃ¼gbar. Vor VerÃ¶ffentlichung normale zentrale Versionierung durchfÃ¼hren; aktuelle Asset-/Cache-Version bleibt absichtlich 86.

### Version 86, Freundesliste + KI-Essensfoto + Taschenlampe (08.11.2026)

- **Live eingerichtet (08.11.2026, mit Selvir im Dashboard):** `backend/food-photo.sql` und `backend/friends.sql` im Projekt `qqqwzvqsvngvfhpgelpm` ausgefÃ¼hrt (Success). Edge Function `food-photo` aus Commit `bbba1e5` deployt, Secret `GEMINI_API_KEY` von Selvir gesetzt. â€žVerify JWT with legacy secretâ€œ ist AUS, weil das Projekt Nutzer-JWTs mit ES256 signiert; die Funktion prÃ¼ft das Token selbst Ã¼ber `/auth/v1/user` (ohne Token: `401 {"error":"auth"}` geprÃ¼ft). Offen: echter Test mit angemeldetem Konto (Gemini-Antwort) und Freundesliste mit zwei Konten.

- VerÃ¶ffentlicht: Freundesliste (Branch `agent/backend-freunde` gemergt, Claude-Review mit NachprÃ¼fung freigegeben) und KI-Foto/Taschenlampe (Codex angefangen, Claude `puls-backend` fertiggestellt wegen Codex-Limit, Gemini-Review freigegeben). Beide Serverteile sind noch NICHT live: Selvir muss `backend/friends.sql` und `backend/food-photo.sql` im Supabase-SQL-Editor ausfÃ¼hren, Gemini-SchlÃ¼ssel als Secret setzen und die Edge Function `food-photo` anlegen (Schritte in `BACKEND-HANDOFF.md`). Bis dahin bleibt â€žFreundeâ€œ ausgeblendet, das KI-Foto meldet â€žnoch nicht eingerichtetâ€œ. Neue IPA nÃ¶tig fÃ¼r die Taschenlampe.

### Version 85, tÃ¼rkische und Balkan-Gerichte (08.11.2026)

- 53 neue KatalogeintrÃ¤ge (`PULS_tr_*`/Balkan) mit 51 Portionsangaben in `catalog/foods-36.json`/`portions.json`, als Rezept- bzw. Etikett-Richtwerte mit Quelle gekennzeichnet, keine MikronÃ¤hrstoffe erfunden. Gebratene Sucuk mangels Quelle ausgelassen. `CATALOG_CACHE` â†’ `puls-catalog-v2`. Test `tests/check-regional-foods.cjs`.
- In Arbeit: Freundesliste + Stups (Worktree `agent/backend-freunde`), danach KI-Foto (Gemini Ã¼ber Supabase-Funktion) und Taschenlampe im nativen Scanner. Liftoff hat keinen Export; kein Import geplant.

### KI-Essensfoto und Taschenlampe, lokal vorbereitet (08.11.2026, ohne Version)

- Web: `js/food-photo.js` (nach `food-flow.js`) ergÃ¤nzt im Foto-Tab â€žFoto schÃ¤tzen (KI)â€œ: Foto (â‰¤ 1024 px JPEG, ohne EXIF) + optionale Beschreibung â†’ Supabase Edge Function `food-photo` â†’ Google Gemini `gemini-3.8-flash` (Gratis-Tarif) â†’ editierbares Kontrollformular, Speichern erst nach HÃ¤kchen. Eintrag Ã¼ber die normale `addFood`-Kette mit `source:'KI-SchÃ¤tzung Â· Google Gemini'` und `aiEstimate:true`, nur kcal/Makros. Foto und Text werden nicht gespeichert. Nur mit Konto und online.
- Server (noch nicht live): `supabase/functions/food-photo/index.ts`, Limit-Tabelle `backend/food-photo.sql` (3/Minute, 20/Tag pro Konto). Einrichtung siehe `docs/BACKEND-HANDOFF.md` â†’ â€žKI-Essensfotoâ€œ. Ohne Einrichtung zeigt die App â€žnoch nicht eingerichtetâ€œ.
- iOS: Taschenlampen-Knopf im nativen Scanner (DataScanner und AVFoundation-Fallback), aus beim SchlieÃŸen. Web-Scanner hatte bereits einen Blitz-Knopf (`ff-torch`, nur wenn `torch` gemeldet). Swift-Build nur in CI, GerÃ¤tetest offen.
- Test: `tests/check-food-photo.cjs` (in `scripts/check.cjs`), nur Mocks; kein echter Gemini-, SQL/RLS- oder Edge-Function-Lauf.

### Freunde mit Trainingsserie und Stups â€” lokal vorbereitet, 08.11.2026

- Koordinator-Auftrag auf `agent/backend-freunde`, Basis `306f6a6` (v84): eigene Freundescodes, Anfragen/Annahme/Ablehnung/Entfernen, nur unter angenommenen Freunden geteilte Trainingsserie/letztes Datum, â€žStop slacking offâ€œ nach Serienabbruch und empfangene Hinweise beim Ã–ffnen/Fokus. Konto â†’ Freunde, nur angemeldet/online; ausdrÃ¼cklich aktivieren/deaktivieren. Neue `backend/friends.sql`, `js/friends.js`, `css/friends.css`, AsseteintrÃ¤ge in `index.html`/`sw.js`.
- Keine bestehenden Profil-/Auth-/Sync-Funktionen oder persistierten Profilfelder geÃ¤ndert. Kennzahlen erst nach abgeschlossenem revisionsgeprÃ¼ftem Profilsync; Konflikte/Offline/Recovery/abgelehnte Revisionen sperren VerÃ¶ffentlichung. Quellenrevision verhindert serverseitig veraltete MehrgerÃ¤te-Updates; nur eigene Profilrevision wird dazu gelesen/kurz gesperrt. ZufÃ¤llige Codes, RLS und ausschlieÃŸlich RPC-Zugriff; serverseitiges 12-h-Limit mit Paar-Transaktionslock. Details und Dashboard-Schritte: `BACKEND-HANDOFF.md`.
- Keine native Hintergrundabfrage/TokenÃ¼bernahme: keine iOS-Ã„nderung, kein APNs, Hinweis erst bei offener/fokussierter App. Blockieren optional nicht umgesetzt. Soziale Daten sind separat und nicht im Profilbackup enthalten. Deaktivieren lÃ¶scht Beziehungen/Stupse; KontolÃ¶schung kaskadiert.
- Gesamtsuite `node scripts/check.cjs`, `tests/check-friends.cjs` und `git diff --check` bestanden. Mocktests fÃ¼r Opt-in, unverÃ¤nderte alte Profile ohne `runs`, Tagesgrenzen/LÃ¤ufe, Konflikt-/Revisionssperren, Offline/Vorschau, Konto-/Antwort-Races, Deaktivierung und Escaping. UnabhÃ¤ngiges Codex-Review samt Korrektur-NachprÃ¼fung erledigt; KI-Ã¼bergreifendes Review beim Claude-Koordinator. SQL noch nicht in PostgreSQL ausgefÃ¼hrt, kein Live-RLS-Nachweis. Browserhost/native Pipe nicht verfÃ¼gbar: 390 Ã— 844, Hell/Dunkel und iPhone-Interaktionen offen.
- Claude-Review (9 Befunde) behoben: NamenslÃ¤nge in Zeichen wie der Server, fehlerhafte Fremdzeilen nur gefiltert; ausgehende Anfragen ohne EmpfÃ¤ngernamen; Anfragelimit und 7-Tage-Ablehnungssperre Ã¼berleben Deaktivieren; Serverdatum `Europe/Berlin` (+1 Tag Toleranz); VerÃ¶ffentlichung sperrt nach Sync-Dirty-Flag statt Byte-Vergleich; PrÃ¼fung hÃ¶chstens minÃ¼tlich ohne Zustandsserialisierung; erklÃ¤rende Warte-/Fehlertexte; MenÃ¼punkt erst nach erfolgreicher RPC, bei fehlender Migration pro Sitzung ausgeblendet. Tests in `tests/check-friends.cjs` ergÃ¤nzt (Mocks/QuellvertrÃ¤ge, kein PostgreSQL).
- Kein Commit/Push/Live-Backend-Eingriff und gemÃ¤ÃŸ Auftrag keine VersionsÃ¤nderung. Koordinator prÃ¼ft integrierten Diff unabhÃ¤ngig, richtet Migration erst nach Test ein und versioniert vor VerÃ¶ffentlichung.

### Version 84, WebView-HÃ¼lle statt SwiftUI mit drei nativen Extras (08.11.2026)

- VerÃ¶ffentlicht als v84 auf `main`. Review (Claude `puls-reviewer`) mit NachprÃ¼fung: Health Ã¼berspringt `autoFinished`/`timeApprox`-Workouts, Script-Sandbox aus, Erinnerungs-Banner bei offener App, Health-Abgleich nur bei geÃ¤nderten Daten. Offen: CI-Swift-Build, AltStore-Installation mit HealthKit, GerÃ¤tetest von Scanner/Health/Erinnerungen und 390 Ã— 844 der neuen Einstellungen (nur in der HÃ¼lle sichtbar).

- Selvir hat die SwiftUI-Umstellung gestoppt und unter Tag `native-swiftui-archiv` archiviert. Nicht lÃ¶schen oder weiter ausbauen. HÃ¼lle wieder von `main`/`ios-build-9`, Live-Web v83; maÃŸgeblich bleibt der Web-Zustand fÃ¼r Daten, Auth und Sync. Die Ã¤lteren Ãœbergaben darunter sind historisch.
- Koordinator-Auftrag auf Branch `ios-huelle-extras`, Basis `dd7c13d`. Native Barcode-Kamera (VisionKit/AVFoundation) â†’ vorhandener Web-`lookupBarcode`; optionaler ausschlieÃŸlich schreibender Health-Export (Gewicht, abgeschlossene Trainings/LÃ¤ufe, stabile Sync-Metadaten, Owner-/Opt-in-Grenze); lokale Trainings-/Wiege-Erinnerungen mit Wochentagen/Uhrzeit und eigenen Mitteilungs-IDs.
- Einstellungen unter Konto â†’ Darstellung â†’ iPhone-Funktionen; neue `js/native-extras.js`, optionale validierte `state.nativeExtras`. Alte HÃ¼llen/Safari bleiben funktional unverÃ¤ndert, alte Sicherungen gÃ¼ltig. Revisionskonflikte/Recovery/Cloud-Arbeit sperren den Health-Export. Keine Auth-/SQL-/ServerÃ¤nderungen. Keine neuen NÃ¤hrwerte/KalorienschÃ¤tzungen; historische Trainings ohne belegte Zeiten Ã¼bersprungen. Details, TagesauflÃ¶sung von Gewicht und fehlende Health-LÃ¶schsynchronisation: `docs/IOS-APP.md`.
- `stateBridge`/`nativeWebPages` und die Ã¼brigen SwiftUI-Features werden von dieser HÃ¼lle nicht gemeldet, kein `pulsState`-Handler; v74â€“v83 bleiben inaktiv und erhalten. Alte HÃ¼llenfunktionen und Widget-Erweiterung bleiben bestehen.
- Apple fÃ¼hrt HealthKit auch fÃ¼r kostenlose Developer-Konten auf. AltStore-GerÃ¤teprobe offen. Capability-Datei, Health-Zwecktexte und zertifikatsfreier Ad-hoc-Metadatumschritt in `ios/project.yml`/`ios/scripts/prepare-altstore.sh` vorbereitet, damit AltStore die Capability erkennt. Ohne eingebettete Health-Capability/API-VerfÃ¼gbarkeit kein Feature; HÃ¼lle startet weiter.
- Lokale PrÃ¼fung: Gesamtsuite `node scripts/check.cjs` und gezielte BrÃ¼cken-/Fallback-/Owner-/VerzÃ¶gerungstests; unabhÃ¤ngige QuellprÃ¼fung mit NachprÃ¼fung von Autorisierungs-Race, Seitenleben-IDs und Signierschritt. Kein Xcode/Swift-/codesign-Lauf auf Windows. Browserinventar leer, native Pipe und Browserhost nicht verfÃ¼gbar: 390 Ã— 844, Kontrast und Interaktionen mÃ¼ssen beim Koordinator/GerÃ¤t geprÃ¼ft werden. Keine echte Kamera, HealthKit-, Mitteilungs- oder Live-RLS-PrÃ¼fung.
- Kein Commit, Push, Versionswechsel oder Live-Backend-Eingriff; vorhandene `CLAUDE.md`-Ã„nderung nicht angefasst. Koordinator integriert, prÃ¼ft UI/CI/AltStore und erhÃ¶ht mit `scripts/bump-version.cjs` die Web-Version vor VerÃ¶ffentlichung. Neue JS-Datei bereits in `index.html` und `sw.js` eingetragen.

### Version 83, Hybrid-Modus Web-Hauptseiten (08.11.2026)

- Selvirs Entscheidung: Ãœbersicht/Training/Essen als Web-Seiten im Web-Design, native Tab-Leiste und Plus bleiben, Konto bleibt komplett nativ, alles was beim Antippen ein Fenster Ã¶ffnet, Ã¶ffnet ein natives Fenster. Optik der nativen Fenster an das Web angleichen folgt nach GerÃ¤tetest.
- Nur Web-Dateien auf `main`: Feature `nativeWebPages` in `js/native-state.js`/`css/native-shell.css` (Protokoll Â§16). Wirkungslos im Browser und mit Ã¤lteren IPAs. App-Seite auf `native-ios` (`e9e11fb`), Schalter `RootTabShell.webPagesMode`. Codex-Review 1Ã—P2 behoben. Swift-Build Ã¼ber CI, GerÃ¤tetest offen.

### Version 82, Web-Seite fuer Rezept-Vorschau (06.11.2026)

- Nur Web-Dateien auf `main`: Query `recipePreview` ohne Zustandsaenderung (Protokoll). Wirkungslos ohne native App. App-Seite auf `native-ios`, CI #49 gruen, Testversion `PULS-ipa-49`, Geraetetest offen.

### Version 81, Web-Seite fuer Welle N1 (06.11.2026)

- Nur Web-Dateien auf `main`: native Abschluesse mit `cycleId`, Pagination, Indexchart, `exercise.settings.set`, `route.fromRun`, Export, Teilen (Protokoll Â§15). Wirkungslos ohne native App mit den Flags `nativeCompletion`/`stateBridge`. Reviews ueber Kreuz ohne offene Befunde.
- App-Seite liegt auf `native-ios`, Swift dafuer noch nicht kompiliert: CI #44 bis #46 fanden keinen macOS-Runner.
### Gesamt-Audit 26.10.2026 â€” verÃ¶ffentlicht als Version 70

- Branch `refactor/comprehensive-app-audit` ab Tag `audit-baseline-v69`, auf Selvirs Freigabe per Fast-forward nach `main` Ã¼bernommen und als v70 verÃ¶ffentlicht.
- Sync/Speicher gehÃ¤rtet (`js/cloud.js`, `js/app.js`): BeschÃ¤digungs-Sicherung, dauerhafte Upload-Sperre, Recovery-Arbeitskopie `puls-v1-recovered`, Rotation, 4-MB-Grenze, Konfliktkopien. Nur Mock-Tests, keine Live-RLS.
- UI: Onboarding wÃ¤hlt â€žBerechnetâ€œ vor, ruhige Live-Eingabe, entprelltes Speichern, Singular/Plural, Dezimalkomma; â€žText & Spracheâ€œ aus Plus-MenÃ¼ entfernt. Offen: UI-5, UI-6, UI-7 (Rest), UI-11/12.
- `js/visuals.js` und `css/visuals.css` entfernt; `designs-extra.js` bleibt (alte DesignschlÃ¼ssel in `validData`).
- Letzter `node scripts/check.cjs`: Exit 0 auf `b2ae598`. Codex-Abschlussreview und NachprÃ¼fung: Merge-Empfehlung ja. Gemini nicht beteiligt.
- Nicht getestet: echtes iPhone, Live-Supabase/RLS, echter Offline-SW, GPS, Kamera. iPhone-Checkliste aus dem Abschlussbericht steht noch aus.
- Details und iPhone-Checkliste: `docs/audit/FINAL-REPORT.md`.
### Konto, Speichern und Navy-KFA, lokal vorbereitet (26.10.2026)

- Koordinator-Auftrag an Codex auf Basis `2c8fdae`; vorhandene ungestagte Ã„nderungen erhalten. Kein Commit, Push, Versionswechsel oder Live-Backend-Eingriff.
- Online-Sync-Hinweis aus `js/design-system.js` entfernt. Offline-Zeile bleibt als fest positionierter Status Ã¼ber der Tab-Leiste ohne Layoutverschiebung. Weitere automatische â€žWird synchronisiertâ€œ-Toasts beim Einstellungsspeichern wurden nicht gefunden; bestehende Schutzmeldungen beim Abmelden/ZurÃ¼cksetzen bleiben.
- Profil- und Messformular verwenden deckende Speichernleisten mit Haarlinie, Safe Area und Abstand. Der Profil-Scroller wird gesondert berÃ¼cksichtigt. Doppelte Ãœberschrift im KÃ¶rper-Unterbereich entfernt.
- â€žKonto verwaltenâ€œ verwendet gruppierte Zeilen fÃ¼r Anmeldung/Sync, Daten und GerÃ¤t sowie eine einzelne rote LÃ¶schaktion am Ende. Vorhandene Handler, Konflikt-ID, ImportprÃ¼fung, Reset- und Passwort-/LÃ¶schbestÃ¤tigungen bleiben maÃŸgeblich. Keine Ã„nderungen an Cloud-Logik oder gemeinsamem Zustand.
- Navy-KFA ausschlieÃŸlich fÃ¼r MÃ¤nner aus GrÃ¶ÃŸe, Hals und Taille; keine HÃ¼ftabhÃ¤ngigkeit. Alte `sex`-Felder und manuelle KFA bleiben gÃ¼ltig. KÃ¶rpermaÃŸ-CSV ergÃ¤nzt `neck_cm` am Ende, fehlende Werte bleiben leer. DE/EN-Texte ergÃ¤nzt.
- Gesamtsuite und gezielte Navy-/CSV-/Konto-/Sync-VM-Tests grÃ¼n, `git diff --check` sauber. Kein Browser verfÃ¼gbar (Inventar leer, In-App-Browser nicht verfÃ¼gbar), daher 390 Ã— 844 Hell/Dunkel und echte iPhone-Safe-Areas ungeprÃ¼ft. Integrierte visuelle PrÃ¼fung und Release-Versionierung beim Koordinator.
- Gezieltes unabhÃ¤ngiges Review: fehlenden GerÃ¤tesymbol-SchlÃ¼ssel durch registriertes `database` ersetzt und nachgeprÃ¼ft; keine weiteren belegten Befunde im geprÃ¼ften Umfang.

### App-Icons Hell/Dunkel, lokal vorbereitet (26.10.2026)

- Nur zwei Varianten: blauer Pulsstrich auf #F2F2F7 bzw. #1C1C1E, ohne Effekte oder eigene PNG-Rundung. SVG, RGB-PNG 180/512, Manifestvarianten; Standard Dunkel. Reproduzierbar ohne npm mit `node scripts/generate-app-icons.cjs` (erzeugt auch natives PNG 1024).
- Alte sechs `iconColor`-Werte bleiben in Profil und Sicherungen gÃ¼ltig und unverÃ¤ndert; Anzeige liest sie als Dunkel. URL-Auswahl speichert beim Start nicht mehr. Erst explizite Icon-Wahl schreibt ins vorhandene Feld. Ohne Wahl folgt das Web-Icon dem lokalen Farbschema einschlieÃŸlich Systemwechsel; Browser-/Touch-Icon und Manifest werden gemeinsam gesetzt.
- iOS-Workflow/Asset verwenden fest Dunkel; alternative native Icons entfernt, alte Bridge-Nachrichten wirkungslos. Neue IPA erforderlich. Bestehende Home-Bildschirm-Web-Icons lassen sich nicht zuverlÃ¤ssig dynamisch Ã¤ndern; Installationsseite verwendet die explizite Variante.
- PrÃ¼fung: Gesamtsuite und gezielte neue Icon-Tests grÃ¼n; PNGs visuell und auf GrÃ¶ÃŸe/OpazitÃ¤t geprÃ¼ft. Keine schmale BrowserprÃ¼fung mÃ¶glich: keine verbundenen Browser, In-App-Browser nicht verfÃ¼gbar. Kein echter iPhone-/Xcode-Build-Test. UnabhÃ¤ngiges Review durch Koordinator ausstehend.
- Keine VersionsÃ¤nderung, kein Commit/Push. Gemeinsame ungestagte FremdÃ¤nderungen erhalten; Koordinator integriert und erhÃ¶ht die Release-Version gesammelt.


Aktualisiert: 24.10.2026. MaÃŸgeblicher Code: dieses Repository. Git-Historie und aktuelle CI zusÃ¤tzlich prÃ¼fen.

## Stand bei Einrichtung der Zusammenarbeit

- VerÃ¶ffentlichte App-Version: **64** (25.10.2026: AktivitÃ¤ten-Paket â€” Katalog mit MMA/Padel, Live-Werte je Art, Vollbild-Karte mit hochziehbarer Wertekarte, Sperre, Runde, MMA-Runden-Timer, Wanderwege-Ebene (Waymarked Trails), Kalorien-Baseline-Modus, Gym-kcal, Dauer-XP, Wochenziel aktive Minuten, Bereich â€žAktivitÃ¤tenâ€œ im Fortschritt; Reviews: Claude-PrÃ¼fer 4 Befunde Daten, Codex 3 Befunde UI, alle behoben und nachgeprÃ¼ft). Davor 63 mit iOS-App 1.6 (25.10.2026: AktivitÃ¤ten im Vollbild mit Countdown, Live-Werten und Zusammenfassung; Codex-Review 7 Befunde behoben). Davor 62 mit iOS 1.5 (Laufen mit GPS, Karte, Routenplaner, Live-AktivitÃ¤t; siehe Ãœbergabe unten). Davor 58â€“61 kleine Korrekturen, davor 57 (25.10.2026: keine Linie unter der letzten Routine im Workout- und Routinen-Tab, `css/training-polish.css`). Davor 56 (25.10.2026: â€žTag als vollstÃ¤ndig markierenâ€œ als Knopf in voller Breite mit fester HÃ¶he, springt nicht mehr; Makro-Boxen auf der Essen-Seite gleich hoch; kein Kasten um das Fenster-X; Training: Tabs nÃ¤her an der oberen Leiste, Standardpause mit 14 px oben/unten). Davor 55 (25.10.2026: Barcode-Scanner mit Blitz-Knopf in `js/food-flow.js`, nur wenn die Kamera `torch` meldet, Umschalten per `applyConstraints`; Review Codex: 1 Befund behoben). Davor 54 (25.10.2026: â€žHeute gegessenâ€œ ohne Innen-Scroll, Ã¼brige kcal nur als Zahl â€” Essen rechts in der kcal-Zeile, Ãœbersicht unter dem Ring, Ã¼ber dem Ziel â€ž+X kcalâ€œ in Warnfarbe; `js/app-polish.js`/`css/app-polish.css`). Davor 53 (25.10.2026: nur noch Original-Design â€” `state.appDesign` wird bei jedem Render auf `classic` gesetzt, Designauswahl ausgeblendet; Konto: â€žKonto verwaltenâ€œ bÃ¼ndelt Anmeldung/Sync, Sicherung und LÃ¶schen, kein â€žDein Bereichâ€œ; Essen-AblÃ¤ufe neu in `js/food-flow.js`/`css/food-flow.css` (Suche mit automatischer Open-Food-Facts-Suche ab 3 Zeichen, Portion, Barcode, Rezepte, eigene Werte, Foto; Claude-Frontend-Agent); Muskelgruppen eigener Ãœbungen werden in `js/exercise-muscles.js` aus dem Namen abgeleitet, nicht gespeichert (Codex), â€žDiese Woche Â· SÃ¤tze pro Muskelgruppeâ€œ; `js/training-polish.js`: eigene Ãœbung direkt in der Ãœbungssuche, Kalender Ã¶ffnet Auswertung, grÃ¼nes â€žLÃ¤uftâ€œ, Standardpause als Pille; `js/app-polish.js`: Plus-MenÃ¼-Animation, X schlieÃŸt animiert, Essen-Seite mit eigener Makro-Optik, Wasser von ml-GetrÃ¤nken ohne Wasserwert geschÃ¤tzt (nur Anzeige), Scroll bleibt bei â€žTag vollstÃ¤ndigâ€œ, ohne 01/02-Nummerierung auÃŸer Konto, ohne Seitenleisten-FuÃŸ, ohne â€žNÃ¤hrstoffwerte & Ziele im Detailâ€œ; Suche bestraft Gerichte auch als Wortteil; auf Selvirs Auftrag iOS-App 1.4 mit echter Haptik (`haptic`-Nachricht, Feature `haptics`); Reviews: Claude-PrÃ¼fer 3+1 Befunde (Muskelgruppen), Codex 3 Befunde, alle behoben und nachgeprÃ¼ft. Bekannt: Open-Food-Facts-Suche `cgi/search.pl` antwortet zeitweise mit 503 ohne CORS). Davor 52 (25.10.2026: Essenssuche mit Relevanz statt Startswith-Bonus â€” gleiche Regel in `js/catalog-worker.js` und `js/food-upgrade.js` (foodRelevance), nur am deutschen Namen, Grundzutaten/roh vor Gerichten, GebÃ¤ck und Innereien, neue Aliase z. B. Geschnetzeltes â†’ Brustfilet, ODER-Ersatzsuche; Sicherung im Profil-Fenster kompakt; `js/haptics.js` Vibration bei Satz, Speichern, Start/Ende, Pause und Auswahl â€” native iOS-Haptik vorbereitet Ã¼ber `pulsNativeFeatures` 'haptics', `ios/` dafÃ¼r nicht geÃ¤ndert; Review Codex: 3 Befunde behoben). Davor 51 (25.10.2026: Barcode auch senkrecht â€” eigener Zusatz-Scan des um 90Â° gedrehten Videobilds in `js/products.js`, da ZXings TRY_HARDER-Drehung in 0.2.1 fehlerhaft ist; auf Selvirs ausdrÃ¼cklichen Auftrag iOS-App 1.3: Live-AktivitÃ¤t/Dynamic Island zeigt ohne Pause die Workout-Zeit, nach Pausenende automatisch per staleDate, `native-bridge.js` sendet `workoutActive` nur bei `window.pulsNativeFeatures` mit `workoutTimer`, Ã¤ltere App bleibt beim alten Verhalten; Review Codex: 1 Befund behoben und nachgeprÃ¼ft). Davor 50 (25.10.2026: Konto â€” â€žDein Designâ€œ enthÃ¤lt Sprache und App-Icon direkt, Design-Kacheln schmal in drei Spalten, â€žKonto & Synchronisierungâ€œ steckt in â€žDeine Datenâ€œ, `js/account-refresh.js`/`css/account-refresh.css`; Tab-Wechsel unten mit Wisch-Animation links/rechts, `js/page-slide.js`/`css/page-slide.css`; Review Codex: 1 Befund Fokus behoben und nachgeprÃ¼ft). Davor 49 (25.10.2026: `js/workout-controls.js`/`css/workout-controls.css` â€” Linien-Symbole statt Textzeichen âŒ„ âŒƒ Ã— âœ• â€¹ â€º, knapperes Abschluss-Fenster mit Verwerfen-Warnung, âˆ’30 s und â€žPausenzeitâ€œ im laufenden Workout, Scroll-Rad fÃ¼r die Standardpause, zentriertes Datumsfeld; Review Claude-PrÃ¼fer: 4 Befunde behoben). Davor 48 (25.10.2026: Pop-up â€žPause vorbeiâ€œ mit OK und Animation, `js/rest-popup.js`/`css/rest-popup.css`, eigener `<dialog>` Ã¼ber offenen Fenstern, Vormerken bei Pausenende im Hintergrund bis 10 min; Review Claude-PrÃ¼fer: 5 Befunde behoben und nachgeprÃ¼ft). Davor 47 (25.10.2026, auf Selvirs ausdrÃ¼cklichen iOS-Auftrag: iOS-App 1.2 mit echtem App-Icon-Wechsel und neu gestalteter Dynamic Island/Live-AktivitÃ¤t; `js/native-bridge.js` sendet `setAppIcon`; Review Claude-PrÃ¼fer, da Codex und Gemini im Limit). Davor 46 (25.10.2026: Repository aufgerÃ¤umt â€” Skripte in `js/`, Styles in `css/`, alte Doku in `docs/archive/`, `archive/` entfernt, neue README; `sw.js` aktiviert neue Versionen sofort per `skipWaiting()` nach vollstÃ¤ndigem Precache; Review Codex: Offline-LÃ¼cke beim Update behoben). Davor 45 (25.10.2026: Training â€” Workout-Tab als Startseite mit kompakten Routinenzeilen, â€žHeute erledigtâ€œ abgesetzt, Routinen-Tab bleibt Verwaltung, Kalender ohne doppelte Linie; `training-tabs.js`/`.css`, alle Designs, Review Codex: EN-Befund behoben). Davor 44 (Profil-Schalter Richtung/Tempo untereinander), 43 (Profil & Ziele Ã¼berarbeitet, Logikfehler behoben), 42 (Abstand zwischen den Wischseiten), 41 (Essen im neuen Originaldesign), 40 (optionaler Erststart, Tutorial entfernt, klebender Pausentimer, ruhigere Satzzeilen), 39 (`native-bridge.js` fÃ¼r Pausen-Mitteilung und Dynamic Island; von Selvir auf iPhone und iPad bestÃ¤tigt) und 38 (Commit `0c62ef6`: Konto 36, Ãœbersicht 37, Training 38 im neuen Originaldesign).
- Live: https://selvirtnj.github.io/puls/?v=91 ; Repository: https://github.com/selvirtnj/puls .
- Davor verÃ¶ffentlicht: 35, Ausgangscommit `6e878204b677d1e9aa8f51f51f22f2df526f2c81`.
- Version 34: fokussierte OberflÃ¤che, neu geordnetes Konto, mehr Diagramme, vier zusÃ¤tzliche Designs, Archiv und Projektdokumentation.
- Version 35: 87 neue Ãœbungsvarianten, insgesamt 963; Maschinen-/Kabel-/Smith-Filter, deutsche Suchnamen und Ergebnis-Paginierung.
- Die anschlieÃŸende Team-Einrichtung Ã¤ndert Dokumentation, Agentenrollen und Entwicklungswerkzeuge, keine Runtime-Funktion der App. Deshalb bleibt die App-Version 35.
- Die bisherigen Web checks und Pages-VerÃ¶ffentlichungen fÃ¼r 35 waren erfolgreich. Das ist ein historischer PrÃ¼fstand, kein dauerhafter Live-Nachweis.

## Was jetzt eingerichtet ist

`AGENTS.md`, `docs/START-HERE.md`, Produktkontext, Backend-Ãœbergabe, Teamablauf und die Rollen `puls_frontend`, `puls_backend`, `puls_reviewer`. Ein Hauptchat koordiniert die Aufgaben. Seit 24.10.2026: Hauptchat â€žPULS Â· Hauptchatâ€œ in Claude Code koordiniert Claude, Codex (`scripts/codex-bridge.ps1`) und Gemini/Antigravity (`scripts/gemini-bridge.ps1`) nach `docs/AI-TEAM.md`; BrÃ¼cken inkl. RÃ¼ckfragen getestet. Regel: nur Web-App, `ios/` nur auf Selvirs ausdrÃ¼cklichen Wunsch. Neue Chats mÃ¼ssen die Dokumentation lesen; automatische vollstÃ¤ndige Ãœbertragung beliebiger GesprÃ¤chshistorien wird nicht vorausgesetzt.

## Sofort nutzbare Befehle

```sh
git status --short
git log -1 --oneline
node scripts/check.cjs
node scripts/check-handoff.cjs
node scripts/serve.cjs
```

`npm test` entspricht `node scripts/check.cjs`. Keine npm-AbhÃ¤ngigkeiten nÃ¶tig. Ist npm nicht im PATH, direkt Node benutzen.

## Aktueller Auftrag / nÃ¤chster Schritt

**Seit 25.10.2026 gilt das Apple-Redesign nach `docs/DESIGN-SYSTEM.md` (ersetzt das lila Original und alle 11 Designs).** Schritt 1 (Version 65) und Schritt 2 (Version 66, alle Ã¼brigen Bildschirme) sind live. NÃ¤chstes: Selvirs iPhone-RÃ¼ckmeldung abwarten. Der folgende Absatz ist historisch.

Selvir hat am 24.10.2026 die ZielklÃ¤rung bestÃ¤tigt: persÃ¶nliche iPhone-Nutzung, sportliches dunkles lila Original, weniger verschachtelte Karten, sichtbare kurze Aktionsreaktionen. Konto- und Ãœbersichts-Vorschau wurden ausdrÃ¼cklich positiv beurteilt. Alle vier Hauptbereiche (Konto, Ãœbersicht, Training, Essen) sind im neuen Originaldesign live; danach folgen Selvirs EinzelwÃ¼nsche (siehe Ãœbergaben unten). Keine automatische kontinuierliche Hintergrundarbeit. Verbindlicher Plan: `docs/DESIGN-WORKPLAN.md`.

Hauptchat ist Claude Code (â€žPULS Â· Hauptchatâ€œ); wer direkt in Codex arbeitet, findet den Einstiegsauftrag in `docs/START-HERE.md`. Projektrollen werden je nach Client nach ProjektÃ¶ffnung/neuem Chat geladen, nicht zwingend mitten in einer bestehenden Sitzung.

## Technische Orientierung

Statische Dateien: `index.html`/`sw.js` im Stamm, Skripte in `js/`, Styles in `css/` (seit 25.10.2026, siehe `docs/ARCHITECTURE.md`); kein Bundler und kein React-/Flutter-Projekt. Ã„ltere Ãœbergaben unten nennen Dateien noch ohne `js/`/`css/`-PrÃ¤fix. JS-Dateien definieren Globals und umschlieÃŸen bestehende Funktionen. Die letzte Definition in der Ladereihenfolge gewinnt; beim Ã„ndern immer die Kette prÃ¼fen. Tests verwenden VM-/DOM-/Netzwerkstubs.

`state` bleibt die gemeinsame Datenbasis. Lokales Profil: `puls-v1`. Auth-/Synchronisierungsmetadaten und gegebenenfalls alte lokale Fotos haben weitere SchlÃ¼ssel. Supabase speichert pro Nutzer ein revisionsgeprÃ¼ftes JSON-Profil. Die Backend-Dateien belegen die beabsichtigte Konfiguration, nicht den aktuellen Live-Zustand.

Katalog, Icons, Offline-Cache und PWA-Scope mÃ¼ssen bei Releases mitbedacht werden. Der bisherige Autoringsordner mit `dist/`, `release34/` und einmaligen Vorbereitungsskripten ist keine zweite aktuelle Quelle; Skripte daraus nicht unbesehen ausfÃ¼hren.

## Offene Grenzen und sinnvolle spÃ¤tere Aufgaben

Keine der folgenden Aufgaben ist durch diese Liste automatisch zur Umsetzung freigegeben:

1. Modulkopplung: langfristig Funktionen klarer aufteilen und Wrapper reduzieren, mit Tests. Kein riskanter Komplettumbau nebenbei.
2. Backend: direkte eigene Tabellen-Schreibrechte kÃ¶nnen den RPC-Revisionsweg umgehen; serverseitige Payload-Validierung ist flacher als die ClientprÃ¼fung. Siehe Backend-Ãœbergabe.
3. Geteilte GerÃ¤te: benutzerÃ¼bergreifende Backup-/RÃ¼ckkehrschlÃ¼ssel und Offline-Abmeldung ausdrÃ¼cklich testen.
4. Breitere Nutzung mit Freunden: reale Zweikonto-Isolation, Auth-Mailversand/SMTP, Limits, Offline-Sync und Restore mit eigens angelegten Testkonten prÃ¼fen. Mock-Tests allein genÃ¼gen nicht.
5. UI-/Browsergrenzen: Audio/Kamera/Sprache/OCR und Hintergrundverhalten hÃ¤ngen von iOS und Browserberechtigungen ab. Reale iPhone-Tests bleiben nÃ¶tig.
6. Einige neue Diagramm- und Beschreibungsdetails sind mÃ¶glicherweise noch nicht vollstÃ¤ndig Ã¼bersetzt. Bei englischer UI konkret prÃ¼fen, nicht pauschal VollstÃ¤ndigkeit behaupten.

## Ãœbergabe nach jeder grÃ¶ÃŸeren Aufgabe

### Lokal vorbereitet: integrierte OFF-Suche und Navy-KFA, 26.10.2026

- Koordinator-Auftrag an Codex auf Basis `2c8fdae` (68), ohne Commit, VerÃ¶ffentlichung oder VersionsÃ¤nderung. Parallel bearbeitete Trainings-/Laufdateien und `CLAUDE.md` wurden von Codex nicht verÃ¤ndert.
- Letzte Suchdefinition in `js/food-flow.js`: gespeicherte Treffer sofort, Katalog asynchron, OFF ab drei Zeichen nach 450 ms nur online. Abbruch bei neuer Eingabe, Tabwechsel und SchlieÃŸen; alte Antworten werden verworfen. Bestehende Feldauswahl, `app_name=PULS` und Sitzungscache bleiben. Nach Review zehn tatsÃ¤chlich gestartete Netzabfragen pro Minute: vor Versand abgebrochene VorgÃ¤nge zÃ¤hlen nicht, gesendete und danach abgebrochene zÃ¤hlen weiter. Bei Grenze dezenter Hinweis und automatische Wiederaufnahme des aktuellen Begriffs nach Fensterablauf. Timeout mit kurzem Hinweis, keine Fehlerwiederholungen. Enter, erneutes Anzeigen derselben Suche und Katalog-Nachladen duplizieren laufende Anfragen nicht; ausgewÃ¤hlte Sammlungen ohne Suchbegriff bleiben erhalten. OFF unter lokalen Treffern, Dubletten nach Barcode oder normalisiertem Namen plus Marke entfernt. Kein separater Suchknopf und kein Text-/Sprache-Chip. Ãœbernahme weiter Ã¼ber `chooseOnlineFood` und ProduktprÃ¼fung, keine erfundenen Werte.
- `js/profile-refresh.js`: optionales HalsmaÃŸ ergÃ¤nzt die bestehende Messfeldregistrierung; `validData()` prÃ¼ft damit auch Halswerte, alte Sicherungen ohne Hals bleiben gÃ¼ltig. US-Navy-KFA verwendet cm nach Inch-Umrechnung und vollstÃ¤ndige MaÃŸe eines Tages, Formel unterstÃ¼tzt Frauen zusÃ¤tzlich mit HÃ¼fte; im Produkt gilt weiter das persÃ¶nliche mÃ¤nnliche Profil. Kein Zusammenmischen verschiedener Messtage, keine Zukunftswerte. Nach Review gewinnt der neuere manuelle oder geschÃ¤tzte KFA, bei gleichem Datum der manuelle Wert. Anzeige in der MaÃŸ-Eingabe und im aktuellen KÃ¶rperbereich mit Datum und SchÃ¤tzkennzeichnung, keine Speicherung als Messung. Historische BMI-/Deurenberg-Kurven und Kalorienplanung unverÃ¤ndert; kein bestehender Magermasse-/Katch-McArdle-Verbraucher gefunden. Die Ã„nderung an `js/experience.js` wurde auf Koordinatorentscheidung vollstÃ¤ndig zurÃ¼ckgenommen: Laden und Formular normalisieren wie bisher auf mÃ¤nnlich, kein neuer Start-Speichervorgang. Englische Hals-/KFA-/Hinweistexte einschlieÃŸlich Suchfehler und Timeout ergÃ¤nzt. CSV ausdrÃ¼cklich nicht Teil dieser Nacharbeit.
- PrÃ¼fung: `C:\Program Files\nodejs\node.exe scripts/check.cjs` grÃ¼n, einschlieÃŸlich neuer Mock-fetch-Suchtests, Navy-Formel/GrenzfÃ¤lle, Hals-Validierung und alter Sicherungen. Browserinventar des Computer-Use-Werkzeugs meldet keine verfÃ¼gbaren Browser; daher kein 390Ã—844-Layouttest, kein echtes iPhone und keine Live-OFF-/RLS-PrÃ¼fung. UnabhÃ¤ngiges Review, integrierte BrowserprÃ¼fung und spÃ¤tere Release-Versionierung liegen beim Claude-Koordinator.

### Lokaler Koordinator-Auftrag: native Live-AktivitÃ¤ten und Scanner, 26.10.2026

- Codex auf Basis `6a7c055`, noch nicht committet/verÃ¶ffentlicht; Web-Version unverÃ¤ndert. Native Zielversion 1.7 (`ios/project.yml`), neue IPA nach macOS-Build und AltStore-Installation erforderlich.
- Live-AktivitÃ¤ten: Systemschrift, dynamisches Apple-Blau/SystemflÃ¤chen, SF Symbols, keine pulsierenden/rollenden Effekte und keine Emojis in km-Mitteilungen. Mitteilungen selbst zeichnet iOS im Systemstil.
- Fehlerursache â€žPausiertâ€œ: eingefrorener Endstand wurde Ã¼ber dasselbe Feld wie eine Pause dargestellt und vier Minuten behalten. Expliziter optionaler Endzustand, sofortiges `Activity.end` mit finalem Content, geordnete native Updates/Enden mit kurzem Hintergrundbudget. Workout-Abgleich synchron bei `save`/`render`, Start und Seitenwechsel. Lauf endet bereits an der Zusammenfassung; lokaler Endmarker verhindert WiedererÃ¶ffnung durch Takte/Neuladen, â€žWeiterâ€œ aktiviert erneut. Keine neuen synchronisierten Profilfelder, Strecke bleibt bis Speichern/Verwerfen erhalten. VerspÃ¤tete Mitteilungsfreigabe kann eine abgebrochene Pause nicht erneut planen.
- Scanner `js/products.js`: Zusatzbilder abwechselnd 90Â° und 270Â° (Review-Korrektur, 180Â° bringt bei 1D nichts), voller Bildbereich, hÃ¶chstens 960 px und ein Versuch je 400 ms, ausgesetzt im Hintergrund. Der sichtbare Rahmen liegt in den parallel belegten Dateien `js/food-flow.js`/`css/food-flow.css` und ist dem Claude-Koordinator zur Ã„nderung Ã¼bergeben.
- PrÃ¼fung: `C:\Program Files\nodejs\node.exe scripts/check.cjs` grÃ¼n einschlieÃŸlich neuer Bridge-/Scanner- und Laufabschluss-Regressionen mit Fixtures. UnabhÃ¤ngiger Codex-PrÃ¼fer: Vorschau-Endmarker-Befund behoben und nachgeprÃ¼ft, keine offenen belegten Befunde. Kein Swift-Build unter Windows, kein echtes ActivityKit-/Sperrbildschirm-/Kamera-/iPhone-Layout-Testergebnis. AbschlieÃŸendes integriertes Review und GerÃ¤tetest beim Koordinator.

### Version 80: Web-Seite fÃ¼r natives Konto/Profil (M8, Phase A) â€” 01.11.2026

- Neu `js/native-account.js`: Projektion `account` (ohne E-Mail/Tokens), Planner-Query, Ops Name/Avatar/Profil/MaÃŸe/Darstellung/KlÃ¤nge, `plan.set`/`adaptive.set` Ã¼ber M7 `goals.set`, `snapshot.device.scheme`, `resolvedScheme` immer light/dark.
- Anmeldung, Abmeldung, Konflikt, Import/Export, Recovery, Reset, KontolÃ¶schung bleiben ausschlieÃŸlich Web-AblÃ¤ufe (native nur `web:true`-Ausstiege). Phase B (native Datenhoheit) nur als Plan in `NATIVE-BRIDGE-PROTOCOL.md` Â§14 â€” braucht GerÃ¤tetest und Selvirs Freigabe (u. a. serverseitige Owner-Markierung).
- Claude-Review + Codex-NachprÃ¼fungen; native GegenstÃ¼ck CI #41 grÃ¼n.

### Version 79: Web-Seite fÃ¼r native ErnÃ¤hrung (M7) â€” 01.11.2026

- Neu `js/native-nutrition.js`: Projektion `nutrition`, Queries (Suche lokal + OFF gestaffelt, Produkt, Eintrag, Rezept, Etikett-Parse, Import-Vorschau) und 18 Ops (Eintragen/Ã„ndern/LÃ¶schen/Wiederherstellen, Wasser, Tagesabschluss, Ziele, Favorit, Produkt/Etikett mit ausdrÃ¼cklicher WarnungsbestÃ¤tigung, Rezepte, Import). Snapshot-Semantik wie im Web; Etikettwerte Ã¼ber Web-`labelReviewValues`; eigene Korrektur nur fÃ¼r eigene Produkte.
- Nur mit Feature `nativeNutrition`; Browser/Ã¤ltere IPA unverÃ¤ndert. Claude-Reviews (P1, P2, Re-Review) und Codex-Teilarbeit.

### Version 78: Web-Seite fÃ¼r native AktivitÃ¤ten (M6) â€” 31.10.2026

- Neu `js/native-activity.js`: Projektion `activity`, `pulsNativeActivityQuery`, 12 Ops (Start/Pause/Weiter/Runde/Beenden nach vollstÃ¤ndigem GPS-Abholen/Speichern/Verwerfen/Bearbeiten/LÃ¶schen, Einstellungen, Routen). RunTracker bleibt einziger Recorder; Zusammenfassung an Abschlussstand gebunden (kein Speichern veralteter EntwÃ¼rfe, kein LÃ¶schen nicht eingerechneter Punkte).
- Nur mit Feature `nativeActivity`; Browser/Ã¤ltere IPA unverÃ¤ndert. Claude-Review + zwei Codex-NachprÃ¼fungen.

### Version 77: Web-Seite fÃ¼r nativen Kalender/Fortschritt (M5) + Projektionen nach Bedarf â€” 31.10.2026

- Neu `js/native-progress.js`: Projektion `progress`, `pulsNativeProgressQuery` (month/workout/exercise/run), Ops `progress.view.set`/`progress.chart.set`/`progress.goal.set`; nur mit Feature `nativeProgress`.
- `pulsNativeSetInterest`: Projektionen nur fÃ¼r sichtbare native Bildschirme; granulare Caches (Satz-Op ~3â€“48 ms statt ~550 ms im VM-Benchmark `tests/perf-native-projections.cjs`).
- Browser/Ã¤ltere IPA unverÃ¤ndert (Tests). Claude- und Codex-Review.

### Version 76: Web-Seite fÃ¼r natives Training (M4) â€” 31.10.2026

- Neu `js/native-training.js`: Projektion `training` und 15 Trainings-Ops (Start, SÃ¤tze, Ãœbungen, Supersatz, Pause, Abschluss/Verwerfen, Routinen, eigene/Katalog-Ãœbungen) Ã¼ber die zuletzt wirksamen Web-Funktionen; native Nebenwirkungen (Pause/Live-AktivitÃ¤t) nur nach bestÃ¤tigter Speicherung genau einmal.
- Nur mit Feature `nativeTraining` aktiv; Browser und bisherige IPA unverÃ¤ndert (Tests). Codex-Review + NachprÃ¼fung; native GegenstÃ¼ck auf `native-ios` (CI #17 grÃ¼n).

### Version 75: Web-Seite fÃ¼r native Ãœbersicht und Tab-Leiste (M3) â€” 31.10.2026

- Neu `js/native-projection.js` (Ãœbersicht als fertig berechnete Projektion, nur mit Feature `nativeOverview`), `css/native-shell.css` (nur unter `html.puls-native-tabs`), `chrome`-Meldungen (Formular/Session/Lauf sperrt native Navigation), `pulsNativeSetChrome`, `pulsNativeSetDate`, erweiterte `pulsNativeNavigate`-Ziele.
- Browser und bisherige IPA: wirkungslos (Tests). Native GegenstÃ¼ck auf `native-ios` (CI #13 grÃ¼n).

### Version 74: Web-Seite der nativen ZustandsbrÃ¼cke â€” 31.10.2026

- Neu `js/native-state.js` (Protokoll v1, `docs/native/NATIVE-BRIDGE-PROTOCOL.md`): Snapshots an die native App, Gewichtsbefehle `weight.upsert`/`weight.delete` mit `expect`/`conflict`, Weiterleitung von Konto â†’ â€žKÃ¶rper & Entwicklungâ€œ zum nativen Bildschirm (nur mit Feature `nativeBody`).
- Ohne `pulsState`-Handler/`stateBridge` (Browser, bisherige IPA) vollstÃ¤ndig wirkungslos; zwei Claude-Reviews, VM-Tests in `tests/check-native-state.cjs`.
- Native GegenstÃ¼ck (M1/M2) liegt auf Branch `native-ios`, noch nicht auf `main`; Stand in `docs/native/MIGRATION_PROGRESS.md`.

### Version 73: ZurÃ¼ck per Kantenwisch â€” 26.10.2026

- Neue Kantengeste `js/edge-back.js`/`css/edge-back.css`: Touch-Start in den linken 24 px, Wisch nach rechts â†’ gleiche Aktion wie der sichtbare ZurÃ¼ck-Knopf (`.click()`), sonst ZurÃ¼ckfedern. Abgedeckt: Konto-Unterseiten, Essen-Fenster (`.ffback`), Ãœbungsauswahl, Zutatensuche/Rezept, Ãœbung verschieben, Einkaufsliste. Nicht: Lauf-Ansicht, BlÃ¤tter-Pfeile, Fenster nur mit âœ•, laufendes Workout ohne Fenster, Onboarding.
- Schutz gegen Ã¼berlappende Gesten, ungÃ¼ltig gewordene Ebenen und gleichzeitiges Fensterziehen (`dragSheet`). Test `tests/check-edge-back.cjs`. Codex-Review: 3 P2 behoben, NachprÃ¼fung Freigabe ja. Nicht auf echtem iOS getestet; die iOS-HÃ¼lle aktiviert `allowsBackForwardNavigationGestures` nicht.

### Version 72: Plus dreht zum Ã—, Erststart per X schlieÃŸbar â€” 26.10.2026

- Plus-Symbol dreht bei offenem Plus-MenÃ¼ wieder um 135Â° (`css/design-system.css`, reduced-motion ohne Ãœbergang). Bei 390 px verdeckt das Sheet die Leiste; Drehung nur beim Ein-/Ausgleiten sichtbar.
- Erststart: Fenster-X in jedem Schritt beendet das Onboarding (`skipOnboarding()` in `js/flows.js`): nur `setupPending=false`/`onboardingComplete=true`, Ziele/Plan/Profil unverÃ¤ndert, erscheint nicht erneut. Kein Weg, es spÃ¤ter erneut zu Ã¶ffnen. Test in `tests/check-onboarding.cjs`.

### Version 71: Plus-Knopf in der Tab-Reihe â€” 26.10.2026

- Untere Leiste (â‰¤ 760 px): Plus-/HinzufÃ¼gen-Knopf sitzt auf derselben HÃ¶he wie die Ã¼brigen Tabs (`css/design-system.css`; `polish.css` hatte Padding/Gap auf 0 gesetzt). Browser-Messung 390Ã—844 und 320Ã—568: Symbolmitte aller fÃ¼nf KnÃ¶pfe gleich. Bekannt, unverÃ¤ndert: Plus dreht sich beim Ã–ffnen nicht zum Ã—.

### Version 70: Gesamt-Audit â€” 26.10.2026

- Sync-/Speicher-HÃ¤rtung, UI-Korrekturen aus dem Audit, `visuals.js`/`visuals.css` entfernt, README neu. Details: Abschnitt â€žGesamt-Auditâ€œ oben und `docs/audit/FINAL-REPORT.md`.

### Version 69: Training, Datum, Icons, Konto â€” 26.10.2026

- Sonnet: Ãœbungssuche feste HÃ¶he, Satzspalten mittig, Pausen-Stepper, Kalender-RÃ¼ckblick nur Seite 1 (`reviewWorkout`), Segmentleiste unter Safe Area, Fortschritt ohne e1RM/Gruppen, AktivitÃ¤ts-Endscreen mit XP (`activityDoneShow`); Datum rechts neben dem Large Title (`dsDateBar`), Tab-Leiste 54 px, Datumsfelder linksbÃ¼ndig.
- Codex: OFF in der normalen Suche (10 Anfragen/min, Wiederaufnahme), â€žText & Spracheâ€œ entfernt, KFA nach US-Navy nur mÃ¤nnlich (Hals, neuere Messung gewinnt), Profil bleibt mÃ¤nnlich; App-Icons nur `light`/`dark` (alte Werte â†’ dark, iOS festes dunkles Icon); Konto verwalten neu, deckende Speichern-Leisten, â€žWird synchronisiertâ€œ entfernt, Offline-Hinweis fixed, CSV mit Hals.
- PrÃ¼fung: Claude-Reviewer (OFF/KFA), Claude-Sonnet-Reviewer (Rest; Codex/Gemini im Limit). Offen, niedrig: `js/personal.js:11` â€žAuswertung ansehenâ€œ zeigt noch alle Abschlussseiten.

### Version 68 / iOS-App 1.7 (lokal vorbereitet): iPhone-RÃ¼ckmeldung â€” 26.10.2026

- Claude (Sonnet) UI: Konto-Listen (alte `nav{display:grid}`-Regel traf `.dsgroup`), gruppierte Ergebnislisten, Lupe-Einzug, Chips ohne Stern, Foto-Bereich â€žFoto aufnehmenâ€œ/â€žAus Fotos wÃ¤hlenâ€œ, Einheiten-Segment, Datumsfelder, Dezimalfelder mit Komma (`type=text inputmode=decimal`, strenges Muster, `dsRecheckDecimals`), Zeitraum-Abstand, Wisch-LÃ¶schen auf der Ãœbersicht, Startbildschirm 1,2 s, quadratischer Scanrahmen.
- Claude (Sonnet) Workout: Verwerfen in der Titelzeile, Drei-Punkte-Aktionsfenster (Supersatz, Verschieben, Entfernen), langes DrÃ¼cken 500 ms, kg-Satzfeld mit Komma.
- Codex: siehe Abschnitt â€žnative Live-AktivitÃ¤ten und Scannerâ€œ unten; Review-Korrekturen: nur aktive Activities aktualisieren, Feature `runActivityEndState` fÃ¼r App-1.6-VertrÃ¤glichkeit, Bridge-Ausnahmen abgefangen.
- PrÃ¼fung: Claude-Reviewer (iOS), Codex-Reviewer (Web), alle Befunde behoben; `check.cjs` grÃ¼n. Kein Swift-Build, kein echtes iPhone.

### Version 67: Kurzreview nach Redesign â€” 26.10.2026

- Codex (5-Minuten-Fehlersuche): Suchchips und Diagrammschalter auf 44 px MindesthÃ¶he; Makrobalken mit gÃ¼ltigen ARIA-Werten und `aria-valuetext`, auch ohne Ziel. Claude `puls-frontend`: Platzhalterkontrast hell/dunkel auf mindestens 4,5:1.
- PrÃ¼fung: `check.cjs` grÃ¼n, Diff vom Koordinator gesehen. Kein Browser-/iPhone-Test dieser Kleinigkeiten.

### Version 66: Apple-Redesign Schritt 2 â€” 26.10.2026

- Claude `puls-frontend`: Essen (Segmentsteuerung, Makrobalken in Akzent, Aktionsliste, Wasserzeile), HinzufÃ¼gen-Fenster als Aktionsliste, Training (Segmentsteuerung, ruhiger Kopf, Workout-Karten), Laufen (Phosphor je AktivitÃ¤t), Konto als iOS-Einstellungsliste mit Chevron, einheitliche Sheets, gestaltete DateiknÃ¶pfe, Select-Chevron, Startbildschirm nur â€žPULSâ€œ (max. 0,6 s). Emojis im Quellcode durch `pulsIcon`/`uiIcon` (`js/app.js`) ersetzt, DOM-Emoji-Ersatz entfernt. `css/food-refresh.css`, `overview-refresh.css`, `training-refresh.css`, `account-refresh.css` neu und schlank.
- Entscheidung Koordinator: gefÃ¼llte KnÃ¶pfe `#0071E3` (weiÃŸe Schrift 4,7:1) statt `#007AFF` (4,0:1); Akzenttext Ã¼ber `--ds-accent-text`.
- PrÃ¼fung: Codex-Review (1 Kontrastbefund, behoben), `check.cjs` grÃ¼n, Browser 390 px hell/dunkel durch den Frontend-Agenten. Kein echtes iPhone, kein VoiceOver, keine echte Safari-Dateiauswahl.
- Bekannte Grenzen: SegmentknÃ¶pfe 44 px hoch, Tab-Beschriftung 10 px, Diagrammfarben zur Laufzeit als Hex (`dsSeriesColors`), einige abgeschaltete Altfunktionen enthalten noch Zeichen wie ï¼‹/â†’ (nicht sichtbar).

### Version 65: Apple-Redesign Schritt 1, Offline, Passwort anzeigen â€” 25.10.2026

- Regeln: `docs/DESIGN-SYSTEM.md` (Verbotsliste, Farben, Schrift, Radien, Phosphor-Icons). Skill `apple-design` und `swiftui-expert` liegen lokal unter `~/.claude/skills/` (nicht im Repo, Lizenz der HIG-Texte).
- Daten (Codex): Farbschema ist GerÃ¤teeinstellung in `localStorage['puls-color-scheme']` (`js/color-scheme.js`: `getColorScheme`, `setColorScheme`, `applyColorScheme`, `data-scheme` auf `<html>`), nicht synchronisiert, beim Start keine State-Ã„nderung (sonst Sync-Konflikt auf ZweitgerÃ¤t). Alte Felder `appDesign`/`colorTheme` bleiben wirkungslos erhalten; `js/designs-extra.js` bleibt wegen `validData`. `js/connectivity.js`: `window.pulsConnectivity` + Event `puls:connectivity`. `sw.js`: Katalog (5,5 MB) im eigenen Cache `puls-catalog-v1`, nur bei KatalogÃ¤nderung erhÃ¶hen.
- UI (Claude `puls-frontend`): `css/design-system.css` als letzte Schicht, `js/icons.js` (Phosphor, MIT), `js/design-system.js` als letztes Skript (Tab-Leiste, neue Ãœbersicht, Passwort-Knopf fÃ¼r alle Passwortfelder in Fenstern, Offline-Hinweis, Darstellung System/Hell/Dunkel). Alle CSS-Dateien mechanisch bereinigt (Schatten, VerlÃ¤ufe, Blur, Hover, Animationen weg; classic-Regeln als Basis Ã¼bernommen, andere Designs entfernt). `css/designs-extra.css` gelÃ¶scht.
- PrÃ¼fung: Claude-Reviewer (Daten, 2 Runden), Codex-Reviewer (UI, 2 Runden), alle Befunde behoben; `check.cjs` grÃ¼n; Browser 390Ã—844 hell/dunkel durch den Frontend-Agenten. Kein echter iPhone-Test, kein echter Safari-SW-Test.
- Schritt 2 offen: Essen (Makrokacheln, Wasser, VorschlÃ¤ge), HinzufÃ¼gen-Fenster (Kachelraster), Training-Kopf, Konto (Nummern, Wortmarke, Pfeile), etwa 40 Emoji/Unicode-Stellen in JS, Pastell-Inline-Farben, Selects ohne Pfeil, Laufen-Bildschirm, Typo-Stufen in Altbildschirmen.

### Version 64: AktivitÃ¤ten-Paket â€” 25.10.2026

- UI-Teil (Claude): neue Datei `js/activity-overview.js` (Bereich â€žAktivitÃ¤tenâ€œ im Fortschritt, Darstellungs-Wrapper fÃ¼r `baselineEnergyLine`); `js/run-session.js` (Live-Ansicht je Art, hochziehbare Wertekarte, Leiste Sperre Â· Pause Â· Beenden mit Doppeltipp, Sperre inert + 1 s Halten, Runde als Pille, MMA-Rundenbox mit Ton/Haptik, Runden in der Zusammenfassung); `js/run-map.js` (Wanderwege-Ebene, Zustand pro GerÃ¤t in localStorage `puls-map-trails`); `js/running.js` (Wochenzeile aktive Minuten, Zielformular); `js/profile-refresh.js` (Schalter Kalorienberechnung/Alltagsfaktor).
- Grenzen: kein echter iPhone-Test (Touch-Drag, 1-s-Halten, GPS). MMA-Signale nicht bei gesperrtem iPhone/Hintergrund, Ton still bei Stummschalter. Wanderwege-Kacheln nur online, externer kostenloser Dienst. Kalibrierung im Baseline-Modus aus. Ãœbergang: GerÃ¤te mit alter Version im Cache rechnen das Ziel klassisch, bis aktualisiert.
- SpÃ¤ter, eigene Pakete: Uhr-Anbindung, Routensuche Ã  la Komoot.
- Review-Nacharbeit im inzwischen integrierten UI-Stand: Baseline-Ziele warten beim Start auf die vollstÃ¤ndig geladene AktivitÃ¤tslogik; kein vorÃ¼bergehender Speicherstand ohne Sport. Aufteilungszeile nur fÃ¼r tatsÃ¤chlich berechnete Baseline-Ziele, Ã¼brige Zielanzeigen und EssensvorschlÃ¤ge auf das gewÃ¤hlte Tagesziel umgestellt. Claudes Darstellung bleibt erhalten. MMA-Weiterschaltmarken sind mit den bisherigen Laps-Regeln vereinbar und zusÃ¤tzlich getestet; siehe `ACTIVITY-DATA.md`.

- Koordinator-Auftrag von Claude Code, Basis `54e0725`; keine VerÃ¶ffentlichung/VersionsÃ¤nderung, kein Live-Backend und keine Ã„nderung an `ios/`.- Neue MMA-/Padel-KatalogeintrÃ¤ge mit Compendium-NÃ¤herungen, Picker-Flag, sicherer Fallback unbekannter Typen sowie Erhalt alter/ausgeblendeter Typen beim Bearbeiten. Optionale Uhr-/Puls-/Lap-/MMA-Rundenfelder und Minuten-Wochenziel werden verlustfrei validiert.
- Brutto-Gym-SchÃ¤tzung nach Zeit/MET/Gewicht, Netto-Sportbedarf einschlieÃŸlich Gym, Baseline-Modus mit Tages-Sportzulage nach dem Zu-/Abschlag (auch Extrem); klassische/manuelle Ziele erhalten. Verlaufskalibrierung im Baseline-Modus ausdrÃ¼cklich deaktiviert. Neue Sessions erhalten Dauer-XP mit gemeinsamem Tageslimit 100, zusÃ¤tzlich zu bisherigen PR-XP; alte EintrÃ¤ge werden nicht nachtrÃ¤glich markiert.
- Wochen-/Monatsaggregation nach Art einschlieÃŸlich Gym und Recap ergÃ¤nzt. AusfÃ¼hrliche Datenformate, globale Schnittstellen, Rechengrenzen und Integrationsschritte: [ACTIVITY-DATA.md](ACTIVITY-DATA.md).
- PrÃ¼fung: gezielte Daten-/Metrik-/Planner-/Regressionstests und `node scripts/check.cjs` lokal grÃ¼n. Echter iPhone-Test steht aus (siehe Grenzen oben). Mock-Tests sind kein Live-RLS-Nachweis.

### Version 63 / iOS-App 1.6: AktivitÃ¤ten im Vollbild â€” 25.10.2026

- Selvirs Wunsch nach Vergleich mit adidas Running/Strava: Plus â†’ â€žAktivitÃ¤tâ€œ Ã¶ffnet direkt eine eigene Vollbild-Ansicht (`js/run-session.js`, wie das laufende Workout) mit Karte, links AktivitÃ¤tsart (Laufen, Trailrun, Spazieren, Wandern, Berggehen, Radfahren, Tischtennis, FuÃŸball, Inlineskaten, Sonstiges), mittig Start, rechts Route. Countdown 10 s mit â€ž+10 Sekundenâ€œ und â€žJetzt startenâ€œ. Live: Dauer, Distanz, Kalorien (geschÃ¤tzt), Ã˜ Pace, Karte, Pause; pausiert Beenden/Weiter. Zusammenfassung: GefÃ¼hl (5 Stufen), Untergrund, Notiz, Ã˜/Max-Geschwindigkeit, HÃ¶henmeter, max. HÃ¶he, Pause, km-Zeiten; Weiter/Speichern/Verwerfen. â€žNur Timerâ€œ und â€žLauf eintragenâ€œ entfernt; alte EintrÃ¤ge bleiben sichtbar und lassen sich bearbeiten (Art, GefÃ¼hl, Untergrund, Notiz) oder lÃ¶schen.
- Codex (backend): `js/run-metrics.js` mit AktivitÃ¤tskatalog, Kalorien nach Compendium of Physical Activities (Brutto, MET Ã— kg Ã— h, Laufen/Gehen tempoabhÃ¤ngig, letztes Gewicht nÃ¶tig), HÃ¶he (geglÃ¤ttet, Hysterese), Max-Geschwindigkeit (20-s-Fenster); `tests/check-run-metrics.cjs`. GPS-Punkte jetzt `[t,lat,lon,acc,seg,alt,altAcc]` (altAcc âˆ’1 = unbekannt, alte 5er-Punkte gÃ¼ltig).
- Neue optionale Felder an `state.runs[]`: `type`, `startedAt`, `pauseSeconds`, `kcal`, `feeling`, `terrain`, `elevationGain`, `elevationMax`, `maxSpeed`; `distanceKm` darf 0 sein (Tischtennis). `activeRun.type`, `runSettings.lastType`. Wochenziel, Bestzeiten und XP nur fÃ¼r Laufen/Trailrun; alle AktivitÃ¤ten zÃ¤hlen fÃ¼r die Serie.
- iOS 1.6: HÃ¶he in `RunTracker`, Standort vor dem Start (`runLocate` â†’ `pulsRunLocateReceive`), Live-AktivitÃ¤t mit AktivitÃ¤tsname.
- Grenzen: Kalorien sind SchÃ¤tzungen; HÃ¶he aus GPS ist ungenau (Barometer nicht genutzt). GerÃ¤tetest (GPS, Hintergrund, Live-AktivitÃ¤t) nur auf dem iPhone mÃ¶glich.

### Version 62 / iOS-App 1.5: Laufen â€” 25.10.2026

- Auf Selvirs Wunsch (Vorbild Strava/adidas Running, iOS-Ã„nderungen ausdrÃ¼cklich erlaubt): `js/running.js`, `js/run-map.js`, `css/running.css`, Leaflet 1.9.4 lokal in `js/vendor/`/`css/vendor/` (nur beim Ã–ffnen einer Karte geladen). LÃ¤ufe eintragen, Timer oder Lauf mit GPS, Live-Karte, Detailansicht (Karte, km-Zeiten, Ã˜ Pace, Ã˜ km/h), Bestzeiten 1/5/10/21 km, Wochenziel in km, Routenplaner Ã¼ber BRouter (kostenlos, Profil Wandern) mit gespeicherten Routen und â€žMit dieser Route laufenâ€œ. Anzeige im Workout-Tab, Kalender, Fortschritt, Ãœbersicht und Plus-MenÃ¼. LÃ¤ufe halten Tages-/Wochenserie, 25 XP bei Bestleistung ab 1 km.
- Daten (alle optional, `validData()` geprÃ¼ft, alte Sicherungen gÃ¼ltig): `state.runs[]` (`distanceKm`, `durationSeconds`, `note`, `source:'gps'`, `route` â‰¤ 300 Punkte, `splits`, `splitRest`), `state.activeRun`, `state.runSettings.weeklyGoalKm`, `state.runRoutes[]`. GPS-Rohpunkte nur lokal (`puls-run-track`, GerÃ¤tezuordnung `puls-run-device`), nicht synchronisiert; nur das startende GerÃ¤t misst.
- iOS 1.5: `RunTracker.swift` (Hintergrund-GPS, `UIBackgroundModes: location`), `RunActivityCoordinator.swift` + `RunActivityWidget.swift` (Live-AktivitÃ¤t/Dynamic Island, animierte Zahlen, Mitteilung je km), Kennzeichen `runGps`/`runActivity`. Details in `docs/IOS-APP.md`.
- Kartenkacheln: OpenStreetMap mit CSS-Dunkelfilter; CARTO-Dunkelkacheln verlangen inzwischen einen SchlÃ¼ssel.
- PrÃ¼fung: `tests/check-running.cjs` (DatenprÃ¼fung, XP, Serie, GPS-Filter, Splits, Strecke, BrÃ¼cke), `node scripts/check.cjs` grÃ¼n; Browser 390 Ã— 844 mit simuliertem Standort (GPS-Lauf, Live-Karte, Detail, Planer mit echtem BRouter). Codex-Reviews in 4 Runden, 13 Befunde behoben (u. a. XSS Ã¼ber Lauf-ID, Datenverlust beim Abschluss, fremdes GerÃ¤t startet GPS, Rohpunkte nicht gelÃ¶scht, doppelte km-Mitteilung).
- Grenzen: Swift nur statisch geprÃ¼ft, Kompilierung erst im CI; echtes GPS, Hintergrundbetrieb, Live-AktivitÃ¤t und Mitteilungen nur auf dem iPhone prÃ¼fbar. Im Browser misst GPS nur bei offener App. OSM-Kacheln und BRouter brauchen Netz.

### Version 58â€“61: kleine Web-Korrekturen â€” live â€” 25.10.2026

- Koordinator-Auftrag von Claude Code, Basis `cf4725f`: drei kleine Korrekturen. `js/app-polish.js` berechnet den KalorienÃ¼berschuss aus Tageswert/Ziel statt aus bereits Ã¼bersetztem Text; dadurch bleibt `+X kcal` auch auf Englisch erhalten. `js/food-flow.js` verwirft alte Zutaten-Suchantworten schon bei der nÃ¤chsten Eingabe und bindet verzÃ¶gerte Suchen an den ursprÃ¼nglichen Ergebnisbereich. Die Rezept-LÃ¶schbestÃ¤tigung berÃ¼cksichtigt Deutsch/Englisch.
- Neue `tests/check-small-polish.cjs`, im regulÃ¤ren Check eingebunden: beide Sprachen/Seiten, Ãœberschuss/Rest/exaktes Ziel, Antworten wÃ¤hrend der Tipp-Pause, ersetzte Suchfenster, LÃ¶schabbruch und erhaltene TagebucheintrÃ¤ge. Nach jeder der drei Korrekturen `node scripts/check.cjs` bestanden.
- Keine CSS-/Layout-, Datenmodell-, iOS- oder BackendÃ¤nderung; kein Commit/Push. Version bleibt 57, Release-Versionierung Ã¼bernimmt Claude. Nur synthetische VM-Fixtures; Browser-/390-px-/iPhone-PrÃ¼fung und integrierte PrÃ¼fung beim Koordinator offen.
- Runde 2, lokal auf Basis `0796122` (Version 58): zwei weitere kleine Korrekturen. Checkbox-Auswahlhaptik lÃ¤uft erst beim hochgereichten `change`, damit die Satz-Haptik nicht vom vorherigen Klick gedrosselt wird (`js/haptics.js`). OCR Ã¼bernimmt Kalorien mit Ungleichheitszeichen/negativem Vorzeichen nicht mehr als exakte positive Werte; Spaltenpositionen bleiben erhalten (`js/food-upgrade.js`). Beide Fehler zuerst mit roten Regressionen in `tests/check-small-polish.cjs` reproduziert; nach jeder Korrektur vollstÃ¤ndiger Check bestanden. Keine VersionserhÃ¶hung, VerÃ¶ffentlichung oder Backend-/iOS-Ã„nderung; echte GerÃ¤tehaptik/Kamera und Browserlayout nicht geprÃ¼ft.

- Runde 3, lokal auf Basis `319a692` (Version 59): zwei kleine Korrekturen. Der Workout-Abschlussdialog zÃ¤hlt SÃ¤tze und warnt vor offenen SÃ¤tzen anhand der exakt Ã¼bergebenen Workout-ID statt einer Teiltextsuche im Formular-Handler (`js/workout-controls.js`); Ã¼berlappende IDs aus Sicherungen liefern dadurch keine fremde Ãœbersicht. Ein im Hintergrund vorgemerkter Pausenhinweis erscheint nach Zustandswechsel nur noch, wenn sein ursprÃ¼ngliches Workout weiterhin vorhanden ist (`js/rest-popup.js`). Beide Fehler zuerst mit roten Regressionen in `tests/check-small-polish.cjs` reproduziert; DE/EN-Abschlusswarnungen sowie unverÃ¤ndertes/entferntes/ersetztes/beendetes Workout und neu gestartete Pause geprÃ¼ft. VollstÃ¤ndiger Check nach jeder Korrektur bestanden. Keine VersionserhÃ¶hung, VerÃ¶ffentlichung, Datenmodell-, Backend- oder iOS-Ã„nderung; Browser-/GerÃ¤teprÃ¼fung offen.

- Runde 4 (letzte), lokal auf Basis `58ebda7` (Version 60): eine kleine Produktkorrektur in `js/products.js`. NÃ¤hrwertfelder mit ausschlieÃŸlich Leerraum bleiben unbekannt (`null`), statt durch `Number()` als bekannte Null zu erscheinen. Rote Regression in `tests/check-small-polish.cjs` zuerst reproduziert; nach Korrektur vollstÃ¤ndiger Check bestanden. PrÃ¼ft Leerzeichen/Tab/Zeilenumbruch/geschÃ¼tztes Leerzeichen, echte Nullwerte/Zahlen und den bestehenden kJ-Fallback. Keine VersionserhÃ¶hung, VerÃ¶ffentlichung, Datenmodell-, Backend- oder iOS-Ã„nderung. Nur VM-Fixtures; reale Barcode-/KameraprÃ¼fung nicht durchgefÃ¼hrt. Wegen knappem Kontingent bei diesem vollstÃ¤ndig geprÃ¼ften Befund abgeschlossen.

### Profil-/Planformular â€” Schritt 1 Logik, lokal â€” 24.10.2026

- Koordinator-Auftrag auf Basis `98cadad` (Version 42): ausschlieÃŸlich Profil-/Planlogik in `enhancements.js`, `experience.js`, `adaptation.js`; Layout und Entfernen von ErklÃ¤rungstexten folgen bei Claude. Keine VerÃ¶ffentlichung, Versions-/Asset-/SW- oder iOS-Ã„nderung.
- Review-Nacharbeit nach Koordinatorentscheidung: PersÃ¶nliches mÃ¤nnliches Profil bleibt verbindlich; Laden und Formular normalisieren wie zuvor `sex` auf `male` und `special` auf `false`. `validData()` akzeptiert alte Sicherungen unverÃ¤ndert. ZusÃ¤tzliche Profil-/Planfelder bleiben erhalten. Inaktive Makroparameter und Tempo blockieren keinen Moduswechsel; ungÃ¼ltiger inaktiver RMR erhÃ¤lt den bisherigen Messwert. Dezimalwerte aus gÃ¼ltigen Sicherungen werden nicht durch HTML-Schrittweiten blockiert.
- 4/4/9-PrÃ¼fung mit 50-kcal-Toleranz bei manuellen Kalorien und bei automatischen Kalorien mit selbst gesetzten Makros: nur bei Ã„nderungen relevanter kcal-/Makrofelder oder Wechsel des Kalorien-/Makromodus. UnverÃ¤nderte unstimmige Altziele blockieren andere ProfilÃ¤nderungen nicht; keine automatische Umrechnung. Vorschau und Speichern verwenden dieselbe Validierung, auch bei teilweise ausgefÃ¼lltem Profil im manuellen Modus. Automatische Gewichtsanpassungen erhalten selbst gesetzte Makros weiterhin.
- Vorschau/Prognose verwenden den aktuellen Lern-Schalter; geÃ¤nderte Formelgrundlagen verwerfen Kalibrierung vor dem Neuberechnen. Abgewiesenes Speichern lÃ¶st keine nachtrÃ¤gliche Kalibrierung aus. Adaptive Ziele prÃ¼fen AusschlÃ¼sse, endliche Werte und Grenzen. Extremes Abnehmtempo erzeugt bei zu niedrigem Erhalt keinen Ãœberschuss; bei Wechsel auf Zunehmen gilt das bisher rechnerisch verwendete hohe Tempo auch sichtbar.
- UnverÃ¤ndertes vorbelegtes Gewicht erzeugt keine heutige Messung. Explizite Ã„nderungen behalten vorhandene Messungs-IDs; direkte ZielÃ¤nderungen werden wie adaptive Ã„nderungen tagesweise in `goalHistory` erfasst. Neue Regressionen: `tests/check-profile-planning.cjs`, im regulÃ¤ren PrÃ¼flauf eingetragen. PrÃ¼fung: `node scripts/check.cjs` und `git diff --check` bestanden.
- Grenzen/Integration: Kern vom unabhÃ¤ngigen Claude-PrÃ¼fer bestÃ¤tigt; dessen vier Nacharbeiten sind umgesetzt, NachprÃ¼fung und Browser-/iPhone-PrÃ¼fung beim Koordinator offen. VM-Tests belegen kein Layout oder Live-RLS. Claudes neue `profile-refresh.js`/`.css` wurden bei der Logik-Nacharbeit nicht verÃ¤ndert; bestehende IDs/Container bleiben Schnittstelle. Konto â†’ Deine Daten bietet JSON-Export und CSV direkt; Wiederherstellen liegt weiterhin im Sicherungs-Tab (zuvor â€žDaten & Methodenâ€œ). Versteckte `pr-sex`/`pr-special` bleiben als kompatible Formularschnittstelle erhalten.

### Version 43 â€” Profil & Ziele â€” verÃ¶ffentlicht 24.10.2026

- OberflÃ¤che (Claude): `profile-refresh.js`/`.css`, alle Designs. Abschnitte 01 KÃ¶rper, 02 Ziel, 03 Makros, 04 Automatik, 05 Ergebnis; ErklÃ¤r- und Annahmetexte ausgeblendet; Selects `pl-mode`, `pl-direction`, `pl-pace`, `pl-macros`, `pr-method` als Schalter (Selects bleiben versteckt die Quelle); im Modus irrelevante Felder ausgeblendet; Speichern und `#plan-error` fest unten; Tab â€žDaten & Methodenâ€œ heiÃŸt â€žSicherungâ€œ (nur Export, Wiederherstellen, CSV). EN-Ãœbersetzungen und `aria-label` nach Codex-Review ergÃ¤nzt.
- Logik (Codex, EintrÃ¤ge unten): 9 Fehler behoben, danach 4 Review-Punkte des Claude-PrÃ¼fers: mÃ¤nnliches Profil wieder normalisiert (Koordinator-Entscheidung gemÃ¤ÃŸ frÃ¼herer Produktentscheidung), 4/4/9-PrÃ¼fung auch bei berechneten kcal mit selbst gesetzten Makros und nur bei geÃ¤nderten Zielfeldern, Vorschau und Speichern identisch validiert.
- Reviews: Codex prÃ¼fte die OberflÃ¤che (2 Befunde behoben), Claude-PrÃ¼fer die Logik (Gemini im Kontingent-Limit bis ca. 31.10.2026). Browser 390 Ã— 844: Selbst/Berechnet, Halten, Teilprofil, 4/4/9, Speichern und WiederÃ¶ffnen, Sicherungs-Tab, Englisch. Grenzen: kein echtes iPhone, kein VoiceOver-GerÃ¤tetest.

### Version 42 â€” Wischseiten mit Abstand â€” verÃ¶ffentlicht 24.10.2026

- Selvirs Wunsch: Beim Wischen von Energie & Makros zu MikronÃ¤hrstoffen lagen die Inhalte zu dicht. Ãœbersicht und Essen (Original): .nutritiontrack reicht per margin-inline:-16px bis an den Rand, Seiten haben 16 px Innenabstand â†’ Inhalt bÃ¼ndig, 32 px Luft zwischen den Seiten; Seitenbreite = Bandbreite, daher Punkte/setNutrientSlide() unverÃ¤ndert. Browser: Einrasten, Punkte, kein Ãœberlauf auf beiden Seiten geprÃ¼ft.

### Version 41 â€” Essen im Originaldesign â€” verÃ¶ffentlicht 24.10.2026

- Letzter Abschnitt aus docs/DESIGN-WORKPLAN.md (Claude): neue food-refresh.css, nur body[data-current-page=food][data-app-design=classic]. Offene Abschnitte 01â€“05 (Energie & Makros, Dein Essen, VorschlÃ¤ge, NÃ¤hrstoffwerte, Erfassung abschlieÃŸen) mit Trennlinien statt Karten, Hauptaktion breit und zwei Nebenaktionen, Wasser als schlanke Zeile, Tagebuch als Zeilen mit deckendem Hintergrund (Wischen zum LÃ¶schen unverÃ¤ndert), kurze Animationen, reduzierte Bewegung. Kein JS/HTML/Datenmodell geÃ¤ndert.
- Review Codex: 2 Befunde behoben (Wasserknopf 44 px gegen comfort.css-!important; Innenabstand 04/05 gegen compact.css-SpezifitÃ¤t). Browser 390 Ã— 844 und 320 px ohne Ãœberlauf, Wischen-LÃ¶schen geprÃ¼ft. Grenzen: kein echtes iPhone, andere Designs bewusst unverÃ¤ndert.

### Version 40 â€” verÃ¶ffentlicht 24.10.2026 (erster Teamauftrag Claude + Codex + Gemini)

- Laufendes Workout (Claude): `session-focus.css`/`session-focus.js`. Pausentimer klebt in allen 11 Designs direkt unter der Session-Kopfzeile; deren echte HÃ¶he (Safe Area/Dynamic Island) wird als `--session-head-h` gemessen. Vorher lag `top:80px` auf dem iPhone hinter der ~128 px hohen Kopfzeile, im Original-Design zudem halbtransparent. Satzzeilen ohne Trennlinien mit 8 px Abstand; Abhak-Box sichtbar 24 px in 44 Ã— 44 px TippflÃ¤che, helles HÃ¤kchen bei dunklen Akzenten (apple, mono, terra, blueprint).
- Erststart optional + Tutorial entfernt (Codex, EintrÃ¤ge unten). Landkarte vorab von Gemini.
- Reviews: Codex prÃ¼fte `native-bridge.js` (2 Befunde behoben: geÃ¤nderte Satzangaben wÃ¤hrend der Pause, Cloud-Abgleich setzte Fortschritt zurÃ¼ck); Gemini prÃ¼fte Claudes Session-Ã„nderungen (2 Befunde behoben: HÃ¤kchen-Kontrast, 44-px-Spalte); Claude und Gemini prÃ¼ften Codex' Erststart/Tutorial (keine Befunde).
- PrÃ¼fung: `node scripts/check.cjs`, Bridge-VM-Simulation, Browser 390 Ã— 844 mit `?erststart=1` (leerer Erststart bis Ãœbersicht, Konto ohne NaN/Tutorial, Session in allen Designs mit simulierter 59-px-Safe-Area). Grenzen: kein echtes iPhone vor VerÃ¶ffentlichung, kein Live-Sync-Test.

### Optionaler Erststart und Tutorial entfernt â€” Teil von Version 40

- Koordinator-Auftrag auf Basis `2e5f450`: Name und alle Planungsangaben beim Erststart optional; Abschluss Ã¼ber `onboardingComplete`/`setupPending`, unabhÃ¤ngig vom Namen. UnvollstÃ¤ndige oder nicht automatisch planbare Eingaben speichern kein Teilprofil und verÃ¤ndern keine bestehenden Ziele. VollstÃ¤ndige geeignete Angaben nutzen die bisherigen Profil-, Plan-, Historien- und Startgewichtswege. Kontobearbeitung behÃ¤lt ihre Validierung. Avatar und Kontoname berÃ¼cksichtigen Leerzeichen.
- Tutorial samt automatischem Start, Konto-MenÃ¼, Wrappern, Ãœbersetzungen und CSS entfernt. `tutorialVersion` undefined/0/1 bleibt importierbar. Erfolgreicher Backup-Import bestimmt den lokalen Onboarding-Ablauf neu; fertige Backups bleiben nicht in der Erststart-Schleife hÃ¤ngen.
- `node scripts/check.cjs` einschlieÃŸlich neuer `tests/check-onboarding.cjs` bestanden: leerer Erststart, nur Name, vollstÃ¤ndige/unvollstÃ¤ndige/ungÃ¼ltige Profile, Neustart, unverÃ¤nderte Ziele, bisherige Kontovalidierung, alte Flags und Backup-Import. Bestehende Cloud-/Konflikttests ebenfalls bestanden. VM-Tests sind kein Layout- oder Live-RLS-Nachweis.
- Keine VerÃ¶ffentlichung, Backend- oder iOS-Ã„nderung. Versions-/Asset-/SW-Anpassungen und unabhÃ¤ngiges Review Ã¼bernimmt Claude als Koordinator. Browser hier nicht verfÃ¼gbar (`Browser is not available: iab`); PrÃ¼fung bei 390 Ã— 844, Interaktionen und Designs bleibt beim Koordinator offen. Seine bestehenden Ã„nderungen an Session-Fokus, Native Bridge, Einstieg und Service Worker bleiben unberÃ¼hrt.

### Pausen-Mitteilung und Dynamic Island â€” Web 39 / iOS-App 1.1 â€” 24.10.2026

- Selvirs Wunsch: Bei Pausenende auÃŸerhalb der App benachrichtigt werden, Countdown in der Dynamic Island (iPhone 16 Pro Max). Neue `native-bridge.js` (nur in der iOS-HÃ¼lle aktiv, im Browser wirkungslos) meldet die erste ablaufende Pause unbeendeter Workouts; `ios/PULS/RestCoordinator.swift` plant die Mitteilung und steuert die Live-AktivitÃ¤t, `ios/PULSWidgets/` zeichnet Dynamic Island und Sperrbildschirm. Keine Ã„nderung an Timer-Logik, Datenmodell oder `validData()`.
- PrÃ¼fung: `node scripts/check.cjs` grÃ¼n; VM-Simulation der BrÃ¼cke (Start, +30 s, neuer Satz, Ãœbungswechsel, Superset, zwei Workouts, Reload nach Pausenende, Workout-Ende, Browser ohne Handler). Review durch Claude-PrÃ¼fer (Codex im Nutzungslimit); alle sieben Befunde behoben.
- Grenzen: Swift nur durch CI kompiliert, nicht auf GerÃ¤t getestet. Ob AltStore mit kostenloser Apple-ID die Widget-Erweiterung behÃ¤lt, ist ungeprÃ¼ft; ohne sie gibt es nur die Mitteilung.

### Native iOS-HÃ¼lle â€” 24.10.2026

- Auf Selvirs Wunsch (echte iOS-App per AltStore auf iPad/iPhone): `ios/` enthÃ¤lt eine Swift-`WKWebView`-HÃ¼lle um die Live-Web-App; `.github/workflows/ios-app.yml` baut auf macOS eine unsignierte `PULS.ipa` und verÃ¶ffentlicht sie als GitHub-Release (`/releases/latest/download/PULS.ipa`). Anleitung und Grenzen: `docs/IOS-APP.md`.
- Keine Ã„nderung an Web-App-Dateien oder App-Version (bleibt 38). Erster CI-Build erfolgreich, IPA enthÃ¤lt App, Info.plist und Icons.
- Grenzen: nur kompiliert, noch nicht auf echtem GerÃ¤t installiert/getestet. App-Speicher ist getrennt von Safari; Daten kommen Ã¼ber Konto-Sync.

### Trainings-Vorschau 38 â€” 24.10.2026

- Nach BestÃ¤tigung der Ãœbersicht beauftragt. Neue `training-refresh.css` gestaltet ausschlieÃŸlich Training im Originaldesign sowie Original-Vollbildsessions unabhÃ¤ngig vom Hintergrundtab. Vier unterstrichene Reiter, offene Routinen-/Kalender-/Fortschrittsabschnitte, klare Typografie, flache Ergebnisgitter. Kurze Ãœbergangs-/Satzanimationen; bestehende Feieranimationen und Reduced Motion erhalten.
- Keine neue JS-Logik, Timer-/Daten-/ID-/HandlerÃ¤nderung oder BackendÃ¤nderung. Satzfelder/Checkboxen 44 px; fÃ¼nfspaltiges Raster mit schmaler Variante. Modals und Sortierghosts unverÃ¤ndert.
- Version 38 lokal konsistent in Anzeige, Package, Asset-Queries und SW-Cache; Stylesheet zuletzt und als Offline-Asset ergÃ¤nzt. Am 24.10.2026 zusammen mit 36 und 37 als Commit `0c62ef6` verÃ¶ffentlicht; GitHub Pages liefert 38 aus.
- PrÃ¼fung: `node scripts/check.cjs`, IntegrationsprÃ¼fung und `git diff --check` bestanden. UnabhÃ¤ngiges Review ohne offene belegte Befunde; letzte Select-Farbkorrektur nachgeprÃ¼ft.
- Browser mit isolierten Testdaten: alle vier Tabs, leere Ansicht und Routine mit langem Namen/zwei Ãœbungen, Start, 50 kg Ã— 8 eintragen/abhaken, automatischer Pausenstart und +30 s, Positionswechsel mit erhaltenen Satzwerten, Minimieren und Fortsetzen aus Ãœbersicht, Abschluss mit unerledigter Ãœbung einschlieÃŸlich ZurÃ¼ck sowie alle drei Abschlussansichten. Kalender zeigt Testtraining; Fortschritt 400 kg Volumen/8 Reps und Zeitraumfilter geprÃ¼ft. HauptprÃ¼fung 390 Ã— 844; Session zusÃ¤tzlich bei 320 px ohne horizontalen Ãœberlauf. Sichtbare Satzfelder und Checkboxen 44 px bestÃ¤tigt.
- Grenzen: kein reales iPhone/Safari, kein echter Touch-Drag-/Safe-Area-/Hintergrundtimer-Test, kein Offline-SW- oder Live-Sync-Lauf. Positionswechsel per Auswahlfeld geprÃ¼ft; vorhandene Drag-Logik nicht verÃ¤ndert. Reduced Motion implementiert/im Code geprÃ¼ft, nicht mit aktivierter Betriebssystemoption getestet. Andere Designs vom neuen CSS ausgeschlossen, nicht erneut vollstÃ¤ndig geprÃ¼ft.
- Selvir hat Version 38 verÃ¶ffentlichen lassen und auf dem iPhone bestÃ¤tigt. Essen folgt erst nach weiterem konkretem Auftrag.

### Ãœbersichts-Vorschau 37 â€” 24.10.2026

- Nach positiver Beurteilung des Kontos von Selvir beauftragt. `overview-refresh.css` gestaltet ausschlieÃŸlich `home` im Originaldesign: offene Abschnitte, Nummern 01â€“04, klare Typografie/Trennlinien, kompakte AktionsknÃ¶pfe, kurze Eintritts-/Kreis-/Balkenanimationen und Reduced Motion. Bestehendes HTML, Handler und Berechnungen unverÃ¤ndert; kein neues JavaScript, kein Backend oder Datenmodell.
- Letztes Stylesheet in `index.html`, Offline-Asset in `sw.js` ergÃ¤nzt. Lokale Anzeige, Asset-Queries, Package und Cache konsistent Version 37. Keine VerÃ¶ffentlichung und kein Release-Commit; verÃ¶ffentlichter Stand weiterhin 35.
- PrÃ¼fung: `node scripts/check.cjs` und `git diff --check` bestanden; unabhÃ¤ngiges Review ohne offene belegte Befunde. In der BrowserprÃ¼fung gefundene CSS-SpezifitÃ¤tskonflikte bei Nummerierung/InnenabstÃ¤nden korrigiert und unabhÃ¤ngig nachgeprÃ¼ft.
- Browser bei 390 Ã— 844 mit isolierter Erststart-Vorschau: leere und gefÃ¼llte Bilanz, Mikro-Wechsel bei unverÃ¤ndert 220 px Pane-HÃ¶he, Essen erfassen und Vorschau, Routine erstellen mit langem Namen, starten/minimieren/fortsetzen, leeres Testworkout verwerfen, Zeitraum/Kurvenfilter und Vortag/Heute geprÃ¼ft. Kein horizontaler Ãœberlauf; geprÃ¼fte AktionsknÃ¶pfe mindestens 44 px hoch. Testdaten ausschlieÃŸlich im Speicher der Vorschau.
- Grenzen: kein reales iPhone/Safari oder Offline-SW-Lauf; reduzierte Bewegung im Code geprÃ¼ft, nicht per Betriebssystemoption aktiviert. Andere neun Designs vom neuen CSS ausgeschlossen, nicht erneut vollstÃ¤ndig im Browser geprÃ¼ft. Bestehende Mock-Tests sind kein Layout- oder Live-Sync-Nachweis.
- Selvir hat die Ãœbersicht bestÃ¤tigt und Training als nÃ¤chsten Abschnitt beauftragt. Essen bleibt als spÃ¤terer Abschnitt geplant.

### Konto-Vorschau 36 â€” 24.10.2026

- BestÃ¤tigter Plan in `docs/DESIGN-WORKPLAN.md`; persÃ¶nliche iPhone-Nutzung ersetzt einen geplanten Ausbau fÃ¼r Freunde.
- Lokal umgesetzt in `account-refresh.js` und `account-refresh.css`: kompakte IdentitÃ¤t, Ziel und Gewicht/Wochenmittel; MenÃ¼zeilen zu vorhandenen Detailbereichen, ZurÃ¼ck mit Fokus/Scrollposition, kurze Animationen und Reduced-Motion-Regeln. Keine neuen persistierten Datenfelder oder BackendÃ¤nderungen.
- Originaldesign zuerst verfeinert; alle zehn Designs behalten dieselben KontoablÃ¤ufe. Bestehende Formulare, Sicherungen und Kontoverwaltung bleiben erreichbar. Tutorial an Unterseiten angepasst.
- Lokale Versionsvorbereitung 36: Anzeige, Asset-Queries, package.json und SW-Cache samt neuen Offline-Dateien. Noch nicht verÃ¶ffentlicht und kein Release-Commit; live bleibt der zuvor verÃ¶ffentlichte Stand 35.
- PrÃ¼fung: `node scripts/check.cjs` und `git diff --check` bestanden. UnabhÃ¤ngiges Review ohne offene belegte Funktionsbefunde nach Korrektur der Wochenbeschriftung; Mittelwert, Leerwerte und Ausschluss zukÃ¼nftiger Gewichte zusÃ¤tzlich mit lokalen Fixtures geprÃ¼ft.
- Echte BrowserprÃ¼fung bei 390 Ã— 844 mit `?erststart=1` und kÃ¼nstlichem Profil: alle neun in der Vorschau verfÃ¼gbaren MenÃ¼bereiche, Planformular, Gewicht speichern/Aktualisierung, ZurÃ¼ck-Fokus, Designwechsel Ã¼ber alle zehn Varianten ohne horizontalen Ãœberlauf, Sprachwechsel DE/EN und Tutorialdurchlauf. Gefundene globale CSS-Konflikte korrigiert. Keine Konsolenfehler im geprÃ¼ften Ablauf.
- Grenzen: VM-Suite deckt die neue DOM-Navigation nicht vollstÃ¤ndig ab. Kein reales iPhone/Safari, keine echte Supabase-Anmeldung/RLS und kein Offline-SW-Lauf geprÃ¼ft; Sync ist in der Erststart-Vorschau absichtlich ausgeblendet. Reduced Motion implementiert und im Code geprÃ¼ft, nicht mit aktivierter Betriebssystemoption getestet.
- Selvir hat die Konto-Vorschau positiv beurteilt und anschlieÃŸend die Ãœbersicht beauftragt. VerÃ¶ffentlichung weiterhin offen.

Hier knapp ergÃ¤nzen: Auftrag, geÃ¤nderte Bereiche, Ergebnis der PrÃ¼fungen, Integrations-/Release-Commit, noch offene Befunde. Historische Release-Dokumente nicht als aktuellen Arbeitsauftrag fortschreiben. Private Daten gehÃ¶ren nicht in diese Datei.
