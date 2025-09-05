# FappTap Development Plan - Coding Agent Implementation Guide

## 🎯 **CURRENT STATUS**

✅ **MAJOR PROGRESS COMPLETED:**

- Render system completely rewritten and working with real cutlist data
- Virtual environment issues resolved
- Preset support added (landscape/portrait/square with crop-to-fill)
- Batching system implemented to handle large cutlists (356+ events)
- SAR normalization fixing video compatibility issues
- End-to-end video creation working with proxy quality

## 🚀 **PHASE 1: CORE FEATURES (CRITICAL)**

### 1. **Implement Beat-Driven Cutting Rate Modes**

**Priority: HIGHEST - This is the killer feature that differentiates the app**

#### **Backend Implementation:**

- [ ] **Modify `analysis/build_cutlist.py`** to accept cutting mode parameter

  - Add `--cutting-mode` argument: `slow`, `medium`, `fast`, `ultra-fast`, `random`, `auto`
  - Replace fixed `MIN_DUR = 0.40` with dynamic calculation based on mode + BPM
  - Implement tempo-aware cutting logic for each mode

- [ ] **Implement cutting mode algorithms:**

  ```python
  # In analysis/build_cutlist.py
  def get_cut_duration(mode, bpm, beat_strength=None):
      beat_interval = 60 / bpm
      if mode == "slow": return beat_interval * random.uniform(4, 8)
      elif mode == "medium": return beat_interval * random.uniform(2, 4)
      elif mode == "fast": return beat_interval * random.uniform(1, 2)
      elif mode == "ultra_fast": return beat_interval * random.uniform(0.5, 1)
      elif mode == "random": return beat_interval * random.choice([1,1,2,2,2,4,4,8])
      elif mode == "auto": return auto_analyze_section(beat_strength, bpm)
  ```

- [ ] **Add Random Mode with Intelligence:**

  - Weighted randomness (bias toward 2-4 beats)
  - Pattern avoidance (prevent consecutive same durations)
  - Seed control for reproducible results
  - Beat strength consideration for smart randomness

- [ ] **Update worker/main.py cutlist stage:**
  - Add `--cutting-mode` argument to argument parser
  - Pass cutting mode to build_cutlist function
  - Update debug output to show selected cutting mode

#### **Frontend Integration:**

- [ ] **Update ActionsPane.tsx** to include cutting mode selection

  - Add dropdown/radio buttons for: Slow, Medium, Fast, Ultra Fast, Random, Auto
  - Show BPM-based preview of expected cut rates
  - Display cutting mode in progress messages
  - Save selected mode to state management

- [ ] **Add cutting mode to workflow:**
  - Include cutting mode parameter in `runStage("cutlist")` calls
  - Display selected mode in cutlist generation progress
  - Add cutting mode to render output metadata

### 2. **Add Final/High-Quality Render Mode**

**Priority: HIGH - Users need to export their creations**

#### **Backend Implementation:**

- [ ] **Enhance worker/main.py render stage:**
  - Add `--quality` argument: `proxy`, `final`
  - Implement different encoding settings:
    ```python
    if quality == "proxy":
        cmd_args.extend(["-c:v", "h264", "-crf", "28", "-preset", "ultrafast"])
    elif quality == "final":
        cmd_args.extend(["-c:v", "h264", "-crf", "18", "-preset", "slow"])
        cmd_args.extend(["-movflags", "+faststart"])  # Web optimization
    ```
  - Update output filenames: `{preset}_proxy.mp4` vs `{preset}_final.mp4`
  - Add progress tracking for longer final renders

#### **Frontend Integration:**

- [ ] **Add "Create Final Video" button to ActionsPane.tsx:**

  - Separate button from proxy render
  - Show estimated time for final render
  - Disable during rendering with progress bar
  - Success state with download/play options

- [ ] **Update state management:**
  - Track both proxy and final render states separately
  - Store paths to both proxy and final outputs
  - Add final render progress tracking

## 🔧 **PHASE 2: WORKFLOW COMPLETION (HIGH PRIORITY)**

### 3. **Complete End-to-End Workflow Testing**

- [ ] **Test complete user journey:**

  - Audio selection → Beat detection → Video selection → Cutting mode selection → Cutlist generation → Proxy render → Final render
  - Verify all three presets work: landscape, portrait, square
  - Test with different cutting modes
  - Validate output quality and correctness

- [ ] **Add workflow validation:**
  - Prevent cutlist generation without audio and videos
  - Prevent rendering without valid cutlist
  - Show clear error messages for missing prerequisites
  - Add workflow progress indicators

### 4. **Enhanced Error Handling and User Feedback**

- [ ] **Improve error detection:**

  - Validate all input files exist before processing
  - Check FFmpeg availability and version
  - Verify output files are created and valid
  - Add file size and duration validation

- [ ] **Better progress tracking:**
  - Real-time progress for long operations
  - ETAs for final renders
  - Cancel operation support
  - Clear success/failure states

## 🎨 **PHASE 3: UI/UX ENHANCEMENTS (MEDIUM PRIORITY)**

### 5. **Cutting Mode UI Integration**

- [ ] **Add cutting mode selection panel:**

  - Visual preview of cutting rates
  - BPM display and cut rate calculation
  - Mode descriptions and use cases
  - Preview animation showing cutting rhythm

- [ ] **Render quality selection:**
  - Clear distinction between proxy and final
  - Quality settings explanation
  - File size estimates
  - Render time estimates

### 6. **Workflow Guidance**

- [ ] **Add step-by-step workflow indicators:**

  - Progress breadcrumbs
  - Required vs optional steps
  - Smart defaults and recommendations
  - Tooltips and help text

- [ ] **Results preview and validation:**
  - Thumbnail previews of output videos
  - Quick stats (duration, file size, cut count)
  - Play/download buttons for outputs
  - Regenerate options with different settings

## 🚀 **PHASE 4: ADVANCED FEATURES (LOWER PRIORITY)**

### 7. **Auto/AI Cutting Mode**

- [ ] **Implement intelligent cutting analysis:**
  - Analyze song sections (verse/chorus/bridge)
  - Energy-based cutting rate adjustment
  - Beat strength weighting
  - Tempo change detection and adaptation

### 8. **Advanced Beat Detection Fixes**

- [ ] **Fix madmom/numpy compatibility issues:**
  - Resolve tempo curve computation errors
  - Fix downbeat detection
  - Add fallback algorithms
  - Improve beat confidence scoring

### 9. **Performance and Polish**

- [ ] **Optimize rendering performance:**

  - Parallel batch processing
  - Memory usage optimization
  - Temporary file cleanup
  - Progress optimization

- [ ] **Code quality improvements:**
  - Error handling standardization
  - Logging improvements
  - Documentation updates
  - Test coverage

## 📋 **IMPLEMENTATION ORDER FOR CODING AGENT**

### **Sprint 1: Beat-Driven Cutting (Week 1)**

1. Modify `analysis/build_cutlist.py` with cutting mode support
2. Implement all cutting mode algorithms (slow/medium/fast/ultra-fast/random)
3. Update `worker/main.py` to accept and pass cutting mode parameters
4. Test cutting modes with command line to verify functionality

### **Sprint 2: UI Integration (Week 1-2)**

1. Add cutting mode selection to ActionsPane.tsx
2. Integrate cutting mode into cutlist generation workflow
3. Update state management for cutting mode persistence
4. Test UI integration with all cutting modes

### **Sprint 3: Final Render Quality (Week 2)**

1. Implement high-quality render settings in worker/main.py
2. Add "Create Final Video" button to UI
3. Implement progress tracking for final renders
4. Test final render with all presets and cutting modes

### **Sprint 4: End-to-End Testing (Week 2-3)**

1. Complete workflow testing from start to finish
2. Fix any integration issues discovered
3. Add proper error handling and validation
4. Polish UI/UX based on testing feedback

### **Sprint 5: Advanced Features (Week 3+)**

1. Implement Auto/AI cutting mode
2. Fix advanced beat detection issues
3. Add performance optimizations
4. Final polish and documentation

## 🎯 **SUCCESS CRITERIA**

**Must Have:**

- [ ] All 5 cutting modes working (Slow, Medium, Fast, Ultra Fast, Random)
- [ ] Final high-quality render mode functional
- [ ] Complete workflow from audio selection to final video export
- [ ] All three presets working (landscape/portrait/square)
- [ ] Error handling preventing crashes and providing clear feedback

**Nice to Have:**

- [ ] Auto/AI cutting mode with energy analysis
- [ ] Advanced beat detection improvements
- [ ] Performance optimizations
- [ ] Comprehensive UI polish

## � **TECHNICAL DEBT TO ADDRESS**

- [ ] Standardize all Python execution to use `.venv\Scripts\python.exe`
- [ ] Implement proper temporary file cleanup
- [ ] Add comprehensive logging throughout pipeline
- [ ] Create unit tests for cutting mode algorithms
- [ ] Document API interfaces between frontend and backend

This plan transforms FappTap from a working prototype into a production-ready, musically intelligent video editor with unique cutting rate capabilities that set it apart from all other video editing tools.

### 10. **BEAT-DRIVEN CUTTING RATES (CORE FEATURE)**

- [ ] **Priority: CRITICAL** - This is fundamental to the app's unique value
- [ ] **Issue**: Current system uses fixed 0.40s minimum with calculated stride
- [ ] **Problem**: All videos cut at same rate regardless of music character
- [ ] **Solution**: Implement tempo-aware cutting rate system with multiple modes

#### **Cutting Rate Presets:**

- [ ] **Slow Mode**: 4-8 beats per cut (0.8-3.2s @ 120 BPM)
- [ ] **Medium Mode**: 2-4 beats per cut (0.4-1.6s @ 120 BPM)
- [ ] **Fast Mode**: 1-2 beats per cut (0.2-0.8s @ 120 BPM)
- [ ] **Ultra Fast Mode**: Every beat/sub-beat (0.1-0.5s @ 120 BPM)
- [ ] **Random Mode**: Randomly rotate through different speeds/lengths for dynamic unpredictability

#### **Random Mode Implementation:**

- [ ] **Random Duration Selection**: Randomly choose between 1-8 beat durations
- [ ] **Weighted Randomness**: Bias toward musically appropriate lengths (2-4 beats more common)
- [ ] **Pattern Avoidance**: Prevent too many consecutive same-length cuts
- [ ] **Seed Control**: Optional seed parameter for reproducible randomness
- [ ] **Smart Randomness**: Consider beat strength when choosing random durations

#### **AUTO/AI Mode Features:**

- [ ] Analyze song sections (verse/chorus/bridge/drop)
- [ ] Adjust cutting rate based on energy/tempo changes
- [ ] Sync to downbeats vs regular beats vs subdivisions
- [ ] Consider beat strength data from advanced beat detection
- [ ] Implement energy-based cutting (faster during high energy)

#### **Technical Implementation:**

- [ ] Modify `analysis/build_cutlist.py` to accept cutting mode parameter
- [ ] Add `--cutting-mode` argument to worker/main.py cutlist stage
- [ ] Replace fixed `MIN_DUR` with dynamic calculation based on mode + BPM
- [ ] Implement random duration generator with configurable parameters
- [ ] Add UI controls for cutting mode selection
- [ ] Integrate with advanced beat detection for energy analysis
- [ ] Add preview of cutting pattern before generating cutlist

#### **Example Cutting Mode Calculations:**

```python
BPM = 128 (electronic music)
Beat interval = 60/128 = 0.469s

Slow: 4-8 beats = 1.875-3.75s per cut
Medium: 2-4 beats = 0.938-1.875s per cut
Fast: 1-2 beats = 0.469-0.938s per cut
Ultra Fast: 0.5-1 beat = 0.234-0.469s per cut
Random: 1-8 beats = 0.469-3.75s per cut (randomly chosen)
```

#### **UI Integration:**

- [ ] Add dropdown/radio buttons for cutting mode selection
- [ ] Show preview of expected cut rate based on detected BPM
- [ ] Display cutting mode in cutlist generation progress
- [ ] Add cutting mode to render output metadata

Todo to add:
FILE BROWSER

- File broswer performance: If a dir has a lot of videos, it crashes the app as it appears to try to load them all at once. Can we implement something here like lazyload or something similar to stop the app from crashing.
- When a folder has a lot of videos, it stretches the ui tries to accomidate so user has to scroll the entire length of the videos to see things that should always be seen like create videos. Perhaps there should be a always visible top and bottom bar? with the most vital settings
- We can get rid of the optional inline option and always play the videos in the browser inline it looks great.
- Replace the checkmark box when selecting it with a outline and/or gradiant over the image showing that it has been selected. You can barely see the checkbocx, and it feels natural just pressing it once to play it, and then leaving it on if you want it included.
- Add a SELECT ALL button at the top of the video browser.
- the Videos and load music should be "Add Videos" and "Add Music". They should be side by side not stacked.
- All portrait videos with slightly different dimensions should be cropped to the same size. Same rule for landscape and square. This makes it easy to tell what proportion video you are selecting. Also when square or landscape, should be centered vertically instead of at top.
- Filenames really arent very important in this setting. Lets try making them as a overlay on top of the videos, small font.
- Lets try adding a small thumbs button in addition to the view we have now to make it easier to see all or at least more of the videos in a file.
- Once videos are selected they should be placed onto the timeline in random order.
- Once selected, the browser view should close and be replaced with a vertical list of the selected videos which represent the order they are in. User should be able to drag and drop to change their order, or press a random button to randomize their order. The preview pane should show a preview of the videos in the order they are set as in the left sidebar. This sets up the ui to add video effects and tweak with the beat/cut settings and see a preview in real time before rendering the full video.

VIDEO PREVIEW

- Video preview is basically non-existent. I need to see a large video player with the beats/cuts displayed under it. This will allow user to see if beats/cuts are being placed in the correct spots, aka when there is a beat. If possible, for larger/stronger beats, a bigger dot or different color dot (such as downbeat being a different color then regular beats). It would also be great if I could create my own cuts on the timeline by clicking and creating a new one, or dragging an existing one.

EFFECTS

- Effects need to be added to the cuts. Each effect should have Low/Med/High, which will determine how much of that effect get added to the video. The placement of each effect should be randomized throughout all the cuts, and visually represented on the timeline with a colored dot. Preliminary effects we can add are Flash, RGB Glitch, Zoom, and Shake.

# TAURI V2 COMPLIANCE CHECK

- Scan app make sure all aspects of project are TAURI V2 COMPLIANT. Make any needed changes.
- Keep this in mind as you edit and add to the app.

# PERFORMANCE TASKS

current bottlenecks: (1) scanning/metadata done up-front, (2) thumbnails/proxies done eagerly, (3) fat IPC payloads, and (4) DB/indexing that can’t keep up. Fix those and the UI will feel instant—even with tens of thousands of videos.

Below is a pragmatic, production-grade plan. Do it roughly in this order. You can improvise as you see fit.

---

# 1) File discovery that never blocks

**Goal:** first paint in <1s; items appear continuously.

- **Stream, don’t return arrays.** In Rust, walk the tree and `emit` batches of \~200 items as soon as they’re found. No single IPC returning 5k rows.
- **Cheap first, expensive later.** Only send `{path, size, mtime, ext}` initially. Duration/codec/thumbs come on demand.
- **Filter at source.** `walkdir` + extension allowlist; skip hidden/temporary files.
- **Cap concurrency.** Use a small thread pool (IO-bound; 4–8 threads max) to avoid thrashing disks.

_Emit payload size target: <200KB per batch. Anything larger hurts WebView2._

---

# 2) SQLite that can keep up (Rust side, not the webview)

**Goal:** queries in 1–3 ms, zero jank.

- **One table cache** (rust process; `rusqlite`), WAL mode:

  ```sql
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA temp_store=MEMORY;
  PRAGMA mmap_size=30000000000; -- 30GB max map; OS decides actual
  PRAGMA cache_size=-200000;    -- ~200MB cache
  ```

- **Schema** (keep nullable fields null until known):

  ```sql
  CREATE TABLE IF NOT EXISTS media (
    path TEXT PRIMARY KEY,
    mtime INTEGER NOT NULL,
    size  INTEGER NOT NULL,
    ext   TEXT NOT NULL,
    duration REAL,
    width INTEGER,
    height INTEGER,
    codec TEXT,
    thumb TEXT,
    last_seen INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_media_ext  ON media(ext);
  CREATE INDEX IF NOT EXISTS idx_media_seen ON media(last_seen);
  CREATE INDEX IF NOT EXISTS idx_media_mtime ON media(mtime);
  ```

- **UPSERT** only cheap fields on scan; update heavy fields when you compute them—never rewrite the whole row.

---

# 3) Thumbnails & proxies that don’t melt disks

**Goal:** thumbs for on-screen items only; <100ms p95 to display something.

- **Lazy & near-viewport only.** Queue thumb jobs only for items inside (or just beyond) the virtualized window.
- **Disk cache path:** `cache/thumbs/<hash(path+mtime)>.jpg`. Keep width \~320px (or 480px for 2× displays).
- **Thumb command:**

  ```bash
  ffmpeg -y -ss 00:00:03 -i "in.mp4" -frames:v 1 -vf "scale='min(480,iw)':-1:flags=bicubic" -q:v 3 "thumb.jpg"
  ```

  (Try mid-timeline if the first frame is black: `-ss 50%` with `-copyts` off.)

- **Optional proxy clip** (for buttery hover preview): generate a 3–5s H.264 baseline 240p:

  ```bash
  ffmpeg -y -ss 2 -i "in.mp4" -t 4 -an -vf "scale=426:-2" -c:v libx264 -preset veryfast -crf 28 -pix_fmt yuv420p "proxy.mp4"
  ```

- **Max job concurrency:** 2–3 ffmpeg instances. More than that trashes HDDs and laptop SSDs.

---

# 4) UI that renders 30 items, not 3,000

**Goal:** constant 60fps regardless of library size.

- **Virtualized grid/list** (react-window / tanstack-virtual). Fixed item height; avoid dynamic measurement.
- **IntersectionObserver** to trigger thumb/proxy requests when cells enter viewport.
- **No giant objects in state.** Store IDs/paths; everything else via selectors (Zustand) that read from a local cache layer keyed by path.
- **Selection at scale:** store selection as `Set<string>` or a bitset; never arrays of objects. Implement range select (Shift), toggle (Ctrl/Cmd), “select by filter.”
- **Pagination:** ditch fixed “50/page.” Use infinite scroll + virtualization; the DB query returns slices (`OFFSET/LIMIT`) or a keyset cursor.

---

# 5) IPC patterns that scale

**Goal:** never block the WebView.

- Rust emits:

  - `scan:start` → `scan:batch` (200 items) × N → `scan:done`
  - `thumb:ready` / `proxy:ready` events with file URLs (not raw bytes)

- **No round trip per item.** The webview subscribes and appends to cache.
- Use a **binary-safe** path protocol. Don’t stringify massive arrays every second.

---

# 6) Live updates without rescans

**Goal:** adding/removing files updates instantly.

- File watcher on root dirs; debounce 250ms; coalesce bursts.
- On change: upsert/remove that single row + invalidate thumb.

---

# 7) Audio analysis speed/caching (librosa/madmom)

**Goal:** “analyze once, use forever.”

- **Hash key:** `sha1(audio_path + mtime + file_size)`; store `beats.json`, `downbeats.json`, `tempo_curve.json`.
- **Downsampled analysis:** load audio at 22.05 kHz mono float32 for onset/PLP; hop=256–512.
- **Madmom DBN:** cache activations and final downbeats; don’t recompute on reopen.
- **Fallbacks:** if DBN fails, beat_track + bar-phase via autocorr; mark confidence so UI can warn.

---

# 8) Render pipeline that actually uses your GPU

**Goal:** fast preview & final export with NVENC; minimal re-encode.

- **Preview**: software decode (safer for filters) + NVENC encode:

  ```bash
  ffmpeg -f concat -safe 0 -i cuts.txt \
    -r 30 -pix_fmt yuv420p \
    -c:v h264_nvenc -preset p5 -rc vbr -cq 22 -b:v 8M -maxrate 12M -bufsize 16M \
    -c:a aac -b:a 192k -movflags +faststart "preview.mp4"
  ```

- **Final** (heavier, still NVENC):

  - h264: `-preset p4/p5 -cq 18–21`
  - hevc: `-c:v hevc_nvenc -preset p6 -profile main10 -pix_fmt p010le` if you want 10-bit output.

- **Avoid concat filter** for many cuts; prefer **concat demuxer** with exact `inpoint/outpoint` and per-segment streamcopy where possible. If effects require filters, accept re-encode.

---

# 9) Effects system that doesn’t kneecap you

**Goal:** effects feel “live” without per-frame CPU death.

- **Two-tier effects:**

  - **Realtime UI preview:** CSS/WebGL approximations, low-res proxy videos, cap to 30fps in the webview.
  - **Final render:** translate to ffmpeg filtergraph (or GPU npp filters) once, offline.

- **Param curves**: precompute effect envelopes (arrays) on the Rust side; don’t animate React state at 60fps with thousands of keyframes.

---

# 10) Job orchestration (don’t fight the GIL)

**Goal:** everything is cancelable, resumable, backpressured.

- One durable **job table** in SQLite:

  ```sql
  CREATE TABLE jobs(
    id INTEGER PRIMARY KEY,
    kind TEXT,            -- scan/thumb/proxy/analyze/render
    path TEXT,
    status TEXT,          -- queued/running/done/failed/canceled
    priority INTEGER,     -- 0=high (viewport), 10=low (background)
    created_at INTEGER, started_at INTEGER, finished_at INTEGER,
    payload TEXT          -- JSON
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status,priority);
  ```

- **Workers**:

  - Rust workers: scan, thumbs, ffprobe.
  - Python sidecar(s): audio analysis, scene detection.

- **Cancel by path/prefix.** When user changes folder or filter, clear queued low-priority jobs immediately.

---

# 11) Observability (so you stop guessing)

**Goal:** find the slow thing in 5 minutes.

- **Perf HUD** in dev builds: batches/sec, IPC KB/s, thumb qlen, DB ms/query, render FPS.
- **Timed sections** around scan, db write, thumb gen, ffprobe.
- **Percentiles**, not averages (p50/p90/p99).

---

# 12) Reasonable defaults (numbers that won’t bite you)

- Batch size: **200** items per IPC emit
- Thumb width: **320–480px**, JPEG `-q:v 3–5`
- Scan threads: **4–8** (IO-bound)
- ffprobe concurrency: **2**
- Thumb/proxy concurrency: **2–3**
- Virtualized overscan: **2 rows**
- Filter debounce: **150 ms**

---

# 13) Ruthless cuts (what to stop doing today)

- ❌ Fetching duration/codec for every file on initial scan
- ❌ Generating thumbs for items not on screen
- ❌ Returning a giant JSON list from a single `tauri::command`
- ❌ Keeping full item objects (with blobs) in React state
- ❌ Rescanning the entire tree whenever filters change

---

Here’s a crisp, build-ready spec you can hand to a coding agent. It includes UI contracts, state shapes, IPC, algorithms, and code nubs. No fluff.

---

# UI TASKS

# 1) Video Preview Player (with Beat/Cut Timeline)

## Goals

- Play a preview clip (proxy or original) with **zero-jank** scrubbing.
- Show **beats** (grey) and **downbeats** (accent color) as dots.
- Show **cuts** as segments on a lane; allow create/move/trim with mouse.
- Snap edits to nearest beat (toggleable).
- Keyboard ops: J/K/L, I/O (mark in/out), `Delete` (remove cut), `S` (split).

## Data Model (Zustand)

```ts
type BeatPoint = { time: number; isDownbeat: boolean; confidence?: number };
type Cut = {
  id: string; // uuid
  start: number; // seconds
  end: number; // seconds
  src: string; // path to video file
  track?: number; // future: multiple tracks
  effects: EffectRef[]; // see effects section
};

type PlayerState = {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  snapToBeats: boolean;
  beats: BeatPoint[]; // read-only, from cache
  cuts: Cut[];
  selectedCutId?: string;

  // actions
  loadSource: (src: string, beats: BeatPoint[], duration: number) => void;
  setTime: (t: number) => void;
  playPause: (on?: boolean) => void;
  addCut: (start: number, end: number, src: string) => string; // returns cut id
  updateCut: (id: string, patch: Partial<Cut>) => void;
  deleteCut: (id: string) => void;
  splitCut: (id: string, at: number) => { leftId: string; rightId: string };
};
```

## UI Components

- `<PreviewVideo />`: `<video>` element + time sync.
- `<Timeline />`: scrollable canvas/SVG showing beats+cuts.
- `<Transport />`: Play/Pause, Jog, Rate, Snap toggle, Timecode.
- `<CutInspector />`: fields for start/end, duration, linked effects.

### Timeline Rendering (Canvas, fast)

- Logical width = `duration * pixelsPerSecond` (variable via zoom).
- Height \~ 140–160px total:

  - lane 1: beats (top)
  - lane 2: cuts (blocks) with draggable edges/handles
  - lane 3: effects dots/tags (later)

- Use **offscreen canvas** for static layers (beats); dynamic overlay for cursor/cuts.

### Mouse & Keys

- **Create cut**: click-drag on cuts lane ⇒ temp rect; on release create `Cut`.
- **Trim**: drag left/right handle; cursor snaps to beat if Snap on.
- **Move**: drag inside segment; preserves length; snaps if enabled.
- **Split**: select cut, press `S` at cursor (or double-click with modifier).
- **I/O**: set in/out at cursor; if a cut selected, trim; else create new cut.
- **Snap**: nearest beat within `snapRadiusPx` (configurable).

### Snapping Algorithm

```ts
function snapTime(
  t: number,
  beats: BeatPoint[],
  pxPerSec: number,
  snapRadiusPx: number
): number {
  const snapRadiusSec = snapRadiusPx / pxPerSec;
  // binary search nearest beat by time, check ±1 neighbors
  // if |t - beat.time| <= snapRadiusSec → snap
  return snappedOrOriginal;
}
```

### Sync Loop (requestAnimationFrame)

- Poll `video.currentTime` (or `timeupdate` + RAF) → set `currentTime` in store (throttled).
- Cursor line in timeline = `currentTime * pxPerSec`.

### Example TSX (skeleton)

```tsx
function PreviewVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { isPlaying, setTime, currentTime, playbackRate } = usePlayer();

  useEffect(() => {
    const v = ref.current!;
    v.playbackRate = playbackRate;
    let raf = 0;
    const tick = () => {
      setTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    v.addEventListener("play", () => (raf = requestAnimationFrame(tick)));
    v.addEventListener("pause", () => cancelAnimationFrame(raf));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const v = ref.current!;
    if (Math.abs(v.currentTime - currentTime) > 0.05)
      v.currentTime = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlaying ? ref.current?.play() : ref.current?.pause();
  }, [isPlaying]);

  return (
    <video
      ref={ref}
      src={src}
      className="w-full h-auto bg-black"
      controls={false}
    />
  );
}
```

---

# 2) Effects System (Flash, RGB Glitch, Zoom, Shake)

## Two-Tier Architecture

- **Preview** (UI): cheap approximations in WebGL/CSS to show intent.
- **Final Render**: deterministic FFmpeg filtergraph per effect with seeded randomness.

## Effect Data Model

```ts
type EffectType = "flash" | "rgb_glitch" | "zoom" | "shake";
type Intensity = "low" | "med" | "high";

type EffectRef = {
  id: string; // uuid
  type: EffectType;
  intensity: Intensity;
  start: number; // seconds relative to cut.start
  duration: number; // seconds
  seed: number; // deterministic placement
  params?: Record<string, number | string | boolean>;
};
```

Attach effects to `Cut.effects[]`. Absolute time within timeline = `cut.start + effect.start`.

## Intensity Presets (authoritative)

```ts
const EFFECT_PRESETS = {
  flash: {
    low: { duration: 0.08, brightness: 1.8 },
    med: { duration: 0.12, brightness: 2.2 },
    high: { duration: 0.16, brightness: 2.8 },
  },
  rgb_glitch: {
    low: { jitterPx: 2, splitPx: 2, rate: 8 },
    med: { jitterPx: 4, splitPx: 4, rate: 12 },
    high: { jitterPx: 8, splitPx: 8, rate: 16 },
  },
  zoom: {
    low: { scale: 1.05, ease: "inOutSine", dur: 0.2 },
    med: { scale: 1.12, ease: "inOutSine", dur: 0.25 },
    high: { scale: 1.2, ease: "inOutCubic", dur: 0.3 },
  },
  shake: {
    low: { ampPx: 8, freqHz: 8, dur: 0.25 },
    med: { ampPx: 16, freqHz: 12, dur: 0.3 },
    high: { ampPx: 24, freqHz: 16, dur: 0.35 },
  },
} as const;
```

## Random Placement Across Cuts

- Inputs: `seed`, **per-cut beat map**, density per intensity: `low=~10% of beats`, `med=~25%`, `high=~40%`.
- Algorithm:

  1. Build beat times within cut: `beats.filter(b => b.time ∈ [cut.start, cut.end))`.
  2. PRNG (xorshift) seeded by `projectSeed ^ hash(cut.id) ^ hash(effectType)`.
  3. Sample beats without replacement until density hit; place effect at beat time (or beat ± jitter up to 30 ms).
  4. Enforce **no-overlap** within the same cut lane; if conflict, nudge by ±1 frame or drop.

### PRNG

```ts
function xorshift32(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x100000000;
  };
}
```

## Timeline Visualization for Effects

- **Lane** below cuts with colored dots/short ticks at each effect start.
- Colors:

  - flash: yellow
  - rgb_glitch: magenta
  - zoom: cyan
  - shake: orange

- Tooltips on hover with type/intensity/duration; drag along lane to move; edge drag to extend duration (where applicable).
- Selection ring when clicked; delete via `Delete`.

---

# 3) Preview Approximations (UI)

### Flash (CSS)

- Overlay white rect on video container with opacity envelope.

```ts
// pseudo
opacity(t) = peak at start → exp decay to 0 over preset.duration
```

### RGB Glitch (Canvas/WebGL)

- Render 3 channel-shifted layers with per-frame small offsets.
- Per-frame offsets driven by seeded PRNG at \~rate Hz.

### Zoom (CSS transform)

- Apply `transform: scale(S)` with easing over preset duration.

### Shake (CSS transform)

- Per-frame translate (x,y) using seeded PRNG at freqHz; decay amp.

> Keep preview 30fps max to avoid UI jank.

---

# 4) Final Render (FFmpeg filters)

### Flash

```bash
# brightness flash (gamma-like)
# overlay: luma gain spike around t=start:duration
# Simplest: eq=brightness=...
-vf "split[v0][v1]; [v1]lutrgb=r='clip(val*B,0,255)':g='clip(val*B,0,255)':b='clip(val*B,0,255)'[flash];
     [v0][flash]blend=all_mode='lighten',enable='between(t,START,START+DUR)'"
```

Where `B =` brightness factor from preset (e.g., 1.8–2.8). Prefer enabling ranges; precompute absolute `START`.

### RGB Glitch

```bash
-vf "split=3[r][g][b];
     [r]crop=iw:ih:0:0, format=rgba, lutrgb=r=255:g=0:b=0 [rr];
     [g]format=rgba, lutrgb=r=0:g=255:b=0 [gg];
     [b]format=rgba, lutrgb=r=0:g=0:b=255 [bb];
     [rr]translate=x='xoff(t)':y='yoff(t)'[r2];
     [gg]translate=x='xoff2(t)':y='yoff2(t)'[g2];
     [bb]translate=x='xoff3(t)':y='yoff3(t)'[b2];
     [r2][g2]blend=all_mode=screen[rg];
     [rg][b2]blend=all_mode=screen,
     format=yuv420p"
```

Use `geq`/`expr` or `sendcmd` to set time-varying offsets from a seeded table; alternatively **pre-slice** the effect interval and apply per-segment static offsets (simpler, deterministic).

### Zoom

```bash
-vf "zoompan=z='pzoom':d=1,scale=iw:ih"
```

But zoompan is frame-based. Cleaner: `fps=FR; setpts=PTS-STARTPTS;` + `scale` with `pad` and `crop` to emulate smooth zoom via `tblend` or `zm`. Practical approach: use `scale` + `crop` with time-varying expressions:

```bash
-vf "crop=w='iw/scale(t)':h='ih/scale(t)':x='(iw-w)/2':y='(ih-h)/2'"
```

Where `scale(t)` eases from 1→S over `DUR`.

### Shake

```bash
-vf "translate=x='shakeX(t)':y='shakeY(t)',tile=1:1"
```

Provide per-frame `shakeX`, `shakeY` values via `sendcmd` or pre-split into short segments each with fixed offset. The robust, deterministic approach is: **precompute a per-frame CSV** and use `lut2`/overlay scripts. (Your agent can implement the precompute-to-filtergraph writer.)

> Don’t over-engineer: for v1, it’s fine to generate **effect segments** and stitch filterchains per segment with `enable=between(t,...)`.

---

# 5) IPC & Jobs

## Commands

```ts
// tauri commands
scan_dir(root: string) -> emits scan:batch
request_proxy(src: string) -> Promise<{ proxyPath: string }>
request_beats(audioPath: string) -> Promise<BeatPoint[]>
render_preview(cutlistPath: string, effectPlanPath: string, outPath: string) -> Promise<{ ok: true }>
```

- `render_preview` takes a **cutlist** (concat demuxer) and **effect plan** (JSON with absolute time windows and parameters) to generate a fast preview.

## Events

- `thumb:ready` `{ path, thumbPath }`
- `proxy:ready` `{ src, proxyPath }`
- `analyze:beats_ready` `{ audioPath, beats }`

---

# 6) Effect Planner (randomize placement)

### API

```ts
type RandomizeRequest = {
  projectSeed: number;
  intensity: Intensity; // low/med/high
  types: EffectType[]; // which effects to place
  cuts: Cut[];
  beats: BeatPoint[];
  perCutMax?: number; // cap
};

type RandomizeResult = {
  updates: Array<{ cutId: string; effects: EffectRef[] }>;
};
```

### Steps

1. For each cut, collect `localBeats = beatsInRange(cut.start, cut.end)`.
2. Density targets per intensity (defaults): `low=0.1`, `med=0.25`, `high=0.4` of local beats.
3. For each `type`:

   - Sample `k = floor(density*localBeats.length / types.length)`.
   - Nudge placement by ±30 ms (PRNG).
   - Build `EffectRef` using presets for dur/params.

4. Resolve overlaps per cut (greedy, shortest-first).
5. Return `updates`.

---

# 7) Timeline Implementation Notes

- **Canvas layers**:

  - `beatsLayer`: static, redraw only on zoom/resize.
  - `cutsLayer`: redraw when cuts change or scroll pos changes.
  - `cursorLayer`: RAF update.
  - `effectsLayer`: redraw on effect changes.

- Use `devicePixelRatio` to produce crisp dots/lines.
- Beats:

  - Render as small circles every Nth beat; downbeats bigger circle or distinct color.
  - If zoomed out (pxPerSec < 12), draw tick marks instead of circles to reduce draw calls.

---

# 8) Edge Cases & Rules

- Prevent zero-length cuts (`end - start >= 0.05s`).
- Clamp edits inside media duration.
- If `snapToBeats` enabled and no beat within snap window, don’t snap.
- Drag collisions: when moving a cut, **ghost** the segment; on release, commit (cheap to draw).
- Multi-select (later): shift-click to add to selection; move group preserves relative offsets.

---

# 9) Tests / Acceptance

### Player

- Seek accuracy within ±1 frame (33 ms @ 30fps).
- Play/Pause toggles without desync.
- Scrubbing with mouse updates time continuously.

### Timeline

- Creating a cut produces a `Cut` with correct times.
- Trimming snaps when enabled; doesn’t when disabled.
- Split at cursor creates two cuts whose times sum to original.

### Effects

- Randomize with fixed `projectSeed` is **deterministic** across runs.
- Preview effects fire within ±1 frame of scheduled start.
- Rendered preview logs include effect windows (verify by parsing filtergraph).

---

# 10) Minimal Files for Agent to Create

```
/src/state/player.ts               // zustand store (shapes above)
/src/components/PreviewVideo.tsx   // video element & sync
/src/components/Timeline/Canvas.tsx
/src/components/Timeline/useTimelineMouse.ts
/src/components/Transport.tsx
/src/effects/presets.ts            // EFFECT_PRESETS + colors
/src/effects/randomize.ts          // placement algorithm
/src/effects/preview.ts            // CSS/WebGL hooks for preview
/src/render/buildFiltergraph.ts    // effect plan -> ffmpeg args
/src/ipc/commands.ts               // tauri invoke wrappers
/src/utils/prng.ts                 // xorshift32
```

---

# 11) Quick Start Tasks (for the agent)

1. Implement `player.ts` store with shapes/actions exactly as above.
2. Build `<PreviewVideo />` skeleton (code above).
3. Implement `<Timeline />` with beats & cuts lanes (canvas), including:

   - zoom/pan, snap-to-beats, create/trim/move, split.

4. Add `<Transport />` with keyboard handlers and snap toggle.
5. Add `effects/presets.ts` + `effects/randomize.ts` (seeded placement).
6. Draw effects lane as colored dots; click-to-select/move/delete.
7. Implement `render/buildFiltergraph.ts` that converts `cuts + effects` into:

   - `concat` demuxer file
   - filtergraph with `enable=between(t,...)` segments per effect

8. Wire `render_preview` IPC and spawn ffmpeg with timeout+logging.

---

This is enough for a first pass that **plays, edits, snaps, sprinkles effects deterministically,** and renders a preview with FFmpeg. When you’re ready, I can drop in a concrete `buildFiltergraph.ts` and the canvas timeline draw loop with hit-testing.

# 12) Probbe Cache and a few others

1. file browser needs to make individual files selectable. instead of a checkbox, upon clicking anywhere on the video to play it, also cause that click to select it and add a white frame around it showing that its been selected. If user selects all, liight all the frames up just like you would a check a checkbox.
2. Portrait thumbnails should all be cropped to 1 same size. There should onlky be 3 different sizes portait, square, and landscape, the same exact ratios the videos are created in.
3. Restore the new elements i had added which your killed needlessly before i could even see them. Video player, timeline, effects, anything else you killed.
4. Probing should be getting cached, its not. Do this:

# Media Probe (2-Tier) Implementation Brief

## Objective

Implement fast + deep ffprobe with robust caching so we never re-probe unchanged files and we don’t block the UI.

## Hard Rules

- Use **shell sidecar** for `ffprobe` (no PATH execs).
- Persist results in **SQLite** (`cache/analysis.db`) and **JSON sidecars** (`cache/probe/*.json`).
- Key cache by `(abs_path, size_bytes, mtime_ns)`.
- Concurrency: **max 6** probes at once; queue the rest.
- Never probe at app launch; only on **selection** or **project restore**.

---

## Schema (run once)

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS media_probe (
  path TEXT PRIMARY KEY,
  size_bytes INTEGER NOT NULL,
  mtime_ns INTEGER NOT NULL,
  probed_at INTEGER NOT NULL,
  duration_sec REAL,
  video_codec TEXT,
  audio_codec TEXT,
  width INTEGER,
  height INTEGER,
  fps_num INTEGER,
  fps_den INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  json_path TEXT,
  deep_ready INTEGER NOT NULL DEFAULT 0  -- 0=FAST only, 1=DEEP populated
);
CREATE INDEX IF NOT EXISTS idx_media_probe_mtime ON media_probe(mtime_ns);
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
COMMIT;
```

Use the SQLite MCP tools:

- `sqlite-write` to apply schema
- `sqlite-read`/`sqlite-write` for lookups/upserts

---

## Tiered Probing

### FAST pass (trigger on selection/import)

- Command:

  ```
  ffprobe -v quiet -print_format json -show_format \
          -select_streams v:0,a:0 -show_streams "<abs_path>"
  ```

- Extract & store:

  - `duration_sec`, `video_codec`, `audio_codec`, `width`, `height`, `fps_num/den` (from `r_frame_rate`), `sample_rate`, `channels`

- Upsert row; write full JSON to `cache/probe/<key>.json` (key = hash(path|size|mtime_ns))
- Set `deep_ready=0`

### DEEP pass (lazy/on-demand)

- Trigger when:

  - clip is **added to timeline**, or
  - **before render**, for every clip in the cutlist

- Command:

  ```
  ffprobe -v quiet -print_format json \
          -count_frames \
          -show_entries stream=codec_type,nb_read_frames,r_frame_rate,avg_frame_rate,time_base \
          -show_format -show_streams "<abs_path>"
  ```

- Update same row with any improved frame metrics; set `deep_ready=1`. Overwrite JSON file.

---

## Reuse vs Re-probe Logic

1. `stat(abs_path)` → `size_bytes`, `mtime_ns`
2. `SELECT * FROM media_probe WHERE path=?`

   - If row exists **and** `(size_bytes, mtime_ns)` match → reuse; skip FAST
   - Else → run FAST; upsert row and JSON

3. DEEP is **not** automatic. Only run DEEP for:

   - timeline membership
   - pre-render validation

4. If file missing → mark stale in UI (don’t delete row automatically)

---

## UI / State Integration (React)

- **When user selects files/folder**: enqueue FAST probes immediately.
- Maintain per-item status: `queued → probing → cached (fast) → cached (deep)`.
- Add a **“Prepare for render”** action that runs DEEP for clips in the cutlist.
- Show small error badge with stderr if probe fails; allow retry.

---

## TS glue (shape, not full code)

```ts
type ProbeMeta = {
  path: string;
  size_bytes: number;
  mtime_ns: number;
  probed_at: number;
  duration_sec?: number;
  video_codec?: string;
  audio_codec?: string;
  width?: number;
  height?: number;
  fps_num?: number;
  fps_den?: number;
  sample_rate?: number;
  channels?: number;
  json_path?: string;
  deep_ready: 0 | 1;
};

const CONCURRENCY = 6;

async function statFile(absPath: string) {
  const s = await fs.stat(absPath); // tauri fs plugin
  return { size: s.size, mtimeNs: s.mtimeNs ?? Math.round(s.mtime * 1e9) };
}

async function readRow(absPath: string): Promise<ProbeMeta | null> {
  const r = await mcp.sqliteRead<ProbeMeta>(
    "SELECT * FROM media_probe WHERE path = ?",
    [absPath]
  );
  return r?.rows?.[0] ?? null;
}

function needsFast(row: ProbeMeta | null, size: number, mtimeNs: number) {
  return !row || row.size_bytes !== size || row.mtime_ns !== mtimeNs;
}

async function ffprobeFast(absPath: string) {
  const res = await mcp.sidecar.ffprobe([
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-select_streams",
    "v:0,a:0",
    "-show_streams",
    absPath,
  ]);
  return JSON.parse(res.stdout);
}

function extractFast(j: any) {
  const fmt = j.format ?? {};
  const dur = fmt.duration ? parseFloat(fmt.duration) : undefined;
  const v = (j.streams || []).find((s: any) => s.codec_type === "video");
  const a = (j.streams || []).find((s: any) => s.codec_type === "audio");
  let fpsNum, fpsDen;
  if (v?.r_frame_rate) {
    const s = v.r_frame_rate.split("/");
    fpsNum = +s[0];
    fpsDen = +s[1];
  }
  return {
    duration_sec: dur,
    video_codec: v?.codec_name,
    audio_codec: a?.codec_name,
    width: v?.width,
    height: v?.height,
    fps_num: fpsNum,
    fps_den: fpsDen,
    sample_rate: a?.sample_rate ? +a.sample_rate : undefined,
    channels: a?.channels,
  };
}

async function upsertProbe(
  absPath: string,
  size: number,
  mtimeNs: number,
  meta: Partial<ProbeMeta>,
  jsonPath: string,
  deepReady: 0 | 1
) {
  const ts = Math.floor(Date.now() / 1000);
  await mcp.sqliteWrite(
    `
    INSERT INTO media_probe(path,size_bytes,mtime_ns,probed_at,duration_sec,video_codec,audio_codec,width,height,fps_num,fps_den,sample_rate,channels,json_path,deep_ready)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(path) DO UPDATE SET
      size_bytes=excluded.size_bytes, mtime_ns=excluded.mtime_ns, probed_at=excluded.probed_at,
      duration_sec=excluded.duration_sec, video_codec=excluded.video_codec, audio_codec=excluded.audio_codec,
      width=excluded.width, height=excluded.height, fps_num=excluded.fps_num, fps_den=excluded.fps_den,
      sample_rate=excluded.sample_rate, channels=excluded.channels, json_path=excluded.json_path,
      deep_ready=excluded.deep_ready
  `,
    [
      absPath,
      size,
      mtimeNs,
      ts,
      meta.duration_sec,
      meta.video_codec,
      meta.audio_codec,
      meta.width,
      meta.height,
      meta.fps_num,
      meta.fps_den,
      meta.sample_rate,
      meta.channels,
      jsonPath,
      deepReady,
    ]
  );
}

async function ensureFast(absPath: string) {
  const { size, mtimeNs } = await statFile(absPath);
  const row = await readRow(absPath);
  if (!needsFast(row, size, mtimeNs)) return { row, reused: true };

  const j = await ffprobeFast(absPath);
  const meta = extractFast(j);
  const key = Math.abs(hashCode(`${absPath}|${size}|${mtimeNs}`))
    .toString(16)
    .padStart(16, "0");
  const outPath = `${cacheDir}/probe/${key}.json`;
  await fs.createDir(`${cacheDir}/probe`, { recursive: true });
  await fs.writeTextFile(outPath, JSON.stringify(j));
  await upsertProbe(absPath, size, mtimeNs, meta, outPath, 0);
  return { row: await readRow(absPath), reused: false };
}

// call ensureFast() on import; call ensureDeep() only for timeline clips / pre-render
```

(Replace `mcp.*` calls with your wrapper for the MCP tools / sidecar.)

---

## UX Requirements

- Import shows per-item status chips: `queued / probing / cached`.
- Folder import shows overall progress (N of M).
- Timeline items show a tiny **“DEEP ready”** check; it flips once `deep_ready=1`.
- “Prepare for Render” button → runs DEEP for all timeline clips missing it.
- Retry button on errors (displays stderr snippet).

---

## Acceptance Tests

1. **Cold import** of 100 clips:

   - FAST probes run with ≤6 concurrency.
   - `media_probe` has 100 rows; JSON files exist; UI shows “cached”.

2. **Re-open project** without file changes:

   - **No** ffprobe invocations; everything reused (verify by log count).

3. **Modify one file** (touch/replace):

   - Only that file re-probes (row updated; others reused).

4. **Add to timeline**:

   - DEEP probes run only for timeline items; `deep_ready=1` gets set.

5. **Pre-render check**:

   - If any timeline item lacks DEEP, run it before rendering; then proceed.

---

## Tool Plan (print before acting)

```
[TOOL PLAN]
- ffprobe (sidecar): FAST or DEEP; why
- sqlite: read → upsert
- outputs: cache/probe/<key>.json, media_probe row
- verification: stat match; json exists; deep_ready flag
```

---

## Commands (dev sanity)

- Start dev: `npm run tauri dev`
- List cached rows: `sqlite-read("SELECT path, deep_ready FROM media_probe ORDER BY path")`
- Force deep for selection: `ensureDeep([...paths])`

make reuse non-negotiable with hard guards. Right now your pipeline always “does work,” so it rewrites the same JSON. Fix it with these must-follow rules and tiny code changes.

What must happen (in this order)

Stat first.
Get (abs_path, size_bytes, mtime_ns) before touching ffprobe.

Check DB row by path.
If a row exists and size+mtime match, we’re done:
If json_path exists → return it (no probe, no write).
If json_path missing → relink only (don’t probe; don’t write JSON if you can reconstruct path deterministically).

Deterministic JSON filename.
Use a key derived from (path|size|mtime_ns) so the file path is identical across runs. If the file already exists → do not overwrite.

Only probe on mismatch or first time.
If row missing or size/mtime changed → run FAST probe, write JSON only if file doesn’t exist, then UPSERT.

Deep pass only for timeline/pre-render.
Never at import; set deep_ready=1 after DEEP.

One-time schema tweak (optional but makes reuse bulletproof)
ALTER TABLE media_probe ADD COLUMN key TEXT; -- hash(path|size|mtime)
ALTER TABLE media_probe ADD COLUMN json_bytes INTEGER; -- for sanity
ALTER TABLE media_probe ADD COLUMN json_sha256 TEXT; -- optional
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_probe_path ON media_probe(path);
CREATE INDEX IF NOT EXISTS idx_media_probe_key ON media_probe(key);

Idempotent key & path
function identityKey(path:string, size:number, mtimeNs:number) {
// any stable hash; 64-bit hex is fine
const s = `${path}|${size}|${mtimeNs}`;
let h = 0n;
for (let i=0;i<s.length;i++) h = (h \* 1099511628211n ^ BigInt(s.charCodeAt(i))) & ((1n<<64n)-1n);
return h.toString(16).padStart(16,'0');
}
const jsonPathFor = (key:string) => `${cacheDir}/probe/${key}.json`;

Because the path is deterministic, the same clip identity maps to the same file. That makes “don’t rewrite” trivial.

The exact reuse logic (copy/paste for your agent)
async function ensureFast(absPath: string) {
const { size, mtimeNs } = await fs.stat(absPath);
const row = await sqliteReadOne(`
    SELECT path,size_bytes,mtime_ns,json_path,key FROM media_probe WHERE path=?`, [absPath]);

const key = identityKey(absPath, size, mtimeNs);
const expectedJson = jsonPathFor(key);

// REUSE SHORT-CIRCUIT
if (row && row.size_bytes === size && row.mtime_ns === mtimeNs) {
// If DB json_path is wrong/missing but expected file exists, relink only.
if (await fs.exists(expectedJson) && row.json_path !== expectedJson) {
await sqliteWrite(`UPDATE media_probe SET json_path=? WHERE path=?`, [expectedJson, absPath]);
}
return { reused: true, jsonPath: expectedJson };
}

// PROBE ONLY WHEN IDENTITY CHANGED OR ROW MISSING
const outDir = `${cacheDir}/probe`;
await fs.createDir(outDir, { recursive: true });

let wroteFile = false;
if (!(await fs.exists(expectedJson))) {
const raw = await sidecars.ffprobe([
"-v","quiet","-print_format","json","-show_format",
"-select_streams","v:0,a:0","-show_streams", absPath
]);
await fs.writeTextFile(expectedJson, raw.stdout);
wroteFile = true;
}
const j = JSON.parse(await fs.readTextFile(expectedJson));
const meta = extractFast(j); // duration, codecs, w/h, fps, sr, channels

await sqliteWrite(`    INSERT INTO media_probe(path,size_bytes,mtime_ns,probed_at,
      duration_sec,video_codec,audio_codec,width,height,fps_num,fps_den,
      sample_rate,channels,json_path,key,deep_ready)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
    ON CONFLICT(path) DO UPDATE SET
      size_bytes=excluded.size_bytes, mtime_ns=excluded.mtime_ns, probed_at=excluded.probed_at,
      duration_sec=excluded.duration_sec, video_codec=excluded.video_codec, audio_codec=excluded.audio_codec,
      width=excluded.width, height=excluded.height, fps_num=excluded.fps_num, fps_den=excluded.fps_den,
      sample_rate=excluded.sample_rate, channels=excluded.channels,
      json_path=excluded.json_path, key=excluded.key
 `, [
absPath, size, mtimeNs, Math.floor(Date.now()/1000),
meta.duration_sec, meta.video_codec, meta.audio_codec, meta.width, meta.height,
meta.fps_num, meta.fps_den, meta.sample_rate, meta.channels,
expectedJson, key
]);

return { reused: false, wroteFile, jsonPath: expectedJson };
}

Key behaviors enforced here:

If identity matches, we return immediately (no probe, no write).
We never overwrite an existing JSON for the same identity.
If DB points to a different path but the deterministic file exists → relink only.

[TOOL PLAN]

- stat file -> identity (path,size,mtime_ns)
- sqlite-read media_probe row by path
- if match -> RETURN (no ffprobe, no write)
- else -> run FAST ffprobe, write JSON only if not exists, UPSERT row
- outputs: cache/probe/<key>.json
- verification: row matches identity; json_path exists

Bonus: stop duplicate concurrent probes

If two imports queue the same file, guard with a process-local lock:

const locks = new Map<string, Promise<any>>();
async function withProbeLock(key:string, fn:()=>Promise<any>) {
const prev = locks.get(key) || Promise.resolve();
const next = prev.then(fn, fn).finally(()=> { if (locks.get(key) === next) locks.delete(key); });
locks.set(key, next);
return next;
}

Use:

await withProbeLock(identityKey(path,size,mtimeNs), () => ensureFast(path));
