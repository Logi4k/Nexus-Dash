# Prep PATH so native crates (e.g. ring) find Android NDK clang + unversioned wrappers.
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/android-build.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$wrappers = Join-Path $repoRoot "tools\android-wrappers"
if (-not (Test-Path $wrappers)) {
  throw "Missing tools/android-wrappers (expected at $wrappers)"
}

$ndkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk\ndk"
if (-not (Test-Path $ndkRoot)) {
  throw "Android NDK not found at $ndkRoot (install NDK via Android Studio SDK Manager)."
}

$ndkHome = Get-ChildItem $ndkRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
$ndkBin = Join-Path $ndkHome.FullName "toolchains\llvm\prebuilt\windows-x86_64\bin"
if (-not (Test-Path $ndkBin)) {
  throw "NDK LLVM bin not found: $ndkBin"
}

$env:PATH = "$wrappers;$ndkBin;$env:PATH"
Write-Host "PATH prepended: wrappers + $ndkBin"

# Tauri copies the Rust library into jniLibs via a symbolic link. Without
# Developer Mode (or SeCreateSymbolicLinkPrivilege), Windows blocks this and
# the build fails after `cargo` succeeds. Fail fast with a clear message.
$symlinkOk = $false
try {
  $t = Join-Path ([System.IO.Path]::GetTempPath()) ("nexus-symlink-target-{0}.txt" -f ([guid]::NewGuid().ToString("n")))
  $l = Join-Path ([System.IO.Path]::GetTempPath()) ("nexus-symlink-link-{0}.txt" -f ([guid]::NewGuid().ToString("n")))
  "ok" | Out-File -FilePath $t -Encoding utf8
  New-Item -ItemType SymbolicLink -Path $l -Target $t -Force | Out-Null
  Remove-Item $l, $t -Force -ErrorAction SilentlyContinue
  $symlinkOk = $true
} catch {
  Write-Host ""
  Write-Host "Windows blocked creating a test symbolic link." -ForegroundColor Yellow
  Write-Host "Enable Developer Mode, then re-run this script:" -ForegroundColor Yellow
  Write-Host "  Settings -> Privacy & security -> For developers -> Developer Mode -> On" -ForegroundColor Yellow
  Write-Host "Then reboot if the build still fails." -ForegroundColor Yellow
  Write-Host ""
  throw "Symlinks are required for `tauri android build` on Windows. Enable Developer Mode (see above)."
}

Push-Location $repoRoot
try {
  if ($args.Count -gt 0) {
    npx tauri android build @args
  } else {
    npx tauri android build
  }
} finally {
  Pop-Location
}
