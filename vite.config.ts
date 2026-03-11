import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

function loadBackendPort() {
  try {
    const raw = fs.readFileSync(path.resolve(__dirname, "config", "app-config.json"), "utf-8");
    const parsed = JSON.parse(raw) as { port?: unknown };
    const port = Number(parsed.port);
    if (Number.isInteger(port) && port > 0) {
      return port;
    }
  } catch {
    // Fall back to the app default when config is missing or invalid.
  }

  return 38147;
}

const backendPort = loadBackendPort();
const backendOrigin = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  base: "/static/react-planner/",
  plugins: [react()],
  server: {
    proxy: {
      "/parse": backendOrigin,
      "/save": backendOrigin,
      "/planner-config": backendOrigin,
      "/openai-status": backendOrigin,
      "/analyze": backendOrigin,
      "/analyze-stream": backendOrigin,
      "/analyze-followup": backendOrigin,
      "/analyze-followup-stream": backendOrigin,
    },
  },
  build: {
    outDir: path.resolve(__dirname, "static/react-planner"),
    emptyOutDir: true,
  },
});
