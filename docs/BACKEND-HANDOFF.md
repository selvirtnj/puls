# PULS — Backend-Übergabe

## Freunde-Ränge v87 — lokal vorbereitet, 09.11.2026

`backend/friends-ranks.sql` baut auf `backend/friends.sql` auf und wurde hier **nicht ausgeführt**. Zunächst in einer separaten Testumgebung mit der bestehenden Freunde-Migration prüfen, anschließend nach Review durch Selvir/Koordinator als vollständige Transaktion im Supabase-SQL-Editor einspielen. Wiederholtes Einspielen erhält Zeilen, Kennungen und XP. Nicht anschließend die ältere `friends.sql` erneut einspielen: sie würde die alte Publish-Signatur als zusätzlichen Overload anlegen.

Die Migration ergänzt `puls_friend_profiles.xp` (nullable Integer 0–10.000.000, ohne Default), ersetzt die sechsteilige Publish-Signatur durch genau eine siebenteilige mit optionalem `p_xp DEFAULT NULL` und erweitert `snapshot` um XP für `self` und angenommene Freunde. Neue/alte Aktivierungen ohne XP bleiben `NULL` („Rang unbekannt“); Updates ohne XP erhalten den bisherigen Wert. Erneutes Einspielen entfernt auch `NOT NULL`/Default einer früheren v87-Spalte; vorhandene Werte einschließlich echter 0 bleiben erhalten. Bereits durch einen früheren Default erzeugte 0 sind nicht von echten 0 unterscheidbar und werden nicht nachträglich umgedeutet. Alle bisherigen Revisionsprüfungen, Owner-Grenzen, Opt-in-, RLS- und RPC-Rechte bleiben erhalten; keine Payload-/Auth-/Profilrechte werden ergänzt. `action`, `nudge`, `read` und `disable` bleiben unverändert. Level/Rang werden im Client aus XP abgeleitet. XP sind weiterhin Eigenmeldungen, kein serverseitig verifiziertes Leistungsergebnis.

Der neue Client wiederholt eine durch 404/PGRST202 abgelehnte XP-Publikation einmal ohne `p_xp` und merkt sich das fehlende Argument bis zum Neuladen. Ohne gültige XP liefert die Datenschicht `xp:null`; die Ranglisten-UI muss dafür „Rang unbekannt“ anzeigen. `window.pulsFriendsData87.getSnapshot()` liefert eine unabhängige Kopie des bereinigten aktuellen Snapshots oder `null` bei fehlenden Daten/Kontowechsel. Nach SQL-Einbau die App neu laden (Schema-Cache-Neuladen wird außerdem per `NOTIFY pgrst` angefordert).

Vor Live-Einbau mit separaten Testkonten A/B/C prüfen: neue und alte Publish-Argumente, `NULL` erhält XP, Grenzwerte/ungültige Werte, veraltete Revisionen, fremde Zeilen und anonyme/direkte Tabellenzugriffe abgewiesen, XP ausschließlich für `self` und angenommene Freunde, kein XP in offenen Anfragen, erneutes Einspielen ohne Verlust. Lokal: `tests/check-friends.cjs` prüft Mocks und SQL-Quellverträge; `tests/check-v87-data.cjs` prüft die XP-/Rangschwellen. Keine PostgreSQL-Ausführung und kein Live-RLS-Nachweis. Integration, unabhängiges Claude-/Gemini-Review, `CURRENT-STATE.md` und gemeinsame Release-Versionierung liegen beim Koordinator.

### P1/P2-Reviewkorrekturen, 09.11.2026 (lokal, ohne Versionswechsel)

- `cleanFitnessState()` ist ausschließlich Reset-/Löschlogik: Kombis, Wasserziel, Wassermodus, Makro-Eingabe/Verhältnis und `display.lastRankSeen` werden entfernt. Anzeige-/Suchpräferenzen und `water.glassMl` dürfen bleiben. Der echte `exportData()`-Pfad aus `app.js` exportiert weiterhin den gesamten Zustand einschließlich der neuen Felder; dafür gibt es einen Download-Mocktest.
- Neue lesende API in `pulsData87`: `display(source=state)`, `water(source=state)`, `meals(source=state)`, `foodSearch(source=state)` liefern unabhängige bereinigte Kopien mit Standardwerten, ohne Speichern oder Quellmutation. UI-Verbraucher sollten diese Getter verwenden. Migration setzt keinen abgeleiteten `water.mode` mehr; ein gültiges positives `waterGoal` hat immer Vorrang, auch nach nachträglicher Eingabe durch alte Web-/native Formulare. Auto-Auswahl muss das eigene Ziel löschen/auf 0 setzen.
- Wrapper ausschließlich in `puls-data-v87.js`: akzeptierte Cloud-Pulls werden vor Baseline/Speicherung migriert; der Render-Einstieg ergänzt Standards auch nach Pending-Login, Logout, Import und Reset vor jedem UI-Zugriff. Die bestehende CAS-/Konflikt-/Backup-Reihenfolge bleibt bestehen. Die Migration selbst speichert nicht.
- `pulsHaptic` ist nach der bestehenden Wrapper-Kette mit `hapticsEnabled()` umschlossen; Änderungen an `display.hapticsEnabled` wirken beim nächsten Aufruf. `haptics.js` bleibt unberührt. Rangobjekte ergänzen `stageLevel` (Stufenschwelle) und `userLevel` (tatsächliches `xpProgress`-Level); `level` bleibt Alias von `stageLevel`.
- `validData()` bereinigt die neuen Optionen auf tiefen Kopien und schreibt nur bei vollständig erfolgreicher Validierung zurück. Flache native Validierungsproben verändern damit keine echten Unterobjekte. Beim Start werden fehlerhafte lokale Kombi-Einträge mit einem Hinweis ohne Dateninhalt verworfen; gültige Kombis/Snapshots bleiben erhalten. Import und Cloud lehnen kaputte Kombis weiterhin ab.

Regressionstests: Reset/Löschen versus vollständiger Export, nebenwirkungsfreie Getter/Validierung, lokale Kombi-Reparatur ohne Schreibzugriff, Wasserziel nach Migration, Haptik-Gate, beide Level-Begriffe sowie echte Cloud-Funktionspfade für CAS, Konfliktsicherung, abgelehnte Revision, alten Pull, Pending-Login und Logout mit Mocktransport. `tests/check-friends.cjs` prüft zusätzlich nullable XP/Insert/Update/Snapshot als SQL-Quellvertrag. Keine Live-SQL-, RLS-, Gerätehaptik- oder Browserlayout-Prüfung. Koordinator übernimmt Nachreview, integrierten Frontend-Test, `CURRENT-STATE.md`, Versionierung und gegebenenfalls spätere Veröffentlichung.

## Freunde — lokal vorbereitet, 08.11.2026 (Basis v84)

`backend/friends.sql` ist eine manuell einzuspielende, transaktionale und wiederholt ausführbare Migration. **Hier nicht live ausgeführt.** Bestehende `puls_profiles`, Auth-Konfiguration, Profilsync/RPCs und Revisionen werden nicht verändert. Keine Kostenpflicht, kein APNs-Dienst.

- `puls_friend_profiles`: eigene zufällige 12-stellige Hex-Kennung (48 Zufallsbits, eindeutiger Index mit Kollisionswiederholung), gewählter Anzeigename, Trainingsserie, letztes Trainingsdatum, Gerissen-Flag und Quellenrevision. Erst ausdrückliches Aktivieren im Freunde-Fenster legt diese Zeile an. Kein automatischer E-Mail-/Avatar-/Profiltransfer. Veröffentlichungen müssen zur aktuellen eigenen `puls_profiles.revision` passen (kurzer `FOR SHARE`-Lock); ältere Geräte dürfen neuere Kennzahlen nicht überschreiben. Private Payloads werden dafür weder gelesen noch geändert.
- `puls_friendships`: Anfrage mit Absender/Empfänger, danach `accepted`. Annehmen/Ablehnen nur durch den Empfänger, Entfernen durch beide. Ungeordneter eindeutiger Paarindex verhindert gegenläufige Doppelanfragen. Kein allgemeines Nutzerverzeichnis, keine Suche per E-Mail/UUID. Blockieren ist nicht implementiert.
- `puls_friend_nudges`: fest formulierter Stups, Absender/Empfänger, Versand-/Gelesen-Zeit. Nur bei angenommener Freundschaft und gerissener Serie bzw. mindestens vier Kalendertagen Abstand zum letzten Training. Ein Transaktionslock pro Paar serialisiert Versand und Beziehungsänderungen; maximal ein Stups je Richtung in zwölf Stunden. Entfernen einer Verbindung löscht die Rate-Historie nicht. Deaktivieren löscht das gesamte eigene Freundesprofil mit Beziehungen und Stupsen; eine erneute Verbindung verlangt erneutes Annehmen.
- `puls_friend_limits` (Anfragebudget) und `puls_friend_declines` (Ablehnungssperre) hängen an `auth.users` statt am optionalen Freundesprofil: Deaktivieren/Aktivieren setzt weder das Stundenlimit noch die Sperre zurück; Kontolöschung kaskadiert. Ablehnen sperrt das Paar Absender→Empfänger 7 Tage; erneute Anfragen in dieser Zeit antworten neutral `ok`, ohne Zeile anzulegen. Ausgehende Anfragen liefern nur den Code, nie den Anzeigenamen des Empfängers.
- RLS auf allen fünf Tabellen; direkte Rechte für `public`, `anon` und `authenticated` entzogen. RPCs sind die einzige Client-Schnittstelle: `puls_friends_publish`, `snapshot`, `action`, `nudge`, `read`, `disable`. Alle mit `SECURITY DEFINER`, leerem `search_path`, vollständig qualifizierten eigenen Tabellen und Nutzergrenze aus `auth.uid()`. Nur `authenticated` darf ausführen. Der API-Absender ist nie ein frei wählbarer Parameter. Nach außen erscheinen Freundescodes statt Auth-Nutzer-IDs. Anfragen zeigen nur Kennung/Name; Trainingskennzahlen nur angenommene Freunde. Nur der Empfänger darf Stupse als gelesen markieren.
- Neue Anfragen/Code-Abfragen sind zusätzlich auf 30 pro Stunde und Nutzer begrenzt, einschließlich ungültiger Codes. Annehmen, Ablehnen und Entfernen bleiben unabhängig davon verfügbar. Der Code ist eine weitergebbare Kennung, kein Passwort. Freunde können ihren eigenen Anzeigenamen/Kennzahlen technisch falsche Werte geben; kein verifiziertes Trainingsranking.

Einrichtung im Supabase-Dashboard (Selvir/Koordinator):

1. Migration zunächst in einem separaten Testprojekt mit bestehender `backend/accounts.sql`-Einrichtung prüfen. SQL Editor → neue Abfrage → vollständigen Inhalt von `backend/friends.sql` ausführen. Kein `service_role` im Browser, keine Änderung an Auth-/Profilrechten erforderlich.
2. In Table Editor für die fünf `puls_friend_*`/`puls_friendships`-Tabellen aktiviertes RLS kontrollieren. Zusätzlich prüfen: Limit nach Deaktivieren/Aktivieren erhalten, Ablehnungssperre 7 Tage, ausgehende Anfrage ohne Empfängernamen. Über API mit eigens angelegten Testkonten A/B/C prüfen: anonyme und direkte Tabellenzugriffe abgelehnt, vor Annahme keine Kennzahlen, C ohne Zugriff auf A/B, nur B kann A-Anfrage annehmen, Entfernung beendet Zugriff/Zustellung, nur Empfänger liest, parallele Stupse/12-h-Limit, erneutes Einspielen ohne Datenverlust. Diese Tests sind noch offen; SQL-Quelltext und VM-Mocks belegen keine echte RLS-Isolation.
3. Nach Review und erfolgreichem Test dieselbe Datei im vorgesehenen Projekt ausführen. Bestehende Bestätigungsmails/Redirects beibehalten. Bei fehlender Migration bleibt „Freunde“ im Konto ausgeblendet; privater Profilsync läuft weiter.
4. Web-Dateien integriert testen, dann vor Veröffentlichung durch den Koordinator normal versionieren. Hier absichtlich kein Versionswechsel/Commit/Push. `index.html` und `sw.js` enthalten die neuen Dateien bereits mit Basisversion 84.

Web-Schnittstelle: `js/friends.js` und `css/friends.css`, Konto → Freunde nur angemeldet, online und außerhalb `?erststart=1`. Keine persistierten Profilfelder, daher kein `validData()`-/Backup-Schemawechsel. Alte Profile ohne `runs` bleiben unverändert. Der Client projiziert dieselbe effektive Streak-Regel wie `workout-polish.js` + `running.js` rein lesend: abgeschlossene Workouts mit geloggten Sätzen plus gespeicherte Aktivitäten, eindeutige Trainingstage, Grenze vier Datums-Tage (= drei volle Ruhetage). Zusammenfassungen werden erst nach sauberem Profilsync aus einem Profil mit Revision > 0 veröffentlicht; Dirty-Flag des Profilsyncs, Conflict/Busy/Recovery und abgelehnte Revision sperren (kein Byte-Vergleich mit der Baseline, weil Ansichten beim Rendern Standardfelder ergänzen). Datum basiert lokal auf dem App-Tag; der Server rechnet mit `Europe/Berlin` und akzeptiert ein letztes Training höchstens einen Tag nach seinem Datum. Für Nutzer weit außerhalb dieser Zeitzone kann die Stups-Freigabe nahe Mitternacht weiter um einen Tag abweichen. Prüfung nur bei Start/Fokus/Sichtbarkeit/Syncende und höchstens minütlich, ohne den ganzen Zustand zu serialisieren. Der Menüpunkt erscheint erst nach einer erfolgreichen RPC-Antwort; meldet PostgREST die Funktion als fehlend (`PGRST202`), bleibt er für diese Sitzung ausgeblendet. Die Web-App kann daher vor dem SQL veröffentlicht werden. Angezeigter Aktualisierungstag macht veraltete Eigenmeldungen erkennbar. Kennzahlen sind vom Besitzer gemeldet, keine laufende Prüfung seines privaten Profils.

Stupse werden beim Start/Fokus/Sichtbarwerden und bei offener App ungefähr minütlich abgerufen. Ein sichtbarer Hinweis und der Freunde-Bereich halten sie bis zum ausdrücklichen „Gelesen“ bereit. Keine Profil-/Auth-Wrapper geändert; eigene DOM-/Lifecycle-Listener. Bestehende Sitzung nur für einzelne HTTP-Anfragen, keine weitere Tokenablage oder native Übertragung. **Keine iOS-Änderung/BGAppRefreshTask**: Zustellung ausschließlich beim Öffnen/Fokussieren; kein Hintergrund-Push oder garantierter Hintergrundabruf. Freundesbeziehungen gehören zum separaten Konto-Dienst und sind nicht in JSON-Profilsicherungen enthalten; „Konto zurücksetzen“ betrifft weiterhin das private Fitnessprofil. „Freunde deaktivieren“ löscht diese sozialen Daten, Kontolöschung kaskadiert ebenfalls.

Lokale Tests: `node tests/check-friends.cjs` ist in `node scripts/check.cjs` aufgenommen. Gesamtsuite und gezielter Test bestanden. Mocks prüfen Opt-in, alte Profile, Streak-Grenzen/Läufe, Konflikt-/Rejected-Revision-Sperren, verweigerte veraltete Publikation, Kontowechsel während Refresh/Antwort, Deaktivierung, Offline/Vorschau, Escaping, Hinweise und SQL-Quellverträge. Unabhängiges Codex-Review mit Nachprüfung: indirekte Legacy-`runs`-Mutation und rückwärts laufende Kennzahlenupdates behoben, keine weiteren belegten Befunde im geprüften Umfang. KI-übergreifendes Integrationsreview durch Claude bleibt beim Koordinator. Keine PostgreSQL-/Live-RLS-Ausführung und kein echtes iPhone. Computer-Use meldet fehlende native Pipe, Browserinventar leer/Browserhost nicht verfügbar; 390 × 844 sowie Hell/Dunkel und Fokus-/Touch-Prüfung müssen bei Integration erfolgen.

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
