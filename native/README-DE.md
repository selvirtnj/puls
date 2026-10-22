# PULS auf deinem iPhone mit Dynamic Island

Dieses Paket ist ein vorbereiteter nativer iOS-Quellcode, **hier noch nicht mit Xcode gebaut oder auf einem echten iPhone geprüft**. Die bestehende PULS-Oberfläche wird per WKWebView geladen. Die Swift-Hülle ergänzt ActivityKit und lokale Pausen-Mitteilungen. Keine App-Store-Veröffentlichung erforderlich.

## Installation am Mac

1. Aktuelles Xcode aus dem Mac App Store installieren und einmal öffnen. Unter Xcode → Settings → Accounts deine Apple-ID hinzufügen.
2. XcodeGen installieren: `brew install xcodegen` (falls Homebrew noch fehlt: dessen offizielle Anleitung auf https://brew.sh verwenden).
3. Dieses Paket entpacken. Im Terminal in den Ordner mit `project.yml` wechseln und `xcodegen generate` ausführen. Danach `open PULS.xcodeproj`.
4. In Xcode bei **beiden Targets PULS und PULSActivity** unter Signing & Capabilities dein Team auswählen. Bei Bedarf die Bundle IDs auf eigene eindeutige Werte ändern; die Extension-ID muss mit der App-ID beginnen.
5. iPhone per Kabel verbinden, entsperren, dem Mac vertrauen und falls verlangt den Entwicklermodus unter Einstellungen → Datenschutz & Sicherheit aktivieren. Scheme **PULS**, dein iPhone als Ziel auswählen und ▶ Run drücken.
6. Auf dem iPhone Entwicklerprofil vertrauen, falls iOS das verlangt. Workout starten, einen Satz abhaken und Mitteilungen erlauben. Für Dynamic Island ist ein iPhone mit Dynamic Island nötig; auf anderen unterstützten iPhones erscheint die Live Activity am Sperrbildschirm.

Ein kostenloses persönliches Signing kann zeitlich befristet sein; Xcode zeigt die Bedingungen für dein Team. Für dauerhafte Verteilung gelten Apples Entwicklerprogramm-Regeln.

## Bestehende Daten übertragen

Die native App hat einen eigenen Datenspeicher. Safari und die bisherige Home-Screen-App teilen ihn **nicht automatisch** mit WKWebView. Exportiere zuerst unter Konto in deiner bisherigen PULS-App eine Sicherung. Die native Hülle enthält unter der Oberfläche einen Knopf **Daten aus Sicherung importieren**, der die JSON-Datei mit einem nativen Dateidialog importiert. Bestehende native Daten werden nach Rückfrage ersetzt. Bewahre die Sicherung auf. Keine Cloud-Synchronisierung.

## Verhalten und Grenzen

- Ein abgeschlossener Satz plant die Pausen-Mitteilung nativ. Sie kann auch bei gesperrtem Gerät erscheinen; iOS-Mitteilungseinstellungen und Fokus steuern die Anzeige.
- Verlängern, Beenden oder Aufheben des Satzhakens aktualisiert bzw. entfernt die geplante Mitteilung. Workout-Ende entfernt Live Activity und geplante Mitteilung.
- Ohne Pause zeigt die Live Activity die verstrichene Workout-Zeit. Während der Pause zählt sie bis 0 herunter; die Gesamtdauer bleibt in der erweiterten Ansicht sichtbar.
- Nach Ablauf im Hintergrund bleibt der Pausen-Zähler bei 0, bis du PULS wieder öffnest. Ein automatischer Layoutwechsel von Pause auf Workout bei suspendierter App ist in dieser Version ohne zusätzliche native Hintergrundaktualisierung nicht zugesagt. Die lokale Mitteilung erinnert dich trotzdem an den nächsten Satz. Live Activities unterliegen Apples Laufzeitgrenzen.
- Die Web-Oberfläche lädt online von https://selvirtnj.github.io/puls/. Deine Einträge bleiben lokal in der App. Die Hülle erlaubt die JS-Brücke ausschließlich vom Hauptframe dieser HTTPS-Domain.
- Kamera, Dateisicherung/-import und ActivityKit unbedingt auf deinem Gerät prüfen. Ein Xcode-Projekt erzeugt zu haben ist kein erfolgreicher Build.

## Prüfliste am Gerät

Workout starten → Island zeigt Gesamtzeit. Satz abhaken → Pause zählt herunter. Sperren → Mitteilung am Pausenende. Zurückkehren → korrekte Zeit. Pause verlängern/stoppen → alte Mitteilung wird ersetzt/entfernt. Workout beenden → Auswertung, Island beendet. App neu öffnen → Daten erhalten. Sicherung exportieren und testweise importieren.

Referenzen: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities und https://developer.apple.com/documentation/usernotifications/untimeintervalnotificationtrigger

