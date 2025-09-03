#!/usr/bin/env python3

import sys
import os
from pathlib import Path

# Add current directory to path to import build_cutlist
sys.path.insert(0, str(Path(__file__).parent / "analysis"))

# Import the main function
from build_cutlist import main

# Test arguments that mimic what the worker sends
beats_json = "cache/beats.json"
shots_json = "cache/shots.json" 
audio_path = "test_song.mp3"
out_json = "cache/cutlist.json"
clips_dir = "C:/test/clips"
aspect_ratio = "portrait"
cutting_mode = "fast"

print("Testing build_cutlist.py main function...")
print(f"clips_dir parameter: '{clips_dir}'")
print(f"aspect_ratio parameter: '{aspect_ratio}'")
print(f"cutting_mode parameter: '{cutting_mode}'")

# Test the argument parsing by calling main directly
try:
    # This would normally fail because the files don't exist, but we can see if the parameter passing works
    main(beats_json, shots_json, audio_path, out_json, clips_dir, aspect_ratio, cutting_mode, False)
except SystemExit as e:
    print(f"SystemExit (expected): {e}")
except FileNotFoundError as e:
    print(f"FileNotFoundError (expected): {e}")
except Exception as e:
    print(f"Unexpected error: {e}")

print("Test completed!")