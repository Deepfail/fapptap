# Archive Manifest - 09/09/2025 00:50:25
## Legacy Rendering System (unused)
- ffgraph.ts - Old FFmpeg filter graph generation
- mp4Renderer.ts - Unused MP4 rendering system  
- ffplayPreview.ts - Legacy FFplay preview system

## Unused UI Components
- SelectableLibraryPane.tsx - Legacy file browser component
- PreviewControls.tsx - Legacy video controls (if found)

## Unused Libraries  
- sqliteTools.ts - Unused SQLite integration layer

## Reason for Archival
StaticUnifiedApp.tsx is now the main app component using:
- Python worker pipeline for rendering
- Direct Tauri commands for file operations
- Integrated probe/thumbnail system via Rust services

These files were part of an older architecture that has been superseded.
