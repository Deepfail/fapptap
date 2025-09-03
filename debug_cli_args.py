#!/usr/bin/env python3

import sys
import argparse

# Mimic the worker argument parsing
ap = argparse.ArgumentParser()
ap.add_argument("stage", choices=["probe","beats","shots","cutlist","render"])
ap.add_argument("--song", default="")
ap.add_argument("--clips", default="")
ap.add_argument("--proxy", action="store_true")
ap.add_argument("--preset", default="landscape", choices=["landscape", "portrait", "square"])
ap.add_argument("--cutting_mode", default="medium", choices=["slow", "medium", "fast", "ultra_fast", "random", "auto"])
ap.add_argument("--engine", default="advanced", choices=["basic", "advanced"])
ap.add_argument("--enable_shot_detection", action="store_true", help="Enable shot detection for cutlist generation")

args = ap.parse_args()

print(f"Raw CLI arguments: {sys.argv}")
print(f"Parsed stage: '{args.stage}'")
print(f"Parsed song: '{args.song}'")
print(f"Parsed clips: '{args.clips}'")
print(f"Parsed preset: '{args.preset}'")
print(f"Parsed cutting_mode: '{args.cutting_mode}'")
print(f"Parsed enable_shot_detection: {args.enable_shot_detection}")

# Test what would happen when calling build_cutlist.py
beats_json = "cache/beats.json"
shots_json = "cache/shots.json"
output_path = "cache/cutlist.json"

build_cutlist_args = [sys.executable, "analysis/build_cutlist.py", 
                      beats_json, shots_json, args.song, output_path, args.clips, args.preset, args.cutting_mode]

print(f"\nWould call build_cutlist.py with args:")
for i, arg in enumerate(build_cutlist_args):
    print(f"  sys.argv[{i}]: '{arg}'")

print(f"\nSo clips_dir would be sys.argv[5]: '{args.clips}'")
print(f"Default fallback would be: 'media_samples'")
print(f"Clips dir will be used: '{args.clips if args.clips else 'media_samples'}'")