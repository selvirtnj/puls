<#
  PULS-Brücke: Claude Code (Koordinator) gibt Gemini (Antigravity CLI `agy`) einen Auftrag und bekommt die Antwort zurück.
  Läuft lokal mit Selvirs Google-Konto (Abo-Kontingent). Veröffentlicht nichts.

  Beispiele:
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gemini-bridge.ps1 -Role reviewer -Effort high -Task "..."
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gemini-bridge.ps1 -Resume <conversation-id> -Task "Rückfrage ..."

  Ausgabe: GEMINI_THREAD=<id>, danach die Antwort.
  Exit 0 = Antwort da, 2 = Gemini nicht verfügbar (Limit/Login/fehlende CLI) -> andere KI übernimmt, 1 = sonstiger Fehler.
#>
param(
  [ValidateSet('frontend', 'backend', 'reviewer', 'general')]
  [string]$Role = 'general',
  [string]$Task,
  [string]$TaskFile,
  [ValidateSet('low', 'medium', 'high', 'xhigh')]
  [string]$Effort = 'medium',
  [string]$Model,
  [switch]$Write,
  [string]$Resume,
  [int]$TimeoutSeconds = 1200
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

$repo = Split-Path -Parent $PSScriptRoot

if ($TaskFile) { $Task = [IO.File]::ReadAllText((Resolve-Path $TaskFile), $utf8) }
if (-not $Task) { Write-Output 'Fehler: -Task oder -TaskFile fehlt.'; exit 1 }

$agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
if (-not (Test-Path $agy)) { Write-Output 'GEMINI_UNAVAILABLE: agy.exe nicht gefunden (Antigravity CLI installiert?).'; exit 2 }

# Verfügbare Stufen: gemini-3.8-flash-low|medium|high (agy models). xhigh nutzt high mit mehr Denkaufwand.
if (-not $Model) { $Model = "gemini-3.8-flash-$(if ($Effort -eq 'xhigh') { 'high' } else { $Effort })" }
# plan = nur lesen und planen; accept-edits = Dateiänderungen erlaubt, Befehle weiter nur mit Freigabe (headless: abgelehnt).
$mode = if ($Write -and $Role -ne 'reviewer') { 'accept-edits' } else { 'plan' }

$prompt = $Task
if (-not $Resume) {
  $roleText = ''
  if ($Role -ne 'general') {
    $toml = [IO.File]::ReadAllText((Join-Path $repo ".codex\agents\puls_$Role.toml"), $utf8)
    if ($toml -match "(?s)developer_instructions = '''(.*?)'''") { $roleText = $Matches[1].Trim() }
  }
  $prompt = @"
Du arbeitest im PULS-Team (Claude Code koordiniert, dazu Codex und du, Gemini). Der Koordinator hat dir diesen Auftrag gegeben und liest deine Antwort.
Selvir sieht diese Unterhaltung nicht. Stelle Rückfragen an den Koordinator am Ende deiner Antwort unter "RÜCKFRAGEN:".
Regeln: AGENTS.md und docs/AI-TEAM.md. Kein Commit, kein Push, keine Live-Backend-Änderung, nichts unter ios/ ändern.
Modus: $mode. Du hast KEINE Terminal-Befehle (sie werden automatisch abgelehnt): nutze nur Werkzeuge zum Lesen/Suchen von Dateien$(if ($mode -eq 'accept-edits') { ' und zum Bearbeiten von Dateien' }). Diffs und Testergebnisse liefert dir der Koordinator im Auftrag mit.

$roleText

AUFTRAG:
$Task
"@
}

# Langer Auftrag als Datei: PowerShell 5.1 gibt Anführungszeichen in nativen Argumenten nicht zuverlässig weiter.
$logDir = Join-Path $env:TEMP 'puls-gemini'
New-Item -ItemType Directory -Force $logDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$promptFile = Join-Path $logDir "$stamp-$Role-auftrag.md"
$outFile = Join-Path $logDir "$stamp-$Role.json"
[IO.File]::WriteAllText($promptFile, $prompt, $utf8)
$short = "Lies die Datei $promptFile vollständig und erledige den Auftrag darin. Antworte auf Deutsch."

$agyArgs = @('-p', $short, '--output-format', 'json', '--model', $Model, '--effort', $Effort, '--mode', $mode,
  '--add-dir', $logDir, '--print-timeout', "$($TimeoutSeconds)s")
if ($Resume) { $agyArgs += @('--conversation', $Resume) }

Push-Location $repo
$ErrorActionPreference = 'Continue'
try {
  $raw = (& $agy @agyArgs 2>&1 | ForEach-Object { "$_" }) -join "`n"
} finally {
  Pop-Location
  $ErrorActionPreference = 'Stop'
}
[IO.File]::WriteAllText($outFile, $raw, $utf8)

$json = $null
$start = $raw.IndexOf('{"conversation_id"')
if ($start -ge 0) {
  try { $json = $raw.Substring($start) | ConvertFrom-Json } catch { $json = $null }
}

if ($json -and $json.conversation_id) { Write-Output "GEMINI_THREAD=$($json.conversation_id)" }
elseif ($Resume) { Write-Output "GEMINI_THREAD=$Resume" }

if ($json -and $json.status -eq 'SUCCESS') {
  Write-Output $json.response
  exit 0
}

$msg = if ($json -and $json.response) { $json.response } else { $raw }
$unavailable = $msg -match 'quota|rate limit|usage limit|exhausted|429|log ?in|sign ?in|auth|credits'
Write-Output "$(if ($unavailable) { 'GEMINI_UNAVAILABLE' } else { 'GEMINI_ERROR' }): $($msg.Substring(0, [Math]::Min(500, $msg.Length)))"
Write-Output "Log: $outFile"
if ($unavailable) { exit 2 } else { exit 1 }
