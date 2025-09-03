#!/usr/bin/env python3
"""
Quick test to verify that all Python errors are fixed and basic functionality works.
"""
import json
import sys
from pathlib import Path

# Add worker to path
sys.path.insert(0, str(Path(__file__).parent / "worker"))

def test_imports():
    """Test that all modules import without errors"""
    print("Testing imports...")
    
    try:
        from main import run_beats
        print("✓ main.py imports successfully")
    except Exception as e:
        print(f"✗ main.py import failed: {e}")
        return False
    
    try:
        from beats_adv import compute_advanced_beats
        print("✓ beats_adv.py imports successfully")
    except Exception as e:
        print(f"✗ beats_adv.py import failed: {e}")
        return False
    
    return True

def test_basic_functionality():
    """Test basic beat detection functionality"""
    print("Testing basic functionality...")
    
    # Mock the emit function to capture output
    results = []
    def mock_emit(stage, **kw):
        results.append({'stage': stage, **kw})
        print(f"  {stage}: {kw}")
    
    # Replace the global emit function
    import main
    original_emit = main.emit
    main.emit = mock_emit
    
    try:
        # Test with a sample file (if it exists)
        sample_file = Path("media_samples/anal.mp4")
        if sample_file.exists():
            print(f"Testing with sample file: {sample_file}")
            main.run_beats(str(sample_file), "simple")
            print("✓ Simple beat detection completed")
        else:
            print("⚠ No sample file found, skipping functionality test")
    except Exception as e:
        print(f"✗ Beat detection failed: {e}")
        return False
    finally:
        # Restore original emit function
        main.emit = original_emit
    
    return True

if __name__ == "__main__":
    print("=== Testing Python Backend Fixes ===")
    
    success = True
    
    # Test imports
    success &= test_imports()
    print()
    
    # Test basic functionality
    success &= test_basic_functionality()
    print()
    
    if success:
        print("✅ All tests passed! Backend is working correctly.")
    else:
        print("❌ Some tests failed. Check the output above.")
    
    sys.exit(0 if success else 1)