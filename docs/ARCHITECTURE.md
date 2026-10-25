# Projektstruktur

PULS ist eine statische Web-App ohne Build-Schritt und ohne npm-Abhängigkeiten. GitHub Pages veröffentlicht `main` unter `https://selvirtnj.github.io/puls/`. `index.html`, `sw.js` und das Manifest bleiben im Stamm, damit Adresse und PWA-Scope (`/puls/`) für installierte Home-Bildschirm-Apps und die iOS-Hülle unverändert bleiben.

```
index.html              Einstieg; lädt alle Styles und Skripte in fester Reihenfolge
sw.js                   Service Worker (Offline-Cache, ASSETS-Liste, CACHE-Version)
manifest.webmanifest    PWA-Manifest
icon.svg, icon-install.html, icons/   App-Icons und Seite zum Icon-Wechsel
js/                     App-Skripte (globale Funktionen, spätere Dateien umschließen frühere)
css/                    Stylesheets (spätere überschreiben frühere)
catalog/                Gebündelte Lebensmittel- und Portionsdaten (JSON, nach Bedarf geladen)
backend/                Supabase-SQL und Einrichtungsanleitung (nicht automatisch ausgeführt)
ios/                    Native iOS-Hülle (Swift, XcodeGen) – nur auf ausdrücklichen Wunsch ändern
tests/, scripts/        VM-Regressionstests, lokaler Server, KI-Brücken, Worktree-Helfer
docs/                   Produktwissen, Stand, Team-Ablauf; docs/archive/ = historische Notizen
.codex/, .claude/       Rollen und Einstellungen für Codex und Claude Code
```

## Skripte nach Bereich (`js/`)

| Bereich | Dateien |
|---|---|
| Grundlage und Daten | app.js, enhancements.js, personal.js, experience.js, adaptation.js, i18n.js |
| Ernährung | products.js, recipes.js, portions.js, food-search.js, catalog-search.js, catalog-worker.js, food-upgrade.js, quick-units.js, nutrition-input.js |
| Training | exercise-catalog.js, machine-library.js, training.js, insights.js, finish.js, workout-polish.js, tracker-tools.js, progress-metrics.js |
| Darstellung und Abläufe | navigation.js, flows.js, visuals.js, interactions.js, polish.js, compact.js, lifecycle.js, comfort.js, refinement.js, designs-extra.js, preview-mode.js |
| Konto und Sync | cloud.js, cloud-config.js, account-guide.js, account-refresh.js |
| Neuere Verfeinerungen (zuletzt geladen) | profile-refresh.js (Profil & Ziele), training-tabs.js (Workout/Routinen), session-focus.js (laufendes Workout), running.js (Laufen inkl. GPS), native-bridge.js (nur in der iOS-Hülle aktiv) |

Die Originaldesign-Überarbeitungen liegen in `css/account-refresh.css`, `overview-refresh.css`, `training-refresh.css`, `food-refresh.css`; designübergreifend wirken `session-focus.css`, `profile-refresh.css`, `training-tabs.css`.

## Änderungen

Die Reihenfolge in `index.html` ist absichtlich festgelegt. Erweiterungen nutzen den gemeinsamen Zustand und umschließen bestehende Funktionen; vor einer Änderung die letzte wirksame Definition prüfen. Neue Datenfelder müssen `validData()` ergänzen und alte Sicherungen akzeptieren.

1. `npm test` (oder `node scripts/check.cjs`)
2. `npm start` und die iPhone-Ansicht (390 × 844) unter `http://127.0.0.1:4173/?erststart=1` prüfen
3. Asset-Versionen (`?v=`), Anzeigeversion, `package.json` und `CACHE` in `sw.js` gemeinsam erhöhen
4. Neue Dateien in die `ASSETS`-Liste von `sw.js` aufnehmen (Pfade mit `js/` bzw. `css/`)
5. Nach dem Push GitHub Pages und die betroffenen Live-Dateien prüfen

Die VM-Tests simulieren DOM und Netzwerk; Layout, Wischgesten, Kamera und Audio zusätzlich im Browser prüfen.

## Daten

Das Profil liegt lokal in `puls-v1`. Supabase Auth und revisionsgeprüfte Speicherung synchronisieren dasselbe Profil. Der öffentliche Publishable Key darf im Client stehen; `service_role`, Passwörter oder andere geheime Schlüssel gehören niemals ins Repository. RLS beschränkt den Zugriff auf die eigene Nutzer-ID. SQL-Dateien werden nicht automatisch ausgeführt.
