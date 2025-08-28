import sys, json, os, math
from pathlib import Path

SNAP_TOL = 0.08   # seconds
MIN_DUR  = 0.40   # seconds  # Reduced to match build_cutlist.py
VIDEO_EXTS = (".mp4",".mov",".mkv",".webm",".m4v")

def load_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def nearest_delta(t, arr):
    if not arr: return float("inf")
    return min(abs(t-x) for x in arr)

def load_shot_edges_for(src, shots_map):
    shots = shots_map.get(src, [])
    edges = []
    for sh in shots:
        edges.append(float(sh["start"]))
        edges.append(float(sh["end"]))
    return edges

def main(cutlist_path, beats_path, shots_path):
    ok = True
    errors = []

    if not Path(cutlist_path).exists():
        print("❌ cutlist.json not found"); return 1
    if not Path(beats_path).exists():
        print("❌ beats.json not found"); return 1

    cut = load_json(cutlist_path)
    beats = load_json(beats_path)
    shots = load_json(shots_path) if Path(shots_path).exists() else {}

    # Basic schema-ish checks
    for key in ("version","fps","width","height","audio","events"):
        if key not in cut:
            errors.append(f"Missing key: {key}")
            ok = False

    events = cut.get("events", [])
    if not isinstance(events, list) or not events:
        errors.append("No events found")
        ok = False

    beat_times = [float(t) for t in beats.get("beats_sec", [])]
    if not beat_times:
        errors.append("beats.json has no beats_sec[]")
        ok = False

    # Precompute beat boundaries (start/end of intervals)
    # We'll treat either in/out near any beat time as acceptable.
    beat_boundaries = beat_times

    # Validate each event
    for i, e in enumerate(events):
        for key in ("src","in","out"):
            if key not in e:
                errors.append(f"event[{i}] missing {key}")
                ok = False
                continue

        src = e.get("src","")
        if not any(src.lower().endswith(ext) for ext in VIDEO_EXTS):
            errors.append(f"event[{i}] src not a known video: {src}")
            ok = False

        if not Path(src).exists():
            # Not fatal if you run from a different CWD, but warn
            errors.append(f"event[{i}] src file not found on disk: {src}")
            ok = False

        t0 = float(e.get("in",0))
        t1 = float(e.get("out",0))
        if not (t1 > t0):
            errors.append(f"event[{i}] out <= in ({t0} >= {t1})")
            ok = False

        dur = t1 - t0
        if dur < MIN_DUR:
            errors.append(f"event[{i}] duration {dur:.3f}s < {MIN_DUR:.2f}s")
            ok = False

        # Check near beat boundary (either in or out) or shot edge
        edges = load_shot_edges_for(src, shots)

        near_in = (nearest_delta(t0, beat_boundaries) <= SNAP_TOL) or (nearest_delta(t0, edges) <= SNAP_TOL)
        near_out = (nearest_delta(t1, beat_boundaries) <= SNAP_TOL) or (nearest_delta(t1, edges) <= SNAP_TOL)
        if not (near_in or near_out):
            errors.append(f"event[{i}] start/end not near beat or shot edge (±{SNAP_TOL}s)")
            ok = False

    # Summary
    print(f"Checked {len(events)} events.")
    if ok:
        print("✅ cutlist looks good (schema-ish, durations, beat/shot proximity).")
        return 0
    else:
        print("❌ Issues found:")
        for msg in errors[:50]:
            print(" -", msg)
        if len(errors) > 50:
            print(f" ... and {len(errors)-50} more")
        return 2

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python tools/validate_cutlist.py render/cutlist.json cache/beats.json cache/shots.json")
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
