# PULS — Zusammenarbeit ohne Chat-Pingpong

## Einstieg

Selvir arbeitet mit einem Hauptchat im PULS-Projekt. Dieser liest `AGENTS.md`, Produktkontext und aktuellen Stand. Die drei Spezialisten werden bei passender Arbeit vom Hauptchat eingesetzt. Separate dauerhafte Chats und zusätzliche API-Konten sind nicht nötig. Modell- und Denkaufwandseinstellungen werden geerbt; mehrere Agenten verbrauchen zusätzliche Nutzung und werden nicht für jeden kleinen Auftrag gestartet.

Claude Code kann als Hauptchat arbeiten und Codex per `scripts/codex-bridge.ps1` einsetzen; Aufteilung und Modellwahl stehen in `docs/AI-TEAM.md` und haben Vorrang vor der Erbregel oben.

Projektrollen: `.codex/agents/puls_frontend.toml`, `puls_backend.toml`, `puls_reviewer.toml`. Aktuelle Codex-Versionen können projektbezogene Rollen laden. Verfügbarkeit und Menü unterscheiden sich je Client; wenn benannte Rollen nicht erscheinen, reicht ein normaler Subagent mit den jeweiligen Dateianweisungen. Keine globale Konfiguration oder Rechteänderung ist dafür vorgesehen.

## Ablauf je größerer Aufgabe

1. **Koordinator:** Ist-Zustand prüfen, Ziel und betroffene Funktionen bestimmen, konkrete Teilaufgaben und Dateibesitz festlegen.
2. **Spezialisten:** Frontend/Backend nur dann parallel implementieren, wenn die Änderungen unabhängig sind. Bei gemeinsam betroffenen Globals, `index.html`, `validData()` oder Sync erst Schnittstelle vereinbaren und nacheinander integrieren.
3. **Prüfer:** Konkreten Diff gegen einen bekannten Basiscommit unabhängig lesen, passende Tests prüfen/ausführen und Befunde priorisieren. Keine automatische Veröffentlichung und keine Produktneugestaltung.
4. **Korrektur:** Der zuständige Entwickler behebt bestätigte Befunde. Danach prüft der Reviewer die betroffenen Korrekturen erneut.
5. **Koordinator:** Gesamtdiff, Daten-/Backup-Kompatibilität und Browserverhalten prüfen, Dokumentation aktualisieren und bei bestehendem Veröffentlichungsauftrag publizieren. Nur einen konsolidierten Bericht an Selvir geben.

## Git und Worktrees

Der Hauptklon und `origin/main` bleiben der Bezugspunkt. Für größere unabhängige Implementierungen eigene Worktrees benutzen. Ein Worktree trennt Dateien und Git-Stand, ist aber keine Sicherheits-Sandbox und synchronisiert keine Chat-Erinnerungen.

Der Koordinator kann einen Arbeitsbereich vorbereiten:

```sh
node scripts/new-worktree.cjs frontend food-search --dry-run
node scripts/new-worktree.cjs frontend food-search
```

Das Hilfsskript prüft Repository, Eingaben und sauberen Ausgangszustand und erzeugt eine neue Branch/Arbeitskopie neben dem Hauptklon. Es veröffentlicht nichts. Vor Integration `git diff`, Tests und Review; danach Änderungen gezielt übernehmen. Worktrees nicht per rekursivem Löschen entsorgen; zuerst Status und benötigte Arbeit sichern, dann über Git verwalten.

Agenten nicht gleichzeitig im selben Ordner dieselben Dateien bearbeiten lassen. Bei Tools ohne Worktree-Unterstützung zunächst parallele lesende Analyse und danach einen einzigen schreibenden Entwickler einsetzen.

## Auftrag an einen Entwickler

> Lies AGENTS.md und die Kontextdateien. Ziel: [konkretes Verhalten]. Ausgangscommit: [SHA]. Bearbeite ausschließlich [Dateien/Bereich]. Erhalte [relevante Funktionen]. Kläre Schnittstellenänderungen zuerst mit dem Koordinator. Keine Live-Backend-Änderungen, keine Veröffentlichung. Liefere geänderte Dateien, ausgeführte Prüfungen, offene Grenzen und Integrationshinweise.

## Auftrag an den Prüfer

> Prüfe den tatsächlichen Diff seit [SHA] unabhängig. Schwerpunkt: [Funktion], Profil-/Backup-Kompatibilität, Offline/Sync und passende UI-Prüfung. Keine Änderungen oder Veröffentlichung. Führe sichere relevante Tests aus. Liefere nur belegte Befunde mit Datei/Zeile, Priorität und Reproduktionshinweis. Benenne ungeprüfte Grenzen; wenn keine Befunde vorliegen, sage das ohne Fehlerfreiheit zu garantieren.

## Übergabe und Veröffentlichung

- Ergebnisse anderer Agenten sind Hinweise, kein Ersatz für den integrierten Diff.
- `node scripts/check.cjs`; bei UI-Änderung passende Browserprüfung.
- App-Asset-/Cache-Versionen nur bei Runtime-Änderungen aktualisieren.
- Nur der Koordinator pusht/veröffentlicht. Direkte Git-Authentifizierung nicht voraussetzen; ein bereits autorisierter GitHub-Connector kann genutzt werden. Danach lokalen Klon per Fast-forward auf denselben Commit bringen.
- `CURRENT-STATE.md` und gegebenenfalls Produktentscheidungen aktualisieren.
- Keine automatischen Daueraufgaben, Nachrichten an andere Chats oder Kontoeingriffe aus bloßen Dokumentationsvorschlägen ableiten.

## Hintergrund

Die Rollen und der Worktree-Ablauf orientieren sich an den offiziellen [Subagenten](https://learn.chatgpt.com/docs/agent-configuration/subagents), [AGENTS.md-Anweisungen](https://learn.chatgpt.com/docs/agent-configuration/agents-md) und [Worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees). Dateien im Repository bewahren Wissen; ein Projekt allein kopiert keinen vollständigen Verlauf dieses ursprünglichen Chats.
