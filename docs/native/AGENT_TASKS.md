# PULS — Agentenaufgaben native Umstellung

Regeln: Branch `native-ios`. Exklusiver Dateibesitz pro Paket; fremde Dateien nur lesen. Kein Commit/Push durch Agenten — nur der Koordinator. Vertrag: [NATIVE-BRIDGE-PROTOCOL.md](NATIVE-BRIDGE-PROTOCOL.md), Fixtures `tests/fixtures/native-bridge/` (nur Koordinator, sofern das Paket sie nicht ausdrücklich freigibt; Änderungsbedarf sonst unter `RÜCKFRAGEN:` melden). Review immer über Kreuz.

## M1 — Fundament

### Paket B — Web-Seite (Codex, `backend`, medium)

Dateien: `js/native-state.js` (neu), `tests/check-native-state.cjs` (neu), Eintrag in `scripts/check.cjs`, `index.html` (Einbindung direkt nach `native-bridge.js`), `sw.js` (Asset). Gemeinsame Versions-/Cache-Erhöhung anschließend durch den Koordinator per `node scripts/bump-version.cjs`.

- Ohne Handler `pulsState` oder ohne `stateBridge` in `pulsNativeFeatures`: keinerlei Wirkung.
- `hello` nach vollständigem Laden; `snapshot` mit `seq` (persistiert in `puls-native-seq`), `userId`, `cloud`, `flags`, `reason`; Debounce 300 ms, Flush bei `pagehide`/`visibilitychange`.
- Auslöser: Laden, `save()`, Cloud-Übernahme, Import, Reset, Migration, Auto-Abschluss. Vorher die **zuletzt wirksame** Definition/Wrapper-Kette der jeweiligen Funktionen prüfen.
- `window.pulsNativeApply` mit Prüfung, Idempotenz (`puls-native-applied`, 200 IDs), Persistenzbestätigung durch erneutes Lesen von `puls-v1`, `ack`. Bereits in M1: `weight.upsert`/`weight.delete` gemäß Vertrag v1, einschließlich Web-Regel „ein Gewicht pro Tag“, aktueller Planneuberechnung und Rücknahme bei fehlgeschlagener Persistenz. `hello.ops` meldet beide Ops, `hello.screens` meldet `body`; die native Oberfläche und Weiterleitung folgen in M2.
- Tests in `tests/check-native-state.cjs` (VM, Mock-Handler) gegen die Fixtures: kein Effekt ohne Handler/Feature; hello/snapshot-Form; seq monoton; Gewichts-Ops samt Tagesersetzung und Idempotenz; Fehler-Fixtures; `persist_failed`; readonly in Vorschau/Recovery/Upload-Sperre. `profile-full.json` muss die vollständige wirksame `validData()`-Kette bestehen und unbekannte Zusatzfelder behalten.
- Abnahme: `node scripts/check.cjs` grün.

### Paket A+D — Native Kern, Projekt, CI (Claude `puls-backend`, medium)

Dateien: `ios/PULSCore/**`, `ios/PULSCoreTests/**`, `ios/project.yml`, `.github/workflows/ios-app.yml`, `ios/PULS/Web/StateBridge.swift`; in `ios/PULS/WebViewController.swift` nur: Handler `pulsState` registrieren/entfernen, Feature `stateBridge` ergänzen, `StateBridge` halten.

- `JSONValue` (verlustfrei), `ProfileDocument`, `MirrorFile` (atomar, Dateischutz), `Outbox` (persistent, idempotent), `ProfileStore` (`@Observable @MainActor`), `BridgeMessages` (Codable nach Protokoll v1).
- Deployment Target 17.0; Targets `PULSCore` (framework.static), `PULSCoreTests` (Fixtures als Ressourcen); Scheme mit Testaktion.
- CI nach `IOS_ARCHITECTURE.md`: Tests auf Simulator, IPA-Artifact für alle Branches, Release nur `main`.
- Tests: Round-Trip `profile-full.json` (semantisch gleich, unbekannte Felder erhalten, Ganzzahlen ohne `.0`); Dekodieren aller Fixtures; ungültige Nachrichten abgelehnt; Outbox überlebt Neuladen, Replay idempotent; Spiegel atomar.
- Abnahme: CI auf `native-ios` grün mit ausgeführten Tests. App-Verhalten unverändert.

### Paket C — Cloud-Client: **erst vor Phase B**, nicht in M1.

### Reviews M1

- Paket B → Claude `puls-reviewer` (high): Wirkungslosigkeit ohne Handler, Wrapper-Kette, Persistenzbestätigung, Datenintegrität.
- Paket A+D → Codex `reviewer` (medium): JSON-Verlustfreiheit, Concurrency, Dateischutz, CI-Logik (Release nur `main`).

## M2 — Körper & Gewicht (nach M1)

- Paket F (Codex): Die seit M1 vorhandenen Ops `weight.upsert`/`weight.delete` mit der nativen Körperoberfläche integrieren. Native meldet `stateBridge` + **`nativeBody`**. Die letzte wirksame `openAccountSection('body')` sendet nur nach gesendetem `hello`, ohne `ownerPending`/`activating`, `openNative {screen:'body'}` anstelle der Web-Unterseite. Vorschau/Recovery/Upload-Sperre erlauben die Weiterleitung in den lesbaren nativen Bereich. Sonst unveränderter Web-Ablauf.
  - Rückweg: `window.pulsNativeNavigate({page:'account',section:'body',web:true})` nutzt die aktuellen `go`/`openAccountSection` und umgeht die Weiterleitung nur für diese Öffnung. Maße/Körperfett bleiben in M2 Web. Unbekannte Seiten/Abschnitte ignorieren. `hello.screens:['body']` und beide Gewichts-Ops bleiben erhalten.
  - Dateibesitz: `js/native-state.js`, `tests/check-native-state.cjs`, dieser M2-Abschnitt und `NATIVE-BRIDGE-PROTOCOL.md`; neue Fixtures nur bei Bedarf. Kein `ios/`, keine Versionserhöhung, kein Commit/Push. Kontomenü ist der einzige Einstieg in die Körper-Unterseite; direkte Web-Gewichtsformulare bleiben unverändert.
  - Lokal umgesetzt: VM-Tests für Feature/Handler/Bereitschaft, Anmeldung/ungeklärte Zuordnung, lesbare Zustände, aktuellen Navigationsaufruf und auf eine Öffnung begrenzte Web-Ausnahme. `node scripts/check.cjs` vollständig grün. Browserprüfung bei 390 × 844 offen: Browser-Host in der Codex-Umgebung nicht verfügbar. Unabhängiges Review und Browser-/Geräteprüfung durch Koordinator veranlassen.
- Paket E+G (Claude `puls-frontend`): `ios/PULS/Features/Body/*`, `PULSCore/Model/WeightEntry.swift` + Tests, `ios/PULS/Shell/NativeRouter.swift`.

## M3 — Übersicht + native TabBar

### Paket H — Web-Projektion und Navigation (Codex `backend`, high)

Basis `56d64c2`, Web v74. Dateibesitz: `js/native-state.js`, neues `js/native-projection.js`, `css/native-shell.css`, zugehörige Einbindungen in `index.html`/`sw.js`, `tests/check-native-state.cjs`, ausdrücklich freigegebene Fixtures `tests/fixtures/native-bridge/*`, Protokoll und dieser M3-Abschnitt. Kein `ios/`, keine Versionserhöhung, kein Commit/Push, kein Live-Backend. Vorhandene Fremdänderung an `CLAUDE.md` erhalten.

- Additive v1-Nachricht `projection{name:'overview'}`: ausschließlich aus wirksamen Web-Providern abgeleitete Anzeigewerte und nur mit injiziertem **`nativeOverview`**. M2-IPA berechnet keine Projektion. Nutzer-/Recovery-/Preview-Grenzen wie im Vertrag. Eigene flüchtige `projectionSeq`, Tageswechsel ohne Profilsnapshot, begrenzte Details samt `omitted`, Unicode-sichere Textkürzung; keine neue Persistenz und keine Änderung bestehender IDs. `projection.seq` darf hinter Snapshot-`seq` liegen und ist kein Veraltungssignal.
- `pulsNativeSetDate(day)`, `pulsNativeNavigate({page,...})` und feste `{action,id?}`-Web-Einstiege. `navigate` meldet Tabwechsel. Die letzten Render-/Datums-/Navigationsdefinitionen werden erst nach allen Skripten beim Laden umschlossen.
- Feature `nativeTabs`: **kein** automatisches Ausblenden nach Hello. Die sichtbare native Leiste muss mit `pulsNativeSetChrome(true)` bestätigt sein; sonst bleibt Web-Chrome erhalten. `false`/`ownerPending:true`/`pagehide`/Reload widerrufen die Übernahme. Ausnahme bei `false` während einer bereits übernommenen Vollbildsession/Aktivitätsansicht: Web-Leiste bleibt nur bis Ende dieses Ablaufs ebenfalls verborgen. Danach neue Bestätigung nötig. Verbindliches Layout: WebView endet oberhalb der nativen Leiste; keine doppelte untere Safe-Area-/Web-Leistenreserve. Kleine Dock/Toast/Undo-Abstände, nur eigene Dockreserve erhalten.
- `chrome{blocking,reason,page}` meldet modal/session/run/editing/none nach Laden/Änderungen; generische Dialog-/DOM-/Focus-Erkennung plus bestehende View-States. Native deaktiviert bei Sperre Datum/Tabs/Plus und verbirgt bei **session/run** seine Tab-Leiste. Web lehnt Datums-/Seitenaufrufe synchron mit `false` ab. Actions ebenfalls blockiert, außer Quick-add schließt sein eigenes offenes Menü. `navigate` erfasst über die letzte Render-Kette auch direkte `page=...`-Änderungen ohne `go`.
- Die aktuelle `home()` enthält **keine** Direktaktion für Wasser oder Tagesabschluss. **Koordinator hat bestätigt: `water.add`/`day.complete` gehören zu M7, nicht M3.** Wasser/Mikros/Tagesabschluss bleiben Lesefelder; Aktionen bleiben im Web-Essen.
- Review-Korrekturen M1–M4/N5–N8: `hello(true)` leert Versand-Deduplizierung; nach `hello(false)` folgt selbst bei identischen Daten eine erzwungene Projektion. Referenz-/Skalarprüfung statt Berechnung bei jedem Render; Invalidierung über bestehende Speicher-/Übernahmepfade, Tag/Sprache/Darstellung/Zeitraum. Chart/Trend separat nach Snapshot-`seq`, Invalidierungsrevision, heutigem Tag, Zeitraum und Quellreferenzen gecacht; Datums-/Sprachwechsel verwenden den Cache. Keine Profilserialisierung in normalen Renders.
- Abdeckung/Schlüssel/Schema vollständig im Protokoll; Indexchart bleibt in M3 per `{page:'home',web:true}` sichtbar. Die Rohreihen stammen aus `trendData()`, keine erneute Formel in Swift. Wochenmittel vergleichen wie Web die zwei jüngsten erfassten Wochen (nicht notwendig Kalendernachbarn); existierende Zukunftsgewicht-Semantik von `weeklyWeights` bleibt erhalten.
- Lokale Prüfung: erweiterte VM-Tests mit wirklichen DS-/Drink-Wasser-Providern, shared `projection-input.json`/`projection.json` und `chrome.json`, klassisch/Baseline/manuell, Rundung, unbekannt/Null/teilbekannt/geschätzt, Browserwirkungslosigkeit, späte Wrapper, Kontowechsel/Preview, Gewichts-Ack/Cloud und bestehende Persistenz-/Konflikt-/Replay-Fälle. Review-Regressionen: abgebrochener Kontowechsel mit unverändertem Profil, Datum/Tab/Actions bei Modal/Editing/Session/Run, DOM-/Dialog-/Focus-Erkennung, explizite Chrome-Bestätigung samt Vollbild-Halt/Reload, keine Projektion ohne `nativeOverview`, Builder-/Chart-Aufrufzähler für Render/Datum/Sprache/Zeitraum/Save-Debounce, ungerade Emoji-Grenze, direktes `page=` sowie zurückliegende Projektions-`seq`. Gesamtsuite nach Korrekturen ausführen. Claudes Erstprüfung ohne schwere Fehler, Nachprüfung der Korrekturen durch Koordinator offen. Browser-/iPhone-/Swift-Integration bleibt beim Koordinator; kein Release/Commit.

### Paket I — RootTabView und OverviewView (Claude `puls-frontend`)

Native Dateibesitz vor Start durch Koordinator festlegen: `ios/PULS/Shell/RootTabView.swift`, `ios/PULS/Features/Overview/*` sowie nötige Router-/StateBridge-/BridgeMessages-Anpassungen und Tests in `PULSCore`. Keine parallelen Änderungen an H-Dateien/Fixtures. H liefert die Schnittstelle zuerst; I liest das aktuelle Protokoll und beide Projektions-Fixtures.

- Eine gemeinsame WebView bleibt in der Hierarchie; native RootTabView mit Training | Übersicht | Plus | Essen | Konto. **`nativeTabs` + `nativeOverview`** injizieren; `hello.projections/features` prüfen. Leiste erst anzeigen, dann `pulsNativeSetChrome(true)` aufrufen; bei Verstecken `false`, nach Vollbild/Rückkehr/Reload/ownerPending neue Bestätigung. Die WebView endet **oberhalb** der nativen Leiste (Native besitzt deren Safe Area). Ohne Unterstützung/aktuelle Projektion Web-Fallback. `ownerPending` und Nutzerwechsel verdecken den alten nativen Inhalt sofort. `projectionSeq` nur dokumentlokal vergleichen; eine kleinere `projection.seq` gegenüber Snapshot-`seq` ist erlaubt, kein Verwerfungsgrund.
- OverviewView zeigt projizierte Energie/Ring/Makros, Datum, letzte fünf Essen, laufende Aktivität/Workout oder erste drei Routinen/freies Training, Wochenaktivität, Gewicht. **Keine Plan-/Summen-/Trend-/Chartformeln nachbauen.** `remaining`/`energy.displayValue` direkt verwenden; unbekannte/teilbekannte Werte ausdrücklich erhalten. Zusätzliche nicht sichtbare Lesefelder nicht als ungefragte neue Features darstellen.
- Native Datum → `pulsNativeSetDate`, Tabs → Seiten-Navigation, Plus → `{action:'quickAdd'}`. `chrome.blocking` deaktiviert Datum/Tabs/Plus; bei session/run Tab-Bar verbergen und Web-Vollbild zeigen, bei modal/editing Web-Sheet/Formular sichtbar halten. Boolean-Rückgaben respektieren, keine direkte JS-Umgehung. Vor Actions WebView sichtbar machen; `navigate` ist Quelle der aktuellen Seite (nicht die gecachte `projection.overview.page`). Bei `navigate{web:true}` Web-Übersicht bis bewusster nativer Tabwahl zeigen. Verlauf und Essens-Löschen/Undo bleiben Web; M2-Body-Routing erhalten.
- Vertragsgrenze bestätigt: Wasser-/Tagesabschluss-Ops/Outbox erst **M7**. Alle existierenden Gewichts-Ops bleiben unverändert.
- Abnahme: Fixture-Decoder und Werteparität; gemeinsamer Web-/Native-Tab-/Modal-/Vollbildfluss; Reload/Cloud/Offline/ungeklärte Zuordnung; Hell/Dunkel, DE/EN, VoiceOver/Dynamic Type und 390 pt. Native Übersicht ohne Daten spätestens nach ca. 3 s mit Web-Ausweichweg. Cross-Review durch andere KI vor Integration; `CURRENT-STATE.md` und Release-Versionierung erledigt der Koordinator gesammelt.
