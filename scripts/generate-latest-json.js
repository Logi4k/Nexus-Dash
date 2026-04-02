import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Parse command line args: --repo Logi4k/Nexus-Dash --version v1.0.15
const args = process.argv.slice(2);
let repo = "Logi4k/Nexus-Dash";
let version = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--repo" && i + 1 < args.length) repo = args[++i];
  if (args[i] === "--version" && i + 1 < args.length) version = args[++i];
}

if (!version) {
  console.error("Error: --version is required");
  process.exit(1);
}

const latestJson = {
  version,
  notes: `Release ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    windows: {
      signature: "",
      url: `https://github.com/${repo}/releases/download/${version}/nexus-setup.exe`,
    },
  },
};

const releaseDir = path.join(rootDir, "release");
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const outputPath = path.join(releaseDir, "latest.json");
fs.writeFileSync(outputPath, JSON.stringify(latestJson, null, 2));
console.log(`Generated ${outputPath}`);
