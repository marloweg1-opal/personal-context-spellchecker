$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item -LiteralPath (Join-Path $root "src\app.js") -Destination (Join-Path $root "apps\extension\core.js") -Force
Write-Host "Synced src\app.js to apps\extension\core.js"
