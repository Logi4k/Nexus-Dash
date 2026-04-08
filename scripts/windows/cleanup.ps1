# Nexus node_modules cleanup script
# Run from Windows PowerShell as Administrator
# Then run: npm install && npm run tauri build

$ErrorActionPreference = 'SilentlyContinue'

$dir = "D:\Codex New Dash build - Copy\node_modules"

Write-Host "Stopping any running Node processes..."
Get-Process node, npm, vite, esbuild, tauri -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Removing node_modules..."
cmd /c rmdir /s /q "$dir"
Start-Sleep -Seconds 2

Write-Host "Removing package-lock.json..."
Remove-Item -LiteralPath "D:\Codex New Dash build - Copy\package-lock.json" -Force -ErrorAction SilentlyContinue

Write-Host "Verifying clean..."
if (Test-Path $dir) {
    Write-Host "STILL PRESENT - retrying..."
    Start-Sleep -Seconds 5
    cmd /c rmdir /s /q "$dir"
}

if (-not (Test-Path $dir)) {
    Write-Host "SUCCESS - node_modules deleted. Now run:"
    Write-Host "  npm install --include=optional"
    Write-Host "  npm run tauri build"
} else {
    Write-Host "FAILED - please reboot Windows and run this script again."
}
