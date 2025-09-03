import sys, json, time, argparse, subprocess, shlex
import numpy as np
from pathlib import Path

def emit(stage, progress=None, **kw):
    msg = {"stage": stage, **({} if progress is None else {"progress": progress}), **kw}
    print(json.dumps(msg), flush=True)

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
            
        # Run the probe script
        result = subprocess.run([
            sys.executable, str(probe_script), clips_dir
        ], capture_output=True, text=True, check=True)
        
        emit("probe", progress=1.0, message="Media probing completed successfully")
        
    except subprocess.CalledProcessError as e:
        emit("probe", progress=0.0, error=f"Probe failed: {e.stderr}")
    except Exception as e:
        emit("probe", progress=0.0, error=f"Probe error: {str(e)}")

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
            
            # Convert tempo to scalar - try direct conversion first
            tempo_scalar = 120.0  # Default fallback
            try:
                if hasattr(tempo, 'item') and callable(getattr(tempo, 'item', None)):
                    # Handle numpy scalar/array
                    tempo_scalar = tempo.item()
                elif isinstance(tempo, (list, tuple)) and len(tempo) > 0:
                    # Handle list/tuple, take first element
                    tempo_scalar = float(tempo[0])
                else:
                    # Handle regular number
                    tempo_scalar = float(tempo)
            except:
                pass  # Use default
            
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

def run_cutlist(song, clips_dir, preset="landscape", cutting_mode="medium"):
    emit("cutlist", progress=0.0)
    try:
        # Call the existing build_cutlist.py script with correct arguments
        beats_json = "cache/beats.json"
        shots_json = "cache/shots.json"
        output_path = "cache/cutlist.json"
        from pathlib import Path
        Path("cache").mkdir(exist_ok=True)
        
        result = subprocess.run([sys.executable, "analysis/build_cutlist.py", 
                               beats_json, shots_json, song, output_path, clips_dir, preset, cutting_mode], 
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

def run_render(proxy=True, ffmpeg_path=None, duration_s=None, preset="landscape"):
    import os
    import sys
    
    if ffmpeg_path is None:
        # For testing, use simple ffmpeg command
        # TODO: In production, this should use Tauri sidecar
        ffmpeg_path = "ffmpeg"
    
    print(f"Debug: Using FFmpeg path: {ffmpeg_path}", file=sys.stderr, flush=True)
    render_type = "proxy" if proxy else "final"
    
    # Select cutlist based on preset
    cutlist_files = {
        "landscape": "cache/cutlist.json",
        "portrait": "render/cutlist_portrait.json", 
        "square": "render/cutlist_square.json"
    }
    
    cutlist_path = cutlist_files.get(preset, "cache/cutlist.json")
    out_path = f"render/{preset}_{render_type}.mp4"
    Path("render").mkdir(exist_ok=True)
    if not Path(cutlist_path).exists():
        emit("render", progress=0.0, error="No cutlist found. Please generate cutlist first.")
        return
    
    try:
        with open(cutlist_path, 'r', encoding='utf-8') as f:
            cutlist = json.load(f)
    except Exception as e:
        emit("render", progress=0.0, error=f"Failed to read cutlist: {e}")
        return
    
    events = cutlist.get("events", [])
    if not events:
        emit("render", progress=0.0, error="No events found in cutlist")
        return
    
    audio_path = cutlist.get("audio", "")
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
    
    # Build FFmpeg filter complex for concatenation
    # Each event becomes: [input][filter_v][filter_a]
    filter_parts = []
    input_args = []
    
    # Add audio input first if available
    audio_input_index = -1
    if audio_path and Path(audio_path).exists():
        input_args.extend(["-i", audio_path])  # Remove quotes - subprocess handles them
        audio_input_index = 0
    
    # Process video events
    for i, event in enumerate(events):
        src_path = event["src"]
        in_time = event["in"]
        out_time = event["out"]
        duration = out_time - in_time
        
        if duration <= 0:
            continue
            
        input_idx = len(input_args) // 2  # Each input takes 2 args: -i "path"
        input_args.extend(["-i", src_path])  # Remove quotes
        
        # Create video filter for this clip: trim, scale to fill and crop
        video_filter = (f"[{input_idx}:v]trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS,"
                       f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                       f"crop={target_width}:{target_height},"
                       f"fps={target_fps},format=yuv420p,setsar=1[v{i}]")
        filter_parts.append(video_filter)
    
    if not filter_parts:
        emit("render", progress=0.0, error="No valid video clips found")
        return
    
    # Concatenate all video streams
    video_concat = "".join([f"[v{i}]" for i in range(len(filter_parts))]) + f"concat=n={len(filter_parts)}:v=1:a=0[outv]"
    filter_parts.append(video_concat)
    
    # Combine all filters
    filter_complex = ";".join(filter_parts)
    
    # Build full FFmpeg command
    base_args = [ffmpeg_path, "-y", "-hide_banner", "-nostats", "-progress", "pipe:1"]
    
    # Add all inputs
    cmd_args = base_args + input_args
    
    # Add filter complex
    cmd_args.extend(["-filter_complex", filter_complex])
    
    # Map outputs
    cmd_args.extend(["-map", "[outv]"])
    
    # Add audio if available
    if audio_input_index >= 0:
        cmd_args.extend(["-map", f"{audio_input_index}:a"])
        cmd_args.extend(["-c:a", "aac"])
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
    
    # Process clips in batches to avoid command line length limits
    max_clips_per_batch = 10  # Reduced batch size for better compatibility
    total_duration_s = sum(event["out"] - event["in"] for event in events if event["out"] > event["in"])
    
    if len(events) <= max_clips_per_batch:
        # Small number of clips - process normally
        success = render_batch_direct(events, cmd_args, total_duration_s, render_type, out_path, ffmpeg_path)
    else:
        # Large number of clips - process in batches and concatenate
        success = render_with_batching(events, ffmpeg_path, proxy, render_type, out_path, audio_input_index, target_width, target_height, target_fps)
    
    if not success:
        return  # Error already emitted


def render_batch_direct(events, cmd_args, total_duration_s, render_type, out_path, ffmpeg_path):
    """Render a small batch of clips directly"""
    import subprocess
    import time
    
    try:
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
                        prog = 0.2 + (prog * 0.8)  # Scale from 0.2 to 1.0
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
        emit("render", progress=0.0, error=f"FFmpeg not found at path: {ffmpeg_path}. Error: {str(e)}")
        return False
    except OSError as e:
        emit("render", progress=0.0, error=f"OS error running FFmpeg: {str(e)}")
        return False
    except Exception as e:
        emit("render", progress=0.0, error=f"Render failed: {str(e)}")
        return False


def render_with_batching(events, ffmpeg_path, proxy, render_type, final_out_path, audio_input_index, target_width, target_height, target_fps):
    """Render large number of clips using batching and concatenation"""
    import tempfile
    import subprocess
    import os
    import shutil
    from pathlib import Path
    
    max_clips_per_batch = 10
    batch_files = []
    
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            # Process clips in batches
            for batch_idx in range(0, len(events), max_clips_per_batch):
                batch_events = events[batch_idx:batch_idx + max_clips_per_batch]
                batch_output = os.path.join(temp_dir, f"batch_{batch_idx//max_clips_per_batch}.mp4")
                
                emit("render", progress=0.2 + (batch_idx / len(events)) * 0.6, 
                     msg=f"Rendering batch {batch_idx//max_clips_per_batch + 1} with {len(batch_events)} clips...")
                
                # Build FFmpeg command for this batch
                input_args = []
                filter_parts = []
                
                # Add audio input if available for first batch only
                if batch_idx == 0 and audio_input_index >= 0:
                    # Get audio path from first event
                    audio_path = None
                    # Try to find audio file in cache
                    for audio_file in ["cache/audio.mp3", "cache/audio.wav"]:
                        if Path(audio_file).exists():
                            audio_path = audio_file
                            break
                    
                    if audio_path:
                        input_args.extend(["-i", audio_path])
                
                # Process video events for this batch
                for i, event in enumerate(batch_events):
                    src_path = event["src"]
                    in_time = event["in"]
                    out_time = event["out"]
                    duration = out_time - in_time
                    
                    if duration <= 0:
                        continue
                        
                    input_idx = len(input_args) // 2
                    input_args.extend(["-i", src_path])
                    
                    # Create video filter for this clip - crop to fill frame
                    video_filter = (f"[{input_idx}:v]trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS,"
                                  f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                                  f"crop={target_width}:{target_height},"
                                  f"fps={target_fps},format=yuv420p,setsar=1[v{i}]")
                    filter_parts.append(video_filter)
                
                if not filter_parts:
                    continue
                
                # Concatenate video streams
                video_concat = "".join([f"[v{i}]" for i in range(len(filter_parts))]) + f"concat=n={len(filter_parts)}:v=1:a=0[outv]"
                filter_parts.append(video_concat)
                filter_complex = ";".join(filter_parts)
                
                # Build batch command
                batch_cmd = [ffmpeg_path, "-y", "-hide_banner"] + input_args
                batch_cmd.extend(["-filter_complex", filter_complex, "-map", "[outv]"])
                
                # Video encoding
                if proxy:
                    batch_cmd.extend(["-c:v", "h264", "-crf", "28", "-preset", "ultrafast"])
                else:
                    batch_cmd.extend(["-c:v", "h264", "-crf", "20", "-preset", "medium"])
                
                batch_cmd.append(batch_output)
                
                # Execute batch
                result = subprocess.run(batch_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
                if result.returncode != 0:
                    emit("render", progress=0.0, error=f"Batch {batch_idx//max_clips_per_batch + 1} failed: {result.stderr}")
                    return False
                
                batch_files.append(batch_output)
            
            if not batch_files:
                emit("render", progress=0.0, error="No valid batches were created")
                return False
            
            # Concatenate all batch files
            if len(batch_files) == 1:
                # Only one batch, just copy it
                shutil.copy2(batch_files[0], final_out_path)
                emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=final_out_path)
                return True
            else:
                # Multiple batches - concatenate them
                emit("render", progress=0.85, msg="Concatenating final output...")
                
                concat_list_path = os.path.join(temp_dir, "concat_list.txt")
                with open(concat_list_path, 'w') as f:
                    for batch_file in batch_files:
                        f.write(f"file '{batch_file}'\n")
                
                concat_cmd = [
                    ffmpeg_path, "-y", "-f", "concat", "-safe", "0", 
                    "-i", concat_list_path, "-c", "copy", final_out_path
                ]
                
                result = subprocess.run(concat_cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
                if result.returncode == 0:
                    emit("render", progress=1.0, message=f"{render_type.capitalize()} render completed successfully", output=final_out_path)
                    return True
                else:
                    emit("render", progress=0.0, error=f"Final concatenation failed: {result.stderr}")
                    return False
                    
    except Exception as e:
        emit("render", progress=0.0, error=f"Batch rendering failed: {str(e)}")
        return False

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["probe","beats","shots","cutlist","render"])
    ap.add_argument("--song", default="")
    ap.add_argument("--clips", default="")
    ap.add_argument("--proxy", action="store_true")
    ap.add_argument("--preset", default="landscape", choices=["landscape", "portrait", "square"])
    ap.add_argument("--cutting_mode", default="medium", choices=["slow", "medium", "fast", "ultra_fast", "random"])
    ap.add_argument("--engine", default="advanced", choices=["basic", "advanced"])
    args = ap.parse_args()

    # Debug: Show all arguments received
    import sys
    print(f"Debug: Worker called with arguments: {sys.argv}", file=sys.stderr, flush=True)
    print(f"Debug: Parsed args - stage: {args.stage}, song: '{args.song}', clips: '{args.clips}', engine: {args.engine}, preset: {args.preset}", file=sys.stderr, flush=True)

    if args.stage == "probe":
        if not args.clips:
            emit("probe", progress=0.0, error="No clips directory provided. Please select a clips directory first.")
        else:
            run_probe(args.clips)
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
    if args.stage == "cutlist": run_cutlist(args.song, args.clips, args.preset, args.cutting_mode)
    if args.stage == "render":  run_render(proxy=args.proxy, preset=args.preset)
