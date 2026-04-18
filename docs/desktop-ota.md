# Desktop OTA

Nexus desktop OTA uses Tauri's updater plugin on Windows desktop only. Android is intentionally excluded from this flow and should continue to be distributed by sideloaded APKs.

## Overview

Releases are automated via GitHub Actions. When you push a version tag (`v*`), the workflow:
1. Builds the Tauri app with signing enabled
2. Generates `latest.json` with artifact-specific signatures
3. Uploads all artifacts to the GitHub Release

**No manual build steps required for releases.**

---

## One-Time Setup (GitHub Secrets)

You need to add one GitHub Secret to your repository:

1. Go to **Settings → Secrets and variables → Actions** in your GitHub repo
2. Add a new **Repository secret** named: `TAURI_SIGNING_PRIVATE_KEY`
3. Paste the entire contents of your private key file (`~/.tauri/nexus-updater.key`)

To get the key content, run:
```bash
cat ~/.tauri/nexus-updater.key
```

The public key is already committed in `tauri.conf.json`:
```
dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEU2MTc3QzBERkUxNjI4QTcKUldTbktCYitEWHdYNXJkWTV4R0x5KzdmS3o5TU5QTEVOaVluZmRtTVEwcTF0QU9uZjB2RjliLzMK
```

---

## Release Process

### 1. Update version in `src-tauri/Cargo.toml` and `package.json`

Both files must have the same version number:
```toml
# src-tauri/Cargo.toml
[package]
version = "1.2.6"
```

```json
// package.json
{
  "version": "1.2.6"
}
```

### 2. Commit and tag

```bash
git add -A
git commit -m "Release 1.2.6"
git tag v1.2.6
git push && git push --tags
```

### 3. Wait for the workflow

The GitHub Actions workflow will:
- Build `Nexus_1.2.6_x64-setup.exe` and, when enabled, the MSI bundle
- Sign each updater artifact and produce matching `.sig` files
- Generate `latest.json`
- Publish a GitHub release with the installer artifacts and `latest.json`

### 4. Verify the release

Go to your GitHub repo's **Releases** page and confirm the release has `latest.json` plus every distributed installer and matching `.sig`.

---

## Manual Release (if GitHub Actions fails)

If the automated workflow fails, you can build manually:

### 1. Set up local environment

```powershell
# Set environment variables
$env:TAURI_SIGNING_PRIVATE_KEY_PATH="$env:USERPROFILE\.tauri\nexus-updater.key"
$env:TAURI_UPDATER_PUBKEY="dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEU2MTc3QzBERkUxNjI4QTcKUldTbktCYitEWHdYNXJkWTV4R0x5KzdmS3o5TU5QTEVOaVluZmRtTVEwcTF0QU9uZjB2RjliLzMK"
$env:TAURI_UPDATER_ENDPOINTS="https://github.com/Logi4k/Nexus-Dash/releases/latest/download/latest.json"
```

### 2. Build

```powershell
npm run tauri build
```

### 3. Generate latest.json

```powershell
npm run ota:desktop:latest -- --repo Logi4k/Nexus-Dash --version 1.2.6
```

### 4. Upload

Upload these files to your GitHub release:
- `src-tauri/target/release/bundle/nsis/Nexus_1.2.6_x64-setup.exe`
- `src-tauri/target/release/bundle/nsis/Nexus_1.2.6_x64-setup.exe.sig`
- `src-tauri/target/release/bundle/msi/*.msi` and matching `.sig` files, if you distribute MSI
- `release/latest.json`

---

## Verifying the Setup

After the first GitHub Actions release, check that:

1. The release has `latest.json` plus each installer and its matching `.sig`
2. The `latest.json` contains a valid `signature` field for each distributed platform
3. The Settings → Desktop Updates section shows "Up to date" on the new version

---

## Troubleshooting

**"Not configured" shows in Settings:**
- `TAURI_SIGNING_PRIVATE_KEY` GitHub Secret is missing
- Or the private key doesn't match the committed public key

**Signature verification fails:**
- The public key in GitHub Secret doesn't match the private key used to sign
- Regenerate keys: `npx tauri signer generate -w "$env:USERPROFILE\.tauri\nexus-updater.key"`

**404 on update check:**
- The `latest.json` hasn't been uploaded to the GitHub release yet
- Or the release is still a draft

---

## Regenerating Signing Keys

If you need to regenerate the signing key pair:

```powershell
npx tauri signer generate -w "$env:USERPROFILE\.tauri\nexus-updater.key"
```

This generates a new `nexus-updater.key` (private) and `nexus-updater.key.pub` (public).

**Important:** After regenerating, you must:
1. Update `TAURI_UPDATER_PUBKEY` in GitHub Secrets with the new public key
2. Update `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`
3. Rebuild and release

Old releases signed with the previous key will fail signature verification on update.
