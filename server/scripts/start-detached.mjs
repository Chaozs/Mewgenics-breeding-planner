import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");
const PID_PATH = path.resolve(ROOT_DIR, ".mewgenics-server.pid");
const LOG_PATH = path.resolve(ROOT_DIR, ".mewgenics-server.log");

function readExistingPid() {
  try {
    return Number(fs.readFileSync(PID_PATH, "utf-8").trim());
  } catch {
    return null;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const existingPid = readExistingPid();
if (existingPid && isProcessRunning(existingPid)) {
  console.log(`Server is already running in the background (PID ${existingPid}).`);
  process.exit(0);
}

const tsxCliPath = require.resolve("tsx/cli");
const logFd = fs.openSync(LOG_PATH, "a");
const child = spawn(process.execPath, [tsxCliPath, "server/index.ts"], {
  cwd: ROOT_DIR,
  detached: true,
  stdio: ["ignore", logFd, logFd],
});

child.unref();
fs.writeFileSync(PID_PATH, `${child.pid}\n`, "utf-8");
fs.closeSync(logFd);

console.log(`Server started in the background (PID ${child.pid}).`);
console.log("Use `npm run stop` to stop it.");
console.log(`Logs: ${LOG_PATH}`);
