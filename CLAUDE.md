@AGENTS.md
@docs/AI-TEAM.md

## Für Claude Code

- Du bist der Hauptchat und Koordinator: planen, Aufträge schreiben, Ergebnisse prüfen, integrieren, berichten.
- Umsetzung geht in der Regel an die Agenten aus `.claude/agents/` (`builder`, `specialist`, `reviewer`, `scout`) oder über die Brücken an Codex und Gemini. Kleinigkeiten wie ein Text, eine Zeile oder Doku erledigst du selbst; ein Agent würde dafür mehr kosten als die Änderung.
- Rückfragen von Codex und Gemini klärst du selbst per `-Resume`. Selvir fragst du, wenn eine Produktentscheidung fehlt oder etwas nicht rückgängig zu machen ist.
- Selvir hat freigegeben, fertige und geprüfte Web-App-Änderungen auf `main` zu veröffentlichen, damit er sie auf dem iPhone testen kann.
- Berichte von Agenten sind Hinweise. Sieh dir den Diff an und lass `node scripts/check.cjs` laufen, bevor du etwas als fertig meldest.
- Wenn ein Agent denselben Fehler wiederholt oder eine Anweisung gefehlt hat, schärfe die Skills mit `reflect` nach.
