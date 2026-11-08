# PULS — Backend-Übergabe

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

## Sichere lokale Prüfung

```sh
node scripts/check.cjs
node tests/check-cloud.cjs
node tests/check-account33.cjs
```

Diese Tests verwenden VM-/Netzwerkmocks. `?erststart=1` isoliert UI-Prüfungen vom echten Profil und Cloud-Sync. Reale SQL-/RLS-Integrationstests erfordern eine separat geprüfte Testumgebung; produktive Nutzerdaten bleiben unangetastet.
