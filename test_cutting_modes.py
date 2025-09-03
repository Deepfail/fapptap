#!/usr/bin/env python3
"""
Test cutting modes functionality
"""
import sys
from pathlib import Path

# Add analysis to path
sys.path.insert(0, str(Path(__file__).parent / "analysis"))

def test_cutting_modes():
    """Test the cutting mode functionality"""
    from build_cutlist import apply_cutting_mode, CUTTING_MODES
    
    print("=== Testing Cutting Modes ===")
    
    # Sample beat times (every 0.5 seconds for 5 seconds)
    sample_beats = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
    
    print(f"Original beats: {sample_beats}")
    print(f"Original intervals: {[round(b-a, 3) for a, b in zip(sample_beats, sample_beats[1:])]}")
    print()
    
    for mode_name, mode_config in CUTTING_MODES.items():
        print(f"Testing {mode_name}: {mode_config['description']}")
        
        # Apply cutting mode
        modified_beats = apply_cutting_mode(sample_beats.copy(), mode_name)
        
        if len(modified_beats) > 1:
            intervals = [round(b-a, 3) for a, b in zip(modified_beats, modified_beats[1:])]
            print(f"  Modified beats: {[round(b, 3) for b in modified_beats[:6]]}..." if len(modified_beats) > 6 else f"  Modified beats: {[round(b, 3) for b in modified_beats]}")
            print(f"  New intervals: {intervals[:5]}..." if len(intervals) > 5 else f"  New intervals: {intervals}")
            print(f"  Total clips: {len(modified_beats)-1}")
        else:
            print(f"  Modified beats: {modified_beats}")
        print()
    
    print("✅ Cutting modes test completed!")

if __name__ == "__main__":
    test_cutting_modes()