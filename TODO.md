# FappTap Critical Issues - TODO List

## 🚨 **CRITICAL PIPELINE ISSUES**

### 1. **RENDER SYSTEM IS BROKEN**
- [ ] **Issue**: Render always uses hardcoded file `media_samples/76319854.mp4` 
- [ ] **Issue**: Render output is always 416kb, 5 seconds regardless of input
- [ ] **Issue**: Render doesn't use the actual selected video or cutlist data
- [ ] **Fix**: Make render use the actual cutlist.json and selected media
- [ ] **Fix**: Implement proper video concatenation from cutlist events
- [ ] **Priority**: HIGH - Core functionality broken

### 2. **MISSING FINAL VIDEO CREATION**
- [ ] **Issue**: No "Create Video" button in UI 
- [ ] **Issue**: Only proxy preview available, no final high-quality render
- [ ] **Issue**: Users can't actually create final output videos
- [ ] **Fix**: Add "Create Final Video" button/functionality
- [ ] **Fix**: Implement full-quality render mode (not just proxy)
- [ ] **Priority**: HIGH - Core user workflow missing

### 3. **VIDEO SELECTION NOT WORKING**
- [ ] **Issue**: Pipeline doesn't use user-selected videos
- [ ] **Issue**: Always falls back to sample video regardless of selection
- [ ] **Fix**: Verify video selection propagates through entire pipeline
- [ ] **Fix**: Check if video paths are correctly passed to all stages
- [ ] **Priority**: HIGH - User input ignored

### 4. **CUTLIST GENERATION ISSUES**
- [ ] **Issue**: Need to verify cutlist.json actually contains correct video clips
- [ ] **Issue**: Check if cutlist events match selected video files
- [ ] **Issue**: Verify aspect ratio calculations are correct
- [ ] **Fix**: Debug cutlist.json output contents
- [ ] **Fix**: Ensure video file paths are correctly processed
- [ ] **Priority**: HIGH - Data integrity

## 🔧 **TECHNICAL DEBT**

### 5. **ADVANCED BEAT DETECTION**
- [ ] **Issue**: Tempo curve computation failing ("using global tempo as fallback")
- [ ] **Issue**: Madmom downbeat detection broken (numpy array shape errors)
- [ ] **Issue**: NumPy deprecation warnings from madmom
- [ ] **Fix**: Debug tempo curve algorithm 
- [ ] **Fix**: Fix madmom numpy compatibility properly
- [ ] **Fix**: Add fallback behavior that actually works
- [ ] **Priority**: MEDIUM - Enhancement not working but basic beats work

### 6. **ERROR HANDLING AND FEEDBACK**
- [ ] **Issue**: Operations appear successful but don't actually work
- [ ] **Issue**: No meaningful error messages when things fail silently
- [ ] **Issue**: Progress indicators lie about actual progress
- [ ] **Fix**: Add real validation of outputs
- [ ] **Fix**: Implement proper error detection and reporting
- [ ] **Fix**: Make progress indicators reflect actual work
- [ ] **Priority**: MEDIUM - User experience

### 7. **FILE PATH HANDLING**
- [ ] **Issue**: Mixed path separators (\ vs /) causing issues
- [ ] **Issue**: Spaces in paths potentially causing problems
- [ ] **Issue**: Relative vs absolute path inconsistencies
- [ ] **Fix**: Standardize path handling across all components
- [ ] **Fix**: Add proper path validation
- [ ] **Priority**: MEDIUM - System robustness

## 🐛 **UI/UX ISSUES**

### 8. **WORKFLOW CLARITY**
- [ ] **Issue**: No clear indication of what "Basic Mode" vs "Advanced Mode" actually does
- [ ] **Issue**: Missing workflow guidance for users
- [ ] **Issue**: No validation that required steps are completed before next step
- [ ] **Fix**: Add workflow status indicators
- [ ] **Fix**: Add tooltips/help text explaining each mode
- [ ] **Fix**: Implement step dependencies (can't render without cutlist, etc.)
- [ ] **Priority**: LOW - User experience improvement

### 9. **OUTPUT VALIDATION**
- [ ] **Issue**: No verification that output files are valid
- [ ] **Issue**: No file size/duration checks
- [ ] **Issue**: No way to preview intermediate results
- [ ] **Fix**: Add output file validation
- [ ] **Fix**: Add preview capabilities for beats, shots, cutlist
- [ ] **Fix**: Add file size/duration reporting
- [ ] **Priority**: LOW - Quality assurance

## 🎯 **IMMEDIATE ACTION PLAN**

### Phase 1: Make Basic Functionality Work (HIGH Priority)
1. Fix render system to use actual cutlist data
2. Fix video selection to propagate through pipeline  
3. Add final video creation button/functionality
4. Verify cutlist generation uses correct video files

### Phase 2: Add Missing Core Features (HIGH Priority)  
1. Implement full-quality render mode
2. Add proper error detection and reporting
3. Fix file path handling inconsistencies

### Phase 3: Enhance and Polish (MEDIUM Priority)
1. Fix advanced beat detection properly
2. Improve workflow clarity and user guidance
3. Add output validation and previews

### Phase 4: Advanced Features (LOW Priority)
1. Optimize performance
2. Add advanced configuration options
3. Enhance UI/UX

## 📋 **INVESTIGATION NEEDED**

- [ ] **Trace the actual data flow**: What files are actually being read/written at each step?
- [ ] **Verify cutlist.json contents**: Does it contain the expected video events?
- [ ] **Check video file discovery**: Are video files being found and listed correctly?
- [ ] **Debug render input**: What parameters are actually being passed to FFmpeg?
- [ ] **Test with different video sets**: Does the problem persist with different media?

## 💡 **ROOT CAUSE HYPOTHESIS**

The system appears to be designed as a **demo/prototype** that shows the workflow but doesn't actually process user data. The pipeline stages complete successfully because they're using hardcoded sample data rather than the user's actual selections.

**CRITICAL**: The entire data flow from user selection → processing → output needs to be verified and likely rebuilt.