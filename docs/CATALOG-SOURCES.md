# Lebensmittel-Rohdaten: Quellen

Die Rohdaten liegen lokal in `catalog-raw/`. Der Ordner wird **nicht versioniert** (`.gitignore`). Mit dieser Liste lassen sich die Dateien jederzeit neu laden und über SHA-256 prüfen. Inventare und Formatnotizen je Quelle: `catalog-raw/_inventory/` (ebenfalls nicht versioniert; bei Neuladen neu erzeugen).

Abrufdatum aller Dateien: **12.11.2026**.

## Teil A – Quellen im Katalog (BLS, USDA SR Legacy, USDA Foundation, Ciqual, CNF)

### BLS 4.0 – Bundeslebensmittelschlüssel
- Herausgeber: Max Rubner-Institut (MRI), Karlsruhe
- Ausgabe: Version 4.0 (2025)
- Lizenz: CC BY 4.0 – https://creativecommons.org/licenses/by/4.0/deed.de (so auf der Download-Seite genannt)
- Verlangte Quellenangabe (wörtlich von https://www.blsdb.de/download): „Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0“
- Download: Seite https://www.blsdb.de/download aufrufen; die Seite setzt einen Sitzungs-Token. Link dort: `https://www.blsdb.de/assets/uploads/BLS_4_0_2025_DE.zip?token=<Token der Sitzung>` (Cookies der Seite mitschicken).
- Ordner: `catalog-raw/bls-4.0/`
- Dateien:
  - `BLS_4_0_2025_DE.zip` – 14 263 306 Byte – SHA-256 `12b7a6ba62807ec9b301eb276f897dc85f99b2292311618dec3749a12d984c91`
  - darin `BLS_4_0_Daten_2025_DE.xlsx` – 14 093 078 Byte – `524bbefe25b691f5cb3de7a9f3e27fa2967aebfeabf217d99414ba7806e78c60`
  - darin `BLS_4_0_Components_DE_EN.xlsx` – 21 741 Byte – `359aefcd2086f45e62ff3dbd0c8536306e594a5806ac325d8bf86f484561bdf4`
  - darin `BLS_4_0_Dokumentation_DE.pdf` – 469 803 Byte – `6d83913f9b705399f86795a9c3afcb2d0454d1129bfb24ce53da911c5a6a24b6`

### USDA SR Legacy (April 2018)
- Herausgeber: U.S. Department of Agriculture, Agricultural Research Service (FoodData Central)
- Ausgabe: SR Legacy, 04/2018
- Lizenz (gilt für alle FoodData-Central-Daten, gelesen auf https://fdc.nal.usda.gov/api-guide/ am 12.11.2026): gemeinfrei, CC0 1.0 – „USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under CC0 1.0 Universal (CC0 1.0)“. Bitte der Seite: FoodData Central als Quelle nennen.
- Vorgeschlagene Quellenangabe (wörtlich, ebd.): „U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov.“ (Hinweis der Seite: Ausgabenummern und Jahre ändern sich mit neuen Versionen.)
- Download: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
- Ordner: `catalog-raw/usda-sr-legacy-2018/`
- Datei: `FoodData_Central_sr_legacy_food_csv_2018-04.zip` – 6 074 592 Byte – `b80817294b8850530aaedf2e515c02593b1824f763a0ff356e5c2081643e6fd0`

### USDA Foundation Foods
- Herausgeber: USDA ARS (FoodData Central)
- Lizenz und Quellenangabe: wie SR Legacy (CC0 1.0, FoodData Central)
- Achtung: Die CSV-Ausgabe 10/2026 auf dem Server enthält keine Nährwerte (`food.csv`/`food_nutrient.csv` fehlen). Maßgeblich ist die JSON-Ausgabe 10/2026; unser Katalog passt zu ihr.
- Dateien:
  - Ordner `catalog-raw/usda-foundation/`: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-10-29.zip – `FoodData_Central_foundation_food_csv_2026-10-29.zip` – 1 127 612 Byte – `e396b1ffc3ea05d1bdccbcddbfd2a4fcb42f64d37fabdacdd9c35158c4ced817` (unvollständig, s. o.)
  - Ordner `catalog-raw/usda-foundation-2026-10-json/`: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-10-29.zip – `FoodData_Central_foundation_food_json_2026-10-29.zip` – 696 866 Byte – `dd414cc9f1a132626bad354ef6655972c78b44aff14f16114dc899708663c579`
  - Ordner `catalog-raw/usda-foundation-2026-04/`: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip – `FoodData_Central_foundation_food_csv_2026-04-30.zip` – 3 825 741 Byte – `70457ee9d9342f43bda2010318c85f04210c689fdeb9cd2da4c513b0e8dbc655` (Vergleich)

### Ciqual 2025
- Herausgeber: ANSES (Frankreich), veröffentlicht im Archiv Recherche Data Gouv
- Ausgabe: Ciqual 2025, Datensatz https://doi.org/10.57745/RDMHWY, Version 1.0 (3484 Lebensmittel, 74 Bestandteile)
- Lizenz: Etalab 2.0 (Licence Ouverte 2.0) – https://www.etalab.gouv.fr/licence-ouverte-open-licence/ – vom Koordinator am 12.11.2026 auf der Datensatzseite gelesen
- Verlangte Quellenangabe (Zitierweise der Datensatzseite, vom Koordinator gelesen): „Du Chaffaut, Laure; Oseredczuk, Marine; Gauvreau-Béziat, Julie, 2025, "Table de composition nutritionnelle des aliments Ciqual 2025", https://doi.org/10.57745/RDMHWY, Recherche Data Gouv, V1“
- Download (Datei-DOI doi:10.57745/RPWYZD): https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/RPWYZD (vom Koordinator geladen). Die ANSES-Seite https://ciqual.anses.fr/ war am 12.11.2026 wegen Wartung nicht erreichbar (HTTP 503).
- Ordner: `catalog-raw/ciqual-2025/`
- Datei: `Table_Ciqual_2025_FR_2025_11_03.xlsx` – 1 541 998 Byte – SHA-256 `5555c572fa3735991298d832d0427788fa69a11b4fd20a5d580d58942369fbb0` (MD5 `0d9758ce23f3f13dd63a005bc1bb4f2c`, stimmt mit der Datensatzseite überein)

### CNF 2026 – Canadian Nutrient File
- Herausgeber: Health Canada
- Ausgabe: 2026, abgerufen am 12.11.2026
- Lizenz: Open Government Licence – Canada, Version 2.0 – https://open.canada.ca/en/open-government-licence-canada
- Vorgeschriebener Hinweis: „Contains information licensed under the Open Government Licence – Canada.“
- Datensatzseite: https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109
- Download: https://open.canada.ca/data/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109/resource/019f2a90-e3a9-489d-b6e1-f74f4ba1d006/download/cnf_fcen_all-files-data_2026.zip
- Ordner: `catalog-raw/cnf-2026/`, entpackt in `cnf_fcen_all-files-data_2026_extracted/`
- Datei: `cnf_fcen_all-files-data_2026.zip` – 26.656.195 Byte – SHA-256 `f5faad8977ee6bbdd9d69c8649077cacd87d8658ad200509a4047db1e29edcdd`
- Einzeldatei-Hashes und verwendete Definitionen: [NUTRIENT-MAPPING.md](NUTRIENT-MAPPING.md).

## Teil A2 – Aus dem Katalog entfernt (14.11.2026)

CoFID 2021 und USDA FNDDS 2021–2023 waren vom 12.11. bis 14.11.2026 im Katalog und wurden auf Selvirs Wunsch entfernt; sie kommen nur auf Wunsch zurück. Die Rohdaten bleiben lokal liegen, sind aber keine Eingabe der Import-Skripte mehr. Die Angaben stehen hier für eine mögliche Rückkehr und für Lizenzhinweise bei bereits gespeicherten Lebensmitteln.

### USDA FNDDS 2021–2023 (Survey Foods, 10/2024)
- Herausgeber: USDA ARS (FoodData Central)
- Lizenz und Quellenangabe: wie SR Legacy (CC0 1.0, FoodData Central)
- Download: https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip
- Ordner: `catalog-raw/usda-fndds/`
- Datei: `FoodData_Central_survey_food_json_2024-10-31.zip` – 3 835 292 Byte – `dfb06ae7ddc397ccd570b91c14b75438ab2ba39f64f22d321f61d4a52a77f3eb`
- Verwendete Rohdatei: `FoodData_Central_survey_food_json_2024-10-31_extracted/surveyDownload.json`, SHA-256 `2e7eb9fda92adf1d4d784dba5eaa3a7fd4418cd86ccff383c7c9294d79e9b808`.

### UK CoFID 2021 (McCance and Widdowson's Composition of Foods Integrated Dataset)
- Herausgeber: Public Health England; veröffentlicht am 25.03.2015, zuletzt aktualisiert am 19.03.2021 (vom Koordinator am 12.11.2026 auf https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid gelesen)
- Lizenz: Open Government Licence v3.0 – https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ (Seite: „All content is available under the Open Government Licence v3.0, except where otherwise stated.“)
- Quellenhinweis: „Contains public sector information licensed under the Open Government Licence v3.0.“
- Download: https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx
- Ordner: `catalog-raw/cofid-2021/`
- Datei: `McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx` – 4 629 542 Byte – `436e9445ef2adb2a75f3d7edd51302de3adad25385f9795fc94ba58bd030e97d`

## Teil B – mögliche Erweiterungen

### Fineli (Finnland)
- Status: **nicht geladen**. https://fineli.fi/fineli/en/avoin-data lieferte HTTP 403 mit einer Browser-Prüfung („Enable JavaScript and cookies to continue“). Lizenz deshalb nicht selbst gelesen.
