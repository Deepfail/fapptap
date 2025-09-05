Param(
  [switch]$NoStart
)

Write-Host '--- FAPPTap Dev Environment Reset ---'

Write-Host 'Stopping node / cargo / tauri processes...'
Get-Process -Name cargo,tauri,node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host 'Removing stale dist and target artifacts...'
Remove-Item -Recurse -Force "$PSScriptRoot\..\dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$PSScriptRoot\..\src-tauri\target" -ErrorAction SilentlyContinue

Write-Host 'Clearing WebView2 cache if present (best-effort)...'
$wv1 = Join-Path $env:LOCALAPPDATA 'fapptap-ui'
$wv2 = Join-Path $env:LOCALAPPDATA 'fapptap'
foreach($p in @($wv1,$wv2)) { if (Test-Path $p) { Write-Host " Removing $p"; Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue } }

Write-Host 'Ensuring Vite dev server will bind to port 1420...'
$env:PORT = '1420'

if (-not $NoStart) {
  Write-Host 'Starting Vite dev server (foreground). Launch another shell for `npm run tauri dev`.'
  npm run dev
} else {
  Write-Host 'Skipped starting dev server due to -NoStart.'
}