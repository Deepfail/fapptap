// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Optional: when you set TAURI_DEV_HOST for LAN/devices testing
const host = process.env.TAURI_DEV_HOST || false;

// Allow PORT override (for process-manager) but default to 1420 for Tauri desktop
const PORT = Number(process.env.PORT) || 1422;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  clearScreen: false,
  server: {
    port: PORT,
    strictPort: true,
    host, // false -> localhost only; or string/IP if TAURI_DEV_HOST is set
    // Keep HMR on the same port you’re serving
    hmr: { protocol: "ws", host: host || "localhost", port: PORT },
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
