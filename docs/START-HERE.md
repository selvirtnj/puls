# PULS — hier weiterarbeiten

**Hauptchat:** Claude Code im PULS-Ordner („PULS · Hauptchat“). Claude koordiniert Codex, Gemini und die Claude-Agenten selbst; einfach den nächsten Wunsch schreiben.

Wer direkt in Codex arbeitet, öffnet diesen Ordner als Projekt und schreibt:

> Weiter mit PULS. Lies AGENTS.md, docs/PROJECT-CONTEXT.md und docs/CURRENT-STATE.md. Du bist mein Hauptansprechpartner und koordinierst Frontend, Backend und unabhängige Prüfung. Mein nächster Wunsch ist: …

## Was vorbereitet ist

- Git-Klon des veröffentlichten PULS-Repositories; Push auf `main` geht live.
- `AGENTS.md` mit Produkt-, Qualitäts-, Daten- und Veröffentlichungsregeln.
- Rollen Frontend, Backend und Prüfer in `.codex/agents/` (gemeinsame Quelle für Claude, Codex und Gemini).
- Brücken `scripts/codex-bridge.ps1` und `scripts/gemini-bridge.ps1`, Aufteilung in `docs/AI-TEAM.md`.
- Automatisierte Tests plus Prüfung der Übergabedokumentation.

## Zum Nachlesen

- [Produkt und Entscheidungen](PROJECT-CONTEXT.md)
- [Aktueller Stand und nächste Schritte](CURRENT-STATE.md)
- [KI-Team: wer macht was](AI-TEAM.md)
- [Agenten und Arbeitsablauf](TEAM-WORKFLOW.md)
- [Backend-Übergabe](BACKEND-HANDOFF.md)
- [Projektstruktur](ARCHITECTURE.md)

Ein neuer Chat kennt frühere Gespräche nicht. Die Agenten lesen diese Dateien und halten sie nach relevanten Änderungen aktuell.
