import sys, json, time, argparse, subprocess, shlex
import numpy as np
from pathlib import Path
import hashlib
import os

# Set default encoding for Python 3 and force UTF-8 handling
import os
import locale

def stage_base_dir(arg):
    """Create and return base directory, ensuring cache and render dirs exist"""
    base = Path(arg) if arg else Path.cwd()
    (base / "cache").mkdir(parents=True, exist_ok=True)
    (base / "render").mkdir(parents=True, exist_ok=True)
    return base

def assert_beats_sane(beats_sec, audio_dur_sec=None):
    """Validate beats count vs audio duration to catch bad beats files early"""
    if not audio_dur_sec:
        return
    bpm_guess = (len(beats_sec) / audio_dur_sec) * 60
    if len(beats_sec) > audio_dur_sec * 6 or bpm_guess > 220:
        raise ValueError(f"Beats look wrong: {len(beats_sec)} beats over {audio_dur_sec}s (~{bpm_guess:.1f} BPM)")
    print(f"Beats sanity check passed: {len(beats_sec)} beats over {audio_dur_sec}s (~{bpm_guess:.1f} BPM)")

def get_file_hash(filepath):
    """Generate MD5 hash of a file for cache validation"""
    hash_md5 = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception:
        return None

def get_cache_key(stage, **params):
    """Generate cache key for a pipeline stage based on parameters"""
    # Sort parameters to ensure consistent key generation
    param_str = json.dumps(params, sort_keys=True)
    cache_hash = hashlib.md5((stage + param_str).encode()).hexdigest()
    return cache_hash

def is_cache_valid(cache_key, dependencies, base_dir='.'):
    """Check if cached result is still valid based on file dependencies"""
    try:
        base = stage_base_dir(base_dir)
        cache_info_file = base / "cache" / f".cache_info_{cache_key}.json"
        if not cache_info_file.exists():
            return False
        
        with open(cache_info_file, 'r') as f:
            cache_info = json.load(f)
        
        # Check if all dependencies exist and haven't changed
        for dep_path in dependencies:
            if not Path(dep_path).exists():
                return False
            
            current_hash = get_file_hash(dep_path)
            stored_hash = cache_info.get("file_hashes", {}).get(dep_path)
            if current_hash != stored_hash:
                return False
        
        return True
    except Exception:
        return False

def save_cache_info(cache_key, dependencies, base_dir='.'):
    """Save cache validation info for future checks"""
    try:
        base = stage_base_dir(base_dir)
        cache_dir = base / "cache"
        cache_dir.mkdir(exist_ok=True)
        
        file_hashes = {}
        for dep_path in dependencies:
            if Path(dep_path).exists():
                file_hashes[dep_path] = get_file_hash(dep_path)
        
        cache_info = {
            "cache_key": cache_key,
            "timestamp": time.time(),
            "file_hashes": file_hashes,
            "dependencies": dependencies
        }
        
        cache_info_file = cache_dir / f".cache_info_{cache_key}.json"
        with open(cache_info_file, 'w') as f:
            json.dump(cache_info, f, indent=2)
    except Exception:
        pass  # Non-critical if we can't save cache info

# Force UTF-8 encoding for all I/O operations
os.environ.setdefault('PYTHONIOENCODING', 'utf-8:replace')

# Try to set system locale to UTF-8
try:
    locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
except locale.Error:
    try:
        locale.setlocale(locale.LC_ALL, 'C.UTF-8')
    except locale.Error:
        try:
            # Windows fallback
            locale.setlocale(locale.LC_ALL, 'English_United States.utf8')
        except locale.Error:
            pass  # Use system default

# Ensure stdout/stderr use UTF-8
try:
    if hasattr(sys.stdout, 'reconfigure') and callable(getattr(sys.stdout, 'reconfigure', None)):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError, TypeError):
    pass  # Not available on this Python version or system

try:
    if hasattr(sys.stderr, 'reconfigure') and callable(getattr(sys.stderr, 'reconfigure', None)):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError, TypeError):
    pass  # Not available on this Python version or system

def safe_str(obj):
    """Safely convert any object to a UTF-8 string, handling encoding errors"""
    try:
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        elif isinstance(obj, str):
            # Ensure string is properly encoded/decoded
            return obj.encode('utf-8', errors='replace').decode('utf-8')
        else:
            return str(obj).encode('utf-8', errors='replace').decode('utf-8')
    except Exception:
        return "<unprintable>"

def emit(stage, progress=None, **kw):
    """Emit a JSON message with robust UTF-8 handling"""
    msg = {"stage": stage, **({} if progress is None else {"progress": progress}), **kw}
    try:
        # Recursively clean all string values in the message
        def clean_value(value):
            if isinstance(value, str):
                return safe_str(value)
            elif isinstance(value, bytes):
                return safe_str(value)
            elif isinstance(value, dict):
                return {k: clean_value(v) for k, v in value.items()}
            elif isinstance(value, (list, tuple)):
                return [clean_value(v) for v in value]
            else:
                return value
        
        cleaned_msg = clean_value(msg)
        
        # Use ensure_ascii=False to allow UTF-8 characters, but ensure everything is properly encoded
        json_str = json.dumps(cleaned_msg, ensure_ascii=False, separators=(',', ':'))
        
        # Ensure the JSON string itself is UTF-8 safe
        safe_json = safe_str(json_str)
        print(safe_json, flush=True)
        
    except Exception as e:
        # Fallback: emit a safe error message using ASCII only
        fallback_msg = {
            "stage": safe_str(stage), 
            "error": f"Message encoding error: {safe_str(str(e))[:100]}"
        }
        print(json.dumps(fallback_msg, ensure_ascii=True), flush=True)

def run_probe(clips_dir):
    """Probe all media files in clips_dir and cache metadata"""
    emit("probe", progress=0.0, message=f"Probing media files in {clips_dir}...")
    
    try:
        from pathlib import Path
        
        # Get path to the probe script  
        probe_script = Path(__file__).parent.parent / "analysis" / "probe_media.py"
        
        if not probe_script.exists():
            emit("probe", progress=0.0, error=f"Probe script not found: {probe_script}")
            return
            
        # Run the probe script with robust encoding handling
        result = subprocess.run([
            sys.executable, str(probe_script), clips_dir
        ], capture_output=True, text=False, check=True)
        
        # Decode output manually with error handling
        stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ""
        stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ""
        
        emit("probe", progress=1.0, message="Media probing completed successfully")
        
    except subprocess.CalledProcessError as e:
        # Decode stderr with error handling
        stderr_output = e.stderr.decode('utf-8', errors='replace') if e.stderr else "No stderr output"
        emit("probe", progress=0.0, error=f"Probe failed: {stderr_output}")
    except Exception as e:
        emit("probe", progress=0.0, error=f"Probe error: {safe_str(e)}")

def run_beats(song, engine="basic", base_dir='.', transition_effects=None):
    emit("beats", progress=0.0, message=f"Loading audio and analyzing beats (engine: {engine})...")
    
    # Ensure song path is properly decoded as UTF-8
    if isinstance(song, bytes):
        try:
            song = song.decode('utf-8')
        except UnicodeDecodeError:
            song = song.decode('utf-8', errors='replace')
    
    # Validate input file
    if not song or not song.strip():
        emit("beats", progress=0.0, error="No audio file provided")
        return
        
    from pathlib import Path
    import os
    
    # Normalize path and ensure proper encoding
    try:
        song_path = Path(os.path.normpath(song))
    except (OSError, ValueError) as e:
        emit("beats", progress=0.0, error=f"Invalid file path: {safe_str(str(e))}")
        return
        
    if not song_path.exists():
        emit("beats", progress=0.0, error=f"Audio file not found: {song}")
        return
        
    if not song_path.is_file():
        emit("beats", progress=0.0, error=f"Path is not a file: {song}")
        return
    
    # Check cache before proceeding with expensive analysis
    cache_key = get_cache_key("beats", engine=engine, song=str(song_path))
    if is_cache_valid(cache_key, [str(song_path)], base_dir):
        emit("beats", progress=0.1, message="Found valid cache, loading from cache...")
        try:
            base = stage_base_dir(base_dir)
            beats_file = base / "cache" / "beats.json"
            if beats_file.exists():
                beats_data = json.loads(beats_file.read_text(encoding='utf-8'))
                emit("beats", progress=1.0, message=f"Loaded {engine} beat detection from cache",
                     beats_count=len(beats_data.get("beats", [])),
                     tempo=beats_data.get("tempo_global", 0))
                return
        except Exception as e:
            emit("beats", progress=0.0, message=f"Cache load failed, proceeding with fresh analysis: {safe_str(e)}")
    
    try:
        if engine == "basic":
            # Use basic beat detection
            import librosa
            emit("beats", progress=0.2, message="Loading audio file...")
            # Use string path to ensure compatibility with librosa
            y, sr = librosa.load(str(song_path), sr=None, mono=True)
            emit("beats", progress=0.5, message="Detecting beats...")
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            
            # Convert tempo to scalar with proper safety checks
            tempo_scalar = 120.0  # Default fallback
            try:
                # Handle different types safely
                if hasattr(tempo, 'item'):
                    # Try to use item() method if available
                    item_method = getattr(tempo, 'item', None)
                    if callable(item_method):
                        try:
                            result = item_method()
                            tempo_scalar = float(result)  # type: ignore
                        except (ValueError, TypeError):
                            tempo_scalar = float(tempo)
                    else:
                        tempo_scalar = float(tempo)
                elif isinstance(tempo, (list, tuple)) and len(tempo) > 0:
                    # It's a list or tuple
                    tempo_scalar = float(tempo[0])
                else:
                    # It's a regular number
                    tempo_scalar = float(tempo)
            except (ValueError, TypeError, AttributeError):
                # Use fallback on any conversion error
                tempo_scalar = 120.0
            
            beats_data = {
                "audio": song.replace("\\", "/"),
                "sr": int(sr),
                "tempo_global": tempo_scalar,
                "beats": [{"time": float(t)} for t in beat_times]
            }
        else:
            # Use advanced beat detection (default)
            emit("beats", progress=0.2, message="Loading advanced beat detection...")
            from beats_adv import compute_advanced_beats
            beats_data = compute_advanced_beats(str(song_path), debug=True)
        
        # Save the results into base_dir/cache/beats.json using atomic write
        emit("beats", progress=0.8, message="Saving beat analysis...")
        try:
            base = stage_base_dir(base_dir)
            beats_out = base / "cache" / "beats.json"
            # Use atomic write to prevent corruption/stacking
            tmp = beats_out.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(beats_data, indent=2), encoding='utf-8')
            tmp.replace(beats_out)
            
            # Save cache info for future validation
            save_cache_info(cache_key, [str(song_path)], base_dir)
        except Exception as e:
            emit("beats", progress=0.0, error=f"Failed to save beats: {safe_str(e)}")
        
        emit("beats", progress=1.0, message=f"{engine.title()} beat detection completed", 
             beats_count=len(beats_data.get("beats", [])),
             tempo=beats_data.get("tempo_global", 0))
    except Exception as e:
        # Safely handle error messages that might contain non-UTF-8 characters
        error_msg = safe_str(e) or f"Unknown {type(e).__name__}"
        emit("beats", progress=0.0, error=f"Beat detection failed: {error_msg}")

def run_shots(clips_dir, base_dir='.'):
    emit("shots", progress=0.0)
    
    # Validate clips directory exists
    from pathlib import Path
    clips_path = Path(clips_dir)
    if not clips_path.exists() or not clips_path.is_dir():
        emit("shots", progress=0.0, error=f"Clips directory not found: {clips_dir}")
        return
    
    # Get list of video files for cache validation
    video_files = []
    for ext in ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm']:
        video_files.extend(str(f) for f in clips_path.glob(f'*{ext}'))
        video_files.extend(str(f) for f in clips_path.glob(f'*{ext.upper()}'))
    
    # Check cache before proceeding with expensive shot detection
    cache_key = get_cache_key("shots", clips_dir=clips_dir)
    if is_cache_valid(cache_key, video_files, base_dir):
        emit("shots", progress=0.1, message="Found valid cache, loading shots from cache...")
        try:
            base = stage_base_dir(base_dir)
            shots_file = base / "cache" / "shots.json"
            if shots_file.exists():
                emit("shots", progress=1.0, message="Loaded shot detection from cache")
                return
        except Exception as e:
            emit("shots", progress=0.0, message=f"Cache load failed, proceeding with fresh shot detection: {safe_str(e)}")
    
    try:
        # Use fast shot detection instead of slow PySceneDetect
        base = stage_base_dir(base_dir)
        output_path = str(base / "cache" / "shots.json")

        emit("shots", progress=0.5, message="Running fast shot detection...")
        result = subprocess.run([sys.executable, "analysis/detect_shots_fast.py", clips_dir, output_path, "2.0"],
                                capture_output=True, text=False, check=True)

        # Decode output manually with error handling
        stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ""
        stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ""
        
        # Save cache info for future validation
        save_cache_info(cache_key, video_files, base_dir)
        
        emit("shots", progress=1.0, message="Fast shot detection completed")
    except subprocess.CalledProcessError as e:
        # Decode stderr with error handling
        stderr_output = e.stderr.decode('utf-8', errors='replace') if e.stderr else "No stderr output"
        emit("shots", progress=0.0, error=f"Shot detection failed: {stderr_output}")
    except Exception as e:
        emit("shots", progress=0.0, error=f"Shot detection error: {safe_str(e)}")

def run_cutlist(song, clips_dir, preset="landscape", cutting_mode="medium", enable_shot_detection=True, transition_effects=None, base_dir='.'):
    emit("cutlist", progress=0.0)
    
    # Validate dependencies
    from pathlib import Path
    song_path = Path(song)
    clips_path = Path(clips_dir)
    
    if not song_path.exists():
        emit("cutlist", progress=0.0, error=f"Audio file not found: {song}")
        return
    
    if not clips_path.exists() or not clips_path.is_dir():
        emit("cutlist", progress=0.0, error=f"Clips directory not found: {clips_dir}")
        return
    
    # Get video files for cache validation
    video_files = []
    for ext in ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm']:
        video_files.extend(str(f) for f in clips_path.glob(f'*{ext}'))
        video_files.extend(str(f) for f in clips_path.glob(f'*{ext.upper()}'))
    
    # Check cache before proceeding with cutlist generation
    cache_key = get_cache_key("cutlist", song=str(song_path), clips_dir=clips_dir, 
                             preset=preset, cutting_mode=cutting_mode, 
                             enable_shot_detection=enable_shot_detection, 
                             transition_effects=transition_effects)
    
    # Dependencies include song, all video files, and intermediate results (beats.json, shots.json)
    base = stage_base_dir(base_dir)
    beats_json = base / "cache" / "beats.json"
    shots_json = base / "cache" / "shots.json"
    dependencies = [str(song_path)] + video_files
    if beats_json.exists():
        dependencies.append(str(beats_json))
    if shots_json.exists():
        dependencies.append(str(shots_json))
    
    if is_cache_valid(cache_key, dependencies, base_dir):
        emit("cutlist", progress=0.1, message="Found valid cache, loading cutlist from cache...")
        try:
            cutlist_file = base / "cache" / "cutlist.json"
            if cutlist_file.exists():
                emit("cutlist", progress=1.0, message="Loaded cutlist generation from cache")
                return
        except Exception as e:
            emit("cutlist", progress=0.0, message=f"Cache load failed, proceeding with fresh cutlist generation: {safe_str(e)}")
    
    try:
        # Call the existing build_cutlist.py script with correct arguments
        beats_json = str(base / "cache" / "beats.json")
        shots_json = str(base / "cache" / "shots.json")
        output_path = str(base / "cache" / "cutlist.json")

        # Delete old cutlist to prevent using stale data if generation fails
        cutlist_path = Path(output_path)
        if cutlist_path.exists():
            cutlist_path.unlink()

        # Build arguments for build_cutlist.py, passing the shot detection flag
        args = [sys.executable, "analysis/build_cutlist.py", 
                beats_json, shots_json, song, output_path, clips_dir, preset, cutting_mode]

        # Add the skip-shots flag if shot detection is disabled
        if not enable_shot_detection:
            args.append("--skip-shots")
        
        # Add the effects flag if enabled
        if transition_effects:
            args.append("--effects")
            args.append(transition_effects)

        result = subprocess.run(args, capture_output=True, text=False, check=True)

        # Decode output manually with error handling
        stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ""
        stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ""
        
        # Save cache info for future validation
        save_cache_info(cache_key, dependencies, base_dir)
        
        emit("cutlist", progress=1.0, message="Cutlist generation completed")
    except subprocess.CalledProcessError as e:
        # Decode stderr with error handling
        stderr_output = e.stderr.decode('utf-8', errors='replace') if e.stderr else "No stderr output"
        stdout_output = e.stdout.decode('utf-8', errors='replace') if e.stdout else "No stdout output"

        emit("cutlist", progress=0.0, error=f"Cutlist generation failed: {stderr_output}")
        # Also emit stdout for debugging
        if stdout_output:
            print(f"Cutlist stdout: {stdout_output}")
        if stderr_output:
            print(f"Cutlist stderr: {stderr_output}")

def parse_progress_line(line):
    """Parse ffmpeg progress line in key=value format"""
    if '=' in line:
        k, v = line.strip().split('=', 1)
        return {k: v}
    return {}

def run_render(proxy=True, ffmpeg_path=None, duration_s=None, preset="landscape", base_dir='.', global_effects=None):
    """Render final video using cutlist and settings with direct FFmpeg filter_complex"""
    import json
    import subprocess
    import time
    import os
    import sys
    from pathlib import Path
    
    if ffmpeg_path is None:
        # For testing, use simple ffmpeg command
        # TODO: In production, this should use Tauri sidecar
        ffmpeg_path = "ffmpeg"
    
    print(f"Debug: Using FFmpeg path: {ffmpeg_path}", file=sys.stderr, flush=True)
    
    emit("render", progress=0.05, msg="Starting render...")
    
    render_type = "proxy" if proxy else "final"
    
    # All presets use the same cutlist file generated by the workflow
    base = stage_base_dir(base_dir)
    cutlist_path = str(base / "cache" / "cutlist_small.json")  # Test with small cutlist
    out_path = str(base / "render" / f"fapptap_{render_type}.mp4")
    
    # Delete existing output file to ensure clean render
    try:
        if Path(out_path).exists():
            Path(out_path).unlink()
            print(f"Debug: Deleted existing output file: {out_path}", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"Debug: Could not delete existing output file: {e}", file=sys.stderr, flush=True)
    
    if not Path(cutlist_path).exists():
        emit("render", progress=0.0, error="No cutlist found. Please generate cutlist first.")
        return
    
    # Load cutlist
    try:
        with open(cutlist_path, 'r', encoding='utf-8') as f:
            cutlist = json.load(f)
    except Exception as e:
        emit("render", progress=0.0, error=f"Failed to read cutlist: {safe_str(e)}")
        return
    
    events = cutlist.get("events", [])
    if not events:
        emit("render", progress=0.0, error="No events found in cutlist")
        return
    
    audio_path = cutlist.get("audio", "")
    flashes = cutlist.get("flashes", [])  # Load flash windows from cutlist
    
    # Check cache before proceeding with expensive render
    cache_key = get_cache_key("render", proxy=proxy, duration_s=duration_s, preset=preset, 
                             cutlist_path=cutlist_path)
    
    # Dependencies include cutlist file, audio file, and all video source files
    dependencies = [cutlist_path]
    if audio_path and Path(audio_path).exists():
        dependencies.append(audio_path)
    for event in events:
        src_path = event.get("src", "")
        if Path(src_path).exists():
            dependencies.append(src_path)
    
    render_type = "proxy" if proxy else "final"
    out_path = str(base / "render" / f"fapptap_{render_type}.mp4")
    
    # Ensure render directory exists
    render_dir = base / "render"
    render_dir.mkdir(parents=True, exist_ok=True)
    print(f"Debug: Created render directory: {render_dir}", file=sys.stderr, flush=True)
    
    if is_cache_valid(cache_key, dependencies, base_dir) and Path(out_path).exists():
        emit("render", progress=0.1, msg="Found valid cache, skipping render...")
        emit("render", progress=1.0, msg=f"Loaded {render_type} render from cache", 
             output_path=out_path)
        return
    
    target_width = cutlist.get("width", 1920)
    target_height = cutlist.get("height", 1080)
    target_fps = cutlist.get("fps", 60)
    
    emit("render", progress=0.1, msg=f"Processing {len(events)} video clips...")
    
    # Verify that source files exist
    missing_files = []
    for event in events:
        src_path = event.get("src", "")
        if not Path(src_path).exists():
            missing_files.append(src_path)
    
    if missing_files:
        emit("render", progress=0.0, error=f"Missing source files: {missing_files[:3]}{'...' if len(missing_files) > 3 else ''}")
        return
    
    # Use direct rendering approach - no batching, single FFmpeg command
    print(f"Debug: About to render to output path: {out_path}", file=sys.stderr, flush=True)
    success = render_direct_filter_complex(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path, flashes, global_effects)
    
    print(f"Debug: Render function returned success={success}", file=sys.stderr, flush=True)
    print(f"Debug: Output file exists after render: {Path(out_path).exists()}", file=sys.stderr, flush=True)
    if Path(out_path).exists():
        print(f"Debug: Output file size: {Path(out_path).stat().st_size} bytes", file=sys.stderr, flush=True)
    
    if success:
        # Save cache info for future validation
        save_cache_info(cache_key, dependencies, base_dir)
    
    if not success:
        return  # Error already emitted


def build_enable_expr(flashes):
    """Build FFmpeg enable expression from flash windows"""
    if not flashes:
        return ""
    # Sum of between(...) terms, e.g. between(t,1.23,1.28)+between(t,3.45,3.50)
    return "+".join(
        f"between(t,{f['start']:.3f},{f['end']:.3f})" 
        for f in flashes
    )

def render_direct_filter_complex(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path, flashes=None, global_effects=None):
    """Render using a single FFmpeg filter_complex command - no intermediate files"""
    import subprocess
    import time
    from pathlib import Path
    
    if global_effects is None:
        global_effects = []
    
    print(f"DEBUG: Global effects: {global_effects}", file=sys.stderr, flush=True)
    
    try:
        # Calculate total expected duration for progress tracking
        total_duration_s = sum(event["out"] - event["in"] for event in events if event["out"] > event["in"])
        
        # Group events by source file to optimize input handling
        # For very large numbers of clips, we can use input seeking instead of many inputs
        file_usage = {}
        for i, event in enumerate(events):
            src_path = event["src"]
            if src_path not in file_usage:
                file_usage[src_path] = []
            file_usage[src_path].append((i, event))
        
        emit("render", progress=0.15, msg=f"Building filter complex for {len(events)} clips from {len(file_usage)} source files...")
        
        # For too many clips, we might hit command line limits, so batch if needed
        if len(events) > 200:  # Increased limit - most systems can handle 200+ clips
            return render_with_smart_batching(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path, global_effects)
        
        # Build FFmpeg command with filter_complex
        input_args = []
        filter_parts = []
        
        # Add audio input first if available
        audio_input_index = -1
        if audio_path and Path(audio_path).exists():
            input_args.extend(["-i", audio_path])
            audio_input_index = 0
        
        # Add video inputs - one input per unique source file
        input_map = {}  # src_path -> input_index
        for src_path in file_usage.keys():
            input_idx = len(input_args) // 2
            input_args.extend(["-i", src_path])
            input_map[src_path] = input_idx
        
        # Build filter for each clip
        clip_outputs = []
        for i, event in enumerate(events):
            src_path = event["src"]
            in_time = event["in"]
            out_time = event["out"]
            duration = out_time - in_time
            
            if duration <= 0:
                continue
            
            input_idx = input_map[src_path]
            
            # Parse per-clip effects
            clip_effects = {}
            if "effects" in event:
                print(f"DEBUG: Event {i} has effects: {event['effects']}", file=sys.stderr, flush=True)
                # Convert effects list to dictionary
                for effect in event["effects"]:
                    if ":" in effect:
                        key, value = effect.split(":", 1)
                        clip_effects[key] = value
                    else:
                        clip_effects[effect] = True
                print(f"DEBUG: Parsed clip_effects for event {i}: {clip_effects}", file=sys.stderr, flush=True)
            
            # Create video filter for this clip: seek, trim, scale to fill and crop
            video_filter = (f"[{input_idx}:v]trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS,"
                           f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                           f"crop={target_width}:{target_height},"
                           f"fps={target_fps},format=yuv420p,setsar=1")
            
            # Apply per-clip effects
            filter_chain = [f"[{input_idx}:v]trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS"]
            intermediate_label = f"trimmed{i}"
            
            # Apply punch_in zoom effect if present
            if "punch_in" in clip_effects:
                zoom_factor = float(clip_effects["punch_in"])
                zoom_filter = f"scale=iw*{zoom_factor}:ih*{zoom_factor},crop={target_width}:{target_height}"
                filter_chain.append(f"[{intermediate_label}]{zoom_filter}[zoomed{i}]")
                intermediate_label = f"zoomed{i}"
            else:
                # Standard scale and crop
                filter_chain.append(f"[{intermediate_label}]scale={target_width}:{target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height}[scaled{i}]")
                intermediate_label = f"scaled{i}"
            
            # Apply flash effect if enabled globally or per-clip
            flash_enabled = "flash" in global_effects if global_effects else False
            if "flash_transition" in clip_effects or flash_enabled:
                # Add 50ms brightness flash at start of clip
                flash_filter = f"eq=brightness=0.4:enable='between(t,0,0.05)'"
                filter_chain.append(f"[{intermediate_label}]{flash_filter}[flashed{i}]")
                intermediate_label = f"flashed{i}"
            
            # Apply fade_in effect if present
            if "fade_in" in clip_effects:
                fade_duration = float(clip_effects["fade_in"])
                fade_filter = f"fade=in:0:{int(fade_duration * target_fps)}"
                filter_chain.append(f"[{intermediate_label}]{fade_filter}[faded{i}]")
                intermediate_label = f"faded{i}"
            
            # Apply zoom_in effect if present
            if "zoom_in" in clip_effects:
                zoom_duration = float(clip_effects["zoom_in"])
                # Gradual zoom from 1.0 to 1.2 over specified duration
                zoom_filter = f"scale=iw*'1+0.2*min(t/{zoom_duration},1)':ih*'1+0.2*min(t/{zoom_duration},1)',crop={target_width}:{target_height}"
                filter_chain.append(f"[{intermediate_label}]{zoom_filter}[zoomed_in{i}]")
                intermediate_label = f"zoomed_in{i}"
            
            # Apply slide effects if present
            if "slide_left" in clip_effects:
                slide_duration = float(clip_effects["slide_left"])
                # Slide in from right edge over specified duration
                slide_filter = f"crop={target_width}:{target_height}:'w*min(t/{slide_duration},1)':0"
                filter_chain.append(f"[{intermediate_label}]{slide_filter}[slid_left{i}]")
                intermediate_label = f"slid_left{i}"
            
            if "slide_right" in clip_effects:
                slide_duration = float(clip_effects["slide_right"])
                # Slide in from left edge over specified duration  
                slide_filter = f"crop={target_width}:{target_height}:'w*(1-min(t/{slide_duration},1))':0"
                filter_chain.append(f"[{intermediate_label}]{slide_filter}[slid_right{i}]")
                intermediate_label = f"slid_right{i}"
            
            # Finalize with fps and format
            filter_chain.append(f"[{intermediate_label}]fps={target_fps},format=yuv420p,setsar=1[v{i}]")
            
            # Combine the full filter chain for this clip
            video_filter = ",".join([part.split(']', 1)[-1] if ']' in part else part for part in filter_chain])
            video_filter = f"[{input_idx}:v]{video_filter}"
            
            filter_parts.append(video_filter)
            clip_outputs.append(f"[v{i}]")
            
            # Debug: Print the first few filters to see what's being generated
            if i < 2:
                print(f"DEBUG direct: Clip {i} filter: {video_filter}", file=sys.stderr, flush=True)
        
        if not clip_outputs:
            emit("render", progress=0.0, error="No valid video clips found")
            return False
        
        emit("render", progress=0.2, msg=f"Concatenating {len(clip_outputs)} processed clips...")
        
        # Concatenate all video streams
        video_concat = "".join(clip_outputs) + f"concat=n={len(clip_outputs)}:v=1:a=0[outv]"
        filter_parts.append(video_concat)
        
        # Add flash effect if we have flash windows
        last_label = "outv"
        if flashes:
            enable_expr = build_enable_expr(flashes)
            if enable_expr:
                # Use brightness pop for reliable, fast flash effect
                flash_filter = f"[{last_label}]eq=brightness=0.35:contrast=1.1:enable='{enable_expr}'[vf_flash]"
                filter_parts.append(flash_filter)
                last_label = "vf_flash"
                print(f"DEBUG: Applied flash effect with {len(flashes)} windows", file=sys.stderr, flush=True)
        
        # Combine all filters
        filter_complex = ";".join(filter_parts)
        
        # Build full FFmpeg command
        base_args = [ffmpeg_path, "-y", "-hide_banner", "-nostats", "-progress", "pipe:1"]
        
        # Add all inputs
        cmd_args = base_args + input_args
        
        # Add filter complex
        cmd_args.extend(["-filter_complex", filter_complex])
        
        # Map video output using the final label
        cmd_args.extend(["-map", f"[{last_label}]"])
        
        # Add audio if available - loop to match video duration
        if audio_input_index >= 0:
            # Calculate how many times to loop the audio
            audio_duration = total_duration_s  # We'll let FFmpeg handle the looping
            cmd_args.extend(["-stream_loop", "-1", "-map", f"{audio_input_index}:a"])
            cmd_args.extend(["-c:a", "aac", "-b:a", "128k"])
            cmd_args.extend(["-t", str(total_duration_s)])  # Limit to video duration
            cmd_args.extend(["-shortest"])  # Stop when shortest stream ends
        else:
            cmd_args.extend(["-an"])  # No audio
        
        # Video encoding settings
        if proxy:
            # Fast proxy settings
            cmd_args.extend(["-c:v", "h264", "-crf", "28", "-preset", "ultrafast"])
        else:
            # High quality final settings  
            cmd_args.extend(["-c:v", "h264", "-crf", "20", "-preset", "medium"])
        
        # Output path
        cmd_args.append(out_path)
        
        emit("render", progress=0.25, msg="Starting FFmpeg render...")
        
        # Execute FFmpeg with progress tracking
        p = subprocess.Popen(cmd_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, universal_newlines=True, encoding='utf-8', errors='replace')
        
        if not p.stdout:
            emit("render", progress=0.0, error="Failed to capture stdout from ffmpeg process")
            return False
        
        out_time_ms = 0
        
        while True:
            line = p.stdout.readline()
            if not line:
                if p.poll() is not None:
                    break
                time.sleep(0.01)
                continue
                
            kv = parse_progress_line(line)
            if "out_time_ms" in kv:
                try: 
                    out_time_ms = int(kv["out_time_ms"])
                    # Convert microseconds to seconds for progress calculation
                    out_time_s = out_time_ms / 1_000_000
                    if total_duration_s and total_duration_s > 0:
                        # Calculate progress based on total expected output duration
                        prog = max(0.0, min(1.0, out_time_s / total_duration_s))
                        prog = 0.25 + (prog * 0.75)  # Scale from 0.25 to 1.0
                        emit("render", progress=prog, out_time_s=out_time_s, total_duration=total_duration_s)
                except ValueError: 
                    pass
            elif "speed" in kv:
                emit("render", speed=kv["speed"])
            elif "progress" in kv and kv["progress"] == "end":
                emit("render", progress=1.0, msg="Render completed successfully")
        
        code = p.wait()
        
        if code == 0:
            emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=out_path)
            return True
        else:
            # Capture any remaining stderr
            stderr_output = ""
            if p.stderr:
                stderr_output = p.stderr.read()
            emit("render", progress=0.0, error=f"Render failed with exit code {code}. stderr: {stderr_output}")
            return False
            
    except FileNotFoundError as e:
        emit("render", progress=0.0, error=f"FFmpeg not found at path: {ffmpeg_path}. Error: {safe_str(e)}")
        return False
    except OSError as e:
        emit("render", progress=0.0, error=f"OS error running FFmpeg: {safe_str(e)}")
        return False
    except Exception as e:
        emit("render", progress=0.0, error=f"Render failed: {safe_str(e)}")
        return False


def render_with_smart_batching(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path, global_effects=None):
    """Handle very large numbers of clips by batching smartly"""
    import tempfile
    import subprocess
    import os
    import shutil
    from pathlib import Path
    
    max_clips_per_batch = 100  # Increased limit for better performance with many clips
    batch_files = []
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            emit("render", progress=0.2, msg=f"Processing {len(events)} clips in batches...")
            
            # Process clips in batches
            for batch_idx in range(0, len(events), max_clips_per_batch):
                batch_events = events[batch_idx:batch_idx + max_clips_per_batch]
                batch_output = os.path.join(temp_dir, f"batch_{batch_idx//max_clips_per_batch}.mp4")
                
                batch_progress = 0.2 + (batch_idx / len(events)) * 0.6
                emit("render", progress=batch_progress, 
                     msg=f"Rendering batch {batch_idx//max_clips_per_batch + 1} with {len(batch_events)} clips...")
                
                # Use direct rendering for this batch (no audio at batch level)
                if not render_batch_no_audio(batch_events, target_width, target_height, target_fps, proxy, batch_output, ffmpeg_path, global_effects):
                    return False
                
                batch_files.append(batch_output)
            
            if not batch_files:
                emit("render", progress=0.0, error="No valid batches were created")
                return False
            
            # Concatenate all batch files with audio
            return concatenate_batches_with_audio(batch_files, audio_path, events, render_type, out_path, ffmpeg_path)
                    
    except Exception as e:
        emit("render", progress=0.0, error=f"Smart batch rendering failed: {safe_str(e)}")
        return False


def render_batch_no_audio(events, target_width, target_height, target_fps, proxy, output_path, ffmpeg_path, global_effects=None):
    """Render a batch of clips without audio"""
    # Implementation similar to render_direct_filter_complex but without audio
    # This is a simplified version for batching
    import subprocess
    from pathlib import Path
    
    # Group by source file
    file_usage = {}
    for i, event in enumerate(events):
        src_path = event["src"]
        if src_path not in file_usage:
            file_usage[src_path] = []
        file_usage[src_path].append((i, event))
    
    # Build FFmpeg command
    input_args = []
    filter_parts = []
    
    # Add inputs
    input_map = {}
    for src_path in file_usage.keys():
        input_idx = len(input_args) // 2
        input_args.extend(["-i", src_path])
        input_map[src_path] = input_idx
    
    # Build filters
    clip_outputs = []
    for i, event in enumerate(events):
        src_path = event["src"]
        in_time = event["in"]
        out_time = event["out"]
        duration = out_time - in_time
        
        if duration <= 0:
            continue
        
        input_idx = input_map[src_path]
        
        # Parse per-clip effects
        clip_effects = {}
        if "effects" in event:
            # Convert effects list to dictionary
            for effect in event["effects"]:
                if ":" in effect:
                    key, value = effect.split(":", 1)
                    clip_effects[key] = value
                else:
                    clip_effects[effect] = True
        
        # Apply effects-aware filter chain (same logic as direct render)
        filter_chain = []
        intermediate_label = f"trimmed{i}"
        
        # Start with trim and setpts
        filter_chain.append(f"trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS")
        
        # Apply punch_in zoom effect if present
        if "punch_in" in clip_effects:
            zoom_factor = float(clip_effects["punch_in"])
            zoom_filter = f"scale=iw*{zoom_factor}:ih*{zoom_factor},crop={target_width}:{target_height}"
            filter_chain.append(zoom_filter)
        else:
            # Standard scale and crop
            filter_chain.append(f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height}")
        
        # Apply flash effect if enabled globally or per-clip
        flash_enabled = "flash" in global_effects if global_effects else False
        if "flash_transition" in clip_effects or flash_enabled:
            # Add 50ms brightness flash at start of clip
            flash_filter = f"eq=brightness=0.4:enable='between(t,0,0.05)'"
            filter_chain.append(flash_filter)
        
        # Finalize with fps and format
        filter_chain.append(f"fps={target_fps},format=yuv420p,setsar=1")
        
        # Combine the full filter chain for this clip
        video_filter = f"[{input_idx}:v]{','.join(filter_chain)}[v{i}]"
        filter_parts.append(video_filter)
        clip_outputs.append(f"[v{i}]")
        
        # Debug: Print the first few filters to see what's being generated
        if i < 2:
            print(f"DEBUG batch: Clip {i} filter: {video_filter}", file=sys.stderr, flush=True)
    
    if not clip_outputs:
        return False
    
    # Concatenate
    video_concat = "".join(clip_outputs) + f"concat=n={len(clip_outputs)}:v=1:a=0[outv]"
    filter_parts.append(video_concat)
    filter_complex = ";".join(filter_parts)
    
    # Build command
    cmd_args = [ffmpeg_path, "-y", "-hide_banner"] + input_args
    cmd_args.extend(["-filter_complex", filter_complex, "-map", "[outv]"])
    cmd_args.extend(["-an"])  # No audio
    
    # Video encoding
    if proxy:
        cmd_args.extend(["-c:v", "h264", "-crf", "28", "-preset", "ultrafast"])
    else:
        cmd_args.extend(["-c:v", "h264", "-crf", "20", "-preset", "medium"])
    
    cmd_args.append(output_path)
    
    # Execute
    result = subprocess.run(cmd_args, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return result.returncode == 0


def concatenate_batches_with_audio(batch_files, audio_path, events, render_type, final_out_path, ffmpeg_path):
    """Concatenate batch files and add audio"""
    import tempfile
    import subprocess
    import shutil
    from pathlib import Path
    
    emit("render", progress=0.85, msg="Concatenating final output with audio...")
    
    # Calculate total video duration
    total_duration = sum(event["out"] - event["in"] for event in events if event["out"] > event["in"])
    
    if len(batch_files) == 1:
        # Only one batch - add audio directly
        if audio_path and Path(audio_path).exists():
            audio_cmd = [
                ffmpeg_path, "-y", 
                "-i", batch_files[0],  # Video input
                "-stream_loop", "-1", "-i", audio_path,  # Looped audio
                "-c:v", "copy", 
                "-c:a", "aac", "-b:a", "128k",
                "-map", "0:v", "-map", "1:a",
                "-t", str(total_duration),  # Limit to video duration
                "-shortest",  # Stop when shortest stream ends
                final_out_path
            ]
            
            result = subprocess.run(audio_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            if result.returncode == 0:
                emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=final_out_path)
                return True
            else:
                emit("render", progress=0.0, error=f"Audio sync failed: {result.stderr}")
                return False
        else:
            # No audio, just copy the batch file
            shutil.copy2(batch_files[0], final_out_path)
            emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=final_out_path)
            return True
    else:
        # Multiple batches - concatenate them
        with tempfile.TemporaryDirectory() as temp_dir:
            import os
            concat_list_path = os.path.join(temp_dir, "concat_list.txt")
            with open(concat_list_path, 'w') as f:
                for batch_file in batch_files:
                    f.write(f"file '{batch_file}'\n")
            
            concat_cmd = [
                ffmpeg_path, "-y", "-f", "concat", "-safe", "0", 
                "-i", concat_list_path
            ]
            
            # Add audio if available
            if audio_path and Path(audio_path).exists():
                concat_cmd.extend(["-stream_loop", "-1", "-i", audio_path])
                concat_cmd.extend([
                    "-c:v", "copy", 
                    "-c:a", "aac", "-b:a", "128k",
                    "-map", "0:v", "-map", "1:a",
                    "-t", str(total_duration),
                    "-shortest"
                ])
            else:
                concat_cmd.extend(["-c", "copy"])
            
            concat_cmd.append(final_out_path)
            
            result = subprocess.run(concat_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            if result.returncode == 0:
                emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=final_out_path)
                return True
            else:
                emit("render", progress=0.0, error=f"Final concatenation failed: {result.stderr}")
                return False


if __name__ == "__main__":
    # Ensure proper UTF-8 handling for command line arguments
    import locale
    import sys
    
    # Set locale to handle UTF-8 properly
    try:
        locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')
    except locale.Error:
        try:
            locale.setlocale(locale.LC_ALL, 'C.UTF-8')
        except locale.Error:
            pass  # Use system default
    
    # Ensure sys.argv is properly decoded as UTF-8
    if sys.version_info >= (3, 0):
        # In Python 3, sys.argv should already be properly decoded
        # But we can ensure it's properly handled
        for i, arg in enumerate(sys.argv):
            if isinstance(arg, bytes):
                try:
                    sys.argv[i] = arg.decode('utf-8', errors='replace')
                except (UnicodeDecodeError, AttributeError):
                    sys.argv[i] = str(arg)
    
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["probe","beats","shots","cutlist","render"])
    ap.add_argument("--song", default="")
    ap.add_argument("--clips", default="")
    ap.add_argument("--base_dir", default=".", help="Base directory for cache/render output")
    ap.add_argument("--proxy", action="store_true")
    ap.add_argument("--preset", default="landscape", choices=["landscape", "portrait", "square"])
    ap.add_argument("--cutting_mode", default="medium", choices=["slow", "medium", "fast", "ultra_fast", "random", "auto"])
    ap.add_argument("--engine", default="advanced", choices=["basic", "advanced"])
    ap.add_argument("--enable_shot_detection", action="store_true", help="Enable shot detection for cutlist generation")
    # Remove old flash_transition argument - now using effects
    
    # Cut settings arguments (from UI)
    ap.add_argument("--min_clip_length", type=float, default=0.5, help="Minimum clip length in seconds")
    ap.add_argument("--max_clip_length", type=float, default=8.0, help="Maximum clip length in seconds")
    ap.add_argument("--min_beats", type=int, default=4, help="Minimum beats per clip")
    ap.add_argument("--crossfade_duration", type=float, default=0.1, help="Crossfade duration in seconds")
    ap.add_argument("--prefer_downbeats", action="store_true", help="Prefer cutting on downbeats")
    ap.add_argument("--respect_shot_boundaries", action="store_true", help="Respect shot boundaries when cutting")
    ap.add_argument("--energy_threshold", type=float, default=0.5, help="Energy threshold for clip selection")
    ap.add_argument("--effects", default="", help="Comma-separated global effects (e.g., flash,zoom)")
    
    args = ap.parse_args()

    # Clean and validate UTF-8 encoding for path arguments
    if hasattr(args, 'song') and args.song:
        args.song = safe_str(args.song)
    if hasattr(args, 'clips') and args.clips:
        args.clips = safe_str(args.clips)
    if hasattr(args, 'base_dir') and args.base_dir:
        args.base_dir = safe_str(args.base_dir)

    # Debug: Show all arguments received
    import sys
    print(f"Debug: Worker called with arguments: {sys.argv}", file=sys.stderr, flush=True)
    print(f"Debug: Parsed args - stage: {args.stage}, song: '{args.song}', clips: '{args.clips}', engine: {args.engine}, preset: {args.preset}, enable_shot_detection: {args.enable_shot_detection}", file=sys.stderr, flush=True)

    if args.stage == "probe":
        if not args.clips:
            emit("probe", progress=0.0, error="No clips directory provided. Please select a clips directory first.")
        else:
            run_probe(args.clips)
    if args.stage == "beats":
        if not args.song:
            emit("beats", progress=0.0, error="No song file provided. Please select an audio file first.")
        else:
            run_beats(args.song, args.engine, base_dir=getattr(args, 'base_dir', '.'))
    if args.stage == "shots":
        if not args.clips:
            emit("shots", progress=0.0, error="No clips directory provided. Please select a clips directory first.")
        else:
            run_shots(args.clips, base_dir=getattr(args, 'base_dir', '.'))
    if args.stage == "cutlist": run_cutlist(args.song, args.clips, args.preset, args.cutting_mode, args.enable_shot_detection, args.effects, base_dir=getattr(args, 'base_dir', '.'))
    if args.stage == "render":  
        # Parse global effects from comma-separated string
        global_effects = [effect.strip() for effect in args.effects.split(',') if effect.strip()] if args.effects else []
        run_render(proxy=args.proxy, preset=args.preset, base_dir=getattr(args, 'base_dir', '.'), global_effects=global_effects)
