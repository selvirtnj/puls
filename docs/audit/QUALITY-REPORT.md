# Qualitäts-, Sicherheits- und Performance-Audit (Lese-Audit)

Stand: Commit `d26f9f3`, 26.10.2026. Prüfer: Claude-Subagent `puls-reviewer` (lesend). Nur statisch geprüft, keine Browser-/iPhone-/Live-RLS-Prüfung.

## Ohne Befund (statisch)
- **XSS:** zentrale Escape-Funktion `esc` (js/app.js:10) wird durchgängig genutzt; Open-Food-Facts-Daten über `esc` (food-flow.js, food-upgrade.js); IDs werden bei Import/Sync per Regex beschränkt; Profilbild-`src` als Data-URL geprüft.
- **Secrets:** nur Publishable Key (js/cloud-config.js).
- **RLS (Quelltext):** backend/accounts.sql prüft `auth.uid()=user_id`; Live-Einrichtung NOT TESTED.

## Befunde
| # | Schwere | Status | Ort | Befund | Fix-Vorschlag |
|---|---|---|---|---|---|
| 1 | mittel | CONFIRMED | cloud.js | Abgleich lädt alle 30 s das komplette Profil (bis 4,5 MB) | erst `revision` abfragen, Daten nur bei Abweichung |
| 2 | mittel | CONFIRMED | app.js, cloud.js | Beschädigtes `puls-v1` → leerer Start, nächstes `save()` überschreibt Rohdaten, ggf. Upload des leeren Profils | Rohtext sichern, Sync sperren |
| 3 | mittel | CONFIRMED | cloud.js | `localStorage.setItem` ohne try/catch im `save`-Wrapper → bei vollem Speicher bricht UI-Ablauf ab | try/catch |
| 4 | niedrig–mittel | CONFIRMED | workout-polish.js, training.js, interactions.js | `save()` bei jedem Tastendruck (2× stringify + Prüfsumme) | entprellen / `onchange` |
| 5 | niedrig | CONFIRMED | app.js | ungültiger Zwischenwert bei `oninput` → Toast + render, Fokusverlust | erst bei `change` prüfen |
| 6 | niedrig | CONFIRMED | app.js / enhancements.js | Import: speichern vor `migrate()`, keine Sicherung des alten Stands | erst migrieren, alten Stand sichern |
| 7 | niedrig | CONFIRMED | cloud.js | Konflikt „lokal übernehmen“ überschreibt Cloud-Stand ohne lokale Sicherung | `row.payload` vorher sichern |
| 8 | niedrig | PLAUSIBLE | cloud.js | veralteter Client lehnt neuere Remote-Daten dauerhaft ab | Hinweis „App aktualisieren“ |
| 9 | niedrig | CONFIRMED | index.html | `js/recipes.js` ohne `?v=69` → nach Release kurz Versionsmix möglich | `?v=` ergänzen |
| 10 | niedrig | CONFIRMED | sw.js | Navigation netz-zuerst ohne Zeitlimit; 404/5xx statt Cache | Zeitlimit, bei `!ok` Cache |
| 11 | niedrig | CONFIRMED | cloud.js | Nicht-JSON-Fehlerseite → technischer `SyntaxError` für Nutzer | Parsen absichern |
| 12 | niedrig | PLAUSIBLE | cloud.js vs. accounts.sql | Client zählt Zeichen (4,5 Mio.), Server Bytes (5 MB) | Bytegröße prüfen |

Weitere Strukturbefunde (Wrapper-Ketten, Testlücken, Verdacht auf toten Design-Code) stehen in `FEATURE-INVENTORY.md` und `TEST-MATRIX.md`.

Umgesetzte Korrekturen: siehe `docs/audit/PROGRESS.md` (Log).
