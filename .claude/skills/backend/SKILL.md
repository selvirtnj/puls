---
name: backend
description: PULS-Daten ändern. Datenmodell, validData, Migration alter Profile, Supabase-Auth, Sync, Konflikte und SQL.
---

# PULS-Daten und Backend

Lies zuerst `docs/BACKEND-HANDOFF.md`. Die Web-App besitzt Daten, Anmeldung und Synchronisierung; die iOS-Hülle lädt nur die Web-App.

## Daten bleiben lesbar

- Jedes neue gespeicherte Feld gehört in `validData()`. Alte Sicherungen ohne das Feld müssen weiter laden; bei Formatwechsel verlustfrei migrieren.
- Workout-IDs, Übungs-IDs, gespeicherte Nährwert-Snapshots und alte Messungen behalten ihre Werte.
- Fehlende Nährwerte, Trainingszeiten oder Messpunkte bleiben leer. Gramm und Milliliter nur mit ausdrücklicher Dichte umrechnen.

## Sync und Sicherheit

- Der Sync prüft Revisionen und legt bei Konflikten Sicherungen an. RLS trennt nach eigener Nutzer-ID. Beides bleibt erhalten.
- Der Supabase-Publishable-Key ist öffentliche Client-Konfiguration. `service_role`, Secret Keys, Passwörter und Tokens gehören nie ins Repository oder in ein Protokoll.
- SQL-Dateien sind Quelltext. Sie belegen nicht, was live eingerichtet ist, und Mock-Tests belegen keine echte RLS.
- Serveränderungen als Migration in `supabase/` oder `backend/` vorbereiten. Auf dem Live-Backend führt sie nur Selvir oder der Koordinator mit seinem Auftrag aus.

## Prüfen

- Tests mit lokalen Fixtures und Mocks. Echte Konten, Profile und Logs werden nicht zum Testen verändert.
- Für jede Daten- oder Sync-Änderung einen Test, der den alten Stand lädt und den Konfliktfall abdeckt.
- `node scripts/check.cjs`.
