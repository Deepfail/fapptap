import sys, os, json, pathlib

# Fast shot detection that just creates reasonable shot segments
# Usage: python detect_shots_fast.py <media_dir> <out_json> [shot_length_sec]
media_dir = pathlib.Path(sys.argv[1])
out_json = sys.argv[2]
shot_length = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0  # 2 second shots

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}

def list_videos(root):
    for p in sorted(root.iterdir()):
        if p.suffix.lower() in VIDEO_EXTS:
            yield p

def get_duration_from_cache(file_path):
    """Get duration from analysis.db cache"""
    import sqlite3
    try:
        conn = sqlite3.connect('cache/analysis.db')
        c = conn.cursor()
        c.execute('SELECT duration FROM clips WHERE path = ?', (str(file_path),))
        result = c.fetchone()
        conn.close()
        if result:
            return result[0]
    except Exception as e:
        print(f"[WARN] Could not get duration from cache for {file_path}: {e}")
    return None

def create_simple_shots(duration, shot_length):
    """Create simple time-based shots instead of content-based detection"""
    shots = []
    current_time = 0.0
    
    while current_time < duration:
        end_time = min(current_time + shot_length, duration)
        shots.append({
            "start": round(current_time, 3),
            "end": round(end_time, 3)
        })
        current_time = end_time
    
    return shots

def shots_for_video(video_path):
    """Get shots for a video using cached duration"""
    try:
        duration = get_duration_from_cache(video_path)
        if duration is None:
            print(f"[WARN] No cached duration found for {video_path}")
            return [{"start": 0.0, "end": 5.0}]  # Fallback
        
        # Create simple time-based shots
        shots = create_simple_shots(duration, shot_length)
        print(f"Created {len(shots)} shots for {video_path.name} (duration: {duration}s)")
        return shots
        
    except Exception as e:
        print(f"[ERROR] Failed to create shots for {video_path}: {e}")
        return [{"start": 0.0, "end": 5.0}]  # Fallback

# Process all videos
out = {}
total_videos = 0
total_shots = 0

for vid in list_videos(media_dir):
    try:
        shots = shots_for_video(vid)
        out[str(vid).replace("\\", "/")] = shots
        total_videos += 1
        total_shots += len(shots)
    except Exception as e:
        print(f"[ERROR] Failed {vid}: {e}")

# Write output using atomic write to prevent corruption/stacking
from pathlib import Path
output_path = Path(out_json)
if output_path.parent != Path('.'):  # Only create directory if there's a directory component
    os.makedirs(output_path.parent, exist_ok=True)
tmp = output_path.with_suffix(".json.tmp")
tmp.write_text(json.dumps(out, indent=2), encoding='utf-8')
tmp.replace(output_path)

print(f"Fast shot detection complete!")
print(f"Processed {total_videos} videos")
print(f"Created {total_shots} total shots")
print(f"Wrote {out_json}")