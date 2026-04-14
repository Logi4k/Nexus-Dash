# Nexus v1.2.2 Release Upload Script
# Run this from PowerShell in the project directory

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Nexus v1.2.2 — GitHub Upload           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if gh CLI is installed
$ghInstalled = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghInstalled) {
    Write-Host "GitHub CLI is not installed. Installing..." -ForegroundColor Yellow
    winget install GitHub.cli
    Write-Host "Please restart PowerShell and run this script again." -ForegroundColor Green
    exit 0
}

# Check if authenticated
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "You need to authenticate with GitHub first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run this command to authenticate:" -ForegroundColor Cyan
    Write-Host "  gh auth login" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or set a GitHub token:" -ForegroundColor Cyan
    Write-Host "  `$env:GITHUB_TOKEN = 'your_token_here'" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Set variables
$version = "1.2.2"
$releaseTag = "v$version"
$releaseName = "Nexus v$version"

# File paths
$nsisInstaller = "src-tauri\target\release\bundle\nsis\Nexus_1.2.2_x64-setup.exe"
$msiInstaller = "src-tauri\target\release\bundle\msi\Nexus_1.2.2_x64_en-US.msi"
$latestJson = "src-tauri\target\release\bundle\latest.json"

# Check if files exist
Write-Host "Checking files..." -ForegroundColor Yellow
if (-not (Test-Path $nsisInstaller)) {
    Write-Host "NSIS installer not found: $nsisInstaller" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $msiInstaller)) {
    Write-Host "MSI installer not found: $msiInstaller" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $latestJson)) {
    Write-Host "latest.json not found: $latestJson" -ForegroundColor Red
    exit 1
}

Write-Host "✓ All files found" -ForegroundColor Green
Write-Host ""

# Create release
Write-Host "Creating GitHub release $releaseTag..." -ForegroundColor Yellow
gh release create $releaseTag `
    --title $releaseName `
    --notes "## Nexus v$version

### Fixes
- Fixed Tauri updater error: 'None of the fallback platforms were found'
- Added missing platform keys to latest.json
- Enabled updater artifacts generation
- Added proper signatures for installer files

### Changes
- Updated store.ts to prevent seed data from overwriting cloud data
- Added protection for user data in Supabase
- Fixed date conversion issues in bank statement imports
- Separated prop firm expenses from general expenses

### Downloads
- **Windows NSIS Installer**: Nexus_1.2.2_x64-setup.exe
- **Windows MSI Installer**: Nexus_1.2.2_x64_en-US.msi
- **Update Manifest**: latest.json

### Installation
1. Download the installer for your platform
2. Run the installer
3. The app will automatically check for updates on startup

### Updater
The app now includes a working auto-updater. When a new version is available, you'll be prompted to update automatically." `
    --prerelease

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to create release. It may already exist." -ForegroundColor Yellow
    Write-Host "Trying to upload to existing release..." -ForegroundColor Yellow
}

# Upload files
Write-Host ""
Write-Host "Uploading files..." -ForegroundColor Yellow

Write-Host "  Uploading NSIS installer..." -ForegroundColor Gray
gh release upload $releaseTag $nsisInstaller --clobber

Write-Host "  Uploading MSI installer..." -ForegroundColor Gray
gh release upload $releaseTag $msiInstaller --clobber

Write-Host "  Uploading latest.json..." -ForegroundColor Gray
gh release upload $releaseTag $latestJson --clobber

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║         Upload complete ✓                  ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "Release URL: https://github.com/Logi4k/Nexus-Dash/releases/tag/$releaseTag" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The updater should now work correctly!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Upload failed. Please check your permissions." -ForegroundColor Red
    exit 1
}
