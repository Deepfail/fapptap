import sys, os, json, pathlib
from scenedetect import open_video, SceneManager
from scenedetect.detectors import ContentDetector

# Usage: python detect_shots.py <media_dir> <out_json> [min_scene_len_sec]
media_dir = pathlib.Path(sys.argv[1])
out_json = sys.argv[2]
min_len = float(sys.argv[3]) if len(sys.argv) > 3 else 0.30  # avoid micro-shots

VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}

def list_videos(root):
    for p in sorted(root.iterdir()):
        if p.suffix.lower() in VIDEO_EXTS:
            yield p

def scenes_for(path):
    video = open_video(str(path))
    sm = SceneManager()
    # Threshold ~27–32 is a good start. Tune later.
    sm.add_detector(ContentDetector(threshold=30.0,
                                    min_scene_len=int(min_len * video.frame_rate)))
    sm.detect_scenes(video)
    scene_list = sm.get_scene_list()
    shots = []
    for s, e in scene_list:
        start = float(s.get_seconds())
        end = float(e.get_seconds())
        if end - start >= min_len:
            shots.append({"start": round(start, 3), "end": round(end, 3)})
    # Fallback single-shot if nothing found
    if not shots and video.duration is not None:
        shots = [{"start": 0.0, "end": round(float(video.duration), 3)}]
    return shots

out = {}
for vid in list_videos(media_dir):
    try:
        out[str(vid).replace("\\", "/")] = scenes_for(vid)
    except Exception as e:
        print(f"[WARN] Failed {vid}: {e}")

os.makedirs(os.path.dirname(out_json), exist_ok=True)
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)
print(f"Wrote {out_json}")
