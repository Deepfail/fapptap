/**
 * devServerCheck.ts
 * Lightweight runtime probe to determine if the app is loading from the live Vite dev server
 * or from a baked/dist fallback. Sets a global flag consumed by the overlay.
 */

declare global {
  interface Window {
    __FAPPTAP_DEV_SERVER_MISSING__?: boolean;
  }
}

// Only attempt in development scenarios; in production bundle this is noise
const DEV_URL = "http://localhost:5175/__vite_ping";

async function probe() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1200);
    const resp = await fetch(DEV_URL, { signal: controller.signal });
    clearTimeout(t);
    if (!resp.ok) throw new Error("Non-OK dev ping " + resp.status);
    window.__FAPPTAP_DEV_SERVER_MISSING__ = false;
  } catch (e) {
    // Mark missing; overlay and logs will reflect
    window.__FAPPTAP_DEV_SERVER_MISSING__ = true;
    // Avoid throwing; silent indicator only
    // console.debug('Dev server probe failed:', e);
  }
}

probe();

export {}; // module marker
