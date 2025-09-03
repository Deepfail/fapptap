#!/usr/bin/env python3
"""
End-to-End Workflow Test
Test the complete video processing pipeline from beats to final render
"""
import sys
import json
import subprocess
from pathlib import Path
import time

def run_worker_stage(stage, song, clips, preset="landscape", cutting_mode="medium", engine="advanced", proxy=None):
    """Run a worker stage and return the result"""
    print(f"\n🔄 Running {stage} stage...")
    
    cmd = [
        sys.executable, "worker/main.py", stage,
        "--song", song,
        "--clips", clips, 
        "--preset", preset,
        "--cutting_mode", cutting_mode,
        "--engine", engine
    ]
    
    if proxy is not None:
        if proxy:
            cmd.append("--proxy")
    
    print(f"Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            print(f"✅ {stage} completed successfully")
            # Parse JSON output messages
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    try:
                        msg = json.loads(line)
                        if msg.get('progress') == 1.0 and 'output' in msg:
                            print(f"📄 Output: {msg['output']}")
                    except json.JSONDecodeError:
                        pass
            return True
        else:
            print(f"❌ {stage} failed with exit code {result.returncode}")
            print(f"STDERR: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"⏰ {stage} timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"💥 {stage} crashed: {e}")
        return False

def check_file_exists(file_path, description):
    """Check if a file exists and print status"""
    path = Path(file_path)
    if path.exists():
        size_mb = path.stat().st_size / (1024 * 1024)
        print(f"✅ {description}: {file_path} ({size_mb:.1f} MB)")
        return True
    else:
        print(f"❌ {description}: {file_path} (missing)")
        return False

def test_complete_workflow():
    """Test the complete workflow from start to finish"""
    print("🎬 FAPPTap End-to-End Workflow Test")
    print("=" * 50)
    
    # Test configuration
    song_path = "media_samples/anal.mp4"  # Using video with audio
    clips_dir = "media_samples"
    test_cases = [
        {"preset": "landscape", "cutting_mode": "medium", "engine": "advanced"},
        {"preset": "portrait", "cutting_mode": "fast", "engine": "advanced"},
        {"preset": "square", "cutting_mode": "random", "engine": "advanced"},
    ]
    
    # Verify input files exist
    print("\n📁 Checking Input Files...")
    if not check_file_exists(song_path, "Audio/video source"):
        print("⚠️  Cannot proceed without audio source")
        return False
    
    if not Path(clips_dir).exists():
        print(f"⚠️  Clips directory {clips_dir} not found")
        return False
    
    # Count available video clips
    video_exts = ('.mp4', '.mov', '.mkv', '.webm', '.m4v')
    clips = list(Path(clips_dir).glob('*'))
    video_clips = [c for c in clips if c.suffix.lower() in video_exts]
    print(f"📹 Found {len(video_clips)} video clips in {clips_dir}")
    
    if len(video_clips) < 5:
        print("⚠️  Need at least 5 video clips for testing")
        return False
    
    overall_success = True
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test Case {i}/{len(test_cases)}: {test_case}")
        print("-" * 40)
        
        preset = test_case["preset"]
        cutting_mode = test_case["cutting_mode"]
        engine = test_case["engine"]
        
        # Stage 1: Beat Analysis
        if not run_worker_stage("beats", song_path, clips_dir, preset, cutting_mode, engine):
            print(f"❌ Test case {i} failed at beats stage")
            overall_success = False
            continue
        
        # Verify beats output
        if not check_file_exists("cache/beats.json", "Beats analysis"):
            overall_success = False
            continue
        
        # Stage 2: Shot Detection
        if not run_worker_stage("shots", song_path, clips_dir, preset, cutting_mode, engine):
            print(f"❌ Test case {i} failed at shots stage")
            overall_success = False
            continue
        
        # Verify shots output
        if not check_file_exists("cache/shots.json", "Shot detection"):
            overall_success = False
            continue
        
        # Stage 3: Cutlist Generation
        if not run_worker_stage("cutlist", song_path, clips_dir, preset, cutting_mode, engine):
            print(f"❌ Test case {i} failed at cutlist stage")
            overall_success = False
            continue
        
        # Verify cutlist output
        if not check_file_exists("cache/cutlist.json", "Cutlist generation"):
            overall_success = False
            continue
        
        # Stage 4: Proxy Render
        if not run_worker_stage("render", song_path, clips_dir, preset, cutting_mode, engine, proxy=True):
            print(f"❌ Test case {i} failed at proxy render stage")
            overall_success = False
            continue
        
        # Verify proxy output
        proxy_file = f"render/{preset}_proxy.mp4"
        if not check_file_exists(proxy_file, "Proxy render"):
            overall_success = False
            continue
        
        # Stage 5: Final Render
        if not run_worker_stage("render", song_path, clips_dir, preset, cutting_mode, engine, proxy=False):
            print(f"❌ Test case {i} failed at final render stage")
            overall_success = False
            continue
        
        # Verify final output
        final_file = f"render/{preset}_final.mp4"
        if not check_file_exists(final_file, "Final render"):
            overall_success = False
            continue
        
        # Compare file sizes
        proxy_path = Path(proxy_file)
        final_path = Path(final_file)
        if proxy_path.exists() and final_path.exists():
            proxy_size = proxy_path.stat().st_size / (1024 * 1024)
            final_size = final_path.stat().st_size / (1024 * 1024)
            ratio = final_size / proxy_size if proxy_size > 0 else 0
            print(f"📊 Size comparison: Final ({final_size:.1f}MB) vs Proxy ({proxy_size:.1f}MB) = {ratio:.2f}x")
            
            if ratio > 1.05:  # Final should be at least 5% larger (higher quality)
                print("✅ Final render is higher quality (larger file)")
            else:
                print("⚠️  Final render should be larger than proxy")
                overall_success = False
        
        print(f"✅ Test case {i} completed successfully!")
    
    print("\n" + "=" * 50)
    
    if overall_success:
        print("🎉 ALL TESTS PASSED! Complete workflow is functional.")
        print("\n📋 Summary:")
        print("✅ Beat detection working")
        print("✅ Shot analysis working")
        print("✅ Cutlist generation working")
        print("✅ Proxy rendering working")
        print("✅ Final rendering working") 
        print("✅ All cutting modes tested")
        print("✅ All aspect ratios tested")
    else:
        print("❌ SOME TESTS FAILED! Check the output above.")
    
    return overall_success

if __name__ == "__main__":
    print("Starting FAPPTap End-to-End Workflow Test...")
    print(f"Python executable: {sys.executable}")
    print(f"Working directory: {Path.cwd()}")
    
    success = test_complete_workflow()
    sys.exit(0 if success else 1)