@echo off
setlocal EnableDelayedExpansion
set "NDK_ROOT=%LOCALAPPDATA%\Android\Sdk\ndk"
if not exist "%NDK_ROOT%" (
  echo [android-wrappers] ERROR: NDK folder not found: %NDK_ROOT% >&2
  exit /b 1
)
for /f "delims=" %%i in ('dir /b /ad /o-n "%NDK_ROOT%" 2^>nul') do (
  set "NDK_BIN=%NDK_ROOT%\%%i\toolchains\llvm\prebuilt\windows-x86_64\bin"
  if exist "!NDK_BIN!\i686-linux-android24-clang.cmd" goto run
)
echo [android-wrappers] ERROR: i686-linux-android24-clang.cmd not found under %NDK_ROOT% >&2
exit /b 1
:run
call "!NDK_BIN!\i686-linux-android24-clang.cmd" %*
