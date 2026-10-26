<#
  PULS-Brücke: Claude Code (Koordinator) gibt Codex einen Auftrag und bekommt die Antwort zurück.
  Läuft lokal über die Codex-CLI der Codex-Desktop-App. Veröffentlicht nichts.

  Beispiele:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-bridge.ps1 -Role backend -Effort medium -Write -Task "..."
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-bridge.ps1 -Role reviewer -Effort high -TaskFile auftrag.md
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/codex-bridge.ps1 -Resume <thread-id> -Task "Rückfrage ..."

  Ausgabe: CODEX_THREAD=<id>, danach die letzte Codex-Nachricht.
  Exit 0 = Antwort da, 2 = Codex nicht verfügbar (Limit/Login/fehlende CLI) -> Claude übernimmt, 1 = sonstiger Fehler.
#>
param(
  [ValidateSet('frontend', 'backend', 'reviewer', 'general')]
  [string]$Role = 'general',
  [string]$Task,
  [string]$TaskFile,
  [ValidateSet('low', 'medium', 'high', 'xhigh')]
  [string]$Effort = 'medium',
  [string]$Model = 'gpt-6.1-sol',
  [switch]$Write,
  [string]$Resume
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$repo = Split-Path -Parent $PSScriptRoot

if ($TaskFile) { $Task = [IO.File]::ReadAllText((Resolve-Path $TaskFile), $utf8) }
if (-not $Task) { Write-Output 'Fehler: -Task oder -TaskFile fehlt.'; exit 1 }

$cx = Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin\*\codex.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $cx) { Write-Output 'CODEX_UNAVAILABLE: codex.exe nicht gefunden (Codex-Desktop-App installiert?).'; exit 2 }

# Prüfer arbeitet immer lesend; Entwickler nur mit -Write schreibend.
$sandbox = if ($Write -and $Role -ne 'reviewer') { 'workspace-write' } else { 'read-only' }

$prompt = $Task
if (-not $Resume) {
  $roleText = ''
  if ($Role -ne 'general') {
    $toml = [IO.File]::ReadAllText((Join-Path $repo ".codex\agents\puls_$Role.toml"), $utf8)
    if ($toml -match "(?s)developer_instructions = '''(.*?)'''") { $roleText = $Matches[1].Trim() }
  }
  $prompt = @"
Du arbeitest im PULS-Team. Koordinator ist Claude Code; er hat dir diesen Auftrag gegeben und liest deine Antwort.
Selvir sieht diese Unterhaltung nicht. Stelle Rückfragen an den Koordinator am Ende deiner Antwort unter "RÜCKFRAGEN:".
Regeln: AGENTS.md und docs/AI-TEAM.md. Kein Commit, kein Push, keine Live-Backend-Änderung.
Sandbox: $sandbox.

$roleText

AUFTRAG:
$Task
"@
}

$logDir = Join-Path $env:TEMP 'puls-codex'
New-Item -ItemType Directory -Force $logDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$lastMsg = Join-Path $logDir "$stamp-$Role.txt"
$events = Join-Path $logDir "$stamp-$Role.jsonl"

$common = @('--json', '-m', $Model, '-c', "model_reasoning_effort=`"$Effort`"", '-c', "sandbox_mode=`"$sandbox`"", '-o', $lastMsg)
if ($Resume) {
  $cxArgs = @('exec', 'resume') + $common + @($Resume, '-')
} else {
  $cxArgs = @('exec', '-C', $repo) + $common + @('-')
}

$ErrorActionPreference = 'Continue'
$prompt | & $cx.FullName @cxArgs 2>$null | Tee-Object -FilePath $events | Out-Null
$ErrorActionPreference = 'Stop'

$log = if (Test-Path $events) { Get-Content $events -Encoding utf8 } else { @() }
$thread = ($log | Select-String '"thread_id":"([^"]+)"' | Select-Object -First 1).Matches.Groups[1].Value
if ($thread) { Write-Output "CODEX_THREAD=$thread" } elseif ($Resume) { Write-Output "CODEX_THREAD=$Resume" }

$err = $log | Select-String '"type":"(turn\.failed|error)"' | Select-Object -Last 1
if ($err -and -not (Test-Path $lastMsg)) {
  $msg = if ($err.Line -match '"message":"([^"]+)"') { $Matches[1] } else { $err.Line }
  $unavailable = $msg -match 'usage limit|rate limit|log ?in|auth|quota'
  Write-Output "$(if ($unavailable) { 'CODEX_UNAVAILABLE' } else { 'CODEX_ERROR' }): $msg"
  Write-Output "Log: $events"
  if ($unavailable) { exit 2 } else { exit 1 }
}

if (Test-Path $lastMsg) {
  Get-Content $lastMsg -Encoding utf8
  exit 0
}
Write-Output "CODEX_ERROR: keine Antwort. Log: $events"
exit 1
