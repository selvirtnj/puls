# PULS — aktueller Stand und Übergabe

### Version 95 (12.11.2026, veröffentlicht)

- Lebensmitteldatenbank ausgebaut: je Katalog-Lebensmittel bis zu 63 zusätzliche Nährwerte aus den Rohdaten von BLS 4.0, USDA SR Legacy 2018, USDA Foundation 10/2026 und Ciqual 2025 (18.199 von 18.253 Einträgen; die 53 regionalen Einträge und SR 167617 haben keine Zusatzwerte). Neue nachladbare Dateien `catalog/nutrients-v1-00…63.json` (4,4 MB, etwa 1,6 MB gzip) plus `nutrients-v1.json`; die bisherigen Katalogdateien sind byteidentisch. Import reproduzierbar mit `node scripts/import-nutrients.cjs` aus `catalog-raw/` (nicht versioniert). Quellen, Lizenzen und Prüfsummen in `docs/CATALOG-SOURCES.md`, Zuordnung und Regeln in `docs/NUTRIENT-MAPPING.md`.
- Laufzeit: `js/nutrient-definitions.js` (Registry), `js/nutrient-resolver.js` (`window.pulsNutrients`), `js/nutrient-references.js` (DGE-Referenzwerte nach Alter und Geschlecht). Katalogwerte werden per Verweis nachgeschlagen, nicht je Eintrag gespeichert (Sync-Grenze 4 MB). Neue optionale Felder: `ck` (Katalogschlüssel am Tagebucheintrag, etwa 36 Bytes) und `nx` (Etikettwerte je 100 der Produktbasis an Produkt, Eintrag und Kombiposition: Zucker, gesättigte Fettsäuren, Natrium). Nichts Neues in `nutrients`, `highlighted` oder Mikrozielen: Version 94 akzeptiert Profile der neuen Version (gegen den echten Stand `ad92acf` geprüft). Die Prüfung von `ck`/`nx` ist bewusst tolerant für künftige Quellen und Schlüssel.
- Oberfläche: Produktdetail „Alle Nährwerte“ (eingeklappt, gruppiert, folgt der Menge, mit Quellenzeile), Tagesansicht „Alle Nährstoffe“ (Tagessummen, Abdeckung als „1/2“, Balken nur mit DGE-Referenzwert), Formulare für eigenes Produkt, Barcode-Prüfung und Foto-Kontrolle in Etikett-Reihenfolge mit Zucker, gesättigten Fettsäuren und Salz. Das Nährwertfoto erkennt diese drei Zeilen; aus Open Food Facts werden nur diese drei bestätigten Felder übernommen.
- Team: Rohdaten und Lizenzen Claude-Agenten; Daten und Laufzeit Codex `backend`; Anzeige Claude `puls-frontend`; Prüfung über Kreuz (Claude `puls-reviewer` für Codex, Codex `reviewer` für die Anzeige), jeweils mit Nachprüfung. Wichtigste Befunde, alle behoben: SR-Arachidonsäure aus falsch beschriftetem USDA-Feld (ID 1406 statt 1408, 1.260 Werte), doppelte Altwerte in den Sidecars, Verlust der Katalogwerte nach Mengenänderung (jetzt Dichteregel ±0,5 je 100 g), OCR-Verwechslungen, unbestätigte OFF-Zusatzfelder, kein erneutes Nachladen nach Fehler.
- Prüfung: `node scripts/check.cjs`; Komplettvergleich aller 63 Schlüssel gegen die Rohdaten durch den Prüfer (rund 1 Mio. Zellen, keine Abweichung); Browser 390 × 844 (Produktdetail, Eintragen, Tagesansicht, Mengenänderung).
- Grenzen: Rezepte aggregieren die neuen Werte nicht. Einträge, die mit weniger als 10 g erfasst und danach stark vergrößert wurden, verlieren die Katalogwerte (sichere Richtung). Bearbeitet ein Gerät mit Version ≤ 94 eine neue Kombi, entfallen dort `ck`/`nx`. Kein Referenzwert für Vitamin D, Zink, Kupfer, Mangan, Chrom und Molybdän (die DGE nennt Bedingungen oder Spannen). Das Vorladen des Katalogs holt zusätzlich 4,4 MB. Ungeprüft: echtes iPhone, Service Worker auf dem Gerät, Cloud-Sync gegen den Server.
- Nachkorrektur am 12.11.2026: Der GitHub-Prüflauf „Web checks“ war für `0974a97` rot, weil `baseFiles()` in `scripts/import-nutrients.cjs` Prüfsummen der Arbeitskopie mit Windows-Zeilenenden festgeschrieben hatte. Jetzt wird zeilenenden-normalisiert gehasht (`BASE_DIGEST` und `baseFiles` in `catalog/nutrients-v1.json` neu, die 64 Shards unverändert). Die Metadatei wird von der Laufzeit nicht gelesen, deshalb keine neue App-Version. Lokal nachgestellt mit LF-Klon ohne Rohdaten und Node 24. `.gitattributes` hält die Nährstoffdateien auf LF.
- **Gefunden am 12.11.2026, noch nicht integriert:** Im ursprünglichen Codex-Klon (`%USERPROFILE%\Documents\Codex\PULS`, `main` auf `ad92acf`) liegt uncommittete Arbeit vom 10.11.2026: Import von CNF 2026 (2.573), CoFID 2021 (2.636) und USDA FNDDS 2021–2023 (5.431) in `catalog/foods-37…58.json`, Katalog damit 28.893 Lebensmittel, neue Quellenfilter, `puls-catalog-v3`, beschrieben in `docs/FOOD-DATABASES.md` jenes Klons (47 geänderte oder neue Dateien, kein Eintrag in dieser Datei, Prüfstand unbekannt). Das ist Selvirs ursprünglicher Auftrag „Datenbanken wie bei Cronometer“. Gesichert am 12.11.2026 als Commit `b38c750` (Basis `ad92acf`, 47 Dateien, Arbeitsstand dateigenau gegengeprüft): im Codex-Klon als Branch `sicherung/food-databases-2026-11-10`, im Arbeitsordner als lokaler Branch `agent/food-databases`; nicht gepusht, der Codex-Klon selbst blieb unverändert. Probe-Merge auf `0db843a`: Konflikte nur in `docs/PROJECT-CONTEXT.md`, `scripts/check.cjs`, `sw.js` und `tests/check-color-offline.cjs`. Selvir hat am 12.11.2026 entschieden: übernehmen statt neu bauen (Version 96). Nächster Schritt: den Branch auf Version 95 übernehmen; die Nährstoff-Sidecars um die drei Quellen erweitern (CNF-Rohdaten neu laden, der frühere Rohdatenordner `%TEMP%\puls-fooddb` existiert nicht mehr). Überschneidungen: `js/food-page.js`, `food-diary.js`, `food-upgrade.js`, `native-nutrition.js`, `puls-data-v87.js`, `sw.js`, Tests und Doku.
- Offen (nächster Schritt): weitere freie Datenbanken. Rohdaten liegen bereit für USDA FNDDS (CC0) und UK CoFID 2021 (OGL v3). Fineli (CC BY 4.0) ist nicht geladen (Seite verlangt eine Browser-Prüfung). Schweizer Nährwertdatenbank nur nach schriftlicher Klärung der Nutzungsbedingungen. NCCDB, NEVO, NZ FOODfiles, BDA, BEDCA und ÖNWT scheiden wegen der Lizenz aus. Neue Quellen brauchen Einträge in `knownKey` des Resolvers und neue Sidecar-Dateinamen oder einen höheren `CATALOG_CACHE`.
- Werkzeug: `scripts/codex-bridge.ps1` meldet eine leere Antwort (Abbruch durch das Nutzungslimit mitten im Lauf) jetzt als nicht verfügbar statt als Erfolg.

### Version 94 (09.11.2026, veröffentlicht)

- Ränge neu kalibriert (an StrengthLevel-Standards orientiert): guter Hobby-Lifter ≈ Stufe 20, fortgeschritten ≈ 27, Elite ≈ 35, Spitze 39; Geräte/Kabel/Smith maximal 22. 18 Ränge auf denselben 40 Stufen (Verteilung 3,3,3,3,3,2×12,1); neu über Tren Cougher: Insulin Gambler, HGH Gut, Open Class Monster, Mr. Olympia (mit Emblemen). Server-SQL unverändert (rank_scale 2, 0..39). Freundeswerte ändern sich erst nach der nächsten Veröffentlichung durch deren App.
- UI-Sammelkorrektur (siehe unten). Koordinator-Nachkorrekturen: EN für „Nutzername wählen“/„E-Mail ergänzen“ und Verlaufs-Leertext.
- Reviews: Ränge durch Codex-Prüfer (keine Befunde). UI-Review durch Codex wegen Nutzungslimit nicht möglich; Koordinator prüfte Scroll-Reset-Logik und im Browser (390 × 844, EN, dunkel): Seiten starten bei 0, keine deutschen Resttexte auf Haupt- und Kontoseiten, Farbschema nicht mehr doppelt, iPhone-Funktionen-Sheet mit Stub-Brücke. Ungeprüft: Freunde-Sheet (braucht echte Konten), echtes iOS-Wischen/Clipboard.

### Frontend-Korrekturen (09.11.2026, in Version 94 integriert)

- Koordinator-Auftrag im Worktree `agent/v94-scrolltop`, Basis `a974a65`. Zentrale Scroll-Rücksetzung für Seiten/Untertabs und verschachtelte Sheets, Fokus ohne Scrollsprung, keine Snapshot-Kopie beim Seitenwechsel, keine zweite Pop-Animation nach einer Kantengeste. Darstellung hat einen Besitzer für die Farbschema-Auswahl.
- EN-Wörterbuch um Formular-, Fehler-, Status- und Accessibility-Texte ergänzt. Extreme-Warnung auf eine Zeile gekürzt, weitere Erklärabsätze entfernt. Native Extras mit bestehenden Schaltern, Tageschips und kompakten Karten, Feld-IDs und Speicher-/Brückenpfade erhalten. Freunde mit einzeiligen Tabs, sichtbarem Menü und reinem Code beim Teilen/Kopieren. Rang-/Emblem-Logik unverändert.
- `tests/check-ui-v94.cjs` prüft DE/EN-Markup, deutsche Resttexte einschließlich Formular-/Statusmeldungen und Accessibility-Attributen, native Steuerelemente, exakten Share-/Clipboard-Inhalt, verschachtelte Scrollcontainer und Training-Untertabs. In `scripts/check.cjs` eingebunden. Gesamtsuite und `git diff --check` bestanden. Unabhängiges Review mit Nachprüfung der korrigierten Training-Untertab- und Schema-Getter-Befunde abgeschlossen.
- Browserprüfung 390 × 844 in DE/EN und Hell/Dunkel offen. Der Browserhost ist nicht erreichbar. Vorschau lieferte HTTP 200, Server gestoppt. Echtes iOS-Wischen, Clipboard, Health und Mitteilungen ungeprüft. Koordinator übernimmt Integration, Browserprüfung und zentrale Release-Versionierung. Kein Commit/Push, kein Version-Bump, keine Live-Backend-Änderung.

### Version 93 (09.11.2026, veröffentlicht)

- Rangskala v2: 14 Ränge (Gym Tourist … Tren Cougher), 40 Stufen (0..39). `pulsStrength.fromLegacy/toLegacy`, Freundes-Zusammenfassung mit `rank_scale:2`; `lastRankSeen` wird auf die neue Skala migriert (Altwerte 25/26 gelten als ungesehen). Freundesliste zeigt alte (NULL) und neue Skala gemischt korrekt; 5 neue Embleme.
- Routinen favorisieren: Stern-Knopf, Favoriten stehen in allen Routinenlisten oben (`routinesByFavorite`, `js/routine-favorites.js`); `favorite` nur boolean/undefined in `validData()`; Duplizieren übernimmt den Favoriten nicht.
- Supabase: `backend/friends-strength-v2.sql` am 09.11.2026 live ausgeführt (Spalte `rank_scale`, Validator `puls_valid_lift_ranks(jsonb,integer)`, skalenabhängige Constraints). Nachprüfung: genau 3 Funktionen mit leerem search_path, Rechte anon/auth wie vorgesehen, RLS an, keine Tabellenrechte, 2 Profile unverändert. Korrektur vor dem Lauf: `case` in einer PL/pgSQL-`if`-Bedingung geklammert.
- Offen (P3): Apps ≤ 92 zeigen v93-Ränge von Freunden bis zum Update falsch; iPhone-Test.

### Version 92 (09.11.2026, veröffentlicht)

- Ränge ab dem ersten Workout: Gesamtrang ab einer gerankten Übung (Mittel der vorhandenen Gruppen), mehr Maschinen-/Kabelübungen rangfähig, assistierte/Negativ-/Maschinen-Klimmzüge und assistierte Dips ausgeschlossen, „Neu“ statt Aufstieg beim ersten Rang, Rangfeier nur bei neuem Höchstrang, „Gewicht eintragen“ nur bei rangfähigen Übungen; `weightAt()` fällt zuletzt auf die früheste Messung zurück.
- Import: Liftoff-Schritt im Erststart, Einheit automatisch (Liftoff immer lbs; andere Formate per Kopfzeile/Raster/Plausibilität, kg/lbs-Knöpfe nur bei Unsicherheit), Ränge direkt nach Import, tolerant bei abweichender Sessiondauer (Liftoff-Export eines Freundes), kein Teilprofil mehr.
- UI: `apple-mobile-web-app-status-bar-style` je Schema gegen weißen Balken in der Home-Bildschirm-App (auf iPhone ungeprüft); Konto → Profil „Alles eintragen“ öffnet den Profil-/Ziel-Bogen vorausgefüllt; Geschlecht bleibt beim Speichern über diesen Bogen erhalten.
- Reviews: Claude-Prüfer (Ränge, Import, je mit Nachprüfung), Codex (UI). Offen: iPhone-Test, Freunde mit zwei Konten; lastRankSeen-Altwerte 25/26 werden mit der Rangskala v93 migriert.
- Doku-Kodierung von CURRENT-STATE.md repariert (doppelt kodierte Umlaute).

Details Import-Vorbereitung:

- `js/workout-import.js`: optionaler DE/EN-Liftoff-Schritt nach den Profil-/Zielangaben, vor dem bisherigen Onboarding-Abschluss. Bestehende Dateivorschau und Routinen-Schalter; Zurück kehrt zur Auswahl zurück, Weiter und der bestehende Skip beenden ohne Import. Skip sperrt auch verzögerte Bestätigung während der Schließanimation.
- Einheitenwahl entfernt: explizite kg-/lb-/lbs-Kopfzeilen haben Vorrang, sonst Vergleich positiver Gewichte mit Viertel-kg-Raster vor/nach Division durch 2.20462262185 (Toleranz 1e-4); Gleichstand folgt dem Format (Liftoff lbs, sonst kg). Bestehende kg-Rundung, rohe CSV-basierte IDs, alte Imports und lokale Änderungen bleiben erhalten; keine Profil-/Auth-/Sync-Migration.
- Synthetische Import- und Onboarding-Tests erweitert (Einheiten, Kopfzeilen, Rundung, Restore/Dubletten, Abbruch/Skip/Bestätigung, DE/EN); `node scripts/check.cjs` und `git diff --check` bestanden. Privater Export ausschließlich im Speicher geprüft: lbs-Erkennung und erwartete kg-Umrechnung bestanden; keine Inhalte übernommen oder protokolliert.
- Integration beim Claude-Koordinator: unabhängiges Review, zentrale Release-Versionierung und Browser-/iPhone-Prüfung 390 × 844 in Hell/Dunkel. Lokale UI-Prüfung blockiert: Computer-Use meldet fehlende native Pipe. Kein Commit/Push und keine Live-Backend-Änderung.
- Folgeauftrag: Bestätigter Import zeigt im Konto und Onboarding den Gesamtrang mit `pulsFriendsBoard.emblem` und bis zu fünf beste Übungsränge über `pulsStrength.all()/overall()`, DE/EN und escaped. Ohne verfügbares Körpergewicht erscheint „Gewicht eintragen“ über den bestehenden Gewichtsdialog. Onboarding wird mit „Weiter“ abgeschlossen; Ergebnisaktionen sind an Profil und Konto gebunden. Importfelder waren bereits rangfähig, keine IDs-/Schemaänderung nötig.
- Bei aktivem Freunde-Snapshot einmal `pulsFriends.refresh(true)` nach dem Speichern; der vorhandene Mechanismus veröffentlicht erst nach sauberem Sync und sperrt weiter bei Offline-/Revisionskonflikten. Kein neuer Backendpfad. Regressionen ergänzen echte Rangprojektion aus Imports, Top-5, DE/EN, Gewichtseinstieg, Escaping, Restore, Doppelbestätigung und Opt-in. Privater Export nur im Speicher geprüft, keine Inhalte oder persönlichen Rangwerte im Repository. Browserzugriff erneut nicht verfügbar (native Pipe und Browserhost fehlen); unabhängiges Review und 390 × 844 bleiben bei Integration.
- Folgeauftrag lokal geprüft: `node scripts/check.cjs` vollständig bestanden (einschließlich Import-, Freunde-, Onboarding-, Rang- und CAS-/Offline-Konflikttests), `git diff --check` sauber. Keine Live-RLS-Prüfung, keine Release-Versionierung oder Veröffentlichung.

### Version 91 (09.11.2026, veröffentlicht)

- Makro-Folie im Essen-Tab wieder mit neutraler grauer Kartenfläche statt oranger Tönung.

### Version 90 = Vollversion 1.0 (09.11.2026, veröffentlicht, Git-Tag `v1.0`)

- Bereichsfarben: Training Blau, Essen Orange, Körper Grün (alle vier Schemata, Kontraste geprüft); „Ziel überschritten“ im Essen-Bereich Rot. Größere Makro-Folie, wärmerer Essen-Tab. Handy-Layout: Zurück-Pfeil Konto nicht mehr abgeschnitten, Tippflächen ≥44 px, Zentrierung 16/16 px (`css/v90-ui.css`).
- Erklärtexte entfernt (kurze Datenschutz-/Zustimmungshinweise bleiben), EN-Übersetzungen ergänzt, Undo-Hinweise einheitlich. Doku: DESIGN-WORKPLAN und `docs/audit/` nach `docs/archive/`, README als Vollversion.
- Logik: Mengenänderung skaliert ungerundet; adaptiver Erhalt zählt vergangene Tage mit ≥60 % kcal-Ziel automatisch, Wochen-Check-in entfernt; Wasser nicht mehr in „Heute eingetragen“; Wasser-Minus entfernt genau ein Glas mit validData-sicherem Rest und konfliktgeprüftem Undo; Strong/Hevy-Aliase; strengere Rangschwellen für Isolationsübungen (Freunde sehen neue Werte nach nächster Veröffentlichung); leeres Workout aus Plus direkt; `designs-extra.js` und Versions-.replace-Kette entfernt (alte `appDesign`-Werte bleiben gültig).
- Prüfung: Gesamtaudit (Claude), Review Codex mit 2 P2 → behoben und nachgeprüft; Browser 390 × 844. Codex/Gemini zeitweise im Limit (Gemini bis ca. 15.11.). Offen: iPhone-Test, Freunde mit zwei echten Konten.

### Version 89 (09.11.2026, veröffentlicht)

- UI (Paket B, `agent/v89-ui`): Kategoriefarben Koralle/Tiefblau/Bernstein/Salbei/Sportgrün in allen Tabs inkl. laufendem Workout; neue gerätelokale Farbschemata „Frisch“ (hell) und „Mitternacht“ (dunkel) über `data-palette`; Tab-Titel einheitlich oben links inkl. „Essen“; kürzeres Datum; Plus-Menü mit KI-Foto neben Barcode statt Wasser; „Skip“ statt X im Erststart; „−“ auf dem letzten vollen Wasserglas. Review Gemini ohne Befunde.
- Import/Ränge (Paket A, `agent/v89-import`), Review Claude, P3-Korrekturen von Codex: Nullwerte (Distanz/Sekunden) werden nicht gespeichert, Sessions ohne Übungen werden wie in v88 übersprungen, `routineId` nur bei übernommenen Routinen, Rangseite mit Cache und Fehler-Fallback. Rangseite im Browser bei 390 × 844 geprüft (Testdaten).
- Offen: iPhone-Test, laufendes Workout mit echten Sätzen in den neuen Farben, Freunde-Tab mit Konto.

Details Paket A: CSV-Import ergänzt Routinen über das bestehende Modell. Benannte Trainings bilden eine Routine pro Name, unbenannte wiederkehrende Muskelgruppenmuster bilden Push/Pull/Beine/Rumpf/Oberkörper/Ganzkörper. Übungen müssen mindestens zweimal und in mindestens 30 % der Gruppe vorkommen. Verwendet werden die im letzten Training vorhandenen regelmäßigen Übungen, die durchschnittliche Quellreihenfolge und dessen Satzanzahl/Wiederholungen/Gewichte. Einzeltrainings ohne Namen erzeugen keine Routine. Das Routinenmodell begrenzt die Vorlage auf zwölf Sätze, die importierte Historie behält alle Sätze.
- Vorschau mit standardmäßig aktivem „Routinen übernehmen“, DE/EN und unveränderter kg/lbs-Auswahl. Wiederimport erhält vorhandene IDs und lokale Änderungen, Routinen lassen sich nach früherem Opt-out ergänzen. Optionale `routine.importWorkoutId` verweist auf die Vorbelegung aus der Historie, ohne einen parallelen Satzspeicher anzulegen. Die Import-Erweiterung von `prefillExerciseSets()` verwendet bei solchen Routinen deren letzte Session, anschließend den bestehenden Ablauf.
- Optionale validierte `set.csvFields` erhalten Zusatzspalten einschließlich RPE, Notizen, Distanz, Sekunden und Satztyp in Quellschreibweise/Einheiten. `set.setOrder` erhält auch Buchstaben. Übungen fehlen vollständig in einzelnen Export-Sessions, diese bleiben mit Datum/Dauer und validierten `workout.csvRows` erhalten. Bestehende Sicherungen und frühere Import-IDs bleiben gültig. Zusatzfelder bleiben in Backup/Sync erhalten, der bestehende Kraftsatz-Editor zeigt sie derzeit nicht an.
- Neue vierte Workout-Abschlussseite in `workout-ranks.js`/`workout-ranks.css`, nach Zusammenfassung/Serie/XP. Verwendet die Embleme von `friends-board.js` und reine neue `pulsStrength.workoutProgress()`-/`progressToNext()`-Projektionen. Rangberechnung unverändert. Vergleich schließt dieses und spätere Trainings aus dem Vorher-Stand aus, auch am gleichen Datum. Balken und Emblemwechsel über Web Animations bzw. `pulsMotion`, reduzierten Bewegungsmodus beachten. Rangaufstieg nutzt `rankUp` mit bestehender Klang-/Haptiksteuerung. Historische Kurzansicht bleibt erhalten.
- Regressionstests in `check-workout-import.cjs` erweitert und `check-workout-ranks.cjs` registriert. `node scripts/check.cjs` und `git diff --check` bestanden, einschließlich echtem Abschluss-Wrapper-Ablauf im VM-Harness, Altprofil-/Restore-/Opt-out-Fällen und gemocktem Sync-Konflikt. Browserprüfung 390 × 844 hier offen, Browserinventar leer und Browserhost nicht erreichbar. Koordinator übernimmt unabhängiges Review, echte Hell-/Dunkel-/iPhone-Prüfung und zentrale Versionierung. Keine Versionserhöhung, kein Commit/Push und kein Live-Backend-Eingriff in diesem Paket.

### Version 88 (09.11.2026)

- Im Arbeitsstand integriert (Verlauf `e90e86a..174b100`); Veröffentlichung durch den Koordinator noch offen.
- Essen kompakter mit Energie-Folie vor Makros, Makros als Startansicht, Wasser in einer Reihe und mittigem Datum. Tageshaken und „Als Kombi“ entfernt; Detailseite bündig ohne Dreipunkt-Menü.
- Erklär- und Disclaimer-Texte app-weit entfernt. Plus-Menü mit Wasser statt KI-Foto-Kachel, „Essen suchen“, Aktivität mittig und Körpermaße unten.
- Profil als Einzelblätter, Körperfett-Fallback nach Deurenberg, neue Zielseite, Konto ohne doppelte Einträge sowie Körpermaße & Biometrie. Geschlecht bleibt nach Neustart erhalten; Ziel/Richtung und RMR nach Review korrigiert.
- Kraft-Ränge pro Übung und gesamt nach Pound-for-Pound, unabhängig von Level/XP. Neun Ränge von High Estrogen bis Tren Cougher mit insgesamt 25 Stufen; Gesamtrang aus mindestens drei und höchstens fünf verschiedenen Muskelgruppen. Freunde-Vergleich pro Übung und kg-Ziel zur nächsten Stufe. Historische/importierte Workouts und bestehende IDs bleiben erhalten. [Modell und Standards](STRENGTH-RANKS.md).
- Tiefere, weichere und leisere Klänge.
- Vorhandene Paket-C-Prüfung laut Übergabe mit `node scripts/check.cjs` und `git diff --check` bestanden; VM-/Quelltests belegen keine Live-RLS. Dieser Doku-Nachtrag bestätigt keine neuen Funktionstests.
- **OFFEN / Grenzen** — `backend/friends-strength.sql` live einspielen (nach `friends-ranks.sql`); bis dahin Client-Fallback auf ältere RPC-Signaturen, fehlende fremde Kraftränge bleiben unbekannt. Muskel-Erholungsfigur auf Nutzerwunsch vorerst zurückgestellt. Kein iPhone-Test; Browserprüfung 390 × 844 in Hell/Dunkel im Paket-C-Lauf wegen fehlendem Browserhost blockiert.

### Version 87 (09.11.2026)

- Im Arbeitsstand integriert (Verlauf `e8ce137..68da462`); Veröffentlichung durch den Koordinator noch offen.
- Essen wie Diary: wischbare Übersicht mit Makro-Zielen zuerst, Wassergläser mit berechnetem Ziel und chronologisches Tagebuch ohne feste Mahlzeitenkategorien.
- Hinzufügen als Vollseite mit neun Reitern, Sortierung/Datenbankfiltern, Detailansicht mit Portionen und automatischer g/ml-Wahl nach Lebensmittelbasis, Scanner-UI sowie eigenen Kombis aus mehreren Lebensmitteln (`state.meals`). Keine g/ml-Umrechnung ohne Dichte.
- Plus-Menü mit Suchen/Barcode/Foto/Training, eigener Mahlzeit, Rezept und Lebensmittel; ohne Voice/Notiz. Training öffnet ein Auswahlblatt für bestehende Trainingsabläufe.
- Konto als Mehr-Übersicht mit Konto, Profil, Ziele, Darstellung und Entdecken; Makroziele wahlweise in Gramm oder als Verhältnis.
- Freunde: Bestenliste mit Podium, Embleme und zehn XP-basierte Ranggruppen von High Estrogen I–III bis Tren Cougher; Slacking-Warnen erst nach Bestätigung, Rangaufstieg mit einmaliger Feier.
- Neue synthetische WebAudio-Klänge, zugeordnete Haptik mit eigenem Schalter und gemeinsame Bewegungsschicht `pulsMotion` mit reduzierter Bewegung.
- Workout-Tab verfeinert: Routinen-Karten, leeres Workout starten und Routinen über den bestehenden Editor duplizieren; vorhandene Sessions und IDs bleiben erhalten.
- Workout-CSV-Import für Liftoff/Hevy/Strong mit Vorschau, Einheitenwahl, Übungszuordnung, Dublettenschutz und Bestätigung; historische Imports erhalten keine rückwirkenden XP, bleiben aber für Historie/e1RM/Vorbelegung nutzbar.
- Neue optionale Profilfelder: `water`, `meals`, `display`, `plan.macroInput`/`plan.ratio` und `foodSearch`; validierte Vorgaben und Migration im bestehenden Zustand, alte Sicherungen bleiben akzeptiert.
- **OFFEN / Grenzen:** `backend/friends-ranks.sql` muss live in Supabase eingespielt werden; bis dahin bei Freunden „Rang unbekannt“. Kein iPhone-Test von Touch-Wischen, Kamera, Klang oder Haptik. Laut Agenten haben Designs außer Hell/Dunkel keine eigene Wirkung mehr; noch zu prüfen. Dieser Doku-Nachtrag bestätigt keine neuen Funktions- oder Live-Tests.

### Workout-CSV-Import, lokal vorbereitet (09.11.2026)

- Review-Korrekturen: Importierte Workouts dürfen über den bestehenden Handler wieder geöffnet werden (`finished:false` bleibt gültig). `insights.js` nimmt Imports ausschließlich aus der PR-XP-Grundlage heraus; vorhandene Workout-XP bleiben stabil, gemeinsame Historie/e1RM/Vorbelegung bleiben erhalten. Mapping ergänzt Singular/Plural, Pull-ups und die vom Koordinator benannten 19 gezielten Aliase mit exakt geprüften Bibliothekszielen. Mehrdeutige Bench Press/Squat/Lat Pulldown ohne Equipment werden weiter eigene Übungen. Strong-Buchstaben in Set Order (z. B. W) werden als normaler Satz mit Originalwerten und Dateireihenfolge akzeptiert. Tests ergänzt; in einer temporären Quellkopie geprüft, weil die Sitzung nur den Hauptklon als Schreibbereich freigibt. Patch-Anwendung und Nachprüfung im Worktree beim Koordinator; private CSV unverändert.

- Koordinator-Auftrag auf `agent/backend-liftoff-import`, Basis `e8ce137`. Neue `js/workout-import.js`, Einbindung zuletzt in `index.html` und in der Offline-Liste von `sw.js`; keine Versionsänderung, kein Commit/Push oder Live-Backend-Eingriff.
- Konto → Konto verwalten → Daten: CSV-Dateiauswahl, Vorschau mit Zeitraum/Sessions/Sätzen/zugeordneten und neuen Übungen/Dubletten, Einheitenwahl lbs/kg und ausdrückliche Bestätigung. Liftoff-Header wählen lbs, explizite kg-/lbs-Header haben Vorrang; ähnliche Hevy-/Strong-Header und Semikolon-CSV werden akzeptiert. Fehlende Übungsnamen werden mit sichtbarer Anzahl übersprungen. Nicht unterstützte Satzfelder (Distanz, Zeit, RPE, Notizen, Satztyp) werden sichtbar angekündigt ausgelassen.
- Exakte Namen/Aliase und identische Namenstokens unabhängig von Klammern/Reihenfolge werden auf Bibliothek/eigene Übungen abgebildet; keine unscharfen Muskel-/Gerätevermutungen. Vorhandene Übungs-IDs bleiben maßgeblich. Neue Übungen erhalten stabile IDs. Umrechnung lbs ÷ 2.20462262185, Rundung auf 0,1 kg, exakte Viertel-kg bleiben erhalten.
- Import ergänzt ausschließlich abgeschlossene Workouts. Stabile SHA-256-Workout-ID aus lokalem Datum, Namen, Dauer und kanonischen Satzinhalten verhindert erneuten Import auch nach JSON-Sicherung/Wiederherstellung. `importSource: 'workout-csv'` wird optional in der letzten `validData()`-Erweiterung geprüft; alte Profile bleiben gültig. Fehlende Dauer/Uhrzeit bleiben unbekannt. Keine neuen Routinen, Messungen, Gewichte oder parallelen Zustände.
- Bestehende Kalender-/Streak-/Statistik-/Vorbelegungslogik nutzt die importierte Historie. Imports zählen nicht zur PR-XP-Grundlage; der letzte `workoutAwards()`-Wrapper setzt zusätzlich deren XP/PR-Feiern auf null, kein `durationXpVersion` für historische Imports. Historie bleibt für e1RM und Vorbelegung erhalten. Auth/Sync unverändert: einmal normal `save()` nach Bestätigung, Profil-/Owner-Prüfung bei verspäteten Dateizugriffen, aktuelle lokale Änderungen bleiben erhalten, Konflikte stoppen weiter Uploads.
- `tests/check-workout-import.cjs` mit rein synthetischen Fixtures in `scripts/check.cjs`: Vorschau/Abbruch, Einheiten, Mapping, fehlende Werte, fehlerhafte CSV, Dateireihenfolge, Dubletten nach Restore, Owner-/Profilwechsel und reale Save-/Cloud-Wrapper mit gemocktem CAS-Konflikt und Offline-Pending-Sicherung. Gesamtsuite bestanden; kein Live-RLS-Nachweis. Die bereitgestellte private Datei wurde ausschließlich lokal im Speicher geprüft und nicht ins Repository kopiert.
- Integration beim Koordinator: unabhängiges Review (besonders optionale Metadaten, Awards-Wrapper und Append-/Sync-Verhalten), echte UI-Prüfung bei 390 × 844 in Hell/Dunkel sowie Dateiauswahl/Bestätigung. Browserprüfung hier blockiert: Browserinventar leer, native Pipe/Browserhost nicht verfügbar. Vor Veröffentlichung normale zentrale Versionierung durchführen; aktuelle Asset-/Cache-Version bleibt absichtlich 86.

### Version 86, Freundesliste + KI-Essensfoto + Taschenlampe (08.11.2026)

- **Live eingerichtet (08.11.2026, mit Selvir im Dashboard):** `backend/food-photo.sql` und `backend/friends.sql` im Projekt `qqqwzvqsvngvfhpgelpm` ausgeführt (Success). Edge Function `food-photo` aus Commit `bbba1e5` deployt, Secret `GEMINI_API_KEY` von Selvir gesetzt. „Verify JWT with legacy secret“ ist AUS, weil das Projekt Nutzer-JWTs mit ES256 signiert; die Funktion prüft das Token selbst über `/auth/v1/user` (ohne Token: `401 {"error":"auth"}` geprüft). Offen: echter Test mit angemeldetem Konto (Gemini-Antwort) und Freundesliste mit zwei Konten.

- Veröffentlicht: Freundesliste (Branch `agent/backend-freunde` gemergt, Claude-Review mit Nachprüfung freigegeben) und KI-Foto/Taschenlampe (Codex angefangen, Claude `puls-backend` fertiggestellt wegen Codex-Limit, Gemini-Review freigegeben). Beide Serverteile sind noch NICHT live: Selvir muss `backend/friends.sql` und `backend/food-photo.sql` im Supabase-SQL-Editor ausführen, Gemini-Schlüssel als Secret setzen und die Edge Function `food-photo` anlegen (Schritte in `BACKEND-HANDOFF.md`). Bis dahin bleibt „Freunde“ ausgeblendet, das KI-Foto meldet „noch nicht eingerichtet“. Neue IPA nötig für die Taschenlampe.

### Version 85, türkische und Balkan-Gerichte (08.11.2026)

- 53 neue Katalogeinträge (`PULS_tr_*`/Balkan) mit 51 Portionsangaben in `catalog/foods-36.json`/`portions.json`, als Rezept- bzw. Etikett-Richtwerte mit Quelle gekennzeichnet, keine Mikronährstoffe erfunden. Gebratene Sucuk mangels Quelle ausgelassen. `CATALOG_CACHE` → `puls-catalog-v2`. Test `tests/check-regional-foods.cjs`.
- In Arbeit: Freundesliste + Stups (Worktree `agent/backend-freunde`), danach KI-Foto (Gemini über Supabase-Funktion) und Taschenlampe im nativen Scanner. Liftoff hat keinen Export; kein Import geplant.

### KI-Essensfoto und Taschenlampe, lokal vorbereitet (08.11.2026, ohne Version)

- Web: `js/food-photo.js` (nach `food-flow.js`) ergänzt im Foto-Tab „Foto schätzen (KI)“: Foto (≤ 1024 px JPEG, ohne EXIF) + optionale Beschreibung → Supabase Edge Function `food-photo` → Google Gemini `gemini-3.8-flash` (Gratis-Tarif) → editierbares Kontrollformular, Speichern erst nach Häkchen. Eintrag über die normale `addFood`-Kette mit `source:'KI-Schätzung · Google Gemini'` und `aiEstimate:true`, nur kcal/Makros. Foto und Text werden nicht gespeichert. Nur mit Konto und online.
- Server (noch nicht live): `supabase/functions/food-photo/index.ts`, Limit-Tabelle `backend/food-photo.sql` (3/Minute, 20/Tag pro Konto). Einrichtung siehe `docs/BACKEND-HANDOFF.md` → „KI-Essensfoto“. Ohne Einrichtung zeigt die App „noch nicht eingerichtet“.
- iOS: Taschenlampen-Knopf im nativen Scanner (DataScanner und AVFoundation-Fallback), aus beim Schließen. Web-Scanner hatte bereits einen Blitz-Knopf (`ff-torch`, nur wenn `torch` gemeldet). Swift-Build nur in CI, Gerätetest offen.
- Test: `tests/check-food-photo.cjs` (in `scripts/check.cjs`), nur Mocks; kein echter Gemini-, SQL/RLS- oder Edge-Function-Lauf.

### Freunde mit Trainingsserie und Stups — lokal vorbereitet, 08.11.2026

- Koordinator-Auftrag auf `agent/backend-freunde`, Basis `306f6a6` (v84): eigene Freundescodes, Anfragen/Annahme/Ablehnung/Entfernen, nur unter angenommenen Freunden geteilte Trainingsserie/letztes Datum, „Stop slacking off“ nach Serienabbruch und empfangene Hinweise beim Öffnen/Fokus. Konto → Freunde, nur angemeldet/online; ausdrücklich aktivieren/deaktivieren. Neue `backend/friends.sql`, `js/friends.js`, `css/friends.css`, Asseteinträge in `index.html`/`sw.js`.
- Keine bestehenden Profil-/Auth-/Sync-Funktionen oder persistierten Profilfelder geändert. Kennzahlen erst nach abgeschlossenem revisionsgeprüftem Profilsync; Konflikte/Offline/Recovery/abgelehnte Revisionen sperren Veröffentlichung. Quellenrevision verhindert serverseitig veraltete Mehrgeräte-Updates; nur eigene Profilrevision wird dazu gelesen/kurz gesperrt. Zufällige Codes, RLS und ausschließlich RPC-Zugriff; serverseitiges 12-h-Limit mit Paar-Transaktionslock. Details und Dashboard-Schritte: `BACKEND-HANDOFF.md`.
- Keine native Hintergrundabfrage/Tokenübernahme: keine iOS-Änderung, kein APNs, Hinweis erst bei offener/fokussierter App. Blockieren optional nicht umgesetzt. Soziale Daten sind separat und nicht im Profilbackup enthalten. Deaktivieren löscht Beziehungen/Stupse; Kontolöschung kaskadiert.
- Gesamtsuite `node scripts/check.cjs`, `tests/check-friends.cjs` und `git diff --check` bestanden. Mocktests für Opt-in, unveränderte alte Profile ohne `runs`, Tagesgrenzen/Läufe, Konflikt-/Revisionssperren, Offline/Vorschau, Konto-/Antwort-Races, Deaktivierung und Escaping. Unabhängiges Codex-Review samt Korrektur-Nachprüfung erledigt; KI-übergreifendes Review beim Claude-Koordinator. SQL noch nicht in PostgreSQL ausgeführt, kein Live-RLS-Nachweis. Browserhost/native Pipe nicht verfügbar: 390 × 844, Hell/Dunkel und iPhone-Interaktionen offen.
- Claude-Review (9 Befunde) behoben: Namenslänge in Zeichen wie der Server, fehlerhafte Fremdzeilen nur gefiltert; ausgehende Anfragen ohne Empfängernamen; Anfragelimit und 7-Tage-Ablehnungssperre überleben Deaktivieren; Serverdatum `Europe/Berlin` (+1 Tag Toleranz); Veröffentlichung sperrt nach Sync-Dirty-Flag statt Byte-Vergleich; Prüfung höchstens minütlich ohne Zustandsserialisierung; erklärende Warte-/Fehlertexte; Menüpunkt erst nach erfolgreicher RPC, bei fehlender Migration pro Sitzung ausgeblendet. Tests in `tests/check-friends.cjs` ergänzt (Mocks/Quellverträge, kein PostgreSQL).
- Kein Commit/Push/Live-Backend-Eingriff und gemäß Auftrag keine Versionsänderung. Koordinator prüft integrierten Diff unabhängig, richtet Migration erst nach Test ein und versioniert vor Veröffentlichung.

### Version 84, WebView-Hülle statt SwiftUI mit drei nativen Extras (08.11.2026)

- Veröffentlicht als v84 auf `main`. Review (Claude `puls-reviewer`) mit Nachprüfung: Health überspringt `autoFinished`/`timeApprox`-Workouts, Script-Sandbox aus, Erinnerungs-Banner bei offener App, Health-Abgleich nur bei geänderten Daten. Offen: CI-Swift-Build, AltStore-Installation mit HealthKit, Gerätetest von Scanner/Health/Erinnerungen und 390 × 844 der neuen Einstellungen (nur in der Hülle sichtbar).

- Selvir hat die SwiftUI-Umstellung gestoppt und unter Tag `native-swiftui-archiv` archiviert. Nicht löschen oder weiter ausbauen. Hülle wieder von `main`/`ios-build-9`, Live-Web v83; maßgeblich bleibt der Web-Zustand für Daten, Auth und Sync. Die älteren Übergaben darunter sind historisch.
- Koordinator-Auftrag auf Branch `ios-huelle-extras`, Basis `dd7c13d`. Native Barcode-Kamera (VisionKit/AVFoundation) → vorhandener Web-`lookupBarcode`; optionaler ausschließlich schreibender Health-Export (Gewicht, abgeschlossene Trainings/Läufe, stabile Sync-Metadaten, Owner-/Opt-in-Grenze); lokale Trainings-/Wiege-Erinnerungen mit Wochentagen/Uhrzeit und eigenen Mitteilungs-IDs.
- Einstellungen unter Konto → Darstellung → iPhone-Funktionen; neue `js/native-extras.js`, optionale validierte `state.nativeExtras`. Alte Hüllen/Safari bleiben funktional unverändert, alte Sicherungen gültig. Revisionskonflikte/Recovery/Cloud-Arbeit sperren den Health-Export. Keine Auth-/SQL-/Serveränderungen. Keine neuen Nährwerte/Kalorienschätzungen; historische Trainings ohne belegte Zeiten übersprungen. Details, Tagesauflösung von Gewicht und fehlende Health-Löschsynchronisation: `docs/IOS-APP.md`.
- `stateBridge`/`nativeWebPages` und die übrigen SwiftUI-Features werden von dieser Hülle nicht gemeldet, kein `pulsState`-Handler; v74–v83 bleiben inaktiv und erhalten. Alte Hüllenfunktionen und Widget-Erweiterung bleiben bestehen.
- Apple führt HealthKit auch für kostenlose Developer-Konten auf. AltStore-Geräteprobe offen. Capability-Datei, Health-Zwecktexte und zertifikatsfreier Ad-hoc-Metadatumschritt in `ios/project.yml`/`ios/scripts/prepare-altstore.sh` vorbereitet, damit AltStore die Capability erkennt. Ohne eingebettete Health-Capability/API-Verfügbarkeit kein Feature; Hülle startet weiter.
- Lokale Prüfung: Gesamtsuite `node scripts/check.cjs` und gezielte Brücken-/Fallback-/Owner-/Verzögerungstests; unabhängige Quellprüfung mit Nachprüfung von Autorisierungs-Race, Seitenleben-IDs und Signierschritt. Kein Xcode/Swift-/codesign-Lauf auf Windows. Browserinventar leer, native Pipe und Browserhost nicht verfügbar: 390 × 844, Kontrast und Interaktionen müssen beim Koordinator/Gerät geprüft werden. Keine echte Kamera, HealthKit-, Mitteilungs- oder Live-RLS-Prüfung.
- Kein Commit, Push, Versionswechsel oder Live-Backend-Eingriff; vorhandene `CLAUDE.md`-Änderung nicht angefasst. Koordinator integriert, prüft UI/CI/AltStore und erhöht mit `scripts/bump-version.cjs` die Web-Version vor Veröffentlichung. Neue JS-Datei bereits in `index.html` und `sw.js` eingetragen.

### Version 83, Hybrid-Modus Web-Hauptseiten (08.11.2026)

- Selvirs Entscheidung: Übersicht/Training/Essen als Web-Seiten im Web-Design, native Tab-Leiste und Plus bleiben, Konto bleibt komplett nativ, alles was beim Antippen ein Fenster öffnet, öffnet ein natives Fenster. Optik der nativen Fenster an das Web angleichen folgt nach Gerätetest.
- Nur Web-Dateien auf `main`: Feature `nativeWebPages` in `js/native-state.js`/`css/native-shell.css` (Protokoll §16). Wirkungslos im Browser und mit älteren IPAs. App-Seite auf `native-ios` (`e9e11fb`), Schalter `RootTabShell.webPagesMode`. Codex-Review 1×P2 behoben. Swift-Build über CI, Gerätetest offen.

### Version 82, Web-Seite fuer Rezept-Vorschau (06.11.2026)

- Nur Web-Dateien auf `main`: Query `recipePreview` ohne Zustandsaenderung (Protokoll). Wirkungslos ohne native App. App-Seite auf `native-ios`, CI #49 gruen, Testversion `PULS-ipa-49`, Geraetetest offen.

### Version 81, Web-Seite fuer Welle N1 (06.11.2026)

- Nur Web-Dateien auf `main`: native Abschluesse mit `cycleId`, Pagination, Indexchart, `exercise.settings.set`, `route.fromRun`, Export, Teilen (Protokoll §15). Wirkungslos ohne native App mit den Flags `nativeCompletion`/`stateBridge`. Reviews ueber Kreuz ohne offene Befunde.
- App-Seite liegt auf `native-ios`, Swift dafuer noch nicht kompiliert: CI #44 bis #46 fanden keinen macOS-Runner.
### Gesamt-Audit 26.10.2026 — veröffentlicht als Version 70

- Branch `refactor/comprehensive-app-audit` ab Tag `audit-baseline-v69`, auf Selvirs Freigabe per Fast-forward nach `main` übernommen und als v70 veröffentlicht.
- Sync/Speicher gehärtet (`js/cloud.js`, `js/app.js`): Beschädigungs-Sicherung, dauerhafte Upload-Sperre, Recovery-Arbeitskopie `puls-v1-recovered`, Rotation, 4-MB-Grenze, Konfliktkopien. Nur Mock-Tests, keine Live-RLS.
- UI: Onboarding wählt „Berechnet“ vor, ruhige Live-Eingabe, entprelltes Speichern, Singular/Plural, Dezimalkomma; „Text & Sprache“ aus Plus-Menü entfernt. Offen: UI-5, UI-6, UI-7 (Rest), UI-11/12.
- `js/visuals.js` und `css/visuals.css` entfernt; `designs-extra.js` bleibt (alte Designschlüssel in `validData`).
- Letzter `node scripts/check.cjs`: Exit 0 auf `b2ae598`. Codex-Abschlussreview und Nachprüfung: Merge-Empfehlung ja. Gemini nicht beteiligt.
- Nicht getestet: echtes iPhone, Live-Supabase/RLS, echter Offline-SW, GPS, Kamera. iPhone-Checkliste aus dem Abschlussbericht steht noch aus.
- Details und iPhone-Checkliste: `docs/audit/FINAL-REPORT.md`.
### Konto, Speichern und Navy-KFA, lokal vorbereitet (26.10.2026)

- Koordinator-Auftrag an Codex auf Basis `2c8fdae`; vorhandene ungestagte Änderungen erhalten. Kein Commit, Push, Versionswechsel oder Live-Backend-Eingriff.
- Online-Sync-Hinweis aus `js/design-system.js` entfernt. Offline-Zeile bleibt als fest positionierter Status über der Tab-Leiste ohne Layoutverschiebung. Weitere automatische „Wird synchronisiert“-Toasts beim Einstellungsspeichern wurden nicht gefunden; bestehende Schutzmeldungen beim Abmelden/Zurücksetzen bleiben.
- Profil- und Messformular verwenden deckende Speichernleisten mit Haarlinie, Safe Area und Abstand. Der Profil-Scroller wird gesondert berücksichtigt. Doppelte Überschrift im Körper-Unterbereich entfernt.
- „Konto verwalten“ verwendet gruppierte Zeilen für Anmeldung/Sync, Daten und Gerät sowie eine einzelne rote Löschaktion am Ende. Vorhandene Handler, Konflikt-ID, Importprüfung, Reset- und Passwort-/Löschbestätigungen bleiben maßgeblich. Keine Änderungen an Cloud-Logik oder gemeinsamem Zustand.
- Navy-KFA ausschließlich für Männer aus Größe, Hals und Taille; keine Hüftabhängigkeit. Alte `sex`-Felder und manuelle KFA bleiben gültig. Körpermaß-CSV ergänzt `neck_cm` am Ende, fehlende Werte bleiben leer. DE/EN-Texte ergänzt.
- Gesamtsuite und gezielte Navy-/CSV-/Konto-/Sync-VM-Tests grün, `git diff --check` sauber. Kein Browser verfügbar (Inventar leer, In-App-Browser nicht verfügbar), daher 390 × 844 Hell/Dunkel und echte iPhone-Safe-Areas ungeprüft. Integrierte visuelle Prüfung und Release-Versionierung beim Koordinator.
- Gezieltes unabhängiges Review: fehlenden Gerätesymbol-Schlüssel durch registriertes `database` ersetzt und nachgeprüft; keine weiteren belegten Befunde im geprüften Umfang.

### App-Icons Hell/Dunkel, lokal vorbereitet (26.10.2026)

- Nur zwei Varianten: blauer Pulsstrich auf #F2F2F7 bzw. #1C1C1E, ohne Effekte oder eigene PNG-Rundung. SVG, RGB-PNG 180/512, Manifestvarianten; Standard Dunkel. Reproduzierbar ohne npm mit `node scripts/generate-app-icons.cjs` (erzeugt auch natives PNG 1024).
- Alte sechs `iconColor`-Werte bleiben in Profil und Sicherungen gültig und unverändert; Anzeige liest sie als Dunkel. URL-Auswahl speichert beim Start nicht mehr. Erst explizite Icon-Wahl schreibt ins vorhandene Feld. Ohne Wahl folgt das Web-Icon dem lokalen Farbschema einschließlich Systemwechsel; Browser-/Touch-Icon und Manifest werden gemeinsam gesetzt.
- iOS-Workflow/Asset verwenden fest Dunkel; alternative native Icons entfernt, alte Bridge-Nachrichten wirkungslos. Neue IPA erforderlich. Bestehende Home-Bildschirm-Web-Icons lassen sich nicht zuverlässig dynamisch ändern; Installationsseite verwendet die explizite Variante.
- Prüfung: Gesamtsuite und gezielte neue Icon-Tests grün; PNGs visuell und auf Größe/Opazität geprüft. Keine schmale Browserprüfung möglich: keine verbundenen Browser, In-App-Browser nicht verfügbar. Kein echter iPhone-/Xcode-Build-Test. Unabhängiges Review durch Koordinator ausstehend.
- Keine Versionsänderung, kein Commit/Push. Gemeinsame ungestagte Fremdänderungen erhalten; Koordinator integriert und erhöht die Release-Version gesammelt.


Aktualisiert: 24.10.2026. Maßgeblicher Code: dieses Repository. Git-Historie und aktuelle CI zusätzlich prüfen.

## Stand bei Einrichtung der Zusammenarbeit

- Veröffentlichte App-Version: **64** (25.10.2026: Aktivitäten-Paket — Katalog mit MMA/Padel, Live-Werte je Art, Vollbild-Karte mit hochziehbarer Wertekarte, Sperre, Runde, MMA-Runden-Timer, Wanderwege-Ebene (Waymarked Trails), Kalorien-Baseline-Modus, Gym-kcal, Dauer-XP, Wochenziel aktive Minuten, Bereich „Aktivitäten“ im Fortschritt; Reviews: Claude-Prüfer 4 Befunde Daten, Codex 3 Befunde UI, alle behoben und nachgeprüft). Davor 63 mit iOS-App 1.6 (25.10.2026: Aktivitäten im Vollbild mit Countdown, Live-Werten und Zusammenfassung; Codex-Review 7 Befunde behoben). Davor 62 mit iOS 1.5 (Laufen mit GPS, Karte, Routenplaner, Live-Aktivität; siehe Übergabe unten). Davor 58–61 kleine Korrekturen, davor 57 (25.10.2026: keine Linie unter der letzten Routine im Workout- und Routinen-Tab, `css/training-polish.css`). Davor 56 (25.10.2026: „Tag als vollständig markieren“ als Knopf in voller Breite mit fester Höhe, springt nicht mehr; Makro-Boxen auf der Essen-Seite gleich hoch; kein Kasten um das Fenster-X; Training: Tabs näher an der oberen Leiste, Standardpause mit 14 px oben/unten). Davor 55 (25.10.2026: Barcode-Scanner mit Blitz-Knopf in `js/food-flow.js`, nur wenn die Kamera `torch` meldet, Umschalten per `applyConstraints`; Review Codex: 1 Befund behoben). Davor 54 (25.10.2026: „Heute gegessen“ ohne Innen-Scroll, übrige kcal nur als Zahl — Essen rechts in der kcal-Zeile, Übersicht unter dem Ring, über dem Ziel „+X kcal“ in Warnfarbe; `js/app-polish.js`/`css/app-polish.css`). Davor 53 (25.10.2026: nur noch Original-Design — `state.appDesign` wird bei jedem Render auf `classic` gesetzt, Designauswahl ausgeblendet; Konto: „Konto verwalten“ bündelt Anmeldung/Sync, Sicherung und Löschen, kein „Dein Bereich“; Essen-Abläufe neu in `js/food-flow.js`/`css/food-flow.css` (Suche mit automatischer Open-Food-Facts-Suche ab 3 Zeichen, Portion, Barcode, Rezepte, eigene Werte, Foto; Claude-Frontend-Agent); Muskelgruppen eigener Übungen werden in `js/exercise-muscles.js` aus dem Namen abgeleitet, nicht gespeichert (Codex), „Diese Woche · Sätze pro Muskelgruppe“; `js/training-polish.js`: eigene Übung direkt in der Übungssuche, Kalender öffnet Auswertung, grünes „Läuft“, Standardpause als Pille; `js/app-polish.js`: Plus-Menü-Animation, X schließt animiert, Essen-Seite mit eigener Makro-Optik, Wasser von ml-Getränken ohne Wasserwert geschätzt (nur Anzeige), Scroll bleibt bei „Tag vollständig“, ohne 01/02-Nummerierung außer Konto, ohne Seitenleisten-Fuß, ohne „Nährstoffwerte & Ziele im Detail“; Suche bestraft Gerichte auch als Wortteil; auf Selvirs Auftrag iOS-App 1.4 mit echter Haptik (`haptic`-Nachricht, Feature `haptics`); Reviews: Claude-Prüfer 3+1 Befunde (Muskelgruppen), Codex 3 Befunde, alle behoben und nachgeprüft. Bekannt: Open-Food-Facts-Suche `cgi/search.pl` antwortet zeitweise mit 503 ohne CORS). Davor 52 (25.10.2026: Essenssuche mit Relevanz statt Startswith-Bonus — gleiche Regel in `js/catalog-worker.js` und `js/food-upgrade.js` (foodRelevance), nur am deutschen Namen, Grundzutaten/roh vor Gerichten, Gebäck und Innereien, neue Aliase z. B. Geschnetzeltes → Brustfilet, ODER-Ersatzsuche; Sicherung im Profil-Fenster kompakt; `js/haptics.js` Vibration bei Satz, Speichern, Start/Ende, Pause und Auswahl — native iOS-Haptik vorbereitet über `pulsNativeFeatures` 'haptics', `ios/` dafür nicht geändert; Review Codex: 3 Befunde behoben). Davor 51 (25.10.2026: Barcode auch senkrecht — eigener Zusatz-Scan des um 90° gedrehten Videobilds in `js/products.js`, da ZXings TRY_HARDER-Drehung in 0.2.1 fehlerhaft ist; auf Selvirs ausdrücklichen Auftrag iOS-App 1.3: Live-Aktivität/Dynamic Island zeigt ohne Pause die Workout-Zeit, nach Pausenende automatisch per staleDate, `native-bridge.js` sendet `workoutActive` nur bei `window.pulsNativeFeatures` mit `workoutTimer`, ältere App bleibt beim alten Verhalten; Review Codex: 1 Befund behoben und nachgeprüft). Davor 50 (25.10.2026: Konto — „Dein Design“ enthält Sprache und App-Icon direkt, Design-Kacheln schmal in drei Spalten, „Konto & Synchronisierung“ steckt in „Deine Daten“, `js/account-refresh.js`/`css/account-refresh.css`; Tab-Wechsel unten mit Wisch-Animation links/rechts, `js/page-slide.js`/`css/page-slide.css`; Review Codex: 1 Befund Fokus behoben und nachgeprüft). Davor 49 (25.10.2026: `js/workout-controls.js`/`css/workout-controls.css` — Linien-Symbole statt Textzeichen ⌄ ⌃ × ✕ ‹ ›, knapperes Abschluss-Fenster mit Verwerfen-Warnung, −30 s und „Pausenzeit“ im laufenden Workout, Scroll-Rad für die Standardpause, zentriertes Datumsfeld; Review Claude-Prüfer: 4 Befunde behoben). Davor 48 (25.10.2026: Pop-up „Pause vorbei“ mit OK und Animation, `js/rest-popup.js`/`css/rest-popup.css`, eigener `<dialog>` über offenen Fenstern, Vormerken bei Pausenende im Hintergrund bis 10 min; Review Claude-Prüfer: 5 Befunde behoben und nachgeprüft). Davor 47 (25.10.2026, auf Selvirs ausdrücklichen iOS-Auftrag: iOS-App 1.2 mit echtem App-Icon-Wechsel und neu gestalteter Dynamic Island/Live-Aktivität; `js/native-bridge.js` sendet `setAppIcon`; Review Claude-Prüfer, da Codex und Gemini im Limit). Davor 46 (25.10.2026: Repository aufgeräumt — Skripte in `js/`, Styles in `css/`, alte Doku in `docs/archive/`, `archive/` entfernt, neue README; `sw.js` aktiviert neue Versionen sofort per `skipWaiting()` nach vollständigem Precache; Review Codex: Offline-Lücke beim Update behoben). Davor 45 (25.10.2026: Training — Workout-Tab als Startseite mit kompakten Routinenzeilen, „Heute erledigt“ abgesetzt, Routinen-Tab bleibt Verwaltung, Kalender ohne doppelte Linie; `training-tabs.js`/`.css`, alle Designs, Review Codex: EN-Befund behoben). Davor 44 (Profil-Schalter Richtung/Tempo untereinander), 43 (Profil & Ziele überarbeitet, Logikfehler behoben), 42 (Abstand zwischen den Wischseiten), 41 (Essen im neuen Originaldesign), 40 (optionaler Erststart, Tutorial entfernt, klebender Pausentimer, ruhigere Satzzeilen), 39 (`native-bridge.js` für Pausen-Mitteilung und Dynamic Island; von Selvir auf iPhone und iPad bestätigt) und 38 (Commit `0c62ef6`: Konto 36, Übersicht 37, Training 38 im neuen Originaldesign).
- Live: https://selvirtnj.github.io/puls/?v=95 ; Repository: https://github.com/selvirtnj/puls .
- Davor veröffentlicht: 35, Ausgangscommit `6e878204b677d1e9aa8f51f51f22f2df526f2c81`.
- Version 34: fokussierte Oberfläche, neu geordnetes Konto, mehr Diagramme, vier zusätzliche Designs, Archiv und Projektdokumentation.
- Version 35: 87 neue Übungsvarianten, insgesamt 963; Maschinen-/Kabel-/Smith-Filter, deutsche Suchnamen und Ergebnis-Paginierung.
- Die anschließende Team-Einrichtung ändert Dokumentation, Agentenrollen und Entwicklungswerkzeuge, keine Runtime-Funktion der App. Deshalb bleibt die App-Version 35.
- Die bisherigen Web checks und Pages-Veröffentlichungen für 35 waren erfolgreich. Das ist ein historischer Prüfstand, kein dauerhafter Live-Nachweis.

## Was jetzt eingerichtet ist

`AGENTS.md`, `docs/START-HERE.md`, Produktkontext, Backend-Übergabe, Teamablauf und die Rollen `puls_frontend`, `puls_backend`, `puls_reviewer`. Ein Hauptchat koordiniert die Aufgaben. Seit 24.10.2026: Hauptchat „PULS · Hauptchat“ in Claude Code koordiniert Claude, Codex (`scripts/codex-bridge.ps1`) und Gemini/Antigravity (`scripts/gemini-bridge.ps1`) nach `docs/AI-TEAM.md`; Brücken inkl. Rückfragen getestet. Regel: nur Web-App, `ios/` nur auf Selvirs ausdrücklichen Wunsch. Neue Chats müssen die Dokumentation lesen; automatische vollständige Übertragung beliebiger Gesprächshistorien wird nicht vorausgesetzt.

## Sofort nutzbare Befehle

```sh
git status --short
git log -1 --oneline
node scripts/check.cjs
node scripts/check-handoff.cjs
node scripts/serve.cjs
```

`npm test` entspricht `node scripts/check.cjs`. Keine npm-Abhängigkeiten nötig. Ist npm nicht im PATH, direkt Node benutzen.

## Aktueller Auftrag / nächster Schritt

**Seit 25.10.2026 gilt das Apple-Redesign nach `docs/DESIGN-SYSTEM.md` (ersetzt das lila Original und alle 11 Designs).** Schritt 1 (Version 65) und Schritt 2 (Version 66, alle übrigen Bildschirme) sind live. Nächstes: Selvirs iPhone-Rückmeldung abwarten. Der folgende Absatz ist historisch.

Selvir hat am 24.10.2026 die Zielklärung bestätigt: persönliche iPhone-Nutzung, sportliches dunkles lila Original, weniger verschachtelte Karten, sichtbare kurze Aktionsreaktionen. Konto- und Übersichts-Vorschau wurden ausdrücklich positiv beurteilt. Alle vier Hauptbereiche (Konto, Übersicht, Training, Essen) sind im neuen Originaldesign live; danach folgen Selvirs Einzelwünsche (siehe Übergaben unten). Keine automatische kontinuierliche Hintergrundarbeit. Verbindlicher Plan: `docs/DESIGN-WORKPLAN.md`.

Hauptchat ist Claude Code („PULS · Hauptchat“); wer direkt in Codex arbeitet, findet den Einstiegsauftrag in `docs/START-HERE.md`. Projektrollen werden je nach Client nach Projektöffnung/neuem Chat geladen, nicht zwingend mitten in einer bestehenden Sitzung.

## Technische Orientierung

Statische Dateien: `index.html`/`sw.js` im Stamm, Skripte in `js/`, Styles in `css/` (seit 25.10.2026, siehe `docs/ARCHITECTURE.md`); kein Bundler und kein React-/Flutter-Projekt. Ältere Übergaben unten nennen Dateien noch ohne `js/`/`css/`-Präfix. JS-Dateien definieren Globals und umschließen bestehende Funktionen. Die letzte Definition in der Ladereihenfolge gewinnt; beim Ändern immer die Kette prüfen. Tests verwenden VM-/DOM-/Netzwerkstubs.

`state` bleibt die gemeinsame Datenbasis. Lokales Profil: `puls-v1`. Auth-/Synchronisierungsmetadaten und gegebenenfalls alte lokale Fotos haben weitere Schlüssel. Supabase speichert pro Nutzer ein revisionsgeprüftes JSON-Profil. Die Backend-Dateien belegen die beabsichtigte Konfiguration, nicht den aktuellen Live-Zustand.

Katalog, Icons, Offline-Cache und PWA-Scope müssen bei Releases mitbedacht werden. Der bisherige Autoringsordner mit `dist/`, `release34/` und einmaligen Vorbereitungsskripten ist keine zweite aktuelle Quelle; Skripte daraus nicht unbesehen ausführen.

## Offene Grenzen und sinnvolle spätere Aufgaben

Keine der folgenden Aufgaben ist durch diese Liste automatisch zur Umsetzung freigegeben:

1. Modulkopplung: langfristig Funktionen klarer aufteilen und Wrapper reduzieren, mit Tests. Kein riskanter Komplettumbau nebenbei.
2. Backend: direkte eigene Tabellen-Schreibrechte können den RPC-Revisionsweg umgehen; serverseitige Payload-Validierung ist flacher als die Clientprüfung. Siehe Backend-Übergabe.
3. Geteilte Geräte: benutzerübergreifende Backup-/Rückkehrschlüssel und Offline-Abmeldung ausdrücklich testen.
4. Breitere Nutzung mit Freunden: reale Zweikonto-Isolation, Auth-Mailversand/SMTP, Limits, Offline-Sync und Restore mit eigens angelegten Testkonten prüfen. Mock-Tests allein genügen nicht.
5. UI-/Browsergrenzen: Audio/Kamera/Sprache/OCR und Hintergrundverhalten hängen von iOS und Browserberechtigungen ab. Reale iPhone-Tests bleiben nötig.
6. Einige neue Diagramm- und Beschreibungsdetails sind möglicherweise noch nicht vollständig übersetzt. Bei englischer UI konkret prüfen, nicht pauschal Vollständigkeit behaupten.

## Übergabe nach jeder größeren Aufgabe

### Lokal vorbereitet: integrierte OFF-Suche und Navy-KFA, 26.10.2026

- Koordinator-Auftrag an Codex auf Basis `2c8fdae` (68), ohne Commit, Veröffentlichung oder Versionsänderung. Parallel bearbeitete Trainings-/Laufdateien und `CLAUDE.md` wurden von Codex nicht verändert.
- Letzte Suchdefinition in `js/food-flow.js`: gespeicherte Treffer sofort, Katalog asynchron, OFF ab drei Zeichen nach 450 ms nur online. Abbruch bei neuer Eingabe, Tabwechsel und Schließen; alte Antworten werden verworfen. Bestehende Feldauswahl, `app_name=PULS` und Sitzungscache bleiben. Nach Review zehn tatsächlich gestartete Netzabfragen pro Minute: vor Versand abgebrochene Vorgänge zählen nicht, gesendete und danach abgebrochene zählen weiter. Bei Grenze dezenter Hinweis und automatische Wiederaufnahme des aktuellen Begriffs nach Fensterablauf. Timeout mit kurzem Hinweis, keine Fehlerwiederholungen. Enter, erneutes Anzeigen derselben Suche und Katalog-Nachladen duplizieren laufende Anfragen nicht; ausgewählte Sammlungen ohne Suchbegriff bleiben erhalten. OFF unter lokalen Treffern, Dubletten nach Barcode oder normalisiertem Namen plus Marke entfernt. Kein separater Suchknopf und kein Text-/Sprache-Chip. Übernahme weiter über `chooseOnlineFood` und Produktprüfung, keine erfundenen Werte.
- `js/profile-refresh.js`: optionales Halsmaß ergänzt die bestehende Messfeldregistrierung; `validData()` prüft damit auch Halswerte, alte Sicherungen ohne Hals bleiben gültig. US-Navy-KFA verwendet cm nach Inch-Umrechnung und vollständige Maße eines Tages, Formel unterstützt Frauen zusätzlich mit Hüfte; im Produkt gilt weiter das persönliche männliche Profil. Kein Zusammenmischen verschiedener Messtage, keine Zukunftswerte. Nach Review gewinnt der neuere manuelle oder geschätzte KFA, bei gleichem Datum der manuelle Wert. Anzeige in der Maß-Eingabe und im aktuellen Körperbereich mit Datum und Schätzkennzeichnung, keine Speicherung als Messung. Historische BMI-/Deurenberg-Kurven und Kalorienplanung unverändert; kein bestehender Magermasse-/Katch-McArdle-Verbraucher gefunden. Die Änderung an `js/experience.js` wurde auf Koordinatorentscheidung vollständig zurückgenommen: Laden und Formular normalisieren wie bisher auf männlich, kein neuer Start-Speichervorgang. Englische Hals-/KFA-/Hinweistexte einschließlich Suchfehler und Timeout ergänzt. CSV ausdrücklich nicht Teil dieser Nacharbeit.
- Prüfung: `C:\Program Files\nodejs\node.exe scripts/check.cjs` grün, einschließlich neuer Mock-fetch-Suchtests, Navy-Formel/Grenzfälle, Hals-Validierung und alter Sicherungen. Browserinventar des Computer-Use-Werkzeugs meldet keine verfügbaren Browser; daher kein 390×844-Layouttest, kein echtes iPhone und keine Live-OFF-/RLS-Prüfung. Unabhängiges Review, integrierte Browserprüfung und spätere Release-Versionierung liegen beim Claude-Koordinator.

### Lokaler Koordinator-Auftrag: native Live-Aktivitäten und Scanner, 26.10.2026

- Codex auf Basis `6a7c055`, noch nicht committet/veröffentlicht; Web-Version unverändert. Native Zielversion 1.7 (`ios/project.yml`), neue IPA nach macOS-Build und AltStore-Installation erforderlich.
- Live-Aktivitäten: Systemschrift, dynamisches Apple-Blau/Systemflächen, SF Symbols, keine pulsierenden/rollenden Effekte und keine Emojis in km-Mitteilungen. Mitteilungen selbst zeichnet iOS im Systemstil.
- Fehlerursache „Pausiert“: eingefrorener Endstand wurde über dasselbe Feld wie eine Pause dargestellt und vier Minuten behalten. Expliziter optionaler Endzustand, sofortiges `Activity.end` mit finalem Content, geordnete native Updates/Enden mit kurzem Hintergrundbudget. Workout-Abgleich synchron bei `save`/`render`, Start und Seitenwechsel. Lauf endet bereits an der Zusammenfassung; lokaler Endmarker verhindert Wiedereröffnung durch Takte/Neuladen, „Weiter“ aktiviert erneut. Keine neuen synchronisierten Profilfelder, Strecke bleibt bis Speichern/Verwerfen erhalten. Verspätete Mitteilungsfreigabe kann eine abgebrochene Pause nicht erneut planen.
- Scanner `js/products.js`: Zusatzbilder abwechselnd 90° und 270° (Review-Korrektur, 180° bringt bei 1D nichts), voller Bildbereich, höchstens 960 px und ein Versuch je 400 ms, ausgesetzt im Hintergrund. Der sichtbare Rahmen liegt in den parallel belegten Dateien `js/food-flow.js`/`css/food-flow.css` und ist dem Claude-Koordinator zur Änderung übergeben.
- Prüfung: `C:\Program Files\nodejs\node.exe scripts/check.cjs` grün einschließlich neuer Bridge-/Scanner- und Laufabschluss-Regressionen mit Fixtures. Unabhängiger Codex-Prüfer: Vorschau-Endmarker-Befund behoben und nachgeprüft, keine offenen belegten Befunde. Kein Swift-Build unter Windows, kein echtes ActivityKit-/Sperrbildschirm-/Kamera-/iPhone-Layout-Testergebnis. Abschließendes integriertes Review und Gerätetest beim Koordinator.

### Version 80: Web-Seite für natives Konto/Profil (M8, Phase A) — 01.11.2026

- Neu `js/native-account.js`: Projektion `account` (ohne E-Mail/Tokens), Planner-Query, Ops Name/Avatar/Profil/Maße/Darstellung/Klänge, `plan.set`/`adaptive.set` über M7 `goals.set`, `snapshot.device.scheme`, `resolvedScheme` immer light/dark.
- Anmeldung, Abmeldung, Konflikt, Import/Export, Recovery, Reset, Kontolöschung bleiben ausschließlich Web-Abläufe (native nur `web:true`-Ausstiege). Phase B (native Datenhoheit) nur als Plan in `NATIVE-BRIDGE-PROTOCOL.md` §14 — braucht Gerätetest und Selvirs Freigabe (u. a. serverseitige Owner-Markierung).
- Claude-Review + Codex-Nachprüfungen; native Gegenstück CI #41 grün.

### Version 79: Web-Seite für native Ernährung (M7) — 01.11.2026

- Neu `js/native-nutrition.js`: Projektion `nutrition`, Queries (Suche lokal + OFF gestaffelt, Produkt, Eintrag, Rezept, Etikett-Parse, Import-Vorschau) und 18 Ops (Eintragen/Ändern/Löschen/Wiederherstellen, Wasser, Tagesabschluss, Ziele, Favorit, Produkt/Etikett mit ausdrücklicher Warnungsbestätigung, Rezepte, Import). Snapshot-Semantik wie im Web; Etikettwerte über Web-`labelReviewValues`; eigene Korrektur nur für eigene Produkte.
- Nur mit Feature `nativeNutrition`; Browser/ältere IPA unverändert. Claude-Reviews (P1, P2, Re-Review) und Codex-Teilarbeit.

### Version 78: Web-Seite für native Aktivitäten (M6) — 31.10.2026

- Neu `js/native-activity.js`: Projektion `activity`, `pulsNativeActivityQuery`, 12 Ops (Start/Pause/Weiter/Runde/Beenden nach vollständigem GPS-Abholen/Speichern/Verwerfen/Bearbeiten/Löschen, Einstellungen, Routen). RunTracker bleibt einziger Recorder; Zusammenfassung an Abschlussstand gebunden (kein Speichern veralteter Entwürfe, kein Löschen nicht eingerechneter Punkte).
- Nur mit Feature `nativeActivity`; Browser/ältere IPA unverändert. Claude-Review + zwei Codex-Nachprüfungen.

### Version 77: Web-Seite für nativen Kalender/Fortschritt (M5) + Projektionen nach Bedarf — 31.10.2026

- Neu `js/native-progress.js`: Projektion `progress`, `pulsNativeProgressQuery` (month/workout/exercise/run), Ops `progress.view.set`/`progress.chart.set`/`progress.goal.set`; nur mit Feature `nativeProgress`.
- `pulsNativeSetInterest`: Projektionen nur für sichtbare native Bildschirme; granulare Caches (Satz-Op ~3–48 ms statt ~550 ms im VM-Benchmark `tests/perf-native-projections.cjs`).
- Browser/ältere IPA unverändert (Tests). Claude- und Codex-Review.

### Version 76: Web-Seite für natives Training (M4) — 31.10.2026

- Neu `js/native-training.js`: Projektion `training` und 15 Trainings-Ops (Start, Sätze, Übungen, Supersatz, Pause, Abschluss/Verwerfen, Routinen, eigene/Katalog-Übungen) über die zuletzt wirksamen Web-Funktionen; native Nebenwirkungen (Pause/Live-Aktivität) nur nach bestätigter Speicherung genau einmal.
- Nur mit Feature `nativeTraining` aktiv; Browser und bisherige IPA unverändert (Tests). Codex-Review + Nachprüfung; native Gegenstück auf `native-ios` (CI #17 grün).

### Version 75: Web-Seite für native Übersicht und Tab-Leiste (M3) — 31.10.2026

- Neu `js/native-projection.js` (Übersicht als fertig berechnete Projektion, nur mit Feature `nativeOverview`), `css/native-shell.css` (nur unter `html.puls-native-tabs`), `chrome`-Meldungen (Formular/Session/Lauf sperrt native Navigation), `pulsNativeSetChrome`, `pulsNativeSetDate`, erweiterte `pulsNativeNavigate`-Ziele.
- Browser und bisherige IPA: wirkungslos (Tests). Native Gegenstück auf `native-ios` (CI #13 grün).

### Version 74: Web-Seite der nativen Zustandsbrücke — 31.10.2026

- Neu `js/native-state.js` (Protokoll v1, `docs/native/NATIVE-BRIDGE-PROTOCOL.md`): Snapshots an die native App, Gewichtsbefehle `weight.upsert`/`weight.delete` mit `expect`/`conflict`, Weiterleitung von Konto → „Körper & Entwicklung“ zum nativen Bildschirm (nur mit Feature `nativeBody`).
- Ohne `pulsState`-Handler/`stateBridge` (Browser, bisherige IPA) vollständig wirkungslos; zwei Claude-Reviews, VM-Tests in `tests/check-native-state.cjs`.
- Native Gegenstück (M1/M2) liegt auf Branch `native-ios`, noch nicht auf `main`; Stand in `docs/native/MIGRATION_PROGRESS.md`.

### Version 73: Zurück per Kantenwisch — 26.10.2026

- Neue Kantengeste `js/edge-back.js`/`css/edge-back.css`: Touch-Start in den linken 24 px, Wisch nach rechts → gleiche Aktion wie der sichtbare Zurück-Knopf (`.click()`), sonst Zurückfedern. Abgedeckt: Konto-Unterseiten, Essen-Fenster (`.ffback`), Übungsauswahl, Zutatensuche/Rezept, Übung verschieben, Einkaufsliste. Nicht: Lauf-Ansicht, Blätter-Pfeile, Fenster nur mit ✕, laufendes Workout ohne Fenster, Onboarding.
- Schutz gegen überlappende Gesten, ungültig gewordene Ebenen und gleichzeitiges Fensterziehen (`dragSheet`). Test `tests/check-edge-back.cjs`. Codex-Review: 3 P2 behoben, Nachprüfung Freigabe ja. Nicht auf echtem iOS getestet; die iOS-Hülle aktiviert `allowsBackForwardNavigationGestures` nicht.

### Version 72: Plus dreht zum ×, Erststart per X schließbar — 26.10.2026

- Plus-Symbol dreht bei offenem Plus-Menü wieder um 135° (`css/design-system.css`, reduced-motion ohne Übergang). Bei 390 px verdeckt das Sheet die Leiste; Drehung nur beim Ein-/Ausgleiten sichtbar.
- Erststart: Fenster-X in jedem Schritt beendet das Onboarding (`skipOnboarding()` in `js/flows.js`): nur `setupPending=false`/`onboardingComplete=true`, Ziele/Plan/Profil unverändert, erscheint nicht erneut. Kein Weg, es später erneut zu öffnen. Test in `tests/check-onboarding.cjs`.

### Version 71: Plus-Knopf in der Tab-Reihe — 26.10.2026

- Untere Leiste (≤ 760 px): Plus-/Hinzufügen-Knopf sitzt auf derselben Höhe wie die übrigen Tabs (`css/design-system.css`; `polish.css` hatte Padding/Gap auf 0 gesetzt). Browser-Messung 390×844 und 320×568: Symbolmitte aller fünf Knöpfe gleich. Bekannt, unverändert: Plus dreht sich beim Öffnen nicht zum ×.

### Version 70: Gesamt-Audit — 26.10.2026

- Sync-/Speicher-Härtung, UI-Korrekturen aus dem Audit, `visuals.js`/`visuals.css` entfernt, README neu. Details: Abschnitt „Gesamt-Audit“ oben und `docs/audit/FINAL-REPORT.md`.

### Version 69: Training, Datum, Icons, Konto — 26.10.2026

- Sonnet: Übungssuche feste Höhe, Satzspalten mittig, Pausen-Stepper, Kalender-Rückblick nur Seite 1 (`reviewWorkout`), Segmentleiste unter Safe Area, Fortschritt ohne e1RM/Gruppen, Aktivitäts-Endscreen mit XP (`activityDoneShow`); Datum rechts neben dem Large Title (`dsDateBar`), Tab-Leiste 54 px, Datumsfelder linksbündig.
- Codex: OFF in der normalen Suche (10 Anfragen/min, Wiederaufnahme), „Text & Sprache“ entfernt, KFA nach US-Navy nur männlich (Hals, neuere Messung gewinnt), Profil bleibt männlich; App-Icons nur `light`/`dark` (alte Werte → dark, iOS festes dunkles Icon); Konto verwalten neu, deckende Speichern-Leisten, „Wird synchronisiert“ entfernt, Offline-Hinweis fixed, CSV mit Hals.
- Prüfung: Claude-Reviewer (OFF/KFA), Claude-Sonnet-Reviewer (Rest; Codex/Gemini im Limit). Offen, niedrig: `js/personal.js:11` „Auswertung ansehen“ zeigt noch alle Abschlussseiten.

### Version 68 / iOS-App 1.7 (lokal vorbereitet): iPhone-Rückmeldung — 26.10.2026

- Claude (Sonnet) UI: Konto-Listen (alte `nav{display:grid}`-Regel traf `.dsgroup`), gruppierte Ergebnislisten, Lupe-Einzug, Chips ohne Stern, Foto-Bereich „Foto aufnehmen“/„Aus Fotos wählen“, Einheiten-Segment, Datumsfelder, Dezimalfelder mit Komma (`type=text inputmode=decimal`, strenges Muster, `dsRecheckDecimals`), Zeitraum-Abstand, Wisch-Löschen auf der Übersicht, Startbildschirm 1,2 s, quadratischer Scanrahmen.
- Claude (Sonnet) Workout: Verwerfen in der Titelzeile, Drei-Punkte-Aktionsfenster (Supersatz, Verschieben, Entfernen), langes Drücken 500 ms, kg-Satzfeld mit Komma.
- Codex: siehe Abschnitt „native Live-Aktivitäten und Scanner“ unten; Review-Korrekturen: nur aktive Activities aktualisieren, Feature `runActivityEndState` für App-1.6-Verträglichkeit, Bridge-Ausnahmen abgefangen.
- Prüfung: Claude-Reviewer (iOS), Codex-Reviewer (Web), alle Befunde behoben; `check.cjs` grün. Kein Swift-Build, kein echtes iPhone.

### Version 67: Kurzreview nach Redesign — 26.10.2026

- Codex (5-Minuten-Fehlersuche): Suchchips und Diagrammschalter auf 44 px Mindesthöhe; Makrobalken mit gültigen ARIA-Werten und `aria-valuetext`, auch ohne Ziel. Claude `puls-frontend`: Platzhalterkontrast hell/dunkel auf mindestens 4,5:1.
- Prüfung: `check.cjs` grün, Diff vom Koordinator gesehen. Kein Browser-/iPhone-Test dieser Kleinigkeiten.

### Version 66: Apple-Redesign Schritt 2 — 26.10.2026

- Claude `puls-frontend`: Essen (Segmentsteuerung, Makrobalken in Akzent, Aktionsliste, Wasserzeile), Hinzufügen-Fenster als Aktionsliste, Training (Segmentsteuerung, ruhiger Kopf, Workout-Karten), Laufen (Phosphor je Aktivität), Konto als iOS-Einstellungsliste mit Chevron, einheitliche Sheets, gestaltete Dateiknöpfe, Select-Chevron, Startbildschirm nur „PULS“ (max. 0,6 s). Emojis im Quellcode durch `pulsIcon`/`uiIcon` (`js/app.js`) ersetzt, DOM-Emoji-Ersatz entfernt. `css/food-refresh.css`, `overview-refresh.css`, `training-refresh.css`, `account-refresh.css` neu und schlank.
- Entscheidung Koordinator: gefüllte Knöpfe `#0071E3` (weiße Schrift 4,7:1) statt `#007AFF` (4,0:1); Akzenttext über `--ds-accent-text`.
- Prüfung: Codex-Review (1 Kontrastbefund, behoben), `check.cjs` grün, Browser 390 px hell/dunkel durch den Frontend-Agenten. Kein echtes iPhone, kein VoiceOver, keine echte Safari-Dateiauswahl.
- Bekannte Grenzen: Segmentknöpfe 44 px hoch, Tab-Beschriftung 10 px, Diagrammfarben zur Laufzeit als Hex (`dsSeriesColors`), einige abgeschaltete Altfunktionen enthalten noch Zeichen wie ＋/→ (nicht sichtbar).

### Version 65: Apple-Redesign Schritt 1, Offline, Passwort anzeigen — 25.10.2026

- Regeln: `docs/DESIGN-SYSTEM.md` (Verbotsliste, Farben, Schrift, Radien, Phosphor-Icons). Skill `apple-design` und `swiftui-expert` liegen lokal unter `~/.claude/skills/` (nicht im Repo, Lizenz der HIG-Texte).
- Daten (Codex): Farbschema ist Geräteeinstellung in `localStorage['puls-color-scheme']` (`js/color-scheme.js`: `getColorScheme`, `setColorScheme`, `applyColorScheme`, `data-scheme` auf `<html>`), nicht synchronisiert, beim Start keine State-Änderung (sonst Sync-Konflikt auf Zweitgerät). Alte Felder `appDesign`/`colorTheme` bleiben wirkungslos erhalten; `js/designs-extra.js` bleibt wegen `validData`. `js/connectivity.js`: `window.pulsConnectivity` + Event `puls:connectivity`. `sw.js`: Katalog (5,5 MB) im eigenen Cache `puls-catalog-v1`, nur bei Katalogänderung erhöhen.
- UI (Claude `puls-frontend`): `css/design-system.css` als letzte Schicht, `js/icons.js` (Phosphor, MIT), `js/design-system.js` als letztes Skript (Tab-Leiste, neue Übersicht, Passwort-Knopf für alle Passwortfelder in Fenstern, Offline-Hinweis, Darstellung System/Hell/Dunkel). Alle CSS-Dateien mechanisch bereinigt (Schatten, Verläufe, Blur, Hover, Animationen weg; classic-Regeln als Basis übernommen, andere Designs entfernt). `css/designs-extra.css` gelöscht.
- Prüfung: Claude-Reviewer (Daten, 2 Runden), Codex-Reviewer (UI, 2 Runden), alle Befunde behoben; `check.cjs` grün; Browser 390×844 hell/dunkel durch den Frontend-Agenten. Kein echter iPhone-Test, kein echter Safari-SW-Test.
- Schritt 2 offen: Essen (Makrokacheln, Wasser, Vorschläge), Hinzufügen-Fenster (Kachelraster), Training-Kopf, Konto (Nummern, Wortmarke, Pfeile), etwa 40 Emoji/Unicode-Stellen in JS, Pastell-Inline-Farben, Selects ohne Pfeil, Laufen-Bildschirm, Typo-Stufen in Altbildschirmen.

### Version 64: Aktivitäten-Paket — 25.10.2026

- UI-Teil (Claude): neue Datei `js/activity-overview.js` (Bereich „Aktivitäten“ im Fortschritt, Darstellungs-Wrapper für `baselineEnergyLine`); `js/run-session.js` (Live-Ansicht je Art, hochziehbare Wertekarte, Leiste Sperre · Pause · Beenden mit Doppeltipp, Sperre inert + 1 s Halten, Runde als Pille, MMA-Rundenbox mit Ton/Haptik, Runden in der Zusammenfassung); `js/run-map.js` (Wanderwege-Ebene, Zustand pro Gerät in localStorage `puls-map-trails`); `js/running.js` (Wochenzeile aktive Minuten, Zielformular); `js/profile-refresh.js` (Schalter Kalorienberechnung/Alltagsfaktor).
- Grenzen: kein echter iPhone-Test (Touch-Drag, 1-s-Halten, GPS). MMA-Signale nicht bei gesperrtem iPhone/Hintergrund, Ton still bei Stummschalter. Wanderwege-Kacheln nur online, externer kostenloser Dienst. Kalibrierung im Baseline-Modus aus. Übergang: Geräte mit alter Version im Cache rechnen das Ziel klassisch, bis aktualisiert.
- Später, eigene Pakete: Uhr-Anbindung, Routensuche à la Komoot.
- Review-Nacharbeit im inzwischen integrierten UI-Stand: Baseline-Ziele warten beim Start auf die vollständig geladene Aktivitätslogik; kein vorübergehender Speicherstand ohne Sport. Aufteilungszeile nur für tatsächlich berechnete Baseline-Ziele, übrige Zielanzeigen und Essensvorschläge auf das gewählte Tagesziel umgestellt. Claudes Darstellung bleibt erhalten. MMA-Weiterschaltmarken sind mit den bisherigen Laps-Regeln vereinbar und zusätzlich getestet; siehe `ACTIVITY-DATA.md`.

- Koordinator-Auftrag von Claude Code, Basis `54e0725`; keine Veröffentlichung/Versionsänderung, kein Live-Backend und keine Änderung an `ios/`.- Neue MMA-/Padel-Katalogeinträge mit Compendium-Näherungen, Picker-Flag, sicherer Fallback unbekannter Typen sowie Erhalt alter/ausgeblendeter Typen beim Bearbeiten. Optionale Uhr-/Puls-/Lap-/MMA-Rundenfelder und Minuten-Wochenziel werden verlustfrei validiert.
- Brutto-Gym-Schätzung nach Zeit/MET/Gewicht, Netto-Sportbedarf einschließlich Gym, Baseline-Modus mit Tages-Sportzulage nach dem Zu-/Abschlag (auch Extrem); klassische/manuelle Ziele erhalten. Verlaufskalibrierung im Baseline-Modus ausdrücklich deaktiviert. Neue Sessions erhalten Dauer-XP mit gemeinsamem Tageslimit 100, zusätzlich zu bisherigen PR-XP; alte Einträge werden nicht nachträglich markiert.
- Wochen-/Monatsaggregation nach Art einschließlich Gym und Recap ergänzt. Ausführliche Datenformate, globale Schnittstellen, Rechengrenzen und Integrationsschritte: [ACTIVITY-DATA.md](ACTIVITY-DATA.md).
- Prüfung: gezielte Daten-/Metrik-/Planner-/Regressionstests und `node scripts/check.cjs` lokal grün. Echter iPhone-Test steht aus (siehe Grenzen oben). Mock-Tests sind kein Live-RLS-Nachweis.

### Version 63 / iOS-App 1.6: Aktivitäten im Vollbild — 25.10.2026

- Selvirs Wunsch nach Vergleich mit adidas Running/Strava: Plus → „Aktivität“ öffnet direkt eine eigene Vollbild-Ansicht (`js/run-session.js`, wie das laufende Workout) mit Karte, links Aktivitätsart (Laufen, Trailrun, Spazieren, Wandern, Berggehen, Radfahren, Tischtennis, Fußball, Inlineskaten, Sonstiges), mittig Start, rechts Route. Countdown 10 s mit „+10 Sekunden“ und „Jetzt starten“. Live: Dauer, Distanz, Kalorien (geschätzt), Ø Pace, Karte, Pause; pausiert Beenden/Weiter. Zusammenfassung: Gefühl (5 Stufen), Untergrund, Notiz, Ø/Max-Geschwindigkeit, Höhenmeter, max. Höhe, Pause, km-Zeiten; Weiter/Speichern/Verwerfen. „Nur Timer“ und „Lauf eintragen“ entfernt; alte Einträge bleiben sichtbar und lassen sich bearbeiten (Art, Gefühl, Untergrund, Notiz) oder löschen.
- Codex (backend): `js/run-metrics.js` mit Aktivitätskatalog, Kalorien nach Compendium of Physical Activities (Brutto, MET × kg × h, Laufen/Gehen tempoabhängig, letztes Gewicht nötig), Höhe (geglättet, Hysterese), Max-Geschwindigkeit (20-s-Fenster); `tests/check-run-metrics.cjs`. GPS-Punkte jetzt `[t,lat,lon,acc,seg,alt,altAcc]` (altAcc −1 = unbekannt, alte 5er-Punkte gültig).
- Neue optionale Felder an `state.runs[]`: `type`, `startedAt`, `pauseSeconds`, `kcal`, `feeling`, `terrain`, `elevationGain`, `elevationMax`, `maxSpeed`; `distanceKm` darf 0 sein (Tischtennis). `activeRun.type`, `runSettings.lastType`. Wochenziel, Bestzeiten und XP nur für Laufen/Trailrun; alle Aktivitäten zählen für die Serie.
- iOS 1.6: Höhe in `RunTracker`, Standort vor dem Start (`runLocate` → `pulsRunLocateReceive`), Live-Aktivität mit Aktivitätsname.
- Grenzen: Kalorien sind Schätzungen; Höhe aus GPS ist ungenau (Barometer nicht genutzt). Gerätetest (GPS, Hintergrund, Live-Aktivität) nur auf dem iPhone möglich.

### Version 62 / iOS-App 1.5: Laufen — 25.10.2026

- Auf Selvirs Wunsch (Vorbild Strava/adidas Running, iOS-Änderungen ausdrücklich erlaubt): `js/running.js`, `js/run-map.js`, `css/running.css`, Leaflet 1.9.4 lokal in `js/vendor/`/`css/vendor/` (nur beim Öffnen einer Karte geladen). Läufe eintragen, Timer oder Lauf mit GPS, Live-Karte, Detailansicht (Karte, km-Zeiten, Ø Pace, Ø km/h), Bestzeiten 1/5/10/21 km, Wochenziel in km, Routenplaner über BRouter (kostenlos, Profil Wandern) mit gespeicherten Routen und „Mit dieser Route laufen“. Anzeige im Workout-Tab, Kalender, Fortschritt, Übersicht und Plus-Menü. Läufe halten Tages-/Wochenserie, 25 XP bei Bestleistung ab 1 km.
- Daten (alle optional, `validData()` geprüft, alte Sicherungen gültig): `state.runs[]` (`distanceKm`, `durationSeconds`, `note`, `source:'gps'`, `route` ≤ 300 Punkte, `splits`, `splitRest`), `state.activeRun`, `state.runSettings.weeklyGoalKm`, `state.runRoutes[]`. GPS-Rohpunkte nur lokal (`puls-run-track`, Gerätezuordnung `puls-run-device`), nicht synchronisiert; nur das startende Gerät misst.
- iOS 1.5: `RunTracker.swift` (Hintergrund-GPS, `UIBackgroundModes: location`), `RunActivityCoordinator.swift` + `RunActivityWidget.swift` (Live-Aktivität/Dynamic Island, animierte Zahlen, Mitteilung je km), Kennzeichen `runGps`/`runActivity`. Details in `docs/IOS-APP.md`.
- Kartenkacheln: OpenStreetMap mit CSS-Dunkelfilter; CARTO-Dunkelkacheln verlangen inzwischen einen Schlüssel.
- Prüfung: `tests/check-running.cjs` (Datenprüfung, XP, Serie, GPS-Filter, Splits, Strecke, Brücke), `node scripts/check.cjs` grün; Browser 390 × 844 mit simuliertem Standort (GPS-Lauf, Live-Karte, Detail, Planer mit echtem BRouter). Codex-Reviews in 4 Runden, 13 Befunde behoben (u. a. XSS über Lauf-ID, Datenverlust beim Abschluss, fremdes Gerät startet GPS, Rohpunkte nicht gelöscht, doppelte km-Mitteilung).
- Grenzen: Swift nur statisch geprüft, Kompilierung erst im CI; echtes GPS, Hintergrundbetrieb, Live-Aktivität und Mitteilungen nur auf dem iPhone prüfbar. Im Browser misst GPS nur bei offener App. OSM-Kacheln und BRouter brauchen Netz.

### Version 58–61: kleine Web-Korrekturen — live — 25.10.2026

- Koordinator-Auftrag von Claude Code, Basis `cf4725f`: drei kleine Korrekturen. `js/app-polish.js` berechnet den Kalorienüberschuss aus Tageswert/Ziel statt aus bereits übersetztem Text; dadurch bleibt `+X kcal` auch auf Englisch erhalten. `js/food-flow.js` verwirft alte Zutaten-Suchantworten schon bei der nächsten Eingabe und bindet verzögerte Suchen an den ursprünglichen Ergebnisbereich. Die Rezept-Löschbestätigung berücksichtigt Deutsch/Englisch.
- Neue `tests/check-small-polish.cjs`, im regulären Check eingebunden: beide Sprachen/Seiten, Überschuss/Rest/exaktes Ziel, Antworten während der Tipp-Pause, ersetzte Suchfenster, Löschabbruch und erhaltene Tagebucheinträge. Nach jeder der drei Korrekturen `node scripts/check.cjs` bestanden.
- Keine CSS-/Layout-, Datenmodell-, iOS- oder Backendänderung; kein Commit/Push. Version bleibt 57, Release-Versionierung übernimmt Claude. Nur synthetische VM-Fixtures; Browser-/390-px-/iPhone-Prüfung und integrierte Prüfung beim Koordinator offen.
- Runde 2, lokal auf Basis `0796122` (Version 58): zwei weitere kleine Korrekturen. Checkbox-Auswahlhaptik läuft erst beim hochgereichten `change`, damit die Satz-Haptik nicht vom vorherigen Klick gedrosselt wird (`js/haptics.js`). OCR übernimmt Kalorien mit Ungleichheitszeichen/negativem Vorzeichen nicht mehr als exakte positive Werte; Spaltenpositionen bleiben erhalten (`js/food-upgrade.js`). Beide Fehler zuerst mit roten Regressionen in `tests/check-small-polish.cjs` reproduziert; nach jeder Korrektur vollständiger Check bestanden. Keine Versionserhöhung, Veröffentlichung oder Backend-/iOS-Änderung; echte Gerätehaptik/Kamera und Browserlayout nicht geprüft.

- Runde 3, lokal auf Basis `319a692` (Version 59): zwei kleine Korrekturen. Der Workout-Abschlussdialog zählt Sätze und warnt vor offenen Sätzen anhand der exakt übergebenen Workout-ID statt einer Teiltextsuche im Formular-Handler (`js/workout-controls.js`); überlappende IDs aus Sicherungen liefern dadurch keine fremde Übersicht. Ein im Hintergrund vorgemerkter Pausenhinweis erscheint nach Zustandswechsel nur noch, wenn sein ursprüngliches Workout weiterhin vorhanden ist (`js/rest-popup.js`). Beide Fehler zuerst mit roten Regressionen in `tests/check-small-polish.cjs` reproduziert; DE/EN-Abschlusswarnungen sowie unverändertes/entferntes/ersetztes/beendetes Workout und neu gestartete Pause geprüft. Vollständiger Check nach jeder Korrektur bestanden. Keine Versionserhöhung, Veröffentlichung, Datenmodell-, Backend- oder iOS-Änderung; Browser-/Geräteprüfung offen.

- Runde 4 (letzte), lokal auf Basis `58ebda7` (Version 60): eine kleine Produktkorrektur in `js/products.js`. Nährwertfelder mit ausschließlich Leerraum bleiben unbekannt (`null`), statt durch `Number()` als bekannte Null zu erscheinen. Rote Regression in `tests/check-small-polish.cjs` zuerst reproduziert; nach Korrektur vollständiger Check bestanden. Prüft Leerzeichen/Tab/Zeilenumbruch/geschütztes Leerzeichen, echte Nullwerte/Zahlen und den bestehenden kJ-Fallback. Keine Versionserhöhung, Veröffentlichung, Datenmodell-, Backend- oder iOS-Änderung. Nur VM-Fixtures; reale Barcode-/Kameraprüfung nicht durchgeführt. Wegen knappem Kontingent bei diesem vollständig geprüften Befund abgeschlossen.

### Profil-/Planformular — Schritt 1 Logik, lokal — 24.10.2026

- Koordinator-Auftrag auf Basis `98cadad` (Version 42): ausschließlich Profil-/Planlogik in `enhancements.js`, `experience.js`, `adaptation.js`; Layout und Entfernen von Erklärungstexten folgen bei Claude. Keine Veröffentlichung, Versions-/Asset-/SW- oder iOS-Änderung.
- Review-Nacharbeit nach Koordinatorentscheidung: Persönliches männliches Profil bleibt verbindlich; Laden und Formular normalisieren wie zuvor `sex` auf `male` und `special` auf `false`. `validData()` akzeptiert alte Sicherungen unverändert. Zusätzliche Profil-/Planfelder bleiben erhalten. Inaktive Makroparameter und Tempo blockieren keinen Moduswechsel; ungültiger inaktiver RMR erhält den bisherigen Messwert. Dezimalwerte aus gültigen Sicherungen werden nicht durch HTML-Schrittweiten blockiert.
- 4/4/9-Prüfung mit 50-kcal-Toleranz bei manuellen Kalorien und bei automatischen Kalorien mit selbst gesetzten Makros: nur bei Änderungen relevanter kcal-/Makrofelder oder Wechsel des Kalorien-/Makromodus. Unveränderte unstimmige Altziele blockieren andere Profiländerungen nicht; keine automatische Umrechnung. Vorschau und Speichern verwenden dieselbe Validierung, auch bei teilweise ausgefülltem Profil im manuellen Modus. Automatische Gewichtsanpassungen erhalten selbst gesetzte Makros weiterhin.
- Vorschau/Prognose verwenden den aktuellen Lern-Schalter; geänderte Formelgrundlagen verwerfen Kalibrierung vor dem Neuberechnen. Abgewiesenes Speichern löst keine nachträgliche Kalibrierung aus. Adaptive Ziele prüfen Ausschlüsse, endliche Werte und Grenzen. Extremes Abnehmtempo erzeugt bei zu niedrigem Erhalt keinen Überschuss; bei Wechsel auf Zunehmen gilt das bisher rechnerisch verwendete hohe Tempo auch sichtbar.
- Unverändertes vorbelegtes Gewicht erzeugt keine heutige Messung. Explizite Änderungen behalten vorhandene Messungs-IDs; direkte Zieländerungen werden wie adaptive Änderungen tagesweise in `goalHistory` erfasst. Neue Regressionen: `tests/check-profile-planning.cjs`, im regulären Prüflauf eingetragen. Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden.
- Grenzen/Integration: Kern vom unabhängigen Claude-Prüfer bestätigt; dessen vier Nacharbeiten sind umgesetzt, Nachprüfung und Browser-/iPhone-Prüfung beim Koordinator offen. VM-Tests belegen kein Layout oder Live-RLS. Claudes neue `profile-refresh.js`/`.css` wurden bei der Logik-Nacharbeit nicht verändert; bestehende IDs/Container bleiben Schnittstelle. Konto → Deine Daten bietet JSON-Export und CSV direkt; Wiederherstellen liegt weiterhin im Sicherungs-Tab (zuvor „Daten & Methoden“). Versteckte `pr-sex`/`pr-special` bleiben als kompatible Formularschnittstelle erhalten.

### Version 43 — Profil & Ziele — veröffentlicht 24.10.2026

- Oberfläche (Claude): `profile-refresh.js`/`.css`, alle Designs. Abschnitte 01 Körper, 02 Ziel, 03 Makros, 04 Automatik, 05 Ergebnis; Erklär- und Annahmetexte ausgeblendet; Selects `pl-mode`, `pl-direction`, `pl-pace`, `pl-macros`, `pr-method` als Schalter (Selects bleiben versteckt die Quelle); im Modus irrelevante Felder ausgeblendet; Speichern und `#plan-error` fest unten; Tab „Daten & Methoden“ heißt „Sicherung“ (nur Export, Wiederherstellen, CSV). EN-Übersetzungen und `aria-label` nach Codex-Review ergänzt.
- Logik (Codex, Einträge unten): 9 Fehler behoben, danach 4 Review-Punkte des Claude-Prüfers: männliches Profil wieder normalisiert (Koordinator-Entscheidung gemäß früherer Produktentscheidung), 4/4/9-Prüfung auch bei berechneten kcal mit selbst gesetzten Makros und nur bei geänderten Zielfeldern, Vorschau und Speichern identisch validiert.
- Reviews: Codex prüfte die Oberfläche (2 Befunde behoben), Claude-Prüfer die Logik (Gemini im Kontingent-Limit bis ca. 31.10.2026). Browser 390 × 844: Selbst/Berechnet, Halten, Teilprofil, 4/4/9, Speichern und Wiederöffnen, Sicherungs-Tab, Englisch. Grenzen: kein echtes iPhone, kein VoiceOver-Gerätetest.

### Version 42 — Wischseiten mit Abstand — veröffentlicht 24.10.2026

- Selvirs Wunsch: Beim Wischen von Energie & Makros zu Mikronährstoffen lagen die Inhalte zu dicht. Übersicht und Essen (Original): .nutritiontrack reicht per margin-inline:-16px bis an den Rand, Seiten haben 16 px Innenabstand → Inhalt bündig, 32 px Luft zwischen den Seiten; Seitenbreite = Bandbreite, daher Punkte/setNutrientSlide() unverändert. Browser: Einrasten, Punkte, kein Überlauf auf beiden Seiten geprüft.

### Version 41 — Essen im Originaldesign — veröffentlicht 24.10.2026

- Letzter Abschnitt aus docs/DESIGN-WORKPLAN.md (Claude): neue food-refresh.css, nur body[data-current-page=food][data-app-design=classic]. Offene Abschnitte 01–05 (Energie & Makros, Dein Essen, Vorschläge, Nährstoffwerte, Erfassung abschließen) mit Trennlinien statt Karten, Hauptaktion breit und zwei Nebenaktionen, Wasser als schlanke Zeile, Tagebuch als Zeilen mit deckendem Hintergrund (Wischen zum Löschen unverändert), kurze Animationen, reduzierte Bewegung. Kein JS/HTML/Datenmodell geändert.
- Review Codex: 2 Befunde behoben (Wasserknopf 44 px gegen comfort.css-!important; Innenabstand 04/05 gegen compact.css-Spezifität). Browser 390 × 844 und 320 px ohne Überlauf, Wischen-Löschen geprüft. Grenzen: kein echtes iPhone, andere Designs bewusst unverändert.

### Version 40 — veröffentlicht 24.10.2026 (erster Teamauftrag Claude + Codex + Gemini)

- Laufendes Workout (Claude): `session-focus.css`/`session-focus.js`. Pausentimer klebt in allen 11 Designs direkt unter der Session-Kopfzeile; deren echte Höhe (Safe Area/Dynamic Island) wird als `--session-head-h` gemessen. Vorher lag `top:80px` auf dem iPhone hinter der ~128 px hohen Kopfzeile, im Original-Design zudem halbtransparent. Satzzeilen ohne Trennlinien mit 8 px Abstand; Abhak-Box sichtbar 24 px in 44 × 44 px Tippfläche, helles Häkchen bei dunklen Akzenten (apple, mono, terra, blueprint).
- Erststart optional + Tutorial entfernt (Codex, Einträge unten). Landkarte vorab von Gemini.
- Reviews: Codex prüfte `native-bridge.js` (2 Befunde behoben: geänderte Satzangaben während der Pause, Cloud-Abgleich setzte Fortschritt zurück); Gemini prüfte Claudes Session-Änderungen (2 Befunde behoben: Häkchen-Kontrast, 44-px-Spalte); Claude und Gemini prüften Codex' Erststart/Tutorial (keine Befunde).
- Prüfung: `node scripts/check.cjs`, Bridge-VM-Simulation, Browser 390 × 844 mit `?erststart=1` (leerer Erststart bis Übersicht, Konto ohne NaN/Tutorial, Session in allen Designs mit simulierter 59-px-Safe-Area). Grenzen: kein echtes iPhone vor Veröffentlichung, kein Live-Sync-Test.

### Optionaler Erststart und Tutorial entfernt — Teil von Version 40

- Koordinator-Auftrag auf Basis `2e5f450`: Name und alle Planungsangaben beim Erststart optional; Abschluss über `onboardingComplete`/`setupPending`, unabhängig vom Namen. Unvollständige oder nicht automatisch planbare Eingaben speichern kein Teilprofil und verändern keine bestehenden Ziele. Vollständige geeignete Angaben nutzen die bisherigen Profil-, Plan-, Historien- und Startgewichtswege. Kontobearbeitung behält ihre Validierung. Avatar und Kontoname berücksichtigen Leerzeichen.
- Tutorial samt automatischem Start, Konto-Menü, Wrappern, Übersetzungen und CSS entfernt. `tutorialVersion` undefined/0/1 bleibt importierbar. Erfolgreicher Backup-Import bestimmt den lokalen Onboarding-Ablauf neu; fertige Backups bleiben nicht in der Erststart-Schleife hängen.
- `node scripts/check.cjs` einschließlich neuer `tests/check-onboarding.cjs` bestanden: leerer Erststart, nur Name, vollständige/unvollständige/ungültige Profile, Neustart, unveränderte Ziele, bisherige Kontovalidierung, alte Flags und Backup-Import. Bestehende Cloud-/Konflikttests ebenfalls bestanden. VM-Tests sind kein Layout- oder Live-RLS-Nachweis.
- Keine Veröffentlichung, Backend- oder iOS-Änderung. Versions-/Asset-/SW-Anpassungen und unabhängiges Review übernimmt Claude als Koordinator. Browser hier nicht verfügbar (`Browser is not available: iab`); Prüfung bei 390 × 844, Interaktionen und Designs bleibt beim Koordinator offen. Seine bestehenden Änderungen an Session-Fokus, Native Bridge, Einstieg und Service Worker bleiben unberührt.

### Pausen-Mitteilung und Dynamic Island — Web 39 / iOS-App 1.1 — 24.10.2026

- Selvirs Wunsch: Bei Pausenende außerhalb der App benachrichtigt werden, Countdown in der Dynamic Island (iPhone 16 Pro Max). Neue `native-bridge.js` (nur in der iOS-Hülle aktiv, im Browser wirkungslos) meldet die erste ablaufende Pause unbeendeter Workouts; `ios/PULS/RestCoordinator.swift` plant die Mitteilung und steuert die Live-Aktivität, `ios/PULSWidgets/` zeichnet Dynamic Island und Sperrbildschirm. Keine Änderung an Timer-Logik, Datenmodell oder `validData()`.
- Prüfung: `node scripts/check.cjs` grün; VM-Simulation der Brücke (Start, +30 s, neuer Satz, Übungswechsel, Superset, zwei Workouts, Reload nach Pausenende, Workout-Ende, Browser ohne Handler). Review durch Claude-Prüfer (Codex im Nutzungslimit); alle sieben Befunde behoben.
- Grenzen: Swift nur durch CI kompiliert, nicht auf Gerät getestet. Ob AltStore mit kostenloser Apple-ID die Widget-Erweiterung behält, ist ungeprüft; ohne sie gibt es nur die Mitteilung.

### Native iOS-Hülle — 24.10.2026

- Auf Selvirs Wunsch (echte iOS-App per AltStore auf iPad/iPhone): `ios/` enthält eine Swift-`WKWebView`-Hülle um die Live-Web-App; `.github/workflows/ios-app.yml` baut auf macOS eine unsignierte `PULS.ipa` und veröffentlicht sie als GitHub-Release (`/releases/latest/download/PULS.ipa`). Anleitung und Grenzen: `docs/IOS-APP.md`.
- Keine Änderung an Web-App-Dateien oder App-Version (bleibt 38). Erster CI-Build erfolgreich, IPA enthält App, Info.plist und Icons.
- Grenzen: nur kompiliert, noch nicht auf echtem Gerät installiert/getestet. App-Speicher ist getrennt von Safari; Daten kommen über Konto-Sync.

### Trainings-Vorschau 38 — 24.10.2026

- Nach Bestätigung der Übersicht beauftragt. Neue `training-refresh.css` gestaltet ausschließlich Training im Originaldesign sowie Original-Vollbildsessions unabhängig vom Hintergrundtab. Vier unterstrichene Reiter, offene Routinen-/Kalender-/Fortschrittsabschnitte, klare Typografie, flache Ergebnisgitter. Kurze Übergangs-/Satzanimationen; bestehende Feieranimationen und Reduced Motion erhalten.
- Keine neue JS-Logik, Timer-/Daten-/ID-/Handleränderung oder Backendänderung. Satzfelder/Checkboxen 44 px; fünfspaltiges Raster mit schmaler Variante. Modals und Sortierghosts unverändert.
- Version 38 lokal konsistent in Anzeige, Package, Asset-Queries und SW-Cache; Stylesheet zuletzt und als Offline-Asset ergänzt. Am 24.10.2026 zusammen mit 36 und 37 als Commit `0c62ef6` veröffentlicht; GitHub Pages liefert 38 aus.
- Prüfung: `node scripts/check.cjs`, Integrationsprüfung und `git diff --check` bestanden. Unabhängiges Review ohne offene belegte Befunde; letzte Select-Farbkorrektur nachgeprüft.
- Browser mit isolierten Testdaten: alle vier Tabs, leere Ansicht und Routine mit langem Namen/zwei Übungen, Start, 50 kg × 8 eintragen/abhaken, automatischer Pausenstart und +30 s, Positionswechsel mit erhaltenen Satzwerten, Minimieren und Fortsetzen aus Übersicht, Abschluss mit unerledigter Übung einschließlich Zurück sowie alle drei Abschlussansichten. Kalender zeigt Testtraining; Fortschritt 400 kg Volumen/8 Reps und Zeitraumfilter geprüft. Hauptprüfung 390 × 844; Session zusätzlich bei 320 px ohne horizontalen Überlauf. Sichtbare Satzfelder und Checkboxen 44 px bestätigt.
- Grenzen: kein reales iPhone/Safari, kein echter Touch-Drag-/Safe-Area-/Hintergrundtimer-Test, kein Offline-SW- oder Live-Sync-Lauf. Positionswechsel per Auswahlfeld geprüft; vorhandene Drag-Logik nicht verändert. Reduced Motion implementiert/im Code geprüft, nicht mit aktivierter Betriebssystemoption getestet. Andere Designs vom neuen CSS ausgeschlossen, nicht erneut vollständig geprüft.
- Selvir hat Version 38 veröffentlichen lassen und auf dem iPhone bestätigt. Essen folgt erst nach weiterem konkretem Auftrag.

### Übersichts-Vorschau 37 — 24.10.2026

- Nach positiver Beurteilung des Kontos von Selvir beauftragt. `overview-refresh.css` gestaltet ausschließlich `home` im Originaldesign: offene Abschnitte, Nummern 01–04, klare Typografie/Trennlinien, kompakte Aktionsknöpfe, kurze Eintritts-/Kreis-/Balkenanimationen und Reduced Motion. Bestehendes HTML, Handler und Berechnungen unverändert; kein neues JavaScript, kein Backend oder Datenmodell.
- Letztes Stylesheet in `index.html`, Offline-Asset in `sw.js` ergänzt. Lokale Anzeige, Asset-Queries, Package und Cache konsistent Version 37. Keine Veröffentlichung und kein Release-Commit; veröffentlichter Stand weiterhin 35.
- Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden; unabhängiges Review ohne offene belegte Befunde. In der Browserprüfung gefundene CSS-Spezifitätskonflikte bei Nummerierung/Innenabständen korrigiert und unabhängig nachgeprüft.
- Browser bei 390 × 844 mit isolierter Erststart-Vorschau: leere und gefüllte Bilanz, Mikro-Wechsel bei unverändert 220 px Pane-Höhe, Essen erfassen und Vorschau, Routine erstellen mit langem Namen, starten/minimieren/fortsetzen, leeres Testworkout verwerfen, Zeitraum/Kurvenfilter und Vortag/Heute geprüft. Kein horizontaler Überlauf; geprüfte Aktionsknöpfe mindestens 44 px hoch. Testdaten ausschließlich im Speicher der Vorschau.
- Grenzen: kein reales iPhone/Safari oder Offline-SW-Lauf; reduzierte Bewegung im Code geprüft, nicht per Betriebssystemoption aktiviert. Andere neun Designs vom neuen CSS ausgeschlossen, nicht erneut vollständig im Browser geprüft. Bestehende Mock-Tests sind kein Layout- oder Live-Sync-Nachweis.
- Selvir hat die Übersicht bestätigt und Training als nächsten Abschnitt beauftragt. Essen bleibt als späterer Abschnitt geplant.

### Konto-Vorschau 36 — 24.10.2026

- Bestätigter Plan in `docs/DESIGN-WORKPLAN.md`; persönliche iPhone-Nutzung ersetzt einen geplanten Ausbau für Freunde.
- Lokal umgesetzt in `account-refresh.js` und `account-refresh.css`: kompakte Identität, Ziel und Gewicht/Wochenmittel; Menüzeilen zu vorhandenen Detailbereichen, Zurück mit Fokus/Scrollposition, kurze Animationen und Reduced-Motion-Regeln. Keine neuen persistierten Datenfelder oder Backendänderungen.
- Originaldesign zuerst verfeinert; alle zehn Designs behalten dieselben Kontoabläufe. Bestehende Formulare, Sicherungen und Kontoverwaltung bleiben erreichbar. Tutorial an Unterseiten angepasst.
- Lokale Versionsvorbereitung 36: Anzeige, Asset-Queries, package.json und SW-Cache samt neuen Offline-Dateien. Noch nicht veröffentlicht und kein Release-Commit; live bleibt der zuvor veröffentlichte Stand 35.
- Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden. Unabhängiges Review ohne offene belegte Funktionsbefunde nach Korrektur der Wochenbeschriftung; Mittelwert, Leerwerte und Ausschluss zukünftiger Gewichte zusätzlich mit lokalen Fixtures geprüft.
- Echte Browserprüfung bei 390 × 844 mit `?erststart=1` und künstlichem Profil: alle neun in der Vorschau verfügbaren Menübereiche, Planformular, Gewicht speichern/Aktualisierung, Zurück-Fokus, Designwechsel über alle zehn Varianten ohne horizontalen Überlauf, Sprachwechsel DE/EN und Tutorialdurchlauf. Gefundene globale CSS-Konflikte korrigiert. Keine Konsolenfehler im geprüften Ablauf.
- Grenzen: VM-Suite deckt die neue DOM-Navigation nicht vollständig ab. Kein reales iPhone/Safari, keine echte Supabase-Anmeldung/RLS und kein Offline-SW-Lauf geprüft; Sync ist in der Erststart-Vorschau absichtlich ausgeblendet. Reduced Motion implementiert und im Code geprüft, nicht mit aktivierter Betriebssystemoption getestet.
- Selvir hat die Konto-Vorschau positiv beurteilt und anschließend die Übersicht beauftragt. Veröffentlichung weiterhin offen.

Hier knapp ergänzen: Auftrag, geänderte Bereiche, Ergebnis der Prüfungen, Integrations-/Release-Commit, noch offene Befunde. Historische Release-Dokumente nicht als aktuellen Arbeitsauftrag fortschreiben. Private Daten gehören nicht in diese Datei.
