#!/usr/bin/env python3
"""
Quick End-to-End Test
Test one complete workflow quickly
"""
import sys
import json
import subprocess
from pathlib import Path

def run_stage(stage, extra_args=[]):
    """Run one stage and return success"""
    cmd = [
        sys.executable, "worker/main.py", stage,
        "--song", "media_samples/76319854.mp4",  # Small file
        "--clips", "media_samples", 
        "--preset", "landscape",
        "--cutting_mode", "fast",  # Fast mode for quick test
        "--engine", "advanced"
    ] + extra_args
    
    print(f"🔄 {stage.upper()}: {' '.join(cmd[-6:])}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            print(f"✅ {stage} SUCCESS")
            return True
        else:
            print(f"❌ {stage} FAILED: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"⏰ {stage} TIMEOUT")
        return False
    except Exception as e:
        print(f"💥 {stage} ERROR: {e}")
        return False

def main():
    print("🚀 Quick End-to-End Test")
    print("=" * 30)
    
    stages = [
        ("beats", []),
        ("shots", []),
        ("cutlist", []),
        ("render", ["--proxy"]),  # Quick proxy render
        ("render", [])  # Final render
    ]
    
    success_count = 0
    
    for stage, args in stages:
        if run_stage(stage, args):
            success_count += 1
        else:
            print(f"⚠️  Stopping at {stage} failure")
            break
        print()
    
    print(f"🏁 RESULTS: {success_count}/{len(stages)} stages completed")
    
    if success_count == len(stages):
        print("🎉 FULL WORKFLOW SUCCESS!")
        
        # Check output files
        outputs = [
            "cache/beats.json",
            "cache/shots.json", 
            "cache/cutlist.json",
            "render/landscape_proxy.mp4",
            "render/landscape_final.mp4"
        ]
        
        print("\n📁 Output Files:")
        for output in outputs:
            path = Path(output)
            if path.exists():
                size = path.stat().st_size / (1024 * 1024)
                print(f"✅ {output} ({size:.1f} MB)")
            else:
                print(f"❌ {output} (missing)")
    else:
        print("❌ Workflow incomplete")
    
    return success_count == len(stages)

if __name__ == "__main__":
    sys.exit(0 if main() else 1)