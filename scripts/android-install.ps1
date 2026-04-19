# Install the latest release APK onto a USB-connected device (adb).
# Prereqs: USB debugging on phone, authorize this PC, Android SDK platform-tools.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
  $adb = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
}
if (-not (Test-Path $adb)) {
  throw "adb.exe not found. Install Android SDK Platform-Tools or set ANDROID_HOME."
}

$gen = Join-Path $repoRoot "src-tauri\gen\android"
if (-not (Test-Path $gen)) {
  throw "No src-tauri/gen/android — run npm run android:build first."
}

$apk = Get-ChildItem -Path $gen -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match "release" -and $_.FullName -notmatch "unsigned" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $apk) {
  $apk = Get-ChildItem -Path $gen -Recurse -Filter "*.apk" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

if (-not $apk) {
  throw "No APK found under $gen"
}

Write-Host "Using APK: $($apk.FullName)"
& $adb devices
& $adb install -r $apk.FullName
