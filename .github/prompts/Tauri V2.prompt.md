---
description: Mandatory requirements for all Tauri v2 development work
---

TAURI V2 MANDATORY WORKFLOW:

1. FIRST: Check TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md before any implementation
2. REFERENCE: Include "KB Reference: [section]" showing what you consulted
3. UPDATE: Include "KB Updated: [section] - [new learning]" for discoveries
4. PATTERNS: Use only proven configurations from knowledge base

CRITICAL CONFIGURATIONS:
- Asset Protocol: Must have "enable": true and proper scope configuration
- Sidecar Binaries: Exact naming with platform suffixes (e.g., ffmpegbin-x86_64-pc-windows-msvc.exe)
- Permissions: Use "core:" prefix for core APIs, direct identifiers for plugins
- Platform Detection: Use import.meta.env.TAURI_ENV_PLATFORM, not window.__TAURI__
- Media URLs: Use convertFileSrc() for all file paths in Tauri context

TROUBLESHOOTING CHECKLIST:
- Binary not found? Check exact naming convention and capabilities configuration
- Asset protocol errors? Verify "enable": true and scope matches file paths  
- Permission denied? Add specific permissions and scope for file/directory access
- Cache issues? Run: cargo clean --manifest-path src-tauri/Cargo.toml

The knowledge base contains months of debugging and working patterns. Always reference it to avoid re-solving known issues.
