# PULS — Arbeitsanweisungen für jeden Chat und Agenten

## Zuerst lesen

1. `docs/PROGRESS.md`: aktueller Stand, was in Arbeit ist, nächste Schritte.
2. `docs/DECISIONS.md`: Produkt, Nutzerwünsche und Entscheidungen.
3. `docs/ISSUES.md`: bekannte Fehler, Grenzen und der Refactor-Plan.
4. Je nach Auftrag `docs/ARCHITECTURE.md`, bei Daten und Sync `docs/BACKEND-HANDOFF.md`.

Ein neuer Chat kennt frühere Gespräche nicht; diese Dateien sind das gemeinsame Gedächtnis. Sie können veralten. Bei Widerspruch gelten der aktuelle Code, der Git-Stand und Selvirs aktueller Wunsch. `docs/archive/` ist Geschichte und kein Arbeitsauftrag.

## Zusammenarbeit mit Selvir

- Deutsch, kurz und verständlich. „Kannst du …“ ist ein Arbeitsauftrag.
- Routineentscheidungen triffst du selbst. Frag, wenn eine Angabe wirklich fehlt, etwas nicht rückgängig zu machen ist oder neue Berechtigungen nötig sind, und frag dieselbe Zustimmung nicht zweimal.
- Änderungen vollständig vorbereiten, prüfen und mit konkretem Ergebnis berichten. Sag ehrlich, was ungeprüft ist.
- Keine kostenpflichtigen Dienste und keine neuen laufenden Kosten ohne Auftrag.
- Passwörter, Tokens, private Profile und persönliche Gesundheitsdaten gehören nicht ins Repository.

## Team

Der Hauptchat koordiniert und ist Selvirs einziger Ansprechpartner. Wer was übernimmt und mit welchem Modell, steht in `docs/AI-TEAM.md`. Die Arbeitsanweisungen der Rollen liegen einmal in `.claude/skills/` und gelten für Claude, Codex und Gemini.

- Einfache Änderungen macht der Koordinator selbst. Größere oder riskante Änderungen sieht eine zweite KI an.
- Schreibende Agenten arbeiten in getrennten Dateien oder Worktrees (`node scripts/new-worktree.cjs`), damit sie sich nichts überschreiben.
- Der Koordinator integriert, committet und veröffentlicht. Ein Auftrag über `scripts/codex-bridge.ps1` oder `scripts/gemini-bridge.ps1` ist ein Koordinator-Auftrag: ausführen, Rückfragen unter `RÜCKFRAGEN:` stellen, nicht committen.

## Repository

- Ein Hauptordner: dieses Repository. Die Web-App liegt im Stamm (`index.html`, `sw.js`, Manifest), Skripte in `js/`, Styles in `css/`. Kein Build-Schritt.
- Repository `https://github.com/selvirtnj/puls`, live `https://selvirtnj.github.io/puls/`. GitHub Pages liefert `main` aus; ein Push auf `main` ändert die Live-App sofort.
- Vor der Arbeit `git status --short` und `git log -1 --oneline` ansehen und vorhandene Änderungen erhalten. `reset --hard`, `clean -fd` und Force-Push nur nach Rückfrage.
- Die iOS-App in `ios/` ist eine WebView-Hülle, die die Live-Web-App lädt (`docs/IOS-APP.md`). Daten, Anmeldung und Sync bleiben im Web. Native Extras kommen in die `pulsNative`-Brücke. Die SwiftUI-Umstellung ist gestoppt und unter Tag `native-swiftui-archiv` aufbewahrt.

## Bestehendes erhalten

- Erst den Code lesen und die vorhandene Funktion verbessern, statt ein zweites Modell daneben zu bauen.
- Mehrere JS-Dateien umhüllen dieselben globalen Funktionen; die Ladereihenfolge in `index.html` entscheidet, welche Definition gilt. Vor einer Änderung die wirksame Stelle suchen.
- Neue gespeicherte Felder in `validData()` aufnehmen; alte Sicherungen müssen weiter laden. IDs, Nährwert-Snapshots und alte Messungen bleiben unverändert.
- Fehlende Nährwerte, Zeiten oder Messpunkte bleiben leer. Gramm und Milliliter nur mit ausdrücklicher Dichte umrechnen.
- Was `docs/DECISIONS.md` als entfernt nennt, kommt nur auf Wunsch zurück.

## Backend und Datenschutz

- Der Supabase-Publishable-Key ist öffentliche Client-Konfiguration. `service_role`, Secret Keys, Passwörter und Tokens werden nie veröffentlicht.
- RLS nach eigener Nutzer-ID, revisionsgeprüfter Sync und Konfliktsicherungen bleiben erhalten.
- Getestet wird mit lokalen Fixtures, Mocks und `?erststart=1`. Echte Konten, Profile und Logs werden zum Testen nicht verändert.
- SQL-Dateien sind Quelltext und kein Nachweis der Live-Einrichtung. Mock-Tests belegen keine echte RLS.

## Prüfen und veröffentlichen

- `node scripts/check.cjs` (Node 24 oder neuer, keine Installation nötig; entspricht `npm test`).
- Vorschau: `node scripts/serve.cjs`, dann `http://127.0.0.1:4173/?erststart=1`. Sichtbare Änderungen bei 390 × 844 ansehen.
- Die Tests prüfen kein echtes Layout, keine Kamera und keine echte RLS. Nenne, was offen bleibt.
- Bei Änderungen an ausgelieferten App-Dateien `node scripts/bump-version.cjs` ausführen und neue Offline-Dateien in `sw.js` eintragen. Reine Doku- und Agentenänderungen bekommen keine neue App-Version.
- Nach dem Push „Web checks“ auf GitHub und die Live-Seite kurz prüfen.
- Danach `docs/PROGRESS.md` aktualisieren; dauerhafte Entscheidungen nach `docs/DECISIONS.md`, neue bekannte Fehler nach `docs/ISSUES.md`.
