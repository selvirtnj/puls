# PULS: kostenlose Konten und Geräte-Synchronisierung

Die App enthält eine vorbereitete Supabase-Anbindung. Solange `cloud-config.js` (im lokalen Quellpaket: `dist/cloud-config.js`) leer ist, arbeitet PULS ausschließlich lokal. Ein GitHub-Konto speichert keine privaten App-Profile.

## Einmalige Einrichtung durch den Projektbesitzer

1. Auf https://supabase.com/dashboard ein kostenloses Projekt erstellen. Eine EU-Region wählen, wenn du dort hosten möchtest. Das Datenbankpasswort bleibt bei dir.
2. Im Projekt **SQL Editor → New query** öffnen. Den vollständigen Inhalt von [accounts.sql](accounts.sql) einfügen und ausführen. Die Tabelle enthält getrennte Profile pro Auth-Benutzer; Row Level Security verhindert den Zugriff auf andere Profile. Die Versionsprüfung verhindert stilles Überschreiben bei parallelen Änderungen.
3. Im **Connect**-Dialog die **Project URL** und den öffentlichen **Publishable Key** kopieren. Je nach Dashboard stehen die Schlüssel auch unter **Project Settings → API Keys**. Alternativ ist der Legacy-`anon`-Key möglich. Keine `sb_secret_`-/`service_role`-Schlüssel verwenden oder weitergeben.
4. Diese beiden öffentlichen Werte in `cloud-config.js` (im lokalen Quellpaket: `dist/cloud-config.js`) eintragen oder Codex zur Konfiguration schicken. Sie sind für den Browser bestimmt; der Datenschutz beruht auf Authentifizierung und der SQL-Zugriffskontrolle.
5. Unter **Authentication → URL Configuration** als Site URL `https://selvirtnj.github.io/puls/` und als erlaubte Redirect URL dieselbe Adresse hinterlegen. E-Mail/Passwort-Anmeldung aktivieren; E-Mail-Bestätigung eingeschaltet lassen.
6. Änderungen veröffentlichen. Unter **Konto → Konto & Synchronisierung** ein Konto erstellen, die Bestätigungsmail öffnen und sich anmelden. Beim ersten Verbinden die Übernahme der lokalen Daten bestätigen. Auf dem zweiten Gerät mit derselben E-Mail und demselben Passwort anmelden: Der Cloud-Stand wird geladen.

## Für Freunde

Jede Person erstellt einen eigenen PULS-Login und erhält ein eigenes, von anderen getrenntes Profil. GitHub Pages stellt nur den Programmcode bereit; private Einträge liegen im Supabase-Projekt.

Der eingebaute Supabase-Mailversand ist für Tests eingeschränkt und versendet standardmäßig nur an berechtigte Adressen des Supabase-Teams. Für die Registrierung von Freunden einen eigenen SMTP-Anbieter in Supabase konfigurieren. Nicht die E-Mail-Prüfung abschalten. Kostenlose Dienste haben Limits und können pausieren; vor einer breiteren Nutzung aktuelle Konditionen prüfen.

## Verhalten

- Änderungen bleiben sofort lokal gespeichert und werden mit angemeldetem Konto verzögert hochgeladen. Online-Status und Synchronisierungsstatus stehen im Konto.
- Beim Wiederöffnen und etwa alle 30 Sekunden wird synchronisiert. Gleichzeitige Änderungen führen zu einer Auswahl zwischen Cloud- und lokalem Stand, statt stillen Datenverlust zu erzeugen. Beim Laden des Cloud-Stands wird eine lokale Konflikt-Sicherung aufbewahrt.
- Bei bestehendem Cloud-Profil werden vorhandene lokale Daten nicht ungefragt hineingemischt. Vor der ersten Anmeldung wird der lokale Stand separat gesichert. Abmelden kehrt zu diesem lokalen Profil zurück. Ungesendete Daten werden separat für die nächste Anmeldung aufbewahrt.
- Kennwörter werden nur an Supabase Auth übermittelt, nicht im PULS-Datensatz gespeichert. Anmeldetokens werden wie bei vielen Browser-Apps lokal gehalten. Auf gemeinsam genutzten Geräten abmelden.
- Die Erststart-Vorschau nutzt keine Cloud und überschreibt keine echten Profile.
- JSON-Sicherungen zusätzlich aufbewahren. Cloud ist kein Ersatz für ein eigenes Backup.

## Prüfungen vor Freigabe

Zwei Benutzer anlegen. Beide dürfen über die REST-API ausschließlich ihren eigenen Datensatz lesen/ändern. Auf zwei Geräten ein Profil öffnen, getrennt bearbeiten und Konfliktauswahl testen. Offline ändern, App neu öffnen und wieder online gehen. Abmelden und Benutzerwechsel prüfen. Den Zugang erst nach diesen Prüfungen für Freunde freigeben.

Quellen: https://supabase.com/docs/guides/auth/passwords · https://supabase.com/docs/guides/api/securing-your-api · https://supabase.com/docs/guides/auth/auth-smtp · https://supabase.com/pricing