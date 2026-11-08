# SwiftUI-Umstellung archiviert

Seit Selvirs Entscheidung vom **08.11.2026** ist die native SwiftUI-Umstellung gestoppt und unter Tag `native-swiftui-archiv` archiviert. Nicht löschen oder weiter ausbauen. Die übrigen Dateien hier sind historische Pläne, Verträge und Prüfstände; sie erteilen keine neuen Aufgaben.

Die iOS-App ist wieder die WebView-Hülle von `main`, Basis `ios-build-9`. Sie lädt die Live-Web-App (Stand der Entscheidung: v83). Neue native Extras gehören in die Hülle und die bestehende `pulsNative`-Brücke. Daten, Auth und Sync bleiben im Web. Siehe [iOS-App](../IOS-APP.md) und [aktueller Stand](../CURRENT-STATE.md).
