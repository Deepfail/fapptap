# 📚 Knowledge Base System

This project maintains a comprehensive knowledge base for Tauri v2 development to ensure consistent patterns and prevent knowledge loss.

## 🎯 Primary Knowledge Base

**[TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md](./TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md)** - Single source of truth for all Tauri v2 patterns, configurations, and troubleshooting.

## 🔄 Maintenance Process

### For AI Assistants

- **ALWAYS** reference the knowledge base before implementing Tauri v2 solutions
- **UPDATE** the knowledge base immediately when discovering new patterns or solutions
- **LINK** to relevant knowledge base sections in code comments and commits

### For Developers

- Consult knowledge base for troubleshooting and configuration guidance
- Update knowledge base when solving new issues or finding better patterns
- Reference knowledge base sections in pull request descriptions

## 📋 Quick Reference

### Key Sections

- **Critical Configurations**: Asset protocol, sidecar binaries, permissions
- **Troubleshooting Patterns**: Error solutions, cache invalidation, URL issues
- **Code Patterns**: Platform detection, dynamic imports, media URL conversion
- **Migration Guide**: V1 to V2 transition patterns

### When to Update

✅ New working Tauri v2 configurations  
✅ Solutions to previously unknown errors  
✅ Better practices or optimizations  
✅ API behavior changes  
✅ Platform-specific workarounds

### Validation Tools

- `scripts/validate-kb.ps1` - Checks if Tauri changes reference knowledge base
- `.gitmessage` - Commit template with knowledge base prompts
- `.github/instructions/` - AI assistant guidelines for knowledge base maintenance

## 🔗 Integration Points

### Code References

Key files link to relevant knowledge base sections:

- `src/lib/platform.ts` → Platform Detection Pattern
- `src/lib/exec.ts` → Sidecar Binary Configuration
- `src/lib/mediaUrl.ts` → Media URL Conversion Pattern

### Configuration Files

- `src-tauri/tauri.conf.json` → Critical Tauri v2 Configuration Patterns
- `src-tauri/capabilities/default.json` → Permission/Capability System

### Build Process

- Development setup references knowledge base for Tauri requirements
- Build troubleshooting follows knowledge base error patterns

## 📈 Success Metrics

- All Tauri-related issues reference knowledge base first
- New patterns are documented within 24 hours of discovery
- Knowledge base examples work with current Tauri version
- AI assistants consistently reference and update knowledge base

## 🚀 Getting Started

1. Read [TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md](./TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md)
2. Bookmark key sections for your work area
3. Reference knowledge base before troubleshooting
4. Update knowledge base when you learn something new

---

**Remember**: The knowledge base is only valuable if it's current, accurate, and consistently used. Make it part of every Tauri v2 development workflow.
