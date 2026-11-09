# Codex-Review 1 — Sync-Korrekturen

Echter Codex-Lauf über `scripts/codex-bridge.ps1 -Role reviewer -Effort high`, 26.10.2026 07:29, Thread `01a176e5-e6d8-79d2-a8d6-d00f7acf41a5`. Geprüft: `git diff d26f9f3 c90c8de`. Codex hat die Fälle mit lokalen Fixtures reproduziert; keine Dateien geändert. (Das frühere Codex-Lese-Audit `codex-audit-1` lief wegen Nutzungslimit nicht.)

## Befunde (Zusammenfassung des Codex-Berichts)
1. **P1 – Anmeldung überschreibt lokale Daten trotz fehlgeschlagener Sicherung** (js/cloud.js, `cloudStore('puls-cloud-local-before-login', …)` Rückgabewert ignoriert). Fix: bei fehlgeschlagener Sicherung vor Sitzungsaktivierung und Profilübernahme abbrechen, Export anbieten.
2. **P1 – Neustart umgeht die Upload-Sperre** (Sperre nur im Arbeitsspeicher; nach `save()` ist der Ersatzstand gültiges JSON, persistiertes `dirty=true` lädt beim Neustart hoch). Fix: Korruptionszustand dauerhaft markieren, nur nach ausdrücklicher Standwahl/Wiederherstellung aufheben.
3. **P2 – Gültiger Backup-Import hebt die Sperre nicht auf** (js/cloud.js, js/app.js Import). Fix: nach erfolgreichem Import Korruptionsgrund aufheben; echte Revisionskonflikte getrennt erhalten.
4. **P2 – Änderungen während der Abmeldung können verloren gehen** (zweite Pending-Sicherung nach Netzwerkaufruf ignoriert Speicherfehler). Fix: auch diese prüfen; bei Fehlschlag aktuellen Stand erhalten.
5. **P2 – Fehlgeschlagene Rohdaten-Sicherung bleibt ungeschützt** (js/app.js: scheitert `puls-v1-corrupt`, überschreibt das nächste Speichern die einzige Rohkopie; Meldung behauptet trotzdem Sicherung). Fix: Sicherungserfolg verfolgen, Rohwert erhalten.

## Ohne Befund laut Codex
- Keine falsche Korruptionsmarkierung für gültige Objekte, Teilprofile, `profile:null`.
- HTTP-Status 401/409/429/502 bleiben erhalten; RPC-Konflikt, Dirty-Zustand, Revision funktionieren.
- Keine spätere Überschreibung der geänderten Funktionen; Save-Kette `app → insights → cloud → native-bridge`.
- Tests prüfen echte Funktionen mit Mocks; Lücken: Neustart, fehlgeschlagenes Login-Backup, Import-Entsperrung, Änderungen während Logout.

## Übergreifende Risiken (Codex)
Globale Wrapper-Abhängigkeiten, geräteweite Backup-Schlüssel, Vollprofil-Synchronisierung, direkte Tabellen-Schreibwege neben dem CAS-RPC, fehlende echte Geräte-/Backend-Integrationstests.

## Umsetzung
Siehe `PROGRESS.md` (Log).
