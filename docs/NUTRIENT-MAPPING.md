# Nährstoff-Sidecars v2

Prüfsummen des Basiskatalogs und der Sidecars werden nach CRLF-zu-LF-Normalisierung geprüft und entsprechen den ausgelieferten LF-Dateien. Windows- und LF-Checkouts liefern dieselben Digests. Rohdatei-Prüfsummen beziehen sich immer auf exakte Originalbytes.

v1 basiert auf ad92acf; v2 erweitert den Stand 7a01611 um CNF (12.11.2026). CoFID 2021 und USDA FNDDS 2021–2023 waren ebenfalls Teil von v2 und wurden am 14.11.2026 auf Selvirs Wunsch wieder entfernt; Zeilen, Reader und Zuordnungen sind weg, übrige Zeilen byte-gleich. Das unabhängige Integrationsreview für v2 erfolgt beim Koordinator. Registry und Resolver werden nach `flows.js` geladen. Die Sidecars enthalten vier Basis-Makros und 63 neue Schlüssel. Die neun Altschlüssel water, fiber, vitc, calcium, iron, b12, potassium, magnesium und folate stammen ausschließlich aus Basiskatalog oder gespeicherten Snapshots. foods-0…36 und sämtliche v1-Dateien bleiben unverändert.

## Reproduzieren

Node 24+ genügt, ohne npm-Pakete und ohne Netzwerk. Im Repository ausführen

```powershell
node scripts/import-nutrients.cjs C:/Users/selvir/Documents/Projekte/puls/catalog-raw
node scripts/check.cjs
```

Ohne Argument gilt `catalog-raw/` im Repository; in diesem Worktree liegen die Rohdaten außerhalb unter `C:/Users/selvir/Documents/Projekte/puls/catalog-raw` und werden nur gelesen. Der Import liest die unten fixierten Rohdateien direkt aus XLSX/CSV/JSON. Entpackte XML-Dateien und Inventare sind keine Eingabeabhängigkeit. Alle Rohdatei-SHA-256 und die aggregierten Basiskatalog-Hashes werden vor dem Schreiben geprüft. Abweichungen, fehlende IDs, unerwartete Bestandsabweichungen oder doppelte Quell-IDs stoppen den Lauf. Der Import schreibt ausschließlich die 64 v2-Shards und ihre Metadatei. Ausgabe ist deterministisch und enthält keinen variablen Zeitstempel. Tests benötigen keine Rohdaten.

## Format und Identität

Dateien heißen nutrients-v2-00.json bis nutrients-v2-63.json, die Meta nutrients-v2.json. Jede enthält weiterhin schemaVersion 1, eine keys-Liste mit 67 Spalten und rows als Objekt. Die Liste entspricht der Reihenfolge von PULS_NUTRIENT_DEFS nach Ausschluss der neun Altschlüssel. Die öffentliche Registry umfasst weiterhin 76 Definitionen. catalogKey besteht exakt aus unveränderter Katalogquelle, Doppelpunkt und Record-ID. FNV-1a-32 über UTF-8-Bytes, Start 0x811c9dc5, Multiplikator 0x01000193, unsigned modulo 64 bestimmt den Shard. Zeilen sind lexikographisch nach catalogKey sortiert.

Die Werte einer Zeile stehen als Semikolon-String in keys-Reihenfolge. Leeres Feld bedeutet unbekannt, 0 bedeutet bekannte Null. Die ersten vier Werte sind kcal, p, c und f exakt aus dem Basiskatalog. Nur Lebensmittel mit mindestens einem bekannten neuen Schlüssel aus D4 erhalten eine Zeile: insgesamt 20.772. Die 53 regionalen Einträge bleiben ohne Zeile, ebenso jedes Lebensmittel mit ml-Basis (derzeit gibt es keines). SR Legacy 167617 (Duck, scoter, white-winged) besitzt ebenfalls keinen bekannten erweiterten Wert. Meta enthält Rohdatei-Herkunft/Hashes, Basisdatei-Hashes, Shard-Hashes und Abdeckung je Quelle/Schlüssel.

## Rohdateien und Selbstprüfung

| Quelle | Ausgabe | gefundene Katalog-IDs | verglichene vorhandene Werte | unerwartete Abweichungen |
|---|---|---:|---:|---:|
| BLS 4.0 | BLS 4.0, 2025 DE | 7090 | 91198 | 0 |
| USDA SR Legacy 2018 | SR Legacy April 2018 | 7793 | 97850 | 0 |
| USDA Foundation 2026 | Foundation JSON 2026-10-29 | 311 | 3218 | 0 |
| Ciqual 2025 | Ciqual 2025, FR 2025-11-03 | 3006 | 30957 | 0 |

Die Prüfung vergleicht zusätzlich das Fehlen aller neun Legacy-Zusatzwerte. BLS und Ciqual stimmen exakt, SR Legacy nach exakter dezimaler Drei-Stellen-Rundung mit ties-to-even. Foundation verwendet amount und Energie in der Priorität 1008, 2048, 2047. Einzige zugelassene Abweichung ist USDA Foundation 2026:2747669 (Snapper), B12 im Katalog 1.57 µg, im Oktober 2026 1.63 µg. Der vorhandene Katalogwert bleibt erhalten.

### BLS 4.0

- `bls-4.0/BLS_4_0_2025_DE_extracted/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx`, SHA-256 `524bbefe25b691f5cb3de7a9f3e27fa2967aebfeabf217d99414ba7806e78c60`.
- `bls-4.0/BLS_4_0_2025_DE_extracted/BLS_4_0_2025_DE/BLS_4_0_Components_DE_EN.xlsx`, SHA-256 `359aefcd2086f45e62ff3dbd0c8536306e594a5806ac325d8bf86f484561bdf4`.

### USDA SR Legacy 2018

- `usda-sr-legacy-2018/FoodData_Central_sr_legacy_food_csv_2018-04_extracted/FoodData_Central_sr_legacy_food_csv_2018-04/food.csv`, SHA-256 `de8b0390058db4f102368c9fbdfde144790b480ff4cb0507c0e060ef99805dee`.
- `usda-sr-legacy-2018/FoodData_Central_sr_legacy_food_csv_2018-04_extracted/FoodData_Central_sr_legacy_food_csv_2018-04/food_nutrient.csv`, SHA-256 `6d07e6fc062b09750c4d95112be5a5cdb56a2346efcfd0c96b7a7d705812d4bd`.
- `usda-sr-legacy-2018/FoodData_Central_sr_legacy_food_csv_2018-04_extracted/FoodData_Central_sr_legacy_food_csv_2018-04/nutrient.csv`, SHA-256 `466ab9d011094cc1ad8d939b246693988b56817c42d0e40a98820723695c6084`.

### USDA Foundation 2026

- `usda-foundation-2026-10-json/FoodData_Central_foundation_food_json_2026-10-29_extracted/FoodData_Central_foundation_food_json_2026-10-29.json`, SHA-256 `990e7731dcec30cecbbb212896a0fe4333f38c65ce7f525e2b679f0dc27658a1`.
- `usda-foundation/FoodData_Central_foundation_food_csv_2026-10-29_extracted/FoodData_Central_foundation_food_csv_2026-10-29/nutrient.csv`, SHA-256 `226ba937d1a73e8c87bd7fdcdd577524699bef4025c9232ee474b7d3083498ff`. Diese zusätzliche Datei dient ausschließlich der Prüfung von Nährstoffnummern und Einheiten.

### Ciqual 2025

- `ciqual-2025/Table_Ciqual_2025_FR_2025_11_03.xlsx`, SHA-256 `5555c572fa3735991298d832d0427788fa69a11b4fd20a5d580d58942369fbb0`.

## Importregeln

1. **R1** Fehlende Zellen/Zeilen, leere Felder, Strich, N, TR, traces, Messgrenzen und alle Angaben mit kleiner-als-Zeichen bleiben unbekannt. Quellzahlen werden niemals aus Grenzwerten ersetzt.
2. **R2** Numerische Null bleibt Null, vorbehaltlich der expliziten Formelprüfung R3.
3. **R3** Positive Quellwerte bleiben erhalten. Bei Null mit Datenherkunft Formelberechnung werden die Bestandteile der Components-Formel geprüft. Bestandteile dürfen Zahlen oder Messgrenzen/Spuren sein. Fehlende Bestandteile verhindern eine Null. Verschachtelte Formelnullen werden rekursiv geprüft. Bei OR genügt eine vollständig belegte Alternative. Unlesbare Formeln und Zyklen bleiben konservativ unbekannt. Null mit jeder anderen Datenherkunft außer dem Fehlend-Marker '-' wird übernommen. Alle Formeln der fixierten Ausgabe konnten gelesen werden. Die über dieselben bisherigen BLS-Zuordnungen gezählten Unterdrückungen sinken von 2549 auf 2331. Der Import berechnet die Quellformeln nicht neu.
4. **R4** Ausschließlich Einheitenumrechnung zwischen µg/mg/g. BLS B6, Kupfer und Mangan werden durch 1000 geteilt. Keine Umrechnung von g in ml, RE in RAE, Folatformen oder Niacin in Äquivalente. Einzige zusätzliche Ableitung ist Ciqual RAE als Retinol + Beta-Carotin/12 mit zwei numerischen Eingaben.
5. **R5** USDA verwendet die unten festgelegten IDs. ALA 1404, EPA 1278, DHA 1272, Linolsäure 1316 und Arachidonsäure 1408 sind spezifisch. Arachidonsäure hat in beiden Quellen die Nährstoffnummer 855. Die SR-Beschriftung für 1406/853 ist falsch, diese Nummer gehört zu 20:3 n-6. Undifferenzierte oder lediglich cis-benannte Spalten werden nicht ersatzweise verwendet. Es entstehen keine eigenen Omega-Summen. Foundation verwendet ausschließlich amount, weder median noch min/max. Identische nutrient.id dürfen nicht doppelt vorkommen. In den fixierten Daten gibt es keine solchen Duplikate. Zucker stammt bei SR aus 2000/269, bei Foundation aus 1063/269.3. Diese unterschiedlichen Rohdefinitionen werden getrennt behandelt. Bei Foundation hat 1063 Vorrang vor dem redundanten Feld 2000, das bei ID 1750342 abweicht. Die beiden Felder werden nicht addiert.
6. **R6** Erweiterte Werte besitzen höchstens fünf signifikante Stellen als einfache Dezimalzahl ohne Exponentenschreibweise. Alle Basis-Makros bleiben exakt erhalten: 836 Makrozellen haben mehr als fünf signifikante Stellen (BLS 6, CNF 830). Die sechs BLS-Fälle sind H739400/p, C111000/p, C211100/p, C113000/p, Q400000/c und Q4C1000/c.
7. **R7** Negative Werte bleiben unbekannt und werden gezählt. Foundation enthält zehn negative Kohlenhydratwerte außerhalb der 311 Katalogeinträge. Die anderen Quellen enthalten keine negativen Zellen in den geprüften Nährstoffbereichen.
8. **R8** Plausibilität wird ausschließlich berichtet. Quellenwerte bleiben erhalten. Warnschwellen sind Zucker > 1.1 × Kohlenhydrate + 0.5 g und Summe gesättigt/einfach/mehrfach > 1.1 × Fett + 0.5 g. Die 49 bekannten Fälle (24 v1, 25 neu) stehen unten und sind im Test ausdrücklich hinterlegt.
9. **R9** Lebensmittel mit Katalogeinheit `ml` erhalten keine Sidecar-Zeile. (Die CoFID-Regeln zu `Tr`, `N` und Klammerwerten entfielen mit der Quelle am 14.11.2026.)

## Definitionen zwischen Quellen

### Nachprüfung der USDA-Nummern

Der Import prüft 71 verwendete Dictionary-IDs über `nutrient_nbr` gegen die Foundation-Definitionsliste Oktober 2026 und ihre Einheiten. Die 66 zusätzlich im Foundation-JSON vorhandenen IDs werden gegen `nutrient.number` geprüft. Die fünf übrigen IDs 1018, 1057, 1099, 1186 und 1190 sind durch die Definitionsliste abgedeckt. Es bestehen keine Nummern- oder Einheitenabweichungen.

Die SR-Beschriftungen 1406/853 und 1408/855 sind fehlerhaft. Bei 1032 Lebensmitteln mit den erforderlichen Zahlen liegt 1405 + 1406 in 1026 Fällen innerhalb 0.001 g der 20:3-Summe 1325. Für 1408 und die 20:4-Summe 1271 liegen 165 Zahlenpaare vor, 164 davon exakt gleich. Die Quellabweichung bei SR 167639 (0.67 gegenüber 0.067) wird unverändert erhalten. Bei SR 172614 Lammleber gilt 1405 + 1406 = 0.002 + 0.017 = 0.019, während 1408 = 1271 = 0.156. Die Sidecars enthalten jetzt 165 bekannte SR-Arachidonsäurewerte. Die frühere Zuordnung 1406 war falsch und wurde vollständig ersetzt.

### Nachprüfung der BLS-Datenherkunft

Die lokale `BLS_4_0_Dokumentation_DE.pdf` wurde ohne Zusatzpakete aus den Flate-komprimierten PDF-Textstreams einschließlich ToUnicode-Zeichenzuordnung gelesen. Abschnitte 4.2.2, 4.2.8, 4.2.9 und 4.2.13 unterscheiden Rezeptberechnung, Übernommener Wert, Reskalierung und Formelberechnung. Abschnitte 4.3 und 4.4 unterscheiden fehlende Angaben von numerischen Werten. Daraus ergibt sich kein Widerspruch zur präzisierten Regel K3. Numerische Nullen aus den drei zuerst genannten Kategorien benötigen keine Prüfung der Summenformel der jeweiligen Spalte.

Für den Vorher/Nachher-Vergleich werden dieselben bisherigen BLS-Zuordnungen einschließlich der später aus Sidecars ausgeschlossenen Altschlüssel ausgewertet. Alle 218 wieder zugelassenen Werte gehören zu FIBT. Die Bestands-Selbstprüfung verwendet weiterhin die unveränderten Rohwerte aller neun Altschlüssel.

| Datenherkunft | unterdrückte Nullen vorher | nachher |
|---|---:|---:|
| Formelberechnung | 2331 | 2331 |
| Rezeptberechnung | 208 | 0 |
| Übernommener Wert | 4 | 0 |
| Reskalierung | 6 | 0 |
| Analyse | 0 | 0 |
| Logische Null | 0 | 0 |
| Musterberechnung | 0 | 0 |
| Nährstoffdatenbank | 0 | 0 |
| Aggregation | 0 | 0 |
| Literatur | 0 | 0 |
| Labelangabe | 0 | 0 |
| Gesamt | 2549 | 2331 |

### Unterschiede der Nährstoffdefinitionen

- Kohlenhydrate sind im BLS verfügbar, USDA by difference einschließlich Ballaststoffen und Ciqual verfügbar. Die unveränderten Basis-Makros dienen später der Identitätsprüfung.
- Vitamin A ist beim BLS VITAA nach der dortigen Formel einschließlich weiterer Carotinoide und bei USDA das RAE-Feld. Die Ciqual-Aktivitätsspalte wird wegen widersprüchlicher Bezeichnung/INFOODS-Tag ausgelassen. Ihre RAE-Werte stammen ausschließlich aus der ausdrücklich beauftragten Zweikomponenten-Ableitung.
- Vitamin K ist BLS K1+K2, USDA nur Phyllochinon/K1. Ciqual übernimmt K1 und addiert K2 nur bei numerischem K2. K2 allein erzeugt keinen Gesamtwert, wenn K1 fehlt. Unterschiedliche Definitionen bleiben in sourceNotes dokumentiert.
- Vitamin E verwendet ausschließlich Alpha-Tocopherol. Die allgemeinere Ciqual-Spalte Vitamine E und die Foundation-ID 2068 werden ausgelassen.
- cysteine enthält BLS-Cystein und USDA-Cystin 1216, ohne Umrechnung der unterschiedlichen Stoffdefinition. Foundation-Cysteine 1232 mit 89 Werten in der vollständigen Rohdatei bleibt entsprechend der vorgegebenen Cystin-Zuordnung ausgelassen.
- folate wird nicht neu importiert. Legacy-BLS bedeutet natürliches Folat FOLFD, USDA und Ciqual Gesamtfolat. folate_dfe und folic_acid sind getrennte neue Schlüssel. BLS FOL, USDA 1190 und Ciqual DFE-Spalte bleiben als jeweilige Quellenäquivalente gekennzeichnet.
- Natrium stammt direkt aus NA/1093 beziehungsweise der Ciqual-Natriumspalte. Salz ist kein Sidecar-Schlüssel und wird hier nicht abgeleitet.
- BLS-Iodid bleibt unter iodine mit Definitionshinweis erhalten. Omega-Summen, Transfett-Gesamtwerte und andere nicht vorhandene Felder bleiben je Quelle leer. Fehlende Spalten werden nicht durch Summen anderer Spalten ersetzt.
- Referenzwerte der neuen Schlüssel stehen in der Registry auf status none. Die bisherigen acht Mikroziele verwenden weiterhin ihre bestehenden Regeln.

## Zuordnung je Schlüssel und Quelle

Die Ciqual-Spaltennummern sind 1-basiert. Bei USDA steht die Einheit der Rohquelle, bei BLS zusätzlich die ausdrücklich nötige Umrechnung. Ein Gedankenstrich bedeutet kein Importfeld. Die neun Alt-Zuordnungen dienen ausschließlich der Bestands-Selbstprüfung und werden nicht in Sidecars geschrieben. Das Vorhandensein einer nominalen USDA-ID bedeutet nicht, dass jede Ausgabe Werte dafür enthält.

| Schlüssel | kanonische Einheit | BLS | SR Legacy | Foundation Oktober 2026 | Ciqual 2025 |
|---|---|---|---|---|---|
| kcal | kcal | `ENERCC` kcal | `1008` Energy (KCAL) | `1008 > 2048 > 2047` kcal | Sp. 11 Energie, Règlement UE N° 1169 2011 (kcal 100 g) |
| p | g | `PROT625` g | `1003` Protein (G) | `1003` Protein (g) | Sp. 15 Protéines, N x facteur de Jones (g 100 g) |
| c | g | `CHO` g | `1005` Carbohydrate, by difference (G) | `1005` Carbohydrate, by difference (g) | Sp. 17 Glucides (g 100 g) |
| f | g | `FAT` g | `1004` Total lipid (fat) (G) | `1004` Total lipid (fat) (g) | Sp. 18 Lipides (g 100 g) |
| water | ml | — | — | — | — |
| fiber | g | `FIBT` g | `1079` Fiber, total dietary (G) | `1079` Fiber, total dietary (g) | Sp. 27 Fibres alimentaires (g 100 g) |
| vitc | mg | `VITC` mg | `1162` Vitamin C, total ascorbic acid (MG) | `1162` Vitamin C, total ascorbic acid (mg) | Sp. 73 Vitamine C (mg 100 g) |
| calcium | mg | `CA` mg | `1087` Calcium, Ca (MG) | `1087` Calcium, Ca (mg) | Sp. 51 Calcium (mg 100 g) |
| iron | mg | `FE` mg | `1089` Iron, Fe (MG) | `1089` Iron, Fe (mg) | Sp. 54 Fer (mg 100 g) |
| b12 | µg | `VITB12` µg | `1178` Vitamin B-12 (UG) | `1178` Vitamin B-12 (µg) | Sp. 83 Vitamine B12 (µg 100 g) |
| potassium | mg | `K` mg | `1092` Potassium, K (MG) | `1092` Potassium, K (mg) | Sp. 59 Potassium (mg 100 g) |
| magnesium | mg | `MG` mg | `1090` Magnesium, Mg (MG) | `1090` Magnesium, Mg (mg) | Sp. 56 Magnésium (mg 100 g) |
| folate | µg | — | — | — | — |
| sugars | g | `SUGAR` g | `2000` Sugars, Total (G) | `1063` Sugars, Total (g) | Sp. 19 Sucres (g 100 g) |
| starch | g | `STARCH` g | `1009` Starch (G) | `1009` Starch (g) | Sp. 26 Amidon (g 100 g) |
| polyols | g | `POLYL` g | — | — | Sp. 28 Polyols totaux (g 100 g) |
| glucose | g | `GLUS` g | `1011` Glucose (G) | `1011` Glucose (g) | Sp. 22 Glucose (g 100 g) |
| fructose | g | `FRUS` g | `1012` Fructose (G) | `1012` Fructose (g) | Sp. 20 Fructose (g 100 g) |
| galactose | g | `GALS` g | `1075` Galactose (G) | `1075` Galactose (g) | Sp. 21 Galactose (g 100 g) |
| sucrose | g | `SUCS` g | `1010` Sucrose (G) | `1010` Sucrose (g) | Sp. 25 Saccharose (g 100 g) |
| lactose | g | `LACS` g | `1013` Lactose (G) | `1013` Lactose (g) | Sp. 23 Lactose (g 100 g) |
| maltose | g | `MALS` g | `1014` Maltose (G) | `1014` Maltose (g) | Sp. 24 Maltose (g 100 g) |
| fiber_sol | g | `FIBSOL` g | `1082` Fiber, soluble (G) | `1082` Fiber, soluble (g) | — |
| fiber_insol | g | `FIBINS` g | `1084` Fiber, insoluble (G) | `1084` Fiber, insoluble (g) | — |
| satfat | g | `FASAT` g | `1258` Fatty acids, total saturated (G) | `1258` Fatty acids, total saturated (g) | Sp. 32 AG saturés (g 100 g) |
| mufat | g | `FAMS` g | `1292` Fatty acids, total monounsaturated (G) | `1292` Fatty acids, total monounsaturated (g) | Sp. 33 AG monoinsaturés (g 100 g) |
| pufat | g | `FAPU` g | `1293` Fatty acids, total polyunsaturated (G) | `1293` Fatty acids, total polyunsaturated (g) | Sp. 34 AG polyinsaturés (g 100 g) |
| transfat | g | — | `1257` Fatty acids, total trans (G) | `1257` Fatty acids, total trans (g) | — |
| omega3 | g | `FAPUN3` g | — | — | — |
| omega6 | g | `FAPUN6` g | — | — | — |
| ala | g | `F18:3CN3` g | `1404` PUFA 18:3 n-3 c,c,c (ALA) (G) | `1404` PUFA 18:3 n-3 c,c,c (ALA) (g) | Sp. 45 AG 18:3 c9,c12,c15 (n-3), alpha-linolénique (g 100 g) |
| epa | g | `F20:5CN3` g | `1278` PUFA 20:5 n-3 (EPA) (G) | `1278` PUFA 20:5 n-3 (EPA) (g) | Sp. 47 AG 20:5 5c,8c,11c,14c,17c (n-3) EPA (g 100 g) |
| dha | g | `F22:6CN3` g | `1272` PUFA 22:6 n-3 (DHA) (G) | `1272` PUFA 22:6 n-3 (DHA) (g) | Sp. 48 AG 22:6 4c,7c,10c,13c,16c,19c (n-3) DHA (g 100 g) |
| linoleic | g | `F18:2CN6` g | `1316` PUFA 18:2 n-6 c,c (G) | `1316` PUFA 18:2 n-6 c,c (g) | Sp. 44 AG 18:2 9c,12c (n-6), linoléique (g 100 g) |
| arachidonic | g | `F20:4CN6` g | `1408` / Nummer 855, PUFA 20:4 n-6 (G), SR-Label fehlerhaft | `1408` / Nummer 855, PUFA 20:4 n-6 (g) | Sp. 46 AG 20:4 5c,8c,11c,14c (n-6), arachidonique (g 100 g) |
| cholesterol | mg | `CHORL` mg | `1253` Cholesterol (MG) | `1253` Cholesterol (mg) | Sp. 49 Cholestérol (mg 100 g) |
| histidine | g | `HIS` g | `1221` Histidine (G) | `1221` Histidine (g) | — |
| isoleucine | g | `ILE` g | `1212` Isoleucine (G) | `1212` Isoleucine (g) | — |
| leucine | g | `LEU` g | `1213` Leucine (G) | `1213` Leucine (g) | — |
| lysine | g | `LYS` g | `1214` Lysine (G) | `1214` Lysine (g) | — |
| methionine | g | `MET` g | `1215` Methionine (G) | `1215` Methionine (g) | — |
| phenylalanine | g | `PHE` g | `1217` Phenylalanine (G) | `1217` Phenylalanine (g) | — |
| threonine | g | `THR` g | `1211` Threonine (G) | `1211` Threonine (g) | — |
| tryptophan | g | `TRP` g | `1210` Tryptophan (G) | `1210` Tryptophan (g) | — |
| valine | g | `VAL` g | `1219` Valine (G) | `1219` Valine (g) | — |
| cysteine | g | `CYSTE` g | `1216` Cystine (G) | `1216` Cystine (g) | — |
| tyrosine | g | `TYR` g | `1218` Tyrosine (G) | `1218` Tyrosine (g) | — |
| vita_rae | µg | `VITAA` µg | `1106` Vitamin A, RAE (UG) | `1106` Vitamin A, RAE (µg) | Sp. 64 + Sp. 65 / 12 (µg), nur beide numerisch |
| retinol | µg | `RETOL` µg | `1105` Retinol (UG) | `1105` Retinol (µg) | Sp. 64 Rétinol (µg 100 g) |
| beta_carotene | µg | `CARTB` µg | `1107` Carotene, beta (UG) | `1107` Carotene, beta (µg) | Sp. 65 Beta-Carotène (µg 100 g) |
| vitd | µg | `VITD` µg | `1114` Vitamin D (D2 + D3) (UG) | `1114` Vitamin D (D2 + D3) (µg) | Sp. 66 Vitamine D (µg 100 g) |
| vite | mg | `VITE` mg | `1109` Vitamin E (alpha-tocopherol) (MG) | `1109` Vitamin E (alpha-tocopherol) (mg) | Sp. 69 Alpha-tocophérol (vitamine E) (mg 100 g) |
| vitk | µg | `VITK` µg | `1185` Vitamin K (phylloquinone) (UG) | `1185` Vitamin K (phylloquinone) (µg) | Sp. 71 (K1) + numerische Sp. 72 (K2), µg |
| b1 | mg | `THIA` mg | `1165` Thiamin (MG) | `1165` Thiamin (mg) | Sp. 74 Vitamine B1 ou Thiamine (mg 100 g) |
| b2 | mg | `RIBF` mg | `1166` Riboflavin (MG) | `1166` Riboflavin (mg) | Sp. 75 Vitamine B2 ou Riboflavine (mg 100 g) |
| niacin | mg | `NIA` mg | `1167` Niacin (MG) | `1167` Niacin (mg) | Sp. 76 Vitamine B3 ou PP ou Niacine (mg 100 g) |
| niacin_ne | mg | `NIAEQ` mg | — | — | — |
| b5 | mg | `PANTAC` mg | `1170` Pantothenic acid (MG) | `1170` Pantothenic acid (mg) | Sp. 77 Vitamine B5 ou Acide pantothénique (mg 100 g) |
| b6 | mg | `VITB6` µg / 1000 | `1175` Vitamin B-6 (MG) | `1175` Vitamin B-6 (mg) | Sp. 78 Vitamine B6 (mg 100 g) |
| biotin | µg | `BIOT` µg | `1176` Biotin (UG) | `1176` Biotin (µg) | — |
| folate_dfe | µg | `FOL` µg | `1190` Folate, DFE (UG) | `1190` Folate, DFE (UG) | Sp. 79 Vitamine B9 ou Folates totaux, équivalents folates alimentaires, DFE (µg 100 g) |
| folic_acid | µg | `FOLAC` µg | `1186` Folic acid (UG) | `1186` Folic acid (UG) | Sp. 82 Acide folique (enrichissement) (µg 100 g) |
| choline | mg | — | `1180` Choline, total (MG) | `1180` Choline, total (mg) | — |
| sodium | mg | `NA` mg | `1093` Sodium, Na (MG) | `1093` Sodium, Na (mg) | Sp. 61 Sodium (mg 100 g) |
| chloride | mg | `CLD` mg | — | — | Sp. 52 Chlorure (mg 100 g) |
| phosphorus | mg | `P` mg | `1091` Phosphorus, P (MG) | `1091` Phosphorus, P (mg) | Sp. 58 Phosphore (mg 100 g) |
| zinc | mg | `ZN` mg | `1095` Zinc, Zn (MG) | `1095` Zinc, Zn (mg) | Sp. 62 Zinc (mg 100 g) |
| copper | mg | `CU` µg / 1000 | `1098` Copper, Cu (MG) | `1098` Copper, Cu (mg) | Sp. 53 Cuivre (mg 100 g) |
| manganese | mg | `MN` µg / 1000 | `1101` Manganese, Mn (MG) | `1101` Manganese, Mn (mg) | Sp. 57 Manganèse (mg 100 g) |
| selenium | µg | — | `1103` Selenium, Se (UG) | `1103` Selenium, Se (µg) | Sp. 60 Sélénium (µg 100 g) |
| iodine | µg | `ID` µg | `1100` Iodine, I (UG) | `1100` Iodine, I (µg) | Sp. 55 Iode (µg 100 g) |
| fluoride | µg | `FD` µg | `1099` Fluoride, F (UG) | `1099` Fluoride, F (UG) | — |
| chromium | µg | `CR` µg | — | — | — |
| molybdenum | µg | `MO` µg | `1102` Molybdenum, Mo (UG) | `1102` Molybdenum, Mo (µg) | — |
| alcohol | g | `ALC` g | `1018` Alcohol, ethyl (G) | `1018` Alcohol, ethyl (G) | Sp. 30 Alcool (éthanol) (g 100 g) |
| caffeine | mg | — | `1057` Caffeine (MG) | `1057` Caffeine (MG) | — |

## Abdeckung der Sidecars

Anzahl numerisch bekannter Werte einschließlich echter Null für die 67 Sidecar-Spalten. Die neun Altschlüssel sind vollständig ausgeschlossen und bleiben in Basiskatalog sowie gespeicherten Snapshots erhalten.

| Schlüssel | BLS | SR Legacy | Foundation | Ciqual |
|---|---:|---:|---:|---:|
| kcal | 7090 | 7792 | 311 | 3006 |
| p | 7090 | 7792 | 311 | 3006 |
| c | 7090 | 7792 | 311 | 3006 |
| f | 7090 | 7792 | 311 | 3006 |
| sugars | 7024 | 6007 | 121 | 2700 |
| starch | 6876 | 1167 | 71 | 1859 |
| polyols | 6490 | 0 | 0 | 2150 |
| glucose | 6919 | 1740 | 124 | 1194 |
| fructose | 6909 | 1745 | 124 | 1027 |
| galactose | 6168 | 1579 | 78 | 269 |
| sucrose | 6939 | 1733 | 124 | 1145 |
| lactose | 6954 | 1712 | 124 | 725 |
| maltose | 6614 | 1711 | 124 | 827 |
| fiber_sol | 3229 | 0 | 10 | 0 |
| fiber_insol | 3232 | 0 | 10 | 0 |
| satfat | 7024 | 7450 | 108 | 2882 |
| mufat | 6779 | 7277 | 108 | 2372 |
| pufat | 6890 | 7279 | 93 | 2358 |
| transfat | 0 | 4179 | 75 | 0 |
| omega3 | 6643 | 0 | 0 | 0 |
| omega6 | 6843 | 0 | 0 | 0 |
| ala | 6685 | 1967 | 57 | 1758 |
| epa | 6450 | 5800 | 57 | 1399 |
| dha | 6486 | 5772 | 57 | 1341 |
| linoleic | 6872 | 1842 | 69 | 1767 |
| arachidonic | 5574 | 165 | 0 | 886 |
| cholesterol | 7011 | 7394 | 78 | 2077 |
| histidine | 7034 | 5076 | 63 | 0 |
| isoleucine | 7018 | 5084 | 63 | 0 |
| leucine | 7021 | 5083 | 63 | 0 |
| lysine | 7049 | 5097 | 63 | 0 |
| methionine | 7032 | 5096 | 63 | 0 |
| phenylalanine | 7046 | 5079 | 63 | 0 |
| threonine | 7029 | 5080 | 63 | 0 |
| tryptophan | 7004 | 5030 | 63 | 0 |
| valine | 7046 | 5083 | 63 | 0 |
| cysteine | 6830 | 4930 | 17 | 0 |
| tyrosine | 6941 | 5049 | 52 | 0 |
| vita_rae | 6515 | 6918 | 50 | 1177 |
| retinol | 7045 | 6788 | 52 | 1836 |
| beta_carotene | 6305 | 5440 | 36 | 1412 |
| vitd | 6745 | 5185 | 52 | 1283 |
| vite | 6931 | 5580 | 55 | 1385 |
| vitk | 6498 | 5054 | 81 | 1159 |
| b1 | 7037 | 7402 | 169 | 1965 |
| b2 | 7035 | 7421 | 132 | 1912 |
| niacin | 7033 | 7402 | 175 | 1943 |
| niacin_ne | 7072 | 0 | 0 | 0 |
| b5 | 6980 | 6376 | 52 | 1971 |
| b6 | 7001 | 7262 | 190 | 2058 |
| biotin | 6597 | 0 | 102 | 0 |
| folate_dfe | 6851 | 6482 | 0 | 722 |
| folic_acid | 7044 | 6500 | 0 | 1127 |
| choline | 0 | 4611 | 27 | 0 |
| sodium | 7053 | 7709 | 306 | 2636 |
| chloride | 6266 | 0 | 0 | 1194 |
| phosphorus | 7068 | 7467 | 307 | 2151 |
| zinc | 7040 | 7406 | 307 | 2057 |
| copper | 6994 | 7284 | 307 | 1842 |
| manganese | 7008 | 6492 | 307 | 1797 |
| selenium | 0 | 6865 | 149 | 1020 |
| iodine | 6206 | 0 | 43 | 1162 |
| fluoride | 6024 | 538 | 0 | 0 |
| chromium | 6073 | 0 | 0 | 0 |
| molybdenum | 5770 | 0 | 51 | 0 |
| alcohol | 6923 | 5399 | 0 | 2991 |
| caffeine | 0 | 5215 | 0 | 0 |

## Dokumentierte Plausibilitätsfälle

Die Summanden wurden aus den festgelegten Quellspalten übernommen. Gesamtwerte und Komponenten sind in den Quellen unabhängig bestimmt oder berechnet. Diese Ausnahmen erlauben ausschließlich die folgenden Datensätze, ohne Werte zu verändern. Ein neuer oder entfallener Fall lässt den Test fehlschlagen.

| catalogKey | Lebensmittel | Regel | Quellenwert/Summe | Basiswert |
|---|---|---|---:|---:|
| BLS 4.0:G212100 | Gemüseamaranth roh | fatFractions | 1.164 | 0.33 |
| BLS 4.0:G212152 | Gemüseamaranth gedünstet | fatFractions | 1.238 | 0.35 |
| BLS 4.0:G212182 | Gemüseamaranth gebraten ohne Fett (Pfanne) | fatFractions | 1.737 | 0.49 |
| BLS 4.0:M2R9300 | Joghurt mind. 3,5 % Fett, mit Nusszubereitung, gesüßt | fatFractions | 4.7 | 3.675 |
| BLS 4.0:T121702 | Thunfisch in Öl, Konserve, abgetropft | fatFractions | 12.3 | 10.45 |
| BLS 4.0:T306100 | Heilbutt/Weißer Heilbutt, roh | fatFractions | 7.741 | 5.83 |
| BLS 4.0:T306132 | Heilbutt/Weißer Heilbutt, pochiert | fatFractions | 8.257 | 6.22 |
| BLS 4.0:T306152 | Heilbutt/Weißer Heilbutt, gedünstet | fatFractions | 7.374 | 5.55 |
| BLS 4.0:T306182 | Heilbutt/Weißer Heilbutt, gebraten ohne Fett (Pfanne) | fatFractions | 8.708 | 6.56 |
| BLS 4.0:T306200 | Heilbutt/Weißer Heilbutt, tiefgefroren | fatFractions | 7.741 | 5.83 |
| BLS 4.0:T306252 | Heilbutt/Weißer Heilbutt, tiefgefroren, gedünstet | fatFractions | 7.2 | 5.42 |
| BLS 4.0:T306282 | Heilbutt/Weißer Heilbutt, tiefgefroren, gebraten ohne Fett (Pfanne) | fatFractions | 8.708 | 6.56 |
| BLS 4.0:T800100 | Klippfisch 1/1 trocken (gesalzen, getrocknet) | fatFractions | 1.654 | 0.72 |
| BLS 4.0:W161000 | Plockwurst | fatFractions | 35.28 | 26.3 |
| BLS 4.0:Y637422 | Heilbuttfilet pochiert (ohne Sauce) | fatFractions | 8.248 | 6.21 |
| USDA Foundation 2026:749420 | Pork, cured, bacon, cooked, restaurant | sugars | 3.14 | 2.1 |
| USDA SR Legacy 2018:168246 | Pork, fresh, loin, sirloin (chops or roasts), bone-in, separable lean and fat, raw | fatFractions | 12.109 | 8.96 |
| USDA SR Legacy 2018:168314 | Pork, fresh, loin, top loin (roasts), boneless, separable lean and fat, raw | fatFractions | 11.228 | 8.33 |
| USDA SR Legacy 2018:169016 | Restaurant, family style, sirloin steak | sugars | 0.55 | 0 |
| USDA SR Legacy 2018:169191 | Pork, ground, 72% lean / 28% fat, cooked, crumbles | fatFractions | 49.285 | 32.9 |
| USDA SR Legacy 2018:170603 | Beef, chuck, under blade pot roast or steak, boneless, separable lean only, trimmed to 0" fat, select, raw | fatFractions | 9.055 | 5.41 |
| USDA SR Legacy 2018:171627 | Ham, chopped, not canned | sugars | 5 | 0 |
| USDA SR Legacy 2018:174513 | Turkey, retail parts, breast, meat only, with added solution, raw | fatFractions | 7.213 | 2.53 |
| USDA SR Legacy 2018:174935 | Cake, pudding-type, chocolate, dry mix | fatFractions | 10.173 | 8.14 |

## Grenzen und Integration

Die Prüfung belegt den lokalen Quellabgleich und das Datenformat. Die nachfolgende Laufzeitanbindung wurde zusätzlich mit VM-, Fetch- und Cache-Mocks geprüft. Layout, echte Kamera, OCR-Bilder und tatsächlicher Browser-Speicher benötigen passende Geräteprüfungen.

## Laufzeitfelder und Kompatibilität

- `ck` am Eintrag enthält den exakten Katalogschlüssel als String. Er wird bei der Erfassung ausschließlich nach bestandener Produktprüfung gesetzt. Fehlt `ck`, kann `foodRef` auf ein gespeichertes Produkt mit `catalogKey` oder dem älteren Paar `record`/`source` verweisen.
- `ck` akzeptiert auch künftige Quellen. Gültig sind 3 bis 140 Zeichen ohne Steuerzeichen und ein Doppelpunkt zwischen nichtleeren Quellen- und Record-Teilen. Unbekannte Quellen bleiben gespeichert und lösen keinen Shard-Abruf aus.
- `nx` am Produkt, Tagebucheintrag und an Kombipositionen ist ein einfaches Objekt mit höchstens 40 Schlüsseln gemäß `/^[a-z][a-z0-9_]{0,31}$/` und endlichen Zahlen zwischen 0 und 1e9. Unbekannte Schlüssel bleiben beim Kopieren, Import und Export erhalten. Anzeige und Summen verwenden ausschließlich registrierte neue Schlüssel. Die Werte gelten je 100 der jeweiligen Produktbasis, bestimmt durch `unit` als g oder ml. Beim Erfassen entsteht eine unabhängige Kopie. Mengenänderungen erhalten diese Kopie und der Resolver skaliert erst beim Lesen mit `grams/100`. Neue Etiketteingaben werden auf höchstens fünf signifikante Stellen gerundet.
- `validData()` prüft die optionalen Felder in Produkten, Einträgen und Kombis. Neue Nährstoffe stehen weder in `nutrients`, `highlighted` noch in Mikrozielen oder den bereinigten Optionsobjekten. Version 94 akzeptiert diese zusätzlichen Felder und speichert sie mit. Alte Mengenänderungen verfälschen die per100-Etikettwerte daher nicht.
- Die Version-94-Kombifunktionen rekonstruieren Positionen anhand einer festen Feldliste. Bei einer Bearbeitung durch dieses alte Gerät können `ck` und `nx` entfallen. Die aktualisierten Kopierwege erhalten beide Felder. Ein fehlender Etikett-Snapshot bleibt unbekannt und wird niemals aus inzwischen geänderten Produktwerten rekonstruiert. Ein vollständiger Schutz neuer Felder bei jeder Bearbeitung durch unveränderten Altcode ist mit den beiden optionalen Feldern technisch nicht möglich.

## Resolverregeln

Alle Auflösungen sind lesend. `ensure` lädt ausschließlich öffentliche Sidecars ohne Zugangsdaten. Gleichzeitige Anforderungen eines Shards werden zusammengefasst. Offline-, HTTP-, JSON- und Schemafehler ergeben `unavailable`, beim nächsten ausdrücklichen Laden wird erneut versucht. Ein vollständig geladener Shard ohne gesuchten Datensatz beendet `pending` ebenfalls.

Gespeicherte Makros und alte Zusatzwerte sowie eingefrorene `nx`-Werte haben Vorrang. Neue Katalogwerte ergänzen ausschließlich fehlende neue Felder bei gesichertem Bezug, g-Basis und bestandener Makrokonsistenzprüfung. Ein Produkt mit Etikettkorrekturen oder abweichenden Makros erhält keine Katalogergänzung. Die neun Altschlüssel werden niemals aus Sidecars gelesen. Rezepte und KI-Foto-Einträge erhalten keine erweiterten Werte. ml-Einträge erhalten keine Katalogergänzung. Es wird keine Dichteumrechnung eingeführt.

Die Makroerfassung verwendet `round(x) = Math.round(x*10)/10`. Je Eintragsmakro genügt eine absolute Differenz von höchstens 0.05 oder eine Dichtedifferenz `abs(Eintrag*100/grams - Sidecar)` von höchstens 0.5. Hinzu kommt numerische Rechentoleranz von 1e-9 und beim absoluten Vergleich 1e-10 relativ. Produkte werden weiterhin je 100 mit ausschließlich numerischer Rechentoleranz geprüft. Die Konsistenzprüfung verwendet ausschließlich diese vier Makros.

Nach proportionalen Mengenänderungen wächst der absolute Rundungsfehler mit `grams/a0`. Der Fehler je 100 beträgt höchstens `5/a0`, also höchstens 0.5 bei ursprünglichen Mengen ab 10 g. Unterhalb 10 g können Einträge weiterhin unbekannt bleiben. Ein gültiges eigenes `ck` macht die Prüfung unabhängig vom heutigen Produktstand. Ohne `ck` prüft der Altweg über `foodRef` zusätzlich das Produkt. Ein eigenes `nx` verhindert Katalogergänzungen. Makro-Snapshots bleiben erhalten. Bekannte Null bleibt bekannt, eine Summe ohne bekannten Wert ist `null`. Die Abdeckung zählt bekannte Snapshots und Katalogwerte getrennt.

## Öffentliche Oberfläche

`window.pulsNutrients` stellt folgende Funktionen bereit

| Funktion | Ergebnis |
|---|---|
| `definitions()` | Unveränderliche Liste der 76 Definitionen |
| `keyFor(product)` | Gültiger Katalogschlüssel aus `catalogKey` oder `source`/`record`, sonst `null` |
| `ensure(catalogKeys)` | `Promise<{ready:string[],unavailable:string[]}>` |
| `ensureForEntries(entries)` | Dasselbe Ergebnis für die Verweise der Einträge |
| `resolveEntry(entry)` | `{values:{[key]:number|null},origin:{[key]:'snapshot'|'catalog'|'unknown'},pending:boolean}` |
| `resolveProduct(product,{amount=100,unit=product.unit||'g'}={})` | Dieselbe Auflösungsform, Mengen gelten in der angegebenen Produktbasis |
| `totals(entries)` | `{nutrients:{[key]:{value:number|null,known:number,total:number,snapshot:number,catalog:number}},pending:boolean}` |
| `labelValues(product)` | Unabhängige Kopie der neuen per100-Etikettwerte |
| `setLabelValues(product,values)` | Prüft und setzt die Werte, leeres Objekt entfernt das Feld, ungültige Werte werfen `TypeError` |
| `validLabelValues(values)` / `validFields(item)` | Boolesche Schema-Prüfung |
| `capture(product,entry)` / `copyFields(source,target)` | Gemeinsame Erfassungs- und Kopierwege, geben das Zielobjekt zurück. `capture` wirft auch bei ungültigen optionalen Metadaten keinen Fehler |

Die drei Formularfelder verwenden Zucker g, gesättigte Fettsäuren g und Salz g. Gespeichert wird Natrium in mg. Es gilt `Salz_g=Natrium_mg*0.0025`, entsprechend `Natrium_mg=Salz_g*400`. OFF übernimmt ausschließlich die drei bestätigten Werte `sugars`, `satfat` und `sodium`, auch bei zubereiteten Produkten. Natrium stammt zuerst aus dem normalisierten Natriumfeld und ersatzweise aus Salz. Weitere OFF-Zuordnungen wie Stärke, Polyole, Fettsäuren und Cholesterin benötigen künftig eigene sichtbare Bestätigung. OCR erkennt DE/EN-Zeilen, grenzt ungesättigte Fettsäuren und Zuckeralkohole/Polyole aus, lässt Grenzwerte und abweichende Einheiten unbekannt und speichert erst nach bestätigtem Kontrollformular.

Der Kompatibilitätstest verwendet eingefrorene Originalregeln aus `ad92acf` (v94) und `2ad15cb` (v95): Kern-/Alt-Nährstoffvalidator, Produkt-/Eintrags-Einheiten, Optionsbereinigung sowie in v95 die `ck`/`nx`-Validierung. Ein v96-Profil mit `cnf`/`cofid`/`fndds`, `catalogueSourcesVersion:1`, vier gespeicherten Quellenprodukten (darunter eines aus dem inzwischen entfernten CoFID, ml) und Einträgen mit neuen `ck` wird akzeptiert. Beide alten Optionsbereinigungen entfernen die gesamte Quellenliste mit unbekannten Kürzeln und die Versionsmarkierung. Bei Rücksync bleiben Produkte, Einträge, `ck`, Einheiten, Makros, Alt-Nährstoff-Snapshots und IDs erhalten; v96 setzt aber die Quellenfilter auf alle Standardquellen zurück. Bewusste Filterabwahl geht damit dauerhaft verloren. Weitere damalige Validator-Wrapper und echter Cloud-Sync sind nicht durch diesen Teiltest abgedeckt.

Der Service Worker lädt und hält ausschließlich v2 im Cache `puls-catalog-v4` (seit 14.11.2026; vorher v3); Vorladen umfasst 110 Dateien (43 foods, Manifest, Portionen, 64 Shards, Sidecar-Meta). Der Wechsel auf v4 verwirft beim Aktivieren alle alten Chunks, Portionen und Sidecars zugleich, damit kein Gerät alte Sidecars mit neuen Chunks mischt. Der Sidecar-Name bleibt `nutrients-v2`: Die übrigen Zeilen sind byte-gleich, eine neue Generation (`nutrients-v3`) wäre 65 Umbenennungen ohne Gewinn. Der Resolver erkennt `CoFID 2021:`/`USDA FNDDS 2021-2023:` weiterhin als bekannte Schlüsselmuster, damit ein veralteter, noch zwischengespeicherter Shard mit diesen Zeilen beim Aktivieren des neuen Service Workers nicht als Ganzes abgelehnt wird. Für bereits gespeicherte Einträge dieser Quellen fehlen die erweiterten Nährwerte (Zeilen entfernt); Snapshot-Makros und die neun Altmikros bleiben. Beim Aktivieren entfernt er gezielt v1-Einträge aus diesem Cache. Basiskatalog und bereits geladene v2-Einträge bleiben erhalten. Eine offene v95-Seite kann v1 weiter über das Netzwerk lesen; v96 speichert und lädt v1 nicht vor. Die v1-Dateien bleiben unverändert im Repository und werden erst in einer späteren Version entfernt. Ein Shard mit falscher Form bleibt nicht verfügbar. App-/Asset-Versionen erhöht ausschließlich der Koordinator.

## v2: zusätzliche Quellen

Die Konstanten in `scripts/lib/nutrient-new-mapping.cjs` stammen aus den Rohdefinitionen. Der Import prüft für CNF Code, Einheit, englischen Namen und INFOODS-Tag; Jede unerwartete Abweichung bricht vor dem Schreiben ab. Es werden keine Summen oder Äquivalente abgeleitet. CNF-Cystin wird wie bei USDA unter `cysteine` ohne Stoffumrechnung geführt. Vitamin K ist in CNF Phyllochinon/K1.

### Ausgelassen, Definition weicht ab oder Feld fehlt

- CNF: `618`/`619`/`620` sind undifferenzierte Fettsäuren; nur `675`/`851`/`855` passen zu Linolsäure/ALA/Arachidonsäure. `324` (Vitamin D IU), D-Fraktionen, zusätzliches Alpha-Tocopherol `573`, K-Fraktionen und andere Carotinoide ersetzen keine Zielfelder. `409` wird als mg Niacin-Äquivalent (`niacin_ne`) übernommen. Die Rohdatei nennt die Einheit „Niacin Equivalents“ (NE); ausschließlich Code 409 mit exaktem Namen und INFOODS-Tag `NIAEQ` akzeptiert diese Einheit. Der unabhängige Rohdatenabgleich bestätigt bei allen 3.574 vergleichbaren Datensätzen 409 = 406 + Tryptophan (mg)/60. Die bereits vorhandenen 409-Werte werden direkt übernommen; der Import berechnet keine Ersatzwerte. DFE nur `435`, Folsäure nur `431`. Mannitol und Sorbitol ergeben ohne Gesamtfeld keine Polyol-Summe. Kein Stärke-, lösliche/unlösliche Faser- oder Omega-Summenfeld. Nicht vorhandene Mineralstoffe bleiben unbekannt.
- Alle neun Altschlüssel bleiben ausschließlich im Katalog/Snapshot. Wasserwerte werden bei der Selbstprüfung nur mit dem bestehenden Zahlenwert verglichen; keine g/ml-Umrechnung.

### Selbstprüfung

CNF prüft 65 Definitionen. CNF enthält keine negativen Zellen in den gelesenen Bereichen. Alle 18.199 alten Zeilen werden beim Import und im Test vollständig als Strings gegen v1 verglichen. Beim Entfernen von CoFID/FNDDS (14.11.2026) wurden alle übrigen 20.826 Datensätze, 10.373 Portionsgruppen und 20.772 Sidecar-Zeilen je ID/Schlüssel vorher/nachher als identisch belegt.

Lokale Prüfung: Import mit fixierten Rohdaten, Daten-/Runtime-/Kompatibilitäts-/Cachetests mit lokalen Fixtures/Mocks. Kein Browser-/iPhone-/Live-RLS-Test. Unabhängiges Review, CURRENT-STATE und Release-Versionierung übernimmt der Koordinator.

### Neue Rohdateien (SHA-256, exakte Originalbytes)

**CNF 2026**

- `cnf-2026/cnf_fcen_all-files-data_2026.zip` – `f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd`
- `cnf-2026/cnf_fcen_all-files-data_2026_extracted/Food_Name.csv` – `ee75a3208e8b79ee523ec5adffcf149f3f21806ac5d9942a9449077efe414c6c`
- `cnf-2026/cnf_fcen_all-files-data_2026_extracted/Nutrient_Amount.csv` – `c53803c72faadbdec9750ccaa1fc9a9cfd8732e0c784d2a66c62cd27d09b22d2`
- `cnf-2026/cnf_fcen_all-files-data_2026_extracted/Nutrient_Name.csv` – `708a942fc8a6a4913b106cd964f4f3b116845ec72942a936477241be8889f785`
- `cnf-2026/cnf_fcen_all-files-data_2026_extracted/Measure_Type.csv` – `ce6ecd0f370820d6800d7b7b88ae5710691b5d7b358c0503273d36a1a878f977`
- `cnf-2026/cnf_fcen_all-files-data_2026_extracted/Measure_Name.csv` – `429cf2e8d4bbd2b732a6e9acf35427ce6d3b4e9447aabaf86b427c48833b112f`
- `cnf-2026/cnf_fcen_all-files-data_2026_extracted/Measure_Weight_Conversion.csv` – `9d41fac4ba1471fddd25ea7e51a8352aec66de4f3c88802b0a2e02a85ebc3e6f`

### Vergleichsumfang

| Quelle | Katalog-IDs | v2-Zeilen | alle Vergleiche inkl. unbekannt | vorhandene Werte | bekannte Abweichungen | unerwartet |
|---|---:|---:|---:|---:|---:|---:|
| CNF 2026 | 2573 | 2573 | 33449 | 32315 | 0 | 0 |

### Zuordnung der CNF-Quelle

Alle Zuordnungen sind direkte Übernahmen mit identischer Einheit. „—“ bleibt unbekannt. Die neun Alt-Zuordnungen dienen ausschließlich der Selbstprüfung und stehen in der Mapping-Datei.

| Schlüssel | Einheit | CNF Code (Einheit) |
|---|---|---|
| kcal | kcal | `208` kcal |
| p | g | `203` g |
| c | g | `205` g |
| f | g | `204` g |
| sugars | g | `269` g |
| starch | g | — |
| polyols | g | — |
| glucose | g | `211` g |
| fructose | g | `212` g |
| galactose | g | `287` g |
| sucrose | g | `210` g |
| lactose | g | `213` g |
| maltose | g | `214` g |
| fiber_sol | g | — |
| fiber_insol | g | — |
| satfat | g | `606` g |
| mufat | g | `645` g |
| pufat | g | `646` g |
| transfat | g | `605` g |
| omega3 | g | — |
| omega6 | g | — |
| ala | g | `851` g |
| epa | g | `629` g |
| dha | g | `621` g |
| linoleic | g | `675` g |
| arachidonic | g | `855` g |
| cholesterol | mg | `601` mg |
| histidine | g | `512` g |
| isoleucine | g | `503` g |
| leucine | g | `504` g |
| lysine | g | `505` g |
| methionine | g | `506` g |
| phenylalanine | g | `508` g |
| threonine | g | `502` g |
| tryptophan | g | `501` g |
| valine | g | `510` g |
| cysteine | g | `507` g |
| tyrosine | g | `509` g |
| vita_rae | µg | `320` µg |
| retinol | µg | `319` µg |
| beta_carotene | µg | `321` µg |
| vitd | µg | `328` µg |
| vite | mg | `323` mg |
| vitk | µg | `430` µg |
| b1 | mg | `404` mg |
| b2 | mg | `405` mg |
| niacin | mg | `406` mg |
| niacin_ne | mg | `409` NE (mg, siehe Definition) |
| b5 | mg | `410` mg |
| b6 | mg | `415` mg |
| biotin | µg | `416` µg |
| folate_dfe | µg | `435` µg |
| folic_acid | µg | `431` µg |
| choline | mg | `421` mg |
| sodium | mg | `307` mg |
| chloride | mg | — |
| phosphorus | mg | `305` mg |
| zinc | mg | `309` mg |
| copper | mg | `312` mg |
| manganese | mg | `315` mg |
| selenium | µg | `317` µg |
| iodine | µg | — |
| fluoride | µg | — |
| chromium | µg | — |
| molybdenum | µg | — |
| alcohol | g | `221` g |
| caffeine | mg | `262` mg |

### Abdeckung CNF (bekannte Zahlen einschließlich Null)

| Schlüssel | CNF |
|---|---:|
| kcal | 2573 |
| p | 2573 |
| c | 2573 |
| f | 2573 |
| sugars | 2337 |
| starch | 0 |
| polyols | 0 |
| glucose | 1706 |
| fructose | 1703 |
| galactose | 1691 |
| sucrose | 1707 |
| lactose | 1701 |
| maltose | 1683 |
| fiber_sol | 0 |
| fiber_insol | 0 |
| satfat | 2440 |
| mufat | 2401 |
| pufat | 2397 |
| transfat | 2200 |
| omega3 | 0 |
| omega6 | 0 |
| ala | 2161 |
| epa | 2092 |
| dha | 2490 |
| linoleic | 1548 |
| arachidonic | 1758 |
| cholesterol | 2382 |
| histidine | 1585 |
| isoleucine | 1583 |
| leucine | 1579 |
| lysine | 1582 |
| methionine | 1583 |
| phenylalanine | 1582 |
| threonine | 1582 |
| tryptophan | 1562 |
| valine | 1583 |
| cysteine | 1574 |
| tyrosine | 1580 |
| vita_rae | 2344 |
| retinol | 2094 |
| beta_carotene | 1871 |
| vitd | 2288 |
| vite | 1757 |
| vitk | 1368 |
| b1 | 2358 |
| b2 | 2377 |
| niacin | 2388 |
| niacin_ne | 2389 |
| b5 | 1765 |
| b6 | 2283 |
| biotin | 112 |
| folate_dfe | 2240 |
| folic_acid | 2489 |
| choline | 1160 |
| sodium | 2532 |
| chloride | 0 |
| phosphorus | 2468 |
| zinc | 2423 |
| copper | 2389 |
| manganese | 2233 |
| selenium | 2138 |
| iodine | 0 |
| fluoride | 0 |
| chromium | 0 |
| molybdenum | 0 |
| alcohol | 2362 |
| caffeine | 2336 |

### Neue R8-Plausibilitätsfälle

21 neue Fälle bei CNF (18 Fettsäuren, 3 Zucker). Werte bleiben unverändert. Die Tests hinterlegen die vollständige Liste unabhängig von der Meta. Die früheren vier Fälle aus CoFID und FNDDS entfielen mit den Quellen.

| catalogKey | Lebensmittel | Regel | Quellenwert/Summe | Basiswert |
|---|---|---|---:|---:|
| CNF 2026:CNF_1172 | Deli-meat, turkey breast, cooked, sliced | fatFractions | 3.075 | 2.03 |
| CNF 2026:CNF_151 | Cream, table (cooking, country style), 15% M.F. | sugars | 3.67 | 2.67 |
| CNF 2026:CNF_2789 | Beef, cured, corned beef, brisket, raw | fatFractions | 12.44 | 10 |
| CNF 2026:CNF_2976 | Juice, cocktail, cranberry, vitamin C added, frozen concentrate, water added | sugars | 21.25 | 11.81 |
| CNF 2026:CNF_2996 | Fish, cisco (lake herring, tullibee), Indigenous, raw | fatFractions | 5.41 | 4 |
| CNF 2026:CNF_3169 | Fish, whitefish, lake, Indigenous, baked | fatFractions | 6.476 | 4.3 |
| CNF 2026:CNF_3220 | Fish, salmon, coho, wild, poached | fatFractions | 6.818 | 3.5 |
| CNF 2026:CNF_3422 | Lamb, Canadian, composite cuts, lean, raw | fatFractions | 4.157 | 3.243 |
| CNF 2026:CNF_3578 | Game meat, Indigenous, caribou (reindeer), meat, cooked | fatFractions | 5.6 | 3 |
| CNF 2026:CNF_3596 | Game meat, Indigenous, rabbit, wild, cooked | fatFractions | 4.4 | 2.1 |
| CNF 2026:CNF_3645 | Game meat, seal, harp, raw | fatFractions | 2.05909 | 1.3 |
| CNF 2026:CNF_4078 | Pie, turkey, commercial | fatFractions | 10.73073 | 9.3 |
| CNF 2026:CNF_4781 | Lamb, Canadian, composite cuts, lean and fat, 3mm (1/8) trim, raw | fatFractions | 12.649 | 7.861 |
| CNF 2026:CNF_5767 | Game meat, Indigenous, beluga, muktuk, boiled | fatFractions | 14.2 | 10 |
| CNF 2026:CNF_5784 | Game meat, Indigenous, ringed seal, meat, aged | fatFractions | 9.2 | 6.4 |
| CNF 2026:CNF_693 | Turkey, all classes, skin and separable fat only, roasted | fatFractions | 37.27 | 30.049 |
| CNF 2026:CNF_7190 | Ham, flaked, canned | fatFractions | 15.102 | 7.4 |
| CNF 2026:CNF_7740 | Cheese, cheddar and mozzarella blend, shredded, light | sugars | 0.52 | 0 |
| CNF 2026:CNF_775 | Turkey, hen, wing, meat and skin, roasted | fatFractions | 12.183 | 10.545 |
| CNF 2026:CNF_7928 | Tortilla, ready-to-bake / fry, whole wheat,  multigrains, with added fibre  | fatFractions | 3.99365 | 3.09 |
| CNF 2026:CNF_846 | Chicken, broiler, drumstick, meat and skin, stewed | fatFractions | 12.2363 | 10.34 |
