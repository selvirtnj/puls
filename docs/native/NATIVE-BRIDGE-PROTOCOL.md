# PULS Zustandsbrücke — Protokoll v1

Vertrag zwischen Web-App (`js/native-state.js`) und nativer App (`ios/PULS/Web/StateBridge.swift`, `ios/PULSCore/Bridge/BridgeMessages.swift`). Gilt für **Phase A**: Das Web besitzt Zustand, Persistenz (`localStorage['puls-v1']`), Auth und Cloud-Sync. Native hält nur einen Lese-Spiegel und eine persistente Outbox.

Beide Seiten testen gegen dieselben Fixtures in `tests/fixtures/native-bridge/`. Änderungen an diesem Dokument erfordern Anpassung beider Seiten und der Fixtures im selben Branch.

## 1. Aktivierung

- Native injiziert beim Dokumentstart (bestehendes User-Script) `window.pulsNativeFeatures` und ergänzt dort den Eintrag `stateBridge`.
- Native registriert den Script-Message-Handler **`pulsState`** (Hauptframe, gleicher Host wie bisher `pulsNative`).
- `native-state.js` tut **nichts**, wenn `window.webkit?.messageHandlers?.pulsState` fehlt oder `stateBridge` nicht gemeldet ist (Browser, PC, alte IPA). Keine Fehler, keine Listener, keine Wrapper.
- M3-Projektionen benötigen zusätzlich das beim Dokumentstart injizierte Feature **`nativeOverview`**. Ohne dieses Feature wird `native-projection.js` nicht aktiviert und weder Builder noch Chart/Trend ausgeführt (auch nicht bei der bestehenden M2-IPA mit `stateBridge`/`nativeBody`). `nativeTabs` allein aktiviert keine Projektion und blendet ohne ausdrückliche Chrome-Bestätigung keine Web-Leisten aus.
- Im Vorschau-Modus (`?erststart=1`) sendet das Web `hello` und `snapshot` mit `flags.preview:true`; Native zeigt den Körperbereich ab M2 nur lesbar und sendet keine schreibenden Befehle. Die Zustandsbrücke liest oder verändert dabei keinen echten Gerätespeicher: Profil und Sequenz bleiben im Arbeitsspeicher.
- Während `activateCloudSession` läuft, setzt die Web-Brücke `activating`: keine Snapshots, schreibende Befehle erhalten `not_ready`. Danach folgt ein Snapshot des endgültigen Zustands, sobald dieser zur aktuellen Nutzer-ID gehört. Ein fehlgeschlagener Profilabruf lässt gegebenenfalls die neue Session und den bisherigen lokalen Stand zurück; auch `cloudStatusChanged` darf diesen Stand nicht mit der neuen Nutzer-ID versenden. Bis zur Übernahme des Kontoprofils, einer ausdrücklichen lokalen Standübernahme im Web, einem bestätigten vollständigen Upload oder der Abmeldung bleiben Snapshots gesperrt und Befehle bei `not_ready`.
- Die ungeklärte Profilzuordnung bleibt über Neuladen/Neustart erhalten (`puls-native-owner-pending`, lokale Bridge-Metadaten). Eine gespeicherte Auth-Session allein hebt diese Sperre nicht auf.
- Ein Upload bestätigt die Zuordnung, wenn `syncCloud` für denselben Nutzer mit schmutzigem lokalen Stand einen Upload beginnt, die Revision danach steigt und `dirty:false` sowie `conflict:false` gelten. Das gilt auch nach `resolveCloudConflict('local')`. Ein Abruf mit gleicher Revision, ein fehlgeschlagener Upload oder ein Upload mit noch offenen lokalen Änderungen reicht nicht. Nach Bestätigung wird die Sperre entfernt und der aktuelle Snapshot gesendet.

## 2. Web → Native (`window.webkit.messageHandlers.pulsState.postMessage(msg)`)

Alle Nachrichten sind JSON-Objekte mit `type` und `protocol: 1`.

### `hello`
```json
{"type":"hello","protocol":1,"webVersion":"74","ops":["weight.upsert","weight.delete"],"screens":["body"],"projections":["overview"],"features":["nativeTabs"],"ownerPending":false}
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
**Pflicht für Native:** Auf jedes `openNative{screen:'body'}` zeigt Native immer etwas an (notfalls Lade- oder Nur-lesen-Ansicht, nach ca. 3 s ohne Daten mit „Im Web öffnen“). Kann Native den Bereich nicht darstellen, ruft es sofort `pulsNativeNavigate({page:'account',section:'body',web:true})` auf. Vor jedem `pulsNativeNavigate` schließt Native seine eigene Ansicht.

Ab M2 umschließt `native-state.js` die zuletzt wirksame Funktion `openAccountSection`. Ein Aufruf mit `'body'` sendet diese Nachricht **anstelle** der Web-Unterseite, genau wenn:

- die Zustandsbrücke aktiv ist (`pulsState.postMessage` und Feature `stateBridge`),
- `window.pulsNativeFeatures` zusätzlich **`nativeBody`** enthält,
- das Laden abgeschlossen und `hello` erfolgreich gesendet ist, zuletzt mit `ownerPending:false`,
- keine Anmeldung läuft (`activating:false`) und die Profilzuordnung weiterhin geklärt ist.

Fehlt eine Bedingung oder wirft `postMessage`, läuft die bisherige Web-Öffnung unverändert. `flags.preview`, `flags.recovery` und `flags.uploadBlocked` verhindern die Weiterleitung **nicht**; Native stellt den Bereich dann nur lesbar dar. Schreibende Ops bleiben durch `readonly` gesperrt.

Web-Einstieg: Kontomenü → „Körper & Entwicklung“ (`accountMenuRow` → `openAccountSection('body')`). Die Körper-Kurzübersicht im Konto und das Plus-Menü öffnen mit `weightForm()` unmittelbar das Web-Gewichtsformular; sie öffnen keine Körper-Unterseite und bleiben unverändert. Die Übersicht hat keinen weiteren Einstieg in die Körper-Unterseite. `closeAccountSection()` und die bestehende Randwischgeste bleiben unverändert.

### `navigate`
```json
{"type":"navigate","protocol":1,"page":"account"}
```
Das Web meldet ab M3 einen internen Seitenwechsel (`go(page)`), damit Native den passenden Tab wählt.

Ab M3: nach Laden einmal die aktuelle Seite; danach bei tatsächlichem Seitenwechsel. Die letzte Render-Kette prüft die Seite gegen die letzte erfolgreich gemeldete Seite, erfasst also auch direkte `page=...`-Änderungen wie beim Konto-Reset ohne `go()`. Wiederholte Renders bzw. `go` zur gleichen Seite senden nichts. Eine ausdrücklich angeforderte Web-Ansicht (`pulsNativeNavigate({page:'home',web:true})`) meldet dagegen auch bei gleicher Seite `navigate{page:'home',web:true}`. Native zeigt damit die Web-Übersicht für den bisherigen Verlauf und wählt nicht sofort wieder die native Übersicht. Diese Nachricht ist UI-Zustand, kein Profil und kein Ack.

### `chrome` — M3, Web-Abläufe sperren die native Navigation

```json
{"type":"chrome","protocol":1,"blocking":true,"reason":"modal","page":"food"}
```

- Meldung nach Laden und bei jeder Änderung von `{blocking,reason,page}`; identische Meldungen werden unterdrückt. `reason` ist `run | session | modal | editing | none`; `blocking` ist genau bei `reason:'none'` false. Die Reihenfolge ist zugleich Priorität bei überlagerten Ansichten: ein Sheet innerhalb einer Session bleibt `session`, eines innerhalb der Aktivität bleibt `run`.
- `run`: offene Aktivitätsansicht (einschließlich Start/Countdown/Live/Zusammenfassung), **nicht** eine bloß minimierte aktive Aktivität. `session`: offene Kraftsession, Abschlussansicht oder Aktivitäts-Endscreen. Geprüft werden bestehende View-States und tatsächlich sichtbare `#run-root`/`#session-root`.
- `modal`: offenes `#modal` oder anderes `dialog[open]`. `editing`: sonstiges `calendarEditing()` (fokussierte Eingabe im Content). Erkennung über letzte Render-/Modal-/Session-/Run-Ketten, generischen DOM-Observer auf Dialog-/Overlay-Änderungen, Dialog-close/toggle und Focus-Ereignisse. Keine zusätzliche persistierte UI-Wahrheit.
- Native sperrt bei `blocking:true` Datumsnavigation, Tabs und Plus, hält den Web-Ablauf samt Sheet sichtbar und überdeckt ihn nicht durch die native Übersicht. Bei **`reason:'session'|'run'` versteckt Native seine Tab-Leiste**. Bei `modal|editing` darf sie sichtbar bleiben, ist aber deaktiviert. Bei `none` darf Native sie wieder zeigen und muss ihre Sichtbarkeit erneut bestätigen, wenn es sie versteckt hatte (siehe `pulsNativeSetChrome`).
- Unabhängig von verspäteter Nachrichtenverarbeitung prüft Web den aktuellen Sperrstand synchron bei jedem nativen Datums-/Navigationsaufruf. Ein neuer Kalenderwert oder Tab darf so nie den Speichertag eines bereits geöffneten Web-Formulars verändern. Ein abgelehnter Aufruf liefert `false` ohne Mutation. Native respektiert dieses Ergebnis und wartet auf `chrome{blocking:false}`; keine Umgehung über direkte `go`-/`setDate`-Aufrufe.

### `projection` — M3, additive v1-Erweiterung

```json
{"type":"projection","protocol":1,"name":"overview","projectionSeq":2,"seq":1,
 "userId":null,"ownerPending":false,"flags":{"preview":false,"recovery":false,"uploadBlocked":false},
 "cloud":{"signedIn":false,"revision":0,"dirty":false,"conflict":false},
 "reason":"date","overview":{}}
```

Eigenständige Nachricht statt eines Snapshot-Felds: Datum/Seite/Live-Status sind flüchtige UI-Daten. Ein Tageswechsel darf weder das persistierte Profil ändern noch einen bis zu 4 MB großen Snapshot erzeugen. Alte v1-Empfänger ignorieren den neuen Typ und die neuen `hello`-Felder. `hello.projections:['overview']` kündigt die Projektion an; `hello.features:['nativeTabs']` kündigt die Web-Unterstützung der nativen Navigation an. `screens` und Gewichts-Ops bleiben für M2 unverändert.

- `projectionSeq`: flüchtige, innerhalb **dieses Web-Dokuments** steigende Nummer; beginnt bei 1, wird nicht gespeichert. Native verwirft verspätete Nummern innerhalb desselben Dokuments und setzt diese Prüfung bei einem neuen Dokument zurück. `seq` ist die Profilsnapshot-Nummer beim Versand; eine Projektion erhöht sie nicht. **`projection.seq` darf hinter der inzwischen empfangenen `snapshot.seq` liegen und ist kein Veraltungs-/Staleness-Signal.** Unveränderte Projektionen werden nicht nur wegen einer neueren Snapshot-Nummer erneut gesendet. Nutzerzuordnung und dokumentlokale `projectionSeq` entscheiden über die Übernahme.
- Quelle ist der **aktuell sichtbare Web-Arbeitsstand**, nicht ein zweites gespeichertes Profil. Keine neue Persistenz, Migration, Auth- oder Sync-Engine. Ein fehlgeschlagenes Speichern wird durch eine Projektion nicht bestätigt.
- Gleiche Nutzer-/Bereitschaftssperre wie Snapshots: keine Projektion während Anmeldung oder ungeklärter Kontozuordnung. Native verdeckt/verwirft seine alte Übersicht bei `hello.ownerPending:true` und wartet auf neue Daten desselben Nutzers. Web leert dabei seinen Versand-Deduplizierungsstand; nach jedem gesendeten `hello.ownerPending:false` folgt eine **erzwungene** Projektion, auch bei identischen Daten (z. B. wenn `activateCloudSession` mit „Bitte zuerst das bisherige Konto abmelden.“ abbricht). Vorschau/Recovery/Upload-Sperre sind anhand `flags` erkennbar; keine Outbox-Bestätigung aus Projektionen ableiten.
- Berechnung/Versand **nur mit `nativeOverview`**: Laden; relevante Zustandsinvalidierung über save/cloud/import/reset/migrate/autofinish/apply; gewählter Tag/heutiger Tag, Sprache, Ziele, Zeitraum/Kurven oder Darstellungs-/Verbindungswerte ändern sich. Reine Renders und Tabwechsel berechnen keine neue Projektion. Die Render-Prüfung liest nur kleine Skalare/Referenzen/Zähler; In-place-Profiländerungen werden über die bestehenden Speicher-/Übernahmepfade invalidiert. Persistenz/Cloud-Änderungen und renderbedingte Aktualisierungen sind 300 ms entprellt. Ein Datumsaufruf antwortet unmittelbar und erzwingt den Versand; bei Sperre wird er abgelehnt. Hintergrund-/Foreground-Ereignisse prüfen nur auf tatsächliche Änderungen.
- Der Adapter hält das berechnete Overview-Modell im Dokument; unveränderte Rückfragen/erzwungene Hello-Antworten verwenden es erneut. Gewichtstrend/Wochen- und Chart-Reihen werden zusätzlich mit Snapshot-`seq`, Invalidierungsrevision, heutigem Tag und `chartPeriod` sowie Profil-/Quellreferenzen gecacht. Ein Wechsel des **ausgewählten** Ernährungstags oder der Sprache verwendet die gleichen Chart-Daten, solange diese Schlüssel gleich sind. Kein Profil-Hash/keine vollständige Profilserialisierung in gewöhnlichen Renders. Eine laufende Uhr ist eine Momentaufnahme; kein sekündlicher Profiltransport. Render-/Speicherfehler werden durch die Projektion nicht ersetzt oder verdeckt.
- Details sind begrenzt: letzte **200** Essen rückwärts, letzte **400** tatsächliche Chart-Tage aufsteigend, erste **3** Routinen, Namen/Mahlzeiten maximal **256 UTF-16-Codeeinheiten**. Beim Kürzen wird ein Surrogatpaar nie getrennt; eine Grenze mitten im Emoji wird um eine Codeeinheit verkürzt. IDs werden nie umgeschrieben: IDs über 256 Codeeinheiten werden nur aus dieser Darstellung ausgelassen. `food.omitted` bzw. `progress.omitted` zählen fehlende Detailzeilen; Tagessummen zählen immer alle Einträge. `food.previewIds` benennt die letzten fünf wie im Web. Zusätzliche Kürzung ältester Details hält `JSON.stringify(overview).length <= 48*1024` (maximal 144 KiB UTF-8, Nachricht mit Standard-Envelope unter 150 KiB). Native muss bei ausgelassenen Zeilen das Web-Tagebuch anbieten.

Exaktes `overview`-Schema (Objekte/Felder vorhanden; `null` heißt unbekannt/nicht vorhanden):

| Feld | Inhalt |
|---|---|
| `date, today, isToday` | ISO-Kalendertage und Boolean. Nur Essen/Energie/Mikros/Wasser/Tagesabschluss folgen `date`; Training/Gewicht/Verlauf folgen wie die Web-Übersicht dem heutigen Stand. |
| `language, locale, colorScheme` | `de|en`, Web-`appLocale()`, `system|light|dark` aus Geräteeinstellung. |
| `connectivity` | `{online:Boolean|null}` aus dem bestehenden Verbindungsstatus. Offline-Hinweis ist Teil des gemeinsamen Chrome. |
| `page, tabs` | Seite zum Zeitpunkt der letzten Overview-Berechnung (kann wegen Cache hinter der aktuellen Seite liegen); für die **aktuelle** Seite sind `navigate`/`chrome.page` maßgeblich. `[{id,icon,labelKey}]` in der Reihenfolge aus `dsTabs`: workout/home/add/food/account. `add` ist eine Aktion, keine Seite. |
| `goals` | `{values:{kcal,p,c,f}, mode, macroMode, calorieMode, source}`. Werte aus `dsDayGoals()` → `dayGoals(date)`; `source:'state.goals'|'dayGoals'` bezeichnet gespeicherten/Fallback- bzw. tagesbezogenen Zielstand. `mode` und `macroMode` sind die eingestellten Planmodi, `calorieMode:'classic'|'baseline'` der eingestellte Kalorienmodus; daraus keine zweite Formel ableiten. |
| `eaten, remaining` | Je `{kcal,p,c,f}`; `totals()` bzw. Ziel minus tatsächliche Summe, **vor** Rundung subtrahiert. `remaining` ist vorzeichenbehaftet; kein Abschneiden bei Überschreitung. |
| `energy` | `{hasGoal,over,percent,displayValue,captionKey}` aus `dsEnergyFacts`. `percent` ist der ungekappte Ringwert; Darstellung begrenzt ihn auf 0–100 wie `dsRing`. `displayValue` ist der positive Rest/Überschuss oder gegessen ohne Ziel. `captionKey:'energy.left'|'energy.over'|'energy.noGoal'`. |
| `macros` | `{p,c,f}` jeweils `{over,percent}`; Balkenprozent wie `dsMacroRows`, maximal 100. |
| `micros` | Schlüssel fiber/vitc/iron/calcium/b12/folate/potassium/magnesium, jeweils `{labelKey,unit,value,known,total,target,targetSource}`. `value:null` bei `known:0`, bekannter Nullwert bleibt `0`. Teilbekanntheit bleibt durch `known/total` sichtbar. Ziele aus `microGoals` oder `referenceMicros()`, Quelle `custom|reference|null`. |
| `water` | `{value,displayValue,known,total,target,estimated,unknownDrinks}` in ml. Ohne bekannte Werte `value:null`, bisherige Web-Anzeige separat als `displayValue:0`. Der letzte `nutrientTotals`-Wrapper liefert auch bestehende Getränkeschätzungen; `estimated` kennzeichnet sie. Keine neue g/ml-Umrechnung und kein Rückschreiben in Nährwert-Snapshots. |
| `food` | `{total,entries:[{id,name,amount,unit,kcal,meal}],previewIds:[id],omitted,complete}`. Menge aus `grams`, Einheit exakt wie Web `ml` oder `g`; `meal` ist gespeicherter Datenwert. `complete` aus `foodLogCompleted`. Keine erzwungene Mahlzeitengruppierung. |
| `training.activeWorkout` | `{id,name,date,routineId:null|string}|null` aus `activeWorkout()`. |
| `training.activeRun` | `{type,elapsedSeconds,paused,clock:null|string}|null`; Uhr aus `runElapsed()`/`formatClock()`, keine GPS-Punkte, Routen, Notizen oder neue kcal-Schätzung. Typ ist ein Datenschlüssel, kein übersetzter Name. Native darf eine lokale Uhr aus dieser Momentaufnahme fortführen und fragt beim Wiederanzeigen erneut per Tagesaufruf an. |
| `training.routines, routineCount` | Bis drei `{id,name,exerciseCount}` wie `dsTrainingGroup` und Gesamtzahl. Bei aktivem Workout zeigt das Web stattdessen Fortsetzen; Native ebenso. |
| `training.lastWorkout, nextRoutine` | Kompaktes Workout bzw. Routine/null aus `routineRecommendation()`. `lastWorkout.routineId`/Name identifiziert die letzte Routine; keine neue Empfehlung. |
| `training.week` | `{start,end,sessions,workouts,activities,activeMinutes,minutesGoal,runKm}` aus `activityPeriodStats('week')`, `activeMinutesWeek()`, `activeMinutesGoal()`, `runWeekRange()`/`runKmBetween()`. Nur abgeschlossene aktuelle Wochensessions, unbekannte Dauer wird nicht ergänzt. |
| `weight` | `{current:{id:null|string,date,kg}|null,trend:{date,kg}|null,weeklyMean:{start,kg,count}|null,weeklyChange:{kg,from,to}|null}`. Aktuell wie `dsBodyGroup`: jüngste Messung bis heute, **kein** Profilgewicht als Messung. Trend aus `weightTrend()`. Wochenmittel/-differenz wie `weeklyWeightCard` aus `weeklyWeights()`: die letzten zwei **erfassten** Wochen, nicht zwingend benachbarte Kalenderwochen. Die Web-Funktion bezieht auch eingetragene Zukunftsgewichte in Wochenmittel ein; dieser Adapter ändert ihre Semantik nicht. |
| `progress` | `{period,lines:{weight,strength,kcal},rows:[{date,weight,strength,kcal}],total,omitted,navigation:{page:'home',web:true}}`. Reale Reihen aus `trendData()`; fehlende Messungen bleiben `null`. Zeitraum/Kurvenauswahl werden erhalten. **M3 rendert den normalisierten Web-Indexchart nicht nativ**; dafür `navigation` verwenden. Keine Swift-Nachbildung der Chart-/e1RM-Formel. |
| `actions` | `{addFood:{action:'addFood'},diary:{page:'food'},routines:{action:'routines'},startWorkout:{action:'startWorkout'},addWeight:{action:'addWeight'},quickAdd:{action:'quickAdd'}}`. Weitere zeilenbezogene Aktionen siehe unten. |

Rundung entspricht der Web-Anzeige: Energie/gegessene Makros/Rest/Essens-kcal ganzzahlig mit `Math.round` (`dsKcal`/`dsMacroRows`), Makroziele/Mengen/aktuelles Gewicht mit `n`-Präzision (Intl, maximal eine Nachkommastelle), Mikros und Wochenwerte mit `round` und danach `n`, Gewichtstrend und Wochenkilometer vorher auf eine Nachkommastelle. Prozentwerte behalten die vom Web verwendete Genauigkeit. Native subtrahiert **nicht** erneut gerundete Werte: z. B. 1,5 gegessen bei Ziel 1 wird als 2 gegessen und 1 über dem Ziel angezeigt.

Texte sind Schlüssel plus Werte. `tab.workout/home/add/food/account` entsprechen Training/Übersicht/Hinzufügen/Essen/Konto (EN Training/Overview/Add/Food/Account); `energy.left/over/noGoal` entsprechen übrig/über dem Tagesziel/gegessen, kein Tagesziel (EN left/over your daily target/eaten, no daily target). `nutrient.<key>` bezeichnet die bestehenden Nährstoffnamen; zusätzliche Abschnitts-/Aktionsüberschriften lokalisiert die native Oberfläche in `language`. Lebensmittel-/Routinenamen und gespeicherte Mahlzeiten bleiben unveränderte Daten (außer begrenzter Textlänge). Die formatierte Aktivitätsuhr ist eine bestehende numerische Web-Anzeige, kein vorübersetzter UI-Satz.

Abdeckung der **letzten** `home()`-Definition (`design-system.js`, v74): Energie/Ring/Makrobalken und Essen-erfassen; letzte fünf Essenseinträge samt Bearbeitungs-Einstieg und Tagebuch; laufende Aktivität, laufendes Workout oder erste drei Routinen/freies Training, alle Routinen; aktive Wochenminuten und Laufkilometer; letztes Gewicht und Gewichtsformular; Verlauf mit Zeitraum-/Kurvenstand und Web-Ausweichziel. Native Essens-Löschung/Undo und Indexchart-Interaktionen bleiben in Web-Abläufen. Wasser/Mikros/Tagesabschluss, Gewichtswochen/Trend und letzte/nächste Routine sind zusätzliche Lesedaten, **keine neu eingeführten Übersichtsaktionen**. `dsChrome` liefert Seitentitel/Datum/Tab-Liste; die Trainingsidentität (Level/XP/Streak) bleibt im Workout-Tab im Web und wird durch `nativeTabs` nicht ausgeblendet. Es fehlen bewusst Avatar/XP-Datenduplikate, fertige native Chart-Geometrie, GPS-Rohdaten und entfernte Features.

## 3. Native → Web

### Fähigkeiten
`window.pulsNativeFeatures` ist ein Array. Für M2 meldet Native **`stateBridge` und `nativeBody`** (zusätzlich zu bisherigen Features). `native:body` und `nativeScreens` sind kein Teil dieses Vertrags. `hello.screens` bleibt `['body']`, `hello.ops` bleibt `['weight.upsert','weight.delete']`; Maße, Körperfett und BMI benötigen keine neuen schreibenden Ops in M2. Native prüft vor Freischaltung weiterhin Screen, beide Gewichts-Ops und `ownerPending:false`.

Für M3 ergänzt Native **`nativeTabs` und `nativeOverview`** beim Dokumentstart. `hello.features/projections` melden die Unterstützung, sind selbst **keine** Übernahmebestätigung. Native muss für die native Übersicht eine gültige Projektion desselben Nutzers abwarten; fehlt sie, bleibt die Web-Übersicht erreichbar (nach ca. 3 s Web-Ausweichansicht anbieten). Die WebView bleibt immer in der View-Hierarchie.

### `window.pulsNativeSetChrome(active:boolean)` — M3

- Native ruft **erst sobald seine Leiste sichtbar ist** `pulsNativeSetChrome(true)` auf. Web akzeptiert nur Boolean, aktiven `stateBridge` + `nativeTabs`, abgeschlossenes Laden, erfolgreiches Hello mit `ownerPending:false` und geklärte Zuordnung. `true` als Ergebnis bestätigt die Übernahme; sonst `false` ohne Ausblendung. Ohne diesen Aufruf bleibt die Web-Leiste sichtbar. Bei älterem Web ohne Funktion keine native Übernahme aktivieren.
- Erst die bestätigte Übernahme setzt `<html class="puls-native-tabs">`. `css/native-shell.css` blendet ausschließlich darunter Web-Tab-Leiste/Sidebar und root header/titleline/datebar aus; Inhalte/Trainingsidentität bleiben erhalten.
- Native ruft `pulsNativeSetChrome(false)` auf, **sobald es seine Leiste versteckt**. Normalerweise entfernt Web die Klasse sofort. Ausnahme: War die Übernahme bereits bestätigt und ist aktuell `chrome.reason:'session'|'run'`, bleibt die Web-Leiste für genau diesen Vollbildablauf ebenfalls ausgeblendet (flüchtiger Session-Halt). Dieser Halt aktiviert niemals eine zuvor unbestätigte Übernahme. Bei Ende des Vollbildablaufs endet er automatisch; Native zeigt seine Leiste wieder und bestätigt erneut mit `true`. Für andere Gründe gibt es keinen Halt.
- `hello.ownerPending:true`, `pagehide`/Neuladen widerrufen Bestätigung und Halt immer, auch während Vollbild. Bei Rückkehr nach `pageshow`, neuem Dokument oder erneut geklärter Zuordnung ist eine neue Bestätigung erforderlich. Die Chrome-Übernahme wird nie gespeichert. `false` bleibt als Aufräumaufruf auch ohne Bereitschaft zulässig; ungültige Typen liefern `false`.
- Verbindliches Layout: **Die WebView endet oberhalb der nativen Tab-Leiste; Native respektiert deren Safe Area selbst.** Die WebView darf nicht zusätzlich hinter der Leiste liegen. In `puls-native-tabs` gibt es daher keine Web-Tab-Leisten-/Bottom-Safe-Area-Reserve: Main unten 16 px, Workout-Dock unten 8 px, Toast/Undo unten 12 px. Bei vorhandenem minimiertem Workout bleiben lediglich dessen eigene Platzreserve (Main 88 px; Toast/Undo 80 px) erhalten, damit Inhalte nicht vom Dock verdeckt werden. Bei versteckter nativer Leiste richtet Native die WebView entsprechend seinem sichtbaren Content-/Safe-Area-Bereich aus. Browser und unbestätigter Modus behalten alle bisherigen Abstände.

### `window.pulsNativeApply(cmd)` (per `evaluateJavaScript`)
```json
{"id":"cmd-uuid","userId":"uuid-oder-null","baseSeq":42,"op":"weight.upsert","args":{"id":"w-uuid","date":"2026-10-26","kg":82.4,"expect":null}}
```
- `id`: Befehls-ID (UUID, Native erzeugt). Das Web merkt sich die letzten 200 erledigten IDs samt Nutzerzuordnung in `localStorage['puls-native-applied']` und beantwortet Wiederholungen auch nach einem Web-Prozess-Neustart mit dem ursprünglichen Ergebnis (`ok:true`, aktuelle `seq`), ohne erneut auszuführen. Fehlt die ID, wird der Befehl wieder ausgeführt. Eine fehlende oder unlesbare Historie gilt als leere Liste; sie darf das Replay nicht allein mit `persist_failed` blockieren.
- `userId` muss zur aktuellen Session passen (`null` == lokal ohne Konto), sonst `wrong_user`.
- `baseSeq`: Spiegel-Stand, auf dem Native den Befehl gebildet hat. Nur Diagnose; Entitätsbefehle sind gegen spätere Änderungen robust und werden nicht wegen abweichender `seq` abgelehnt.
- Rückgabe des Funktionsaufrufs ist bedeutungslos; maßgeblich ist die `ack`-Nachricht.

### `window.pulsNativeNavigate({page, section?, web?:true})`
Ab M2, nur bei aktiver Zustandsbrücke verfügbar. Beispiel für „Körpermaße & Körperfett“, das in M2 im Web bleibt:
```js
window.pulsNativeNavigate({page:'account', section:'body', web:true});
```
- Erlaubte `page`: `workout | home | food | account`. Unbekannte Seiten und ungültige Ziele werden ohne Navigation ignoriert (auch das historische Alias `weight`).
- `section` ist optional, nur für `page:'account'` zulässig und muss einem Schlüssel in den bestehenden `accountSections` entsprechen. Unbekannte Abschnitte werden ohne Seitenwechsel ignoriert.
- Ruft zur Ausführungszeit die zuletzt wirksamen `go(page)` und danach optional `openAccountSection(section)` auf. Keine neue Navigationshistorie, kein eigener Profilzustand. Seit M3 meldet die umschlossene `go`-Kette die oben beschriebenen `navigate`-Nachrichten.
- Nur `web:true` umgeht die native Weiterleitung während **dieses synchronen Aufrufs**. Die geöffnete Web-Unterseite bleibt beim Rendern im Web; ein späterer Einstieg leitet wieder nativ weiter, auch nach Zurück oder Tabwechsel. Die Ausnahme bleibt auch bei einem Fehler nicht aktiv.
- Die Seitennavigation selbst ist auch vor Bereitschaft oder bei `ownerPending` möglich, sofern kein Web-Ablauf blockiert; ausschließlich die Weiterleitung nach Native setzt die oben beschriebene Bereitschaft voraus. **Bei `chrome.blocking:true` liefert die Seiten-/Abschnittsnavigation immer `false` ohne Änderung.** Erfolgreiche Navigation liefert `true`, ungültige Ziele `false`.

### `window.pulsNativeSetDate('YYYY-MM-DD')` — M3

Nur bei aktiver Brücke verfügbar. Streng gültiger lokaler Kalendertag (wie Gewichts-Ops; 30. Februar wird abgelehnt). Nach Laden und geklärter Zuordnung und **nur ohne aktuellen Web-Sperrgrund** ruft die Funktion die letzte `setDate`-Kette auf und liefert `true`; sonst `false`, ohne Seiten-/Datumsänderung. Keine persistierte Mutation, kein Op, kein Ack. Mit `nativeOverview` kommt die Projektion mit `reason:'date'`, auch wenn dasselbe Datum angefordert wurde. Der Tag darf wie im Web in der Zukunft liegen. Automatisches Folgen des heutigen Tags und `moveDay` bleiben in der Web-Kette.

### `window.pulsNativeNavigate({action, id?})` — M3

Alternative zur Seiten-/Abschnittsform; nicht mit `page` oder `section` kombinieren. Erst nach Laden und geklärter Zuordnung. Keine frei ausführbaren Strings: nur folgende Einträge, mit aktuellen Web-Funktionen und nach Prüfung der betroffenen ID. Bei bestehender Sperre werden **alle** Actions mit `false` abgelehnt; einzige Ausnahme ist `quickAdd`, wenn damit das bereits offene eigene Quick-add-Menü geschlossen wird (`reason:'modal'` und `body.quickaddopen`). Unbekannte/ungültige Ziele liefern `false`, ausgeführte Einstiege `true`. Native blendet seine Übersicht **vor** dem Aufruf aus und zeigt die bestehende WebView einschließlich Modals/Sessions; ein `navigate`-Echo allein darf diese Web-Ansicht nicht wieder überdecken. Ohne Seitenwechsel kommt kein zusätzlicher Navigationsevent. Das Plus führt **`{action:'quickAdd'}`** aus; es ist kein fünfter Seitentab und behält den bisherigen ausgewählten Tab.

| action | Web-Einstieg |
|---|---|
| `quickAdd` | aktuelle `quickAddMenu()` einschließlich Öffnen/Schließen-Wrapper |
| `addFood` | Essen-Tab → `foodForm()` → `foodTab('search')` |
| `editFood`, `id` | existierender Eintrag des ausgewählten Tages → Essen-Tab → `editDiaryFood(id)`; Bearbeiten/Löschen/Undo bleiben Web |
| `resumeWorkout`, `id` | nur das aktuell aktive Workout → `openWorkoutSession(id)`, sonst Web-Current-Tab als Fallback |
| `resumeRun` | nur bei vorhandener aktiver Aktivität → `openRunView()` |
| `startRoutine`, `id` | existierende Routine → Training → `startRoutine(id)`; bestehende Aktivschutz-/Startlogik bleibt maßgeblich |
| `startWorkout` | Training → `startWorkout()` |
| `routines` | `trainTab='routines'` → Training |
| `addWeight` | bestehendes `weightForm()` wie die Übersicht; M2-Körpernavigation separat wie bisher |

Diese Aufrufe sind Navigation in bestehende UI-Flows, keine stillen Mutationen und keine Outbox-Ops. **Koordinator-Entscheidung: `water.add` und `day.complete` gehören zu M7 (Ernährung), nicht zu M3/H.** Die letzte Web-Übersicht enthält beide Aktionen nicht. Bestehende Web-Funktionen bleiben unverändert; mit aktiviertem `nativeOverview` aktualisieren ihre Änderungen Projektion und Snapshot. Neue Direktaktionen benötigen in M7 persistenzbestätigte/idempotente Ops mit eigenen Fixtures und nativer Outbox-Wirkungsprüfung, nicht einen Toggle über Navigation.

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
