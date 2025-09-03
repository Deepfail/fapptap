import sys
import subprocess
import tempfile
import json
from pathlib import Path

print("Testing argument passing to build_cutlist.py")

# Create temp files
test_dir = Path(tempfile.mkdtemp())
beats_file = test_dir / "beats.json"
shots_file = test_dir / "shots.json" 
audio_file = test_dir / "test_song.mp3"
cutlist_file = test_dir / "cutlist.json"

# Create mock data with actual beats
with open(beats_file, "w") as f:
    json.dump({"beats": [1.0, 2.0, 3.0, 4.0, 5.0]}, f)
with open(shots_file, "w") as f:
    json.dump({}, f)
audio_file.touch()

# Test with fake clips directory
test_clips_dir = "C:/User/TestClips"

cmd = [
    sys.executable, "analysis/build_cutlist.py",
    str(beats_file), str(shots_file), str(audio_file), str(cutlist_file),
    test_clips_dir, "portrait", "fast"
]

print(f"Running: {' '.join(cmd)}")
result = subprocess.run(cmd, capture_output=True, text=True)
print(f"Return code: {result.returncode}")
print(f"STDOUT: {result.stdout}")
print(f"STDERR: {result.stderr}")

if "No video files found in" in result.stderr and test_clips_dir in result.stderr:
    print("✅ Correct directory used")
else:
    print("❌ Wrong directory used or unexpected error")

# Cleanup
import shutil
shutil.rmtree(test_dir)
