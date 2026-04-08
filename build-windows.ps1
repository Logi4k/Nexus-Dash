# Nexus Build Script — Run from Windows PowerShell
# Usage: Open PowerShell, navigate to "D:\Codex New Dash build - Copy" and run:
# .\build-windows.ps1
#
# Prerequisites needed:
#   - Rust: cargo 1.94+ (check: cargo --version)
#   - Node.js 18+ (check: node --version)
#   - cargo-tauri CLI (auto-installed if missing)
#   - NSIS installer (auto-installed via WSL or manual)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Nexus v1.2.0 — Windows Build           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$projectDir = "D:\Codex New Dash build - Copy"
Set-Location $projectDir

# ────────────────────────────────────────────────────────
# Step 1 — Install cargo-tauri CLI if missing
# ────────────────────────────────────────────────────────
$cargoTauri = cargo tauri --version 2>$null
if (-not $cargoTauri) {
    Write-Host "[1/3] Installing cargo-tauri CLI..." -ForegroundColor Yellow
    cargo install tauri-cli --version 2.10.1
    Write-Host "        cargo-tauri installed ✓" -ForegroundColor Green
}
$cargoTauri = cargo tauri --version
Write-Host "[1/3] cargo-tauri: $cargoTauri ✓" -ForegroundColor Green

# ────────────────────────────────────────────────────────
# Step 2 — Windows Desktop Build
# ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Building Windows installer..." -ForegroundColor Yellow
Write-Host "        This will:" -ForegroundColor Gray
Write-Host "          • Build the Vite frontend" -ForegroundColor Gray
Write-Host "          • Compile Rust for Windows" -ForegroundColor Gray
Write-Host "          • Generate NSIS .exe installer" -ForegroundColor Gray
Write-Host ""

cargo tauri build

if ($LASTEXITCODE -eq 0) {
    Write-Host "[2/3] Windows build complete ✓" -ForegroundColor Green
    
    # Show output location
    $bundlePath = "$projectDir\src-tauri\target\release\bundle"
    if (Test-Path "$bundlePath\nsis") {
        $nsis = Get-ChildItem "$bundlePath\nsis\*.exe" -Recurse
        if ($nsis) {
            Write-Host "        Installer: $($nsis.FullName)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[2/3] Windows build failed ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  • Install Visual Studio Build Tools 2022 with MSVC" -ForegroundColor Gray
    Write-Host "    https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Gray
    Write-Host "  • Run 'rustup default stable-msvc' to use MSVC toolchain" -ForegroundColor Gray
    Write-Host "  • Delete 'src-tauri/target' and retry" -ForegroundColor Gray
    exit 1
}

# ────────────────────────────────────────────────────────
# Step 3 — Android Build
# ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Building Android APK..." -ForegroundColor Yellow

# Check Android SDK
$androidSdk = "$env:LOCALAPPDATA\Android\Sdk"
$androidNdk = Join-Path $androidSdk "ndk\30.0.14904198"
$javaHome = "C:\Program Files\Java\jdk-17"

# Create local.properties for Gradle
$localProps = "$projectDir\src-tauri\gen\android\local.properties"
$sdkDir = $androidSdk.Replace('\', '/')
$ndkDir = $androidNdk.Replace('\', '/')
"ndk.dir=$sdkDir/ndk/30.0.14904198" + "`n" + "sdk.dir=" + $sdkDir | Set-Content -Path $localProps -Encoding UTF8
Write-Host "        Created local.properties for Gradle" -ForegroundColor Gray

Write-Host ""
Write-Host "        Building Android APK (this may take 5-10 minutes)..." -ForegroundColor Gray
cargo tauri android build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[3/3] Android build complete ✓" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[3/3] Android build failed ✗" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "  • Install Android SDK Build-Tools 35 from Android Studio SDK Manager" -ForegroundColor Gray
    Write-Host "  • Install NDK 30.0.14904198 from Android Studio SDK Manager" -ForegroundColor Gray
    Write-Host "  • Set JAVA_HOME to JDK 17 path" -ForegroundColor Gray
    Write-Host "  • Delete 'src-tauri/gen/android' and run 'cargo tauri android init' to regenerate" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         All builds complete ✓              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Output files:" -ForegroundColor Cyan
Write-Host "  Windows: src-tauri\target\release\bundle\nsis\Nexus_1.2.0_x64-setup.exe" -ForegroundColor Gray
Write-Host "  Android: src-tauri\gen\android\app\build\outputs\apk\universal\release\" -ForegroundColor Gray
