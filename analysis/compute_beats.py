import sys, json, os
import librosa

# Usage: python compute_beats.py <audio_path> <out_json>
audio_path = sys.argv[1]
out_json = sys.argv[2]

y, sr = librosa.load(audio_path, sr=None, mono=True)
# Beat tracking
tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units='frames')
beat_times = librosa.frames_to_time(beat_frames, sr=sr)  # seconds (float)

os.makedirs(os.path.dirname(out_json), exist_ok=True)
with open(out_json, "w", encoding="utf-8") as f:
    json.dump({
        "audio": audio_path.replace("\\", "/"),
        "sr": int(sr),
        "tempo": float(tempo),
        "beats_sec": [float(t) for t in beat_times]
    }, f, indent=2)
print(f"Wrote {out_json}")
