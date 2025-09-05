/**
 * Test script for probe cache functionality
 * Run with: npm run dev and then call this in console
 */

import { probeCache } from "C:/Files/Projects/fapptap/src/lib/sqliteTools.ts";

async function testProbeCache() {
  console.log("Testing probe cache functionality...");

  try {
    // Test saving a probe record
    const testRecord = {
      path: "/media_samples/video.mp4",
      size_bytes: 1234567,
      mtime_ns: 1700000000000000000,
      duration_sec: 120.5,
      video_codec: "h264",
      audio_codec: "aac",
      width: 1920,
      height: 1080,
      fps_num: 30,
      fps_den: 1,
      sample_rate: 48000,
      channels: 2,
      json_path: "/cache/test_video.json",
      deep_ready: 0 as 0 | 1,
    };

    console.log("Saving test record...");
    const saved = await probeCache.saveProbeCache(testRecord);
    console.log("Save result:", saved);

    // Test retrieving the record
    console.log("Checking cache...");
    const retrieved = await probeCache.checkProbeCache(
      testRecord.path,
      testRecord.size_bytes,
      testRecord.mtime_ns
    );
    console.log("Retrieved record:", retrieved);

    // Test getting all records
    console.log("Getting all cache records...");
    const allRecords = await probeCache.getAllProbeCache();
    console.log("All records:", allRecords);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Export for manual testing
(window as any).testProbeCache = testProbeCache;

console.log("Test probe cache loaded. Run: testProbeCache()");
