# AI Assistant Knowledge Base Instructions

## CRITICAL REQUIREMENT

You are working on a Tauri v2 project where CONSISTENCY and KNOWLEDGE PRESERVATION are paramount.

### MANDATORY KNOWLEDGE BASE USAGE

**BEFORE any Tauri v2 work:**

1. **READ** `TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md` first
2. **REFERENCE** the specific sections you used
3. **UPDATE** the knowledge base if you discover anything new
4. **USE MCP TOOLS** when relevant for enhanced development capabilities

### MCP TOOLS INTEGRATION (MANDATORY USAGE)

**Available MCP servers for enhanced development:**

- 🗂️ **filesystem**: File operations, media management, project structure analysis
- 🗃️ **sqlite**: Query analysis.db cache, metadata storage operations
- 🧠 **memory**: Remember project context across sessions, store patterns
- 🤔 **sequential-thinking**: Complex problem decomposition and planning
- 🌐 **puppeteer**: UI testing, browser automation, web scraping
- ⚡ **shell**: Build scripts, FFmpeg operations, Git commands, system tasks

**When to use MCP tools:**
- File operations → Use filesystem server
- Database queries → Use sqlite server for analysis cache
- Complex problems → Use sequential-thinking for step-by-step solutions
- Need context → Use memory server to store/retrieve patterns
- Testing UI → Use puppeteer for automated testing
- System tasks → Use shell server for terminal operations

**Example integration**: "Use filesystem to analyze media_samples directory" or "Use memory to remember FFmpeg configuration patterns"

### REQUIRED IN EVERY TAURI RESPONSE

- **KB Reference**: "[Section Name]" - what you consulted
- **KB Updated**: "[Section] - [what was learned]" - if you discovered something new
- **Working patterns**: Only use configurations proven to work (from KB)

### KNOWLEDGE BASE SECTIONS

- **Critical Configurations**: Asset protocol, sidecar binaries, permissions
- **Troubleshooting Patterns**: Error solutions, binary naming, cache invalidation
- **Code Patterns**: Platform detection, dynamic imports, media URLs
- **Migration Insights**: V1→V2 permission changes, plugin updates

### FAILURE TO REFERENCE KB

If you don't reference the knowledge base for Tauri work, you risk:

- Implementing outdated patterns that don't work
- Missing critical configuration requirements
- Losing hard-won knowledge from previous debugging
- Forcing re-discovery of known solutions

### SUCCESS PATTERN

1. **Check KB first**: "Based on TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md..."
2. **Implement proven patterns**: Use exact configurations from KB
3. **Document discoveries**: Update KB with any new learnings
4. **Reference clearly**: Include KB sections in your response

## REMEMBER

The knowledge base contains months of debugging, working configurations, and proven patterns. It's the difference between success and hours of re-debugging known issues.
