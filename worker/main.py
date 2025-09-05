# -*- coding: utf-8 -*-
import sys, json, time, argparse, subprocess, shlex
import numpy as np
from pathlib import Path

# Set default encoding for Python 3 
import os
os.environ.setdefault('PYTHONIOENCODING', 'utf-8:replace')

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
        # Use fast shot detection instead of slow PySceneDetect
        output_path = "cache/shots.json"
        from pathlib import Path
        Path("cache").mkdir(exist_ok=True)
        
        emit("shots", progress=0.5, message="Running fast shot detection...")
        result = subprocess.run([sys.executable, "analysis/detect_shots_fast.py", clips_dir, output_path, "2.0"], 
                              capture_output=True, text=False, check=True)
        
        # Decode output manually with error handling
        stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ""
        stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ""
        emit("shots", progress=1.0, message="Fast shot detection completed")
    except subprocess.CalledProcessError as e:
        # Decode stderr with error handling
        stderr_output = e.stderr.decode('utf-8', errors='replace') if e.stderr else "No stderr output"
        emit("shots", progress=0.0, error=f"Shot detection failed: {stderr_output}")

def run_cutlist(song, clips_dir, preset="landscape", cutting_mode="medium", enable_shot_detection=True):
    emit("cutlist", progress=0.0)
    try:
        # Call the existing build_cutlist.py script with correct arguments
        beats_json = "cache/beats.json"
        shots_json = "cache/shots.json"
        output_path = "cache/cutlist.json"
        from pathlib import Path
        Path("cache").mkdir(exist_ok=True)
        
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
        
        result = subprocess.run(args, capture_output=True, text=False, check=True)
        
        # Decode output manually with error handling
        stdout = result.stdout.decode('utf-8', errors='replace') if result.stdout else ""
        stderr = result.stderr.decode('utf-8', errors='replace') if result.stderr else ""
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

def run_render(proxy=True, ffmpeg_path=None, duration_s=None, preset="landscape"):
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
    cutlist_path = "cache/cutlist.json"
    out_path = f"render/fapptap_{render_type}.mp4"
    Path("render").mkdir(exist_ok=True)
    
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
    
    # Use direct rendering approach - no batching, single FFmpeg command
    success = render_direct_filter_complex(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path)
    
    if not success:
        return  # Error already emitted


def render_direct_filter_complex(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path):
    """Render using a single FFmpeg filter_complex command - no intermediate files"""
    import subprocess
    import time
    from pathlib import Path
    
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
        if len(events) > 50:  # Conservative limit
            return render_with_smart_batching(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path)
        
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
            
            # Create video filter for this clip: seek, trim, scale to fill and crop
            video_filter = (f"[{input_idx}:v]trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS,"
                           f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                           f"crop={target_width}:{target_height},"
                           f"fps={target_fps},format=yuv420p,setsar=1[v{i}]")
            filter_parts.append(video_filter)
            clip_outputs.append(f"[v{i}]")
        
        if not clip_outputs:
            emit("render", progress=0.0, error="No valid video clips found")
            return False
        
        emit("render", progress=0.2, msg=f"Concatenating {len(clip_outputs)} processed clips...")
        
        # Concatenate all video streams
        video_concat = "".join(clip_outputs) + f"concat=n={len(clip_outputs)}:v=1:a=0[outv]"
        filter_parts.append(video_concat)
        
        # Combine all filters
        filter_complex = ";".join(filter_parts)
        
        # Build full FFmpeg command
        base_args = [ffmpeg_path, "-y", "-hide_banner", "-nostats", "-progress", "pipe:1"]
        
        # Add all inputs
        cmd_args = base_args + input_args
        
        # Add filter complex
        cmd_args.extend(["-filter_complex", filter_complex])
        
        # Map video output
        cmd_args.extend(["-map", "[outv]"])
        
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
        emit("render", progress=0.0, error=f"FFmpeg not found at path: {ffmpeg_path}. Error: {str(e)}")
        return False
    except OSError as e:
        emit("render", progress=0.0, error=f"OS error running FFmpeg: {str(e)}")
        return False
    except Exception as e:
        emit("render", progress=0.0, error=f"Render failed: {str(e)}")
        return False


def render_with_smart_batching(events, audio_path, target_width, target_height, target_fps, proxy, render_type, out_path, ffmpeg_path):
    """Handle very large numbers of clips by batching smartly"""
    import tempfile
    import subprocess
    import os
    import shutil
    from pathlib import Path
    
    max_clips_per_batch = 30  # Higher limit for direct rendering
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
                if not render_batch_no_audio(batch_events, target_width, target_height, target_fps, proxy, batch_output, ffmpeg_path):
                    return False
                
                batch_files.append(batch_output)
            
            if not batch_files:
                emit("render", progress=0.0, error="No valid batches were created")
                return False
            
            # Concatenate all batch files with audio
            return concatenate_batches_with_audio(batch_files, audio_path, events, render_type, out_path, ffmpeg_path)
                    
    except Exception as e:
        emit("render", progress=0.0, error=f"Smart batch rendering failed: {str(e)}")
        return False


def render_batch_no_audio(events, target_width, target_height, target_fps, proxy, output_path, ffmpeg_path):
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
        
        video_filter = (f"[{input_idx}:v]trim=start={in_time}:end={out_time},setpts=PTS-STARTPTS,"
                       f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,"
                       f"crop={target_width}:{target_height},"
                       f"fps={target_fps},format=yuv420p,setsar=1[v{i}]")
        filter_parts.append(video_filter)
        clip_outputs.append(f"[v{i}]")
    
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
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["probe","beats","shots","cutlist","render"])
    ap.add_argument("--song", default="")
    ap.add_argument("--clips", default="")
    ap.add_argument("--proxy", action="store_true")
    ap.add_argument("--preset", default="landscape", choices=["landscape", "portrait", "square"])
    ap.add_argument("--cutting_mode", default="medium", choices=["slow", "medium", "fast", "ultra_fast", "random", "auto"])
    ap.add_argument("--engine", default="advanced", choices=["basic", "advanced"])
    ap.add_argument("--enable_shot_detection", action="store_true", help="Enable shot detection for cutlist generation")
    
    # Cut settings arguments (from UI)
    ap.add_argument("--min_clip_length", type=float, default=0.5, help="Minimum clip length in seconds")
    ap.add_argument("--max_clip_length", type=float, default=8.0, help="Maximum clip length in seconds")
    ap.add_argument("--min_beats", type=int, default=4, help="Minimum beats per clip")
    ap.add_argument("--crossfade_duration", type=float, default=0.1, help="Crossfade duration in seconds")
    ap.add_argument("--prefer_downbeats", action="store_true", help="Prefer cutting on downbeats")
    ap.add_argument("--respect_shot_boundaries", action="store_true", help="Respect shot boundaries when cutting")
    ap.add_argument("--energy_threshold", type=float, default=0.5, help="Energy threshold for clip selection")
    
    args = ap.parse_args()

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
            run_beats(args.song, args.engine)
    if args.stage == "shots":
        if not args.clips:
            emit("shots", progress=0.0, error="No clips directory provided. Please select a clips directory first.")
        else:
            run_shots(args.clips)
    if args.stage == "cutlist": run_cutlist(args.song, args.clips, args.preset, args.cutting_mode, args.enable_shot_detection)
    if args.stage == "render":  run_render(proxy=args.proxy, preset=args.preset)
