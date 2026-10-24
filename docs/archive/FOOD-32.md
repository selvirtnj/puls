# Lebensmittel in PULS 32

## Vorhanden und erhalten
18.200 Katalogeinträge (BLS 4.0, USDA SR Legacy/Foundation, Ciqual 2025), Open Food Facts (OFF), ZXing-Kamera, eigene Produkte/Rezepte, Makro- und Mikronährstoff-Snapshots und bekannte Packungsgrößen. Die Importdateien und vorhandenen Katalogwerte werden nicht überschrieben.

## Foto und Prüfungen
„Essen hinzufügen → Foto“ lädt Tesseract.js 6.0.1 (Apache 2.0) bei Bedarf. Das Bild bleibt im Browser; CDN und Sprachmodell-Downloads benötigen anfangs Internet. OCR kann Zahlen verwechseln. Erkannten Text, Wertespalte und Bezug (100 g/ml oder ausdrücklich gewogene Portion) prüfen. Nicht erkannte Felder bleiben leer; ohne Pflichtwerte und Prüfbestätigung wird kein Produkt gespeichert. Mengen unter Nachweisgrenze wie „< 0,5 g“ werden nicht als exakte Werte übernommen. Ballaststoffe sind optional. Fotos werden nicht dauerhaft gespeichert oder in die Cloud hochgeladen.

Plausibilitätswarnungen vergleichen zunächst 4 kcal/g Protein, 4 kcal/g Kohlenhydrate und 9 kcal/g Fett; bei Abweichung über max. 25 kcal bzw. 20 % wird gewarnt. Diese Schwellen sind eine Produktheuristik, keine gesetzliche Etikett-Toleranz. Ballaststoffe, Polyole, organische Säuren, Alkohol und spezifische Atwater-Faktoren können Unterschiede erklären. Etikettwerte werden niemals automatisch „korrigiert“. Bei eigenen/Barcode-Produkten mit Warnung ist eine zusätzliche Bestätigung nötig.

Quellen: https://github.com/naptha/tesseract.js ; https://eur-lex.europa.eu/eli/reg/2011/1169/oj (Anhang XIV).

## Suche und Portionen
Lokale und gespeicherte Treffer werden zusammen angezeigt, BLS priorisiert; vollständige Nährwerte werden höher gewertet. Tippfehlersuche bleibt im Worker. Zusammenfassung nur für gleichen normalisierten Namen, gleiche Einheit und übereinstimmende gerundete Makros bzw. identischen Barcode. Roh, gekocht, Varianten und andere Nährwerte bleiben getrennt. Provenienz wird angezeigt, Herkunft nicht mit individueller Produktverifikation gleichgesetzt.

OFF-Suche bleibt eine bewusste Online-Abfrage mit eigener Paginierung/Begrenzung, mit deutschem Namen/Deutschland-Bezug und Makro-Vollständigkeit priorisiert. REWE-Produkte sind verfügbar, soweit OFF sie enthält; keine direkte REWE-Anbindung und kein Scraping.

7.811 USDA-Datensätze mit Portionsangaben werden als gesonderte Referenzdatei übernommen. gramWeight / amount ergibt g pro benannter Quellportion. OFF liefert serving_size, wenn mit g/ml angegeben. Unbestimmte „1 Stück“-Angaben erhalten kein erfundenes Gewicht. Eigene Portionen können ergänzt werden; keine Dichte-/g-ml-Umrechnung.

## Offline und Schnellzugriff
Favoriten und ausgewählte Produkte liegen im bestehenden state.custom, kommen daher auch in Sicherungen und Konto-Synchronisierung vor. Zuletzt gegessen nutzt vorhandene Tagebucheinträge und neue Produktreferenzen/Zeitstempel. Geprüfte Text-/Spracheinträge nutzen dieselben Produkte. „Zwei Eier und ein Brot“ erkennt Anzahlen, verlangt aber eine Quellenportion oder ein gewogenes Gesamtgewicht vor dem Eintragen.

Ein Service Worker speichert nur eigene öffentliche App-Dateien und bereits geladene Katalogdateien. Nach einmaligem Online-Laden und abgeschlossener Installation funktionieren App-Start, gespeicherte Produkte, Favoriten und Tagebuch lokal. OFF, erstmalige OCR-Dateien und Cloud-Abgleich brauchen Internet; Sitzung/Anmeldung und API-Antworten werden nicht im Service-Worker-Cache gespeichert. Offline-Daten bleiben im Browserprofil und können vom Betriebssystem entfernt werden: weiterhin Sicherungen nutzen.

## Prüfung
check-food32.cjs erweitert den vorhandenen Funktions-Test um OCR-Spalten/Null/fehlende Werte, Plausibilität, Duplikate, Einheiten, Portionsreferenzen, Anzahltexte und Importvalidierung. check-food-offline.cjs prüft Cache-Routing und dass alle Shell-Dateien existieren, samt Ausschluss externer APIs. Vorhandene Barcode-, Rezept-, Such-, Cloud- und Vorschau-Tests bleiben bestehen. Zusätzlich echtes Tesseract im Browser mit einem erzeugten Testetikett sowie Portion/Favorit/Live-Makro-Formular geprüft. Kein Testfoto oder QA-Profil wird veröffentlicht.
