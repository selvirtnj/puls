# PULS — offene Punkte, Grenzen und Refactor-Plan

Stand 12.11.2026. Audit vom 12.11.2026: Tests grün, keine kritischen Defekte. Dies ist eine Liste von Risiken und Grenzen, keine Fehlerliste im Live-Betrieb. Aktueller Stand: [PROGRESS.md](PROGRESS.md).

## Audit-Befunde (Code)

1. **Wrapper-Ketten:** `validData` ist seit Refactor Phase 3 eine Funktion in `js/app.js`. Offen sind die Ketten `render` 25x, `accountPage` 20x, `openModal` 18x, `workoutPage` und `nutrition` je 14x, `profileForm` 10x; Hotspot ist `js/flows.js`. Die Ladereihenfolge in `index.html` ist dabei Teil der Logik.
2. **Fehlende Tests:** Kein Test prüft alle gespeicherten `state`-Schlüssel gegen `validData`. Kein Migrationstest über mehrere Versionen mit alten Sicherungen.
3. **Anzeigeversion:** erledigt (Refactor Phase 1). Eine Konstante `APP_VERSION` in `js/account-refresh.js`; `scripts/bump-version.cjs` zieht sie mit.
4. **native-*.js** (rund 3.400 Zeilen): geklärt am 13.11.2026. `native-state`, `-projection`, `-training`, `-progress`, `-activity`, `-nutrition` und `-account` brechen in der ersten Anweisung ab, wenn `webkit.messageHandlers.pulsState` oder das Merkmal `stateBridge` fehlt. Die iOS-Hülle (`ios/PULS/WebViewController.swift`) bietet beides nicht an; im Browser und in der App werden also keine Patches auf `render`, `openModal`, `home` oder `go` gesetzt. Die Dateien werden nur geladen und geparst. Aktiv sind `native-bridge.js` (über `pulsNative`) und `native-extras.js` (dessen `validData`-Wrapper gilt immer). Ob die sieben untätigen Dateien aus `index.html` entfernt werden, ist offen.
5. **Lesbarkeit:** Stark minifizierter Code in sehr langen Zeilen erschwert Diffs und Reviews.

## Grenzen der Prüfung

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

- Rezepte aggregieren die neuen Zusatznährwerte nicht. Einträge, die mit weniger als 10 g erfasst und stark vergrößert wurden, verlieren die Katalogwerte (sichere Richtung).
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
| 4 | Übrige Wrapper (`render`, `accountPage`, `openModal`, dann `workoutPage`, `nutrition`, `profileForm`) schrittweise zusammenlegen. |
| 5 | Altlasten-Dateinamen (`puls-data-v87.js`, `quick-account-v87.*`, `v90-ui.css`) umbenennen; `index.html`, `sw.js`, Tests mitziehen. |

Vorab-Frage für Phase 4 ist geklärt (Befund 4): Die native-Zustandsdateien sind ohne Brücke untätig und gehören nicht zu den wirksamen Wrapper-Ketten.
