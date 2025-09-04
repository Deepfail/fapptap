THINGS-TO-REMEMBER

# Core Rules and Critical Info

## Beat Detection & Audio Processing

- Audio from videos should NOT be analyzed in anyway by beat detection tools. All beats/cuts will come from the audio track ONLY.
- Use UPTEMPO-HELP.md preprocessing for robust beat detection (HPSS, transient emphasis, spectral whitening)
- Fallback downbeat detection using beat strengths when madmom fails
- MIN_DUR is now adaptive per cutting mode (0.15s-0.6s range)

## UI/UX Implementation Status

✅ **COMPLETED (Sept 2025)**:

- CuttingModeSettings.tsx: Complete cutting mode configuration panel with all 6 modes
- SelectedVideosTimeline.tsx: Drag-drop timeline for selected videos with randomization
- LibraryPane.tsx: Pagination, select all, compact/grid/thumbnail views, fixed bars
- Enhanced mediaStore.ts with improved selection management
- Unicode error fixes in Python backend scripts

🔄 **IN PROGRESS**:

- Video Preview Player with beat/cut timeline (next priority)
- Effects system (Flash, RGB Glitch, Zoom, Shake)

## Backend Pipeline Stability

- Fixed argument order bug in build_cutlist.py (critical fix for UI workflow)
- UTF-8 encoding properly handled in all Python scripts
- Worker binary integration with Tauri confirmed working
- Probe cache system prevents recomputation of video metadata
- Direct FFmpeg rendering eliminates intermediate files

## Technical Debt & Maintenance

- UPTEMPO-HELP preprocessing dramatically improves beat detection robustness
- Backend worker validates end-to-end but UI pipeline was broken until recent fixes
- All diagnostic scripts (check_cutlist.py, validate_durations.py, etc.) are functional
- Comprehensive probe cache covers all media samples (500+ videos)
