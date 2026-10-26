# Codex-Abschlussreview (adversarial)

Echter Codex-Lauf (reviewer, high), 26.10.2026 ~08:45, geprüft `audit-baseline-v69..38df560`. Wortlaut:

CODEX_THREAD=01a1771d-54dc-7bc3-b392-367d96c3e5ec
Geprüft: `audit-baseline-v69..38df560` auf `refactor/comprehensive-app-audit`. **Ein belegter P2-Befund; keine weiteren belegten P1/P3-Befunde.**

**P2 – Erfolgreiche Standwahl beendet den Recovery-Zustand nicht dauerhaft**

Ort: `js/cloud.js:8`, `js/cloud.js:18`, `js/cloud.js:26`, `js/app.js:32`, `js/app.js:113`.

`cloudClearUploadBlock()` hebt die Upload-Sperre auf, beendet aber weder `stateRecoveryPending` noch die bevorzugte Speicherung/Ladung von `puls-v1-recovered`. Dadurch wird die Sperre anschließend erneut gesetzt.

**Lokal reproduziert, ausschließlich mit VM-/Storage-/Transportfixtures:**

1. Beschädigtes `puls-v1`; zusätzliche Rohsicherung wegen Speicherfehler nicht möglich.
2. Änderungen speichern: Arbeitskopie entsteht in `puls-v1-recovered`.
3. Speicher wieder verfügbar machen, App neu starten.
4. „Diesen lokalen Stand übernehmen“ wählen: Upload erfolgt erfolgreich, Anzeige meldet synchronisiert.
5. Erneut starten: Arbeitskopie wird wieder als Recovery geladen; Upload ist erneut gesperrt.

Auch „Cloud-Stand laden“ und Anmeldung mit Cloud-Übernahme lassen `stateRecoveryPending=true` zurück. Beim Cloud-Laden ist die Sperre nach dem anschließenden lokalen Speichern bereits wieder aktiv; die nächste Änderung führt erneut zum Konflikthinweis. Ein gültiger Import beendet diesen Zustand ebenfalls nicht dauerhaft.

**Auswirkung:** Der angebotene Wiederherstellungsweg liefert keinen dauerhaft synchronisierbaren Stand. Nutzer müssen zusätzlich den Rohdaten-Download samt Übernahmebestätigung finden, obwohl die Standwahl bereits erfolgreich erscheint.

**Fix-Vorschlag:** Die vorhandene Rohdatenschutz-/Übernahmebestätigung mit den betroffenen Standwahl- und Importwegen verbinden. Erst nach erfolgreicher Übernahme in den Hauptstand Recovery-Datei und Recovery-Flags konsistent beseitigen und den Upload dauerhaft freigeben. Bei Abbruch bleibt die getrennte Arbeitskopie erhalten.

Gezielt nachprüfen: lokale Standwahl, Cloud-Übernahme und Import jeweils **mit anschließendem Speichern und Neustart**. Die bestehenden Tests prüfen diese Kombination nicht; die Konflikttests starten ohne tatsächlich ausstehenden Recovery-Zustand.

**Weitere geprüfte Bereiche**

- **Normalbetrieb:** Start, Speichern, Import, Anmeldung und Abmeldung mit sauberem Profil erzeugten in den zusätzlichen Fixtures keine Recovery-Datei oder Upload-Sperre.
- **Funktionsumfang:** Kein belegter Funktionsverlust durch Entfernung von `visuals.js`/`visuals.css`; maßgeblich bleibt `currentDesign() === 'classic'`. „Text & Sprache“ verliert tatsächlich den Plus-Einstieg. Das Entfernen ist allerdings bereits in `docs/CURRENT-STATE.md:97` dokumentiert; die verbliebenen Funktionsaufrufe sind kein Beleg für einen erreichbaren Ersatz-Einstieg.
- **Daten/Training:** Keine zusätzliche Regression bei geprüften alten Sicherungen, IDs, Nährwert-Snapshots, fehlenden Nährstoffen, g/ml-Grenzen, Workout-Vorbelegung oder Pausenlogik gefunden.
- **Entprellung:** State wird sofort aktualisiert; Timer sowie Flush bei `visibilitychange`, `pagehide` und abschließenden Eingaben sind lokal getestet. Keine neue belegte Cloud-Race-Regression.
- **Service Worker:** Alle **89 JS-/CSS-Verweise** aus `index.html` sind abgedeckt; alle **105 ASSETS-Einträge** existieren. Keine Verweise auf gelöschte Visuals-Dateien. Navigation und Fehler-Fallback bestehen die Mock-Tests.
- **Testqualität:** Die neuen Tests führen echte App-Funktionen mit Mocks aus. Die wesentliche Lücke liegt in den zusammengesetzten Recovery-Lebenszyklen. Die zusätzlichen Zustandsflags sollten an dieser Stelle vereinheitlicht werden; eine pauschale Rücknahme der Schutzmaßnahmen ist nicht begründet.

`node scripts/check.cjs`: **PASS, Exit 0**, Node 24.22.1.

Ungeprüft bleiben Browser/iPhone-Layout, tatsächliche iOS-Prozessbeendigung ohne Lifecycle-Ereignis, reale Speicherkontingente, Offline-Service-Worker im Browser sowie Live-Supabase/RLS. Keine Dateien geändert; vorhandene Änderung an `CLAUDE.md` erhalten.

**Empfehlung für Merge auf main: ja nach Fix des P2-Recovery-Übergangs und gezielter Nachprüfung.**

RÜCKFRAGEN: Keine.
