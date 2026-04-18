#!/usr/bin/env node
/**
 * Generate latest.json for Tauri v2 desktop OTA updates.
 *
 * Discovers the NSIS installer and its .sig file from the build output,
 * then writes a release manifest compatible with the Tauri updater plugin.
 *
 * Usage:
 *   npm run ota:desktop:latest -- [--repo owner/repo] [--version X.Y.Z] [other options]
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
const nsisDir = path.join(root, "src-tauri", "target", "release", "bundle", "nsis");
const msiDir = path.join(root, "src-tauri", "target", "release", "bundle", "msi");

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
function readArg(name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1] ?? null;
}

function detectGitRepo() {
  try {
    const url = execSync("git remote get-url origin", {
      cwd: root, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8"
    }).trim();
    return url.match(/github\.com[:/](.+?)(?:\.git)?$/i)?.[1] ?? null;
  } catch { return null; }
}

function findFile(dir, suffix) {
  if (!fs.existsSync(dir)) return null;
  const matches = fs.readdirSync(dir).filter(f => f.endsWith(suffix));
  return matches.length > 0 ? path.join(dir, matches[0]) : null;
}

function readSignatureForArtifact(artifactPath, required = true) {
  const sigPath = `${artifactPath}.sig`;
  if (fs.existsSync(sigPath)) {
    const signature = fs.readFileSync(sigPath, "utf8").trim();
    if (!signature) fail(`Signature is empty: ${sigPath}`);
    return signature;
  }

  if (required) {
    fail(
      `Signature file not found for ${path.basename(artifactPath)}.\n` +
      `Expected ${sigPath}.\n` +
      `Ensure TAURI_SIGNING_PRIVATE_KEY is set so Tauri produces .sig files, or pass --signature.`
    );
  }

  return null;
}

const version = readArg("--version") || tauriConfig.version;
const tag = readArg("--tag") || `v${version}`;
const repo = readArg("--repo") || process.env.GITHUB_RELEASE_REPO || detectGitRepo();
if (!repo) fail("Missing --repo (owner/repo)");

// Discover NSIS installer
const expectedName = `${tauriConfig.productName}_${version}_x64-setup.exe`;
const expectedPath = path.join(nsisDir, expectedName);
const artifactPath = path.resolve(
  readArg("--artifact") ||
  (fs.existsSync(expectedPath) ? expectedPath : null) ||
  findFile(nsisDir, "-setup.exe") ||
  expectedPath
);
const artifactName = path.basename(artifactPath);

if (!readArg("--asset-url") && !fs.existsSync(artifactPath)) {
  const contents = fs.existsSync(nsisDir) ? fs.readdirSync(nsisDir).join(", ") : "(missing)";
  fail(`Installer not found: ${artifactPath}\nNSIS dir contents: ${contents}`);
}

// Discover signature
let signature = readArg("--signature");
if (!signature) signature = readSignatureForArtifact(artifactPath, true);
if (!signature) fail("Signature is empty");

const assetUrl = readArg("--asset-url") || `https://github.com/${repo}/releases/download/${tag}/${artifactName}`;
const notes = readArg("--notes") || "";
const pubDate = readArg("--pub-date") || new Date().toISOString();
const outputPath = path.resolve(readArg("--output") || path.join(root, "release", "latest.json"));
const platforms = {
  "windows-x86_64-nsis": { url: assetUrl, signature },
};

const expectedMsiName = `${tauriConfig.productName}_${version}_x64_en-US.msi`;
const expectedMsiPath = path.join(msiDir, expectedMsiName);
const msiPath =
  (fs.existsSync(expectedMsiPath) ? expectedMsiPath : null) ||
  findFile(msiDir, ".msi");

if (msiPath) {
  const msiSignature = readSignatureForArtifact(msiPath, false);
  if (msiSignature) {
    const msiName = path.basename(msiPath);
    platforms["windows-x86_64-msi"] = {
      url: `https://github.com/${repo}/releases/download/${tag}/${msiName}`,
      signature: msiSignature,
    };
  } else {
    console.warn(`Skipping MSI updater platform because ${path.basename(msiPath)} has no .sig file.`);
  }
}

const manifest = {
  version,
  notes,
  pub_date: pubDate,
  platforms,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`✓ Wrote ${outputPath}`);
console.log(`  Version:    ${version}`);
console.log(`  Platforms:  ${Object.keys(platforms).join(", ")}`);
console.log(`  Installer:  ${artifactName}`);
console.log(`  URL:        ${assetUrl}`);
console.log(`  Endpoint:   https://github.com/${repo}/releases/latest/download/latest.json`);
