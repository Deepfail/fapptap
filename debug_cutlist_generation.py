#!/usr/bin/env python3
"""Debug script to trace cutlist generation with actual arguments"""

import sys
import subprocess
from pathlib import Path

def debug_cutlist_generation():
    print("🔍 Debugging Cutlist Generation")
    print()
    
    # Simulate the exact call that would be made
    beats_json = "cache/beats.json"
    shots_json = "cache/shots.json"
    song = "C:/Users/Virta/Dropbox/Music/Audials Music/Big Boss Vette - Pretty Girls Walk [Explicit].mp3"
    output_path = "cache/cutlist.json"
    clips_dir = "C:/Users/Virta/Dropbox/Server Loading/not_uploaded/WAN/authors/TW_waifus"
    preset = "portrait"
    cutting_mode = "medium"
    
    print(f"📁 Expected clips directory: {clips_dir}")
    print(f"🎵 Song: {Path(song).name}")
    print(f"📐 Preset: {preset}")
    print(f"✂️ Cutting mode: {cutting_mode}")
    print()
    
    # Check if the clips directory exists and what's in it
    clips_path = Path(clips_dir)
    if clips_path.exists():
        video_files = list(clips_path.glob("*.mp4")) + list(clips_path.glob("*.avi")) + list(clips_path.glob("*.mov"))
        print(f"✅ Clips directory exists with {len(video_files)} video files:")
        for i, video in enumerate(video_files[:5]):
            print(f"  {i+1}. {video.name}")
        if len(video_files) > 5:
            print(f"  ... and {len(video_files)-5} more")
    else:
        print(f"❌ Clips directory does not exist: {clips_dir}")
        return
    
    print()
    print("🚀 Running build_cutlist.py with debug output...")
    
    # Run the actual command with debug
    cmd = [
        sys.executable, "analysis/build_cutlist.py", 
        beats_json, shots_json, song, output_path, clips_dir, preset, cutting_mode
    ]
    
    print(f"Command: {' '.join(cmd)}")
    print()
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        print("📤 STDOUT:")
        print(result.stdout)
        print("📤 STDERR:")
        print(result.stderr)
        print(f"🔢 Return code: {result.returncode}")
        
        # Check the resulting cutlist
        if Path(output_path).exists():
            print()
            print("📋 Checking generated cutlist...")
            import json
            with open(output_path, 'r') as f:
                cutlist = json.load(f)
            
            sources = []
            for event in cutlist.get('events', [])[:10]:  # First 10 events
                src = event.get('src', '')
                sources.append(src)
                
            print(f"First 10 source paths in cutlist:")
            for i, src in enumerate(sources):
                print(f"  {i+1}. {src}")
                
        else:
            print(f"❌ No cutlist generated at {output_path}")
            
    except Exception as e:
        print(f"❌ Error running command: {e}")

if __name__ == "__main__":
    debug_cutlist_generation()