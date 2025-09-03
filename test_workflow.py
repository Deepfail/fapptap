import subprocess
import sys
import json
from pathlib import Path

print("🧪 TESTING COMPLETE WORKFLOW")
print("=" * 50)

# Clean up old files first
old_files = [
    "cache/cutlist.json",
    "render/fapptap_final.mp4"
]

for file in old_files:
    if Path(file).exists():
        Path(file).unlink()
        print(f"Deleted: {file}")

# Test settings
clips_dir = "media_samples"
audio_file = "media_samples/anal.mp4"  # Has audio track
preset = "portrait"
cutting_mode = "fast"

print(f"\nTest configuration:")
print(f"  Clips directory: {clips_dir}")
print(f"  Audio file: {audio_file}")
print(f"  Preset: {preset}")
print(f"  Cutting mode: {cutting_mode}")

# Step 1: Generate cutlist
print(f"\n🔄 Step 1: Generate Cutlist")
cmd = [
    sys.executable, "worker/main.py", "cutlist",
    "--song", audio_file,
    "--clips", clips_dir,
    "--preset", preset,
    "--cutting_mode", cutting_mode,
    "--skip_shots"
]

result = subprocess.run(cmd, capture_output=True, text=True)
print(f"Return code: {result.returncode}")

if result.returncode == 0:
    print("✅ Cutlist generation successful")
    
    # Check cutlist
    if Path("cache/cutlist.json").exists():
        with open("cache/cutlist.json", "r") as f:
            cutlist = json.load(f)
            events = cutlist.get("events", [])
            total_cutlist_duration = cutlist.get("total_duration", 0)
            print(f"  Events: {len(events)}")
            print(f"  Cutlist duration: {total_cutlist_duration:.2f}s")
            
            if len(events) > 0:
                print(f"  First event: {events[0]}")
                print(f"  Last event: {events[-1]}")
else:
    print(f"❌ Cutlist generation failed: {result.stderr}")
    exit(1)

# Step 2: Render
print(f"\n🔄 Step 2: Render Video")
cmd = [
    sys.executable, "worker/main.py", "render",
    "--preset", preset
]

result = subprocess.run(cmd, capture_output=True, text=True)
print(f"Return code: {result.returncode}")

if result.returncode == 0:
    print("✅ Render successful")
    
    # Check output
    output_file = Path("render/fapptap_final.mp4")
    if output_file.exists():
        size_mb = output_file.stat().st_size / (1024 * 1024)
        print(f"  Output: {output_file} ({size_mb:.1f} MB)")
        
        # Use ffprobe to get actual video duration
        probe_cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(output_file)]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
        
        if probe_result.returncode == 0:
            probe_data = json.loads(probe_result.stdout)
            video_duration = float(probe_data["format"]["duration"])
            print(f"  Actual video duration: {video_duration:.2f}s ({video_duration/60:.1f} minutes)")
            
            # Compare with expected
            expected_duration = total_cutlist_duration
            ratio = video_duration / expected_duration if expected_duration > 0 else 0
            print(f"  Duration ratio (video/cutlist): {ratio:.2f}x")
            
            if abs(ratio - 1.0) < 0.1:  # Within 10%
                print("  ✅ Video duration matches cutlist")
            else:
                print("  ⚠️  Video duration doesn't match cutlist")
        else:
            print("  ❌ Could not probe video duration")
    else:
        print("  ❌ Output file not created")
else:
    print(f"❌ Render failed: {result.stderr}")

print(f"\n🎯 WORKFLOW TEST COMPLETE")
