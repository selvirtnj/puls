# PULS Zustandsbrücke — Protokoll v1

Vertrag zwischen Web-App (`js/native-state.js`) und nativer App (`ios/PULS/Web/StateBridge.swift`, `ios/PULSCore/Bridge/BridgeMessages.swift`). Gilt für **Phase A**: Das Web besitzt Zustand, Persistenz (`localStorage['puls-v1']`), Auth und Cloud-Sync. Native hält nur einen Lese-Spiegel und eine persistente Outbox.

Beide Seiten testen gegen dieselben Fixtures in `tests/fixtures/native-bridge/`. Änderungen an diesem Dokument erfordern Anpassung beider Seiten und der Fixtures im selben Branch.

## 1. Aktivierung

- Native injiziert beim Dokumentstart (bestehendes User-Script) `window.pulsNativeFeatures` und ergänzt dort den Eintrag `stateBridge`.
- Native registriert den Script-Message-Handler **`pulsState`** (Hauptframe, gleicher Host wie bisher `pulsNative`).
- `native-state.js` tut **nichts**, wenn `window.webkit?.messageHandlers?.pulsState` fehlt oder `stateBridge` nicht gemeldet ist (Browser, PC, alte IPA). Keine Fehler, keine Listener, keine Wrapper.
- Im Vorschau-Modus (`?erststart=1`) sendet das Web `hello` und `snapshot` mit `flags.preview:true`; Native zeigt dann nichts nativ an und sendet keine Befehle. Die Zustandsbrücke liest oder verändert dabei keinen echten Gerätespeicher: Profil und Sequenz bleiben im Arbeitsspeicher.
- Während `activateCloudSession` läuft, setzt die Web-Brücke `activating`: keine Snapshots, schreibende Befehle erhalten `not_ready`. Danach folgt ein Snapshot des endgültigen Zustands, sobald dieser zur aktuellen Nutzer-ID gehört. Ein fehlgeschlagener Profilabruf lässt gegebenenfalls die neue Session und den bisherigen lokalen Stand zurück; auch `cloudStatusChanged` darf diesen Stand nicht mit der neuen Nutzer-ID versenden. Bis zur Übernahme des Kontoprofils, einer ausdrücklichen lokalen Standübernahme im Web, einem bestätigten vollständigen Upload oder der Abmeldung bleiben Snapshots gesperrt und Befehle bei `not_ready`.
- Die ungeklärte Profilzuordnung bleibt über Neuladen/Neustart erhalten (`puls-native-owner-pending`, lokale Bridge-Metadaten). Eine gespeicherte Auth-Session allein hebt diese Sperre nicht auf.
- Ein Upload bestätigt die Zuordnung, wenn `syncCloud` für denselben Nutzer mit schmutzigem lokalen Stand einen Upload beginnt, die Revision danach steigt und `dirty:false` sowie `conflict:false` gelten. Das gilt auch nach `resolveCloudConflict('local')`. Ein Abruf mit gleicher Revision, ein fehlgeschlagener Upload oder ein Upload mit noch offenen lokalen Änderungen reicht nicht. Nach Bestätigung wird die Sperre entfernt und der aktuelle Snapshot gesendet.

## 2. Web → Native (`window.webkit.messageHandlers.pulsState.postMessage(msg)`)

Alle Nachrichten sind JSON-Objekte mit `type` und `protocol: 1`.

### `hello`
```json
{"type":"hello","protocol":1,"webVersion":"74","ops":["weight.upsert","weight.delete"],"screens":["body"],"ownerPending":false}
```
Nach vollständigem Laden (nach Migration, Recovery-Prüfung und erstem `render`), danach erneut bei jedem Wechsel von `ownerPending`. `ops` = vom Web ausführbare Befehle, `screens` = Bereiche, die Native übernehmen darf. Native schaltet einen nativen Bereich nur frei, wenn Screen **und** alle benötigten Ops gemeldet sind und `ownerPending:false` gilt. Erst bei geklärter Zuordnung spielt Native die Outbox erneut ein; ein wiederholtes `hello` verwirft weder Spiegel noch Outbox oder gespeicherte Beobachtungen aus 7.

`ownerPending` ist in `hello` und `snapshot` ein Pflichtfeld vom Typ Boolean. Es ist `true`, solange die Anmeldung läuft oder die Zuordnung des Arbeitsstands zur aktuellen Session ungeklärt ist. Ein `hello` mit `ownerPending:true` enthält keinen State; Native darf damit einen Hinweis zur ungeklärten Kontozuordnung anzeigen und bleibt im Web-Ablauf. Währenddessen sendet Web **keinen Snapshot**, auch keinen mit State und `ownerPending:true`. Nach Freigabe folgt `hello` mit `ownerPending:false` und ein regulärer Snapshot, ebenfalls mit `ownerPending:false`. Die Status-Hellos erhöhen `seq` nicht.

### `snapshot`
```json
{"type":"snapshot","protocol":1,"seq":42,"userId":"uuid-oder-null","state":{},
 "cloud":{"signedIn":true,"revision":17,"dirty":false,"conflict":false},
 "flags":{"preview":false,"recovery":false,"uploadBlocked":false},
 "reason":"save","ownerPending":false}
```
- `seq`: monoton steigend, in `localStorage['puls-native-seq']` gehalten (überlebt Neustart). Jeder Snapshot erhöht `seq` um 1. Ausnahme Vorschau: eigene flüchtige Sequenz, beginnend bei 0 vor dem ersten Snapshot; sie liest/schreibt `puls-native-seq` nicht und beginnt beim Neuladen erneut. Native übernimmt Vorschau-Sequenzen nicht als Stand des echten Spiegels oder der Outbox.
- `state`: das vollständige persistierte Profil, exakt wie in `puls-v1` (keine Umformung, unbekannte Felder enthalten). Ausnahmen: In der Vorschau, ohne gespeichertes Profil (`puls-v1` fehlt) oder bei einem unlesbaren Recovery-Original wird eine JSON-Kopie des aktuellen Web-Arbeitsstands gesendet. Der Snapshot selbst speichert diesen Arbeitsstand nicht als Profil und überschreibt kein beschädigtes Original. Ein Recovery-Ersatzsnapshot trägt `flags.recovery:true`; solange ein gespeichertes Original als JSON-Objekt lesbar ist, bleibt es die Quelle für `state`.
- `userId`: Supabase-Nutzer-ID oder `null` (lokal ohne Konto).
- `ownerPending`: immer `false` bei tatsächlich gesendeten Snapshots; solange der Wert `true` wäre, werden Snapshots vollständig zurückgehalten und der Status nur per `hello` gemeldet.
- `reason`: `load | save | cloud | import | reset | migrate | autofinish | apply`.
- Auslöser: Laden; nach jedem `save()` (Debounce **300 ms**, beim Verlassen/`pagehide`/`visibilitychange` sofort flushen); nach Cloud-Übernahme (`applyCloudProfile` o. ä.), Import, Reset, Migration, automatischem Workout-Abschluss und nach jedem `apply`.
- Größe: `state` kann bis ~4 MB groß sein. Native schreibt den Spiegel abseits des Main-Threads atomar.

### `ack`
```json
{"type":"ack","protocol":1,"id":"cmd-uuid","ok":true,"seq":43}
{"type":"ack","protocol":1,"id":"cmd-uuid","ok":false,"seq":42,"error":{"code":"invalid","message":"kg außerhalb 20–400"}}
```
Antwort auf genau ein `apply`. `ok:true` **erst nach bestätigter Persistenz** (siehe 4). Bei `ok:true` folgt ein `snapshot` mit `reason:"apply"` und derselben oder höherer `seq`. Diese Bestätigung belegt erfolgreiches Schreiben und erneutes Lesen in `localStorage`, keine sofortige Datenträger-Durabilität: WebKit kann den Datenträger später aktualisieren. Native markiert den Befehl deshalb zunächst als `acked` und behält ihn persistent in der Outbox (siehe 7).

### `openNative`
```json
{"type":"openNative","protocol":1,"screen":"body"}
```
Das Web leitet einen Einstieg (z. B. `openAccountSection('body')`) an Native weiter, wenn `screen` in den von Native gemeldeten `nativeScreens` steht (siehe 3).

### `navigate`
```json
{"type":"navigate","protocol":1,"page":"account"}
```
Das Web meldet einen internen Seitenwechsel (`go(page)`), damit Native später (M3) den passenden Tab wählt.

## 3. Native → Web

### Fähigkeiten
`window.pulsNativeFeatures` enthält zusätzlich `stateBridge` und pro nativ verfügbarem Bereich `native:<screen>` (z. B. `native:body` ab M2). Das Web leitet nur dann per `openNative` weiter.

### `window.pulsNativeApply(cmd)` (per `evaluateJavaScript`)
```json
{"id":"cmd-uuid","userId":"uuid-oder-null","baseSeq":42,"op":"weight.upsert","args":{"id":"w-uuid","date":"2026-10-26","kg":82.4,"expect":null}}
```
- `id`: Befehls-ID (UUID, Native erzeugt). Das Web merkt sich die letzten 200 erledigten IDs samt Nutzerzuordnung in `localStorage['puls-native-applied']` und beantwortet Wiederholungen auch nach einem Web-Prozess-Neustart mit dem ursprünglichen Ergebnis (`ok:true`, aktuelle `seq`), ohne erneut auszuführen. Fehlt die ID, wird der Befehl wieder ausgeführt. Eine fehlende oder unlesbare Historie gilt als leere Liste; sie darf das Replay nicht allein mit `persist_failed` blockieren.
- `userId` muss zur aktuellen Session passen (`null` == lokal ohne Konto), sonst `wrong_user`.
- `baseSeq`: Spiegel-Stand, auf dem Native den Befehl gebildet hat. Nur Diagnose; Entitätsbefehle sind gegen spätere Änderungen robust und werden nicht wegen abweichender `seq` abgelehnt.
- Rückgabe des Funktionsaufrufs ist bedeutungslos; maßgeblich ist die `ack`-Nachricht.

### `window.pulsNativeNavigate(page)`
Ruft `go(page)` auf (ab M3).

## 4. Ausführung und Bestätigung im Web

1. Prüfen: Protokoll aktiv und Profilzuordnung bereit (sonst `not_ready`), kein Vorschau-/Recovery-/Upload-Sperr-Zustand für schreibende Ops (sonst `readonly`), `userId` passt, Op bekannt, `args` gültig, `expect` passt zum aktuellen Stand (sonst `conflict`; Replay-Ausnahmen siehe 5). Bekannte Befehls-IDs werden nach Bereitschafts-/Nutzer-/Schreibschutzprüfung ohne erneute Mutation bestätigt.
2. Ausführen über **dieselbe zuletzt wirksame Web-Funktion bzw. Datenmutation**, die auch die Web-Oberfläche nutzt, damit Nebeneffekte (Planneuberechnung, Profilhistorie, XP, `render`) identisch bleiben.
3. `validData(state)` (vollständige Wrapper-Kette) muss danach `true` sein; sonst Änderung zurücknehmen → `invalid`.
4. `save()` aufrufen. Weil `save()` keinen verlässlichen Rückgabewert hat, **danach `localStorage.getItem('puls-v1')` lesen und prüfen**, dass der Befehl darin wirksam ist (z. B. Eintrag mit `id` und `kg` vorhanden bzw. entfernt). Schlägt das fehl → Änderung im Speicher zurücknehmen, `persist_failed`. Den bestehenden `state` in place ändern und per tiefer Sicherung zurücksetzen; seine Objektreferenz erhalten. Auch Cloud-Dirty-Status und gespeicherte Metadaten zurücknehmen. Ein bereits wartender Snapshot bleibt erhalten und wird nach dem Rollback erneut eingeplant.
5. ID in `puls-native-applied` eintragen, `ack ok:true` senden, Snapshot (`reason:"apply"`).

Recovery bleibt auch dann schreibgeschützt, wenn der Ersatzsnapshot einen gültigen Arbeitsstand enthält. Native zeigt diesen Bereich nur lesbar an, hält Befehle in der Outbox und wartet auf die ausdrückliche Standwahl im bestehenden Web-Recovery-Ablauf. Ein Ersatzsnapshot hebt die Recovery- oder Upload-Sperre nicht auf.

## 5. Ops (v1)

| Op | args | Semantik | Grenzen |
|---|---|---|---|
| `weight.upsert` | `{id, date, kg, expect}` | Nach erfolgreicher Erwartungsprüfung: Eintrag mit `id` ersetzen, sonst anlegen. Existiert für `date` bereits der erwartete Eintrag mit anderer `id`, wird dieser ersetzt (Web-Regel: ein Gewicht pro Tag). | `date` `YYYY-MM-DD` (lokaler Kalendertag), `kg` Zahl 20–400, `id` nicht leer; `expect` Pflicht: `null` oder nicht leere Eintrags-ID |
| `weight.delete` | `{id, expect?}` | Eintrag mit `id` entfernen; fehlt er, trotzdem `ok:true` (idempotent). Bei vorhandenem Eintrag wird ein mitgesendetes `expect` geprüft. | `id` nicht leer; `expect` optional: `null` oder nicht leere Eintrags-ID |

`expect` ist die Eintrags-ID, die Native für den betroffenen Tag gesehen hat, oder `null`, wenn dort kein Eintrag existierte. Upsert vergleicht diese Erwartung mit dem aktuellen Tagesstand; ein inzwischen ersetzter, neu angelegter oder gelöschter Eintrag sowie mehrere Einträge desselben Tages führen zu `conflict`, ohne Daten zu ändern. Ein fehlendes/ungültiges Pflichtfeld `expect` führt zu `invalid`. Bei Delete bezeichnet ein angegebenes `expect` die erwartete Ziel-ID; `null` erwartet, dass die Ziel-ID fehlt.

Replay ohne erhaltene Web-Historie bleibt harmlos: Ist der Tagesstand schon exakt `{id, date, kg}` des Upserts, darf dieser trotz der ursprünglichen, jetzt abweichenden Erwartung erneut ausgeführt werden. Ein Delete mit bereits fehlender Ziel-ID bleibt ebenfalls erfolgreich, auch mit der ursprünglichen Erwartung. Andere Abweichungen werden nicht still überschrieben. Native parkt `conflict` und fragt Selvir, statt den Befehl zu verwerfen oder seine Erwartung automatisch auf den neuen Stand zu setzen.

Neue Ops werden hier ergänzt und im `hello.ops` gemeldet. Umbenennen oder Semantik ändern = neue Op.

## 6. Fehlercodes

| Code | Bedeutung | Native-Reaktion |
|---|---|---|
| `invalid` | args oder Ergebnis ungültig | Befehl verwerfen, optimistische Änderung zurückrollen, Hinweis |
| `wrong_user` | `userId` passt nicht | Befehl parken (nicht löschen), Nutzer fragen |
| `conflict` | Aktueller Eintrag weicht von `expect` ab | Befehl parken, Selvir nach dem gewünschten Stand fragen |
| `readonly` | Vorschau, Recovery oder Upload-Sperre | Befehl in Outbox halten, Bereich nur lesbar |
| `unknown_op` | Op nicht unterstützt | Befehl parken, Bereich auf Web zurückfallen |
| `persist_failed` | Speichern nicht bestätigt (z. B. Quota) | Befehl in Outbox halten, später erneut |
| `not_ready` | Web lädt, Anmeldung läuft oder Profilzuordnung ungeklärt | nach `hello` bzw. dem endgültigen Kontosnapshot erneut versuchen |

## 7. Native Pflichten

- Spiegel `Application Support/mirror-<userId|local>.json` atomar schreiben (Datei-Schutz `completeUntilFirstUserAuthentication`), unbekannte Felder verlustfrei erhalten.
- Outbox `Application Support/outbox.json` persistent. Nach `ack ok:true` den Eintrag als `acked` markieren und weiter aufbewahren. Native speichert zusätzlich persistent pro Befehl `lastSeenEffect` (`null` = seit diesem Ack noch kein gültiger Snapshot). Jeder gültige Snapshot desselben Nutzers in **derselben App-Sitzung** wie das Ack setzt den Wert auf „Wirkung sichtbar: ja/nein“ (Upsert mit passender ID/Datum/kg, Delete mit fehlender Ziel-ID). Dazu zählen auch `apply`-/`save`-Snapshots; Vorschau-/Recovery-Ersatzsnapshots zählen nicht. Verschwindet die Wirkung zwischendurch und erscheint wieder, zählt nur der letzte Stand.
- Erst beim Snapshot mit `reason:"load"` aus einem **neuen Web-Prozess nach App-Neustart** (andere App-Sitzung) entscheidet Native über den noch vorhandenen `acked`-Befehl: Ist die Wirkung in diesem `load`-Snapshot sichtbar, wird er ohne Replay entfernt. Fehlt sie und war `lastSeenEffect` `false` (die alte Sitzung sah die Wirkung zuletzt nicht mehr, sie wurde also bewusst gelöscht oder geändert), wird er ebenfalls ohne Replay entfernt. Fehlt sie und war `lastSeenEffect` `true` (zuletzt noch sichtbar, nach dem Neustart verloren) oder `null` (nie ein gültiger Snapshot), spielt Native den Befehl mit derselben ID und demselben `expect` erneut ein. Ein Replay kann so keinen neueren Wert überschreiben: weicht der Tagesstand ab, antwortet das Web mit `conflict`. Ein bloßes Neuladen im bisherigen Prozess reicht für diese Entscheidung nicht; Native verfolgt den Prozesswechsel selbst.
- Beim zulässigen Replay bestätigt erhaltene Web-Historie ohne Ausführung; ohne Historie greifen Upsert/Delete und die Replay-/Konfliktregeln aus 5. `conflict` bleibt geparkt, endgültiges `invalid` darf wie bisher entfernt werden.
- Nie den ganzen Zustand ans Web zurückschreiben (in Phase A verboten).
- WebView bleibt immer in der View-Hierarchie (verdeckt statt entfernt), damit Timer, Sync und Live-Aktivität weiterlaufen.

## 8. Versionierung

- `protocol` ist eine Ganzzahl. Unbekannte Felder werden auf beiden Seiten ignoriert. Unbekannter `type` wird ignoriert.
- Inkompatible Änderung = `protocol: 2`; Native unterstützt dann beide Versionen, solange ältere Web-Stände im SW-Cache möglich sind. Web-Deploys erreichen alle sofort, IPAs verzögert — das Web muss alte Apps ohne `stateBridge` immer unverändert bedienen.
