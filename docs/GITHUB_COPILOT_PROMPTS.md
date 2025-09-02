# GitHub Copilot Prompts - Knowledge Base Requirements

## For GitHub Settings > Copilot > Prompts

Add this as a custom prompt in your GitHub Copilot settings:

```
TAURI V2 KNOWLEDGE BASE REQUIREMENTS:

When working on Tauri v2 projects:
1. ALWAYS check for TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md first
2. Reference specific KB sections: "KB Reference: [section name]"  
3. Update KB with discoveries: "KB Updated: [section] - [new learning]"
4. Use only proven patterns from knowledge base
5. For sidecar binaries: exact naming with platform suffixes
6. For asset protocol: ensure "enable": true and proper scope
7. For permissions: use core: prefix for core APIs, direct identifiers for plugins

The knowledge base prevents re-debugging known issues and ensures consistent patterns.
```

## Alternative shorter version for character limits:

```
TAURI V2: Always reference TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md first. Include "KB Reference: [section]" in responses. Update KB with new learnings. Use proven patterns only. Critical: asset protocol enable:true, exact binary naming, core: prefixes for permissions.
```

## Why This Helps:

- **Cross-repo consistency**: If you work on multiple Tauri projects
- **Automatic reminders**: Copilot will incorporate this into suggestions
- **Global enforcement**: Works in any GitHub context, not just this repo
- **Backup system**: Even if local instructions aren't loaded, global prompts apply

## Recommended Setup:

1. **GitHub Copilot Prompts**: Global Tauri v2 requirements (above)
2. **Local Instructions**: Project-specific details (.github/instructions/)
3. **Both together**: Maximum coverage and consistency

This creates a layered approach where the global prompt ensures you always consider the knowledge base, and local instructions provide project-specific guidance.