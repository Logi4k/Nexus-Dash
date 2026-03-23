#!/bin/bash
set -e

cd "D:/6 Droid/New Version/nexus"

# Install dependencies if node_modules is missing or stale
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
  npm install
fi

# Ensure Vitest is available
if ! npx vitest --version > /dev/null 2>&1; then
  npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
fi

echo "Environment ready."
