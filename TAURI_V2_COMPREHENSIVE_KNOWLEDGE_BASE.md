# Tauri v2 - Comprehensive Knowledge Base for FAPPTap

## Document Overview

This is a comprehensive, consolidated knowledge base capturing all lessons learned, patterns, and best practices from implementing a fully functional Tauri v2 desktop application for video editing. This includes recent UI/UX improvements, workflow enhancements, and insights from the official Tauri v2 migration documentation.

**Last Updated**: January 2025  
**Application**: FAPPTap - Video editor with beat detection, shot analysis, and automated montage creation  
**Tech Stack**: Tauri v2, React 19, TypeScript, Vite 7, Python 3.11, FFmpeg/FFprobe  
**Target Platform**: Windows 10 x64 desktop  
**Status**: Fully functional with all core features working

## Recent Major Achievements (January 2025)

### UI/UX Breakthrough Features

✅ **Basic/Advanced Mode Toggle**: Streamlined vs. advanced workflows with clear visual distinction  
✅ **Inline Video Playbook**: Direct video preview in file browser with auto-play management  
✅ **Consolidated Actions Workflow**: Unified beat detection, shot analysis, cutlist, and render pipeline  
✅ **Queue Management System**: Visual progress tracking, error handling, and operation status  
✅ **Real Video Controls**: Full preview with controls overlay, volume persistence, fullscreen support  
✅ **Thumbnail Generation**: Working ffmpeg-based thumbnail creation via Command.sidecar

### Technical Breakthrough Fixes

✅ **Real FFmpeg Integration**: Replaced .NET stubs with actual ffmpeg/ffprobe binaries (~170MB each)  
✅ **Sidecar Execution**: Command.sidecar working for all binary operations  
✅ **Asset Protocol**: Proper `asset://localhost/` URLs for all media files  
✅ **Python Worker**: Functional worker with --engine argument support  
✅ **File System Access**: Full read/write permissions for video files and project data  
✅ **Platform Detection**: Reliable Tauri vs browser environment detection

## Critical Tauri v2 Configuration Patterns

### 1. Asset Protocol Configuration (ESSENTIAL)

The asset protocol is critical for media file access and must be explicitly enabled:

```json
// src-tauri/tauri.conf.json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$HOME/Dropbox/**/*", "$HOME/**/*", "C:/**/*"]
      }
    }
  }
}
```

**Critical**: Without `"enable": true`, media files generate broken `http://asset.localhost/` URLs instead of proper `asset://localhost/` URLs.

### 2. Sidecar Binary Configuration

Sidecar binaries require configuration in both `tauri.conf.json` and capabilities:

**tauri.conf.json**:

```json
{
  "bundle": {
    "externalBin": [
      "binaries/worker",
      "binaries/ffmpegbin",
      "binaries/ffprobebin"
    ]
  }
}
```

**src-tauri/capabilities/default.json**:

```json
{
  "permissions": [
    "shell:allow-execute",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        { "name": "binaries/worker", "sidecar": true, "args": true },
        { "name": "binaries/ffmpegbin", "sidecar": true, "args": true },
        { "name": "binaries/ffprobebin", "sidecar": true, "args": true }
      ]
    }
  ]
}
```

**Critical**: Binary names must match exactly, including platform suffix (e.g., `ffmpegbin-x86_64-pc-windows-msvc.exe`).

### 3. File System Permissions

Comprehensive file system access for video editing:

```json
{
  "permissions": [
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-read-dir",
    "fs:allow-create",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-copy-file",
    "fs:allow-exists",
    {
      "identifier": "fs:scope",
      "allow": [
        "$HOME/Dropbox/**/*",
        "$HOME/**/*",
        "$APPDATA/**/*",
        "$TEMP/**/*",
        "C:/**/*"
      ]
    }
  ]
}
```

### 4. Store Permissions

For application state persistence:

```json
{
  "permissions": [
    "store:allow-get",
    "store:allow-set",
    "store:allow-delete",
    "store:allow-has",
    "store:allow-load",
    "store:allow-save"
  ]
}
```

### 5. Dialog Permissions

For file selection dialogs:

```json
{
  "permissions": [
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "dialog:allow-confirm"
  ]
}
```

## Platform Detection Pattern

### Reliable Tauri Detection

```typescript
// src/lib/platform.ts
export const isTauri = (): boolean => {
  return typeof import.meta.env.TAURI_ENV_PLATFORM !== "undefined";
};

export const getTargetTriple = (): string | undefined => {
  return import.meta.env.TAURI_ENV_TARGET_TRIPLE;
};

export const getPlatform = (): string | undefined => {
  return import.meta.env.TAURI_ENV_PLATFORM;
};
```

**Critical**: Use `import.meta.env.TAURI_ENV_PLATFORM` for detection, not `window.__TAURI__` which can be unreliable.

## Dynamic Plugin Import Pattern

### Tauri Plugin Loading

```typescript
// src/lib/exec.ts
async function getShellPlugin() {
  if (!isTauri()) return null;

  try {
    const { Command } = await import("@tauri-apps/plugin-shell");
    return { Command };
  } catch (error) {
    console.warn("Failed to load shell plugin:", error);
    return null;
  }
}

export const runWorker = async (args: string[]): Promise<string> => {
  const shell = await getShellPlugin();
  if (!shell) throw new Error("Shell plugin not available");

  const output = await shell.Command.sidecar("binaries/worker", args).execute();
  return output.stdout;
};
```

## Media URL Conversion Pattern

### File Path to Media URL

```typescript
// src/lib/mediaUrl.ts
import { isTauri } from "./platform";

export async function toMediaUrl(filePath: string): Promise<string> {
  if (!isTauri()) {
    return `file://${filePath}`;
  }

  try {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const normalized = filePath.replace(/\\/g, "/");
    const mediaUrl = convertFileSrc(normalized);

    // Ensure proper asset:// protocol
    if (mediaUrl.startsWith("http://asset.localhost/")) {
      return mediaUrl.replace("http://asset.localhost/", "asset://localhost/");
    }

    return mediaUrl;
  } catch (error) {
    console.error("Failed to convert file src:", error);
    return `file://${filePath}`;
  }
}
```

## Build Configuration Patterns

### package.json Scripts

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 1420",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:debug": "tauri build --debug"
  }
}
```

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: "esnext",
    minify: false,
    sourcemap: true,
  },
  server: {
    host: "0.0.0.0",
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  define: {
    global: "globalThis",
  },
});
```

### Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "FAPPTap",
  "version": "0.1.0",
  "identifier": "com.fapptap.app",
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "withGlobalTauri": true
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "externalBin": [
      "binaries/worker",
      "binaries/ffmpegbin",
      "binaries/ffprobebin"
    ]
  },
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$HOME/Dropbox/**/*", "$HOME/**/*", "C:/**/*"]
      },
      "capabilities": ["default"]
    }
  }
}
```

## UI/UX Patterns and Workflows

### Basic/Advanced Mode Implementation

```typescript
// src/components/ActionsPane.tsx
const [mode, setMode] = useState<"basic" | "advanced">("basic");

const workflows = {
  basic: {
    icon: "🎯",
    title: "Basic Mode",
    description: "Automated workflow for quick results",
    steps: ["Auto-detect beats", "Generate thumbnails", "Create timeline"],
  },
  advanced: {
    icon: "⚙️",
    title: "Advanced Mode",
    description: "Full control over all parameters",
    steps: [
      "Configure beat detection",
      "Shot analysis",
      "Manual cutlist",
      "Custom render",
    ],
  },
};
```

### Inline Video Playback Pattern

```typescript
// src/components/library/LibraryPane.tsx
const [inlinePlayback, setInlinePlayback] = useState(true);
const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

const handleVideoPlay = (filePath: string) => {
  if (currentlyPlaying && currentlyPlaying !== filePath) {
    // Pause other videos
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => video.pause());
  }
  setCurrentlyPlaying(filePath);
};
```

### Queue Management System

```typescript
// src/store/queueStore.ts
interface QueueItem {
  id: string;
  type: "beats" | "shots" | "cutlist" | "render";
  status: "pending" | "running" | "completed" | "error";
  progress: number;
  filePath: string;
  result?: any;
  error?: string;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: [],
  addToQueue: (item) =>
    set((state) => ({
      queue: [
        ...state.queue,
        { ...item, id: nanoid(), status: "pending", progress: 0 },
      ],
    })),
  updateQueueItem: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
}));
```

## Migration Insights from Tauri GitHub

### V1 to V2 Permission Migration

Based on official Tauri migration code, key permission changes:

**File System**:

- `fs.readFile` → `fs:allow-read-file`
- `fs.writeFile` → `fs:allow-write-file`
- `fs.readDir` → `fs:allow-read-dir`
- Scope: V1 `allowlist.fs.scope` → V2 `fs:scope` permission with `allow`/`deny` arrays

**Window Management**:

- `window.create` → `core:window:allow-create`
- `window.close` → `core:window:allow-close`
- `window.setSize` → `core:window:allow-set-size`

**Shell/Sidecar**:

- `shell.execute` → `shell:allow-execute`
- `shell.sidecar` → `shell:allow-execute` with `sidecar: true`
- Scope: V1 shell scope becomes `shell:allow-execute` permission with specific binary configuration

**Asset Protocol**:

- V1 `allowlist.protocol.asset` → V2 `app.security.assetProtocol.enable`
- V1 `allowlist.protocol.assetScope` → V2 `app.security.assetProtocol.scope`

### Plugin Migration Patterns

- Core APIs: `@tauri-apps/api/*` → `@tauri-apps/plugin-*`
- V1 plugins: `tauri-plugin-*-api` → `@tauri-apps/plugin-*`
- Permission prefixes: Plugin permissions use direct identifiers, core permissions use `core:` prefix

### Bundle Configuration Updates

- License files consolidated under `bundle.licenseFile`
- Platform-specific configs: `bundle.deb` → `bundle.linux.deb`
- WebView runtime: `webviewFixedRuntimePath` → `webviewInstallMode.type: "fixedRuntime"`
- Media framework: `appimage.bundleMediaFramework` for audio/video support

## Migration Checklist

- [ ] Enable assetProtocol with `"enable": true`
- [ ] Configure sidecar binaries with exact naming
- [ ] Add all required permissions to capabilities
- [ ] Update Command.create() to Command.sidecar()
- [ ] Use convertFileSrc() for all file paths
- [ ] Add platform detection for browser fallbacks
- [ ] Update CSP to include asset: protocol
- [ ] Test both dev and build modes
- [ ] Verify binary permissions and naming
- [ ] Clean cargo cache after binary changes (`cargo clean --manifest-path src-tauri/Cargo.toml`)

## Error Patterns and Solutions

### Critical Troubleshooting Patterns

#### 1. Binary Naming Convention

- Binaries must match exact naming: `{name}-{target-triple}.exe`
- Example: `ffmpegbin-x86_64-pc-windows-msvc.exe`
- **Never**: Use generic names like `ffmpeg.exe`

#### 2. Cache Invalidation

- After changing binaries: `cargo clean --manifest-path src-tauri/Cargo.toml`
- Tauri caches sidecar binaries aggressively
- **Always**: Force clean rebuild after binary changes

#### 3. URL Generation Issues

- **Problem**: `http://asset.localhost/` URLs
- **Solution**: Enable assetProtocol with `"enable": true`
- **Verification**: URLs should be `asset://localhost/`

#### 4. Permission Debugging

- Use granular permissions (fs:allow-read, fs:allow-exists)
- **Critical**: Include both file and directory permissions
- Test with minimal scope first, then expand

### Common Issues and Fixes

1. **"Not allowed to load local resource"**

   - **Cause**: Asset protocol not enabled or incorrect scope
   - **Fix**: Ensure `assetProtocol.enable: true` and proper scope in tauri.conf.json

2. **"Sidecar binary not found"**

   - **Cause**: Incorrect binary naming or missing platform suffix
   - **Fix**: Use exact binary names including platform triple (e.g., `ffmpegbin-x86_64-pc-windows-msvc.exe`)

3. **"Permission denied" for file operations**

   - **Cause**: Missing fs permissions or incorrect scope
   - **Fix**: Add comprehensive fs permissions and scope configuration

4. **"Shell command failed with exit code 2"**

   - **Cause**: Incorrect arguments or missing binary
   - **Fix**: Validate binary exists and arguments are properly formatted

5. **"Failed to convert file src"**
   - **Cause**: Tauri plugin not loaded or platform detection failure
   - **Fix**: Use dynamic imports and proper platform detection

### Debugging Strategies

1. **Enable Comprehensive Logging**:

```typescript
console.log("Platform:", import.meta.env.TAURI_ENV_PLATFORM);
console.log("Target:", import.meta.env.TAURI_ENV_TARGET_TRIPLE);
console.log("File path:", filePath);
console.log("Converted URL:", mediaUrl);
```

2. **Test Binary Execution**:

```typescript
// Test sidecar availability
const shell = await import("@tauri-apps/plugin-shell");
const output = await shell.Command.sidecar("binaries/ffmpegbin", [
  "-version",
]).execute();
console.log("FFmpeg version:", output.stdout);
```

3. **Validate Permissions**:

```typescript
// Test file system access
const fs = await import("@tauri-apps/plugin-fs");
const exists = await fs.exists(filePath);
console.log("File exists:", exists);
```

## Build and Development Workflow

### Development Environment Setup

1. **Prerequisites**: Node.js 22+, Rust 1.89+, Tauri CLI 2.8+, Visual Studio Build Tools, Python 3.11+
2. **Install Dependencies**: `npm install --legacy-peer-deps`
3. **Configure Python**: Ensure Python environment is properly configured
4. **Place Binaries**: Real ffmpeg/ffprobe binaries in `src-tauri/binaries/`
5. **Run Dev Server**: `npm run tauri:dev`

### Production Build Process

1. **Clean Build**: `npm run build` followed by `npm run tauri:build`
2. **Force Rebuild**: Delete `src-tauri/target/` if sidecar binaries changed
3. **Verify Binaries**: Ensure all sidecar binaries are included in bundle
4. **Test Installation**: Verify desktop app runs independently

### Git and Large File Management

- **Use .gitignore**: Exclude large binaries (`*.exe` over 100MB)
- **Clean History**: Use `git filter-branch` to remove large files from history
- **Force Push**: Required after history cleanup to update remote

## Working Configuration Templates

### Minimal Tauri Configuration

**tauri.conf.json**:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "app": {
    "withGlobalTauri": true,
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": ["$HOME/**/*"]
      }
    }
  },
  "bundle": {
    "externalBin": ["binaries/toolname"]
  }
}
```

**capabilities/default.json**:

```json
{
  "permissions": [
    "core:default",
    "fs:default",
    "shell:allow-execute",
    {
      "identifier": "shell:allow-execute",
      "allow": [{ "name": "binaries/toolname", "sidecar": true, "args": true }]
    }
  ]
}
```

### Development vs Production Configuration

**Dev Server Configuration**:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev -- --port=1422 --strictPort",
    "devUrl": "http://localhost:1422"
  }
}
```

**Build Configuration**:

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

## Performance and Optimization

### Media Processing Optimization

- **Thumbnail Caching**: Cache generated thumbnails to avoid regeneration
- **Lazy Loading**: Load video metadata and thumbnails on demand
- **Queue Management**: Process operations sequentially to avoid resource conflicts
- **Memory Management**: Properly dispose of video elements and media streams

### UI/UX Performance

- **Virtual Scrolling**: For large video libraries
- **Debounced Search**: Prevent excessive filtering operations
- **Optimistic Updates**: Update UI immediately, sync with backend asynchronously
- **Error Boundaries**: Isolate component failures for better reliability

## Future Roadmap and Extensibility

### Planned Enhancements

- **Stash Integration**: Pull clips from Stash server
- **Video Effects**: Sync effects to detected beats
- **Multi-format Support**: Expand beyond MP4/AVI
- **Cloud Storage**: Support for cloud-based video libraries
- **Plugin Architecture**: Extensible effect and filter system

### Architectural Considerations

- **Modular Design**: Separate concerns between UI, media processing, and file management
- **State Management**: Use Zustand for predictable state updates
- **Type Safety**: Maintain strict TypeScript throughout
- **Testing Strategy**: Unit tests for core logic, integration tests for workflows
- **Documentation**: Keep this knowledge base updated with new learnings

## Conclusion

This knowledge base represents a comprehensive guide to successfully implementing a Tauri v2 desktop application with complex media processing requirements. The key to success is understanding the v2 permission model, proper sidecar binary configuration, and reliable platform detection patterns.

The recent UI/UX improvements demonstrate that Tauri v2 is capable of supporting sophisticated desktop applications with real-time media processing, complex workflows, and professional-grade user interfaces. The Basic/Advanced mode pattern provides a template for progressive disclosure of functionality, while the inline playback system shows how to integrate media preview seamlessly into file management workflows.

Regular updates to this knowledge base ensure that future development efforts can build upon these proven patterns and avoid the pitfalls encountered during initial implementation.

---

**Document Status**: Comprehensive and up-to-date as of January 2025  
**Maintenance**: Update when new Tauri v2 patterns or issues are discovered  
**Scope**: Complete Tauri v2 desktop application with media processing capabilities
