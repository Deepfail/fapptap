#!/usr/bin/env python3
"""Debug script to check what paths are in the cutlist"""

import json
from pathlib import Path

def analyze_cutlist():
    cutlist_path = "cache/cutlist.json"
    
    if not Path(cutlist_path).exists():
        print(f"❌ Cutlist not found: {cutlist_path}")
        return
    
    with open(cutlist_path, 'r') as f:
        cutlist = json.load(f)
    
    print(f"📊 Cutlist Analysis")
    print(f"Version: {cutlist.get('version')}")
    print(f"Events: {len(cutlist.get('events', []))}")
    print(f"Audio: {cutlist.get('audio')}")
    print()
    
    # Analyze source paths
    sources = []
    for event in cutlist.get('events', []):
        src = event.get('src', '')
        sources.append(src)
    
    # Group by directory
    dirs = {}
    for src in sources:
        if src:
            dir_path = str(Path(src).parent)
            if dir_path not in dirs:
                dirs[dir_path] = 0
            dirs[dir_path] += 1
    
    print("📁 Source Directories:")
    for dir_path, count in sorted(dirs.items()):
        print(f"  {dir_path}: {count} clips")
    
    print()
    print("🎬 First 5 clips:")
    for i, event in enumerate(cutlist.get('events', [])[:5]):
        src = event.get('src', '')
        filename = Path(src).name if src else 'unknown'
        print(f"  {i+1}. {filename} ({event.get('in'):.3f}s - {event.get('out'):.3f}s)")

if __name__ == "__main__":
    analyze_cutlist()