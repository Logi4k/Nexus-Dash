#!/usr/bin/env node
/**
 * Prebuild script to set devUrl in tauri.conf.json based on TAURI_DEV_HOST
 * On Android/mobile builds, you MUST set TAURI_DEV_HOST to your machine's IP
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

function parseUpdaterEndpoints(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function applyDesktopUpdaterConfig() {
  const updaterPubkey = process.env.TAURI_UPDATER_PUBKEY?.trim();
  const updaterEndpoints = parseUpdaterEndpoints(
    process.env.TAURI_UPDATER_ENDPOINTS || process.env.TAURI_UPDATER_ENDPOINT
  );

  config.plugins ||= {};
  config.bundle ||= {};

  if (updaterPubkey && updaterEndpoints.length > 0) {
    config.plugins.updater = {
      pubkey: updaterPubkey,
      endpoints: updaterEndpoints,
    };
    config.bundle.createUpdaterArtifacts = true;
    console.log(`✓ Desktop updater enabled with ${updaterEndpoints.length} endpoint(s)`);
    return;
  }

  if (config.plugins.updater) {
    delete config.plugins.updater;
  }
  config.bundle.createUpdaterArtifacts = false;

  if (updaterPubkey || updaterEndpoints.length > 0) {
    console.warn('! Desktop updater config is incomplete. Set both TAURI_UPDATER_PUBKEY and TAURI_UPDATER_ENDPOINTS to enable OTA builds.');
  }
}

// Get TAURI_DEV_HOST from environment
const devHost = process.env.TAURI_DEV_HOST;

if (devHost && devHost.trim()) {
  const devUrl = `http://${devHost}:1420`;
  config.build.devUrl = devUrl;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`✓ Updated devUrl to: ${devUrl}`);
} else {
  // Reset to localhost (default for desktop)
  if (config.build.devUrl !== 'http://localhost:1420') {
    config.build.devUrl = 'http://localhost:1420';
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('✓ Reset devUrl to: http://localhost:1420');
  }
}

applyDesktopUpdaterConfig();
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
