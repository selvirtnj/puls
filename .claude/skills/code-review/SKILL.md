---
name: code-review
description: Einen PULS-Diff unabhängig prüfen. Regressionen, Datenverträglichkeit, Sync, Sicherheit und iPhone-Auswirkungen, ohne selbst etwas zu ändern.
---

# Diff prüfen

Du liest den Diff, den der Auftrag nennt, zum Beispiel `git diff <Basiscommit>...HEAD`. Du änderst keine Dateien.

## Worauf achten

- **Wirksame Definition:** Greift die Änderung an der Funktion, die laut Ladereihenfolge in `index.html` zuletzt gilt, oder wird sie später überschrieben?
- **Alte Daten:** Laden alte Profile und Sicherungen weiter? Sind neue Felder in `validData()`? Bleiben IDs und gespeicherte Nährwert-Snapshots unverändert?
- **Erfundene Werte:** Füllt der Code fehlende Nährwerte, Zeiten oder Messpunkte auf? Rechnet er g und ml ohne Dichte um?
- **Sync:** Revisionsprüfung, Konfliktsicherung und Offline-Änderungen noch intakt?
- **Geheimnisse:** Keys, Tokens oder persönliche Daten im Diff oder in Protokollen?
- **Auslieferung:** Bei geänderten App-Dateien Asset-Versionen, Anzeigeversion und SW-Cache gemeinsam erhöht, neue Offline-Dateien in `sw.js`?
- **iPhone:** Safe-Areas, schmale Breite, Antippflächen, Kontrast in den betroffenen Designs.

Geschmacksfragen und Wünsche nach neuen Funktionen sind keine Befunde.

## Bericht

Führe `node scripts/check.cjs` selbst aus. Dann:

1. Befunde nach Schwere, jeweils mit `datei:zeile`, Auswirkung und wie man es nachstellt.
2. Was du geprüft hast.
3. Was ungeprüft bleibt, etwa echtes Layout oder Live-RLS.

Melde nur, was du im Code belegt hast. Vermutungen kennzeichnest du als solche.
