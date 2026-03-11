import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");
const PID_PATH = path.resolve(ROOT_DIR, ".mewgenics-server.pid");
const APP_CONFIG_PATH = path.resolve(ROOT_DIR, "config", "app-config.json");

function loadConfiguredPort() {
  try {
    const raw = fs.readFileSync(APP_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const port = Number(parsed.port);
    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  } catch {
    // Fall back to the app default when config is missing or invalid.
  }

  return 38147;
}

const PORT = loadConfiguredPort();

function removePidFile() {
  try {
    fs.unlinkSync(PID_PATH);
  } catch {
    // Ignore missing pid file.
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

function stopPid(pid) {
  try {
    process.kill(pid);
    return true;
  } catch {
    return false;
  }
}

function readPidFile() {
  try {
    return Number(fs.readFileSync(PID_PATH, "utf-8").trim());
  } catch {
    return null;
  }
}

function getListeningPidsOnPort(port) {
  if (process.platform === "win32") {
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf-8" });
    const portSuffix = `:${port}`;
    const pids = new Set();

    output.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed.includes("LISTENING") || !trimmed.includes(portSuffix)) {
        return;
      }

      const parts = trimmed.split(/\s+/);
      const localAddress = parts[1] || "";
      const state = parts[3] || "";
      const pid = Number(parts[4]);
      if (!localAddress.endsWith(portSuffix) || state !== "LISTENING" || !pid) {
        return;
      }
      pids.add(pid);
    });

    return [...pids];
  }

  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf-8" });
    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

const pidFromFile = readPidFile();
if (pidFromFile) {
  const stopped = stopPid(pidFromFile);
  removePidFile();
  if (stopped) {
    console.log(`Stopped background server (PID ${pidFromFile}).`);
    process.exit(0);
  }

  console.log(`Server process ${pidFromFile} was not running. Removed stale PID file.`);
}

const listeningPids = getListeningPidsOnPort(PORT).filter((pid) => isProcessRunning(pid));
if (listeningPids.length === 0) {
  console.log(`No tracked background server PID file found, and nothing is listening on port ${PORT}.`);
  process.exit(0);
}

const stoppedPids = listeningPids.filter((pid) => stopPid(pid));
removePidFile();

if (stoppedPids.length > 0) {
  console.log(`Stopped process(es) on port ${PORT}: ${stoppedPids.join(", ")}.`);
  process.exit(0);
}

console.log(`Found process(es) on port ${PORT}, but could not stop them: ${listeningPids.join(", ")}.`);
