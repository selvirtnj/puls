<div align="center">

# PULS
### Dein Essen. Dein Training. Dein Fortschritt.

Ein persönlicher, werbefreier Fitness- und Ernährungstracker – für iPhone und Browser.

[**App öffnen →**](https://selvirtnj.github.io/puls/?v=34) · [Neues in Version 34](docs/RELEASE-34.md) · [Dokumentation](docs/README.md)

</div>

---

## Was PULS kann

| Ernährung | Training | Körper & Komfort |
|---|---|---|
| Kalorien, Makros und bekannte Mikronährstoffe | Eigene Routinen und Übungen | Gewicht, Wochenmittel und geglätteter Trend |
| Lebensmittelsuche und Barcode-Kamera | Sätze, Gewicht, Reps und letzte Werte | Körpermaße und Biometrie |
| Nährwertfoto mit kontrollierter OCR | Supersets, Pausen- und Workout-Timer | Persönliche XP, Level und Trainingsserie |
| Rezepte, Portionen, Favoriten und zuletzt gegessen | PRs, geschätztes 1RM und Muskelverteilung | Zehn Designs, Deutsch/Englisch, Klänge |
| Gramm, kg, oz, ml und l | Kalender, Auswertungen und Diagramme | JSON-Sicherung, CSV und optionaler Konto-Sync |

**Version 34** räumt die Oberfläche auf, integriert den Gewichtstrend in Körper & Entwicklung, ergänzt ausführliche Verlaufskurven und die Designs **Terra, Volt, Blueprint und Nocturne**. Nicht mehr gewünscht: Meal Planning, Fasten, Check-ins/Coaching, Progress-Fotos und Scheiben-/Aufwärmrechner.

## Auf dem iPhone verwenden

1. [PULS in Safari öffnen](https://selvirtnj.github.io/puls/).
2. Teilen → **Zum Home-Bildschirm**.
3. Profil und Ziel einrichten. Optional unter **Konto & Synchronisierung** anmelden, um PC und iPhone zu verbinden.

PULS ist eine installierbare Web-App. Kamera und Onlinesuche benötigen passende Browserunterstützung bzw. Internet. Gespeicherte Produkte und bereits geladene Katalogteile sind nach dem ersten Online-Laden offline verfügbar. Hintergrundtöne und Timer-Mitteilungen bei gesperrtem iPhone sind browserabhängig; echte Dynamic Island und Apple Health sind nicht eingebaut.

## Lebensmitteldaten

18.200 gebündelte Einträge aus **BLS 4.0, USDA SR Legacy, USDA Foundation und Ciqual 2025**; zusätzliche Produktsuche und Barcodes über **Open Food Facts**. Herkunft und Datenabdeckung stehen in der App. Community-Einträge sind nicht pauschal verifiziert. Unbekannte Nährwerte werden nicht erfunden; OCR-Ergebnisse werden vor dem Speichern geprüft.

Übungsnamen stammen aus [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), ergänzt um eigene Übungen. [Lizenz](EXERCISE-LICENSE.txt). Weitere Quellen und Nutzungsbedingungen: [Lebensmitteldokumentation](docs/FOOD-32.md) und catalog/manifest.json.

## Lokal entwickeln

Node.js 24 oder neuer; keine npm-Abhängigkeiten erforderlich.

```sh
git clone https://github.com/selvirtnj/puls.git
cd puls
npm test
npm start
```

Dann http://127.0.0.1:4173 öffnen. Die statischen Dateien werden direkt ausgeliefert. [Architektur und Prüfablauf](docs/ARCHITECTURE.md).

## Eigene Daten und Synchronisierung

Ohne Anmeldung speichert PULS das Profil auf dem jeweiligen Gerät. Für geräteübergreifende Speicherung nutzt die App Supabase Auth mit Zugriff auf die eigene Nutzer-ID und Konflikterkennung bei gleichzeitigen Änderungen. [Backend-Einrichtung](backend/ACCOUNT-SETUP-DE.md). Das öffentliche Repository enthält keinen Zugriff auf private Profile.

Sicherung und CSV stehen unter **Konto → Deine Daten**. Reset und Kontolöschung verlangen eine ausdrückliche Bestätigung; für das endgültige Cloud-Löschen ist eine erneute Anmeldung nötig.

## Berechnungen und Grenzen

Kalorienbedarf, Zieltermin, Körperfett und 1RM sind Schätzungen. Verlaufsgrafiken verwenden erfasste Messpunkte und kennzeichnen fehlende Werte. Adaptive Kalorienkalibrierung benötigt ausreichend vollständige Ernährungs- und Gewichtsdaten. Methodik und Grenzen stehen in der App und [Dokumentation](docs/README.md).

## Projektstand

Aktiv entwickelt wird die Web-App. Frühere native Experimente liegen unter archive/native; sie gehören nicht zur aktuellen Veröffentlichung.
