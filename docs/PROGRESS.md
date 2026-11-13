# PULS — aktueller Stand

Stand 12.11.2026. Kurzfassung; Geschichte bis Version 95 steht in [archive/CURRENT-STATE-bis-v95.md](archive/CURRENT-STATE-bis-v95.md) und wird nur bei Bedarf gelesen. Entscheidungen: [DECISIONS.md](DECISIONS.md). Offene Punkte: [ISSUES.md](ISSUES.md).

## Live

- **Version 95** auf `main` (`0974a97`, danach Test-/Doku-Commits bis `2ad15cb`). GitHub Pages: https://selvirtnj.github.io/puls/ . Repository: https://github.com/selvirtnj/puls .
- Ein Push auf `main` ändert sofort die Live-App. Die iOS-App ist die WebView-Hülle (`ios/`, Basis `ios-build-9`) und lädt die Live-Web-App.

## In Arbeit: Version 96 (Lebensmitteldatenbanken)

- Ziel: Import von CNF 2026 (2.573 Einträge), CoFID 2021 (2.636) und USDA FNDDS 2021–2023 (5.431) in `catalog/foods-37…58.json`; Katalog damit 28.893 Lebensmittel, neue Quellenfilter, Nährstoff-Sidecars um die drei Quellen erweitert.
- Branch `agent/backend-v96-food-db` im Worktree `..\puls-worktrees\backend-v96-food-db`. Letzte Commits dort: `3f61108` (Korrekturen nach Prüfung: CoFID-Basiswerte, Einheit ml, Quellenfilter, Katalog-Cache), `8777513` (Nährstoff-Sidecars v2). Im Worktree liegt zusätzlich uncommittete Arbeit (beim Stand dieses Textes 74 Einträge in `git status`).
- Sicherungsbranch `agent/food-databases` = `b38c750` (47 Dateien aus dem früheren Codex-Klon, Basis `ad92acf`). Der alte Klon ist gelöscht; der Stash dazu liegt als Branch `sicherung/alt-klon-stash`.
- Beim Probe-Merge waren Konflikte in `docs/PROJECT-CONTEXT.md` (jetzt `DECISIONS.md`), `scripts/check.cjs`, `sw.js` und `tests/check-color-offline.cjs` aufgetreten.
- Laut bisheriger Doku braucht Version 96 einen höheren Katalog-Cache-Namen in `sw.js` (auf `main`: `puls-catalog-v2`); der Worktree-Commit nennt bereits einen Katalog-Cache.
- Vor der Veröffentlichung: Review (Daten/Lizenzen, Anzeige), `node scripts/check.cjs`, 390 × 844 im Browser, Bump, Push. Quellen und Lizenzen: [CATALOG-SOURCES.md](CATALOG-SOURCES.md); Zuordnung: [NUTRIENT-MAPPING.md](NUTRIENT-MAPPING.md).

## Letzte Versionen

- **95** (12.11.): bis zu 63 zusätzliche Nährwerte je Katalog-Lebensmittel (BLS 4.0, USDA SR Legacy, USDA Foundation, Ciqual) als nachladbare `catalog/nutrients-v1-*.json`; Produktdetail „Alle Nährwerte“, Tagesansicht „Alle Nährstoffe“, neue optionale Felder `ck` und `nx`. Nachkorrektur: Prüfsummen zeilenendenunabhängig (GitHub „Web checks“ war rot).
- **94** (09.11.): Ränge neu kalibriert (18 Ränge auf 40 Stufen, 4 neue über Tren Cougher); UI-Sammelkorrektur (Seiten starten oben, Englisch komplett, Erklärtexte entfernt, Wischen, Farbschema, iPhone-Funktionen, Freunde).
- **93** (09.11.): Rangskala v2 (14 Ränge, 40 Stufen), Routinen-Favoriten, `backend/friends-strength-v2.sql` live ausgeführt.
- **92** (09.11.): Ränge ab dem ersten Workout, Liftoff-Import mit automatischer Einheit im Erststart, Statusleiste je Schema, Profil „Alles eintragen“.
- **91 / 90** (09.11.): Makro-Folie grau; Version 90 = Vollversion 1.0 (Tag `v1.0`): Bereichsfarben, Erklärtexte entfernt, Logikkorrekturen.

## Nächste Schritte

1. Version 96 fertigstellen, prüfen lassen und veröffentlichen (siehe oben).
2. Danach Refactor nach Plan in [ISSUES.md](ISSUES.md); erst nach Abschluss von Version 96, weil der Worktree dieselben Dateien berührt.
3. Weitere freie Datenbanken nur mit geklärter Lizenz (Fineli CC BY 4.0 ist nicht geladen; Schweizer Datenbank nur nach schriftlicher Klärung; NCCDB, NEVO, NZ FOODfiles, BDA, BEDCA, ÖNWT scheiden aus Lizenzgründen aus).
4. iPhone-Test, Freunde mit zwei echten Konten und echte RLS-Prüfung sind weiter offen.

## Veröffentlichen

1. Änderungen prüfen lassen (größere Änderungen durch einen unabhängigen Prüfer).
2. `node scripts/bump-version.cjs` erhöht Version, Asset-Parameter und SW-Cache überall; Katalog-Cache in `sw.js` bei neuen Katalogdateien separat erhöhen.
3. `node scripts/check.cjs` muss grün sein; Diff ansehen.
4. Commit, Push auf `main` mit System-Git und Credential Manager.
5. Live-Check: GitHub „Web checks“ grün, GitHub Pages ausgeliefert, betroffene Live-Dateien und Versionsanzeige prüfen.
6. Danach diese Datei (`PROGRESS.md`) knapp aktualisieren.

Werkzeuge auf diesem PC und das KI-Team: siehe [AI-TEAM.md](AI-TEAM.md).
