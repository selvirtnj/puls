# Gesamt-Audit — Abschlussbericht

Stand: 26.10.2026. Branch `refactor/comprehensive-app-audit` (HEAD `b2ae598`), Baseline-Tag `audit-baseline-v69` (`7767078`). **Nicht veröffentlicht:** kein Push, nicht auf `main`, keine Versionserhöhung. Dieser Bericht behauptet keine Fehlerfreiheit; alle Aussagen unten sind auf die genannten Prüfungen beschränkt.

## 1. Zusammenfassung

- 13 Commits seit der Baseline; 36 Dateien, +1252/−219 Zeilen (`git diff --stat audit-baseline-v69 HEAD`). Funktionen und Design wurden erhalten; `ios/` und `CLAUDE.md` blieben unberührt.
- Sicherheit/Zuverlässigkeit: Lese-Audit mit 12 Befunden (`QUALITY-REPORT.md`), kein XSS-, Secret- oder RLS-Quelltextbefund (nur statisch). Die Sync-/Speicherbefunde wurden in mehreren Runden mit Codex- und Claude-Reviews behoben (Details in Abschnitt 4 und 5).
- UI-Audit im Browser (390 × 844, 320 × 568, 768 × 1024): 12 Befunde, 7 behoben, 1 teilweise, 4 offen bzw. Geschmack (`UI-AUDIT.md`).
- Aufgeräumt: `js/visuals.js` und `css/visuals.css` entfernt (Browser-Vorher/Nachher-Hashes identisch).
- Neue Tests: `tests/check-cloud-robustness.cjs` (371 Zeilen), `tests/check-audit-ui.cjs`; erweitert u. a. `check-onboarding.cjs`. Letzter `node scripts/check.cjs`: Exit 0 auf `b2ae598` (vom Koordinator ausgeführt).
- Codex-Abschlussreview (adversarial) fand einen P2 (Recovery-Übergang), behoben in `b2ae598`; Nachprüfung: Merge-Empfehlung „ja“.
- Echte Geräte-, Live-Supabase/RLS- und Offline-SW-Prüfung fehlen (Abschnitt 2).

## 2. Verifikationsbericht

### Getestet — PASS
- `node scripts/check.cjs`: Exit 0 auf `b2ae598` (Koordinator). Baseline auf v69: Exit 0, 109 PASS-Zeilen, 0 Fehlschläge.
- HTTP-Ladetest (Baseline v69, `scripts/serve.cjs`): 94/94 Anfragen 200. Nach den Änderungen nicht wiederholt.
- Browser 390 × 844 (Hell/Dunkel), Chromium im Claude-Browser-Pane, nur lokale Testdaten: Tabs/Navigation, Übersicht, Ernährung inkl. Komma-Eingaben, Messungen, Training (Satz, Pause, Abschluss), Lauf-Ansicht (ohne GPS), Konto-Seiten, Vorschau-Modus, Fokus-Sichtbarkeit, Kontrast (keine Texte unter 4,5:1 auf 4 Tabs), zugängliche Namen.
- 320 × 568 und 768 × 1024: kein horizontales Überlaufen (Titel bei 320 px nach UI-4-Fix ohne Abschneiden).
- Nach Fixes im Browser: UI-1, UI-2, UI-3 (Timer gesetzt), UI-4, UI-8, UI-9, UI-10, `visuals`-Entfernung (Hash-Vergleich).
- Mock-Tests (VM, lokale Fixtures): Sync-Robustheit (Login-Sicherung, dauerhafte Upload-Sperre, Import-Entsperrung, Logout-Sicherung, Rotation, Cloud-Konfliktkopie, Byte-Grenze, `finishRecovery`), entprelltes Speichern mit Flush, Onboarding-Modus, Pluralformen, Dezimalkomma.
- Codex-Abschlussreview: alle 89 JS-/CSS-Verweise aus `index.html` im SW abgedeckt, alle 105 ASSETS-Einträge existieren, keine Verweise auf gelöschte Visuals-Dateien (Stand `38df560`).

### FAIL
- Keiner im letzten Lauf. Zwischenstände mit Befunden siehe Abschnitt 5 (alle behoben).

### Nicht getestet
- Echtes iPhone/Safari: Safe Areas, Tastatur, Wischgesten, Haptik, Ton, Prozessbeendigung ohne Lifecycle-Ereignis.
- Live-Supabase und echte RLS (nur Quelltext `backend/accounts.sql` gelesen); angemeldeter Sync im Browser.
- Echtes Speicherkontingent (Voll-Speicher-Fälle nur mit Mocks), großes Profil (Befund 4 Kosten).
- Echter Offline-Service-Worker im Browser (nur Mock-SW/Cache).
- GPS-Lauf, Kamera/Barcode, englische Oberfläche.
- Browser-Layout erneut nach den Sync-Commits `fac7dcd`–`b2ae598` (Browserprüfung stammt von früheren Ständen; UI-nahe Sync-Hinweise nicht im Browser gesehen).

### Restrisiken
- Wrapper-Ketten: kein Test lädt alle 58 Body-Skripte; letzte wirksame Definitionen sind nur in Teilmengen getestet (`TEST-MATRIX.md`). Ohne eigenen Test: `catalog-worker.js`, `cloud-config.js`, `icons.js`, `page-slide.js`, `preview-mode.js`, `refinement.js`, `run-map.js`, `session-focus.js`, `training-polish.js`, `training-tabs.js`.
- Neue Recovery-/Rotation-/Sperrlogik in `cloud.js`/`app.js` ist komplex und mehrere Zustandsflags kommen zusammen (Codex: Flags sollten vereinheitlicht werden); bisher nur per Mock geprüft.
- Beim Release muss `sw.js` die neuen ASSETS ohne `visuals` laden; ein Versionsmix nach Veröffentlichung ist erst nach `bump-version.cjs` und Live-Check ausgeschlossen.
- OFF-Online-Suche von `localhost` scheitert an CORS (UI-5), auf `github.io` ungeprüft.

### Manuelle Prüfung auf dem iPhone (vor/nach Veröffentlichung)
1. Neues Konto/Erststart: Onboarding Schritt 2 zeigt „Berechnet“ vorgewählt, Ziel-kcal der Vorschau entspricht der Übersicht; „Selbst“ mit eigenem Wert bleibt erhalten.
2. Workout: im Satzfeld tippen (auch „0“, Komma bei kg) — kein Toast/Fokusverlust bei Zwischenwerten, Wert bleibt nach App-Wechsel und Neustart erhalten.
3. Dezimalwerte (Ernährung, Gewicht, Maße, Profil): Komma-Eingabe und -Anzeige.
4. „1 Übung“/„1 Messung“/„1 Eintrag“ im Kalender und Körper-Bereich.
5. Anmelden mit bestehendem Cloud-Profil und lokalen Daten: Konflikthinweis, Wahl „lokal“ bzw. „Cloud“, danach Neustart — kein erneuter Konflikt, Sync-Status „synchronisiert“.
6. Konto verwalten: Datenexport, Import einer Sicherung, Abmelden, Konto löschen (nur mit Testkonto).
7. Flugmodus: App aus Home-Bildschirm starten, Seiten wechseln, Eintrag speichern, Verbindung wiederherstellen.
8. Nach Update: App einmal neu laden; Versionsanzeige und Seiten ohne gemischte alte Styles.
9. Plus-Menü (9 Einträge), Ernährung-Suche/Barcode/Rezepte/Foto, Lauf starten/beenden.
10. Hell/Dunkel und 320-/390-px-Gerät: Titel, Tab-Leiste, Safe Area, Tastaturverdeckung der Speichern-Leisten.
11. Online-Suche (Open Food Facts) auf der Live-Seite.

## 3. Aufräumbericht

| Entfernt | Grund |
|---|---|
| `js/visuals.js` | Wrapper reichen bei `currentDesign()==='classic'` (fest) durch; `themedFoodActions`/`nutrientDetailBlock` nur in toten Zweigen; Browser-Hashes (innerHTML, innerText, Styles) für Übersicht, Ernährung, Training, Konto, Essen-Dialog, Schnellerfassung vorher/nachher identisch. |
| `css/visuals.css` | Alle Regeln an `.foodscreen`/`.orbitfoodgrid`/`.ledgerextras`, die nur der tote Zweig erzeugte; 0 Treffer in den geprüften Ansichten. |
| Menüeintrag „Text & Sprache“ (`quick-units.js`) | in `CURRENT-STATE.md` bereits als entfernt entschieden (UI-10); `nutritionInputForm` bleibt, da weiter aufgerufen. |

Angepasst: `index.html`, `sw.js` (ASSETS), `tests/check-premium.cjs`, `tests/check-color-offline.cjs`, `docs/ARCHITECTURE.md`.

**Bewusst nicht entfernt / offen:** `js/designs-extra.js` (ergänzt `appDesigns`-Schlüssel; ohne ihn lehnt `validData` alte Designschlüssel ab — nur nach Migration entfernbar), `js/flows.js` (REQUIRED). Toter Code für später: `compact.js:16` `themedFoodActions`, `designs-extra.js:11` Nicht-Classic-Zweig, tote Selektoren `css/comfort.css:8` und `css/compact.css:14`.

## 4. Multi-Agent-Bericht

### Beteiligte (tatsächlich)
- Claude-Koordinator.
- Claude-Subagenten: `puls-reviewer` (Lese-Audit Sicherheit/Performance, zwei Reviews der Codex-Fixes), `puls-backend` (Fixes zu Befunden 2, 3, 9, 11 und zu Codex-Review 1, in nächtlicher geplanter Sitzung), `puls-frontend` (Browser-Baseline/UI-Audit, UI-Fixes, `visuals`-Entfernung), `general-purpose` (README).
- Codex (echt): Review 1, Review 2, Backend-Entwickler (3 Läufe plus 1 Abbruch „model at capacity“, Wiederholung erfolgreich), Abschlussreview adversarial, Nachprüfung.
- **Nicht beteiligt:** Gemini (Kontingent bis ca. 31.10. erschöpft). Codex-Lese-Audit um 03:41 und 06:50 lief nicht (Limit); `codex-audit-1.md` existiert deshalb nicht.
- Zeitweise arbeitete eine zweite Sitzung parallel in derselben Arbeitskopie (siehe `PROGRESS.md`); die Änderungen wurden getrennt committet.

### Wichtige Entscheidungen und Meinungsverschiedenheiten
Reviewer-Befunde (7, u. a. „volle Rohsicherungsplätze blockieren Speichern dauerhaft“) zu `fac7dcd`:

| Entscheidung | Für | Wider |
|---|---|---|
| Rotation der Rohsicherungen statt Speichersperre | Speichern bleibt möglich, neueste Rohdaten bleiben erhalten | etwas mehr Speicherverbrauch/Logik |
| 4-s-SW-Zeitlimit zurückgenommen | Zeitlimit kann Versionsmix (alter Cache + neue Skripte) auslösen | Langsame Netze warten länger auf die Navigation |
| App-Hülle nur für `index` cachen | verhindert gemischte Stände | weniger Fallback-Abdeckung |
| Grenze 4.000.000 Byte | `jsonb::text` ist ca. 14 % größer als die Client-Länge; Server-Grenze 5 MB bleibt unterschritten | Profile knapp darunter werden früher abgelehnt |
| Eigener Schlüssel für Cloud-Konfliktkopie | überschreibt keine anderen Sicherungen | ein weiterer Schlüssel |
| Eine Vorimportkopie | begrenzt Speicher | nur ein Rückweg |
| Abgelehnte Revision merken | verhindert Dauerschleife/Überschreiben | zusätzlicher Zustand |

Nachprüfung durch `puls-reviewer`: alle 7 geschlossen; 2 neue Befunde (Quota-Fall überschrieb Rohtext → jetzt `puls-v1-recovered`; Kontolöschen ließ Cloud-Kopie liegen), behoben in `38df560`.

UI-Entscheidungen: UI-1 Onboarding „Berechnet“ vorgewählt, gewählter Modus wird gespeichert (statt stilles Überschreiben von „Selbst“). UI-10 „Text & Sprache“ entfernt, da laut `CURRENT-STATE.md` bereits so entschieden.

## 5. Codex-Ergebnisse

| Lauf | Gegenstand | Ergebnis | Umgang |
|---|---|---|---|
| Lese-Audit (03:41, 06:50) | Gesamtcode | nicht gelaufen (Limit) | nicht ersetzt durch Simulation |
| Review 1 (07:29) | `c90c8de` | 5 Befunde (2× P1, 3× P2): Login-Sicherung, Neustart umgeht Upload-Sperre, Import entsperrt nicht, Logout-Änderungen, Rohdaten-Sicherung ungeschützt | alle angenommen und behoben (`28c0c6e`) |
| Review 2 (~08:00) | `d59d1e0..abbcb85` | 2 Restlücken (P1 Sperre übersteht Speicherfehler nicht; P2 ältere Rohsicherung verdeckt aktuellen Rohtext); Teil B (UI) ohne Befund | angenommen; Korrekturen in `fac7dcd` |
| Backend-Entwickler | Sync-Fixes | 3 Läufe, 1 Abbruch (Kapazität), Wiederholung erfolgreich | Diff vom Koordinator geprüft |
| Abschlussreview (~08:45) | `audit-baseline-v69..38df560` | 1 P2 (Recovery-Übergang), sonst keine P1/P3; Merge-Empfehlung „ja nach Fix“ | angenommen; Fix `b2ae598` |
| Nachprüfung | `b2ae598` | P2 geschlossen, keine neue Regression, Merge-Empfehlung: ja | siehe `codex-review-final.md` |

Abgelehnt/geändert: keine Codex-Empfehlung wurde abgelehnt. Geändert wurden Umsetzungsdetails durch die Reviewer-Entscheidungen oben (Rotation, SW ohne Zeitlimit, Byte-Grenze). Codex-Hinweis zur Vereinheitlichung der Zustandsflags ist als Restrisiko offen; pauschale Rücknahme der Schutzmaßnahmen wurde von Codex selbst nicht empfohlen. Weitere Codex-Hinweise aus Review 1 (globale Wrapper-Abhängigkeiten, geräteweite Backup-Schlüssel, Vollprofil-Sync, direkte Tabellen-Schreibwege neben dem CAS-RPC, fehlende echte Integrationstests) sind unverändert offen.

### Stand der Qualitätsbefunde (`QUALITY-REPORT.md`)
Behoben laut Commits/Berichten: 2, 3, 9, 11 (`c90c8de`), 4, 5 (UI-Fixes, `abbcb85`), 1, 6, 7, 8, 10, 12 (`fac7dcd`, korrigiert in `93327eb`: Revision-zuerst-Abgleich mit gemerkter abgelehnter Revision, sichere Importe, getrennte Konfliktsicherungen, Hinweis „Bitte App aktualisieren“, 4.000.000-Byte-Grenze). Befund 10 mit Änderung: Cache-Fallback bei Netz- und HTTP-Fehlern umgesetzt, das zusätzliche 4-s-Zeitlimit wegen Versionsmix-Risiko bewusst zurückgenommen. Alle mit Regressionstests in `tests/check-cloud-robustness.cjs` (Mock/VM) und vom Claude-Reviewer nachgeprüft.

## 6. Abnahmekriterien

| Kriterium | Status | Beleg / Grenze |
|---|---|---|
| Arbeit nur auf Audit-Branch, kein Push/Deploy/Merge | erfüllt | Branch lokal, keine Versionserhöhung |
| `ios/` und `CLAUDE.md` unverändert | erfüllt | nicht im Diff |
| Funktionen/Design erhalten | teilweise | Browser-Vergleich für `visuals`-Entfernung und Tests; kein vollständiger Funktionsvergleich auf Gerät |
| `node scripts/check.cjs` grün | erfüllt | Exit 0 auf `b2ae598` |
| Inventar, Testmatrix, Quality-/UI-Report | erfüllt | `docs/audit/*.md` |
| Sicherheits-/Datenintegritätsbefunde behoben | teilweise | Mock-Tests und Reviews; keine Live-RLS, kein echtes Kontingent |
| UI-Audit im Browser 390 × 844 | teilweise | Chromium-Pane; kein echtes iPhone; Sync-Commits nicht erneut im Browser |
| UI-Befunde behoben | teilweise | UI-5, UI-6, UI-11, UI-12 offen; UI-7 teilweise (Tippflächen < 44 px) |
| Aufräumen toter Code | teilweise | `visuals` entfernt; `designs-extra.js`, `compact.js:16`, tote Selektoren offen |
| Unabhängiges Codex-Review | erfüllt (mit Lücke) | 4 echte Läufe plus Nachprüfung; Lese-Audit nicht gelaufen |
| Gemini-Beteiligung | unverifiziert | nicht verfügbar |
| Offline-/SW-Verhalten | unverifiziert | nur Mock |
| Live-Supabase/RLS | unverifiziert | nur Quelltext |
| iPhone-Test | unverifiziert | offen, Checkliste in Abschnitt 2 |
| Veröffentlichung | offen | Vorgehen: `node scripts/bump-version.cjs` (SW lädt neue ASSETS ohne `visuals`), `node scripts/check.cjs`, Merge, Push, Live-Check |
