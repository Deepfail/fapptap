- [NOT GIVING UP UI REBUILD](#not-giving-up-ui-rebuild)
  - [Product vision (Beatleap on PC)](#product-vision-beatleap-on-pc)
  - [UX flow (end-to-end)](#ux-flow-end-to-end)
  - [Screens \& layout](#screens--layout)
  - [Editor state (minimum API)](#editor-state-minimum-api)
  - [File contracts](#file-contracts)
  - [Pipeline hooks (what the UI calls)](#pipeline-hooks-what-the-ui-calls)
  - [Renderer mapping for transitions (FFmpeg intent)](#renderer-mapping-for-transitions-ffmpeg-intent)
  - [Styles (auto-tag transitions on Generate)](#styles-auto-tag-transitions-on-generate)
  - [Interaction details](#interaction-details)
  - [Guardrails (do/don’t)](#guardrails-dodont)
  - [Acceptance checklist (what “done” looks like)](#acceptance-checklist-what-done-looks-like)
  - [Milestones for pilot](#milestones-for-pilot)

# NOT GIVING UP UI REBUILD

Absolutely—here’s a clean, pilot-ready spec for a **brand-new UI** that delivers a Beatleap-style desktop editor with **transition-first** editing, beat-synced auto-cuts, fast proxy preview, and clean export.

---

## Product vision (Beatleap on PC)

- **Music first.** One song drives the cut rhythm (beats/BPM).
- **Transitions at boundaries** do the heavy lifting (flash-cut, crossfade, whip-pan, dip-to-black).
- **Minimal clip FX** (optional later). Focus on transitions + global look.
- **Fast preview loop** (proxy re-render) that reflects exactly what export will do (WYSIWYG).

---

## UX flow (end-to-end)

1. **Start / Select sources**

   - Pick **audio (1)** and **videos (multi)**.
   - Create a fresh **session**: `sessions/{id}/`.
   - Copy only selected videos into `sessions/{id}/clips/` and write `sessions/{id}/manifest.json`.

2. **Generate (auto-cut)**

   - Run stages with the session paths:

     - `beats`: analyze audio → `cache/beats.json`.
     - (Optional) `shots`: detect scene changes for smarter cutting.
     - `cutlist`: build first pass using beats, cutting mode, and **style preset** → `cache/cutlist.json`.

   - **Hydrate the editor** from the newest cutlist; **auto-select** the first cut.

3. **Preview & Edit**

   - Center player plays **proxy** (`render/fapptap_proxy.mp4`).
   - Bottom timeline shows **cuts** (cards) and **beat markers**.
   - Right inspector edits the **selected cut**:

     - **Trim** in/out (with optional snap-to-beat).
     - **Transition out** (None, Flash-cut, Crossfade 8f, Whip-pan L/R 8f, Dip-to-black 6f).
     - (Later) Look/LUT & global grade.

   - On any edit (trim/reorder/transition change), **overwrite `render/cutlist.json`** and **debounced re-render proxy**, then reload player.

4. **Export**

   - Overwrite `render/cutlist.json` from editor state.
   - Run `render(proxy=false)` to produce final MP4.
   - “Save As…” to user location.

---

## Screens & layout

- **Header**

  - Brand, **status chip** (“Analyzing beats…”, “Rendering proxy…”).
  - **Generate** and **Export** buttons (disabled while busy).

- **Left sidebar**

  - **Library**: file pickers for Audio + Videos (multi). Show selected counts.
  - **Style preset** (Flashy / Smooth / Whip / Punchy) and **Intensity** slider (0–100).
  - **Cutting mode** (Slow / Medium / Fast / Ultra).
  - **Aspect** (Landscape / Portrait / Square).

- **Center**

  - **Player** (proxy or final).
  - (Optional) slim **beat strip** under the player.

- **Right inspector** (selected cut)

  - **Trim**: In/Out (sec), **Snap to beat** toggle, **Beat offset** (±ms).
  - **Transition (outgoing)** dropdown:

    - None
    - Flash-cut (2f)
    - Crossfade (8f)
    - Whip-pan Left / Right (8f)
    - Dip-to-black (6f)

  - Duration control appears only for types that support it (xfade/whip).

- **Bottom timeline**

  - Horizontal **cards** for each cut showing file name & duration.
  - **Beat markers** across the track.
  - **Right-edge badge** per card for `transitionOut` (e.g., `xfade 8f`, `whip L`).
  - Drag to reorder; click to select.

---

## Editor state (minimum API)

```ts
type Transition =
  | { type: "flash_cut"; durF?: number; intensity?: number }
  | { type: "crossfade"; durF: number }
  | { type: "whip_pan"; durF: number; dir: "left" | "right" }
  | { type: "dip_to_black"; durF: number };

type TimelineItem = {
  id: string;
  clipId: string; // path in sessions/{id}/clips/*.mp4
  in: number; // seconds
  out: number; // seconds
  transitionOut?: Transition; // applies to boundary to the NEXT item
};

type EditorStore = {
  timeline: TimelineItem[];
  selectedTimelineItemId: string | null;

  updateTimeline(items: TimelineItem[]): void;
  selectTimelineItem(id: string | null): void;

  updateTrim(id: string, next: { in?: number; out?: number }): void;
  updateTransitionOut(id: string, t?: Transition): void;
  reorder(fromIdx: number, toIdx: number): void;
};
```

---

## File contracts

- **Beats**: `cache/beats.json` (accept either)

  ```json
  {"beats_sec":[0.52,1.04,1.56,...]}
  // or
  {"beats":[{"time":0.52}, ...]}
  ```

- **Cutlist** (read on hydrate; write on every edit/preview/export)

  ```json
  {
    "version": 1,
    "fps": 60,
    "width": 1920,
    "height": 1080,
    "audio": "sessions/{id}/audio.wav",
    "events": [
      {
        "src": "sessions/{id}/clips/A.mp4",
        "in": 12.0,
        "out": 16.2,
        "transition_out": { "type": "flash_cut", "durF": 2, "intensity": 0.9 }
      },
      {
        "src": "sessions/{id}/clips/B.mp4",
        "in": 3.1,
        "out": 7.0
      }
    ]
  }
  ```

> **Golden rule:** **never merge** with any old cutlist. Always **overwrite** `render/cutlist.json` from the editor state.

---

## Pipeline hooks (what the UI calls)

- **Session setup**

  ```ts
  const clipsDir = await prepareSessionClipsDir(selectedVideoPaths); // sessions/{id}/clips
  // copies only current selections; writes manifest.json
  ```

- **Stages**

  ```ts
  await runStage("beats", { audio: selectedAudioPath }); // -> cache/beats.json
  await runStage("shots", { media_dir: clipsDir }); // optional
  await runStage("cutlist", {
    song: selectedAudioPath,
    clips: clipsDir,
    preset,
    cutting_mode,
    style: styleId,
  }); // -> cache/cutlist.json
  ```

- **Hydrate editor (after Generate)**

  ```ts
  const cut = await readNewestCutlist(); // cache/render
  editor.updateTimeline(mapCutlistToItems(cut.events));
  if (editor.timeline.length) editor.selectTimelineItem(editor.timeline[0].id);
  ```

- **Preview loop (on any edit)**

  ```ts
  debounce(500, async () => {
    await writeCutlistFromEditor("render/cutlist.json"); // overwrite
    await runStage("render", { proxy: true }); // -> render/fapptap_proxy.mp4
    player.reload("render/fapptap_proxy.mp4?ts=" + Date.now()); // cache-bust
  });
  ```

- **Export**

  ```ts
  await writeCutlistFromEditor("render/cutlist.json");
  await runStage("render", { proxy: false }); // -> render/fapptap_final.mp4
  await showSaveDialogAndCopy("render/fapptap_final.mp4");
  ```

---

## Renderer mapping for transitions (FFmpeg intent)

- **Crossfade (durF @ fps)**
  Video: `xfade=fade:duration=d:offset=tAend-d`
  Audio: `acrossfade=d=d`

- **Whip-pan (left/right, durF)**
  Video: `xfade=slideleft|slideright:duration=d:offset=tAend-d`
  Optional motion blur: `gblur` during overlap.
  Audio: `acrossfade=d=d`

- **Dip-to-black (durF)**
  Video: `xfade=fadeblack:duration=d:offset=tAend-d`
  Audio: acrossfade or brief dip.

- **Flash-cut (2f default)**
  Hard cut + 1–2 frame white pop (overlay) around cut time.
  (Or near-zero `xfade=fade` plus brightness bump with `eq`).

**Edge rules:** If available media < `dur`, clamp or fall back to hard cut.

---

## Styles (auto-tag transitions on Generate)

- **Flashy**: `flash_cut (2f)` on beats; every 4th → `whip_pan 8f` alternating L/R.
- **Smooth**: `crossfade 8f` on all boundaries.
- **Punchy**: hard cuts; `flash_cut` on downbeats only.
- **Whip**: `whip_pan 8f` on every boundary, direction alternates.

UI: Style dropdown + **Intensity** 0–100 (maps to cut density and flash intensity).

---

## Interaction details

- **Trim**: numeric fields + drag handles (snap to nearest beat when enabled).
- **Reorder**: drag cards on the timeline.
- **Select next/prev**: Arrow keys (←/→).
- **Playhead**: jump to selected cut start; press space to play/pause.
- **Badges**: right edge of card shows current `transitionOut`.

---

## Guardrails (do/don’t)

- ✅ **Do** isolate sessions (`sessions/{id}`) so old clips never leak in.
- ✅ **Do** hydrate editor after Generate; auto-select first cut.
- ✅ **Do** re-render proxy on edits (debounced), and cache-bust the player.
- ❌ **Don’t** gate editing on beats existing; beats enhance, not block.
- ❌ **Don’t** merge or append to old cutlists.

---

## Acceptance checklist (what “done” looks like)

- Select audio + videos → **Generate** builds a first cut synced to beats.
- Editor shows timeline cards; first is selected; inspector enabled.
- Changing a trim or transition updates proxy within \~1s and the player reflects it.
- Export produces a file that matches proxy visually.
- Style preset changes the default **transitions** at boundaries.
- No stale media appears; each Generate uses only current selections.

---

## Milestones for pilot

**M1 – Core loop (2–3 tasks)**

- Session isolation; stages; hydrate; proxy loop; export; basic transitions (flash, xfade).

**M2 – Beat tooling & styles**

- Beat strip + snap; style presets + intensity; whip-pan & dip-to-black.

**M3 – Polish**

- Thumbnails, keyboard shortcuts, global look (optional LUT), project save/open.

---

If the pilot builds exactly to this, you’ll have a Beatleap-style desktop app: pick music, pick clips, auto-cut to the beat, tweak **transitions**, see it instantly, export.
