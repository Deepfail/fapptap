UPTEMPO-HELP

You’ve got three separate failure modes tangled together:

1. garbage in (audio load/extract)
2. weak/flat onset energy → PLP \~flat in \[0,1]
3. peak picking that’s too strict or not scale-aware

Fix them in this order.

---

# 0) Extract audio deterministically (kill all loader quirks)

Use ffmpeg to a **mono, float32 WAV** with a sane SR. Do not rely on auto backends.

```bash
# exact, repeatable audio for DSP
ffmpeg -y -i "input.mp4" -vn -ac 1 -ar 22050 -acodec pcm_f32le "audio_22k_mono_f32.wav"
# (optional) limit to analysis window
# ffmpeg -y -ss 0 -t 120 -i input.mp4 -vn -ac 1 -ar 22050 -acodec pcm_f32le audio.wav
```

Sanity check it:

```bash
ffprobe -hide_banner -show_streams "audio_22k_mono_f32.wav"
```

Common gotchas this avoids:

- Variable sample rates/codecs → inconsistent hop sizes
- Stereo phase weirdness (mono mix is explicit)
- Loader backends silently resampling/clipping

---

# 1) Preprocess so onsets are not anemic

If your PLP max is ≈1.0 that’s fine—PLP is probability-like. The _problem_ is the **contrast** (peaks vs local floor), not the absolute scale. Do minimal but helpful conditioning:

```python
import numpy as np, librosa as lr, scipy.signal as sps

y, sr = lr.load("audio_22k_mono_f32.wav", sr=None, mono=True)
# high-pass to remove rumble/DC; light comp to add contrast
y = sps.lfilter([1, -0.97], [1], y)            # pre-emphasis
b, a = sps.butter(2, 40/(sr/2), 'highpass')    # 40 Hz HPF
y = sps.lfilter(b, a, y)
y = np.tanh(2.0*y)                              # soft clip / gentle comp
```

---

# 2) Build a robust onset envelope → tempogram → PLP

Use spectral flux for onset strength, then PLP from tempogram tuned to your tempo band.

```python
hop = 512
onset_env = lr.onset.onset_strength(y=y, sr=sr, hop_length=hop, aggregate=np.median)
# light denoise
onset_env = lr.decompose.nn_filter(onset_env, aggregate=np.median, metric='cosine', width=31)
onset_env = np.maximum(0, onset_env - lr.util.normalize(onset_env, norm=np.inf)*0.02)

# tempogram + PLP
tg = lr.feature.tempogram(onset_envelope=onset_env, sr=sr, hop_length=hop, win_length=8*sr//hop)
plp = lr.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop, tempo_min=60, tempo_max=200)
times = lr.times_like(plp, sr=sr, hop_length=hop)

print("PLP stats:", float(plp.min()), float(plp.max()),
      np.percentile(plp,[5,25,50,75,95]).round(3))
```

If PLP percentiles are bunched (e.g., 0.15/0.2/0.25/0.3/0.35), you need **adaptive thresholding** that follows the local floor.

---

# 3) Thresholding that actually works (don’t ratio a bounded \[0,1] curve)

Use a moving **quantile** floor + **hysteresis**:

```python
import numpy as np
win = 201  # ~ (201*hop)/sr seconds window
lo = lr.util.expand_to(np.quantile(
    lr.util.frame(plp, frame_length=win, hop_length=1, axis=0).T, 0.6, axis=1
), plp.shape)
# hysteresis: enter at hi, leave at lo
hi_thr = lo + 0.12   # tune ~0.08–0.18
lo_thr = lo + 0.06

above = plp > hi_thr
keep  = np.zeros_like(plp, dtype=bool)
armed = False
for i, a in enumerate(above):
    if not armed and a: armed = True
    if armed: keep[i] = True
    if armed and plp[i] < lo_thr[i]: armed = False

plp_masked = np.where(keep, plp, 0.0)
```

---

# 4) Peak picking that respects tempo + prominence

Distance between peaks ≈ (60 / max_tempo) seconds. Use `find_peaks` with **prominence** not height.

```python
from scipy.signal import find_peaks

max_tempo = 200
min_dist_samples = int((sr*60/max_tempo)/hop)
peaks, props = find_peaks(plp_masked,
                          distance=min_dist_samples,
                          prominence=0.03)   # tune 0.02–0.06
beat_times = times[peaks]
print("Detected beats:", len(beat_times))
```

If you still get 0:

- Drop `prominence` a notch
- Increase hysteresis gap slightly (hi_thr−lo_thr)
- Expand quantile window if tempo is slower

---

# 5) Hard diagnostics (print, don’t guess)

Dump these every run:

```python
def dbg_stats(name, x):
    qs = np.percentile(x, [1,5,25,50,75,95,99]).round(4)
    print(f"{name}: min={x.min():.4f} max={x.max():.4f} mean={x.mean():.4f} qs={qs}")

dbg_stats("onset_env", onset_env)
dbg_stats("plp", plp)
dbg_stats("floor(lo)", lo)
print("peaks=", len(peaks), "prominence@median=", np.median(props.get('prominences', [0])))
```

If `prominence@median` ≪ your threshold, your curve has no contrast—go back to step 1 (pre-emphasis/HPF/soft-clip) or try a slightly higher SR (e.g., 32k) for transient detail.

---

# 6) Common reasons for “0 points” even when code runs

- **Near-silence / voice-only** passages: flux is flat → PLP flat. Use a **music/spectral band**: apply a BPF before onset (e.g., 100–5000 Hz).
- **Over-sustained pads/bass:** switch onset aggregation to `np.mean` or increase `lag`/`max_size` in `onset_strength`.
- **Hop too large:** set `hop=256` to increase time resolution.
- **Tempo out of range:** set `tempo_min/tempo_max` to match content; if it’s EDM at 128–140, narrow to (110, 160) to stiffen PLP.

---

# 7) If PLP keeps disappointing, use flux directly for peaks

Sometimes PLP smooths too much. Peak-pick on **onset_env** with a moving quantile floor (same hysteresis) and enforce tempo-based `distance`. Then optionally run `librosa.beat.beat_track` to refine.

```python
tempo, beats = lr.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop, start_bpm=120, tightness=80)
beat_times_bt = lr.frames_to_time(beats, sr=sr, hop_length=hop)
```

---
