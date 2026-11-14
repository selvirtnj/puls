# Gebündelte Lebensmitteldatenbanken

Der Katalog enthält 20.826 Lebensmittel (BLS 7.090, USDA SR Legacy 7.793, USDA Foundation 311, Ciqual 3.006, CNF 2.573 und 53 regionale Richtwerte). CoFID 2021 und USDA FNDDS 2021–2023 waren vom 12.11. bis 14.11.2026 im Katalog und wurden am 14.11.2026 auf Selvirs Wunsch wieder entfernt (siehe unten); sie kommen nur auf Wunsch zurück. Reproduzierbarer Import:

```powershell
node scripts/import-food-databases.cjs C:/Users/selvir/Documents/Projekte/puls/catalog-raw
node scripts/import-nutrients.cjs C:/Users/selvir/Documents/Projekte/puls/catalog-raw
```

Ohne Argument gilt `catalog-raw/` im Repository. Im Worktree liegen die Rohdateien außerhalb unter `C:/Users/selvir/Documents/Projekte/puls/catalog-raw` und werden nur gelesen. Beide Skripte benötigen ausschließlich Node-Standardbibliotheken. CNF wird direkt aus CSV gelesen. Sämtliche verwendeten Rohdateien werden vor Verarbeitung per SHA-256 geprüft; genaue Pfade und Hashes stehen in [NUTRIENT-MAPPING.md](NUTRIENT-MAPPING.md). Inventare und entpackte Dateien sind keine Eingaben.

Der Basisimport berechnet `foods-37…42`, Manifest und Portionen im Speicher und vergleicht die vollständige Serialisierung nach LF-Normalisierung mit dem Bestand. Er akzeptiert ausschließlich Änderungen der aus fixierten Rohdaten erzeugten CNF-Portionen. Jede andere Abweichung meldet er mit Lebensmittel, Feld, alt/neu, endet mit Exit 1 und schreibt nichts. Auch bei Gleichheit werden bestehende Dateien nicht unnötig neu geschrieben. `foods-0…36` werden niemals geschrieben. Der Sidecar-Import schreibt nur `nutrients-v2*.json`; v1 bleibt unverändert.

### Entfernt am 14.11.2026: CoFID 2021 und USDA FNDDS 2021–2023

Beide Quellen sind aus Katalog, Manifest, Portionen und den Nährstoff-Sidecars verschwunden (8.067 Lebensmittel, 5.431 FNDDS-Portionsgruppen, 8.055 Sidecar-Zeilen). `foods-43…58` wurden gelöscht, `foods-42` enthält nur noch die letzten 73 CNF-Einträge. Alle übrigen Datensätze, Portionen und Sidecar-Zeilen sind unverändert (Vergleich je ID vor/nach). Die Rohdaten liegen weiter unter `catalog-raw/` (nicht versioniert); die Reader und Zuordnungen beider Quellen sind aus den Import-Skripten entfernt (früherer Stand im Git-Verlauf, Version 97). Download und Hashes stehen in [CATALOG-SOURCES.md](CATALOG-SOURCES.md).

Gespeicherte Altbestände bleiben unberührt: Wer ein Lebensmittel aus diesen Quellen schon geloggt oder als eigenes übernommen hat, behält Datensatz, ID, `catalogKey`, Nährwert-Snapshot und die Quellenangabe in der Detailansicht. Die erweiterten Nährwerte (Sidecar) solcher Einträge entfallen, weil die Zeilen nicht mehr existieren; Energie, Makros und die neun Altmikros stammen aus dem gespeicherten Snapshot und bleiben.

Importierte Quelle im Katalog:

| Quelle | Importiert | Ausgelassen | Grund | Übernommene Portionen |
|---|---:|---:|---|---:|
| CNF 2026 | 2.573 | 3.420 | unveränderte USDA-Dubletten | 7.703 |
| CoFID 2021 | 2.636 | 251 | mindestens kcal oder ein Makro fehlt bzw. ist nicht quantifiziert | 0 |
| USDA FNDDS 2021–2023 | 5.431 | 1 | Humanmilch ohne Nährwerte | 16.993 |

## Werte und Identität

Format: `[id, Anzeigename, englischer Suchname, kcal, Protein, KH, Fett, Quelle, Mikroobjekt, optionale Einheit]`. Die optionale Einheit ist `ml`; fehlt sie, gilt `g`. Alle Werte beziehen sich auf 100 g bzw. 100 ml. Die IDs der zusätzlichen Quelle CNF haben das Präfix `CNF_`. Bestehende Datensatz-IDs und daraus gebildete `catalogKey` bleiben erhalten.

- USDA SR Legacy enthält Gesamt-Kohlenhydrate (beispielsweise FDC 167512: 41,2 g KH und zusätzlich 1,2 g Ballaststoffe). CNF übernimmt ebenfalls Nährstoff 205 unverändert inklusive Ballaststoffen. Kein Abzug oder Neuberechnen der Energie.
- Nur bekannte Mikros: water, fiber, vitc, calcium, iron, b12, potassium, magnesium, folate. Einheiten wie bisher: g, mg bzw. µg. Fehlende, leere oder nicht quantifizierte Felder sind keine gemessenen Nullwerte und werden weggelassen. Ist dadurch ein Pflichtmakro nicht quantifiziert, entfällt das Lebensmittel.
- Keine belastbare allgemeine Übersetzungslogik im bestehenden Importpfad: englische Namen in beiden Namensfeldern, kein erfundenes Deutsch. Suche prüft beide Namen unabhängig von der App-Sprache. BLS behält seinen bestehenden Prioritätsbonus von 35.
- CNF Food_Source_Code 0 (unverändert) und 11 (USDA-Daten, dort inzwischen gelöscht) entfallen nur bei vorhandenem USDA-SR-Legacy-NDB-Code. Kanadisch angepasste Einträge bleiben erhalten. `scripts/usda-sr-legacy-ndb.json` enthält ausschließlich NDB/FDC-Identifikatorpaare der 7.793 vorhandenen Legacy-Einträge, abgeleitet aus `sr_legacy_food.csv` des offiziellen USDA-Archivs; URL und SHA-256 des Archivs stehen in der Datei. Der Import ist damit ohne weitere Netzwerkabfragen reproduzierbar.
- CNF-Anzeigenamen (Feld 1) stammen aus `scripts/lib/cnf-names-de.json` und sind KI-übersetzt, nicht amtlich; der englische CNF-Name bleibt als Suchname in Feld 2. Fehlt eine ID in der Tabelle, bleibt der englische Name stehen (12 Namen sind noch englisch).
- CNF-Portionen stammen ausschließlich aus `Measure_Type_Code=6` (User-defined). Die fixierte `Measure_Type.csv` wird auf die Definitionen 3 = Refuse, 6 = User-defined und 9 = Yield geprüft. Abfall- und Ausbeutemaße entfallen vor der Vierergrenze. Nach Korrektur bleiben 7.703 Portionen bei 2.511 Lebensmitteln; 38 Lebensmittel verlieren alle bisherigen Portionen, insgesamt haben 62 der 2.573 CNF-Lebensmittel keine Portion.
- CNF 2026 Measure_Weight_Conversion ist ausdrücklich das Gewicht des Maßes (Strukturhandbuch S. 17), kein älterer Multiplikationsfaktor. Grammgewicht direkt übernommen, nicht mit 100 multipliziert. Nullgewichte und ungültige Mengen entfallen. Höchstens vier eindeutige Portionen je Lebensmittel, Namen auf bestehende 80 Zeichen begrenzt. Keine g/ml-Umrechnung.

## Laden, Filter und Sicherungen

Katalog insgesamt: 5.541.974 → 6.786.768 Bytes (inklusive Manifest und Portionen; unkomprimiert; vor der Entfernung von CoFID/FNDDS 10.355.631). Die Suche bleibt im Worker, bei Ausfall in kleinen asynchronen Hauptthread-Blöcken. Downloads des Loaders sind auf vier gleichzeitig begrenzt; Offline-Vorladen bleibt auf drei begrenzt und folgt automatisch dem Manifest. `puls-catalog-v4` verwirft beim Aktivieren die alten Chunks, Portionen und Sidecars gemeinsam (kein Mischen alter Sidecars mit neuen Chunks); der Name der Sidecars bleibt `nutrients-v2`, weil ihre übrigen Zeilen byte-gleich sind. Der Katalog-Abruf nutzt `?v=15`, damit auch ein HTTP-Cache keinen alten Manifest liefert. Ein echter iPhone-Laufzeit-/Layouttest ist durch den Koordinator erforderlich; VM-Messungen sind kein Nachweis wahrgenommener Geschwindigkeit auf dem Gerät.

Filter `cnf` neben `bls`, `usda`, `ciqual`, `off`, `own`, `puls`. Worker und Fallback filtern vor der Begrenzung auf 60 Treffer. Alte gespeicherte Quellenlisten erhalten `cnf` einmalig beim bestehenden Migrationsweg. Die Schlüssel `cofid` und `fndds` bleiben als gültige gespeicherte Werte erlaubt, damit alte Sicherungen und Profile laden und synchronisieren; die Oberfläche kennt sie nicht mehr und ignoriert sie. Besteht eine gespeicherte Auswahl nur aus solchen Schlüsseln, gilt „alle Datenbanken“ statt einer leeren Suche; eine ausdrücklich leere Liste verhält sich wie vorher. `foodSearch.catalogueSourcesVersion: 1` verhindert erneutes Aktivieren nach bewusster Abwahl. Die Validierung akzeptiert alte Sicherungen und das optionale Feld, ohne neue Speicher-/Sync-Wege einzuführen. Keine Auth- oder Serveränderung.

## Quellen und Lizenzen

Health Canada, Canadian Nutrient File 2026. Contains information licensed under the Open Government Licence – Canada.

Die Katalog-Hinweise nennen nur noch ausgelieferte Datenbanken. Für Lebensmittel aus CoFID 2021 und USDA FNDDS, die Nutzer vor der Entfernung geloggt oder übernommen haben, zeigt die Detailansicht weiterhin die jeweilige Quellenangabe samt Lizenzhinweis (Open Government Licence v3.0 bzw. gemeinfrei).

Offizielle Quelle: [CNF 2026 einschließlich Handbücher](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109). Die bisherigen BLS-, USDA- und Ciqual-Quellenangaben gelten unverändert weiter. Kein Import von AFCD, NEVO oder proprietären Datenbanken.
