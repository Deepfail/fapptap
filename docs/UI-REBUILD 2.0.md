- [UI-REBUILD 2.0 - Beatleap PC — Build Plan (hand to pilot)](#ui-rebuild-20---beatleap-pc--build-plan-hand-to-pilot)
  - [North Star](#north-star)
  - [Non-negotiables](#non-negotiables)
  - [Architecture](#architecture)
    - [1) State (minimal)](#1-state-minimal)
    - [2) Adapters (keep current code, align edges)](#2-adapters-keep-current-code-align-edges)
  - [UI Layout (role-based)](#ui-layout-role-based)
  - [Runtime Flow](#runtime-flow)
    - [Generate](#generate)
    - [Any edit (trim/reorder/transition)](#any-edit-trimreordertransition)
    - [Export](#export)
  - [Fast Preview (incremental proxy)](#fast-preview-incremental-proxy)
    - [Segment model](#segment-model)
    - [Transition mappings (FFmpeg)](#transition-mappings-ffmpeg)
    - [Proxy presets](#proxy-presets)
  - [Styles (auto defaults on Generate)](#styles-auto-defaults-on-generate)
  - [Persistence](#persistence)
  - [What to build now (ordered)](#what-to-build-now-ordered)
  - [Acceptance (MVP = “Beatleap feel”)](#acceptance-mvp--beatleap-feel)

# UI-REBUILD 2.0 - Beatleap PC — Build Plan (hand to pilot)

## North Star

**Flow:** Pick song → Pick videos → **Generate auto-cut → Auto render Proxy Preview** → Tweak transitions (auto re-preview) → Export.
Preview is WYSIWYG (proxy uses the same graph as export), fast, and stable.

## Non-negotiables

- **Session isolation**: each Generate creates `sessions/{id}/clips/` (only current media).
- **Canonical I/O**: tolerant on read, **strict on write**. Always overwrite `render/cutlist.json`. Never merge.
- **Transitions-first**: ship 4 transitions: `flash_cut`, `crossfade`, `whip_pan`, `dip_to_black`. Pause clip-FX for now.
- **Proxy loop**: any edit → debounce 650 ms → write cutlist → `render(proxy=true)` → reload player with `?t=${Date.now()}`.
- **One Library** in the sidebar (no duplicate browsers elsewhere).

---

## Architecture

### 1) State (minimal)

```ts
// types/transitions.ts
export type Transition =
  | { type: "flash_cut"; durF?: number; intensity?: number }
  | { type: "crossfade"; durF: number }
  | { type: "whip_pan"; durF: number; dir: "left" | "right" }
  | { type: "dip_to_black"; durF: number };

// store/timeline.ts
export type TimelineItem = {
  id: string;
  clipId: string; // sessions/{id}/clips/*.mp4
  in: number; // seconds
  out: number; // seconds
  transitionOut?: Transition; // boundary to next
};

export interface EditorStore {
  timeline: TimelineItem[];
  selectedId: string | null;
  updateTimeline(items: TimelineItem[]): void;
  select(id: string | null): void;
  updateTrim(id: string, next: { in?: number; out?: number }): void;
  updateTransitionOut(id: string, t?: Transition): void;
  reorder(fromIdx: number, toIdx: number): void;
}
```

### 2) Adapters (keep current code, align edges)

**Cutlist ←→ Store**

```ts
// adapters/cutlist.ts
type CutDoc = {
  version?: 1;
  fps: number;
  width: number;
  height: number;
  audio: string;
  events: {
    src: string;
    in: number;
    out: number;
    transition_out?: Transition;
  }[];
};

export const cutlistToItems = (doc: CutDoc) =>
  doc.events.map((e, i) => ({
    id: `item-${i}`,
    clipId: e.src,
    in: e.in,
    out: e.out,
    transitionOut: e.transition_out,
  }));

export const itemsToCutlist = (
  items: TimelineItem[],
  base: Partial<CutDoc>
): CutDoc => ({
  version: 1,
  fps: base.fps ?? 60,
  width: base.width ?? 1920,
  height: base.height ?? 1080,
  audio: String(base.audio ?? ""),
  events: items.map((it) => ({
    src: it.clipId,
    in: it.in,
    out: it.out,
    transition_out: it.transitionOut || undefined,
  })),
});
```

**Stages (UI-friendly API → real scripts)**

```ts
// services/stages.ts
export async function runStage(
  stage: "beats" | "cutlist" | "render",
  args: any
) {
  switch (stage) {
    case "beats":
      return invokePy("compute_beats.py", {
        audio: args.audio,
        out: "cache/beats.json",
      });
    case "cutlist":
      return invokePy("build_cutlist.py", {
        song: args.song,
        clips: args.clips,
        style: args.style,
        mode: args.cutting_mode,
        out: "cache/cutlist.json",
      });
    case "render":
      return invokeRenderer({ proxy: !!args.proxy }); // reads render/cutlist.json
  }
}
```

**Session setup**

```ts
// services/session.ts
export async function createSession(videoPaths: string[], audioPath: string) {
  const id = String(Date.now());
  const root = `sessions/${id}`;
  const clips = `${root}/clips`;
  await fs.mkdir(clips, { recursive: true });
  for (const p of videoPaths) await fs.copyFile(p, `${clips}/${basename(p)}`);
  await fs.writeTextFile(
    `${root}/manifest.json`,
    JSON.stringify(
      { id, createdAt: Date.now(), audio: audioPath, sources: videoPaths },
      null,
      2
    )
  );
  return { id, root, clipsDir: clips, audio: audioPath };
}
```

---

## UI Layout (role-based)

- **Header**: brand + status chip; **Generate** / **Export** (disabled while busy).
- **Left Sidebar**: Audio picker (single) + Videos picker (multi); **Style preset** (Flashy/Smooth/Whip/Punchy), **Intensity** slider, **Aspect** (Landscape/Portrait/Square), **Cutting mode** (Slow/Med/Fast/Ultra).
- **Center**: **Player** (proxy/final) + thin beat strip.
- **Right Inspector (selected cut)**: Trim In/Out (snap-to-beat toggle + Beat offset), **Transition (out)** dropdown (None / Flash-cut / Crossfade 8f / Whip L/R 8f / Dip 6f; show frames control when applicable).
- **Bottom Timeline**: cards (filename, duration); **right-edge badge** shows transition; click to select; drag to reorder.

---

## Runtime Flow

### Generate

1. `createSession()`
2. `runStage("beats",{audio})`
3. (optional) `runStage("shots",{media_dir:clipsDir})`
4. `runStage("cutlist",{song:audio, clips:clipsDir, style, cutting_mode})`
5. **Hydrate** editor from `cache/cutlist.json` → **select first cut**
6. **Write** `render/cutlist.json` (canonical, overwrite)
7. `runStage("render",{proxy:true})` → load `render/fapptap_proxy.mp4?ts=${Date.now()}`

### Any edit (trim/reorder/transition)

- Debounce 650 ms:

  1. write **canonical** `render/cutlist.json`
  2. `runStage("render",{proxy:true})`
  3. reload player with cache-buster

### Export

1. write `render/cutlist.json`
2. `runStage("render",{proxy:false})`
3. “Save As…”

---

## Fast Preview (incremental proxy)

### Segment model

For each item `i`, compute overlap durations (sec) from transitions:

- `dOut(i)` = frames→sec from `transitionOut` (default 0)
- `dIn(i+1)` = frames→sec from **next** item’s incoming (mirror of its `transitionOut`, type-dependent)

Build & cache:

- **Intra segment** `S_i`: from `in(i)+dIn(i)` → `out(i)-dOut(i)` → `render/cache/segments/{i}-{hash}.mp4`
- **Boundary** `T_i_i+1`: last `dOut(i)` of clip i + first `dIn(i+1)` of clip i+1 → `render/cache/transitions/{i}-{i+1}-{hash}.mp4`

Concat list:

```
S_0, T_0_1, S_1, T_1_2, S_2, ...
```

Only rebuild segments whose **hash inputs** changed (clip path/in/out/fps/scale + transition params). Concat with the demuxer:

```
# render/preview_concat.txt
file 'render/cache/segments/0-abc.mp4'
file 'render/cache/transitions/0-1-def.mp4'
file 'render/cache/segments/1-ghi.mp4'
...

ffmpeg -y -f concat -safe 0 -i render/preview_concat.txt -c copy render/fapptap_proxy_next.mp4
# atomic swap:
rename render/fapptap_proxy_next.mp4 -> render/fapptap_proxy.mp4
```

### Transition mappings (FFmpeg)

- **crossfade (durF)**: `xfade=fade:duration=d:offset=0` on the overlap; audio `acrossfade=d=d`.
- **whip_pan (durF, dir)**: `xfade=slideleft|slideright:duration=d:offset=0`; optional `gblur` during overlap; audio `acrossfade`.
- **dip_to_black (durF)**: `xfade=fadeblack:duration=d:offset=0`; audio dip or `acrossfade`.
- **flash_cut (2f default)**: hard cut with 1–2f white pop (overlay `color=white` for `d`).

### Proxy presets

- **Fastest (default):** 540p, `libx264 -preset ultrafast -crf 32 -g 30`, mono 64 kbps.
- **Balanced:** 720p, `-preset veryfast -crf 28 -g 60`, stereo 96 kbps.
- Prefer HW encoders if detected (NVENC/QSV/AMF).

---

## Styles (auto defaults on Generate)

- **Flashy**: `flash_cut 2f` on beats; every 4th → `whip_pan 8f` alternating L/R.
- **Smooth**: `crossfade 8f` everywhere.
- **Punchy**: hard cuts; `flash_cut` on downbeats only.
- **Whip**: `whip_pan 8f` on all boundaries, dir alternates.

---

## Persistence

- **Save Project** `.fapptap`: `{ sessionRoot, audio, selections[], style, render/cutlist.json }`.
- **Open Project** hydrates editor from that file.
- Add basic **undo/redo** in the store (local history), not in files.

---

## What to build now (ordered)

**Day 1**

1. Add `Transition` + `transitionOut` to store.
2. Implement **session creation** + single Library pane.
3. Implement **adapters** (cutlistToItems / itemsToCutlist).
4. Wire **Generate** flow → hydrate → select first → proxy render & play.

**Day 2**
5\) Inspector: **Transition (out)** dropdown (+ frames control where relevant).
6\) **Overwrite** `render/cutlist.json` on edits; debounce → proxy render → reload player.
7\) Timeline right-edge badges for transitions.

**Day 3**
8\) **Incremental proxy** (S/T caching + concat).
9\) **Styles** apply default transitions at Generate.
10\) Export (final render) + Save As.

_(Optional later: beat strip + snap; project save/open; LUT/grade; per-clip ffplay toggle for trimming.)_

---

## Acceptance (MVP = “Beatleap feel”)

- Generate produces a first cut and **auto-plays a proxy**.
- Changing a transition re-previews in **≤ 1–2 s** on typical hardware.
- Export visually matches proxy.
- No stale media: each session uses only its own `clips/`.
- `render/cutlist.json` is always canonical and **overwritten**, never merged.

---

Hand this to him as the blueprint. If he follows it step-by-step, you’ll get the Beatleap desktop experience with fast, reliable previews and clean exports.
