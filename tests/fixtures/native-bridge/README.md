# Fixtures Zustandsbrücke

Synthetische, anonyme Testdaten für [docs/native/NATIVE-BRIDGE-PROTOCOL.md](../../../docs/native/NATIVE-BRIDGE-PROTOCOL.md). Genutzt von `tests/check-native-state.cjs` (Web) und `ios/PULSCoreTests` (Swift). Keine echten Daten. Nur der Koordinator ändert sie.

- `profile-full.json`: alle bekannten Feldarten, ms-Zeitstempel, leere Satzwerte `""`, `null`, unbekannte `x…`-Felder auf mehreren Ebenen (müssen verlustfrei erhalten bleiben).
- `hello`, `snapshot`, `ack-*`, `open-native`, `navigate`: Web → Native.
- `apply-*`: Native → Web. Session-Nutzer der Fixtures: `a0000000-0000-4000-8000-0000000000aa`. Der Upsert erwartet über `args.expect` die Tages-ID vom 26.10.2026 aus `snapshot.json` und `profile-full.json`.
- `invalid-*`: erwartete Ablehnung (`invalid`, `wrong_user`, `unknown_op`, `conflict`; `invalid-weight-conflict` erwartet eine überholte Tages-ID; `invalid-message-no-type` wird nativ ignoriert).
