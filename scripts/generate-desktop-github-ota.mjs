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

const version = readArg("--version") || tauriConfig.version;
const tag = readArg("--tag") || `v${version}`;
const repo = readArg("--repo") || process.env.GITHUB_RELEASE_REPO || detectGitRepo();
if (!repo) fail("Missing --repo (owner/repo)");

// Discover installer
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
if (!signature) {
  const sigPath = findFile(nsisDir, ".sig") || `${artifactPath}.sig`;
  if (!fs.existsSync(sigPath)) {
    fail(
      `Signature file not found.\n` +
      `Looked for .sig next to installer and scanned NSIS dir.\n` +
      `Ensure TAURI_SIGNING_PRIVATE_KEY is set so Tauri produces .sig files, or pass --signature.`
    );
  }
  signature = fs.readFileSync(sigPath, "utf8").trim();
}
if (!signature) fail("Signature is empty");

const assetUrl = readArg("--asset-url") || `https://github.com/${repo}/releases/download/${tag}/${artifactName}`;
const notes = readArg("--notes") || "";
const pubDate = readArg("--pub-date") || new Date().toISOString();
const outputPath = path.resolve(readArg("--output") || path.join(root, "release", "latest.json"));

const manifest = {
  version,
  notes,
  pub_date: pubDate,
  platforms: {
    "windows-x86_64-nsis": { url: assetUrl, signature },
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`✓ Wrote ${outputPath}`);
console.log(`  Version:    ${version}`);
console.log(`  Platform:   windows-x86_64-nsis`);
console.log(`  Installer:  ${artifactName}`);
console.log(`  URL:        ${assetUrl}`);
console.log(`  Endpoint:   https://github.com/${repo}/releases/latest/download/latest.json`);