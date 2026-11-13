# PULS — das KI-Team

Selvir spricht mit einem Hauptchat: Claude Code im PULS-Ordner. Der Hauptchat plant, verteilt, prüft und berichtet. Arbeitet Selvir direkt in Codex, ist Codex der Koordinator und nutzt dieselben Skills.

## Aufbau

```
CLAUDE.md, AGENTS.md      liest der Hauptchat zuerst
docs/                     PROGRESS · DECISIONS · ISSUES
.claude/settings.json     Modell, Aufwand, Kompaktierung, Prüf-Hook
.claude/agents/           builder · specialist · reviewer · scout
.claude/skills/           frontend · backend · test-runner · code-review · reflect
.codex/agents/            puls_builder · puls_reviewer (verweisen auf die Skills)
scripts/*-bridge.ps1      Codex und Gemini aufrufen (laden dieselben Skills)
```

Die Skills sind die einzige Quelle für Arbeitsanweisungen. Wer eine Regel ändern will, ändert den Skill; das gilt dann für Claude, Codex und Gemini. Zusätzlich installierte Fremd-Skills liegen ebenfalls in `.claude/skills/` und tragen den Herkunftsnamen als Präfix.

Skills liegen in `.claude/skills/` und nicht unter `.claude/agents/skills/`, weil Claude Code sie nur dort findet. Die Web-App bleibt im Stamm statt in `src/`, weil GitHub Pages den Stamm von `main` ausliefert.

## Wer macht was

| Aufgabe | Wer | Modell | Kosten |
|---|---|---|---|
| Planen, Aufträge, Integration, Bericht | Hauptchat | Fable 5.2 bis 16.11.2026, danach Opus 5.5, Aufwand `xhigh` | hoch, deshalb delegieren |
| Suchen, „wo wird X benutzt“, Dateien zusammenfassen | `scout` | Haiku, low | sehr niedrig |
| Oberfläche, CSS, Texte, Tests, klar umrissene Logik | `builder` | Haiku, medium | niedrig |
| Daten, `validData()`, Migration, Sync, SQL, Wrapper-Ketten | `specialist` oder Codex `backend` | Sonnet, high / gpt-6.1-sol | mittel |
| Prüfung größerer oder riskanter Diffs | `reviewer`, bei Claude-Code Codex `reviewer` | Sonnet, medium / gpt-6.1-sol | mittel |
| Zweite Meinung, Gesamtüberblick, Ersatz bei Limit | Gemini | gemini-3.8-flash | im Google-Konto enthalten |
| Kleinigkeit (Text, eine Zeile, Doku) | Hauptchat selbst | — | am billigsten |

Faustregel: so billig wie möglich anfangen und nur bei Bedarf hochstufen. Scheitert `builder` zweimal, geht die Aufgabe an `specialist`. Wer schreibt, prüft nicht selbst; bei Daten und Sync prüft eine KI eines anderen Anbieters.

## Prüfschleife

1. Der Auftrag nennt Ziel, erlaubte Dateien und woran „fertig“ zu erkennen ist.
2. Der Agent arbeitet nach `test-runner`: ändern, `node scripts/check.cjs`, Ursache beheben, wiederholen.
3. Der Hook `SubagentStop` in `.claude/settings.json` lässt `builder` und `specialist` erst aufhören, wenn der Testlauf grün ist. Nach acht Runden bricht Claude Code von selbst ab.
4. Bei größeren Änderungen liest `reviewer` oder Codex den Diff. Befunde behebt der Entwickler, der Prüfer sieht die Korrektur noch einmal an.
5. Der Hauptchat sieht den Diff selbst an, lässt die Tests laufen und veröffentlicht.
6. Hat eine Anweisung gefehlt, schärft der Hauptchat mit `reflect` den passenden Skill nach.

## Sitzungen

- Claude-Sitzungen können einander ohne Einrichtung schreiben (`ListAgents`, `SendMessage`). Der Hauptchat darf für eine eigenständige Aufgabe eine eigene Sitzung starten, zum Beispiel für einen Worktree.
- Auto-Kompaktierung greift bei 40 % (`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`). Pro größerem Thema lohnt trotzdem ein neuer Chat; der Stand steht in `docs/PROGRESS.md`.
- Das Modell des Hauptchats steht in `.claude/settings.json` (Opus 5.5). Bis 16.11.2026 überschreibt `.claude/settings.local.json` es mit Fable 5.2; `scripts/agent-hooks.cjs` entfernt diese Vorgabe danach beim nächsten Sitzungsstart.

## Codex und Gemini aufrufen

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-bridge.ps1  -Role backend  -Effort medium -Write -Task "..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gemini-bridge.ps1 -Role reviewer -Effort high -Task "..."
```

- Rollen: `frontend`, `backend`, `reviewer`, `general`. Die Brücke hängt den passenden Skill und `test-runner` an den Auftrag.
- Ohne `-Write` wird nur gelesen; `reviewer` liest immer nur. Gemini hat in der Brücke keine Terminal-Befehle, also Diffs und Testergebnisse in den Auftrag legen.
- Die Ausgabe beginnt mit `CODEX_THREAD=<id>` oder `GEMINI_THREAD=<id>`. Rückfrage im selben Gespräch: `-Resume <id> -Task "..."`. Ein neues Thema bekommt einen neuen Thread.
- Lange Aufträge als Datei im Temp-Ordner mit `-TaskFile` übergeben.
- Exit 2 oder `*_UNAVAILABLE` heißt Limit oder fehlende Anmeldung: Ersatz aus der Tabelle nehmen und im Bericht erwähnen.
- Protokolle: `%TEMP%\puls-codex\`, `%TEMP%\puls-gemini\`.

## Auftrag schreiben

> Ziel: [konkretes Verhalten]. Ausgangscommit: [SHA]. Dateien: [Liste]. Erhalten bleibt: [Funktionen]. Fertig, wenn: [Prüfung]. Kein Commit. Bericht: geänderte Dateien, Prüfergebnis, offene Punkte.

Für den Prüfer: Diff seit [SHA], Schwerpunkt [Funktion], nur belegte Befunde mit Datei und Zeile.

## Werkzeuge auf diesem PC

- Node: `C:\Program Files\nodejs` (im PATH). Git für Windows mit Credential Manager (im PATH); damit wird gepusht.
- Codex-CLI: `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`; die Brücke findet sie selbst.
- ponytail: Claude-Code-Plugin, für dieses Projekt in `.claude/settings.json` aktiviert. Es bringt eigene Hooks mit; die Skills heißen `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`.
- graphify: `%USERPROFILE%\.local\bin\graphify.exe` (über uv installiert, uv-Ordner unter `%USERPROFILE%\.uv`). `graphify update .` baut den Code-Graphen ohne KI-Aufrufe nach `graphify-out/` (nicht im Repository). Die optionalen Such- und Git-Hooks sind nicht eingerichtet.
- OmniRoute: `omniroute` (npm global, Daten unter `%APPDATA%\omniroute`). Installiert, aber nicht gestartet und ohne Anbieter. Der Server hält Zugangsdaten; Anmeldungen richtet nur Selvir ein.
- Gemini: Antigravity CLI `%LOCALAPPDATA%\agy\bin\agy.exe`, angemeldet mit Selvirs Google-Konto. Modelle: `agy models`.
