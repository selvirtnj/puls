# PULS — Arbeitsanweisungen für jeden Chat und Agenten

## Zuerst lesen

1. `docs/PROJECT-CONTEXT.md`: Produkt, Nutzerwünsche und verbindliche Entscheidungen.
2. `docs/CURRENT-STATE.md`: aktueller Stand, Grenzen, offene Aufgaben und Arbeitsübergabe.
3. `docs/ARCHITECTURE.md` sowie die für den Auftrag relevanten Dateien.
4. Bei Backend-Arbeit zusätzlich `docs/BACKEND-HANDOFF.md`; bei Delegation `docs/TEAM-WORKFLOW.md`.

Diese Dateien sind die gemeinsame Wissensbasis. Ein neuer Chat kennt nicht automatisch frühere Gespräche. Prüfe Code und Git-Stand, statt historische Dokumentation als Live-Nachweis zu behandeln. Aktueller Code und aktuelle ausdrückliche Nutzerwünsche haben Vorrang vor älteren Entscheidungen.

## Zusammenarbeit mit Selvir

- Deutsch, kurze verständliche Antworten. Wünsche wie „kannst du“ als Arbeitsauftrag ausführen, soweit aus dem Kontext erkennbar.
- Routineentscheidungen eigenständig treffen. Nur bei tatsächlich fehlenden Angaben, irreversiblen Folgen oder nötigen neuen Berechtigungen fragen; niemals dieselbe Zustimmung erneut verlangen.
- Änderungen vollständig vorbereiten, prüfen und dann mit konkretem Ergebnis berichten. Keine vollständige Fehlerfreiheit versprechen.
- Keine kostenpflichtigen Dienste oder neue laufende Kosten ohne ausdrücklichen Auftrag.
- Produktinformationen gehören in Dokumente; keine privaten Profile, Passwörter, Tokens oder persönliche Gesundheitsdaten ins Repository.

## Koordinator und Spezialisten

Der Hauptchat koordiniert und bleibt Selvirs einziger nötiger Ansprechpartner. Nutze bei größeren Aufgaben gezielt Subagenten, wenn unabhängige Arbeit tatsächlich hilft:

- `puls_frontend`: Oberfläche, iPhone, Bedienung und Design.
- `puls_backend`: Auth, Zustand, Synchronisierung und SQL.
- `puls_reviewer`: unabhängige Prüfung, Tests, Datenintegrität und Sicherheit.

Rollen stehen in `.codex/agents/*.toml`. Falls ein Client diese Rollen nicht automatisch lädt, lies die entsprechende Datei und gib deren Anweisung einem normalen Subagenten mit. Modell und Denkaufwand vom Hauptagenten erben; keine kostensteigernden Modellwechsel aus eigener Initiative.

Für einfache Änderungen keinen Agentenverbund starten. Größere Implementierungen anschließend unabhängig prüfen lassen. Der zuständige Entwickler behebt Befunde, der Prüfer prüft relevante Korrekturen erneut. Höchstens zwei schreibende Agenten parallel und nur bei klar getrennten Dateien/Arbeitskopien. Nebenagenten dürfen nicht selbst veröffentlichen, keine fremden Chats anschreiben und keine Live-Backend-Änderungen vornehmen.

## Ein Repository, ein maßgeblicher Codebestand

- Dieses Repository ist die Arbeitsgrundlage. Die Web-App liegt direkt im Repository-Stamm, nicht in `dist/` oder `release34/`.
- Alte Bauordner und Skripte aus früheren Chats sind historische Werkzeuge. Sie können neuere Dateien überschreiben und werden nicht blind erneut ausgeführt.
- Repository: `https://github.com/selvirtnj/puls`; Live: `https://selvirtnj.github.io/puls/`.
- GitHub Pages veröffentlicht `main`. Ein Push auf `main` kann unmittelbar die Live-App ändern.
- Vor Arbeit `git status --short` und `git log -1 --oneline` prüfen; vorhandene Nutzeränderungen erhalten. Kein `reset --hard`, `clean -fd` oder Force-Push als Routine.
- Vor parallelen Änderungen Git-Worktrees oder eindeutig getrennte Dateien verwenden. Nur der Koordinator integriert und veröffentlicht. Bestehende Freigaben gelten weiter; keine neue pauschale Freigabepflicht erfinden.

## Bestehende Funktionen erhalten

- Erst Code lesen und vorhandene Funktion verbessern; keine parallelen Zustände, Profile, Routinen- oder Ernährungsmodelle bauen.
- Die JS-Ladereihenfolge in `index.html` ist wichtig. Mehrere Dateien erweitern dieselben globalen Funktionen. Vor Änderung die letzte wirksame Definition und Wrapper-Kette prüfen.
- Neue persistierte Felder in `validData()` berücksichtigen, alte Sicherungen akzeptieren und bei Bedarf verlustfrei migrieren.
- Workout-IDs, Übungs-IDs, gespeicherte Nährwert-Snapshots und historische Messungen erhalten.
- Keine fehlenden Nährwerte, Trainingszeiten oder Messpunkte erfinden. Gramm und Milliliter nur mit ausdrücklicher Dichte ineinander umrechnen.
- Die entfernten Features aus `docs/PROJECT-CONTEXT.md` nicht ungefragt wieder einführen.
- Seit 24.10.2026 gibt es eine native iOS-Hülle in `ios/` (lädt die Live-Web-App, Sideload per AltStore, siehe `docs/IOS-APP.md`). Die Web-App bleibt die eine Codebasis; App-Funktionen gehören weiter in die Web-Dateien. Ausnahme: Pausen-Mitteilung und Live-Aktivität/Dynamic Island laufen nativ über `native-bridge.js` → `ios/`. Health-Sync und Home-Bildschirm-Widgets sind nicht der aktive Auftrag.

## Backend und Datenschutz

- Öffentlicher Supabase-Publishable-Key ist Client-Konfiguration. Niemals `service_role`, Secret Keys, Passwörter oder Zugriffstokens veröffentlichen.
- RLS nach eigener Nutzer-ID, revisionsgeprüften Sync und Konfliktsicherungen erhalten. Keine Sicherheitsprüfung behaupten, die nur aus Mock-Tests besteht.
- Tests mit lokalen Fixtures/Mocks und `?erststart=1`. Niemals echte Konten, Profile oder Logs zu Testzwecken löschen oder zurücksetzen.
- SQL-Dateien sind Quelltext, kein Nachweis einer aktuellen Live-Einrichtung. Serveränderungen klar von Frontend-Änderungen trennen und nötige Berechtigungen beachten.

## Prüfen und veröffentlichen

- Node.js 24+. Keine npm-Installationen nötig. `node scripts/check.cjs` ist derselbe Testlauf wie `npm test` und funktioniert auch ohne npm im PATH.
- Vorschau: `node scripts/serve.cjs`, dann `http://127.0.0.1:4173/?erststart=1`.
- UI-Änderungen zusätzlich auf schmalem iPhone-Bildschirm, mindestens 390 × 844, prüfen; relevante Interaktionen und Kontraste über betroffene Designs testen.
- VM-Tests prüfen kein echtes Layout, Kameraverhalten oder echte RLS. Passende Prüfung wählen und Einschränkungen ehrlich nennen.
- Nur bei Änderungen an ausgelieferten App-Dateien Asset-Versionen, Anzeigeversion und SW-Cache konsistent erhöhen; neue Offline-Dateien in `sw.js` ergänzen. Für reine Doku-/Agentenänderungen keine App-Version erfinden.
- Vor Veröffentlichung Diff und Tests prüfen; nach Veröffentlichung Web checks, GitHub Pages und betroffene Live-Dateien prüfen. Bei Connector-Push erwartete Branch-SHA als Lease verwenden; lokalen Klon danach per Fast-forward aktualisieren.
- Nach relevanter Arbeit `docs/CURRENT-STATE.md` und dauerhafte Entscheidungen aktualisieren. Ergebnis: Änderung, Prüfung, offene Grenzen, veröffentlichter Stand.
