# PULS 33 · Konto, Tutorial, Einheiten und Schnellaktionen

## Konto
Konto & Synchronisierung steht zuerst, danach Körper & Entwicklung und Gewichtstrend. Plan und Körpermaße folgen, danach die restlichen Einstellungen. Tutorial-Wiederholung und Kontoaktionen stehen unten. Scheiben & Aufwärmen und Standardpause teilen sich im Training eine Zeile.

Zurücksetzen löscht Fitnessdaten/Ziele inklusive Routinen, Favoriten, Rezepten, XP und aktuellem lokalen Fotoalbum. Nutzername, Avatar, Sprache/Design/Icon/Sound und Auth-Login bleiben erhalten; die Zielplanung beginnt neu. Bei verbundenem Konto wird zuerst ein leerer Kontostand mit erwarteter Revision geschrieben. Konflikt oder Serverfehler verhindern das lokale Löschen. Kein Konto wird allein durch Aufruf des Formulars zurückgesetzt.

Löschen erfordert Bestätigungswort und Checkbox. Cloud-Konten benötigen zusätzlich eine erneute Passwortanmeldung desselben Benutzers. Erst nach erfolgreicher Serverbestätigung werden Sitzung, aktuelles lokales Profil und zugehörige lokale Kopien entfernt. Ohne Cloud-Login ist die Aktion ausdrücklich als Löschen des lokalen Profils beschriftet. Exportierte Backups und Offline-Kopien auf anderen Geräten kann eine Web-App nicht fernlöschen.

`backend/account-delete.sql` richtet eine kleine SECURITY-DEFINER-Funktion mit festem leerem search_path ein. Sie akzeptiert keine Benutzer-ID: ausschließlich auth.uid() wird verwendet. Anonyme/Public-Aufrufe sind entzogen, nur authentifizierte Aufrufe zugelassen. DELETE auf auth.users entfernt den eigenen Auth-Datensatz; puls_profiles hängt per ON DELETE CASCADE daran. Am 23.10.2026 nach ausdrücklicher Zustimmung im vorhandenen Projekt eingerichtet und Berechtigungen per SQL-Metadaten geprüft (anon=false, authenticated=true). Dabei wurde kein echtes Konto gelöscht. Die App enthält keinen Admin-/Service-Role-Schlüssel.

## Einführung
Nach dem ersten erfolgreichen Speichern der Ziele startet eine zehnteilige, überspringbare Tour mit echten Seitenwechseln, hervorgehobenen Bereichen, Weiter/Zurück und Wiederholung im Konto. Automatische wie manuelle Zielplanung werden unterstützt. Die Tour trägt keine Demo-Lebensmittel ein und startet kein Workout. Bestehende Konten werden durch das Update nicht ungefragt unterbrochen. `tutorialVersion` liegt im bisherigen Profildatensatz und folgt Sicherung/Synchronisierung.

## Einheiten
Menge und Einheit stehen nebeneinander. g/kg/oz und ml/l werden proportional in die bisherige kanonische Menge g bzw. ml umgerechnet. 1 oz = 28,349523125 g (avoirdupois), keine Flüssigunze. Ohne passende Dichte sind Einheiten der anderen Dimension sichtbar, aber deaktiviert. Eine bekannte Dichte kann explizit als g/ml hinterlegt werden. Es gibt keine pauschale 1:1-Annahme. Beim Einheitenwechsel bleibt die Menge erhalten, und beim Ändern der Zahl aktualisieren sich die Makros sofort. Packungs- und Haushaltsportionen bleiben nutzbar. Kanonische Felder erlauben jetzt Nachkommastellen ohne 0,1-g-Schrittfehler bei oz.

## Plus-Menü
Neun kompakte Aktionen: Essen, Barcode, Nährwertfoto, Rezept, Wasser (+250 ml), Gewicht, Workout, Körpermaße sowie Text & Sprache. Weiterführend Essen planen, Fasten-Timer und Wochen-Check-in. Workout öffnet ein laufendes Training bzw. die Trainingsauswahl, anstatt versehentlich eine neue leere Session zu starten.

## Prüfungen
`check-account33.cjs`: genaue Umrechnung und Dichte-Grenzen, Profil-Validierung, Reset-Konflikte/CAS und Identitätserhalt mit gemockter Cloud. Bisherige Ernährungs-/Barcode-/Cloud-/Worker-Tests bleiben bestehen. Browser: Tutorial-Wiederholung und automatische Einführung nach manueller Ersteinrichtung, 1 oz Lebensmittel mit sofortiger Makroanzeige und erfolgreichem Tagebucheintrag, Plus-Menü und mobile Anordnung. Alle Browser-Daten waren isolierte Erststart-Vorschauen ohne Lesen/Schreiben des echten Profils. Eine echte Kontolöschung wurde absichtlich nicht ausgeführt.
