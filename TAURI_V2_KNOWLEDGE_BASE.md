# Tauri v2 - Complete Knowledge Base

## Critical Configuration Requirements

### 1. Asset Protocol Configuration
**ESSENTIAL**: The asset protocol must be explicitly enabled in `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": [
          "$HOME/Dropbox/**/*",
          "$HOME/**/*",
          "C:/**/*"
        ]
      }
    }
  }
}
```

**Key Learning**: Without `"enable": true`, videos/media will generate incorrect URLs like `http://asset.localhost/` instead of proper `asset://localhost/` URLs.

### 2. Sidecar Binary Configuration
Sidecar binaries must be configured in both `tauri.conf.json` and `capabilities/default.json`:

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

**capabilities/default.json**:
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

### 3. File System Permissions
Extensive file system permissions required for media file access:

```json
{
  "permissions": [
    "fs:default",
    {
      "identifier": "fs:scope",
      "allow": [
        { "path": "$HOME" }, { "path": "$HOME/**/*" },
        { "path": "$DESKTOP" }, { "path": "$DESKTOP/**/*" },
        { "path": "$DOCUMENT" }, { "path": "$DOCUMENT/**/*" },
        { "path": "$DOWNLOAD" }, { "path": "$DOWNLOAD/**/*" },
        { "path": "$VIDEO" }, { "path": "$VIDEO/**/*" },
        { "path": "$PICTURE" }, { "path": "$PICTURE/**/*" },
        { "path": "C:/Users/Virta/Dropbox" }, { "path": "C:/Users/Virta/Dropbox/**/*" }
      ]
    }
  ]
}
```

## Core API Differences from Tauri v1

### 1. Command Execution
- **v1**: `Command.create("ffmpeg", args)`
- **v2**: `Command.sidecar("binaries/ffmpegbin", args)`

### 2. File Path Conversion
- **v1**: Automatic file:// URL handling
- **v2**: Must use `convertFileSrc()` from `@tauri-apps/api/core`
- **Critical**: Returns `asset://localhost/` URLs, not `http://` URLs

### 3. Plugin System
- **v1**: Plugins included by default
- **v2**: Must explicitly enable each plugin in `Cargo.toml` and install via npm
- **Must Add**: Each plugin to dependencies:
  ```toml
  [dependencies]
  tauri-plugin-fs = "2.4.2"
  tauri-plugin-shell = "2.3.1"
  tauri-plugin-dialog = "2.3.3"
  tauri-plugin-store = "2.4.0"
  tauri-plugin-opener = "2.5.0"
  ```

### 4. Platform Detection
- **v1**: `window.__TAURI__` available
- **v2**: Use `import.meta.env.TAURI_ENV_PLATFORM` for build-time detection
- **Runtime**: Use dynamic imports with try/catch for feature detection

## Critical Troubleshooting Patterns

### 1. Binary Naming Convention
- Binaries must match exact naming: `{name}-{target-triple}.exe`
- Example: `ffmpegbin-x86_64-pc-windows-msvc.exe`
- **Never**: Use generic names like `ffmpeg.exe`

### 2. Cache Invalidation
- After changing binaries: `cargo clean --manifest-path src-tauri/Cargo.toml`
- Tauri caches sidecar binaries aggressively
- **Always**: Force clean rebuild after binary changes

### 3. URL Generation Issues
- **Problem**: `http://asset.localhost/` URLs
- **Solution**: Enable assetProtocol with `"enable": true`
- **Verification**: URLs should be `asset://localhost/`

### 4. Permission Debugging
- Use granular permissions (fs:allow-read, fs:allow-exists)
- **Critical**: Include both file and directory permissions
- Test with minimal scope first, then expand

## Development vs Production Differences

### 1. Dev Server Configuration
```json
{
  "build": {
    "beforeDevCommand": "npm run dev -- --port=1422 --strictPort",
    "devUrl": "http://localhost:1422"
  }
}
```

### 2. Build Configuration
```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  }
}
```

### 3. Global Tauri Detection
```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

## Common Error Patterns & Solutions

### 1. "Module not found" Errors
- **Cause**: Dynamic imports failing in browser mode
- **Solution**: Use platform detection and graceful fallbacks

### 2. "Permission denied" Errors
- **Cause**: Missing fs:scope or incorrect path format
- **Solution**: Add specific paths to capabilities

### 3. "Sidecar not found" Errors
- **Cause**: Incorrect binary naming or missing capabilities
- **Solution**: Check exact binary names and shell:allow-execute permissions

### 4. "Asset protocol disabled" Errors
- **Cause**: Missing `"enable": true` in assetProtocol config
- **Solution**: Explicitly enable assetProtocol

## Best Practices Learned

### 1. Error Handling
```typescript
try {
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(path);
} catch {
  return `file://${path}`; // Fallback for browser
}
```

### 2. Platform Detection
```typescript
import { IS_DESKTOP } from "@/lib/platform";

if (IS_DESKTOP) {
  // Tauri-specific code
} else {
  // Browser fallback
}
```

### 3. Sidecar Execution
```typescript
const command = Command.sidecar("binaries/ffmpegbin", ["-version"]);
const output = await command.execute();
```

### 4. Asset URL Generation
```typescript
// CORRECT for Tauri v2
const src = await convertFileSrc(absolutePath);
// Returns: asset://localhost/C:/path/to/file

// INCORRECT (Tauri v1 style)
const src = `file://${absolutePath}`;
```

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
- [ ] Clean cargo cache after binary changes

## Working Configuration Template

**Minimal tauri.conf.json**:
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

**Minimal capabilities/default.json**:
```json
{
  "permissions": [
    "core:default",
    "fs:default",
    "shell:allow-execute",
    {
      "identifier": "shell:allow-execute", 
      "allow": [
        { "name": "binaries/toolname", "sidecar": true, "args": true }
      ]
    }
  ]
}
```

This knowledge base represents hard-won lessons from extensive Tauri v2 migration and troubleshooting.