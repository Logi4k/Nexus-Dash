#!/usr/bin/env node
/**
 * Prebuild script for tauri.conf.json:
 * 1. Sets devUrl for mobile builds (TAURI_DEV_HOST)
 * 2. Injects updater pubkey/endpoints from env vars in CI
 * 3. Controls createUpdaterArtifacts based on signing key availability
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "src-tauri", "tauri.conf.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

function parseUpdaterEndpoints(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

// --- Updater config from env ---
const updaterPubkey = process.env.TAURI_UPDATER_PUBKEY?.trim();
const updaterEndpoints = parseUpdaterEndpoints(
  process.env.TAURI_UPDATER_ENDPOINTS || process.env.TAURI_UPDATER_ENDPOINT
);
const signingKeyPresent = Boolean(
  process.env.TAURI_SIGNING_PRIVATE_KEY?.trim() ||
  process.env.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim()
);

config.plugins ||= {};
config.bundle ||= {};

if (updaterPubkey && updaterEndpoints.length > 0) {
  config.plugins.updater = { pubkey: updaterPubkey, endpoints: updaterEndpoints };
  console.log(`✓ Updater config: ${updaterEndpoints.length} endpoint(s) from env`);
} else if (updaterPubkey || updaterEndpoints.length > 0) {
  console.warn("! Partial updater env config — keeping committed values");
}

config.bundle.createUpdaterArtifacts = Boolean(
  config.plugins.updater?.pubkey &&
  Array.isArray(config.plugins.updater?.endpoints) &&
  config.plugins.updater.endpoints.length > 0 &&
  signingKeyPresent
);

if (!signingKeyPresent) {
  console.log("• No signing key — updater artifacts disabled (CI-only build)");
} else {
  console.log("✓ Updater artifacts enabled for signed build");
}

// --- devUrl for mobile ---
const devHost = process.env.TAURI_DEV_HOST;
if (devHost?.trim()) {
  config.build.devUrl = `http://${devHost.trim()}:1420`;
  console.log(`✓ devUrl set to ${config.build.devUrl}`);
} else if (config.build.devUrl !== "http://localhost:1420") {
  config.build.devUrl = "http://localhost:1420";
  console.log("✓ devUrl reset to http://localhost:1420");
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
console.log("✓ tauri.conf.json written");