import { spawnSync } from "node:child_process";
import os from "node:os";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/platform/run-npm.mjs <npm-args...>");
  process.exit(1);
}

const isWindows = process.platform === "win32";
const isWsl = !isWindows && (
  !!process.env.WSL_DISTRO_NAME ||
  !!process.env.WSL_INTEROP ||
  os.release().toLowerCase().includes("microsoft")
);

let command;
let commandArgs;

if (isWindows) {
  command = "npm.cmd";
  commandArgs = args;
} else if (isWsl) {
  command = "node";
  commandArgs = ["/mnt/c/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", ...args];
} else {
  command = "npm";
  commandArgs = args;
}

const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
