# PULS kostenlos mit deinem Mac auf das iPhone installieren

PULS hat eine installierbare iOS-Hülle aus SwiftUI, WKWebView, ActivityKit und lokalen Mitteilungen. Die vorhandene Oberfläche wird aus der veröffentlichten Web-App geladen. Die Bildschirme sind somit keine vollständige SwiftUI-Neuentwicklung; Aussehen und Bedienung deiner PULS-App bleiben erhalten. Diese Quellen wurden früher im GitHub-Mac-Build kompiliert. Ein aktueller Build und ein echter Gerätetest müssen separat bestätigt werden.

## Einfachster Weg: vorbereitetes Xcode-Projekt

1. Auf dem Mac **Xcode** kostenlos aus dem Mac App Store installieren und einmal starten. Unter **Xcode → Settings → Accounts** mit deinem eigenen Apple Account anmelden.
2. Unter https://github.com/selvirtnj/puls/actions den neuesten erfolgreichen Lauf **PULS iPhone kostenlos** öffnen. Das Artefakt **PULS-Xcode-Projekt** herunterladen und entpacken. Darin `PULS.xcodeproj` öffnen.
3. Beide Targets **PULS** und **PULSActivity** auswählen. Unter **Signing & Capabilities** dein **Personal Team** wählen und **Automatically manage signing** einschalten. Falls die Kennungen schon vergeben sind: `de.DEINNAME.puls` und `de.DEINNAME.puls.activity` verwenden. Die Extension-ID muss mit der App-ID beginnen.
4. iPhone per Kabel mit dem Mac verbinden, entsperren und dem Mac vertrauen. In Xcode oben dein iPhone als Ziel auswählen. Falls verlangt, auf dem iPhone **Einstellungen → Datenschutz & Sicherheit → Entwicklermodus** aktivieren und neu starten.
5. In Xcode das Scheme **PULS** und dein iPhone wählen, dann **▶ Run** drücken. Wenn iOS es verlangt, unter **Einstellungen → Allgemein → VPN & Geräteverwaltung** dem Entwicklerprofil vertrauen.
6. PULS auf dem iPhone starten. Kamera- und Mitteilungserlaubnis bei der jeweiligen Funktion erteilen.

Mit einem kostenlosen Personal Team laufen die Provisioning-Profile **7 Tage**. Danach am Mac erneut mit **Run** signieren und installieren. Nicht die App löschen: Ein erneutes Installieren mit derselben Bundle-ID erhält normalerweise ihren Datenspeicher. Vorher trotzdem eine JSON-Sicherung erstellen. Nach einer Änderung der Bundle-ID entsteht eine getrennte App.

## Alternativ: aus dem Repository erzeugen

Falls du nur den Quellcode hast, installiere XcodeGen aus der offiziellen Quelle (https://github.com/yonaskolb/XcodeGen, z. B. `brew install xcodegen`), wechsle im Terminal in den Ordner `native` und führe aus:

```sh
xcodegen generate
open PULS.xcodeproj
```

Danach die Signing-Schritte oben ausführen. Das Xcode-Artefakt enthält das erzeugte Projekt bereits; dafür brauchst du XcodeGen auf deinem Mac nicht.

## Deine vorhandenen Daten

WKWebView und Safari/Home-Screen-Web-App haben getrennte Datenspeicher. Solange die Cloud nicht eingerichtet ist: In der bestehenden App unter **Konto → Sicherung** exportieren und in der iOS-Hülle **Sicherung importieren** wählen. Nach aktivierter Cloud-Synchronisierung in beiden Apps mit demselben PULS-Konto anmelden. Die Einrichtung steht unter https://github.com/selvirtnj/puls/blob/main/backend/ACCOUNT-SETUP-DE.md. Anmeldetokens werden nicht in JSON-Sicherungen exportiert.

## Freunde

- **Kostenlos und unkompliziert:** Freunde öffnen die Web-App und verwenden nach der Supabase-Einrichtung jeweils ein eigenes PULS-Konto.
- **Kostenlose eigene Entwicklerinstallation:** Wer einen Mac mit Xcode besitzt, kann den Quellcode mit dem eigenen Apple Account für den eigenen persönlichen Gerätetest signieren. Auch hier gilt die 7-Tage-Frist.
- **Bequeme native Verteilung an Freunde über TestFlight/App Store:** Dafür ist die kostenpflichtige Apple-Developer-Program-Mitgliedschaft nötig (Apple nennt 99 USD pro Jahr bzw. den lokalen Preis). Ein kostenloses Personal Team ist keine dauerhafte Verteilungslösung für Dritte. Keine fremden Apple-Account-Passwörter oder Zertifikate teilen.

## Gerätetest und Grenzen

Workout starten → Live Activity zeigt Zeit. Satz abhaken → Pause zählt herunter. Sperren → Mitteilung am Pausenende. Pause verlängern/stoppen → alte Mitteilung wird ersetzt/entfernt. Workout beenden → Auswertung und Ende der Live Activity. Kamera, Sicherung, Import, Klänge, Einklappen/Fortsetzen und Anmeldung zusätzlich auf dem echten Gerät testen.

Die Web-Hülle braucht beim Laden Internet. iOS kann Hintergrundausführung aussetzen. Deshalb erfolgt das automatische Ende überlanger Workouts nach 5 Stunden bei geöffneter App oder rückwirkend beim Wiederöffnen. Live Activities und Mitteilungen hängen von Gerätefunktionen, Freigaben und Fokus ab. Das automatische Ende der Live Activity bei dauerhaft suspendierter App ist dadurch nicht garantiert.

Quellen: https://developer.apple.com/help/account/basics/about-your-developer-account · https://developer.apple.com/programs/whats-included/ · https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities