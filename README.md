# PULS

PULS ist ein persönlicher Fitness- und Ernährungstracker als Web-App (PWA) für iPhone und Browser.

Live: https://selvirtnj.github.io/puls/

## Hauptfunktionen

- **Übersicht (Heute):** Tagesstand mit Kalorien, Makros und Training.
- **Ernährung:** Lebensmittelsuche im gebündelten Katalog, Barcode-Scan, Nährwertfoto (OCR), Rezepte, Portionen und Einheiten, Wasser.
- **Training:** eigene Routinen, Übungs- und Maschinenbibliothek, Sätze, Pausentimer, Workout-Abschluss.
- **Laufen:** Aktivitäten mit GPS, Karte und Laufmetriken (GPS nativ nur in der iOS-Hülle).
- **Körper und Fortschritt:** Gewicht, Körpermaße, Navy-Körperfettschätzung, Auswertungen, Profil und Ziele.
- **Konto:** Daten lokal auf dem Gerät; optional Konto und Sync über Supabase; JSON-Sicherung.
- **Darstellung:** mehrere Designs, Deutsch/Englisch, Klänge und Haptik.

Der vollständige Bestand mit Dateizuordnung steht in [docs/audit/FEATURE-INVENTORY.md](docs/audit/FEATURE-INVENTORY.md).

## Technik

- Statische Web-App ohne Build-Schritt: `index.html`, `sw.js` (Offline-Cache) und `manifest.webmanifest` im Stamm, Skripte in `js/`, Styles in `css/`.
- Die Ladereihenfolge der Skripte in `index.html` ist fest; spätere Dateien erweitern oder umschließen globale Funktionen früherer Dateien.
- Supabase ist optional und nur für Konto und Synchronisierung.
- Eine native iOS-Hülle in `ios/` lädt dieselbe Web-App; siehe [docs/IOS-APP.md](docs/IOS-APP.md).

## Voraussetzungen

Node.js 24 oder neuer (`engines` in `package.json`). Eine npm-Installation ist nicht nötig, das Projekt hat keine Abhängigkeiten.

## Lokal starten

```sh
node scripts/serve.cjs
```

Dann http://127.0.0.1:4173/ öffnen. Mit `http://127.0.0.1:4173/?erststart=1` startet die App im Erststart-Zustand zum Testen. (`npm start` führt dasselbe aus.)

## Tests

```sh
node scripts/check.cjs
```

Das ist derselbe Lauf wie `npm test` und wird auch in GitHub Actions ausgeführt (`.github/workflows/web-checks.yml`).

Geprüft werden: die Übergabedokumente samt relativen Links und Rollendateien, die JavaScript-Syntax von `sw.js` und `js/*.js`, dass alle in `index.html` referenzierten JS- und CSS-Dateien existieren, sowie die Regressionstests in `tests/` (Konto, Sync, Onboarding, Profil, Lebensmittel, Training, Laufen, Icons u. a.).

Nicht geprüft: Die Tests laufen in einer Node-VM mit simuliertem DOM und Netzwerk. Echtes Layout, Wischgesten, Kamera, Audio, GPS und Supabase-RLS auf einem echten Server werden damit nicht abgedeckt; UI-Änderungen zusätzlich im Browser bei mindestens 390 × 844 prüfen.

## Veröffentlichen

- GitHub Pages veröffentlicht den Branch `main`. Ein Push auf `main` ändert sofort die Live-App.
- Vor einem Release mit geänderten App-Dateien: `node scripts/bump-version.cjs` (erhöht die Version an allen Stellen), danach `node scripts/check.cjs`.
- Neue Offline-Dateien in die `ASSETS`-Liste von `sw.js` aufnehmen.
- Der iOS-Build läuft getrennt über `.github/workflows/ios-app.yml`.

## Projektstruktur

```
index.html, sw.js, manifest.webmanifest   Einstieg, Offline-Cache, PWA
icon.svg, icon-install.html, icons/       App-Icons und Seite zum Icon-Wechsel
js/                                       App-Skripte (js/vendor/: Leaflet für die Laufkarte)
css/                                      Stylesheets (css/vendor/: Leaflet)
catalog/                                  Gebündelte Lebensmittel- und Portionsdaten (JSON)
backend/                                  Supabase-SQL und Einrichtungsanleitung
ios/                                      Native iOS-Hülle (Swift, project.yml)
tests/                                    Regressionstests (check-*.cjs)
scripts/                                  Server, Testlauf, Versionsanhebung, Worktree-Helfer, KI-Brücken
docs/                                     Produktwissen, aktueller Stand, Architektur, Team-Ablauf
docs/audit/                               Unterlagen des Gesamt-Audits (Inventar, Testmatrix, Berichte)
docs/archive/                             Historische Notizen
.github/workflows/                        web-checks.yml, ios-app.yml
.claude/, .codex/                         Rollen und Einstellungen der KI-Werkzeuge
```

## Konfiguration und Sicherheit

- Im Client steht nur der öffentliche Supabase-Publishable-Key (`js/cloud-config.js`). Keine `service_role`-Schlüssel, Passwörter oder Tokens ins Repository.
- Der Zugriff auf Serverdaten ist per RLS auf die eigene Nutzer-ID beschränkt; die SQL-Dateien in `backend/` sind Quelltext und werden nicht automatisch ausgeführt.
- Einrichtung und Übergabe: [docs/BACKEND-HANDOFF.md](docs/BACKEND-HANDOFF.md) und [backend/ACCOUNT-SETUP-DE.md](backend/ACCOUNT-SETUP-DE.md).

## Weiterführende Dokumentation

- [docs/README.md](docs/README.md): Übersicht aller Dokumente
- [docs/START-HERE.md](docs/START-HERE.md): hier weiterarbeiten
- [docs/PROJECT-CONTEXT.md](docs/PROJECT-CONTEXT.md): Produkt und Entscheidungen
- [docs/CURRENT-STATE.md](docs/CURRENT-STATE.md): aktueller Stand und Übergaben
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): Struktur und Prüfablauf
- [docs/IOS-APP.md](docs/IOS-APP.md): iOS-Hülle
- [docs/AI-TEAM.md](docs/AI-TEAM.md), [docs/TEAM-WORKFLOW.md](docs/TEAM-WORKFLOW.md), [AGENTS.md](AGENTS.md): Zusammenarbeit
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md): Gestaltung
- [docs/audit/](docs/audit/): Audit-Unterlagen

Lebensmitteldaten stammen aus BLS, USDA, Ciqual und Open Food Facts (Details in `catalog/manifest.json`); Übungsnamen aus der Free Exercise DB, Lizenz in [EXERCISE-LICENSE.txt](EXERCISE-LICENSE.txt).
