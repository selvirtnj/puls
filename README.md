# PULS

PULS ist ein persönlicher Fitness-, Gewichts- und Ernährungstracker als Web-App (PWA) für iPhone und Browser, mit optionalem Konto, Sync und Freunde-Vergleich.

Live: https://selvirtnj.github.io/puls/

## Funktionen

- **Essen-Tagebuch:** Lebensmittelsuche im gebündelten Katalog (BLS, USDA SR Legacy/Foundation/FNDDS, Ciqual, CNF, CoFID) und bei Open Food Facts, Barcode-Scan, KI-Foto einer Mahlzeit, Nährwerttabelle per OCR, Favoriten, Kombis, Rezepte, Portionen und Einheiten, Wasser, Rückgängig.
- **Training:** eigene Routinen, Übungs- und Maschinenbibliothek, Sätze mit Vorwerten, Pausentimer, Supersätze, Workout-Abschluss mit XP und Bestleistungen, kraftbasierte Ränge je Übung und gesamt, CSV-Import aus Liftoff, Strong und Hevy.
- **Lauf und Aktivität:** GPS-Lauf mit Karte, Routenplaner, Bestzeiten und Wochenziele; weitere Aktivitäten wie Wandern, Fußball oder Padel.
- **Körper und Fortschritt:** Gewicht mit Trend und Wochenmittel, Körpermaße, Kalender, Wochen-/Monatsrückblick, Gesamtfortschritt.
- **Freunde und Ränge:** Freundesliste, Ranglisten, Serien und Stupser.
- **Konto und Sync:** Daten lokal auf dem Gerät; optional Supabase-Konto mit revisionsgeprüfter Synchronisierung; JSON-Sicherung und CSV-Export.
- **Darstellung:** ein Design im iOS-Stil mit System/Hell/Dunkel und den Farbvarianten Frisch und Mitternacht, Bereichsfarben, Deutsch/Englisch, Klänge und Haptik.
- **iOS-Hülle:** native App (AltStore), die die Live-Web-App lädt und Mitteilungen, Live-Aktivität, Haptik, Lauf-GPS, Barcode-Scanner, Apple-Health-Export und Erinnerungen ergänzt; siehe [docs/IOS-APP.md](docs/IOS-APP.md).

## Technik

- Statische Web-App ohne Build-Schritt: `index.html`, `sw.js` (Offline-Cache) und `manifest.webmanifest` im Stamm, Skripte in `js/`, Styles in `css/`.
- Die Ladereihenfolge der Skripte in `index.html` ist fest; spätere Dateien erweitern oder umschließen globale Funktionen früherer Dateien.
- Supabase ist optional: Konto, Synchronisierung, Freunde und die Edge Function für das KI-Foto.

## Starten und testen

Voraussetzung: Node.js 24 oder neuer, keine npm-Installation nötig.

```sh
node scripts/serve.cjs      # http://127.0.0.1:4173/ (anderer Port: Umgebungsvariable PORT)
node scripts/check.cjs      # derselbe Lauf wie npm test und GitHub Actions
```

Mit `?erststart=1` startet die App im Erststart-Zustand zum Testen. Die Tests laufen in einer Node-VM mit simuliertem DOM und Netzwerk; echtes Layout, Kamera, GPS und Supabase-RLS prüfen sie nicht. UI-Änderungen zusätzlich im Browser bei mindestens 390 × 844 prüfen.

## Veröffentlichen

- GitHub Pages veröffentlicht `main`; ein Push ändert sofort die Live-App.
- Vor einem Release: `node scripts/bump-version.cjs`, danach `node scripts/check.cjs`. Neue Offline-Dateien in `ASSETS` von `sw.js` aufnehmen.
- Der iOS-Build läuft getrennt über `.github/workflows/ios-app.yml`.

## Projektstruktur

```
index.html, sw.js, manifest.webmanifest   Einstieg, Offline-Cache, PWA
icon.svg, icon-install.html, icons/       App-Icons und Seite zum Icon-Wechsel
js/                                       App-Skripte (js/vendor/: Leaflet für die Laufkarte)
css/                                      Stylesheets (css/vendor/: Leaflet)
catalog/                                  Gebündelte Lebensmittel- und Portionsdaten (JSON)
backend/                                  Supabase-SQL und Einrichtungsanleitung
supabase/functions/                       Supabase Edge Functions (food-photo)
ios/                                      Native iOS-Hülle (Swift, project.yml)
tests/                                    Regressionstests (check-*.cjs)
scripts/                                  Server, Testlauf, Versionsanhebung, Worktree-Helfer, KI-Brücken
docs/                                     Produktwissen, aktueller Stand, Architektur, Team-Ablauf
docs/archive/                             Historische Unterlagen (u. a. Gesamt-Audit)
.github/workflows/                        web-checks.yml, ios-app.yml
.claude/, .codex/                         Rollen und Einstellungen der KI-Werkzeuge
```

## Konfiguration und Sicherheit

- Im Client steht nur der öffentliche Supabase-Publishable-Key (`js/cloud-config.js`). Keine `service_role`-Schlüssel, Passwörter oder Tokens ins Repository.
- Serverdaten sind per RLS auf die eigene Nutzer-ID beschränkt; die SQL-Dateien in `backend/` sind Quelltext und werden nicht automatisch ausgeführt.
- Einrichtung und Übergabe: [docs/BACKEND-HANDOFF.md](docs/BACKEND-HANDOFF.md) und [backend/ACCOUNT-SETUP-DE.md](backend/ACCOUNT-SETUP-DE.md).

## Dokumentation

- [docs/README.md](docs/README.md): Übersicht aller Dokumente
- [docs/START-HERE.md](docs/START-HERE.md) · [docs/PROGRESS.md](docs/PROGRESS.md) · [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/ISSUES.md](docs/ISSUES.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) · [docs/STRENGTH-RANKS.md](docs/STRENGTH-RANKS.md) · [docs/ACTIVITY-DATA.md](docs/ACTIVITY-DATA.md)
- [docs/AI-TEAM.md](docs/AI-TEAM.md), [AGENTS.md](AGENTS.md): Zusammenarbeit
- [docs/archive/](docs/archive/): historische Unterlagen, darunter das [Funktionsinventar des Gesamt-Audits](docs/archive/audit/FEATURE-INVENTORY.md) (Stand 26.10.2026)

Lebensmitteldaten stammen aus BLS, USDA SR Legacy/Foundation/FNDDS, Ciqual, CNF, CoFID und Open Food Facts (Details in `catalog/manifest.json`); Übungsnamen aus der Free Exercise DB, Lizenz in [EXERCISE-LICENSE.txt](EXERCISE-LICENSE.txt).

Weitere Katalogquellen und Importkonventionen: [Lebensmitteldatenbanken](docs/FOOD-DATABASES.md).

Health Canada, Canadian Nutrient File 2026. Contains information licensed under the Open Government Licence – Canada. · Public Health England, McCance and Widdowson's Composition of Foods Integrated Dataset 2021. Contains public sector information licensed under the Open Government Licence v3.0. · U.S. Department of Agriculture, Agricultural Research Service. 2024. USDA Food and Nutrient Database for Dietary Studies 2021-2023. (Public Domain)
