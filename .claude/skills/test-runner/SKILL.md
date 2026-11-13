---
name: test-runner
description: PULS-Änderungen prüfen. Testlauf starten, Fehler lesen, Ursache beheben und erneut prüfen, bis der Lauf grün ist.
---

# Prüfschleife

1. `node scripts/check.cjs` im Stamm des Repositories ausführen. Das ist derselbe Lauf wie `npm test`; es braucht Node 24 oder neuer und keine Installation.
2. Scheitert der Lauf, lies die erste fehlgeschlagene Prüfung und die Testdatei in `tests/`, bis du weißt, was sie erwartet.
3. Behebe die Ursache im App-Code. Einen Test änderst du nur, wenn sich das gewünschte Verhalten laut Auftrag geändert hat, und dann nennst du das im Bericht.
4. Zurück zu Schritt 1. Nach drei erfolglosen Runden aufhören und dem Koordinator die Fehlerausgabe und deine Vermutung melden.

Für neue Logik gehört ein Test in `tests/check-*.cjs`, eingetragen in `scripts/check.cjs`. Tests arbeiten mit Fixtures und Mocks und ohne Netz.

Im Bericht steht die letzte Zeile des Laufs wörtlich. „Sollte funktionieren“ ist kein Prüfergebnis.

Der Lauf deckt Syntax, Verweise in `index.html` und die Regressionstests ab. Echtes Layout, Kamera, GPS und echte RLS deckt er nicht ab; nenne, was davon für deine Änderung ungeprüft bleibt.
