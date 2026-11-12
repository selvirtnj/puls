# Gebündelte Lebensmitteldatenbanken

Der Katalog enthält 28.893 Lebensmittel (vorher 18.253). Reproduzierbarer Import:

```powershell
node scripts/import-food-databases.cjs [Rohdatenordner]
```

Ohne Argument verwendet das Skript `C:\Users\selvir\AppData\Local\Temp\puls-fooddb`. Es benötigt ausschließlich Node-Standardbibliotheken. CSV wird als UTF-8/BOM mit mehrzeiligen, zitierten Feldern gelesen. Rohdateien werden weder ausgeführt noch kopiert. Die vorhandenen Basis-Chunks `foods-0.json` bis `foods-36.json` bleiben bytegleich. Wiederholungen erzeugen dieselben Erweiterungsdateien ab `foods-37.json`; IDs und vorhandene Portionswerte bleiben erhalten.

| Quelle | Importiert | Ausgelassen | Grund | Übernommene Portionen |
|---|---:|---:|---|---:|
| CNF 2026 | 2.573 | 3.420 | unveränderte USDA-Dubletten | 8.117 |
| CoFID 2021 | 2.636 | 251 | mindestens kcal oder ein Makro fehlt bzw. ist nicht quantifiziert | 0 |
| USDA FNDDS 2021–2023 | 5.431 | 1 | Humanmilch ohne Nährwerte | 16.993 |

## Werte und Identität

Format: `[id, Anzeigename, englischer Suchname, kcal, Protein, KH, Fett, Quelle, Mikroobjekt, optionale Einheit]`. Die optionale Einheit ist `ml`; fehlt sie, gilt `g`. Alle Werte beziehen sich auf 100 g bzw. 100 ml. Neue IDs haben die Präfixe `CNF_`, `COFID_`, `FNDDS_`. Bestehende Datensatz-IDs und daraus gebildete `catalogKey` bleiben erhalten.

- USDA SR Legacy enthält Gesamt-Kohlenhydrate (beispielsweise FDC 167512: 41,2 g KH und zusätzlich 1,2 g Ballaststoffe). CNF/FNDDS übernehmen ebenfalls Nährstoff 205 unverändert inklusive Ballaststoffen. Kein Abzug oder Neuberechnen der Energie.
- CoFID CHO enthält verfügbare Kohlenhydrate als Monosaccharid-Äquivalente (Handbuch S. 10–11 und 16). Unverändert übernommen, daher nicht direkt identisch mit EU-Etikett-KH. Alkoholische Getränke, Gruppe Q einschließlich Untergruppen, bleiben je 100 ml (Handbuch S. 7, 26). Keine erfundene Dichte.
- Nur bekannte Mikros: water, fiber, vitc, calcium, iron, b12, potassium, magnesium, folate. Einheiten wie bisher: g, mg bzw. µg. CoFID `N`, leere Felder und `Tr` sind keine gemessenen Nullwerte und werden weggelassen. Ist dadurch ein Pflichtmakro nicht quantifiziert, entfällt das Lebensmittel. Bei fiber wird ausschließlich AOACFIB genutzt; ENGFIB/NSP misst eine andere Fraktion und ersetzt es nicht.
- Keine belastbare allgemeine Übersetzungslogik im bestehenden Importpfad: englische Namen in beiden Namensfeldern, kein erfundenes Deutsch. Suche prüft beide Namen unabhängig von der App-Sprache. BLS behält seinen bestehenden Prioritätsbonus von 35.
- CNF Food_Source_Code 0 (unverändert) und 11 (USDA-Daten, dort inzwischen gelöscht) entfallen nur bei vorhandenem USDA-SR-Legacy-NDB-Code. Kanadisch angepasste Einträge bleiben erhalten. `scripts/usda-sr-legacy-ndb.json` enthält ausschließlich NDB/FDC-Identifikatorpaare der 7.793 vorhandenen Legacy-Einträge, abgeleitet aus `sr_legacy_food.csv` des offiziellen USDA-Archivs; URL und SHA-256 des Archivs stehen in der Datei. Der Import ist damit ohne weitere Netzwerkabfragen reproduzierbar.
- CNF 2026 Measure_Weight_Conversion ist ausdrücklich das Gewicht des Maßes (Strukturhandbuch S. 17), kein älterer Multiplikationsfaktor. Grammgewicht direkt übernommen, nicht mit 100 multipliziert. FNDDS gramWeight wird direkt übernommen; Nullgewichte und ungültige Mengen entfallen. Höchstens vier eindeutige Portionen je Lebensmittel, Namen auf bestehende 80 Zeichen begrenzt. Keine g/ml-Umrechnung.

## Laden, Filter und Sicherungen

Katalog insgesamt: 5.541.974 → 10.387.038 Bytes (inklusive Manifest und Portionen; unkomprimiert). Die Suche bleibt im Worker, bei Ausfall in kleinen asynchronen Hauptthread-Blöcken. Downloads des Loaders sind auf vier gleichzeitig begrenzt; Offline-Vorladen bleibt auf drei begrenzt und folgt automatisch dem Manifest. `puls-catalog-v3` verhindert veraltete Inhalte. Ein echter iPhone-Laufzeit-/Layouttest ist durch den Koordinator erforderlich; VM-Messungen sind kein Nachweis wahrgenommener Geschwindigkeit auf dem Gerät.

Neue Filter `cnf`, `cofid`, `fndds`; FNDDS ist unabhängig vom bisherigen `usda`-Filter. Worker und Fallback filtern vor der Begrenzung auf 60 Treffer. Alte gespeicherte Quellenlisten erhalten die drei Quellen einmalig beim bestehenden Migrationsweg. `foodSearch.catalogueSourcesVersion: 1` verhindert erneutes Aktivieren nach bewusster Abwahl. Die Validierung akzeptiert alte Sicherungen und das optionale Feld, ohne neue Speicher-/Sync-Wege einzuführen. Keine Auth- oder Serveränderung.

## Quellen und Lizenzen

Health Canada, Canadian Nutrient File 2026. Contains information licensed under the Open Government Licence – Canada.

Public Health England, McCance and Widdowson's Composition of Foods Integrated Dataset 2021. Contains public sector information licensed under the Open Government Licence v3.0.

U.S. Department of Agriculture, Agricultural Research Service. 2024. USDA Food and Nutrient Database for Dietary Studies 2021-2023. (Public Domain)

Offizielle Quellen: [CNF 2026 einschließlich Handbücher](https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109), [CoFID und User Guide 2021](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), [USDA Download-Datensätze](https://fdc.nal.usda.gov/download-datasets/). Die bisherigen BLS-, USDA- und Ciqual-Quellenangaben gelten unverändert weiter. Kein Import von CoFID_oldFoods, AFCD, NEVO oder proprietären Datenbanken.
