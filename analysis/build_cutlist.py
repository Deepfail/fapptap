import sys, os, json, glob, statistics, subprocess, random, argparse
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
    "slow": {"multiplier": 2.0, "min_duration": 0.60, "description": "Slower cuts, 2x beat interval"},
    "medium": {"multiplier": 1.0, "min_duration": 0.40, "description": "Standard tempo, every beat"},
    "fast": {"multiplier": 0.5, "min_duration": 0.25, "description": "Fast cuts, half beat interval"},
    "ultra_fast": {"multiplier": 0.25, "min_duration": 0.15, "description": "Ultra fast cuts, quarter beat"},
    "random": {"multiplier": "random", "min_duration": 0.30, "description": "Random cut intervals"},
    "auto": {"multiplier": "ai", "min_duration": 0.40, "description": "AI-driven cuts based on music energy and dynamics"}
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

def apply_auto_cutting_mode(beat_times, audio_path):
    """Apply AI/Auto cutting mode based on music energy and dynamics"""
    try:
        import librosa
        import numpy as np
        
        print(f"Auto/AI mode: Analyzing music energy from {audio_path}")
        
        # Load audio for analysis
        y, sr = librosa.load(audio_path, sr=22050, mono=True)
        
        # Calculate spectral features for energy analysis
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        rms_energy = librosa.feature.rms(y=y)[0]
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y)[0]
        
        # Calculate tempo and beat strength
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_strength = librosa.onset.onset_strength(y=y, sr=sr)
        
        # Convert beat times to frame indices for analysis
        beat_frames_input = librosa.time_to_frames(beat_times, sr=sr)
        
        # Analyze energy at each beat
        energy_scores = []
        for i, frame in enumerate(beat_frames_input):
            if frame < len(rms_energy):
                # Combine multiple energy features
                energy = rms_energy[frame]
                centroid = spectral_centroid[frame] if frame < len(spectral_centroid) else 0
                zcr = zero_crossing_rate[frame] if frame < len(zero_crossing_rate) else 0
                
                # Normalize and combine features (0-1 scale)
                energy_norm = min(energy * 10, 1.0)  # RMS energy
                centroid_norm = min(centroid / 4000, 1.0)  # Spectral brightness
                zcr_norm = min(zcr * 2, 1.0)  # Percussiveness
                
                # Combined energy score
                combined_score = (energy_norm * 0.5 + centroid_norm * 0.3 + zcr_norm * 0.2)
                energy_scores.append(combined_score)
            else:
                energy_scores.append(0.5)  # Default energy
        
        # Determine cutting rate based on energy patterns
        median_energy = np.median(energy_scores) if energy_scores else 0.5
        energy_variance = np.var(energy_scores) if energy_scores else 0.1
        
        print(f"Auto mode analysis: median_energy={median_energy:.3f}, variance={energy_variance:.3f}")
        
        # Adaptive cutting strategy based on energy characteristics
        if median_energy > 0.7 and energy_variance > 0.1:
            # High energy with variation - fast cuts
            multiplier = 0.5
            strategy = "fast (high energy, dynamic)"
        elif median_energy > 0.6:
            # High energy - medium-fast cuts
            multiplier = 0.75
            strategy = "medium-fast (high energy)"
        elif energy_variance > 0.15:
            # High variance - adapt to energy peaks
            strategy = "energy-adaptive (dynamic)"
            return apply_energy_adaptive_cuts(beat_times, energy_scores)
        elif median_energy < 0.3:
            # Low energy - slower cuts
            multiplier = 1.5
            strategy = "slow (low energy)"
        else:
            # Medium energy - standard cuts
            multiplier = 1.0
            strategy = "medium (balanced)"
        
        print(f"Auto mode strategy: {strategy} (multiplier={multiplier})")
        
        # Apply the determined multiplier
        if len(beat_times) < 2:
            return beat_times
        
        new_beat_times = [beat_times[0]]
        intervals = [b - a for a, b in zip(beat_times, beat_times[1:])]
        
        current_time = beat_times[0]
        for interval in intervals:
            adjusted_interval = interval * multiplier
            current_time += adjusted_interval
            new_beat_times.append(current_time)
        
        return new_beat_times
        
    except Exception as e:
        print(f"Auto mode failed: {e}, falling back to medium mode")
        # Fallback to medium mode
        return beat_times

def apply_energy_adaptive_cuts(beat_times, energy_scores):
    """Apply energy-adaptive cutting that varies with music dynamics"""
    import numpy as np
    
    if len(beat_times) != len(energy_scores) or len(beat_times) < 2:
        return beat_times
    
    new_beat_times = [beat_times[0]]
    current_time = beat_times[0]
    
    for i in range(len(beat_times) - 1):
        interval = beat_times[i + 1] - beat_times[i]
        energy = energy_scores[i]
        
        # High energy = faster cuts (smaller multiplier)
        # Low energy = slower cuts (larger multiplier)
        if energy > 0.7:
            multiplier = 0.5  # Fast cuts for high energy
        elif energy > 0.5:
            multiplier = 0.75  # Medium-fast cuts
        elif energy > 0.3:
            multiplier = 1.0  # Standard cuts
        else:
            multiplier = 1.5  # Slower cuts for low energy
        
        adjusted_interval = interval * multiplier
        current_time += adjusted_interval
        new_beat_times.append(current_time)
    
    return new_beat_times

def apply_cutting_mode(beat_times, cutting_mode="medium", audio_path=None):
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
    
    elif cutting_mode == "auto":
        # AI/Auto mode: energy-driven cutting rate adaptation
        return apply_auto_cutting_mode(beat_times, audio_path)
    
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

def attach_flashes(events, default_dur=0.05, every_n=1):
    """Compute flash windows based on events timeline"""
    flashes = []
    t = 0.0
    for i, ev in enumerate(events):
        dur = max(0.0, ev['out'] - ev['in'])
        # Apply flash to every clip (every_n=1) or specific intervals
        if (i % every_n) == 0:
            # Clamp duration between 20-120ms as suggested
            flash_dur = max(0.02, min(default_dur, 0.12))
            flashes.append({"start": round(t, 3), "end": round(t + flash_dur, 3)})
        t += dur
    return flashes

def main(beats_json, shots_json, audio_path, out_json, clips_dir=None, aspect_ratio=None, cutting_mode=None, skip_shots=False, transition_effects=None, min_duration_override=None, beat_stride_override=None, snap_tol_override=None):
    # Available transition effects
    AVAILABLE_EFFECTS = {
        "flash": "flash_transition:0.05",
        "punch_in": "punch_in:0.15", 
        "fade_in": "fade_in:0.3",
        "zoom_in": "zoom_in:0.2",
        "slide_left": "slide_left:0.25",
        "slide_right": "slide_right:0.25"
    }
    
    # Parse selected effects
    selected_effects = []
    if transition_effects:
        effect_names = [e.strip() for e in transition_effects.split(',') if e.strip()]
        for name in effect_names:
            if name in AVAILABLE_EFFECTS:
                selected_effects.append(AVAILABLE_EFFECTS[name])
    
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

    # ---- Get cutting mode from parameter or default to medium ----
    if cutting_mode is None:
        cutting_mode = "medium"
    
    # Get cutting mode configuration
    if cutting_mode not in CUTTING_MODES:
        raise ValueError(f"Unknown cutting mode: {cutting_mode}")
    
    mode_config = CUTTING_MODES[cutting_mode]
    MIN_DUR = mode_config["min_duration"]  # Use mode-specific minimum duration
    print(f"Using cutting mode '{cutting_mode}' with minimum duration {MIN_DUR}s")
    
    # Apply cutting mode to adjust beat timing FIRST
    beat_times = apply_cutting_mode(beat_times, cutting_mode, audio_path)

    # ---- Get aspect ratio preset from parameter or default to wide ----
    if aspect_ratio is None:
        aspect_preset = "wide"
    else:
        aspect_preset = aspect_ratio
    if aspect_preset not in ASPECT_RATIO_PRESETS:
        print(f"Warning: Unknown aspect ratio '{aspect_preset}', defaulting to 'wide'")
        aspect_preset = "wide"
    
    preset = ASPECT_RATIO_PRESETS[aspect_preset]
    WIDTH, HEIGHT = preset["width"], preset["height"]
    print(f"Aspect ratio preset: {aspect_preset} ({WIDTH}x{HEIGHT})")

    # Apply overrides if provided (UI may pass these)
    # Use local copies to avoid modifying module-level globals and keep scope clear
    if min_duration_override is not None:
        try:
            MIN_DUR = float(min_duration_override)
        except Exception:
            pass

    local_beat_stride = BEAT_STRIDE
    if beat_stride_override is not None:
        try:
            local_beat_stride = int(beat_stride_override)
        except Exception:
            pass

    local_snap_tol = SNAP_TOL
    if snap_tol_override is not None:
        try:
            local_snap_tol = float(snap_tol_override)
        except Exception:
            pass

    # ---- Auto-pick stride so each segment ≥ MIN_DUR (AFTER cutting mode) ----
    intervals = [b - a for a, b in zip(beat_times, beat_times[1:])]
    median_iv = statistics.median(intervals) if intervals else 0.5
    stride = max(1, round(MIN_DUR / median_iv))
    beat_times = beat_times[::stride]
    print(f"Auto stride: {stride} (median interval: {median_iv:.3f}s, min duration: {MIN_DUR}s)")
    print(f"After striding: {len(beat_times)} beats remaining")

    # Optional extra stride on top
    beat_times = beat_times[::local_beat_stride]
    print(f"After beat stride: {len(beat_times)} beats remaining")

    # ---- Get clips dir from parameter or default to media_samples/ ----
    if clips_dir is None:
        clips_dir = Path("media_samples").resolve()
    else:
        clips_dir = Path(clips_dir).resolve()

    # ---- Load & normalize shots_map (if provided and not skipped) ----
    shots_map = {}
    if not skip_shots and Path(shots_json).exists():
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
    
    if skip_shots:
        print("Shot detection disabled - using time-based cutting only")
    elif not shots_map:
        print("No shots data available - using time-based cutting only")

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
    
    if not skip_shots and shots_map:
        print(f"Shots map has {len(shots_map)} entries:")
        for k in shots_map.keys():
            try:
                print(f"  '{k}'")
            except UnicodeEncodeError:
                print(f"  '{k.encode('ascii', 'replace').decode('ascii')}'")
    elif skip_shots:
        print("Shot detection disabled - skipping shots map")
    else:
        print("No shots data available")

    # Precompute durations for each clip from cache/database
    durations = {src: get_duration_from_cache(src) for src in videos}
    
    # Cursor per clip (seconds, local to clip)
    cursor = defaultdict(float)

    events = []
    
    # Pre-shuffle effect pool for random distribution
    effect_pool = []
    if selected_effects:
        # Estimate number of events (conservative)
        estimated_events = len(beat_times) - 1
        while len(effect_pool) < estimated_events:
            effect_pool.extend(selected_effects)
        random.shuffle(effect_pool)
    
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

        # Optional: snap to that clip's shot edges (only if shots are enabled)
        shots = []
        if not skip_shots:
            shots = shots_map.get(src, [])
            if not shots:
                # Try alternative path matching strategies - handle session directories gracefully
                try:
                    rel_path = str(Path(src).relative_to(Path.cwd())).replace("\\", "/")
                    shots = shots_map.get(rel_path, [])
                except ValueError:
                    # If relative path fails (e.g., session directory), try other strategies
                    pass
            if not shots:
                # Try filename-only matching
                filename = Path(src).name
                shots = shots_map.get(filename, [])
        
        def snap_edge(t):
            if not shots or skip_shots: return t
            best = t; best_d = local_snap_tol + 1
            for sh in shots:
                for edge in (sh["start"], sh["end"]):
                    d = abs(t - edge)
                    if d < best_d:
                        best_d, best = d, edge
            return best if best_d <= local_snap_tol else t

        s_snap = snap_edge(start)
        e_snap = snap_edge(end)
        if e_snap - s_snap < MIN_DUR:
            # if snapping made it too short, fall back to unsnapped
            s_snap, e_snap = start, end

        # Add punch-in effect for every 4th event
        effects = []
        if len(events) % 4 == 0:
            effects = ["punch_in:0.10"]  # 10% zoom on every 4th event
        
        # Add random transition effect if any are selected
        if selected_effects and effect_pool:
            event_index = len(events)  # Current event index
            if event_index < len(effect_pool):
                effects.append(effect_pool[event_index])

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


    # Calculate total duration from events
    total_duration = sum((event["out"] - event["in"]) for event in events)
    
    out = {
        "version": 1,
        "fps": FPS,
        "width": WIDTH,
        "height": HEIGHT,
        "audio": beats["audio"],
        "total_duration": round(total_duration, 3),
        "events": events
    }
    # Use atomic write to prevent corruption/stacking
    output_path = Path(out_json)
    os.makedirs(output_path.parent, exist_ok=True)
    tmp = output_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(out, indent=2), encoding='utf-8')
    tmp.replace(output_path)
    print(f"Wrote {out_json} with {len(events)} events.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate cutlist from beats and shots")
    parser.add_argument("beats_json", help="Path to beats JSON file")
    parser.add_argument("shots_json", help="Path to shots JSON file")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("out_json", help="Output cutlist JSON file")
    parser.add_argument("clips_dir", nargs="?", default="media_samples", help="Directory containing video clips")
    parser.add_argument("aspect_ratio", nargs="?", default="wide", help="Aspect ratio preset")
    parser.add_argument("cutting_mode", nargs="?", default="medium", help="Cutting mode")
    parser.add_argument("--skip-shots", action="store_true", help="Skip shot detection and use time-based cutting only")
    parser.add_argument("--effects", type=str, help="Comma-separated list of transition effects: flash,punch_in,fade_in,zoom_in,slide_left,slide_right")
    parser.add_argument("--min-duration", type=float, default=None, help="Override minimum cut duration (seconds)")
    parser.add_argument("--beat-stride", type=int, default=None, help="Extra beat stride (1 = every beat, 2 = every other)")
    parser.add_argument("--snap-tol", type=float, default=None, help="Shot snap tolerance in seconds")
    
    args = parser.parse_args()
    
    # For backward compatibility, also check sys.argv for positional arguments
    if len(sys.argv) >= 6 and not any(arg.startswith('-') for arg in sys.argv[1:]):
        # Old-style positional arguments - parse them properly
        beats_json = sys.argv[1]
        shots_json = sys.argv[2] 
        audio_path = sys.argv[3]
        out_json = sys.argv[4]
        clips_dir = sys.argv[5] if len(sys.argv) > 5 else None
        aspect_ratio = sys.argv[6] if len(sys.argv) > 6 else None  
        cutting_mode = sys.argv[7] if len(sys.argv) > 7 else None
        skip_shots = "--skip-shots" in sys.argv
        
        main(beats_json, shots_json, audio_path, out_json, clips_dir, aspect_ratio, cutting_mode, skip_shots, transition_effects=None, min_duration_override=None, beat_stride_override=None, snap_tol_override=None)
    else:
        # New argparse style
        main(
            args.beats_json,
            args.shots_json,
            args.audio_path,
            args.out_json,
            args.clips_dir,
            args.aspect_ratio,
            args.cutting_mode,
            args.skip_shots,
            getattr(args, 'effects', None),
            min_duration_override=args.min_duration,
            beat_stride_override=args.beat_stride,
            snap_tol_override=args.snap_tol,
        )
