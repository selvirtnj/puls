# PULS — Backend-Übergabe

Lesende Quellcodeprüfung zur Team-Einrichtung am 24.10.2026. Keine erneute Live-Prüfung von Supabase, Nutzern oder produktiven Einstellungen.

## Modell und Auth

`backend/accounts.sql` definiert `public.puls_profiles`: ein JSON-Profil pro `auth.users.id`, Revision und Zeitstempel. FK-Löschkaskade, maximal 5 MB Payload, Objektform. Essen, Workouts und Körperdaten bleiben im gemeinsamen `state`; es gibt keine zweite normalisierte Backend-Datenbank.

`cloud.js` verwendet Supabase Auth mit E-Mail/Passwort, Bestätigungsablauf und Refresh-Token. Passwörter gehören nicht ins Profil. Access-/Refresh-Token liegen im Browser-Speicher; dieser ist nicht verschlüsselt. Der öffentliche Publishable Key in `cloud-config.js` ist Client-Konfiguration, kein Administrationsschlüssel.

## Synchronisierung

Lokal sofort speichern, Upload nach etwa einer Sekunde. Zusätzliche Synchronisierung bei Online-/Sichtbarkeitswechsel und periodisch. `puls_save_profile(expected_revision,payload)` verwendet Compare-and-swap. Bei Konflikt stoppen automatische Uploads; Nutzer entscheidet zwischen lokalem und entferntem Stand. Konfliktkopien und ausstehende Änderungen erhalten.

Wichtige Grenze: Das SQL gewährt `authenticated` auch direkte INSERT-/UPDATE-Rechte auf die eigene Profilzeile. RLS schützt die Nutzergrenze, aber ein eigener API-Client kann den RPC-Revisionsweg umgehen. Verbindliche Revisionsregeln sind deshalb nicht bei allen möglichen DB-Schreibwegen erzwungen. Ein späterer Umbau muss Rechte, RPC und Migrationskompatibilität gemeinsam prüfen.

Die serverseitige Payload-Prüfung ist flach; die ausführliche `validData()` läuft im Client. Keine vollständige serverseitige Schemaprüfung behaupten. Manche Backup-Schlüssel wie `puls-cloud-conflict-backup` und `puls-cloud-local-before-login` sind geräteweit; Benutzerwechsel auf gemeinsam genutzten Geräten brauchen besondere Tests.

## Reset und Löschung

Reset nutzt den normalen revisionsgeprüften Speicherweg. `backend/account-delete.sql` beschreibt eine `SECURITY DEFINER`-Funktion mit leerem `search_path`, nur für `authenticated`, Bestätigung `DELETE` und Nutzer-ID ausschließlich aus `auth.uid()`.

Für die Löschung muss die signierte `session_id` zu einer höchstens fünf Minuten alten `auth.sessions`-Zeile gehören. Das Frontend meldet denselben Nutzer erneut per Passwort an. Erst nach bestätigter Serverantwort wird lokal gelöscht. Kein beliebiger Nutzer-ID-Parameter, kein Admin-Key im Client. Niemals ein echtes Nutzerkonto als Funktionstest löschen.

## Was ein Folgeagent prüfen muss

- Backend-Quellen sind keine Garantie, dass dieselbe Migration aktuell live liegt.
- Historische Dokumente berichten eine frühere Einrichtung und einzelne Prüfungen. Nicht als heutige Sicherheitsabnahme darstellen.
- Kein vollständiger XSS-Audit wurde für diese Übergabe durchgeführt. Unsichere Skripte könnten Browser-Token und Profilinhalte auslesen.
- Vor Nutzung durch mehr Freunde: reale Isolation zwischen zwei ausdrücklich eingerichteten Testkonten, SMTP/Auth-Mailversand, Redirects, Limits, Offline-Anmeldung, Konflikte und Backup-Wiederherstellung prüfen.
- E-Mail-Bestätigung nicht als bequemen Workaround abschalten. Keine neuen Berechtigungen oder SQL-Änderungen ohne Prüfung des konkreten Nutzerauftrags und geltender Freigaben.

## KI-Essensfoto (Supabase Edge Function + Gemini), vorbereitet 08.11.2026

Quelltext: `supabase/functions/food-photo/index.ts`, Limit-Migration `backend/food-photo.sql`, Client `js/food-photo.js`. Noch nicht live eingerichtet.

Ablauf: Client (nur angemeldet, online) verkleinert das Foto auf ≤ 1024 px JPEG und sendet es mit optionaler Beschreibung (≤ 1200 Zeichen) und Nutzer-JWT an `/functions/v1/food-photo`. Die Funktion prüft Origin (`https://selvirtnj.github.io`, lokale Vorschau `127.0.0.1:4173`/`localhost:4173`), JWT über `/auth/v1/user`, Größe/JPEG-Format, dann das Limit per RPC `puls_food_photo_allow()` (nutzt nur `auth.uid()`; 3 pro Minute, 20 pro Tag). Danach Gemini `generateContent` mit `responseJsonSchema`; die Antwort wird geprüft und nur die bekannten Felder weitergegeben. Keine Speicherung oder Protokollierung von Foto, Text, Token oder Google-Fehlern. Schlüssel nur als Secret auf dem Server.

Modell: Standard `gemini-3.8-flash` (laut https://aistudio.google.com/docs/models am 08.11.2026 neuestes Flash-Modell, Gratis-Tarif laut https://aistudio.google.com/docs/pricing; dort: Gratis-Eingaben können zur Produktverbesserung genutzt werden). Überschreibbar mit Secret `GEMINI_MODEL`, z. B. `gemini-3.5-flash-lite` (ebenfalls gratis) bei Limitproblemen.

Einrichtung durch Selvir (einmalig, in dieser Reihenfolge):

1. **Gemini-Schlüssel:** https://aistudio.google.com → „Get API key“ → „Create API key“ (Gratis-Projekt, keine Abrechnung aktivieren). Schlüssel nirgends ins Repository oder in den Chat kopieren.
2. **SQL:** Supabase-Dashboard → SQL Editor → Inhalt von `backend/food-photo.sql` einfügen → Run. Legt nur `puls_food_photo_quota` und die Funktion `puls_food_photo_allow()` an; `puls_profiles` bleibt unverändert.
3. **Secret:** Dashboard → Edge Functions → Secrets (bzw. Project Settings → Edge Functions) → `GEMINI_API_KEY` = Schlüssel aus Schritt 1. Optional `GEMINI_MODEL`. `SUPABASE_URL`/`SUPABASE_ANON_KEY` stellt Supabase selbst bereit.
4. **Funktion:** Dashboard → Edge Functions → „Deploy a new function“ → „Via Editor“ → Name genau `food-photo` → Inhalt von `supabase/functions/food-photo/index.ts` einfügen → Deploy. „Verify JWT“ eingeschaltet lassen. (Alternativ CLI: `supabase functions deploy food-photo`.)
5. **Probe:** In der App angemeldet Essen → Foto → „Foto schätzen (KI)“. Meldung „noch nicht eingerichtet“ = Funktion/Secret fehlt; „Limit erreicht“ = Tageslimit oder Gemini-Gratislimit.

Grenzen: Mock-Tests ersetzen keinen echten Lauf von Edge Function, RPC/RLS oder Gemini. Falls „Verify JWT“ mit neuen JWT-Signaturschlüsseln Anfragen ablehnt, kann es ausgeschaltet werden; die Funktion prüft das Token zusätzlich selbst über Supabase Auth. Das Gratis-Kontingent von Google kann sich ändern. Schätzungen sind ungenau, besonders Öl und Portionsgröße.

## Sichere lokale Prüfung

```sh
node scripts/check.cjs
node tests/check-cloud.cjs
node tests/check-account33.cjs
```

Diese Tests verwenden VM-/Netzwerkmocks. `?erststart=1` isoliert UI-Prüfungen vom echten Profil und Cloud-Sync. Reale SQL-/RLS-Integrationstests erfordern eine separat geprüfte Testumgebung; produktive Nutzerdaten bleiben unangetastet.
