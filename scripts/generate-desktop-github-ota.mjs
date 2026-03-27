#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`Desktop GitHub OTA metadata generator

Usage:
  npm run ota:desktop:latest -- --repo owner/repo [options]

Options:
  --repo <owner/repo>         GitHub repo slug. Falls back to GITHUB_RELEASE_REPO.
  --version <version>         Release version. Defaults to src-tauri/tauri.conf.json version.
  --tag <tag>                 Git tag. Defaults to v<version>.
  --artifact <path>           Installer asset path. Defaults to NSIS bundle for this version.
  --signature-file <path>     Signature file path. Defaults to <artifact>.sig.
  --signature <value>         Raw signature string. Overrides --signature-file.
  --asset-url <url>           Explicit asset download URL. Defaults to GitHub release asset URL.
  --notes <text>              Release notes string.
  --notes-file <path>         File containing release notes.
  --pub-date <iso>            Publish date. Defaults to now.
  --output <path>             Output JSON path. Defaults to release/latest.json.
`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  usage();
  process.exit(0);
}

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function detectRepoFromGitRemote() {
  try {
    const remote = execSync("git remote get-url origin", {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();

    const httpsMatch = remote.match(/github\.com[:/](.+?)(?:\.git)?$/i);
    return httpsMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

const version = readArg("--version") || tauriConfig.version;
const tag = readArg("--tag") || `v${version}`;
const repo = readArg("--repo") || process.env.GITHUB_RELEASE_REPO || detectRepoFromGitRemote() || null;
const defaultArtifact = path.join(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
  `Nexus_${version}_x64-setup.exe`
);
const artifactPath = path.resolve(readArg("--artifact") || defaultArtifact);
const signatureFile = path.resolve(readArg("--signature-file") || `${artifactPath}.sig`);
const outputPath = path.resolve(readArg("--output") || path.join(root, "release", "latest.json"));

if (!repo) {
  fail("Missing GitHub repo slug. Pass --repo owner/repo, set GITHUB_RELEASE_REPO, or configure git origin.");
}

if (!readArg("--asset-url") && !fs.existsSync(artifactPath)) {
  fail(`Installer asset not found: ${artifactPath}`);
}

let signature = readArg("--signature");
if (!signature) {
  if (!fs.existsSync(signatureFile)) {
    fail(`Signature file not found: ${signatureFile}. Build a signed desktop updater release first or pass --signature.`);
  }
  signature = fs.readFileSync(signatureFile, "utf8").trim();
}

if (!signature) {
  fail("Signature is empty.");
}

let notes = readArg("--notes") || "";
const notesFile = readArg("--notes-file");
if (!notes && notesFile) {
  notes = fs.readFileSync(path.resolve(notesFile), "utf8").trim();
}

const artifactName = path.basename(artifactPath);
const assetUrl =
  readArg("--asset-url") ||
  `https://github.com/${repo}/releases/download/${tag}/${artifactName}`;
const pubDate = readArg("--pub-date") || new Date().toISOString();

const payload = {
  version,
  notes,
  pub_date: pubDate,
  platforms: {
    "windows-x86_64": {
      url: assetUrl,
      signature,
    },
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Wrote ${outputPath}`);
console.log(`Endpoint: https://github.com/${repo}/releases/latest/download/latest.json`);
console.log("Upload these files to the GitHub release:");
console.log(`- ${artifactName}`);
if (fs.existsSync(signatureFile)) {
  console.log(`- ${path.basename(signatureFile)}`);
}
console.log(`- ${path.basename(outputPath)}`);
