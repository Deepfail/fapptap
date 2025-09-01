import sys, json, time, argparse, subprocess, shlex
from pathlib import Path

def emit(stage, progress=None, **kw):
    msg = {"stage": stage, **({} if progress is None else {"progress": progress}), **kw}
    print(json.dumps(msg), flush=True)

def run_beats(song):
    emit("beats", progress=0.0, message="Loading audio and analyzing beats...")
    try:
        # Import and use the advanced beat detection
        from beats_adv import compute_advanced_beats
        beats_data = compute_advanced_beats(song, debug=True)
        
        # Save the results
        from pathlib import Path
        output_path = "cache/beats.json"
        Path("cache").mkdir(exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(beats_data, f, indent=2)
        
        emit("beats", progress=1.0, message="Advanced beat detection completed", 
             beats_count=len(beats_data.get("beats", [])),
             tempo=beats_data.get("tempo_global", 0))
    except Exception as e:
        emit("beats", progress=0.0, error=f"Beat detection failed: {str(e)}")

def run_shots(clips_dir):
    emit("shots", progress=0.0)
    # ... your scenedetect code ...
    # For now, simulate the process
    try:
        # Call the existing detect_shots.py script
        result = subprocess.run([sys.executable, "analysis/detect_shots.py", clips_dir], 
                              capture_output=True, text=True, check=True)
        emit("shots", progress=1.0, message="Shot detection completed")
    except subprocess.CalledProcessError as e:
        emit("shots", progress=0.0, error=f"Shot detection failed: {e.stderr}")

def run_cutlist(song, clips_dir):
    emit("cutlist", progress=0.0)
    # call your build_cutlist.py entry point (local times already)
    # example:
    try:
        result = subprocess.run([sys.executable, "analysis/build_cutlist.py", song, clips_dir], 
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
    
    # For now, build a basic ffmpeg command with progress reporting
    # In a real implementation, this would read from cutlist.json and build a complex filtergraph
    # But we'll use a simple command for demonstration
    
    # Try to get duration from a test file or estimate
    if duration_s is None:
        duration_s = 30.0  # Default fallback duration
    
    # Basic ffmpeg command with progress reporting
    # This is a simplified version - in reality you'd build from cutlist.json
    test_input = "cache/test.mp4"  # Fallback test input
    cmd = f'{ffmpeg_path} -y -hide_banner -nostats -progress pipe:1 -i "{test_input}" -c:v h264 -crf 23 -c:a aac "{out_path}"'
    
    emit("render", progress=0.0, msg="starting")
    
    try:
        p = subprocess.Popen(shlex.split(cmd), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
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
                except: 
                    pass
                if duration_s and duration_s > 0:
                    prog = max(0.0, min(1.0, (out_time_ms/1_000_000) / duration_s))
                    emit("render", progress=prog, out_time_ms=out_time_ms)
            elif "speed" in kv:
                emit("render", progress=None, speed=kv["speed"])
            elif "progress" in kv and kv["progress"] == "end":
                emit("render", progress=1.0, msg="done")
        
        code = p.wait()
        emit("render", exit_code=code)
        
        if code == 0:
            emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed")
        else:
            emit("render", progress=0.0, error=f"Render failed with exit code {code}")
            
    except FileNotFoundError:
        # Fallback when ffmpeg or test file is not available
        emit("render", progress=0.0, error="ffmpeg not found or test input missing")
    except Exception as e:
        emit("render", progress=0.0, error=f"Render failed: {str(e)}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["beats","shots","cutlist","render"])
    ap.add_argument("--song", default="")
    ap.add_argument("--clips", default="")
    ap.add_argument("--proxy", action="store_true")
    args = ap.parse_args()

    if args.stage == "beats":   run_beats(args.song)
    if args.stage == "shots":   run_shots(args.clips)
    if args.stage == "cutlist": run_cutlist(args.song, args.clips)
    if args.stage == "render":  run_render(proxy=args.proxy)
