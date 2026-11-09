# Codex-Review 2 — Sync- und UI-Korrekturen

Echter Codex-Lauf (reviewer, high), 26.10.2026 ~08:00, geprüft `d59d1e0..abbcb85`. Wortlaut des Berichts:

CODEX_THREAD=01a176f5-4f67-76d3-be7b-468ec0ebfb9a
Zwei belegte Restlücken in Teil A. Die Sicherungsfixes sind damit noch nicht vollständig.

1. **P1 – Upload-Sperre übersteht einen anfänglichen Speicherfehler nicht.**  
   [js/app.js:9](/C:/Users/selvir/Documents/Codex/PULS/js/app.js:9), [js/app.js:12](/C:/Users/selvir/Documents/Codex/PULS/js/app.js:12)

   **Reproduktion:** Bestehende Cloud-Sitzung, beschädigtes `puls-v1`, Gerätespeicher beim Start voll. Schreiben des Sperrmarkers und der Rohsicherung schlägt fehl. Danach Speicher freigeben und `save()` ausführen: Rohsicherung und Ersatzprofil werden gespeichert, der Sperrmarker wird jedoch nicht erneut geschrieben. Nach Neustart ist `cloudUploadBlocked=false`; der Ersatzstand wird automatisch hochgeladen.

   **Nachweis:** Mit bestehender Sitzung und lokalen Storage-/Netzwerkmocks reproduziert; nach Neustart genau ein `puls_save_profile`-Aufruf mit dem Ersatzstand.

   **Auswirkung:** Der beschädigungsbedingte Ersatzstand kann das vorhandene Cloud-Profil überschreiben.

   **Fix:** Den ausstehenden Sperrmarker verfolgen und erfolgreich persistieren, bevor `puls-v1` durch den Ersatzstand überschrieben werden darf.

2. **P2 – Vorhandene ältere Rohsicherung lässt den aktuellen beschädigten Rohtext verloren gehen.**  
   [js/app.js:9](/C:/Users/selvir/Documents/Codex/PULS/js/app.js:9), [js/app.js:12](/C:/Users/selvir/Documents/Codex/PULS/js/app.js:12)

   **Reproduktion:** `puls-v1` enthält beschädigten Rohtext A; `puls-v1-corrupt` enthält bereits eine ältere Sicherung B. Beim Start wird die Sicherung übersprungen, ohne A in `stateCorruptRaw` zu übernehmen. Das nächste `save()` überschreibt `puls-v1` mit dem Ersatzprofil.

   **Nachweis:** Lokal reproduziert: Danach bleibt nur B erhalten; A ist weder gespeichert noch im Speicher verfolgt.

   **Auswirkung:** Die möglicherweise noch rekonstruierbaren neuesten Daten gehen verloren. Dies ist eine verbliebene Lücke zu A5, keine erstmals durch Teil B eingeführte Regression.

   **Fix:** Nur einen nachweislich identischen Rohtext als bereits gesichert behandeln. Bei abweichender vorhandener Sicherung den aktuellen Rohtext zusätzlich sichern oder das Überschreiben blockieren.

Geprüft wurde `d59d1e0..abbcb85` bei HEAD `abbcb85`, einschließlich Ladereihenfolge und Wrapper-Ketten von `save`, `setValue`, `commitProfile`, `translatedUI` und `exerciseCard`. Die vorgesehenen Login-Abbrüche, Import-Entsperrung, Erhaltung echter Revisionskonflikte und zweite Logout-Sicherung bestehen die vorhandenen Mock-Tests.

**Teil B: kein zusätzlicher belegter Befund.** Ergänzende VM-Prüfungen bestätigen aktuelle Satzwerte beim Workout-Abschluss innerhalb von 400 ms sowie Navigation/Render vor Flush. Der Dezimal-Getter liefert für `Number()` und `parseFloat()` normalisierte Werte. Gezielte Pluralprüfungen einschließlich zusammengesetzter Angaben und Satz-Beschriftungen bestanden. Onboarding-Tests decken gewählten Modus und Erhaltung bestehender Ziele bei unvollständigem Profil ab.

`node scripts/check.cjs`: **Exit 0**. Keine Dateien geändert; vorhandene Änderung an `CLAUDE.md` erhalten. Kein Browser, echtes iPhone-Layout, Safari-Ereignisverhalten, Live-Sync oder Live-RLS geprüft. Die neuen Zusatzprüfungen verwenden ausschließlich lokale Fixtures/Mocks.

RÜCKFRAGEN: Keine.
