# Plan Adjustment Note - Media-First UI Redesign v1

## Detected Stack Summary

**Environment:** Linux (not Windows as expected)
- **Repository path:** `/home/runner/work/fapptap/fapptap` (not `C:\Files\Projects\fapptap`)
- **Package manager:** npm (not pnpm as mentioned in docs)
- **Tauri version:** v2 with @tauri-apps/api v2
- **Dev port:** 1420 (matches vite.config.ts)
- **Zustand version:** v5.0.8 (not v4 as mentioned in plan)
- **Tests:** vitest + jsdom environment, 2 tests currently passing
- **Sidecars:** No `src-tauri/sidecars/` directory detected yet

## Deviations from Original Plan

- **Environment mismatch:** Running on Linux instead of Windows - paths and executables will differ
- **Package manager:** Using npm instead of pnpm - all commands adapted accordingly  
- **Zustand version:** v5 instead of v4 - no subscribeWithSelector changes needed
- **Existing 3-pane layout:** LibraryPane, PreviewPane, ActionsPane already implemented
- **Script naming:** Current scripts (dev, build) don't match expected (dev:app, dev:web, build:app)
- **CSP configuration:** Currently set to null, needs asset: protocol allowance
- **Capabilities:** Missing shell permissions for worker/ffmpeg sidecars
- **Missing core libraries:** No mediaUrl.ts, platform.ts, or exec.ts helpers

## Key Missing Implementations

- **Media URL conversion:** No convertFileSrc usage detected in codebase
- **Platform detection:** No TAURI_PLATFORM usage found
- **Shell capabilities:** Capabilities file missing shell permissions
- **Worker execution:** No sidecar-aware exec resolution
- **Script structure:** Missing dev:app, dev:web, build:app scripts

## Assumptions Made

- **Tool resolution order:** Will implement sidecar → dev-binary → .venv → PATH fallback
- **Media paths:** All local media URLs need convertFileSrc wrapping for Tauri
- **CSP requirements:** Need asset: and http://*asset.localhost/* for media and HMR
- **Mock data:** Browser fallbacks will continue using /mock/clips.json
- **Test stability:** Existing tests should continue passing throughout changes

## Risk Items to Revisit

- **Cross-platform compatibility:** Linux environment may reveal Windows-specific assumptions
- **Sidecar availability:** No physical sidecars present - will implement detection/fallback
- **Performance impact:** convertFileSrc wrapping may affect media loading performance
- **Existing state management:** Changes to platform detection may affect current store logic
- **Build system:** Tauri build requirements on Linux may differ from Windows expectations

## Implementation Priority

1. Create media URL conversion helper (critical for Tauri media playback)
2. Add platform detection utilities 
3. Update Tauri configuration for CSP and capabilities
4. Implement exec resolution with sidecar detection
5. Add missing package scripts
6. Verify preview player integration with new helpers

---

**Status:** Ready to proceed with implementation using adapted plan for Linux npm environment.