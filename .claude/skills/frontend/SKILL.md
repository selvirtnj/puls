---
name: frontend
description: PULS-Oberfläche ändern. iPhone-Layout, CSS, Designs, Bedienung, Texte und Barrierefreiheit in index.html, js/ und css/.
---

# PULS-Frontend

Die App ist reines HTML, CSS und JavaScript ohne Build: `index.html` und `sw.js` im Stamm, Skripte in `js/`, Styles in `css/`.

## Vor der Änderung

- Mehrere Dateien definieren oder umhüllen dieselben globalen Funktionen. Suche alle Definitionen und prüfe an der Ladereihenfolge in `index.html`, welche zuletzt gilt. Ändere die wirksame Stelle.
- Nutze den vorhandenen Zustand und die vorhandenen Abläufe. Baue kein zweites Profil-, Routinen- oder Ernährungsmodell daneben.
- `docs/DESIGN-SYSTEM.md` beschreibt Farben, Abstände und Komponenten.

## Beim Ändern

- Alle Designs, die Navigation, die kompakte Kreis-/Balken-Bilanz, der Workout-Ablauf und die iPhone-Safe-Areas sollen danach noch funktionieren.
- Keine neue Bibliothek und kein Framework, außer der Auftrag verlangt es.
- In `docs/DECISIONS.md` als entfernt genannte Funktionen bleiben entfernt.
- HTML an der Stelle ändern, die es erzeugt. Keine neuen Schritte, die fertiges HTML per Regex umschreiben; solche Ketten wurden im Refactor abgebaut.
- Zeilenenden erhalten: Manche Dateien haben im Repository CRLF oder gemischte Enden. Nach dem Ändern muss `git diff --stat` nur die echten Zeilen zeigen.
- Änderungen an `index.html`, globalem Zustand, `validData()` oder Cloud-Sync betreffen andere Module. Melde sie dem Koordinator, bevor du sie machst.

## Prüfen

- `node scripts/check.cjs`.
- Vorschau: `node scripts/serve.cjs`, dann `http://127.0.0.1:4173/?erststart=1`. Der Parameter startet mit leeren Testdaten; echte Profile bleiben unberührt. Laufen mehrere Agenten, nimm einen eigenen Port und beende nur deinen eigenen Server, nie `pkill`/`killall` auf `serve.cjs`.
- Schlägt ein `*-order`-Test nur wegen gewollt geänderten HTML fehl: `node tests/check-<name>-order.cjs --accept-ui`. Bricht der Modus ab, hat sich Ablauf oder Zustand geändert, und das ist ein echter Fehler.
- Sichtbare Änderungen bei 390 × 844 ansehen und in den betroffenen Designs auf Kontrast und Antippbarkeit achten.
- Die Testläufe prüfen kein echtes Layout. Sag im Bericht, was du nur im Code und was du im Browser gesehen hast.
