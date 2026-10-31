# Fixtures Zustandsbrücke

Synthetische, anonyme Testdaten für [docs/native/NATIVE-BRIDGE-PROTOCOL.md](../../../docs/native/NATIVE-BRIDGE-PROTOCOL.md). Genutzt von `tests/check-native-state.cjs` (Web) und `ios/PULSCoreTests` (Swift). Keine echten Daten. Änderungen nur durch Koordinator oder ausdrücklich freigegebenes Paket (M3/H).

- `profile-full.json`: alle bekannten Feldarten, ms-Zeitstempel, leere Satzwerte `""`, `null`, unbekannte `x…`-Felder auf mehreren Ebenen (müssen verlustfrei erhalten bleiben).
- `hello`, `snapshot`, `ack-*`, `open-native`, `navigate`: Web → Native.
- `chrome`: neuer M3-Sperrstatus (`modal`, Essen); Native prüft zusätzlich `none|editing|session|run` nach Protokoll. Bei session/run native Tab-Leiste verbergen, alle nativen Datums-/Tabwechsel bei Sperre deaktivieren.
- `chrome-account`: Konto-Unterseite `plan`, ohne Sperre. `chrome.accountSection` und das gleichnamige Feld oben im `projection`-Envelope sind aktuelle Schlüssel oder `null` (Kontoübersicht/anderer Tab); Native lokalisiert daraus den Unterseitentitel. Die Standardfixtures `chrome` und `projection` enthalten explizit `accountSection:null`.
- `projection-input`: synthetisches vollständiges Profil (aus `profile-full`, bekannter Vitamin-C-Nullwert ergänzt), feste Uhr `2026-10-28T12:00:00Z` und gewählter Tag `2026-10-25`. Das Web testet mit dieser Uhr und Features `stateBridge` + **`nativeOverview`**; nach Laden folgt `pulsNativeSetDate(date)`. Chrome-Übernahme ist separat mit `pulsNativeSetChrome(true)` zu bestätigen, nicht Voraussetzung für diese Lesefixture.
- `projection`: exakte darauf folgende M3-Overview-Nachricht (`projectionSeq:2`, `seq:1`). Baseline-Ziele 2010/168/184/67; gegessen 415/19/59/9; 472 ml bekanntes Wasser; Eisen 3,4 mg, B12 unbekannt. Gewichts-/Trainingsstand folgt heute, Tagesbilanz dem gewählten Tag. Native muss den neuen Typ und die neuen Hello-Felder explizit im Decoder testen. Die bestehenden Snapshot-/Gewichtsfixtures bleiben unverändert.
- `apply-*`: Native → Web. Session-Nutzer der Fixtures: `a0000000-0000-4000-8000-0000000000aa`. Der Upsert erwartet über `args.expect` die Tages-ID vom 26.10.2026 aus `snapshot.json` und `profile-full.json`.
- `invalid-*`: erwartete Ablehnung (`invalid`, `wrong_user`, `unknown_op`, `conflict`; `invalid-weight-conflict` erwartet eine überholte Tages-ID; `invalid-message-no-type` wird nativ ignoriert).
