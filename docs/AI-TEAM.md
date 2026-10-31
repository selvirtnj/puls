# PULS — Claude, Codex und Gemini als ein Team

Selvir spricht nur mit **einem Hauptchat**: „PULS · Hauptchat“ in Claude Code im PULS-Ordner. Claude ist Koordinator, verteilt Aufgaben an sich selbst, an Claude-Subagenten, an Codex oder an Gemini und gibt am Ende einen einzigen Bericht. Selvir muss nichts weiterleiten.

Wenn Selvir stattdessen direkt in Codex arbeitet, gilt dieselbe Aufteilung; Codex ist dann Koordinator und nutzt seine eigenen Rollen aus `.codex/agents/`.

## Grundregeln

- **Web-App plus native Umstellung.** Die Web-App (`index.html`, `js/`, `css/`) bleibt live und bis Phase B Datenbesitzer. Seit 26.10.2026 läuft die schrittweise native SwiftUI-Umstellung in `ios/` auf Branch `native-ios`; Plan, Vertrag und Aufgaben in `docs/native/`. Codex übernimmt dort einen großen Teil der Umsetzung, Prüfung immer über Kreuz.
- **Wer schreibt, prüft nicht selbst.** Jede größere Änderung sieht mindestens eine andere KI.
- **Höchstens zwei schreibende Agenten gleichzeitig**, nur in getrennten Dateien oder Worktrees.
- **Nur der Koordinator** integriert, committet und veröffentlicht. Ein Push auf `main` geht sofort live.

## Rollen: eine Quelle für alle drei KIs

Die Rollen `frontend`, `backend`, `reviewer` stehen nur einmal in `.codex/agents/puls_*.toml` (`general` = ohne Rolle). Alle KIs bekommen dieselbe Anweisung:

| KI | Wie die Rolle ankommt |
|---|---|
| Claude | Subagenten `puls-frontend`, `puls-backend`, `puls-reviewer` (`.claude/agents/`) lesen die TOML-Datei |
| Codex | `scripts/codex-bridge.ps1 -Role …` lädt sie in den Auftrag; Codex-App nutzt sie direkt |
| Gemini | `scripts/gemini-bridge.ps1 -Role …` lädt sie in den Auftrag (Antigravity kennt Projekt-Agenten nur als globales Plugin, daher keine Doppelpflege) |

Regeln ändern = TOML-Datei ändern; das gilt sofort für alle.

## Wer macht was (Startregel, vom Koordinator anpassbar)

| Aufgabe | Schreibt | Prüft | Ersatz bei Limit |
|---|---|---|---|
| UI, CSS, iPhone-Layout, Designs, Texte | Claude `puls-frontend` (Opus, medium) | Codex `reviewer` (medium); Gemini als zweite Meinung bei größeren Umbauten | Gemini `frontend` |
| Auth, Sync, SQL, Datenmodell, Migration, `validData()` | Codex `backend` (medium; high bei Sync/RLS/Migration) | Claude `puls-reviewer` (Opus, high); bei Daten-/Profilverträglichkeit zusätzlich Gemini `reviewer` (high) | Claude `puls-backend` |
| Übergreifend (UI + Daten) | Codex zuerst Daten/Schnittstelle, dann Claude UI — nacheinander | jeweils eine andere KI | — |
| Überblick über das ganze Projekt, Wrapper-Ketten, „wo wird X überall benutzt“ | Gemini `general` (lesend) | Koordinator prüft Stichproben | Claude Explore |
| Fehlersuche mit unklarer Ursache | zwei KIs lesend parallel, Koordinator entscheidet | — | — |
| Kleinigkeit (Text, eine Zeile, Doku) | Koordinator selbst, kein Agent | keine | — |
| Schnelle Frage zur Vorgeschichte | Codex `general` (low) | — | Gemini `general` |

Gemini ist vor allem **Prüfer, zweite Meinung, Ersatz und Gesamtüberblick**, kein dritter paralleler Entwickler. Stärken werden nach Erfahrung angepasst, nicht vorausgesetzt.

### Modell- und Denkaufwand

Der Koordinator wählt selbst; Selvir hat dies ausdrücklich freigegeben. Keine Agentenverbünde für Kleinigkeiten — jeder Aufruf verbraucht Nutzung.

| Stufe | Wofür | Claude | Codex | Gemini |
|---|---|---|---|---|
| low | Fragen, Suchen, Mini-Änderungen | Opus low | gpt-6.1-sol low | gemini-3.8-flash-low |
| medium | normale Feature-Arbeit (Standard) | Opus medium | gpt-6.1-sol medium | gemini-3.8-flash-medium |
| high | Sync, Migration, Sicherheit, große Reviews | Opus high | gpt-6.1-sol high | gemini-3.8-flash-high |
| xhigh | nur bei wiederholt gescheiterten oder sehr heiklen Aufgaben | Opus xhigh | gpt-6.1-sol xhigh | flash-high, effort xhigh |

Verfügbare Gemini-Modelle: `agy models`.

### Sparsam arbeiten (Nutzung schonen)

- **Standard ist `low`/`medium`.** `high` nur für Sync, Migration, Sicherheit und große Reviews; `xhigh` nur nach wiederholtem Scheitern.
- **Kleinigkeiten macht der Koordinator selbst:** Texte, CSS-Abstände und Ein-Zeilen-Fixes ohne Agent und ohne Review.
- **Reviews nur bei größeren oder riskanten Änderungen**, und dann mit einem gezielten Auftrag: Diff plus „worauf achten“, nicht „prüfe alles“.
- **Codex-Aufträge eng fassen:** erlaubte Dateien, maximale Anzahl Korrekturen, „kein Browser-Test“, wenn er nicht nötig ist. `-Resume` nur für Rückfragen zum selben Thema; ein neues Thema bekommt einen neuen Thread, damit der alte Kontext nicht jedes Mal mitbezahlt wird.
- **Browser-Prüfung:** Text mit `get_page_text`/`read_page` oder per JavaScript lesen, Screenshots nur für echte Layoutfragen und klein (`scale` 0.5).
- **Veröffentlichen:** `node scripts/bump-version.cjs` erhöht die Version überall, danach `node scripts/check.cjs`, Commit, Push und ein kurzer Live-Check. Keine Einzel-Edits pro Versionsstelle.
- **Lange Chats** kosten bei jeder Nachricht mehr. Pro größerem Thema einen neuen Chat beginnen; die Übergabe steht in `docs/CURRENT-STATE.md`.
- **Selvir bündelt Wünsche** möglichst in einer Nachricht; der Koordinator setzt sie gesammelt um und veröffentlicht einmal statt mehrmals.

## Codex und Gemini aufrufen

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-bridge.ps1  -Role backend  -Effort medium -Write -Task "..."
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gemini-bridge.ps1 -Role reviewer -Effort high -Task "..."
```

- Ohne `-Write` arbeiten beide nur lesend; `reviewer` ist immer lesend. Gemini hat in der Brücke keine Terminal-Befehle: Diffs und Testergebnisse in den Auftrag legen.
- Ausgabe beginnt mit `CODEX_THREAD=<id>` bzw. `GEMINI_THREAD=<id>`. Rückfrage im selben Gespräch: `-Resume <id> -Task "..."`.
- Lange Aufträge als Datei im Temp-Ordner schreiben und mit `-TaskFile` übergeben.
- Exit 2 / `*_UNAVAILABLE` (z. B. Nutzungslimit): Ersatz laut Tabelle einsetzen und im Bericht erwähnen. Nicht wiederholt versuchen.
- Protokolle: `%TEMP%\puls-codex\`, `%TEMP%\puls-gemini\`.

## Absprache

1. Koordinator schreibt den Auftrag nach Vorlage in `docs/TEAM-WORKFLOW.md` (Ziel, Basiscommit, erlaubte Dateien, was erhalten bleibt).
2. Rückfragen kommen unter `RÜCKFRAGEN:` zurück. Der Koordinator beantwortet sie selbst per `-Resume`; nur echte Produktentscheidungen gehen an Selvir.
3. Bei Widerspruch: eine Runde Gegenargument per `-Resume`, danach entscheidet der Koordinator und begründet kurz im Bericht. Bei Datenrisiken kann Gemini als dritte Stimme entscheiden helfen.
4. Paralleles Schreiben nur in getrennten Worktrees (`node scripts/new-worktree.cjs`).
5. Ergebnisse anderer KIs sind Hinweise: Koordinator sieht den Diff selbst an und lässt `node scripts/check.cjs` laufen.

## Werkzeuge auf diesem PC

Git und Node liegen nicht im PATH:

- Git: `%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe`
- Node: `%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe` (zusätzlich installiert: `C:\Program Files\nodejs`)
- Codex-CLI: `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` (die Brücke findet sie automatisch)
- Gemini: Antigravity CLI `%LOCALAPPDATA%\agy\bin\agy.exe`, angemeldet mit Selvirs Google-Konto. Die alte Gemini CLI (npm) ist von Google eingestellt und wird nicht benutzt.

Die Ordnernamen mit Hash können sich nach Codex-Updates ändern; dann per Wildcard suchen.
