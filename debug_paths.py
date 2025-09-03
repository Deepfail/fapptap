#!/usr/bin/env python3
"""
Debug the build_cutlist.py path matching issue
"""
import json
from pathlib import Path

# Load the data files
beats_file = "cache/beats.json"
shots_file = "cache/shots.json"
clips_dir = "test_clips_small"

print("🔍 Debugging build_cutlist.py path matching...")

# Load shots data
with open(shots_file) as f:
    shots_raw = json.load(f)

print(f"\n📁 Shots JSON keys:")
for key in shots_raw.keys():
    print(f"  '{key}'")

# Load clips directory
clips_path = Path(clips_dir).resolve()
print(f"\n📂 Clips directory: {clips_path}")

# List video files
VIDEO_EXTS = (".mp4",".mov",".mkv",".webm",".m4v")
videos = []
for p in clips_path.glob("*"):
    if p.suffix.lower() in VIDEO_EXTS:
        abs_path = str(p.resolve()).replace("\\", "/")
        videos.append(abs_path)
        print(f"  Video file: '{abs_path}'")

print(f"\n🔍 Path matching analysis:")
for video in videos:
    print(f"\nVideo: {video}")
    
    # Check exact matches
    if video in shots_raw:
        print(f"  ✅ Exact match found")
    else:
        print(f"  ❌ No exact match")
        
        # Check for partial matches
        for shot_key in shots_raw.keys():
            if Path(video).name == Path(shot_key).name:
                print(f"  🔄 Filename match with: '{shot_key}'")
            elif video.endswith(shot_key) or shot_key.endswith(video):
                print(f"  🔄 Partial path match with: '{shot_key}'")

print(f"\n💡 Solution: The shots keys don't match the video file paths!")
print("This is why the cutlist has 0 events - it can't find shots for any video files.")