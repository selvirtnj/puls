# PULS — Fortschritt der nativen Umstellung

## 26.10.2026

- Auftrag von Selvir: native SwiftUI-App; Web-App parallel live; schrittweise Umstellung.
- Zwei unabhängige Analysen (Claude-Planagent, Codex) abgeschlossen und zusammengeführt: [NATIVE_MIGRATION_PLAN.md](NATIVE_MIGRATION_PLAN.md), [IOS_ARCHITECTURE.md](IOS_ARCHITECTURE.md), [NATIVE-BRIDGE-PROTOCOL.md](NATIVE-BRIDGE-PROTOCOL.md), [FEATURE_PARITY_CHECKLIST.md](FEATURE_PARITY_CHECKLIST.md).
- Codex-Brücke (`scripts/codex-bridge.ps1`) repariert: stderr-Warnungen brechen nicht mehr ab (Commit `5dc74cd` auf `main`, lokal).
- Arbeitsbranch `native-ios` angelegt (Basis `5dc74cd`, Web-Version 73, iOS-Projektversion 1.7).
- Gemeinsame Fixtures: `tests/fixtures/native-bridge/`.

## Nächste Schritte

1. M1 parallel: Paket B (Codex, Web-Seite) und Paket A+D (Claude, PULSCore/CI/StateBridge) nach [AGENT_TASKS.md](AGENT_TASKS.md).
2. Kreuz-Review, `node scripts/check.cjs`, CI auf `native-ios` grün mit Tests.
3. Branch-IPA auf Selvirs iPhone: App unverändert, Spiegel wird geschrieben.
4. M2 Körper & Gewicht.

## Nicht verifiziert / offen

- Kein iOS-Build und kein Test auf Gerät bisher.
- Selvirs iPhone-iOS-Version (Mindestziel wird 17.0) noch zu bestätigen.
- Web-Regel „ein Gewicht pro Tag“ beim Implementieren von `weight.upsert` im Code verifizieren.
