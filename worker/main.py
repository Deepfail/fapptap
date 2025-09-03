import sys, json, time, argparse, subprocess, shlex
from pathlib import Path

def emit(stage, progress=None, **kw):
    msg = {"stage": stage, **({} if progress is None else {"progress": progress}), **kw}
    print(json.dumps(msg), flush=True)

def run_beats(song, engine="advanced"):
    emit("beats", progress=0.0, message=f"Loading audio and analyzing beats (engine: {engine})...")
    
    # Validate input file
    if not song or not song.strip():
        emit("beats", progress=0.0, error="No audio file provided")
        return
        
    from pathlib import Path
    song_path = Path(song)
    if not song_path.exists():
        emit("beats", progress=0.0, error=f"Audio file not found: {song}")
        return
        
    if not song_path.is_file():
        emit("beats", progress=0.0, error=f"Path is not a file: {song}")
        return
    
    try:
        if engine == "basic":
            # Use basic beat detection
            import librosa
            emit("beats", progress=0.2, message="Loading audio file...")
            y, sr = librosa.load(song, sr=None, mono=True)
            emit("beats", progress=0.5, message="Detecting beats...")
            tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')
            beat_times = librosa.frames_to_time(beat_frames, sr=sr)
            
            beats_data = {
                "audio": song.replace("\\", "/"),
                "sr": int(sr),
                "tempo_global": float(tempo.item()) if hasattr(tempo, 'item') else float(tempo),
                "beats": [{"time": float(t)} for t in beat_times]
            }
        else:
            # Use advanced beat detection (default)
            emit("beats", progress=0.2, message="Loading advanced beat detection...")
            from beats_adv import compute_advanced_beats
            beats_data = compute_advanced_beats(song, debug=True)
        
        # Save the results
        emit("beats", progress=0.8, message="Saving beat analysis...")
        from pathlib import Path
        output_path = "cache/beats.json"
        Path("cache").mkdir(exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(beats_data, f, indent=2)
        
        emit("beats", progress=1.0, message=f"{engine.title()} beat detection completed", 
             beats_count=len(beats_data.get("beats", [])),
             tempo=beats_data.get("tempo_global", 0))
    except Exception as e:
        emit("beats", progress=0.0, error=f"Beat detection failed: {str(e)}")

def run_shots(clips_dir):
    emit("shots", progress=0.0)
    try:
        # Call the existing detect_shots.py script with correct arguments
        output_path = "cache/shots.json"
        from pathlib import Path
        Path("cache").mkdir(exist_ok=True)
        
        result = subprocess.run([sys.executable, "analysis/detect_shots.py", clips_dir, output_path], 
                              capture_output=True, text=True, check=True)
        emit("shots", progress=1.0, message="Shot detection completed")
    except subprocess.CalledProcessError as e:
        emit("shots", progress=0.0, error=f"Shot detection failed: {e.stderr}")

def run_cutlist(song, clips_dir):
    emit("cutlist", progress=0.0)
    try:
        # Call the existing build_cutlist.py script with correct arguments
        beats_json = "cache/beats.json"
        shots_json = "cache/shots.json"
        output_path = "cache/cutlist.json"
        from pathlib import Path
        Path("cache").mkdir(exist_ok=True)
        
        result = subprocess.run([sys.executable, "analysis/build_cutlist.py", 
                               beats_json, shots_json, song, output_path, clips_dir], 
                              capture_output=True, text=True, check=True)
        emit("cutlist", progress=1.0, message="Cutlist generation completed")
    except subprocess.CalledProcessError as e:
        emit("cutlist", progress=0.0, error=f"Cutlist generation failed: {e.stderr}")

def parse_progress_line(line):
    """Parse ffmpeg progress line in key=value format"""
    if '=' in line:
        k, v = line.strip().split('=', 1)
        return {k: v}
    return {}

def run_render(proxy=True, ffmpeg_path="ffmpeg", duration_s=None):
    render_type = "proxy" if proxy else "final"
    out_path = f"render/{render_type}_preview.mp4"
    Path("render").mkdir(exist_ok=True)
    
    # For demo purposes, use a basic command with progress reporting
    # In a real implementation, this would read from cutlist.json and build a complex filtergraph
    
    # Try to find a test input file or use a fallback
    test_inputs = ["media_samples/test.mp4", "cache/test.mp4", "media_samples/76319854.mp4"]
    input_file = None
    
    for test_input in test_inputs:
        if Path(test_input).exists():
            input_file = test_input
            break
    
    if not input_file:
        emit("render", progress=0.0, error="No input file found for rendering test")
        return
    
    # Get duration from ffprobe if not provided
    if duration_s is None:
        try:
            probe_cmd = f'{ffmpeg_path.replace("ffmpeg", "ffprobe")} -v quiet -show_entries format=duration -of csv=p=0 "{input_file}"'
            result = subprocess.run(shlex.split(probe_cmd), capture_output=True, text=True, check=True)
            duration_s = float(result.stdout.strip())
        except:
            duration_s = 30.0  # Default fallback
    
    # Build ffmpeg command with progress reporting
    cmd = f'{ffmpeg_path} -y -hide_banner -nostats -progress pipe:1 -i "{input_file}" -c:v h264 -crf 23 -c:a aac -t 10 "{out_path}"'
    
    emit("render", progress=0.0, msg=f"Starting {render_type} render", input=input_file, duration=duration_s)
    
    try:
        p = subprocess.Popen(shlex.split(cmd), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, universal_newlines=True)
        
        if not p.stdout:
            emit("render", progress=0.0, error="Failed to capture stdout from ffmpeg process")
            return
        
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
                    if duration_s and duration_s > 0:
                        # Calculate progress but cap at 10s since we're using -t 10
                        target_duration = min(duration_s, 10.0)
                        prog = max(0.0, min(1.0, out_time_s / target_duration))
                        emit("render", progress=prog, out_time_s=out_time_s, target_duration=target_duration)
                except ValueError: 
                    pass
            elif "speed" in kv:
                emit("render", speed=kv["speed"])
            elif "progress" in kv and kv["progress"] == "end":
                emit("render", progress=1.0, msg="Render completed successfully")
        
        code = p.wait()
        
        if code == 0:
            emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=out_path)
        else:
            emit("render", progress=0.0, error=f"Render failed with exit code {code}")
            
    except FileNotFoundError:
        emit("render", progress=0.0, error=f"FFmpeg not found at path: {ffmpeg_path}")
    except Exception as e:
        emit("render", progress=0.0, error=f"Render failed: {str(e)}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["beats","shots","cutlist","render"])
    ap.add_argument("--song", default="")
    ap.add_argument("--clips", default="")
    ap.add_argument("--proxy", action="store_true")
    ap.add_argument("--engine", default="advanced", choices=["basic", "advanced"])
    args = ap.parse_args()

    # Debug: Show all arguments received
    import sys
    print(f"Debug: Worker called with arguments: {sys.argv}", file=sys.stderr, flush=True)
    print(f"Debug: Parsed args - stage: {args.stage}, song: '{args.song}', clips: '{args.clips}', engine: {args.engine}", file=sys.stderr, flush=True)

    if args.stage == "beats":
        if not args.song:
            emit("beats", progress=0.0, error="No song file provided. Please select an audio file first.")
        else:
            run_beats(args.song, args.engine)
    if args.stage == "shots":
        if not args.clips:
            emit("shots", progress=0.0, error="No clips directory provided. Please select a clips directory first.")
        else:
            run_shots(args.clips)
    if args.stage == "cutlist": run_cutlist(args.song, args.clips)
    if args.stage == "render":  run_render(proxy=args.proxy)
