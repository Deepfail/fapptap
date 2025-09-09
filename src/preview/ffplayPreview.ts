// Minimal ffplayPreview stub used in browser/dev environments.
import type { Timeline } from "./types";

export async function startFfplayPreview(_tl: Timeline) {
  // In desktop mode this would spawn ffplay; for browser/dev we no-op.
  console.log("startFfplayPreview called (stub)");
  return Promise.resolve();
}

export async function stopFfplayPreview() {
  console.log("stopFfplayPreview called (stub)");
  return Promise.resolve();
}

export default { startFfplayPreview, stopFfplayPreview };
