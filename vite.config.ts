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
  // Force stable IPv4 localhost and fixed port for deterministic Tauri dev
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    hmr: { protocol: "ws", host: "127.0.0.1", port: 5175 },
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
