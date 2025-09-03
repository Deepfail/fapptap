import sys
import subprocess
import tempfile
import json
from pathlib import Path

print("Debugging beats loading in build_cutlist.py")

# Create temp files
test_dir = Path(tempfile.mkdtemp())
beats_file = test_dir / "beats.json"
shots_file = test_dir / "shots.json"
audio_file = test_dir / "test_song.mp3"
cutlist_file = test_dir / "cutlist.json"

# Create mock data with proper format
beats_data = {
    "beats": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
}
print(f"Creating beats file with: {beats_data}")

with open(beats_file, "w") as f:
    json.dump(beats_data, f)
    
# Verify the file was written correctly
with open(beats_file, "r") as f:
    loaded = json.load(f)
    print(f"Beats file contains: {loaded}")

with open(shots_file, "w") as f:
    json.dump({}, f)
audio_file.touch()

print(f"Files created:")
print(f"  beats.json: {beats_file} (exists: {beats_file.exists()})")
print(f"  shots.json: {shots_file} (exists: {shots_file.exists()})")
print(f"  audio: {audio_file} (exists: {audio_file.exists()})")

# Test with fake clips directory
test_clips_dir = "C:/User/TestClips"

# Add debug flag to see more output
cmd = [
    sys.executable, "analysis/build_cutlist.py",
    str(beats_file), str(shots_file), str(audio_file), str(cutlist_file),
    test_clips_dir, "portrait", "fast", "--skip-shots"
]

print(f"Running: {' '.join(cmd)}")
result = subprocess.run(cmd, capture_output=True, text=True)
print(f"Return code: {result.returncode}")
print(f"STDOUT: {result.stdout}")
print(f"STDERR: {result.stderr}")

# Cleanup
import shutil
shutil.rmtree(test_dir)
