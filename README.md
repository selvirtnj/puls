<div align="center">

<img src="icons/dark-180.png" width="88" alt="PULS">

# PULS

**Dein Essen. Dein Training. Dein Fortschritt.**

Ein persönlicher, werbefreier Fitness- und Ernährungstracker für iPhone und Browser.

[**App öffnen →**](https://selvirtnj.github.io/puls/) &nbsp;·&nbsp; [iOS-App](docs/IOS-APP.md) &nbsp;·&nbsp; [Dokumentation](docs/README.md)

</div>

---

## Was PULS kann

| Ernährung | Training | Körper & Konto |
|---|---|---|
| Kalorien, Makros und bekannte Mikronährstoffe | Eigene Routinen, Übungsbibliothek mit Maschinen und Kabelzug | Gewicht, Wochenmittel und geglätteter Trend |
| Lebensmittelsuche, Barcode-Scan, Nährwertfoto (OCR) | Sätze mit Vorwerten, Supersets, Pausentimer | Profil & Ziele mit berechnetem oder eigenem Kalorienziel |
| Rezepte, Portionen, Favoriten, zuletzt gegessen | Pausen-Mitteilung und Dynamic Island (iOS-App) | XP, Level und Trainingsserie |
| Gramm, kg, oz, ml und l | Kalender, Rekorde, geschätztes 1RM, Muskelverteilung | Elf Designs, Deutsch/Englisch, Klänge |
| Wasser mit eigenem Ziel | Laufendes Workout minimieren und fortsetzen | JSON-Sicherung, CSV und optionaler Konto-Sync |

## Auf dem iPhone

**Als Web-App:** [PULS in Safari öffnen](https://selvirtnj.github.io/puls/) → Teilen → **Zum Home-Bildschirm**. Updates kommen automatisch; zum Laden einer neuen Version die App einmal ganz schließen und neu öffnen.

**Als iOS-App (AltStore):** native Hülle um dieselbe Web-App, zusätzlich mit Mitteilung bei Pausenende und Countdown in der Dynamic Island. Installation: [docs/IOS-APP.md](docs/IOS-APP.md).

Ohne Anmeldung bleiben die Daten auf dem Gerät. Unter **Konto → Konto & Synchronisierung** verbindet ein PULS-Konto iPhone, iPad und PC.

## Projektstruktur

```
index.html · sw.js · manifest.webmanifest   Einstieg, Offline-Cache, PWA
js/          App-Skripte (feste Ladereihenfolge in index.html)
css/         Stylesheets
catalog/     Gebündelte Lebensmittel- und Portionsdaten
icons/       App-Icons in sechs Farben
backend/     Supabase-SQL und Einrichtung
ios/         Native iOS-Hülle (Swift), Build über GitHub Actions
tests/       Regressionstests      scripts/   Server, Tests, KI-Brücken
docs/        Produktwissen, aktueller Stand, Team-Ablauf
```

Details: [Projektstruktur und Prüfablauf](docs/ARCHITECTURE.md).

## Lokal entwickeln

Node.js 24 oder neuer, keine npm-Abhängigkeiten.

```sh
git clone https://github.com/selvirtnj/puls.git
cd puls
npm test
npm start
```

Dann `http://127.0.0.1:4173/?erststart=1` öffnen – die Erststart-Vorschau arbeitet mit Testdaten und lässt gespeicherte Daten unberührt. Ein Push auf `main` veröffentlicht sofort über GitHub Pages.

## Wie PULS weiterentwickelt wird

Ein KI-Team arbeitet nach festen Regeln zusammen: **Claude Code** ist Hauptchat und Koordinator, **Codex** übernimmt Daten- und Logikarbeit, **Gemini** prüft als dritte Stimme. Wer schreibt, prüft nicht selbst. Rollen, Aufteilung und Ablauf: [AGENTS.md](AGENTS.md), [docs/AI-TEAM.md](docs/AI-TEAM.md), [docs/START-HERE.md](docs/START-HERE.md).

## Daten und Quellen

18.200 gebündelte Lebensmittel aus **BLS 4.0, USDA SR Legacy, USDA Foundation und Ciqual 2025**, dazu Produktsuche und Barcodes über **Open Food Facts**. Unbekannte Nährwerte werden nicht erfunden; OCR-Ergebnisse werden vor dem Speichern geprüft. Übungsnamen stammen aus [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), ergänzt um eigene Übungen ([Lizenz](EXERCISE-LICENSE.txt)). Weitere Quellen: `catalog/manifest.json` und [docs/archive/FOOD-32.md](docs/archive/FOOD-32.md).

## Datenschutz und Grenzen

Sync über Supabase Auth mit Zugriff nur auf die eigene Nutzer-ID und Konflikterkennung ([Backend-Einrichtung](backend/ACCOUNT-SETUP-DE.md)). Das Repository enthält nur den öffentlichen Client-Schlüssel, keine privaten Profile. Kalorienbedarf, Zieltermin, Körperfett und 1RM sind Schätzungen; Diagramme zeigen nur erfasste Messpunkte.
