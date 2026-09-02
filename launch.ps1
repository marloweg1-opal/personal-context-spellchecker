$ErrorActionPreference = "Stop"

param(
    [int]$Port = 8765
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

$selectedPort = $Port
while ($selectedPort -lt ($Port + 10)) {
    $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $selectedPort -ErrorAction SilentlyContinue
    if (-not $listener) {
        break
    }
    $selectedPort += 1
}

if ($selectedPort -ge ($Port + 10)) {
    throw "No available local port found from $Port to $($Port + 9)."
}

Write-Host "Starting Personal Contextual Spellchecker at http://127.0.0.1:$selectedPort/index.html"
Write-Host "This does not require administrator privileges. Press Ctrl+C to stop."

python -m http.server $selectedPort --bind 127.0.0.1
