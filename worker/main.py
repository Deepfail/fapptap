import sys, json, time, argparse, subprocess, shlex
from pathlib import Path

def emit(stage, progress=None, **kw):
    msg = {"stage": stage, **({} if progress is None else {"progress": progress}), **kw}
    print(json.dumps(msg), flush=True)

def run_beats(song):
    # call your existing beats function, emit progress
    emit("beats", progress=0.0)
    time.sleep(0.1)
    # ... your librosa work here ...
    # For now, simulate the process
    try:
        # Call the existing compute_beats.py script
        result = subprocess.run([sys.executable, "analysis/compute_beats.py", song], 
                              capture_output=True, text=True, check=True)
        emit("beats", progress=1.0, message="Beat detection completed")
    except subprocess.CalledProcessError as e:
        emit("beats", progress=0.0, error=f"Beat detection failed: {e.stderr}")

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
    
    # Use the existing ffmpeg wrapper script instead of direct ffmpeg call
    cmd = [
        sys.executable, "render/run_ffmpeg_from_cutlist.py", "render/cutlist.json", out_path
    ]
    
    # Add proxy flag if needed
    if proxy:
        cmd.append("proxy")
    
    emit("render", progress=0.0, msg="starting")
    
    try:
        # Run the existing ffmpeg wrapper (which doesn't support progress yet)
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed")
    except subprocess.CalledProcessError as e:
        emit("render", progress=0.0, error=f"Render failed: {e.stderr}")

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
