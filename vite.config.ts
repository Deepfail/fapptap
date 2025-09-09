import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Optional: when you set TAURI_DEV_HOST for LAN/devices testing
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Tauri-friendly defaults
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false, // false -> localhost only; or string/IP if TAURI_DEV_HOST is set
    // Keep HMR on same port so CSP `connect-src` with ws://localhost:5173 stays valid
    hmr: host ? { protocol: "ws", host, port: 5173 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
