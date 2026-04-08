#!/bin/bash
# Build script using Linux Node.js, bypassing npm to avoid Windows node issues
set -e
cd "/mnt/d/Codex New Dash build - Copy"

# Run prebuild config
node prebuild-tauri-config.js

# Build frontend with Linux node
node ./node_modules/vite/bin/vite.js build
