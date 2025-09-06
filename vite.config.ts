// vite.config.ts
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// Optional: when you set TAURI_DEV_HOST for LAN/devices testing
const host = process.env.TAURI_DEV_HOST || false;

// Allow PORT override (for process-manager) but default to 5175 for reliable binding
const PORT = Number(process.env.PORT) || 5175;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  // Tauri v2 specific configuration
  clearScreen: false,

  server: {
    port: PORT,
    strictPort: true,
    host: host || false, // Let Vite choose the best binding
    // Keep HMR on the same port you're serving
    hmr: host ? { protocol: "ws", host, port: PORT } : undefined,
    watch: {
      // Ignore Tauri's src-tauri directory for file watching
      ignored: ["**/src-tauri/**"],
    },
  },

  // Environment variables to ensure compatibility with Tauri
  envPrefix: ["VITE_", "TAURI_"],

  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target:
      process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
