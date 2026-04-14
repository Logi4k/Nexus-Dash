# Nexus v1.2.2 Release Upload Script (curl version)
# Run this from PowerShell in the project directory

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Nexus v1.2.2 — GitHub Upload           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Configuration
$owner = "Logi4k"
$repo = "Nexus-Dash"
$version = "1.2.2"
$releaseTag = "v$version"
$releaseName = "Nexus v$version"

# GitHub API endpoint
$apiUrl = "https://api.github.com/repos/$owner/$repo/releases"

# Check for GitHub token
$githubToken = $env:GITHUB_TOKEN
if (-not $githubToken) {
    Write-Host "GITHUB_TOKEN environment variable is not set." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To set it, run:" -ForegroundColor Cyan
    Write-Host "  `$env:GITHUB_TOKEN = 'your_token_here'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or create a token at: https://github.com/settings/tokens" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

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

# Headers for GitHub API
$headers = @{
    "Authorization" = "token $githubToken"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "Nexus-Upload-Script"
}

# Check if release exists
Write-Host "Checking for existing release..." -ForegroundColor Yellow
try {
    $existingRelease = Invoke-RestMethod -Uri "$apiUrl/tags/$releaseTag" -Headers $headers -Method Get
    Write-Host "Release $releaseTag already exists. Deleting it..." -ForegroundColor Yellow
    Invoke-RestMethod -Uri "$($existingRelease.url)" -Headers $headers -Method Delete
    Write-Host "✓ Deleted existing release" -ForegroundColor Green
} catch {
    Write-Host "No existing release found. Creating new one..." -ForegroundColor Gray
}

# Create release
Write-Host ""
Write-Host "Creating GitHub release $releaseTag..." -ForegroundColor Yellow
$releaseBody = @{
    tag_name = $releaseTag
    name = $releaseName
    body = "## Nexus v$version

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
The app now includes a working auto-updater. When a new version is available, you'll be prompted to update automatically."
    draft = $false
    prerelease = $false
} | ConvertTo-Json -Depth 10

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method Post -Body $releaseBody -ContentType "application/json"
    Write-Host "✓ Created release $($release.id)" -ForegroundColor Green
} catch {
    Write-Host "Failed to create release: $_" -ForegroundColor Red
    exit 1
}

# Upload files
Write-Host ""
Write-Host "Uploading files..." -ForegroundColor Yellow

$uploadUrl = $release.upload_url -replace "\{\?name,label\}", ""

# Upload NSIS installer
Write-Host "  Uploading NSIS installer..." -ForegroundColor Gray
$nsisFile = Get-Item $nsisInstaller
$nsisUploadUrl = "$uploadUrl?name=$($nsisFile.Name)"
try {
    $nsisUpload = Invoke-RestMethod -Uri $nsisUploadUrl -Headers $headers -Method Post -InFile $nsisFile.FullName -ContentType "application/octet-stream"
    Write-Host "  ✓ Uploaded $($nsisFile.Name)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to upload NSIS installer: $_" -ForegroundColor Red
}

# Upload MSI installer
Write-Host "  Uploading MSI installer..." -ForegroundColor Gray
$msiFile = Get-Item $msiInstaller
$msiUploadUrl = "$uploadUrl?name=$($msiFile.Name)"
try {
    $msiUpload = Invoke-RestMethod -Uri $msiUploadUrl -Headers $headers -Method Post -InFile $msiFile.FullName -ContentType "application/octet-stream"
    Write-Host "  ✓ Uploaded $($msiFile.Name)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to upload MSI installer: $_" -ForegroundColor Red
}

# Upload latest.json
Write-Host "  Uploading latest.json..." -ForegroundColor Gray
$jsonFile = Get-Item $latestJson
$jsonUploadUrl = "$uploadUrl?name=$($jsonFile.Name)"
try {
    $jsonUpload = Invoke-RestMethod -Uri $jsonUploadUrl -Headers $headers -Method Post -InFile $jsonFile.FullName -ContentType "application/json"
    Write-Host "  ✓ Uploaded $($jsonFile.Name)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to upload latest.json: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         Upload complete ✓                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Release URL: https://github.com/$owner/$repo/releases/tag/$releaseTag" -ForegroundColor Cyan
Write-Host ""
Write-Host "The updater should now work correctly!" -ForegroundColor Green
