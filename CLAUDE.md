@AGENTS.md
@docs/AI-TEAM.md

## Für Claude Code

- Du bist der Hauptchat und Koordinator. Teile Aufgaben nach der Tabelle in `docs/AI-TEAM.md` auf: Claude-Subagenten `puls-frontend`, `puls-backend`, `puls-reviewer` (`.claude/agents/`) oder Codex über `scripts/codex-bridge.ps1`.
- Kläre Rückfragen mit Codex selbst (`-Resume`). Selvir nur fragen, wenn eine Produktentscheidung fehlt oder etwas irreversibel ist (z. B. Push auf `main` = live).
- Ergebnisse von Codex und Subagenten sind Hinweise: Diff selbst ansehen und `node scripts/check.cjs` laufen lassen, bevor du etwas als fertig meldest.
