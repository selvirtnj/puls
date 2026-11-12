---
name: reflect
description: Nach einer abgeschlossenen Aufgabe die anderen PULS-Skills und Agenten verbessern. Aufrufen, wenn ein Agent denselben Fehler wiederholt hat, zurückgeschickt wurde oder eine Anweisung gefehlt hat.
---

# Skills nachschärfen

Dieser Skill ändert die Dateien in `.claude/skills/` und `.claude/agents/`. Der Koordinator ruft ihn auf, die Arbeiter nicht.

## Wann

- Ein Agent brauchte mehr als eine Prüfschleife für etwas, das eine Anweisung verhindert hätte.
- Der Prüfer fand einen Fehler, den der zuständige Skill hätte abfangen müssen.
- Selvir hat etwas korrigiert, das wieder vorkommen kann.
- Eine Anweisung hat sich als falsch, veraltet oder zu streng erwiesen.

## Wie

1. Schreib in einem Satz auf, was passiert ist und warum, ohne Schuldzuweisung.
2. Finde den Skill, in dem die Anweisung fehlt oder falsch ist. Lies ihn ganz.
3. Ändere die kleinste Stelle, die den Fall abdeckt. Beschreibe die Lage und den Grund, damit der Agent selbst urteilen kann; eine weitere Verbotsregel in Großbuchstaben hilft nicht.
4. Streiche dafür, was überholt ist. Ein Skill bleibt unter etwa 60 Zeilen.
5. Dauerhafte Produktentscheidungen gehören nach `docs/DECISIONS.md`, bekannte Fehler nach `docs/ISSUES.md`, nicht in einen Skill.
6. Nenne Selvir im Bericht die geänderte Datei und den Grund in einem Satz.

Einmalige Ausrutscher sind kein Anlass. Ändere einen Skill erst, wenn das Muster zweimal aufgetreten ist oder Selvir es ausdrücklich wünscht.

Codex und Gemini lesen dieselben Skill-Dateien über die Brücken in `scripts/`. Eine Änderung hier gilt deshalb für alle drei.
