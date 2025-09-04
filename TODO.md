# FappTap Development Plan - Coding Agent Implementation Guide

## 🎯 **CURRENT STATUS**

✅ **MAJOR PROGRESS COMPLETED:**

- Render system completely rewritten and working with real cutlist data
- Virtual environment issues resolved
- Preset support added (landscape/portrait/square with crop-to-fill)
- Batching system implemented to handle large cutlists (356+ events)
- SAR normalization fixing video compatibility issues
- End-to-end video creation working with proxy quality

## 🚀 **PHASE 1: CORE FEATURES (CRITICAL)**

### 1. **Implement Beat-Driven Cutting Rate Modes**

**Priority: HIGHEST - This is the killer feature that differentiates the app**

#### **Backend Implementation:**

- [ ] **Modify `analysis/build_cutlist.py`** to accept cutting mode parameter

  - Add `--cutting-mode` argument: `slow`, `medium`, `fast`, `ultra-fast`, `random`, `auto`
  - Replace fixed `MIN_DUR = 0.40` with dynamic calculation based on mode + BPM
  - Implement tempo-aware cutting logic for each mode

- [ ] **Implement cutting mode algorithms:**

  ```python
  # In analysis/build_cutlist.py
  def get_cut_duration(mode, bpm, beat_strength=None):
      beat_interval = 60 / bpm
      if mode == "slow": return beat_interval * random.uniform(4, 8)
      elif mode == "medium": return beat_interval * random.uniform(2, 4)
      elif mode == "fast": return beat_interval * random.uniform(1, 2)
      elif mode == "ultra_fast": return beat_interval * random.uniform(0.5, 1)
      elif mode == "random": return beat_interval * random.choice([1,1,2,2,2,4,4,8])
      elif mode == "auto": return auto_analyze_section(beat_strength, bpm)
  ```

- [ ] **Add Random Mode with Intelligence:**

  - Weighted randomness (bias toward 2-4 beats)
  - Pattern avoidance (prevent consecutive same durations)
  - Seed control for reproducible results
  - Beat strength consideration for smart randomness

- [ ] **Update worker/main.py cutlist stage:**
  - Add `--cutting-mode` argument to argument parser
  - Pass cutting mode to build_cutlist function
  - Update debug output to show selected cutting mode

#### **Frontend Integration:**

- [ ] **Update ActionsPane.tsx** to include cutting mode selection

  - Add dropdown/radio buttons for: Slow, Medium, Fast, Ultra Fast, Random, Auto
  - Show BPM-based preview of expected cut rates
  - Display cutting mode in progress messages
  - Save selected mode to state management

- [ ] **Add cutting mode to workflow:**
  - Include cutting mode parameter in `runStage("cutlist")` calls
  - Display selected mode in cutlist generation progress
  - Add cutting mode to render output metadata

### 2. **Add Final/High-Quality Render Mode**

**Priority: HIGH - Users need to export their creations**

#### **Backend Implementation:**

- [ ] **Enhance worker/main.py render stage:**
  - Add `--quality` argument: `proxy`, `final`
  - Implement different encoding settings:
    ```python
    if quality == "proxy":
        cmd_args.extend(["-c:v", "h264", "-crf", "28", "-preset", "ultrafast"])
    elif quality == "final":
        cmd_args.extend(["-c:v", "h264", "-crf", "18", "-preset", "slow"])
        cmd_args.extend(["-movflags", "+faststart"])  # Web optimization
    ```
  - Update output filenames: `{preset}_proxy.mp4` vs `{preset}_final.mp4`
  - Add progress tracking for longer final renders

#### **Frontend Integration:**

- [ ] **Add "Create Final Video" button to ActionsPane.tsx:**

  - Separate button from proxy render
  - Show estimated time for final render
  - Disable during rendering with progress bar
  - Success state with download/play options

- [ ] **Update state management:**
  - Track both proxy and final render states separately
  - Store paths to both proxy and final outputs
  - Add final render progress tracking

## 🔧 **PHASE 2: WORKFLOW COMPLETION (HIGH PRIORITY)**

### 3. **Complete End-to-End Workflow Testing**

- [ ] **Test complete user journey:**

  - Audio selection → Beat detection → Video selection → Cutting mode selection → Cutlist generation → Proxy render → Final render
  - Verify all three presets work: landscape, portrait, square
  - Test with different cutting modes
  - Validate output quality and correctness

- [ ] **Add workflow validation:**
  - Prevent cutlist generation without audio and videos
  - Prevent rendering without valid cutlist
  - Show clear error messages for missing prerequisites
  - Add workflow progress indicators

### 4. **Enhanced Error Handling and User Feedback**

- [ ] **Improve error detection:**

  - Validate all input files exist before processing
  - Check FFmpeg availability and version
  - Verify output files are created and valid
  - Add file size and duration validation

- [ ] **Better progress tracking:**
  - Real-time progress for long operations
  - ETAs for final renders
  - Cancel operation support
  - Clear success/failure states

## 🎨 **PHASE 3: UI/UX ENHANCEMENTS (MEDIUM PRIORITY)**

### 5. **Cutting Mode UI Integration**

- [ ] **Add cutting mode selection panel:**

  - Visual preview of cutting rates
  - BPM display and cut rate calculation
  - Mode descriptions and use cases
  - Preview animation showing cutting rhythm

- [ ] **Render quality selection:**
  - Clear distinction between proxy and final
  - Quality settings explanation
  - File size estimates
  - Render time estimates

### 6. **Workflow Guidance**

- [ ] **Add step-by-step workflow indicators:**

  - Progress breadcrumbs
  - Required vs optional steps
  - Smart defaults and recommendations
  - Tooltips and help text

- [ ] **Results preview and validation:**
  - Thumbnail previews of output videos
  - Quick stats (duration, file size, cut count)
  - Play/download buttons for outputs
  - Regenerate options with different settings

## 🚀 **PHASE 4: ADVANCED FEATURES (LOWER PRIORITY)**

### 7. **Auto/AI Cutting Mode**

- [ ] **Implement intelligent cutting analysis:**
  - Analyze song sections (verse/chorus/bridge)
  - Energy-based cutting rate adjustment
  - Beat strength weighting
  - Tempo change detection and adaptation

### 8. **Advanced Beat Detection Fixes**

- [ ] **Fix madmom/numpy compatibility issues:**
  - Resolve tempo curve computation errors
  - Fix downbeat detection
  - Add fallback algorithms
  - Improve beat confidence scoring

### 9. **Performance and Polish**

- [ ] **Optimize rendering performance:**

  - Parallel batch processing
  - Memory usage optimization
  - Temporary file cleanup
  - Progress optimization

- [ ] **Code quality improvements:**
  - Error handling standardization
  - Logging improvements
  - Documentation updates
  - Test coverage

## 📋 **IMPLEMENTATION ORDER FOR CODING AGENT**

### **Sprint 1: Beat-Driven Cutting (Week 1)**

1. Modify `analysis/build_cutlist.py` with cutting mode support
2. Implement all cutting mode algorithms (slow/medium/fast/ultra-fast/random)
3. Update `worker/main.py` to accept and pass cutting mode parameters
4. Test cutting modes with command line to verify functionality

### **Sprint 2: UI Integration (Week 1-2)**

1. Add cutting mode selection to ActionsPane.tsx
2. Integrate cutting mode into cutlist generation workflow
3. Update state management for cutting mode persistence
4. Test UI integration with all cutting modes

### **Sprint 3: Final Render Quality (Week 2)**

1. Implement high-quality render settings in worker/main.py
2. Add "Create Final Video" button to UI
3. Implement progress tracking for final renders
4. Test final render with all presets and cutting modes

### **Sprint 4: End-to-End Testing (Week 2-3)**

1. Complete workflow testing from start to finish
2. Fix any integration issues discovered
3. Add proper error handling and validation
4. Polish UI/UX based on testing feedback

### **Sprint 5: Advanced Features (Week 3+)**

1. Implement Auto/AI cutting mode
2. Fix advanced beat detection issues
3. Add performance optimizations
4. Final polish and documentation

## 🎯 **SUCCESS CRITERIA**

**Must Have:**

- [ ] All 5 cutting modes working (Slow, Medium, Fast, Ultra Fast, Random)
- [ ] Final high-quality render mode functional
- [ ] Complete workflow from audio selection to final video export
- [ ] All three presets working (landscape/portrait/square)
- [ ] Error handling preventing crashes and providing clear feedback

**Nice to Have:**

- [ ] Auto/AI cutting mode with energy analysis
- [ ] Advanced beat detection improvements
- [ ] Performance optimizations
- [ ] Comprehensive UI polish

## � **TECHNICAL DEBT TO ADDRESS**

- [ ] Standardize all Python execution to use `.venv\Scripts\python.exe`
- [ ] Implement proper temporary file cleanup
- [ ] Add comprehensive logging throughout pipeline
- [ ] Create unit tests for cutting mode algorithms
- [ ] Document API interfaces between frontend and backend

This plan transforms FappTap from a working prototype into a production-ready, musically intelligent video editor with unique cutting rate capabilities that set it apart from all other video editing tools.

### 10. **BEAT-DRIVEN CUTTING RATES (CORE FEATURE)**

- [ ] **Priority: CRITICAL** - This is fundamental to the app's unique value
- [ ] **Issue**: Current system uses fixed 0.40s minimum with calculated stride
- [ ] **Problem**: All videos cut at same rate regardless of music character
- [ ] **Solution**: Implement tempo-aware cutting rate system with multiple modes

#### **Cutting Rate Presets:**

- [ ] **Slow Mode**: 4-8 beats per cut (0.8-3.2s @ 120 BPM)
- [ ] **Medium Mode**: 2-4 beats per cut (0.4-1.6s @ 120 BPM)
- [ ] **Fast Mode**: 1-2 beats per cut (0.2-0.8s @ 120 BPM)
- [ ] **Ultra Fast Mode**: Every beat/sub-beat (0.1-0.5s @ 120 BPM)
- [ ] **Random Mode**: Randomly rotate through different speeds/lengths for dynamic unpredictability

#### **Random Mode Implementation:**

- [ ] **Random Duration Selection**: Randomly choose between 1-8 beat durations
- [ ] **Weighted Randomness**: Bias toward musically appropriate lengths (2-4 beats more common)
- [ ] **Pattern Avoidance**: Prevent too many consecutive same-length cuts
- [ ] **Seed Control**: Optional seed parameter for reproducible randomness
- [ ] **Smart Randomness**: Consider beat strength when choosing random durations

#### **AUTO/AI Mode Features:**

- [ ] Analyze song sections (verse/chorus/bridge/drop)
- [ ] Adjust cutting rate based on energy/tempo changes
- [ ] Sync to downbeats vs regular beats vs subdivisions
- [ ] Consider beat strength data from advanced beat detection
- [ ] Implement energy-based cutting (faster during high energy)

#### **Technical Implementation:**

- [ ] Modify `analysis/build_cutlist.py` to accept cutting mode parameter
- [ ] Add `--cutting-mode` argument to worker/main.py cutlist stage
- [ ] Replace fixed `MIN_DUR` with dynamic calculation based on mode + BPM
- [ ] Implement random duration generator with configurable parameters
- [ ] Add UI controls for cutting mode selection
- [ ] Integrate with advanced beat detection for energy analysis
- [ ] Add preview of cutting pattern before generating cutlist

#### **Example Cutting Mode Calculations:**

```python
BPM = 128 (electronic music)
Beat interval = 60/128 = 0.469s

Slow: 4-8 beats = 1.875-3.75s per cut
Medium: 2-4 beats = 0.938-1.875s per cut
Fast: 1-2 beats = 0.469-0.938s per cut
Ultra Fast: 0.5-1 beat = 0.234-0.469s per cut
Random: 1-8 beats = 0.469-3.75s per cut (randomly chosen)
```

#### **UI Integration:**

- [ ] Add dropdown/radio buttons for cutting mode selection
- [ ] Show preview of expected cut rate based on detected BPM
- [ ] Display cutting mode in cutlist generation progress
- [ ] Add cutting mode to render output metadata

Todo to add:
FILE BROWSER

- File broswer performance: If a dir has a lot of videos, it crashes the app as it appears to try to load them all at once. Can we implement something here like lazyload or something similar to stop the app from crashing.
- When a folder has a lot of videos, it stretches the ui tries to accomidate so user has to scroll the entire length of the videos to see things that should always be seen like create videos. Perhaps there should be a always visible top and bottom bar? with the most vital settings
- We can get rid of the optional inline option and always play the videos in the browser inline it looks great.
- Replace the checkmark box when selecting it with a outline and/or gradiant over the image showing that it has been selected. You can barely see the checkbocx, and it feels natural just pressing it once to play it, and then leaving it on if you want it included.
- Add a SELECT ALL button at the top of the video browser.
- the Videos and load music should be "Add Videos" and "Add Music". They should be side by side not stacked.
- All portrait videos with slightly different dimensions should be cropped to the same size. Same rule for landscape and square. This makes it easy to tell what proportion video you are selecting. Also when square or landscape, should be centered vertically instead of at top.
- Filenames really arent very important in this setting. Lets try making them as a overlay on top of the videos, small font.
- Lets try adding a small thumbs button in addition to the view we have now to make it easier to see all or at least more of the videos in a file.
- Once videos are selected they should be placed onto the timeline in random order.
- Once selected, the browser view should close and be replaced with a vertical list of the selected videos which represent the order they are in. User should be able to drag and drop to change their order, or press a random button to randomize their order. The preview pane should show a preview of the videos in the order they are set as in the left sidebar. This sets up the ui to add video effects and tweak with the beat/cut settings and see a preview in real time before rendering the full video.

VIDEO PREVIEW

- Video preview is basically non-existent. I need to see a large video player with the beats/cuts displayed under it. This will allow user to see if beats/cuts are being placed in the correct spots, aka when there is a beat. If possible, for larger/stronger beats, a bigger dot or different color dot (such as downbeat being a different color then regular beats). It would also be great if I could create my own cuts on the timeline by clicking and creating a new one, or dragging an existing one.

EFFECTS

- Effects need to be added to the cuts. Each effect should have Low/Med/High, which will determine how much of that effect get added to the video. The placement of each effect should be randomized throughout all the cuts, and visually represented on the timeline with a colored dot. Preliminary effects we can add are Flash, RGB Glitch, Zoom, and Shake.
