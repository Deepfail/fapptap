import json
import os
import subprocess
from pathlib import Path

def get_video_duration(video_path):
    """Get duration of a video file using ffprobe"""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet', '-print_format', 'json', 
            '-show_format', video_path
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return float(data['format']['duration'])
        return 0.0
    except:
        return 0.0

# Check a subset of media_samples to see total duration
media_dir = "C:/Files/Projects/fapptap/media_samples"
video_files = [f for f in os.listdir(media_dir) if f.endswith('.mp4')][:10]  # First 10 files

total_duration = 0.0
print("Sample videos and their durations:")
for video_file in video_files:
    video_path = os.path.join(media_dir, video_file)
    duration = get_video_duration(video_path)
    total_duration += duration
    print(f"{video_file}: {duration:.3f}s")

print(f"\nTotal duration of {len(video_files)} sample videos: {total_duration:.3f}s")

# Compare with cutlist
with open('cache/cutlist.json', 'r') as f:
    cutlist = json.load(f)

cutlist_duration = cutlist.get('total_duration', 0)
print(f"Cutlist total duration: {cutlist_duration}s")
print(f"Ratio (cutlist/source): {cutlist_duration/total_duration:.2f}x")