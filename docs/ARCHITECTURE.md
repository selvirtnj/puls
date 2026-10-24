# Projektstruktur

PULS ist eine statische Web-App ohne Build-Abhängigkeiten. GitHub Pages veröffentlicht die Dateien im Repository-Stamm. Relative Pfade erhalten die bestehende /puls/-Adresse und den installierten PWA-Scope.

| Bereich | Dateien |
|---|---|
| Einstieg und Offline | index.html, manifest.webmanifest, sw.js |
| Gemeinsame Daten | app.js, enhancements.js, personal.js |
| Ernährung | products.js, recipes.js, portions.js, food-search.js, catalog-search.js, food-upgrade.js, quick-units.js |
| Training | training.js, insights.js, finish.js, workout-polish.js; training-refresh.css für Originaldesign in Training, Session und Abschluss |
| Darstellung | navigation.js, flows.js, visuals.js, designs-extra.js mit CSS |
| Konto und Datenschutz | cloud.js, cloud-config.js, account-guide.js, backend/ |
| Aktuelle Verfeinerung | refinement.js, progress-metrics.js mit CSS; account-refresh.js/.css für Konto; overview-refresh.css für das Originaldesign der Übersicht |
| Lokale Tests | tests/, scripts/check.cjs |

## Änderungen

Die Script-Reihenfolge in index.html ist absichtlich festgelegt. Erweiterungen nutzen den gemeinsamen Zustand und bestehende Funktionen. Neue Datenfelder müssen validData ergänzen und alte Sicherungen akzeptieren. Keine zweite Trainings- oder Ernährungsdatenbank im Browser einführen.

1. npm test
2. npm start und iPhone-Ansicht prüfen
3. Versionsnummern der betroffenen Assets und den Cache-Namen in sw.js erhöhen
4. Neue Offline-Dateien zur ASSETS-Liste ergänzen
5. Nach Veröffentlichung GitHub Pages prüfen

Die VM-Tests simulieren DOM und Netzwerk; Drag-and-drop, Layout, Kamera und Audio zusätzlich im Browser prüfen.

## Daten

Das Profil liegt lokal in puls-v1. Supabase Auth und revisionsgeprüfte Speicherung synchronisieren dasselbe Profil. Der öffentliche Publishable Key darf im Client stehen; service_role, Passwörter oder andere geheime Schlüssel gehören niemals ins Repository. RLS muss den Zugriff auf die eigene Nutzer-ID beschränken. SQL-Dateien werden nicht automatisch beim Seitenaufruf ausgeführt.

Native Experimente sind im Archiv dokumentiert und werden nicht automatisch gebaut.
