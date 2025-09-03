import sys
import subprocess
import tempfile
import json
from pathlib import Path

print("✅ VALIDATION: build_cutlist.py Argument Passing")

# Create temp files
test_dir = Path(tempfile.mkdtemp())
beats_file = test_dir / "beats.json"
shots_file = test_dir / "shots.json"
audio_file = test_dir / "test_song.mp3"
cutlist_file = test_dir / "cutlist.json"

# Create mock data
with open(beats_file, "w") as f:
    json.dump({"beats": [1.0, 2.0, 3.0, 4.0, 5.0]}, f)
with open(shots_file, "w") as f:
    json.dump({}, f)
audio_file.touch()

# Test with fake clips directory (simulates user selection)
test_clips_dir = "C:/User/TestClips"

cmd = [
    sys.executable, "analysis/build_cutlist.py",
    str(beats_file), str(shots_file), str(audio_file), str(cutlist_file),
    test_clips_dir, "portrait", "fast", "--skip-shots"
]

result = subprocess.run(cmd, capture_output=True, text=True)

print(f"Expected: 'No video files found in {test_clips_dir}'")
print(f"Actual stderr: {result.stderr.strip()}")

if f"No video files found in {test_clips_dir}" in result.stderr:
    print("✅ SUCCESS: build_cutlist.py correctly uses user-selected directory")
    print("   The argument parsing is working as expected.")
else:
    print("❌ FAILURE: Unexpected error or wrong directory")

# Also test with actual media_samples directory to ensure it still works
print("\n--- Testing with actual directory ---")
cmd2 = [
    sys.executable, "analysis/build_cutlist.py",
    str(beats_file), str(shots_file), str(audio_file), str(cutlist_file),
    "media_samples", "portrait", "fast", "--skip-shots"
]

result2 = subprocess.run(cmd2, capture_output=True, text=True)
print(f"Return code: {result2.returncode}")
if result2.returncode == 0:
    print("✅ SUCCESS: Works with actual media_samples directory")
else:
    print(f"Error with media_samples: {result2.stderr}")

# Cleanup
import shutil
shutil.rmtree(test_dir)
