# PULS — offene Punkte, Grenzen und Refactor-Plan

Stand 13.11.2026. Audits vom 12.11. und 13.11.2026: Tests grün, keine kritischen Defekte. Dies ist eine Liste von Risiken und Grenzen, keine Fehlerliste im Live-Betrieb. Aktueller Stand: [PROGRESS.md](PROGRESS.md).

## Audit-Befunde (Code)

1. **Wrapper-Ketten:** `validData` (Phase 3) und `render` (Phase 4, Version 100) und `openModal` (Phase 4, Version 102) sind je eine Funktion in `js/app.js`, `accountPage` (Version 101) eine in `js/experience.js`, `workoutPage` (Version 103) eine in `js/flows.js`; sie rufen benannte Glieder der anderen Dateien in fester Reihenfolge auf. `nutrition` (Version 104) ist die eine Funktion in `js/food-diary.js`, `profileForm` (Version 104) eine in `js/enhancements.js`. Seit Version 106 sind auch `go` (Kern `goBase`, sechs Glieder `goBefore…`/`goAfterMotion`) und `home` (ruft `homeDesign()` aus `js/design-system.js`) je eine Funktion in `js/app.js`; 32 Hilfsfunktionen ohne Aufrufer sind gelöscht. Kein Skript umhüllt mehr eine der Seitenfunktionen. Gelöscht sind `baselineEnergyLine` (samt Wrapper und `.baselineenergy`-CSS), `qaQuickWater`, `runMovingStats`, `runRouteSvg`, die toten `.nutritionslide`-Abfragen in `js/app-polish.js`, die `.nutritiondeck`/`.nutritionslide`-CSS-Regeln und die alte `removeEntry`-Definition (in `js/app.js` nur noch `let removeEntry;`, überschrieben in `js/finish.js`). Bewusst erhalten bleibt der `weightPage`-Wrapper (`js/enhancements.js`), er steuert die Zielkarte. Grenze der Ketten-Tests (`check-accountpage-order`, `check-workoutpage-order`): Der DOM-Stub in Node liefert bei Selektoren nichts, DOM-Umbauten der Glieder (Laufkarte, Kalender-Links) sind dort nicht belegt, nur im einmaligen Browser-Vergleich; Hotspot ist `js/flows.js`. Die Ladereihenfolge in `index.html` ist dabei Teil der Logik.
2. **Fehlende Tests:** Kein Test prüft alle gespeicherten `state`-Schlüssel gegen `validData`. Kein Migrationstest über mehrere Versionen mit alten Sicherungen.
3. **Anzeigeversion:** erledigt (Refactor Phase 1). Eine Konstante `APP_VERSION` in `js/account-refresh.js`; `scripts/bump-version.cjs` zieht sie mit.
4. **native-*.js:** erledigt (Version 106). Die sieben untätigen Zustandsdateien (`native-state`, `-projection`, `-training`, `-progress`, `-activity`, `-nutrition`, `-account`), `css/native-shell.css` und ihre Tests sind gelöscht; sie brachen ohne `pulsState`/`stateBridge` in der ersten Anweisung ab, und die iOS-Hülle bietet beides nicht an. Aktiv bleiben `native-bridge.js` und `native-extras.js`. Der alte Stand liegt in der Git-Historie (bis Commit `5b1e0a1`) und unter Tag `native-swiftui-archiv`.
5. **Lesbarkeit:** Stark minifizierter Code in sehr langen Zeilen erschwert Diffs und Reviews.

## Audit vom 13.11.2026 (ganzes Repository, nur Bericht)

Kein Befund der Stufe „muss“. Die Punkte 1 und 3 sind seit Version 107 behoben, 2, 4 bis 7, 10 und 12 bis 14 seit Version 108. 11 und 15 seit Version 109. 8 und 9 bleiben bewusst so.

Sollte:

1. ✓ behoben in Version 107. **Falscher Sync-Konflikt nach verlorener Antwort** (`js/cloud.js:11`, `:19`): Kommt der Upload an, die Antwort aber nicht (Funkloch, 15-s-Timeout), bleibt `cloudRevision` alt und der nächste Versuch meldet einen Konflikt, obwohl beide Stände gleich sind. Lösung: im Konfliktzweig den Serverstand holen und bei gleichen Nutzdaten nur die Revision übernehmen; Test fehlt.
2. ✓ behoben (nach Version 109, noch nicht veröffentlicht). **Anmeldung ersetzt lokale Daten ohne Rückfrage** (`js/cloud.js`, `activateCloudSession`): Hat das Gerät eigene Daten (Essen, Gewicht oder Training) und das Konto einen davon abweichenden Stand, fragt ein Bottom Sheet „Konto laden?“ vor dem Ersetzen. „Konto laden“ verhält sich wie bisher (Gerätestand wird nach `puls-cloud-local-before-login` gesichert, Hinweis nach dem Laden). „Abbrechen“ oder Schließen des Dialogs meldet über `signOutCloud` ab; Gerätestand, vorherige Sicherung und Serverstand bleiben, es gibt keinen Upload. Keine Rückfrage bei leerem Gerät, gleichen Ständen, Wiederanmeldung mit gespeicherter Sitzung, Sync und Konfliktauswahl. Ein Weg „Gerät überschreibt Konto“ ist bewusst nicht gebaut. Offen: Das Konto zählt als abweichend, sobald sich die Daten im Vergleich nach Schlüsselreihenfolge unterscheiden, auch wenn nur ein älterer App-Stand fehlende neue Felder hat; die Rückfrage ist dann überflüssig, aber harmlos.
3. ✓ behoben in Version 107. **Ungültiger Barcode aus der Open-Food-Facts-Suche** (`js/food-flow.js:104`, `js/food-search.js:7`, `js/products.js:53`): Der Code eines Suchtreffers wird ungeprüft gespeichert; `validData` lehnt den Stand danach ab, Sync, Export und Import scheitern. Lösung: Treffer mit `validBarcode` filtern oder den Code weglassen.
4. ✓ behoben in Version 108 (`scripts/check.cjs` prüft `ASSETS`, Fehlerantworten fallen auf den Cache zurück). **Service Worker:** `scripts/check.cjs` prüft die `ASSETS`-Liste in `sw.js` nicht gegen vorhandene Dateien; ein falscher Eintrag lässt die Offline-Installation still scheitern. `.js`/`.css` mit Fehlerantwort fallen nicht auf den Cache zurück (`sw.js:67`).
5. ✓ behoben in Version 108 (`isAppPath`, Pfadprüfung auch bei Nachrichten und `sendRunGps`); GitHub-Build „iOS app“ grün, Gerät ungeprüft, wirkt erst mit dem nächsten installierten App-Build. **iOS-Hülle** (`ios/PULS/WebViewController.swift:68`, `:97`, `:196`): Pfadprüfung `hasPrefix("/puls")` lässt auch `/pulsX/` zu; Nachrichten und `sendRunGps` werden nur nach Host geprüft. Geringes Risiko, weil der Host GitHub Pages des eigenen Kontos ist.
6. ✓ behoben in Version 108. **Tests außerhalb des Sammellaufs:** `check-shell-extras.cjs`, `check-premium.cjs` und `check-regional-foods.cjs` laufen einzeln grün, stehen aber nicht in `scripts/check.cjs`.

Kann:

7. ✓ behoben in Version 108: Ein Stand ohne Grundgerüst (`goals`, `foods`, `weights`, `workouts`, `custom`) gilt als beschädigt, wird nach `puls-v1-corrupt` gesichert und sperrt den Upload. Der beim Start geladene Stand wird nicht mit `validCore` geprüft (`js/app.js:40`); ein kaputter Speicherstand wie `{"version":2}` lässt den Start abbrechen.
8. Offen, bewusst: Nur ein Platz für Konfliktsicherungen (`js/cloud.js:26`); der zweite Konflikt überschreibt den ersten. Die Sicherung ist im Konto herunterladbar; mehrere Plätze würden den Gerätespeicher (bis 4 MB je Stand) schnell füllen.
9. Kein Fehler: Größenlimit Client 4.000.000 Zeichen, Datenbank 5.000.000 (`backend/accounts.sql:6`). Der Client ist absichtlich strenger, damit ein Upload nie am Server scheitert.
10. ✓ behoben in Version 108 (einmal nach Tag gruppiert). `trendData()` rechnet quadratisch über die Tage (`js/experience.js:17`); bei mehreren Jahren Daten spürbar.
11. ✓ behoben in Version 109 (e1RM zählt jetzt 1–12, Selvirs Entscheidung). e1RM zählt Sätze mit 1–10 Wiederholungen (`js/enhancements.js:76`), der Rang 1–12 (`js/strength-ranks.js:169`). Produktfrage.
12. ✓ behoben in Version 108 (einmaliger Hinweis). Der Lauf-Spurspeicher schluckt Speicherfehler stumm (`js/running.js:95`, `:131`).
13. ✓ behoben in Version 108 (Stichtag aus lokalen Datumsteilen). `js/experience.js:17` mischt lokale Zeit und UTC; um Mitternacht kann ein Tag verrutschen.
14. ✓ behoben in Version 108: `tests/check-trends-fasting.cjs`.
15. ✓ behoben in Version 109 (nur Messungen bis heute, tote Regel gelöscht). Beim Schreiben der Tests gefunden: `weeklyWeights` (`js/flows.js:60`) zählt auch Gewichte mit künftigem Datum ins Wochenmittel des Verlaufs; der Test hält das fest. Die Montagsregel in `js/flows.js:81` ist tot, weil Zeile 88 das Feld überschreibt.

Ohne Befund: HTML-Ausgabe (`esc`, ID-Prüfung), RLS-SQL, `account-delete`, Edge Function `food-photo`, Freunde-SQL, Import, Geheimnisse im Repository, Einheitenlogik. Nicht gelesen: `js/i18n.js`, Leaflet, CSS, `catalog/`; große Dateien nur punktuell.

## Grenzen der Prüfung

- Dynamic Type: Die Web-App setzt Schriftgrößen in px; die iOS-Hülle (WKWebView) übernimmt die Textgröße aus den iPhone-Einstellungen daher nicht. Umstellung auf skalierbare Größen wäre ein eigener, großer CSS-Umbau (HIG-Durchsicht 14.11.2026).

- Sync-Tests laufen nur gegen Mocks. Echte RLS-Isolation zwischen zwei Konten ist ungeprüft; SQL-Dateien belegen keine aktuelle Live-Einrichtung (Live bestätigt nur wie in [archive/CURRENT-STATE-bis-v95.md](archive/CURRENT-STATE-bis-v95.md) berichtet: `food-photo.sql`, `friends.sql`, `friends-strength-v2.sql`).
- Echtes iPhone-Layout, Touch-Wischen, Kamera, Klang, Haptik, Service Worker auf dem Gerät und AltStore-Probe sind ungeprüft. VM-Tests prüfen kein echtes Layout.
- Browserprüfung bei 390 × 844 in Hell/Dunkel wurde mehrfach durch fehlenden Browserhost blockiert; bei jeder UI-Änderung nachholen.
- Freunde-Tab nur mit echten Konten prüfbar; KI-Foto (Gemini) nur mit angemeldetem Konto; echter Lauf offen.
- Kein vollständiger XSS-Audit. Token liegen unverschlüsselt im Browser-Speicher.

## Bekannte Grenzen im Backend

- Das SQL gewährt `authenticated` direkte INSERT-/UPDATE-Rechte auf die eigene Profilzeile; ein eigener API-Client kann den revisionsgeprüften RPC-Weg umgehen. Die serverseitige Payload-Prüfung ist flach, die volle Prüfung läuft im Client.
- Geräteweite Backup-Schlüssel (`puls-cloud-conflict-backup`, `puls-cloud-local-before-login`): Benutzerwechsel auf geteilten Geräten gesondert testen.
- Freunde: Kennzahlen sind Eigenmeldungen, keine verifizierte Rangliste. Keine Hintergrundzustellung (kein APNs); Stups-Hinweise erst bei offener App. Blockieren nicht umgesetzt. Apps ≤ 92 zeigen Ränge der Version 93 bei Freunden falsch.
- Vor mehr Nutzern: SMTP/Auth-Mailversand, Redirects, Limits, Offline-Anmeldung, Konflikte und Backup-Wiederherstellung prüfen. E-Mail-Bestätigung nicht abschalten.

## Bekannte Grenzen in der Funktion (Version 95)

- Rezepte aggregieren die Zusatznährwerte aus den Zutaten (`ck`, `nx`, `nutrients` je Zutat, beim Hinzufügen gespeichert); der Rezept-Eintrag liest sie bei der Anzeige über `recipeId`. Ein Wert erscheint nur, wenn jede Zutat ihn kennt, sonst bleibt er unbekannt (Anzeige „n/m“). Alte Rezepte, per URL/Text importierte Zutaten ohne Katalogtreffer und eigene Zutatenwerte liefern weiter nur Makros. Wird das Rezept später so geändert, dass seine Makros je 100 g vom Eintrag abweichen, oder gelöscht, entfallen die Zusatzwerte dieses Eintrags (sichere Richtung). Das Rezept wird im Eintrag nicht eingefroren. Einträge, die mit weniger als 10 g erfasst und stark vergrößert wurden, verlieren die Katalogwerte (sichere Richtung).
- Bearbeitet ein Gerät mit Version ≤ 94 eine neue Kombi, entfallen dort `ck` und `nx`.
- Kein DGE-Referenzwert für Vitamin D, Zink, Kupfer, Mangan, Chrom und Molybdän.
- Das Vorladen des Katalogs holt zusätzlich 4,4 MB.
- Workout-Import: Zusatzfelder (RPE, Notizen, Distanz, Sekunden, Satztyp) bleiben erhalten, der Kraftsatz-Editor zeigt sie nicht an.
- Muskel-Erholungsfigur auf Nutzerwunsch zurückgestellt. Der Rest der älteren Grenzen steht im Archiv unter „Offene Grenzen und sinnvolle spätere Aufgaben“.

## Refactor-Plan

Regeln: Kein Framework, kein Build-Schritt. Verhalten und Ladereihenfolge bleiben gleich; jede Phase einzeln mit `node scripts/check.cjs` und Browser-Stichprobe, eigener Commit. Version 96 ist veröffentlicht; der Refactor kann beginnen.

| Phase | Inhalt |
|---|---|
| 0 ✓ | Tests für `validData` (alle gespeicherten Schlüssel, alte Sicherungen) und für die Wrapper-Reihenfolge. Grundlage für alles Weitere. Erledigt: `tests/check-validdata.cjs` (1.117 Fälle, alle Skripte in echter Ladereihenfolge) und `tests/check-wrapper-order.cjs` (Golden-Datei, bei gewollter Änderung `--update`). |
| 1 ✓ | Anzeigeversion als eine Konstante (statt `js/account-refresh.js:45`); `bump-version.cjs` anpassen. |
| 2 ✓ | Kleine CSS-Dateien in gleicher Reihenfolge zusammenführen (Kaskade unverändert). 30 Dateien stecken jetzt in `css/style.css`; im Browser belegt: 3.430 Regeln mit gleichem Hash vorher und nachher. |
| 3 ✓ | `validData`-Kette in eine Funktion zusammenführen. Erledigt in `js/app.js` (`validCore` plus Abschnitte in der alten Auswertungsreihenfolge); die Wiederherstellung beim Laden nutzt wie bisher nur die Kernprüfung. |
| 4 ✓ | Übrige Wrapper (`render`, `accountPage`, `openModal`, `workoutPage`, `nutrition`, `profileForm`) zusammengelegt (Versionen 100 bis 104); `home` und `go` in Version 106. |
| 5 | Erledigt (Version 105): Altlasten-Dateien heißen jetzt `puls-data.js`, `quick-account.*`, `ui-layer.css`; `index.html`, `sw.js`, Tests mitgezogen. |

Der Plan ist abgeschlossen. Die native-Zustandsdateien sind seit Version 106 entfernt (Befund 4).
