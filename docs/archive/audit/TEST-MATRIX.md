# Testmatrix (Audit Phase 2–3)

Stand: 26.10.2026, Branch `refactor/comprehensive-app-audit`, App-Version 69. Status: PASS / FAIL / BLOCKED / NOT TESTED / STATICALLY VERIFIED ONLY.

## Baseline

- `node scripts/check.cjs` (Node `C:\Program Files\nodejs\node.exe`): **PASS**, Exit 0, 109 PASS-Zeilen, 0 Fehlschläge, Laufzeit 14,7 s (inkl. Prozessstart). Letzte Zeile: `PASS: JavaScript syntax, index references and regression suite`.
- HTTP-Ladetest mit `node scripts/serve.cjs` (127.0.0.1:4173, danach beendet): **PASS** — 94/94 Anfragen mit 200: `/?erststart=1`, `/sw.js`, `/manifest.webmanifest`, 59 JS- und 33 CSS-Dateien aus `index.html` (mit `?v=`-Parameter).
- Browser-Layout 390 × 844 (Hell/Dunkel): **NOT TESTED** — macht der Koordinator separat.
- Echte RLS / Supabase-Live: **NOT TESTED** — nur Mock-Transport in `check-cloud.cjs`/`check-color-offline.cjs`.

## Matrix

Spalte „VM-Test“ = Bereich wird in mindestens einem Test aus `tests/` (über `scripts/check.cjs`) ausgeführt. Die Tests laden jeweils nur eine Teilmenge der Skripte; keiner lädt alle 59 Dateien in `index.html`-Reihenfolge.

| Bereich | VM-Test (Datei) | Status VM | HTTP-Ladetest | Browser-Layout | Echte RLS |
|---|---|---|---|---|---|
| Grundlage/Zustand/`validData`/Import | check-premium, check-cloud, check-profile-planning, check-running | PASS | PASS | NOT TESTED | — |
| Tabs/Navigation/Seitenwechsel | teilweise check-premium (navigation.js); page-slide.js, training-tabs.js, session-focus.js, refinement.js ohne Test | PASS (Teil) / keine Abdeckung für die genannten | PASS | NOT TESTED | — |
| Übersicht | check-profile-planning (activity-overview), check-food-navy (design-system) | PASS | PASS | NOT TESTED | — |
| Training | check-premium, check-machines35, check-exercise-muscles, check-small-polish (rest-popup, workout-controls); training-polish.js ohne Test | PASS | PASS | NOT TESTED | — |
| Ernährung | check-food32, check-account33, check-small-polish, check-premium, check-food-navy; catalog-worker.js nur indirekt (Relevanzregel, kein Worker-Test gefunden) | PASS | PASS | NOT TESTED | — |
| Messungen/Fortschritt/Navy-KFA | check-food-navy, check-exercise-muscles, check-refinement34, check-profile-planning | PASS | PASS | NOT TESTED | — |
| Lauf/Aktivitäten | check-running, check-run-metrics, check-profile-planning; run-map.js (Karte/Leaflet) ohne Test | PASS (ohne Karte) | PASS (Leaflet nicht abgefragt, nur in sw.js) | NOT TESTED | — |
| Konto/Sync | check-cloud, check-onboarding, check-account33, check-color-offline (Mock-Transport); cloud-config.js ohne Test | PASS (Mock) | PASS | NOT TESTED | NOT TESTED |
| Offline/Service Worker | check-color-offline (Mock-SW/Cache), check-app-icons | PASS (Mock) | PASS | NOT TESTED | — |
| Designs/Farbschema/Icons | check-color-offline, check-app-icons, check-refinement34; icons.js ohne Test | PASS (Teil) | PASS | NOT TESTED | — |
| Haptik/Ton | check-small-polish | PASS | PASS | NOT TESTED | — |
| Vorschau-Modus | check-preview lädt nur app.js; preview-mode.js ohne Test | STATICALLY VERIFIED ONLY | PASS | NOT TESTED | — |
| Native-Bridge | check-native-scanner, check-running/check-run-metrics (Mock) | PASS (Mock) | PASS | NOT TESTED (kein echtes iOS) | — |
| Kamera/Barcode/Foto | check-native-scanner (Mock-Canvas, keine echte Kamera) | PASS (Mock) | PASS | NOT TESTED | — |

## Ohne automatische Tests

JS-Dateien, die in keinem Test unter `tests/` namentlich vorkommen (Grep nach Dateinamen; außer dem Syntax-Check in `check.cjs`):
`catalog-worker.js`, `cloud-config.js`, `icons.js`, `page-slide.js`, `preview-mode.js`, `refinement.js`, `run-map.js`, `session-focus.js`, `training-polish.js`, `training-tabs.js`.

Weitere Lücken:
- Kein Test lädt die vollständige Wrapper-Kette aller 58 Body-Skripte; die letzte wirksame Definition von z. B. `render` (20 Fundstellen), `validData` (24), `accountPage` (27) ist nur in Teilmengen getestet.
- Kein CSS-/Layout-Test; alle Layoutaussagen hängen an Browser-Prüfung.
- Keine echte RLS-, Kamera-, GPS-, Audio- oder Wischgesten-Prüfung (VM-Grenzen).
