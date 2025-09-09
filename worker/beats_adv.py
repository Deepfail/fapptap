import librosa
import numpy as np
import os
import json
from pathlib import Path

# Numpy compatibility patch for madmom - ensure madmom can access these deprecated aliases
try:
    import madmom
    # Only set these attributes if madmom is available and they don't exist
    if not hasattr(np, 'int'):
        setattr(np, 'int', np.int_)
    if not hasattr(np, 'float'):
        setattr(np, 'float', np.float64)
    if not hasattr(np, 'bool'):
        setattr(np, 'bool', np.bool_)
except ImportError:
    # If madmom isn't available, we don't need these patches
    pass

def detect_downbeats_from_strengths(beat_times, beat_strengths, tempo):
    """
    Fallback downbeat detection using beat strengths and tempo analysis
    """
    if len(beat_times) == 0 or len(beat_strengths) == 0:
        return []
    
    # Estimate beats per bar based on tempo (most music is 4/4)
    beats_per_bar = 4
    
    # Calculate expected time between downbeats
    beat_interval = 60.0 / tempo  # seconds per beat
    bar_interval = beat_interval * beats_per_bar  # seconds per bar
    
    # Group beats into potential bars
    downbeats = []
    start_time = beat_times[0]
    
    # Find the strongest beat within each expected bar interval
    current_bar_start = start_time
    while current_bar_start < beat_times[-1]:
        bar_end = current_bar_start + bar_interval
        
        # Find beats within this bar
        bar_beats = []
        bar_strengths = []
        for i, beat_time in enumerate(beat_times):
            if current_bar_start <= beat_time < bar_end:
                bar_beats.append(beat_time)
                bar_strengths.append(beat_strengths[i])
        
        # Find the strongest beat in this bar (likely the downbeat)
        if bar_beats and bar_strengths:
            max_strength_idx = np.argmax(bar_strengths)
            strongest_beat = bar_beats[max_strength_idx]
            downbeats.append(strongest_beat)
        
        current_bar_start = bar_end
    
    # Filter out downbeats that are too close together (minimum 2 seconds apart)
    filtered_downbeats = []
    for downbeat in downbeats:
        if not filtered_downbeats or (downbeat - filtered_downbeats[-1]) >= 2.0:
            filtered_downbeats.append(downbeat)
    
    return filtered_downbeats


def compute_advanced_beats(audio_path, debug=False):
    """
    Compute advanced beat detection with PLP tempo curve and beat strengths
    
    Parameters:
    -----------
    audio_path : str
        Path to audio file
    debug : bool
        Whether to include debug information in output
        
    Returns:
    --------
    dict
        Beat detection results with version, engine, tempo, beats, and strengths
    """
    # Initialize confidence variables to avoid unbound errors
    filled_confidences = []
    filled_beats = []
    pruned_beats = []
    
    print(f"Loading audio: {audio_path}")
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    print(f"Audio loaded: {len(y)/sr:.2f}s @ {sr}Hz")
    
    # HPSS preprocessing to separate percussive components
    print("Applying HPSS preprocessing...")
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    
    # Transient emphasis: high-pass filter + spectral whitening
    print("Applying transient emphasis...")
    # High-pass filter to emphasize transients
    y_filtered = librosa.effects.preemphasis(y_percussive, coef=0.97)
    
    # Spectral whitening (normalize frequency bands)
    stft = librosa.stft(y_filtered)
    magnitude = np.abs(stft)
    # Avoid division by zero
    magnitude_plus = magnitude + 1e-10
    # Whitening: normalize by frequency band energy
    whitened_stft = stft / magnitude_plus
    y_transient = librosa.istft(whitened_stft)
    
    # UPTEMPO-HELP implementation: Fix the three failure modes
    # 1. Robust audio preprocessing
    print("Applying UPTEMPO preprocessing...")
    
    # Pre-emphasis and filtering to enhance onset clarity  
    import scipy.signal as signal
    y_processed = signal.lfilter([1, -0.97], [1], y_transient)  # pre-emphasis
    b, a = signal.butter(2, 40/(sr/2), 'highpass')  # 40 Hz HPF
    y_processed = signal.lfilter(b, a, y_processed)
    y_processed = np.tanh(2.0 * y_processed)  # soft compression
    
    # 2. Enhanced onset envelope computation
    hop_length = 512
    onset_env = librosa.onset.onset_strength(y=y_processed, sr=sr, hop_length=hop_length, aggregate=np.median)
    
    # Light denoising
    onset_env = librosa.decompose.nn_filter(onset_env, aggregate=np.median, metric='cosine', width=31)
    onset_env = np.maximum(0, onset_env - librosa.util.normalize(onset_env, norm=np.inf)*0.02)
    
    print(f"Enhanced onset envelope: shape={onset_env.shape}, min={onset_env.min():.3f}, max={onset_env.max():.3f}")
    
    # Run beat tracker on enhanced onset envelope
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
    
    # Convert frames to times and compute strengths
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)
    beat_strengths = [onset_env[frame] for frame in beat_frames] if len(beat_frames) > 0 else []
    
    # Normalize strengths to 0-1 range
    if len(beat_strengths) > 0:
        beat_strengths_array = np.array(beat_strengths)
        min_strength = float(np.min(beat_strengths_array))
        max_strength = float(np.max(beat_strengths_array))
        if max_strength > min_strength:
            beat_strengths = ((beat_strengths_array - min_strength) / (max_strength - min_strength)).tolist()
        else:
            beat_strengths = [0.5] * len(beat_strengths)
    
    # Compute PLP tempo curve
    hop_length = 512
    plp = librosa.beat.plp(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
    
    # Compute tempo curve
    times = librosa.times_like(plp, sr=sr, hop_length=hop_length)
    
    # Compute local tempo estimates with more relaxed parameters
    win_size = int(sr / hop_length)  # 1-second window
    tempo_curve = []
    
    # Ensure we have enough PLP data for analysis
    if len(plp) > win_size:
        print(f"Computing tempo curve with PLP range {plp.min():.6f} - {plp.max():.6f}")
        
        for i in range(0, len(plp) - win_size, win_size // 2):
            window = plp[i:i + win_size]
            if len(window) < win_size // 2:
                continue
                
            # Very relaxed peak detection parameters for PLP
            # PLP values are typically very small (0-1 range)
            delta_threshold = 0.001  # Very small fixed threshold
            
            peaks = librosa.util.peak_pick(window, pre_max=2, post_max=2, pre_avg=2, 
                                          post_avg=2, delta=delta_threshold, wait=3)
            
            if len(peaks) >= 2:
                # Compute average time between peaks
                peak_times = [times[i + p] for p in peaks]
                intervals = np.diff(peak_times)
                if len(intervals) > 0:
                    avg_interval = np.mean(intervals)
                    local_tempo = float(60.0 / avg_interval)
                    # Clip to reasonable range
                    local_tempo = max(30.0, min(240.0, local_tempo))
                    tempo_curve.append((times[i + win_size//2], local_tempo))
        
        # Smooth tempo curve using moving average if we have enough points
        if len(tempo_curve) > 2:
            smooth_bpm = []
            smooth_t = []
            window_size = 3
            for i in range(len(tempo_curve)):
                start = max(0, i - window_size // 2)
                end = min(len(tempo_curve), i + window_size // 2 + 1)
                window_bpm = [bpm for t, bpm in tempo_curve[start:end]]
                smooth_bpm.append(np.mean(window_bpm))
                smooth_t.append(tempo_curve[i][0])
            tempo_curve = list(zip(smooth_t, smooth_bpm))
    
    # Fallback: Use global tempo if no tempo curve could be computed
    if len(tempo_curve) == 0:
        print("Warning: Could not compute tempo curve, using global tempo as fallback")
        # Convert tempo to scalar for tempo curve - try direct conversion first
        tempo_scalar = 120.0  # Default fallback
        try:
            tempo_scalar = float(tempo)
        except:
            pass  # Use default
        tempo_curve = [(0.0, tempo_scalar)]
    
    # Dynamic programming beat snapping with tempo drift handling
    if len(tempo_curve) > 0:
        # Create a predicted beat grid from smoothed tempo curve
        beat_grid = []
        current_time = 0.0
        
        if len(tempo_curve) == 1:
            # Single tempo point - create regular beat grid
            t_start, bpm = tempo_curve[0]
            beat_interval = 60.0 / bpm
            duration = len(y) / sr
            num_beats = int(duration / beat_interval)
            for i in range(num_beats):
                beat_time = t_start + i * beat_interval
                if beat_time < duration:
                    beat_grid.append(beat_time)
        else:
            # Multiple tempo points - interpolate between them
            for i in range(len(tempo_curve) - 1):
                t_current, bpm_current = tempo_curve[i]
                t_next, bpm_next = tempo_curve[i + 1]
                # Interpolate BPM between points
                duration = t_next - t_current
                num_beats = int(round(duration * (bpm_current + bpm_next) / 120))
                if num_beats > 0:
                    beat_interval = duration / num_beats
                    for j in range(num_beats):
                        beat_time = t_current + j * beat_interval
                        beat_grid.append(beat_time)
                current_time = t_next
        
        # Snap beats to local onset maxima within ±60ms window
        snap_window = 0.06  # 60ms
        snapped_beats = []
        snapped_strengths = []
        
        for predicted_beat in beat_grid:
            # Find the strongest onset within the window
            window_start = max(0, predicted_beat - snap_window)
            window_end = predicted_beat + snap_window
            # Find onset indices in this window
            onset_times = librosa.times_like(onset_env, sr=sr, hop_length=hop_length)
            in_window = [i for i, t in enumerate(onset_times) if window_start <= t <= window_end]
            if in_window:
                # Find the peak onset in the window
                peak_idx = in_window[np.argmax(onset_env[in_window])]
                snapped_beat = onset_times[peak_idx]
                snapped_strength = onset_env[peak_idx]
                snapped_beats.append(snapped_beat)
                snapped_strengths.append(snapped_strength)
            else:
                # Fallback to predicted beat if no onset found
                snapped_beats.append(predicted_beat)
                snapped_strengths.append(0.0)
        
        # Update beats and strengths with snapped versions
        beat_times = np.array(snapped_beats)
        beat_strengths = snapped_strengths
    
    # Basic beat confidence scoring and pruning (simplified to avoid issues)
    if len(beat_times) > 4:
        # Compute simple confidence based on strength
        confidences = []
        for i in range(len(beat_times)):
            # Base confidence from normalized onset strength
            max_strength = np.max(beat_strengths) if len(beat_strengths) > 0 else 1
            strength_conf = beat_strengths[i] / max_strength if max_strength > 0 else 0.5
            
            # Interval consistency confidence (simplified)
            interval_conf = 1.0
            if i > 0 and len(beat_times) > 1:
                mean_interval = np.mean(np.diff(beat_times))
                if mean_interval > 0:
                    current_interval = beat_times[i] - beat_times[i-1]
                    interval_ratio = current_interval / mean_interval
                    interval_conf = max(0.0, 1.0 - min(1.0, abs(interval_ratio - 1.0)))
            
            # Combined confidence (weighted average)
            confidence = 0.7 * strength_conf + 0.3 * interval_conf
            confidences.append(confidence)
        
        # Prune very low-confidence beats (threshold = 0.1)
        confidence_threshold = 0.1
        valid_beats = []
        valid_strengths = []
        
        for i in range(len(beat_times)):
            if confidences[i] >= confidence_threshold:
                valid_beats.append(beat_times[i])
                valid_strengths.append(beat_strengths[i])
        
        # Only update if we have remaining beats
        if len(valid_beats) > 0:
            beat_times = np.array(valid_beats)
            beat_strengths = valid_strengths
            filled_confidences = confidences
            filled_beats = valid_beats
            pruned_beats = valid_beats
            
            # Note: We'll add confidence scores to debug info later, after result is initialized
    
    # Try to detect downbeats (optional)
    downbeats = None
    try:
        # Suppress numpy warnings from madmom compatibility issues
        import warnings
        warnings.filterwarnings('ignore', category=UserWarning, module='madmom')
        warnings.filterwarnings('ignore', category=FutureWarning, module='madmom')
        
        from madmom.features.downbeats import DBNDownBeatTrackingProcessor, RNNDownBeatProcessor
        
        print("Madmom available, detecting downbeats...")
        
        # Use RNN processor to get downbeat probabilities
        proc = RNNDownBeatProcessor()
        print("Processing audio for downbeat probabilities...")
        downbeat_probs = proc(audio_path)
        
        print(f"Downbeat probabilities shape: {downbeat_probs.shape}")
        
        # Validate downbeat_probs shape before proceeding
        if len(downbeat_probs.shape) < 2 or downbeat_probs.shape[1] < 2:
            print(f"Invalid downbeat_probs shape: {downbeat_probs.shape}, using fallback method")
            downbeats = None
        else:
            # Try madmom DBN first, but catch any array shape errors
            try:
                print("Attempting madmom DBN downbeat tracking...")
                dbn = DBNDownBeatTrackingProcessor(beats_per_bar=[4], fps=100)
                downbeats_with_beats = dbn(downbeat_probs)
                
                # More robust extraction of downbeat times
                downbeats = []
                for item in downbeats_with_beats:
                    try:
                        if isinstance(item, (list, tuple, np.ndarray)) and len(item) >= 2:
                            time_val, beat_num = item[0], item[1]
                            if float(beat_num) == 1.0:
                                downbeats.append(float(time_val))
                    except (ValueError, TypeError, IndexError):
                        continue
                
                print(f"Madmom detected {len(downbeats)} downbeats")
                
            except (ValueError, TypeError) as dbn_error:
                print(f"Madmom DBN failed ({dbn_error}), using strength-based fallback")
                downbeats = None
        
        # Fallback: Use our own downbeat detection based on beat strengths and tempo
        if downbeats is None or len(downbeats) == 0:
            print("Using strength-based downbeat detection fallback...")
            # Convert tempo to scalar for fallback method
            tempo_for_fallback = 120.0  # Default
            try:
                if isinstance(tempo, np.ndarray):
                    tempo_for_fallback = float(tempo[0]) if len(tempo) > 0 else 120.0
                else:
                    tempo_for_fallback = float(tempo)
            except:
                tempo_for_fallback = 120.0
            
            downbeats = detect_downbeats_from_strengths(beat_times, beat_strengths, tempo_for_fallback)
            print(f"Strength-based method detected {len(downbeats)} downbeats")
            
    except Exception as e:
        print(f"Madmom downbeat detection failed: {type(e).__name__}: {e}")
        print("Using strength-based downbeat detection fallback...")
        try:
            # Convert tempo to scalar for fallback method
            tempo_for_fallback = 120.0  # Default
            try:
                if isinstance(tempo, np.ndarray):
                    tempo_for_fallback = float(tempo[0]) if len(tempo) > 0 else 120.0
                else:
                    tempo_for_fallback = float(tempo)
            except:
                tempo_for_fallback = 120.0
                
            downbeats = detect_downbeats_from_strengths(beat_times, beat_strengths, tempo_for_fallback)
            print(f"Fallback method detected {len(downbeats)} downbeats")
        except Exception as fallback_error:
            print(f"Fallback downbeat detection also failed: {fallback_error}")
            downbeats = None

    # Prepare result
    # Ensure tempo is a scalar float - try direct conversion first
    tempo_scalar = 120.0  # Default fallback
    try:
        tempo_scalar = float(tempo)
    except:
        pass  # Use default
    
    result = {
        "version": 1,
        "engine": "advanced",
        "audio": audio_path.replace("\\", "/"),
        "tempo_global": tempo_scalar,
        "beats": [float(t) for t in beat_times.tolist()],
        "strength": [float(s) for s in beat_strengths],
        "tempo_curve": {
            "t": [float(t) for t, _ in tempo_curve],
            "bpm": [float(bpm) for _, bpm in tempo_curve]
        }
    }
    
    # Add downbeats if detected successfully
    if downbeats is not None and len(downbeats) > 0:
        result["downbeats"] = [float(t) for t in downbeats]
        print(f"Added {len(downbeats)} downbeats to result")
    else:
        print("No downbeats available in result")
    
    # Add confidence scores to debug info if we computed them
    if debug and len(filled_confidences) > 0:
        result.setdefault("debug", {})["beat_confidences"] = filled_confidences
        result["debug"]["pruned_count"] = len(beat_times) - len(filled_beats) if len(filled_beats) > 0 else 0
        result["debug"]["filled_count"] = len(filled_beats) - len(pruned_beats) if len(filled_beats) > 0 and len(pruned_beats) > 0 else 0
    
    # Add downbeats if available
    if downbeats is not None and len(downbeats) > 0:
        result["downbeats"] = downbeats
    
    # Add other debug info if requested
    if debug:
        result.setdefault("debug", {}).update({
            "sr": sr,
            "duration": len(y) / sr,
            "onset_env_peak": float(np.max(onset_env)),
            "onset_env_mean": float(np.mean(onset_env)),
            "preprocessing": {
                "hpss_percussive_peak": float(np.max(np.abs(y_percussive))),
                "hpss_percussive_rms": float(np.sqrt(np.mean(y_percussive**2))),
                "transient_peak": float(np.max(np.abs(y_transient))),
                "transient_rms": float(np.sqrt(np.mean(y_transient**2)))
            }
        })
    
    return result

def save_beats(beats_data, output_path="cache/beats.json"):
    """Save beats data to JSON file"""
    # Defensive: ensure legacy key `beats_sec` exists for older UI readers
    try:
        if "beats_sec" not in beats_data:
            flat = []
            b = beats_data.get("beats")
            if isinstance(b, list):
                for entry in b:
                    if isinstance(entry, dict) and "time" in entry:
                        try:
                            flat.append(float(entry["time"]))
                        except Exception:
                            continue
                    else:
                        try:
                            flat.append(float(entry))
                        except Exception:
                            continue
            if len(flat) > 0:
                beats_data["beats_sec"] = flat
    except Exception as e:
        # Avoid breaking saving on unexpected shapes
        print(f"Warning: failed to construct beats_sec: {e}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(beats_data, f, indent=2)
    print(f"Saved beats data to {output_path}")

def main(audio_path, output_path="cache/beats.json", debug=False):
    """Main entry point for advanced beat detection"""
    beats_data = compute_advanced_beats(audio_path, debug=debug)
    save_beats(beats_data, output_path)
    return beats_data

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Advanced beat detection")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("--output", "-o", default="cache/beats.json", 
                       help="Output path for beats JSON")
    parser.add_argument("--debug", action="store_true", help="Include debug information")
    args = parser.parse_args()
    
    main(args.audio_path, args.output, args.debug)
