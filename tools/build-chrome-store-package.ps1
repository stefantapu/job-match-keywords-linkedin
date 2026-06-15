$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $root "dist\chrome-web-store"
$packageDir = Join-Path $distDir "package"
$manifest = Get-Content -LiteralPath (Join-Path $root "manifest.json") | ConvertFrom-Json
$zipPath = Join-Path $distDir "linkedin-job-match-keywords-$($manifest.version).zip"

if (Test-Path $packageDir) {
  Remove-Item -LiteralPath $packageDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

$files = @(
  "manifest.json",
  "content.js",
  "styles.css",
  "popup.html",
  "popup.css",
  "popup.js"
)

foreach ($file in $files) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination (Join-Path $packageDir $file)
}

Copy-Item -LiteralPath (Join-Path $root "icons") -Destination (Join-Path $packageDir "icons") -Recurse

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $zipPath -Force

Write-Host "Built Chrome Web Store package:"
Write-Host $zipPath
