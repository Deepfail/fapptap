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
