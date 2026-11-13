# PULS — aktueller Stand

Stand 14.11.2026. Kurzfassung; Geschichte bis Version 95 steht in [archive/CURRENT-STATE-bis-v95.md](archive/CURRENT-STATE-bis-v95.md) und wird nur bei Bedarf gelesen. Entscheidungen: [DECISIONS.md](DECISIONS.md). Offene Punkte: [ISSUES.md](ISSUES.md).

## Live

- **Version 101** auf `main` (Commit „Version 101: Refactor Phase 4, accountPage als eine Funktion“). GitHub Pages: https://selvirtnj.github.io/puls/ . Repository: https://github.com/selvirtnj/puls .
- Ein Push auf `main` ändert sofort die Live-App. Die iOS-App ist die WebView-Hülle (`ios/`, Basis `ios-build-9`) und lädt die Live-Web-App.
- In Arbeit: Refactor nach [ISSUES.md](ISSUES.md), Phasen 0 bis 3 sind erledigt, von Phase 4 sind `render` und `accountPage` fertig, die übrigen Ketten und Phase 5 sind offen. Es gibt nur den Branch `main`.

## Letzte Versionen

- **101** (14.11.): Refactor Phase 4, zweiter Teil, ohne sichtbare Änderung. `accountPage` ist eine Funktion in `js/experience.js` (Kern `accountPageBase` in `js/flows.js`, 14 Glieder `accountPageAfter…`) statt 20 Wrappern; sechs davon liefen nie und sind gelöscht. Neuer Test `tests/check-accountpage-order.cjs` (45 Zustände gegen den alten Stand), Browser-Vergleich über 34 Konto-Zustände ohne Unterschied, von Codex gegengeprüft.
- **100** (14.11.): Refactor Phase 4, erster Teil, ohne sichtbare Änderung. `render` ist eine Funktion in `js/app.js`, die die benannten Glieder (`renderBefore…`, `renderAfter…`, `renderFinally…`) der anderen Dateien in fester Reihenfolge aufruft, statt 25 Wrappern. Neuer Test `tests/check-render-order.cjs`. Browser-Vergleich alt gegen neu über 241 Schritte ohne DOM-Unterschied, von Codex gegengeprüft.
- **99** (14.11.): Refactor Phase 3 ohne sichtbare Änderung. `validData` ist eine Funktion in `js/app.js` statt 30 Wrappern in 26 Dateien; neue gespeicherte Felder bekommen dort einen Abschnitt. Alt-Neu-Vergleich über 29.250 Eingaben ohne Abweichung, von Codex gegengeprüft. Einziger Unterschied: Startet die App angemeldet mit ungesicherten Änderungen, gilt beim ersten Abgleich schon die volle Prüfung.
- **98** (14.11.): CoFID 2021 und USDA FNDDS 2021–2023 auf Selvirs Wunsch aus dem Katalog entfernt; 20.826 Lebensmittel in `catalog/foods-00…42.json`, Katalog-Cache `puls-catalog-v4`, Filter `cofid` und `fndds` entfernt. Bereits geloggte Einträge behalten Snapshot und Quellenangabe, verlieren aber die erweiterten Nährwerte. Gespeicherte Altschlüssel bleiben gültig und wirkungslos.
- **97** (13.11.): Refactor ohne sichtbare Änderung. Tests für die `validData`-Kette und die Wrapper-Reihenfolge, Anzeigeversion als Konstante `APP_VERSION` in `js/account-refresh.js`, 30 kleine CSS-Dateien in `css/style.css` zusammengeführt (13 statt 42 Stylesheets, gleiche Regeln in gleicher Reihenfolge).
- **96** (13.11.): CNF 2026 (2.573), CoFID 2021 (2.636) und USDA FNDDS 2021–2023 (5.431) im Katalog, zusammen 28.893 Lebensmittel in `catalog/foods-00…58.json`; Quellenfilter `cnf`, `cofid`, `fndds`; Nährstoff-Sidecars `catalog/nutrients-v2-*.json` für alle Quellen; Katalog-Cache `puls-catalog-v3`. CNF-Portionen nur aus benutzerdefinierten Maßen (Typ 6), CNF-Niacin-Äquivalent aus Code 409. Namen der neuen Einträge sind englisch. Details: [FOOD-DATABASES.md](FOOD-DATABASES.md), [NUTRIENT-MAPPING.md](NUTRIENT-MAPPING.md).
- **95** (12.11.): bis zu 63 zusätzliche Nährwerte je Katalog-Lebensmittel (BLS 4.0, USDA SR Legacy, USDA Foundation, Ciqual) als nachladbare `catalog/nutrients-v1-*.json`; Produktdetail „Alle Nährwerte“, Tagesansicht „Alle Nährstoffe“, neue optionale Felder `ck` und `nx`. Nachkorrektur: Prüfsummen zeilenendenunabhängig (GitHub „Web checks“ war rot).
- **94** (09.11.): Ränge neu kalibriert (18 Ränge auf 40 Stufen, 4 neue über Tren Cougher); UI-Sammelkorrektur (Seiten starten oben, Englisch komplett, Erklärtexte entfernt, Wischen, Farbschema, iPhone-Funktionen, Freunde).
- **93** (09.11.): Rangskala v2 (14 Ränge, 40 Stufen), Routinen-Favoriten, `backend/friends-strength-v2.sql` live ausgeführt.
- **92** (09.11.): Ränge ab dem ersten Workout, Liftoff-Import mit automatischer Einheit im Erststart, Statusleiste je Schema, Profil „Alles eintragen“.
- **91 / 90** (09.11.): Makro-Folie grau; Version 90 = Vollversion 1.0 (Tag `v1.0`): Bereichsfarben, Erklärtexte entfernt, Logikkorrekturen.

## Nächste Schritte

1. Refactor nach Plan in [ISSUES.md](ISSUES.md).
2. Weitere freie Datenbanken nur mit geklärter Lizenz (Fineli CC BY 4.0 ist nicht geladen; Schweizer Datenbank nur nach schriftlicher Klärung; NCCDB, NEVO, NZ FOODfiles, BDA, BEDCA, ÖNWT scheiden aus Lizenzgründen aus).
3. iPhone-Test (auch Ladezeit des größeren Katalogs), Freunde mit zwei echten Konten und echte RLS-Prüfung sind weiter offen.

## Veröffentlichen

1. Änderungen prüfen lassen (größere Änderungen durch einen unabhängigen Prüfer).
2. `node scripts/bump-version.cjs` erhöht Version, Asset-Parameter und SW-Cache überall; Katalog-Cache in `sw.js` bei neuen Katalogdateien separat erhöhen.
3. `node scripts/check.cjs` muss grün sein; Diff ansehen.
4. Commit, Push auf `main` mit System-Git und Credential Manager.
5. Live-Check: GitHub „Web checks“ grün, GitHub Pages ausgeliefert, betroffene Live-Dateien und Versionsanzeige prüfen.
6. Danach diese Datei (`PROGRESS.md`) knapp aktualisieren.

Werkzeuge auf diesem PC und das KI-Team: siehe [AI-TEAM.md](AI-TEAM.md).
