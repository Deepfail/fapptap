import sys, os, json, glob, statistics, subprocess, random
from pathlib import Path
from collections import defaultdict

# Usage: python build_cutlist.py <beats_json> <shots_json> <audio_path> <out_json> [clips_dir] [aspect_ratio] [cutting_mode]
FPS = 60
SNAP_TOL = 0.080   # seconds
MIN_DUR  = 0.40    # seconds  # Reduced from 0.60 to accommodate faster beats
BEAT_STRIDE = 1    # 1 = every beat, 2 = every other, etc.

VIDEO_EXTS = (".mp4",".mov",".mkv",".webm",".m4v")

# Aspect ratio presets
ASPECT_RATIO_PRESETS = {
    "wide": {"width": 1920, "height": 1080, "ratio": 16/9},
    "portrait": {"width": 1080, "height": 1920, "ratio": 9/16},
    "square": {"width": 1080, "height": 1080, "ratio": 1/1}
}

# Cutting rate mode presets
CUTTING_MODES = {
    "slow": {"multiplier": 2.0, "description": "Slower cuts, 2x beat interval"},
    "medium": {"multiplier": 1.0, "description": "Standard tempo, every beat"},
    "fast": {"multiplier": 0.5, "description": "Fast cuts, half beat interval"},
    "ultra_fast": {"multiplier": 0.25, "description": "Ultra fast cuts, quarter beat"},
    "random": {"multiplier": "random", "description": "Random cut intervals"}
}

def list_videos(clips_dir: Path):
    vids = []
    for p in sorted(clips_dir.iterdir()):
        if p.suffix.lower() in VIDEO_EXTS:
            vids.append(str(p.resolve()).replace("\\", "/"))
    return vids

def load_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def get_duration_ffprobe(path):
    """Fast one-liner to get duration using ffprobe"""
    try:
        out = subprocess.check_output([
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "json", path
        ], text=True)
        dur = float(json.loads(out)["format"]["duration"])
        return max(0.0, dur)
    except Exception:
        return 0.0

def get_duration_from_cache(path):
    """Get duration from cached probe data in SQLite database"""
    try:
        import sqlite3
        # Normalize path for lookup
        path = str(Path(path).resolve()).replace("\\", "/")
        
        conn = sqlite3.connect("cache/analysis.db")
        cursor = conn.cursor()
        cursor.execute("SELECT duration FROM clips WHERE path = ?", (path,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return float(result[0])
        else:
            # Fallback to direct ffprobe if not in cache
            try:
                print(f"Duration not cached for file, using ffprobe fallback")
            except UnicodeEncodeError:
                print(f"Duration not cached for file (Unicode name), using ffprobe fallback")
            return get_duration_ffprobe(path)
    except Exception as e:
        try:
            print(f"Cache lookup failed: {e}, using ffprobe fallback")
        except UnicodeEncodeError:
            print(f"Cache lookup failed (Unicode), using ffprobe fallback")
        return get_duration_ffprobe(path)

def nearest_shot_edge(t, shots):
    if not shots:
        return t, None
    best = (abs(t - shots[0]["start"]), shots[0]["start"], shots[0])
    for sh in shots:
        for edge in (sh["start"], sh["end"]):
            d = abs(t - edge)
            if d < best[0]:
                best = (d, edge, sh)
    dist, snapped, shot = best
    return (snapped if dist <= SNAP_TOL else t), shot

def apply_cutting_mode(beat_times, cutting_mode="medium"):
    """Apply cutting mode to beat times to adjust cutting rate"""
    import random
    
    if cutting_mode not in CUTTING_MODES:
        print(f"Warning: Unknown cutting mode '{cutting_mode}', defaulting to 'medium'")
        cutting_mode = "medium"
    
    mode_config = CUTTING_MODES[cutting_mode]
    print(f"Cutting mode: {cutting_mode} - {mode_config['description']}")
    
    if cutting_mode == "random":
        # Random mode: generate random cut intervals based on beat intervals
        if len(beat_times) < 2:
            return beat_times
        
        # Calculate typical interval
        intervals = [b - a for a, b in zip(beat_times, beat_times[1:])]
        median_interval = statistics.median(intervals) if intervals else 0.5
        
        # Generate new beat times with random intervals
        new_beat_times = [beat_times[0]]  # Start with first beat
        current_time = beat_times[0]
        
        while current_time < beat_times[-1]:
            # Random multiplier between 0.25x and 2x the median interval
            random_multiplier = random.uniform(0.25, 2.0)
            interval = median_interval * random_multiplier
            current_time += interval
            if current_time < beat_times[-1]:
                new_beat_times.append(current_time)
        
        return new_beat_times
    
    else:
        # Regular modes: adjust beat intervals by multiplier
        multiplier = mode_config["multiplier"]
        if multiplier == 1.0:
            return beat_times  # No change for medium mode
        
        # Create new beat times with adjusted intervals
        if len(beat_times) < 2:
            return beat_times
        
        new_beat_times = [beat_times[0]]  # Start with first beat
        intervals = [b - a for a, b in zip(beat_times, beat_times[1:])]
        
        current_time = beat_times[0]
        for interval in intervals:
            adjusted_interval = interval * multiplier
            current_time += adjusted_interval
            new_beat_times.append(current_time)
        
        return new_beat_times

def main(beats_json, shots_json, audio_path, out_json):
    beats = load_json(beats_json)
    
    # Handle different beats.json formats
    if "beats_sec" in beats:
        # Legacy format: flat array of times
        beat_times = [float(t) for t in beats["beats_sec"]]
    elif "beats" in beats and isinstance(beats["beats"], list) and beats["beats"]:
        if isinstance(beats["beats"][0], dict):
            # New format: array of objects with "time" key
            beat_times = [float(beat["time"]) for beat in beats["beats"]]
        else:
            # Advanced engine format: flat array of times
            beat_times = [float(beat) for beat in beats["beats"]]
    else:
        beat_times = []
    
    if not beat_times:
        raise SystemExit("No beats found.")

    # ---- Get cutting mode from argv[7] or default to medium ----
    cutting_mode = sys.argv[7] if len(sys.argv) > 7 else "medium"
    
    # Apply cutting mode to adjust beat timing FIRST
    beat_times = apply_cutting_mode(beat_times, cutting_mode)

    # ---- Get aspect ratio preset from argv[6] or default to wide ----
    aspect_preset = sys.argv[6] if len(sys.argv) > 6 else "wide"
    if aspect_preset not in ASPECT_RATIO_PRESETS:
        print(f"Warning: Unknown aspect ratio '{aspect_preset}', defaulting to 'wide'")
        aspect_preset = "wide"
    
    preset = ASPECT_RATIO_PRESETS[aspect_preset]
    WIDTH, HEIGHT = preset["width"], preset["height"]
    print(f"Aspect ratio preset: {aspect_preset} ({WIDTH}x{HEIGHT})")

    # ---- Auto-pick stride so each segment ≥ MIN_DUR (AFTER cutting mode) ----
    intervals = [b - a for a, b in zip(beat_times, beat_times[1:])]
    median_iv = statistics.median(intervals) if intervals else 0.5
    stride = max(1, round(MIN_DUR / median_iv))
    beat_times = beat_times[::stride]
    print(f"Auto stride: {stride} (median interval: {median_iv:.3f}s, min duration: {MIN_DUR}s)")
    print(f"After striding: {len(beat_times)} beats remaining")

    # Optional extra stride on top
    beat_times = beat_times[::BEAT_STRIDE]
    print(f"After beat stride: {len(beat_times)} beats remaining")

    # ---- Get clips dir from argv[5] or default to media_samples/ ----
    clips_dir = Path(sys.argv[5]).resolve() if len(sys.argv) > 5 else Path("media_samples").resolve()

    # ---- Load & normalize shots_map (if provided) ----
    shots_map = {}
    if Path(shots_json).exists():
        raw = load_json(shots_json)
        # Normalize keys to absolute forward-slashed paths and sort shot lists by start
        for k, v in raw.items():
            shots_data = sorted(v, key=lambda x: x["start"])
            
            # Store multiple path variations to ensure matching
            abs_key = str(Path(k).resolve()).replace("\\", "/")
            shots_map[abs_key] = shots_data
            
            # Also keep relative path key
            norm_key = k.replace("\\", "/")
            shots_map[norm_key] = shots_data
            
            # Add filename-only key for fallback matching
            filename_key = Path(k).name
            shots_map[filename_key] = shots_data

    # ---- List videos from selected clips_dir ----
    pattern = str(clips_dir / "*.*")
    videos = sorted(
        [
            str(Path(p).resolve()).replace("\\", "/")
            for p in glob.glob(pattern)
            if p.lower().endswith(VIDEO_EXTS)
        ]
    )
    if not videos:
        raise SystemExit(f"No video files found in {clips_dir}")
    
    print(f"Found {len(videos)} video files:")
    for v in videos:
        try:
            print(f"  {v}")
        except UnicodeEncodeError:
            # Handle Unicode characters in filenames gracefully
            print(f"  {v.encode('ascii', 'replace').decode('ascii')}")
    
    print(f"Shots map has {len(shots_map)} entries:")
    for k in shots_map.keys():
        try:
            print(f"  '{k}'")
        except UnicodeEncodeError:
            print(f"  '{k.encode('ascii', 'replace').decode('ascii')}'")

    # Precompute durations for each clip from cache/database
    durations = {src: get_duration_from_cache(src) for src in videos}
    
    # Cursor per clip (seconds, local to clip)
    cursor = defaultdict(float)

    events = []
    vid_i = 0
    print(f"Processing {len(beat_times)} beat intervals...")
    
    for i in range(len(beat_times) - 1):
        seg = beat_times[i+1] - beat_times[i]
        print(f"Beat {i}: segment duration {seg:.3f}s")
        
        if seg < MIN_DUR:
            print(f"  Skipping: too short (< {MIN_DUR}s)")
            continue

        src = videos[vid_i % len(videos)]
        vid_i += 1
        dur = durations.get(src, 0.0)
        try:
            print(f"  Using video: {Path(src).name} (duration: {dur:.3f}s)")
        except UnicodeEncodeError:
            print(f"  Using video: {Path(src).name.encode('ascii', 'replace').decode('ascii')} (duration: {dur:.3f}s)")
        
        if dur <= 0.0:
            print(f"  Skipping: bad duration")
            continue  # skip bad probe

        # Get local window for this clip
        start = cursor[src]
        end = start + seg

        # Wrap/reset if we run off the tail
        if end > dur:
            # Option B (simpler): reset to 0 and take segment from head
            start = 0.0
            end = min(seg, dur)

        # Enforce min duration
        if end - start < MIN_DUR:
            # try starting at 0 if we were near the tail
            start = 0.0
            end = min(seg, dur)
            if end - start < MIN_DUR:
                continue  # clip too short for this segment size

        # Optional: snap to that clip's shot edges
        shots = shots_map.get(src, [])
        if not shots:
            # Try alternative path matching strategies
            rel_path = str(Path(src).relative_to(Path.cwd())).replace("\\", "/")
            shots = shots_map.get(rel_path, [])
        if not shots:
            # Try filename-only matching
            filename = Path(src).name
            shots = shots_map.get(filename, [])
        def snap_edge(t):
            if not shots: return t
            best = t; best_d = SNAP_TOL + 1
            for sh in shots:
                for edge in (sh["start"], sh["end"]):
                    d = abs(t - edge)
                    if d < best_d:
                        best_d, best = d, edge
            return best if best_d <= SNAP_TOL else t

        s_snap = snap_edge(start)
        e_snap = snap_edge(end)
        if e_snap - s_snap < MIN_DUR:
            # if snapping made it too short, fall back to unsnapped
            s_snap, e_snap = start, end

        # Add punch-in effect for every 4th event
        effects = []
        if len(events) % 4 == 0:
            effects = ["punch_in:0.10"]  # 10% zoom on every 4th event

        events.append({
            "src": src,
            "in": round(s_snap, 3),     # LOCAL time within this clip
            "out": round(e_snap, 3),    # LOCAL time within this clip
            "effects": effects
        })

        # Advance cursor; wrap to 0 if we are near the end
        cursor[src] = e_snap
        if dur - cursor[src] < MIN_DUR:
            cursor[src] = 0.0


    out = {
        "version": 1,
        "fps": FPS,
        "width": WIDTH,
        "height": HEIGHT,
        "audio": beats["audio"],
        "events": events
    }
    os.makedirs(Path(out_json).parent, exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {out_json} with {len(events)} events.")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
