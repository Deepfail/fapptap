import subprocess
import json
import numpy as np
import os
from pathlib import Path
import tempfile
import time

def generate_click_track(duration=30, bpm=120, output_path=None):
    """
    Generate a synthetic click track with ffmpeg
    
    Parameters:
    -----------
    duration : int
        Duration of the click track in seconds
    bpm : float
        Beats per minute
    output_path : str
        Path to save the click track. If None, a temporary file is created.
        
    Returns:
    --------
    str
        Path to the generated click track
    """
    if output_path is None:
        # Create a temporary file
        fd, output_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
    
    # Calculate beat interval in seconds
    beat_interval = 60 / bpm
    
    # Create ffmpeg command
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-nostats",
        "-f", "lavfi", "-i", f"sine=frequency=1000:duration=0.05",
        "-f", "lavfi", "-i", "anullsrc",
        "-t", str(duration),
        "-filter_complex", f"[0]atrim=0:0.05,aloop=loop=-1:size=1[beep];[beep]asetpts=N/SR/TB,atempo={1/beat_interval}[out]",
        "-map", "[out]", "-map", "1",
        "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k",
        output_path
    ]
    
    print(f"Generating click track at {bpm} BPM...")
    print(f"Command: {' '.join(cmd)}")
    
    # Run ffmpeg
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    print(f"Click track generated at {output_path}")
    return output_path

def compute_ground_truth_beats(bpm, duration):
    """
    Compute ground truth beat times for a click track
    
    Parameters:
    -----------
    bpm : float
        Beats per minute
    duration : float
        Duration of the click track in seconds
        
    Returns:
    --------
    list
        List of beat times in seconds
    """
    # Calculate beat interval in seconds
    beat_interval = 60 / bpm
    
    # Generate beat times
    beat_times = []
    current_time = 0
    
    while current_time < duration:
        beat_times.append(current_time)
        current_time += beat_interval
    
    return beat_times

def compute_beat_offset(detected_beats, ground_truth_beats, tolerance_ms=70):
    """
    Compute the offset between detected beats and ground truth beats
    
    Parameters:
    -----------
    detected_beats : list
        List of detected beat times in seconds
    ground_truth_beats : list
        List of ground truth beat times in seconds
    tolerance_ms : float
        Tolerance in milliseconds for matching beats
        
    Returns:
    --------
    dict
        Dictionary with offset_ms, rms_error_ms, and matched_beats
    """
    if not detected_beats or not ground_truth_beats:
        return {
            "offset_ms": 0,
            "rms_error_ms": float('inf'),
            "matched_beats": 0
        }
    
    # Convert tolerance to seconds
    tolerance_sec = tolerance_ms / 1000
    
    # Compute all pairwise differences
    errors = []
    matched_beats = 0
    
    for gt_beat in ground_truth_beats:
        # Find closest detected beat
        closest_idx = np.argmin([abs(b - gt_beat) for b in detected_beats])
        closest_beat = detected_beats[closest_idx]
        
        # Check if within tolerance
        error = closest_beat - gt_beat
        if abs(error) <= tolerance_sec:
            errors.append(error)
            matched_beats += 1
    
    if not errors:
        return {
            "offset_ms": 0,
            "rms_error_ms": float('inf'),
            "matched_beats": 0
        }
    
    # Compute mean offset and RMS error
    mean_offset_sec = np.mean(errors)
    rms_error_sec = np.sqrt(np.mean([e**2 for e in errors]))
    
    return {
        "offset_ms": mean_offset_sec * 1000,
        "rms_error_ms": rms_error_sec * 1000,
        "matched_beats": matched_beats
    }

def calibrate_beat_detection(bpm=120, duration=30, output_path="cache/beats_calibration.json"):
    """
    Calibrate beat detection by generating a click track and comparing detected beats
    with ground truth beats
    
    Parameters:
    -----------
    bpm : float
        Beats per minute for the click track
    duration : int
        Duration of the click track in seconds
    output_path : str
        Path to save the calibration results
        
    Returns:
    --------
    dict
        Calibration results
    """
    # Create directories if they don't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Generate click track
    click_track_path = generate_click_track(duration=duration, bpm=bpm)
    
    try:
        # Compute ground truth beats
        ground_truth_beats = compute_ground_truth_beats(bpm, duration)
        
        # Import beats_adv to avoid circular imports
        import beats_adv
        
        # Detect beats
        print(f"Detecting beats in click track...")
        beats_data = beats_adv.compute_advanced_beats(click_track_path, debug=True)
        detected_beats = beats_data["beats"]
        
        # Compute offset
        offset_data = compute_beat_offset(detected_beats, ground_truth_beats)
        
        # Prepare calibration results
        calibration = {
            "bpm": bpm,
            "offset_ms": offset_data["offset_ms"],
            "rms_error_ms": offset_data["rms_error_ms"],
            "matched_beats": offset_data["matched_beats"],
            "total_beats": len(ground_truth_beats),
            "match_rate": offset_data["matched_beats"] / len(ground_truth_beats) if ground_truth_beats else 0,
            "timestamp": time.time()
        }
        
        # Save calibration results
        with open(output_path, 'w') as f:
            json.dump(calibration, f, indent=2)
        
        print(f"Calibration results saved to {output_path}")
        print(f"Offset: {calibration['offset_ms']:.2f} ms")
        print(f"RMS error: {calibration['rms_error_ms']:.2f} ms")
        print(f"Match rate: {calibration['match_rate']:.2f} ({calibration['matched_beats']}/{calibration['total_beats']})")
        
        return calibration
    
    finally:
        # Clean up temporary file
        if os.path.exists(click_track_path):
            os.remove(click_track_path)

def apply_calibration(beats, calibration_path="cache/beats_calibration.json"):
    """
    Apply calibration to detected beats
    
    Parameters:
    -----------
    beats : list
        List of beat times in seconds
    calibration_path : str
        Path to the calibration file
        
    Returns:
    --------
    list
        Calibrated beat times in seconds
    """
    if not os.path.exists(calibration_path):
        print(f"Calibration file not found: {calibration_path}")
        return beats
    
    try:
        with open(calibration_path, 'r') as f:
            calibration = json.load(f)
        
        offset_sec = calibration["offset_ms"] / 1000
        
        # Apply offset
        calibrated_beats = [b - offset_sec for b in beats]
        
        print(f"Applied calibration offset: {calibration['offset_ms']:.2f} ms")
        
        return calibrated_beats
    
    except Exception as e:
        print(f"Error applying calibration: {e}")
        return beats

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Beat detection calibration")
    parser.add_argument("--bpm", type=float, default=120, help="BPM for the click track")
    parser.add_argument("--duration", type=int, default=30, help="Duration of the click track in seconds")
    parser.add_argument("--output", "-o", default="cache/beats_calibration.json", help="Output path for calibration results")
    
    args = parser.parse_args()
    
    calibrate_beat_detection(bpm=args.bpm, duration=args.duration, output_path=args.output)
