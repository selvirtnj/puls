# PULS — Claude Code und Codex als ein Team

Selvir spricht nur mit **einem Hauptchat**: Claude Code im PULS-Ordner. Claude ist Koordinator, verteilt Aufgaben an sich selbst, an Claude-Subagenten oder an Codex, und gibt am Ende einen einzigen Bericht. Selvir muss nichts weiterleiten.

Wenn Selvir stattdessen direkt in Codex arbeitet, gilt dieselbe Aufteilung; Codex ist dann Koordinator und nutzt seine eigenen Rollen aus `.codex/agents/`.

## Wer macht was (Startregel, vom Koordinator anpassbar)

| Aufgabe | Umsetzung | Prüfung |
|---|---|---|
| UI, CSS, iPhone-Layout, Designs, Texte | Claude `puls-frontend` (Opus, medium) | Codex `reviewer` (gpt-6.1-sol, medium) |
| Auth, Sync, SQL, Datenmodell, Migration | Codex `backend` (gpt-6.1-sol, medium; high bei Sync/RLS/Migration) | Claude `puls-reviewer` (Opus, high) |
| Übergreifend (UI + Daten) | Codex zuerst Schnittstelle/Daten, dann Claude UI — nacheinander | jeweils der andere |
| Fehlersuche mit unklarer Ursache | beide lesend parallel, Koordinator entscheidet | — |
| Kleinigkeit (Text, eine Zeile, Doku) | Koordinator selbst, kein Agent | keine |
| Schnelle Frage zur Vorgeschichte | Codex `general` (gpt-6.1-sol, low) | — |

Grundsatz: **Wer schreibt, prüft nicht selbst** — Code von Codex prüft Claude, Code von Claude prüft Codex. So sehen immer zwei verschiedene KIs jede größere Änderung.

### Modell- und Denkaufwand

Der Koordinator wählt selbst; Selvir hat dies ausdrücklich freigegeben.

- **low**: Fragen, Suchen, Mini-Änderungen.
- **medium**: normale Feature-Arbeit (Standard).
- **high**: Sync, Datenmigration, Sicherheit, Reviews größerer Diffs.
- **xhigh**: nur bei wiederholt gescheiterten oder sehr heiklen Aufgaben.

Codex-Modell: `gpt-6.1-sol`. Claude-Subagenten: Opus (siehe `.claude/agents/`). Keine Agentenverbünde für Kleinigkeiten — jeder Aufruf verbraucht Nutzung.

## Codex aus Claude aufrufen

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-bridge.ps1 -Role backend -Effort medium -Write -Task "..."
```

- `-Role frontend|backend|reviewer|general` lädt die Rolle aus `.codex/agents/`.
- Ohne `-Write` arbeitet Codex nur lesend; `reviewer` ist immer lesend.
- Ausgabe beginnt mit `CODEX_THREAD=<id>`. Rückfrage/Absprache im selben Gespräch: `-Resume <id> -Task "..."`.
- Lange Aufträge als Datei im Temp-Ordner schreiben und mit `-TaskFile` übergeben.
- Exit 2 / `CODEX_UNAVAILABLE` (z. B. Nutzungslimit): Claude übernimmt die Rolle mit dem passenden Subagenten und erwähnt das im Bericht. Nicht wiederholt versuchen.
- Protokolle: `%TEMP%\puls-codex\`.

## Absprache

1. Koordinator schreibt den Auftrag nach Vorlage in `docs/TEAM-WORKFLOW.md` (Ziel, Basiscommit, erlaubte Dateien, was erhalten bleibt).
2. Rückfragen kommen unter `RÜCKFRAGEN:` zurück. Der Koordinator beantwortet sie selbst per `-Resume`; nur echte Produktentscheidungen gehen an Selvir.
3. Bei Widerspruch zwischen Claude und Codex: eine Runde Gegenargument per `-Resume`, danach entscheidet der Koordinator und begründet kurz im Bericht.
4. Nie zwei schreibende Agenten gleichzeitig an denselben Dateien. Paralleles Schreiben nur in getrennten Worktrees (`node scripts/new-worktree.cjs`).
5. Nur der Koordinator integriert, committet und veröffentlicht. Ein Push auf `main` geht sofort live.

## Werkzeuge auf diesem PC

Git und Node liegen nicht im PATH, sondern in der Codex-Laufzeit:

- Git: `%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`
- Node: `%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe`
- Codex-CLI: `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` (die Brücke findet sie automatisch)

Die Ordnernamen mit Hash können sich nach Codex-Updates ändern; dann per Wildcard suchen.
