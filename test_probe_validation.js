/**
 * Test script to validate probe cache functionality
 * This simulates what happens when a user selects a media file in the app
 */

import { probeService } from './src/lib/probeService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testProbeIntegration() {
  console.log('🧪 Testing probe cache integration...\n');
  
  // Test with sample media files
  const testFiles = [
    path.join(__dirname, 'media_samples', 'test_audio.mp3'),
    path.join(__dirname, 'media_samples', 'test_video.mp4'),
    path.join(__dirname, 'public', 'mock', 'sample1.mp4'), // Browser mock file
  ];
  
  for (const filePath of testFiles) {
    console.log(`📁 Testing file: ${filePath}`);
    
    try {
      // Check if file exists in cache
      console.log('  🔍 Checking cache...');
      const cached = await probeService.getCachedProbe(filePath);
      if (cached) {
        console.log(`  ✅ Found in cache: ${cached.duration}s, ${cached.format}`);
        continue;
      }
      
      // Probe the file
      console.log('  🔍 Probing file...');
      const probe = await probeService.probeMedia(filePath);
      
      if (probe) {
        console.log(`  ✅ Probe successful: ${probe.duration}s, ${probe.format}`);
      } else {
        console.log('  ❌ Probe failed');
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Check final cache state
  console.log('📊 Final cache validation...');
  try {
    const cacheCount = await probeService.getCacheStats();
    console.log(`  Cache entries: ${cacheCount}`);
  } catch (error) {
    console.log(`  ❌ Cache check failed: ${error.message}`);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testProbeIntegration().catch(console.error);
}

export { testProbeIntegration };