# Gesamt-Audit — Fortschritt (zum Wiederaufnehmen)

Auftrag: Selvirs „Master Mission“ vom 26.10.2026 (Gesamt-Audit, Aufräumen, Tests, Reviews). Wortlaut liegt nicht im Repo; Kernregeln stehen unten.

## Kernregeln aus dem Auftrag
- Arbeit nur auf Branch `refactor/comprehensive-app-audit`. **Kein Push, kein Deploy, kein Merge auf `main`** ohne Selvirs ausdrückliche Zustimmung (der Auftrag geht hier der allgemeinen Veröffentlichungsfreigabe vor).
- Keine destruktiven Git-Befehle, keine History-Änderung. Baseline-Tag: `audit-baseline-v69` (= `7767078`).
- `CLAUDE.md` hat eine fremde, nicht committete Änderung (nur Zeilenende) — nicht committen, nicht verwerfen.
- Funktionen und Design erhalten; nur belegte Probleme beheben; keine neuen Abhängigkeiten ohne klaren Nutzen.
- Testergebnisse nie erfinden: PASS / FAIL / BLOCKED / NOT TESTED / STATICALLY VERIFIED ONLY.
- Codex ist unabhängiger Prüfer (über `scripts/codex-bridge.ps1`, lesend). Codex-Teilnahme nie simulieren.
- Arbeit über Subagenten (`puls-frontend`, `puls-backend`, `puls-reviewer`, Explore/general-purpose); höchstens zwei schreibende parallel, getrennte Dateien.
- `ios/` nicht ändern.
- Ergebnisberichte in `docs/audit/` (Inventar, Testmatrix, Qualitäts-, Aufräum-, Review-, Codex-, Abschlussbericht). Keine Screenshots/Logs ins Repo.

## Phasen
| # | Phase | Status |
|---|---|---|
| 0 | Git-Sicherung, Branch, Baseline-Tag | erledigt |
| 1 | Inventar Funktionen/Architektur (`docs/audit/FEATURE-INVENTORY.md`) | offen |
| 2 | Baseline: `node scripts/check.cjs`, Browser-Baseline 390×844 | offen |
| 3 | Testmatrix (`docs/audit/TEST-MATRIX.md`) | offen |
| 4 | UI/UX-Audit im Browser | offen |
| 5–7 | Aufräumen, Refactoring, Abhängigkeiten | offen |
| 8–9 | Sicherheit, Performance, Zuverlässigkeit | offen |
| 10 | Testinfrastruktur | offen |
| 11 | Codex-Review der Änderungen | offen |
| 12–14 | Git-Ordnung, README, Projektanweisungen | offen |
| 15 | Abschluss-Audit (adversarial, Codex) | offen |

## Laufende/abgeschlossene Aufträge
- 26.10. 03:41: Codex-Lese-Audit **nicht gelaufen** — Codex-Nutzungslimit bis 07:27 (CODEX_UNAVAILABLE). Nach 07:30 erneut starten (Auftrag: Architektur, toter Code, Sicherheit, Datenintegrität, Testlücken; Lese-Rolle `reviewer`, high), Ergebnis nach `docs/audit/codex-audit-1.md`.
- 26.10. 03:45: Ersatz Gemini **ebenfalls nicht verfügbar** — Kontingent erschöpft, Reset in ca. 135 h (~31.10.). Bis dahin keine Gemini-Aufträge.
- Folge: bis ca. 07:30 nur Claude-Subagenten (nach Claude-Reset 06:40); Codex ab 07:30 für das unabhängige Review.
- Claude-Spezialisten-Audits: nach Nutzungs-Reset (06:40) durch geplante Sitzung.

## Log
- 26.10. 03:40 Branch angelegt, Tag gesetzt. Claude-5-h-Limit bei 95 %, Wochenlimit 72 % → sparsam arbeiten.
