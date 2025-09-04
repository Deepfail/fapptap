#!/usr/bin/env python3
"""Test tempo curve with actual audio file."""

import sys
import numpy as np
import librosa

def test_tempo_curve_with_audio():
    """Test tempo curve computation with actual audio file."""
    # Use the cached audio file path from beats.json
    audio_file = "C:/Users/Virta/Dropbox/Music/Audials Music/Lana Del Rey - Video Games (Omid 16B Remix)_4.mp3"
    
    try:
        # Load audio directly (should work with MP3)
        y, sr = librosa.load(audio_file, duration=30)  # Only load first 30 seconds for testing
        print(f"Audio loaded: {len(y)} samples, {sr} Hz, {len(y)/sr:.2f} seconds")
        
        # Compute onset envelope
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        print(f"Onset envelope: shape={onset_env.shape}, min={onset_env.min():.3f}, max={onset_env.max():.3f}")
        
        # Compute PLP
        hop_length = 512
        plp = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        print(f"PLP: shape={plp.shape}, min={plp.min():.6f}, max={plp.max():.6f}")
        
        # Test different window sizes
        win_size = int(sr / hop_length)  # 1-second window
        print(f"\nTesting window analysis (window size: {win_size})...")
        
        # Take a few sample windows
        for i, start_idx in enumerate([0, win_size, win_size*2]):
            if start_idx + win_size >= len(plp):
                break
                
            window = plp[start_idx:start_idx + win_size]
            
            print(f"Window {i+1}: mean={np.mean(window):.6f}, std={np.std(window):.6f}, max={np.max(window):.6f}")
            
            # Test different thresholds
            for delta in [0.001, 0.005, 0.01]:
                peaks = librosa.util.peak_pick(window, pre_max=2, post_max=2, pre_avg=2, 
                                              post_avg=2, delta=delta, wait=3)
                print(f"  delta={delta:.3f}: {len(peaks)} peaks")
                
        print("\n✅ Analysis complete - tempo curve should work with this audio")
        
    except FileNotFoundError:
        print("❌ Audio file not found - this is expected if you don't have the cached audio")
        print("The sample videos have no audio, so advanced beat detection won't work")
        print("But the tempo curve fix should work when audio is present")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_tempo_curve_with_audio()