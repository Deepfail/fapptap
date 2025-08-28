Project Goal
Build a PC app (Beatleap-inspired) that auto-edits video montages synchronized to music beats, leveraging modern AI/ML tools and a modular pipeline.

Progress Made (What Works)
Environment & Setup

Project scaffold created (autoedit/ with analysis/, render/, cache/, ui/)
Python venv with key libraries: librosa, scenedetect, torch (CUDA), ffmpeg
Cline + MCPs configured for filesystem, process, SQLite, GitHub, and planning
Core Analysis Pipeline

Beat Detection: librosa → cache/beats.json (tempo + beat times)
Shot Detection: scenedetect → cache/shots.json (per-clip scene boundaries)
Probing: ffprobe → cache/probe/ JSONs + SQLite clips table
Cutlist Generation

Builder script (build_cutlist.py) creates render/cutlist.json with events aligned to beats
Uses round-robin clip selection, shot-boundary snapping, min-duration enforcement
Rendering

Proxy (540p) and final (1080p) renders via ffmpeg with NVENC
Filtergraphs handle concatenation, scaling, SAR normalization, audio mapping
UI Shell

Tkinter app with song/clip selection, "Run Auto-Edit" button, and log viewer
Can trigger pipeline and play output
Current Limitations / Issues
Timeline Mismatch: Cutlist uses global song time, but ffmpeg trim needs per-clip local time → skips short clips
Basic Heuristics: Round-robin clip selection isn't yet smart (no motion/interest scoring)
UI Polishing: Folder picker partially integrated; needs full pipeline control (beats/shots too)
Next Steps (Immediate Focus)
Fix Timeline Issue

Switch cutlist events to use local clip time + per-clip cursor with wrap-around
Update ffmpeg builder to handle local in/out correctly
Smarter Clip Selection

Integrate highlight scoring (e.g., motion/contrast via OpenCV or VideoDB)
Prefer clips with more shots or higher visual activity
Enhance UI

Add buttons to run beats/shots steps from UI
Show progress bars; remember last used folders
Add timeline preview with beat markers
Effects & Polish

Add punch-in zooms, speed ramps, crossfades
Fine-tune beat stride and min-duration per music genre
Longer-Term Ideas
Custom music beat/structure analysis (chorus/verse detection)
Style transfer / neural filters per segment
Integration with Stash for clip management
Export templates (social media formats, aspect ratios)


Project Recap:
- Goal: Build a Beatleap-style auto-editing app (backend in Python, front-end UI, later full app).
- Core pipeline working:
  1. ffprobe → clips table (SQLite)
  2. librosa → beats.json
  3. scenedetect → shots.json
  4. build_cutlist.py → cutlist.json (now uses local clip times, stride logic, min_dur, snap_tol)
  5. run_ffmpeg_from_cutlist.py → proxy_preview.mp4 (fixed SAR, shortest, NVENC)
- Tkinter UI built with run_cmd helper, lets you select song + clips folder, runs cutlist+proxy render, logs output.
- Current questions: packaging into library/CLI, schema v1 for beats/shots/cutlist, next steps for UI and effects.
