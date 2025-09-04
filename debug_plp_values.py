#!/usr/bin/env python3
"""Debug PLP values to understand why peak detection is failing."""

import sys
import numpy as np
import librosa
import subprocess
import tempfile
import os

def debug_plp_values():
    """Debug PLP peak detection by examining actual values."""
    audio_file = "media_samples/cumshot-1.mp4"
    
    # Extract audio using FFmpeg like the main pipeline does
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
        temp_audio_path = temp_audio.name
    
    try:
        cmd = [
            "ffmpeg", "-i", audio_file, "-vn", "-acodec", "pcm_s16le", 
            "-ar", "44100", "-ac", "1", "-y", temp_audio_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"FFmpeg failed: {result.stderr}")
            return
        
        # Load audio
        y, sr = librosa.load(temp_audio_path)
        print(f"Audio loaded: {len(y)} samples, {sr} Hz, {len(y)/sr:.2f} seconds")
        
        # Compute onset envelope
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        print(f"Onset envelope: shape={onset_env.shape}, min={onset_env.min():.3f}, max={onset_env.max():.3f}")
        
        # Compute PLP
        hop_length = 512
        plp = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        print(f"PLP: shape={plp.shape}, min={plp.min():.6f}, max={plp.max():.6f}")
        
        # Show PLP statistics
        print(f"PLP mean: {np.mean(plp):.6f}")
        print(f"PLP std: {np.std(plp):.6f}")
        print(f"PLP median: {np.median(plp):.6f}")
        print(f"PLP 95th percentile: {np.percentile(plp, 95):.6f}")
        
        # Test different window sizes
        win_size = int(sr / hop_length)  # 1-second window
        print(f"\nTesting window analysis (window size: {win_size})...")
        
        # Take a few sample windows
        for i, start_idx in enumerate([0, win_size, win_size*2, win_size*5, win_size*10]):
            if start_idx + win_size >= len(plp):
                break
                
            window = plp[start_idx:start_idx + win_size]
            window_mean = np.mean(window)
            window_std = np.std(window)
            window_max = np.max(window)
            
            print(f"Window {i+1}: mean={window_mean:.6f}, std={window_std:.6f}, max={window_max:.6f}")
            
            # Test different thresholds
            for delta in [0.001, 0.005, 0.01, 0.05]:
                peaks = librosa.util.peak_pick(window, pre_max=3, post_max=3, pre_avg=3, 
                                              post_avg=3, delta=delta, wait=5)
                print(f"  delta={delta:.3f}: {len(peaks)} peaks")
        
        # Find the optimal threshold
        print(f"\nTesting minimal thresholds on full PLP...")
        for delta in [0.0001, 0.0005, 0.001, 0.002, 0.005]:
            peaks = librosa.util.peak_pick(plp[:win_size], pre_max=3, post_max=3, pre_avg=3, 
                                          post_avg=3, delta=delta, wait=5)
            print(f"delta={delta:.4f}: {len(peaks)} peaks in first window")
            
    finally:
        # Clean up temp file
        if os.path.exists(temp_audio_path):
            os.unlink(temp_audio_path)

if __name__ == "__main__":
    debug_plp_values()