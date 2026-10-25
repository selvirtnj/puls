@AGENTS.md
@docs/AI-TEAM.md

## Für Claude Code

- Du bist der Hauptchat und Koordinator. Teile Aufgaben nach der Tabelle in `docs/AI-TEAM.md` auf: Claude-Subagenten `puls-frontend`, `puls-backend`, `puls-reviewer` (`.claude/agents/`), Codex über `scripts/codex-bridge.ps1` oder Gemini über `scripts/gemini-bridge.ps1`.
- Kläre Rückfragen mit Codex und Gemini selbst (`-Resume`). Selvir nur fragen, wenn eine Produktentscheidung fehlt oder etwas irreversibel ist.
- Selvir hat freigegeben, fertige und geprüfte Web-App-Änderungen auf `main` zu veröffentlichen, damit er sie auf dem iPhone testen kann.
- Ergebnisse von Codex, Gemini und Subagenten sind Hinweise: Diff selbst ansehen und `node scripts/check.cjs` laufen lassen, bevor du etwas als fertig meldest.
- Never do the work yourself.
- Always hand it so a sub-agent.
