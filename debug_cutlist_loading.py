#!/usr/bin/env python3

import sys
import json

def load_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    if len(sys.argv) < 2:
        print("Usage: python debug_cutlist_loading.py <beats_json>")
        sys.exit(1)
    
    beats_json = sys.argv[1]
    print(f"Loading beats from: {beats_json}")
    
    try:
        beats = load_json(beats_json)
        print(f"File loaded successfully")
        print(f"Keys in file: {list(beats.keys())}")
        
        # Handle different beats.json formats
        if "beats_sec" in beats:
            print("Using beats_sec format")
            beat_times = [float(t) for t in beats["beats_sec"]]
        elif "beats" in beats and isinstance(beats["beats"], list) and beats["beats"]:
            print("Using beats format")
            if isinstance(beats["beats"][0], dict):
                print("  -> Object format (with 'time' key)")
                beat_times = [float(beat["time"]) for beat in beats["beats"]]
            else:
                print("  -> Flat array format")
                beat_times = [float(beat) for beat in beats["beats"]]
        else:
            print("No valid beats format found")
            beat_times = []
        
        print(f"Extracted {len(beat_times)} beats")
        if beat_times:
            print(f"First 3 beats: {beat_times[:3]}")
        else:
            print("ERROR: No beats found!")
            
    except Exception as e:
        print(f"Error loading file: {e}")

if __name__ == "__main__":
    main()