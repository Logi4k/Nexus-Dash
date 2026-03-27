# Desktop OTA

Nexus desktop OTA uses Tauri's updater plugin on Windows desktop only. Android is intentionally excluded from this flow and should continue to be distributed by sideloaded APKs.

## Recommended release host

Use GitHub Releases as the first OTA backend.

- App endpoint:
  - `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
- Release asset URL pattern:
  - `https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`
- In this repo, `origin` is configured as:
  - `https://github.com/Logi4k/Nexus-Dash.git`

## Required environment variables

- `TAURI_UPDATER_PUBKEY`
  - Public key used by the desktop app to verify signed updates.
- `TAURI_UPDATER_ENDPOINTS`
  - Use the GitHub `latest.json` asset URL.
  - Example:
  - `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
- One signing input for release builds:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - or `TAURI_SIGNING_PRIVATE_KEY_PATH`
- Optional:
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Helper script input:
  - `GITHUB_RELEASE_REPO=<owner>/<repo>`

If `TAURI_UPDATER_PUBKEY` or `TAURI_UPDATER_ENDPOINTS` is missing, the updater stays disabled and the Settings screen shows `Not configured`.

## Generate signing keys

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.tauri\nexus-updater.key"
```

That command prints the public key. Save it into `TAURI_UPDATER_PUBKEY`. Keep the private key outside source control.

## Example env setup

```powershell
$env:GITHUB_RELEASE_REPO="owner/repo"
$env:TAURI_UPDATER_PUBKEY="PASTE_PUBLIC_KEY_HERE"
$env:TAURI_UPDATER_ENDPOINTS="https://github.com/owner/repo/releases/latest/download/latest.json"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH="$env:USERPROFILE\.tauri\nexus-updater.key"
```

## Build signed updater artifacts

```powershell
npm run tauri build
```

When updater env vars are present, `prebuild-tauri-config.js` enables:

- `plugins.updater`
- `bundle.createUpdaterArtifacts`

## Generate `latest.json`

```powershell
npm run ota:desktop:latest
```

The script auto-detects the GitHub repo from `git origin`, or you can still override it with `--repo owner/repo`.

This writes:

- `release/latest.json`

By default it uses:

- installer:
  - `src-tauri/target/release/bundle/nsis/Nexus_<version>_x64-setup.exe`
- signature:
  - the same path plus `.sig`

You can override any part with:

- `--artifact`
- `--signature-file`
- `--signature`
- `--tag`
- `--notes`
- `--notes-file`
- `--output`

## Upload to GitHub Release

For tag `v1.0.9`, upload these assets to that GitHub release:

- `Nexus_1.0.9_x64-setup.exe`
- `Nexus_1.0.9_x64-setup.exe.sig`
- `latest.json`

The desktop app will then check:

- `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`

## `latest.json` shape

The helper script writes this structure:

```json
{
  "version": "1.0.9",
  "notes": "Release notes here",
  "pub_date": "2026-03-27T22:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://github.com/owner/repo/releases/download/v1.0.9/Nexus_1.0.9_x64-setup.exe",
      "signature": "CONTENTS_OF_SIG_FILE"
    }
  }
}
```
