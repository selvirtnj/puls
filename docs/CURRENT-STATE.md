# PULS — aktueller Stand und Übergabe

Aktualisiert: 24.10.2026. Maßgeblicher Code: dieses Repository. Git-Historie und aktuelle CI zusätzlich prüfen.

## Stand bei Einrichtung der Zusammenarbeit

- Veröffentlichte App-Version: **38** (24.10.2026, Commit `0c62ef6`: Konto 36, Übersicht 37, Training 38 im neuen Originaldesign). Selvir hat 38 auf dem iPhone bestätigt.
- Live: https://selvirtnj.github.io/puls/?v=38 ; Repository: https://github.com/selvirtnj/puls .
- Davor veröffentlicht: 35, Ausgangscommit `6e878204b677d1e9aa8f51f51f22f2df526f2c81`.
- Version 34: fokussierte Oberfläche, neu geordnetes Konto, mehr Diagramme, vier zusätzliche Designs, Archiv und Projektdokumentation.
- Version 35: 87 neue Übungsvarianten, insgesamt 963; Maschinen-/Kabel-/Smith-Filter, deutsche Suchnamen und Ergebnis-Paginierung.
- Die anschließende Team-Einrichtung ändert Dokumentation, Agentenrollen und Entwicklungswerkzeuge, keine Runtime-Funktion der App. Deshalb bleibt die App-Version 35.
- Die bisherigen Web checks und Pages-Veröffentlichungen für 35 waren erfolgreich. Das ist ein historischer Prüfstand, kein dauerhafter Live-Nachweis.

## Was jetzt eingerichtet ist

`AGENTS.md`, `START-HERE.md`, Produktkontext, Backend-Übergabe, Teamablauf und die Rollen `puls_frontend`, `puls_backend`, `puls_reviewer`. Ein Hauptchat koordiniert die Aufgaben. Neue Chats müssen die Dokumentation lesen; automatische vollständige Übertragung beliebiger Gesprächshistorien wird nicht vorausgesetzt.

## Sofort nutzbare Befehle

```sh
git status --short
git log -1 --oneline
node scripts/check.cjs
node scripts/check-handoff.cjs
node scripts/serve.cjs
```

`npm test` entspricht `node scripts/check.cjs`. Keine npm-Abhängigkeiten nötig. Ist npm nicht im PATH, direkt Node benutzen.

## Aktueller Auftrag / nächster Schritt

Selvir hat am 24.10.2026 die Zielklärung bestätigt: persönliche iPhone-Nutzung, sportliches dunkles lila Original, weniger verschachtelte Karten, sichtbare kurze Aktionsreaktionen. Konto- und Übersichts-Vorschau wurden ausdrücklich positiv beurteilt. Training im selben Stil ist umgesetzt; Konto, Übersicht und Training sind als Version 38 live. Nächster geplanter Abschnitt laut Plan: Essen, erst nach Selvirs Auftrag. Keine automatische kontinuierliche Hintergrundarbeit. Verbindlicher Plan: `docs/DESIGN-WORKPLAN.md`.

Nach Einbindung des Repository-Ordners als Codex-Projekt dort einen Hauptchat starten; `START-HERE.md` enthält den Einstiegsauftrag. Projektrollen werden je nach Client nach Projektöffnung/neuem Chat geladen, nicht zwingend mitten in einer bestehenden Sitzung.

## Technische Orientierung

Statische Dateien direkt im Stamm; kein Bundler und kein React-/Flutter-Projekt. JS-Dateien definieren Globals und umschließen bestehende Funktionen. Die letzte Definition in der Ladereihenfolge gewinnt; beim Ändern immer die Kette prüfen. Tests verwenden VM-/DOM-/Netzwerkstubs.

`state` bleibt die gemeinsame Datenbasis. Lokales Profil: `puls-v1`. Auth-/Synchronisierungsmetadaten und gegebenenfalls alte lokale Fotos haben weitere Schlüssel. Supabase speichert pro Nutzer ein revisionsgeprüftes JSON-Profil. Die Backend-Dateien belegen die beabsichtigte Konfiguration, nicht den aktuellen Live-Zustand.

Katalog, Icons, Offline-Cache und PWA-Scope müssen bei Releases mitbedacht werden. Der bisherige Autoringsordner mit `dist/`, `release34/` und einmaligen Vorbereitungsskripten ist keine zweite aktuelle Quelle; Skripte daraus nicht unbesehen ausführen.

## Offene Grenzen und sinnvolle spätere Aufgaben

Keine der folgenden Aufgaben ist durch diese Liste automatisch zur Umsetzung freigegeben:

1. Modulkopplung: langfristig Funktionen klarer aufteilen und Wrapper reduzieren, mit Tests. Kein riskanter Komplettumbau nebenbei.
2. Backend: direkte eigene Tabellen-Schreibrechte können den RPC-Revisionsweg umgehen; serverseitige Payload-Validierung ist flacher als die Clientprüfung. Siehe Backend-Übergabe.
3. Geteilte Geräte: benutzerübergreifende Backup-/Rückkehrschlüssel und Offline-Abmeldung ausdrücklich testen.
4. Breitere Nutzung mit Freunden: reale Zweikonto-Isolation, Auth-Mailversand/SMTP, Limits, Offline-Sync und Restore mit eigens angelegten Testkonten prüfen. Mock-Tests allein genügen nicht.
5. UI-/Browsergrenzen: Audio/Kamera/Sprache/OCR und Hintergrundverhalten hängen von iOS und Browserberechtigungen ab. Reale iPhone-Tests bleiben nötig.
6. Einige neue Diagramm- und Beschreibungsdetails sind möglicherweise noch nicht vollständig übersetzt. Bei englischer UI konkret prüfen, nicht pauschal Vollständigkeit behaupten.

## Übergabe nach jeder größeren Aufgabe

### Native iOS-Hülle — 24.10.2026

- Auf Selvirs Wunsch (echte iOS-App per AltStore auf iPad/iPhone): `ios/` enthält eine Swift-`WKWebView`-Hülle um die Live-Web-App; `.github/workflows/ios-app.yml` baut auf macOS eine unsignierte `PULS.ipa` und veröffentlicht sie als GitHub-Release (`/releases/latest/download/PULS.ipa`). Anleitung und Grenzen: `docs/IOS-APP.md`.
- Keine Änderung an Web-App-Dateien oder App-Version (bleibt 38). Erster CI-Build erfolgreich, IPA enthält App, Info.plist und Icons.
- Grenzen: nur kompiliert, noch nicht auf echtem Gerät installiert/getestet. App-Speicher ist getrennt von Safari; Daten kommen über Konto-Sync.

### Trainings-Vorschau 38 — 24.10.2026

- Nach Bestätigung der Übersicht beauftragt. Neue `training-refresh.css` gestaltet ausschließlich Training im Originaldesign sowie Original-Vollbildsessions unabhängig vom Hintergrundtab. Vier unterstrichene Reiter, offene Routinen-/Kalender-/Fortschrittsabschnitte, klare Typografie, flache Ergebnisgitter. Kurze Übergangs-/Satzanimationen; bestehende Feieranimationen und Reduced Motion erhalten.
- Keine neue JS-Logik, Timer-/Daten-/ID-/Handleränderung oder Backendänderung. Satzfelder/Checkboxen 44 px; fünfspaltiges Raster mit schmaler Variante. Modals und Sortierghosts unverändert.
- Version 38 lokal konsistent in Anzeige, Package, Asset-Queries und SW-Cache; Stylesheet zuletzt und als Offline-Asset ergänzt. Am 24.10.2026 zusammen mit 36 und 37 als Commit `0c62ef6` veröffentlicht; GitHub Pages liefert 38 aus.
- Prüfung: `node scripts/check.cjs`, Integrationsprüfung und `git diff --check` bestanden. Unabhängiges Review ohne offene belegte Befunde; letzte Select-Farbkorrektur nachgeprüft.
- Browser mit isolierten Testdaten: alle vier Tabs, leere Ansicht und Routine mit langem Namen/zwei Übungen, Start, 50 kg × 8 eintragen/abhaken, automatischer Pausenstart und +30 s, Positionswechsel mit erhaltenen Satzwerten, Minimieren und Fortsetzen aus Übersicht, Abschluss mit unerledigter Übung einschließlich Zurück sowie alle drei Abschlussansichten. Kalender zeigt Testtraining; Fortschritt 400 kg Volumen/8 Reps und Zeitraumfilter geprüft. Hauptprüfung 390 × 844; Session zusätzlich bei 320 px ohne horizontalen Überlauf. Sichtbare Satzfelder und Checkboxen 44 px bestätigt.
- Grenzen: kein reales iPhone/Safari, kein echter Touch-Drag-/Safe-Area-/Hintergrundtimer-Test, kein Offline-SW- oder Live-Sync-Lauf. Positionswechsel per Auswahlfeld geprüft; vorhandene Drag-Logik nicht verändert. Reduced Motion implementiert/im Code geprüft, nicht mit aktivierter Betriebssystemoption getestet. Andere Designs vom neuen CSS ausgeschlossen, nicht erneut vollständig geprüft.
- Selvir hat Version 38 veröffentlichen lassen und auf dem iPhone bestätigt. Essen folgt erst nach weiterem konkretem Auftrag.

### Übersichts-Vorschau 37 — 24.10.2026

- Nach positiver Beurteilung des Kontos von Selvir beauftragt. `overview-refresh.css` gestaltet ausschließlich `home` im Originaldesign: offene Abschnitte, Nummern 01–04, klare Typografie/Trennlinien, kompakte Aktionsknöpfe, kurze Eintritts-/Kreis-/Balkenanimationen und Reduced Motion. Bestehendes HTML, Handler und Berechnungen unverändert; kein neues JavaScript, kein Backend oder Datenmodell.
- Letztes Stylesheet in `index.html`, Offline-Asset in `sw.js` ergänzt. Lokale Anzeige, Asset-Queries, Package und Cache konsistent Version 37. Keine Veröffentlichung und kein Release-Commit; veröffentlichter Stand weiterhin 35.
- Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden; unabhängiges Review ohne offene belegte Befunde. In der Browserprüfung gefundene CSS-Spezifitätskonflikte bei Nummerierung/Innenabständen korrigiert und unabhängig nachgeprüft.
- Browser bei 390 × 844 mit isolierter Erststart-Vorschau: leere und gefüllte Bilanz, Mikro-Wechsel bei unverändert 220 px Pane-Höhe, Essen erfassen und Vorschau, Routine erstellen mit langem Namen, starten/minimieren/fortsetzen, leeres Testworkout verwerfen, Zeitraum/Kurvenfilter und Vortag/Heute geprüft. Kein horizontaler Überlauf; geprüfte Aktionsknöpfe mindestens 44 px hoch. Testdaten ausschließlich im Speicher der Vorschau.
- Grenzen: kein reales iPhone/Safari oder Offline-SW-Lauf; reduzierte Bewegung im Code geprüft, nicht per Betriebssystemoption aktiviert. Andere neun Designs vom neuen CSS ausgeschlossen, nicht erneut vollständig im Browser geprüft. Bestehende Mock-Tests sind kein Layout- oder Live-Sync-Nachweis.
- Selvir hat die Übersicht bestätigt und Training als nächsten Abschnitt beauftragt. Essen bleibt als späterer Abschnitt geplant.

### Konto-Vorschau 36 — 24.10.2026

- Bestätigter Plan in `docs/DESIGN-WORKPLAN.md`; persönliche iPhone-Nutzung ersetzt einen geplanten Ausbau für Freunde.
- Lokal umgesetzt in `account-refresh.js` und `account-refresh.css`: kompakte Identität, Ziel und Gewicht/Wochenmittel; Menüzeilen zu vorhandenen Detailbereichen, Zurück mit Fokus/Scrollposition, kurze Animationen und Reduced-Motion-Regeln. Keine neuen persistierten Datenfelder oder Backendänderungen.
- Originaldesign zuerst verfeinert; alle zehn Designs behalten dieselben Kontoabläufe. Bestehende Formulare, Sicherungen und Kontoverwaltung bleiben erreichbar. Tutorial an Unterseiten angepasst.
- Lokale Versionsvorbereitung 36: Anzeige, Asset-Queries, package.json und SW-Cache samt neuen Offline-Dateien. Noch nicht veröffentlicht und kein Release-Commit; live bleibt der zuvor veröffentlichte Stand 35.
- Prüfung: `node scripts/check.cjs` und `git diff --check` bestanden. Unabhängiges Review ohne offene belegte Funktionsbefunde nach Korrektur der Wochenbeschriftung; Mittelwert, Leerwerte und Ausschluss zukünftiger Gewichte zusätzlich mit lokalen Fixtures geprüft.
- Echte Browserprüfung bei 390 × 844 mit `?erststart=1` und künstlichem Profil: alle neun in der Vorschau verfügbaren Menübereiche, Planformular, Gewicht speichern/Aktualisierung, Zurück-Fokus, Designwechsel über alle zehn Varianten ohne horizontalen Überlauf, Sprachwechsel DE/EN und Tutorialdurchlauf. Gefundene globale CSS-Konflikte korrigiert. Keine Konsolenfehler im geprüften Ablauf.
- Grenzen: VM-Suite deckt die neue DOM-Navigation nicht vollständig ab. Kein reales iPhone/Safari, keine echte Supabase-Anmeldung/RLS und kein Offline-SW-Lauf geprüft; Sync ist in der Erststart-Vorschau absichtlich ausgeblendet. Reduced Motion implementiert und im Code geprüft, nicht mit aktivierter Betriebssystemoption getestet.
- Selvir hat die Konto-Vorschau positiv beurteilt und anschließend die Übersicht beauftragt. Veröffentlichung weiterhin offen.

Hier knapp ergänzen: Auftrag, geänderte Bereiche, Ergebnis der Prüfungen, Integrations-/Release-Commit, noch offene Befunde. Historische Release-Dokumente nicht als aktuellen Arbeitsauftrag fortschreiben. Private Daten gehören nicht in diese Datei.
