---
description: Mandatory requirements for all Tauri v2 development work
---

TAURI V2 MANDATORY WORKFLOW:

1. FIRST: Check TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md before any implementation
2. REFERENCE: Include "KB Reference: [section]" showing what you consulted
3. UPDATE: Include "KB Updated: [section] - [new learning]" for discoveries
4. PATTERNS: Use only proven configurations from knowledge base
5. MCP TOOLS: Use available MCP servers for enhanced development capabilities

MCP TOOLS INTEGRATION:

ALWAYS use these MCP servers when relevant to the task:

- 🗂️ filesystem: For file operations, media management, project structure analysis
- 🗃️ sqlite: For querying analysis.db cache, metadata storage
- 🧠 memory: For remembering project context across sessions
- 🤔 sequential-thinking: For complex problem decomposition and planning
- 🌐 puppeteer: For UI testing, browser automation, web scraping
- ⚡ shell: For build scripts, FFmpeg operations, Git commands, system tasks

When to use MCP tools:

- File operations → Use filesystem server for enhanced file management
- Database queries → Use sqlite server for analysis cache operations
- Complex problems → Use sequential-thinking for step-by-step problem solving
- Need context → Use memory server to store/retrieve project patterns
- Testing UI → Use puppeteer for automated browser testing
- System tasks → Use shell server for terminal operations

Example usage: "Use filesystem to analyze media_samples directory structure" or "Use memory to remember our FFmpeg configuration patterns"

CRITICAL CONFIGURATIONS:

- Asset Protocol: Must have "enable": true and proper scope configuration
- Sidecar Binaries: Exact naming with platform suffixes (e.g., ffmpegbin-x86_64-pc-windows-msvc.exe)
- Permissions: Use "core:" prefix for core APIs, direct identifiers for plugins
- Platform Detection: Use import.meta.env.TAURI_ENV_PLATFORM, not window.**TAURI**
- Media URLs: Use convertFileSrc() for all file paths in Tauri context

TROUBLESHOOTING CHECKLIST:

- Binary not found? Check exact naming convention and capabilities configuration
- Asset protocol errors? Verify "enable": true and scope matches file paths
- Permission denied? Add specific permissions and scope for file/directory access
- Cache issues? Run: cargo clean --manifest-path src-tauri/Cargo.toml

The knowledge base contains months of debugging and working patterns. Always reference it to avoid re-solving known issues.
