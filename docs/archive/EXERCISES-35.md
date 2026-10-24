# Mehr Maschinenübungen · Version 35

Die lokale Bibliothek enthält jetzt 963 Übungen: die bestehenden 876 Namen aus Free Exercise DB und 87 ergänzte Einträge für Maschinen, Smith und Kabelzüge. Die Ergänzungen werden direkt in PULS gepflegt; sie stammen nicht aus einer zusätzlichen externen API. Es werden keine Bilder oder kostenpflichtigen Dienste geladen.

Beispiele: Machine Lateral Raise, Pendulum Squat Machine, Belt Squat Machine, Hip Thrust Machine, Machine Pullover, Single-Arm Machine Row, Plate-Loaded Shoulder Press und Assisted Pull-Up Machine.

- Filter: Alle, Maschinen (einschließlich Smith), Kabelzug und Smith/Multipresse.
- Englische Übungsnamen mit zusätzlichen deutschen Suchbegriffen.
- Vorhandene gleichbedeutende Einträge werden über Suchnamen ergänzt, statt deren IDs zu ersetzen. Bestehende Routinen und Historien bleiben erhalten.
- Zunächst 60 Ergebnisse, weitere in Schritten von 60 nachladbar. Die frühere feste Begrenzung auf die ersten 70 entfällt.
- Neue Übungen verwenden dieselben Routinen-, Satz- und Auswertungsmodelle wie bisher. Muskelzuordnungen bezeichnen die primäre Zielgruppe, keine exakte anatomische Belastungsaufteilung.

Prüfung: `node tests/check-machines35.cjs` sowie die gesamte Testsuite. Zusätzlich wurden Suche und Hinzufügen einer Maschinenübung in der iPhone-Ansicht geprüft.
