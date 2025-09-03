#!/usr/bin/env python3
"""
Probe Media Script - Extract metadata from media files and cache in SQLite database

This script runs ffprobe on all media files in a directory and stores the results in:
1. Individual JSON files in cache/probe/ 
2. SQLite database cache/analysis.db with clips table

Usage: python probe_media.py <media_directory>
"""

import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path
import hashlib

VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv"}
AUDIO_EXTS = {".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"}

def get_file_hash(file_path):
    """Generate MD5 hash of file for integrity checking"""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            # Read first and last 1MB for speed on large files
            f.seek(0)
            hash_md5.update(f.read(1024*1024))
            f.seek(-1024*1024, 2)  # Seek from end
            hash_md5.update(f.read(1024*1024))
        return hash_md5.hexdigest().upper()
    except:
        # For smaller files, hash the whole thing
        try:
            with open(file_path, "rb") as f:
                hash_md5.update(f.read())
            return hash_md5.hexdigest().upper()
        except:
            return "NO_HASH"

def probe_file(file_path):
    """Run ffprobe on a file and return JSON metadata"""
    try:
        result = subprocess.run([
            "ffprobe", "-v", "error", 
            "-show_streams", "-show_format", 
            "-of", "json", str(file_path)
        ], capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
        
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        try:
            print(f"ffprobe failed for {file_path}: {e.stderr}")
        except UnicodeEncodeError:
            print(f"ffprobe failed for {file_path}: <unable to display stderr due to encoding>")
        return None
    except json.JSONDecodeError as e:
        print(f"JSON parse failed for {file_path}: {e}")
        return None

def extract_metadata(probe_data):
    """Extract key metadata from ffprobe JSON"""
    if not probe_data or "format" not in probe_data:
        return None
        
    format_info = probe_data["format"]
    streams = probe_data.get("streams", [])
    
    # Get duration
    duration = float(format_info.get("duration", 0))
    
    # Find video stream for dimensions and FPS
    width, height, fps = 0, 0, 0.0
    for stream in streams:
        if stream.get("codec_type") == "video":
            width = stream.get("width", 0)
            height = stream.get("height", 0)
            
            # Calculate FPS from r_frame_rate
            r_frame_rate = stream.get("r_frame_rate", "0/1")
            if "/" in r_frame_rate:
                try:
                    num, den = r_frame_rate.split("/")
                    if int(den) > 0:
                        fps = round(int(num) / int(den), 2)
                except:
                    fps = 0.0
            break
    
    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps
    }

def setup_database():
    """Create or update the SQLite database schema"""
    os.makedirs("cache", exist_ok=True)
    
    conn = sqlite3.connect("cache/analysis.db")
    cursor = conn.cursor()
    
    # Create clips table if it doesn't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clips (
            path TEXT PRIMARY KEY,
            duration REAL,
            fps REAL,
            width INTEGER,
            height INTEGER,
            hash TEXT
        )
    """)
    
    conn.commit()
    return conn

def probe_directory(media_dir):
    """Probe all media files in a directory"""
    media_path = Path(media_dir)
    if not media_path.exists():
        print(f"Directory not found: {media_dir}")
        return
        
    # Setup cache directories and database
    os.makedirs("cache/probe", exist_ok=True)
    conn = setup_database()
    cursor = conn.cursor()
    
    # Find all media files
    media_files = []
    for ext in VIDEO_EXTS | AUDIO_EXTS:
        media_files.extend(media_path.glob(f"*{ext}"))
    
    if not media_files:
        print(f"No media files found in {media_dir}")
        return
        
    print(f"Found {len(media_files)} media files to probe")
    
    processed = 0
    for file_path in sorted(media_files):
        try:
            print(f"Probing: {file_path.name}")
        except UnicodeEncodeError:
            print(f"Probing: {file_path.name.encode('ascii', 'replace').decode('ascii')}")
        
        # Run ffprobe
        probe_data = probe_file(file_path)
        if not probe_data:
            print(f"  Skipped: probe failed")
            continue
            
        # Extract metadata
        metadata = extract_metadata(probe_data)
        if not metadata:
            print(f"  Skipped: metadata extraction failed")
            continue
            
        # Save JSON to cache/probe/
        json_filename = f"{file_path.stem}.json"
        json_path = Path("cache/probe") / json_filename
        
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(probe_data, f, indent=2)
        except Exception as e:
            print(f"  Failed to save JSON: {e}")
            continue
            
        # Calculate file hash
        file_hash = get_file_hash(file_path)
        
        # Store in database
        normalized_path = str(file_path.resolve()).replace("\\", "/")
        
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO clips 
                (path, duration, fps, width, height, hash) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                normalized_path,
                metadata["duration"],
                metadata["fps"],
                metadata["width"],
                metadata["height"],
                file_hash
            ))
            
            print(f"  ✓ Duration: {metadata['duration']:.3f}s, "
                  f"Resolution: {metadata['width']}x{metadata['height']}, "
                  f"FPS: {metadata['fps']}")
            
            processed += 1
            
        except Exception as e:
            print(f"  Failed to store in database: {e}")
            continue
    
    # Commit all changes
    conn.commit()
    conn.close()
    
    print(f"\nCompleted: {processed}/{len(media_files)} files processed")
    print(f"Probe cache: cache/probe/ ({processed} JSON files)")
    print(f"Database: cache/analysis.db (clips table)")

def main():
    if len(sys.argv) != 2:
        print("Usage: python probe_media.py <media_directory>")
        sys.exit(1)
        
    media_dir = sys.argv[1]
    probe_directory(media_dir)

if __name__ == "__main__":
    main()