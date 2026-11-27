# Builds Lyre and puts the app and installers in .\release (so this folder's copy is always the newest).
$ErrorActionPreference = 'Stop'
# updater artifacts must be signed; the key lives outside the repo (also stored as a GitHub secret)
if (-not $env:TAURI_SIGNING_PRIVATE_KEY) { $env:TAURI_SIGNING_PRIVATE_KEY = "$HOME\.tauri\lyre.key"; $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '' }
Push-Location "$PSScriptRoot\src-tauri"
try { npx --yes '@tauri-apps/cli@^2' build; if ($LASTEXITCODE) { exit $LASTEXITCODE } } finally { Pop-Location }
$t = "$PSScriptRoot\src-tauri\target\release"
$out = New-Item -ItemType Directory -Force "$PSScriptRoot\release"
Copy-Item "$t\lyre.exe" "$out\Lyre.exe" -Force
Copy-Item "$t\bundle\nsis\Lyre_*-setup.exe", "$t\bundle\msi\Lyre_*.msi" $out -Force
Write-Host "Updated $out"
