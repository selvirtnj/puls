# PULS Zustandsbrücke — Protokoll v1

Vertrag zwischen Web-App (`js/native-state.js`) und nativer App (`ios/PULS/Web/StateBridge.swift`, `ios/PULSCore/Bridge/BridgeMessages.swift`). Gilt für **Phase A**: Das Web besitzt Zustand, Persistenz (`localStorage['puls-v1']`), Auth und Cloud-Sync. Native hält nur einen Lese-Spiegel und eine persistente Outbox.

Beide Seiten testen gegen dieselben Fixtures in `tests/fixtures/native-bridge/`. Änderungen an diesem Dokument erfordern Anpassung beider Seiten und der Fixtures im selben Branch.

## 1. Aktivierung

- Native injiziert beim Dokumentstart (bestehendes User-Script) `window.pulsNativeFeatures` und ergänzt dort den Eintrag `stateBridge`.
- Native registriert den Script-Message-Handler **`pulsState`** (Hauptframe, gleicher Host wie bisher `pulsNative`).
- `native-state.js` tut **nichts**, wenn `window.webkit?.messageHandlers?.pulsState` fehlt oder `stateBridge` nicht gemeldet ist (Browser, PC, alte IPA). Keine Fehler, keine Listener, keine Wrapper.
- Im Vorschau-Modus (`?erststart=1`) sendet das Web `hello` und `snapshot` mit `flags.preview:true`; Native zeigt dann nichts nativ an und sendet keine Befehle.

## 2. Web → Native (`window.webkit.messageHandlers.pulsState.postMessage(msg)`)

Alle Nachrichten sind JSON-Objekte mit `type` und `protocol: 1`.

### `hello`
```json
{"type":"hello","protocol":1,"webVersion":"74","ops":["weight.upsert","weight.delete"],"screens":["body"]}
```
Einmal nach vollständigem Laden (nach Migration, Recovery-Prüfung und erstem `render`). `ops` = vom Web ausführbare Befehle, `screens` = Bereiche, die Native übernehmen darf. Native schaltet einen nativen Bereich nur frei, wenn Screen **und** alle benötigten Ops gemeldet sind. Danach spielt Native die Outbox erneut ein.

### `snapshot`
```json
{"type":"snapshot","protocol":1,"seq":42,"userId":"uuid-oder-null","state":{},
 "cloud":{"signedIn":true,"revision":17,"dirty":false,"conflict":false},
 "flags":{"preview":false,"recovery":false,"uploadBlocked":false},
 "reason":"save"}
```
- `seq`: monoton steigend, in `localStorage['puls-native-seq']` gehalten (überlebt Neustart). Jeder Snapshot erhöht `seq` um 1.
- `state`: das vollständige persistierte Profil, exakt wie in `puls-v1` (keine Umformung, unbekannte Felder enthalten).
- `userId`: Supabase-Nutzer-ID oder `null` (lokal ohne Konto).
- `reason`: `load | save | cloud | import | reset | migrate | autofinish | apply`.
- Auslöser: Laden; nach jedem `save()` (Debounce **300 ms**, beim Verlassen/`pagehide`/`visibilitychange` sofort flushen); nach Cloud-Übernahme (`applyCloudProfile` o. ä.), Import, Reset, Migration, automatischem Workout-Abschluss und nach jedem `apply`.
- Größe: `state` kann bis ~4 MB groß sein. Native schreibt den Spiegel abseits des Main-Threads atomar.

### `ack`
```json
{"type":"ack","protocol":1,"id":"cmd-uuid","ok":true,"seq":43}
{"type":"ack","protocol":1,"id":"cmd-uuid","ok":false,"seq":42,"error":{"code":"invalid","message":"kg außerhalb 20–400"}}
```
Antwort auf genau ein `apply`. `ok:true` **erst nach bestätigter Persistenz** (siehe 4). Bei `ok:true` folgt ein `snapshot` mit `reason:"apply"` und derselben oder höherer `seq`.

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
{"id":"cmd-uuid","userId":"uuid-oder-null","baseSeq":42,"op":"weight.upsert","args":{"id":"w-uuid","date":"2026-10-26","kg":82.4}}
```
- `id`: Befehls-ID (UUID, Native erzeugt). Das Web merkt sich die letzten 200 erledigten IDs in `localStorage['puls-native-applied']` und beantwortet Wiederholungen mit dem ursprünglichen Ergebnis (`ok:true`, aktuelle `seq`), ohne erneut auszuführen.
- `userId` muss zur aktuellen Session passen (`null` == lokal ohne Konto), sonst `wrong_user`.
- `baseSeq`: Spiegel-Stand, auf dem Native den Befehl gebildet hat. Nur Diagnose; Entitätsbefehle sind gegen spätere Änderungen robust und werden nicht wegen abweichender `seq` abgelehnt.
- Rückgabe des Funktionsaufrufs ist bedeutungslos; maßgeblich ist die `ack`-Nachricht.

### `window.pulsNativeNavigate(page)`
Ruft `go(page)` auf (ab M3).

## 4. Ausführung und Bestätigung im Web

1. Prüfen: Protokoll aktiv, kein Vorschau-/Recovery-/Upload-Sperr-Zustand für schreibende Ops (sonst `readonly`), `userId` passt, Op bekannt, `args` gültig.
2. Ausführen über **dieselbe zuletzt wirksame Web-Funktion bzw. Datenmutation**, die auch die Web-Oberfläche nutzt, damit Nebeneffekte (Planneuberechnung, Profilhistorie, XP, `render`) identisch bleiben.
3. `validData(state)` (vollständige Wrapper-Kette) muss danach `true` sein; sonst Änderung zurücknehmen → `invalid`.
4. `save()` aufrufen. Weil `save()` keinen verlässlichen Rückgabewert hat, **danach `localStorage.getItem('puls-v1')` lesen und prüfen**, dass der Befehl darin wirksam ist (z. B. Eintrag mit `id` und `kg` vorhanden bzw. entfernt). Schlägt das fehl → Änderung im Speicher zurücknehmen, `persist_failed`.
5. ID in `puls-native-applied` eintragen, `ack ok:true` senden, Snapshot (`reason:"apply"`).

## 5. Ops (v1)

| Op | args | Semantik | Grenzen |
|---|---|---|---|
| `weight.upsert` | `{id, date, kg}` | Eintrag mit `id` ersetzen, sonst anlegen. Existiert für `date` bereits ein Eintrag mit anderer `id`, wird dieser ersetzt (Web-Regel: ein Gewicht pro Tag) — Verhalten exakt wie Web-Speichern. | `date` `YYYY-MM-DD` (lokaler Kalendertag), `kg` Zahl 20–400, `id` nicht leer |
| `weight.delete` | `{id}` | Eintrag mit `id` entfernen; fehlt er, trotzdem `ok:true` (idempotent). | — |

Neue Ops werden hier ergänzt und im `hello.ops` gemeldet. Umbenennen oder Semantik ändern = neue Op.

## 6. Fehlercodes

| Code | Bedeutung | Native-Reaktion |
|---|---|---|
| `invalid` | args oder Ergebnis ungültig | Befehl verwerfen, optimistische Änderung zurückrollen, Hinweis |
| `wrong_user` | `userId` passt nicht | Befehl parken (nicht löschen), Nutzer fragen |
| `readonly` | Vorschau, Recovery oder Upload-Sperre | Befehl in Outbox halten, Bereich nur lesbar |
| `unknown_op` | Op nicht unterstützt | Befehl parken, Bereich auf Web zurückfallen |
| `persist_failed` | Speichern nicht bestätigt (z. B. Quota) | Befehl in Outbox halten, später erneut |
| `not_ready` | Web noch nicht geladen | erneut nach `hello` |

## 7. Native Pflichten

- Spiegel `Application Support/mirror-<userId|local>.json` atomar schreiben (Datei-Schutz `completeUntilFirstUserAuthentication`), unbekannte Felder verlustfrei erhalten.
- Outbox `Application Support/outbox.json` persistent; Einträge erst nach `ack ok:true` oder endgültigem `invalid` entfernen.
- Nie den ganzen Zustand ans Web zurückschreiben (in Phase A verboten).
- WebView bleibt immer in der View-Hierarchie (verdeckt statt entfernt), damit Timer, Sync und Live-Aktivität weiterlaufen.

## 8. Versionierung

- `protocol` ist eine Ganzzahl. Unbekannte Felder werden auf beiden Seiten ignoriert. Unbekannter `type` wird ignoriert.
- Inkompatible Änderung = `protocol: 2`; Native unterstützt dann beide Versionen, solange ältere Web-Stände im SW-Cache möglich sind. Web-Deploys erreichen alle sofort, IPAs verzögert — das Web muss alte Apps ohne `stateBridge` immer unverändert bedienen.
