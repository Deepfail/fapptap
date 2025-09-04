import librosa
import numpy as np

def diagnose_tempo_curve_failure(audio_file):
    """Debug why tempo curve computation is failing"""
    
    print("=== TEMPO CURVE DIAGNOSTIC ===")
    
    # Load audio
    y, sr = librosa.load(audio_file, sr=None, mono=True)
    print(f"Audio loaded: {len(y)} samples, {sr} Hz, {len(y)/sr:.2f} seconds")
    
    # Try basic onset detection first
    hop_length = 512
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    print(f"Basic onset envelope: shape={onset_env.shape}, min={onset_env.min():.3f}, max={onset_env.max():.3f}")
    
    # Check for problematic values
    if np.isnan(onset_env).any():
        print("❌ PROBLEM: NaN values in onset envelope!")
        return
    if np.isinf(onset_env).any():
        print("❌ PROBLEM: Infinite values in onset envelope!")
        return
    if (onset_env == 0).all():
        print("❌ PROBLEM: All zeros in onset envelope!")
        return
    
    print("✅ Basic onset envelope looks good")
    
    # Now try the advanced preprocessing like in beats_adv.py
    print("\n=== TESTING ADVANCED PREPROCESSING ===")
    
    # HPSS preprocessing
    print("Applying HPSS preprocessing...")
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    print(f"HPSS results: harmonic={y_harmonic.shape}, percussive={y_percussive.shape}")
    print(f"Percussive stats: min={y_percussive.min():.3f}, max={y_percussive.max():.3f}, mean={y_percussive.mean():.3f}")
    
    # Transient emphasis
    print("Applying transient emphasis...")
    y_filtered = librosa.effects.preemphasis(y_percussive, coef=0.97)
    print(f"Preemphasis stats: min={y_filtered.min():.3f}, max={y_filtered.max():.3f}, mean={y_filtered.mean():.3f}")
    
    # Spectral whitening
    print("Applying spectral whitening...")
    stft = librosa.stft(y_filtered)
    magnitude = np.abs(stft)
    magnitude_plus = magnitude + 1e-10
    whitened_stft = stft / magnitude_plus
    y_transient = librosa.istft(whitened_stft)
    print(f"Whitened audio stats: min={y_transient.min():.3f}, max={y_transient.max():.3f}, mean={y_transient.mean():.3f}")
    
    # Check for problematic values after preprocessing
    if np.isnan(y_transient).any():
        print("❌ PROBLEM: NaN values after spectral whitening!")
        return
    if np.isinf(y_transient).any():
        print("❌ PROBLEM: Infinite values after spectral whitening!")
        return
    
    # Compute onset envelope on processed audio
    onset_env_processed = librosa.onset.onset_strength(y=y_transient, sr=sr, hop_length=hop_length)
    print(f"Processed onset envelope: shape={onset_env_processed.shape}, min={onset_env_processed.min():.3f}, max={onset_env_processed.max():.3f}")
    
    # Check processed onset envelope
    if np.isnan(onset_env_processed).any():
        print("❌ PROBLEM: NaN values in processed onset envelope!")
        return
    if np.isinf(onset_env_processed).any():
        print("❌ PROBLEM: Infinite values in processed onset envelope!")
        return
    if (onset_env_processed == 0).all():
        print("❌ PROBLEM: All zeros in processed onset envelope!")
        return
    
    print("✅ Processed onset envelope looks good")
    
    # Try PLP computation step by step
    print("\n=== TESTING PLP COMPUTATION ===")
    try:
        print("Attempting PLP with original onset envelope...")
        plp_original = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        print(f"✅ PLP with original onset: shape={plp_original.shape}, min={plp_original.min():.3f}, max={plp_original.max():.3f}")
        
        print("Attempting PLP with processed onset envelope...")
        plp_processed = librosa.beat.plp(onset_envelope=onset_env_processed, sr=sr, hop_length=hop_length)
        print(f"✅ PLP with processed onset: shape={plp_processed.shape}, min={plp_processed.min():.3f}, max={plp_processed.max():.3f}")
        
        # Try autocorrelation on original
        print("Attempting autocorrelation on original PLP...")
        max_size = 4 * sr // hop_length
        print(f"Using max_size: {max_size}")
        ac_original = librosa.autocorrelate(plp_original, max_size=max_size)
        print(f"✅ Autocorrelation on original: shape={ac_original.shape}")
        
        # Try autocorrelation on processed
        print("Attempting autocorrelation on processed PLP...")
        ac_processed = librosa.autocorrelate(plp_processed, max_size=max_size)
        print(f"✅ Autocorrelation on processed: shape={ac_processed.shape}")
        
        # Try tempo curve computation
        print("Attempting tempo curve computation...")
        win_size = int(sr / hop_length)  # 1-second window
        print(f"Window size: {win_size}")
        
        if len(plp_processed) > win_size:
            print(f"PLP length {len(plp_processed)} > window size {win_size}, proceeding...")
            
            times = librosa.times_like(plp_processed, sr=sr, hop_length=hop_length)
            print(f"Times array: shape={times.shape}, min={times.min():.3f}, max={times.max():.3f}")
            
            tempo_curve = []
            total_windows = 0
            windows_with_peaks = 0
            windows_with_enough_peaks = 0
            
            for i in range(0, len(plp_processed) - win_size, win_size // 2):
                total_windows += 1
                window = plp_processed[i:i + win_size]
                if len(window) < win_size // 2:
                    continue
                
                # Find peaks in the window
                try:
                    peaks = librosa.util.peak_pick(window, pre_max=1, post_max=1, pre_avg=1, 
                                                  post_avg=1, delta=0.1, wait=1)
                    
                    if len(peaks) > 0:
                        windows_with_peaks += 1
                        
                    if len(peaks) >= 2:
                        windows_with_enough_peaks += 1
                        peak_times = [times[i + p] for p in peaks]
                        intervals = np.diff(peak_times)
                        if len(intervals) > 0:
                            avg_interval = np.mean(intervals)
                            local_tempo = float(60.0 / avg_interval)
                            local_tempo = max(30.0, min(240.0, local_tempo))
                            tempo_curve.append((times[i + win_size//2], local_tempo))
                    
                    # Debug first few windows
                    if total_windows <= 3:
                        print(f"Window {total_windows}: {len(peaks)} peaks found, window range: {window.min():.3f} - {window.max():.3f}")
                        
                except Exception as peak_error:
                    print(f"Peak detection failed at window {i}: {peak_error}")
                    continue
            
            print(f"✅ Tempo curve computed: {len(tempo_curve)} points")
            print(f"Peak detection stats: {windows_with_peaks}/{total_windows} windows had peaks, {windows_with_enough_peaks}/{total_windows} had ≥2 peaks")
            if len(tempo_curve) > 0:
                tempos = [t for _, t in tempo_curve]
                print(f"Tempo range: {min(tempos):.1f} - {max(tempos):.1f} BPM")
            
        else:
            print(f"❌ PLP too short: {len(plp_processed)} <= {win_size}")
        
    except Exception as e:
        print(f"❌ FAILED during PLP/tempo curve computation: {e}")
        print(f"   onset_env shape: {onset_env.shape}")
        print(f"   sr: {sr}, hop_length: {hop_length}")
        print(f"   max_size would be: {4 * sr // hop_length}")
        
        # Try simpler approach
        print("\nTrying simpler tempo detection...")
        try:
            tempo_simple, _ = librosa.beat.beat_track(y=y, sr=sr)
            print(f"✅ Simple tempo detection worked: {tempo_simple} BPM")
        except Exception as e2:
            print(f"❌ Even simple tempo detection failed: {e2}")

if __name__ == "__main__":
    audio_file = "C:/Users/Virta/Dropbox/Music/Audials Music/Lana Del Rey - Video Games (Omid 16B Remix)_4.mp3"
    diagnose_tempo_curve_failure(audio_file)