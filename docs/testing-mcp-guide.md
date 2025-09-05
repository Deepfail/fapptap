# FAPPTap UI Testing & Error Capture Guide

## MCP Servers Configured

### 1. Filesystem MCP

- **Purpose**: File operations, workspace management
- **Config**: Full read/write access to project folder
- **Usage**: `mcp_filesystem_*` tools for file operations

### 2. Playwright MCP ⭐ **UPGRADED**

- **Purpose**: Superior UI testing, console error capture, screenshots, multi-browser support
- **Config**: Auto-approved for navigation, evaluation, screenshots, advanced selectors
- **Usage**: Modern browser automation with better debugging capabilities
- **Advantages over Puppeteer**:
  - More reliable element selection (`get_by_text`, `get_by_role`)
  - Better debugging tools and trace recording
  - Cross-browser support (Chrome, Firefox, Safari, Edge)
  - More stable async handling
  - Built-in waiting strategies

### 3. Memory MCP

- **Purpose**: Store test results, reduce conversation summarization
- **Config**: Full CRUD operations for knowledge persistence
- **Usage**: Store test findings, configurations, error patterns

### 4. SQLite MCP

- **Purpose**: Direct database interaction with analysis.db
- **Config**: Connected to cache/analysis.db
- **Usage**: Query media metadata, probe results

### 5. Sequential Thinking MCP

- **Purpose**: Complex problem solving and analysis
- **Config**: Auto-approved thinking operations
- **Usage**: Break down complex debugging scenarios

## UI Testing Workflow

### Browser Mode Testing (Current) - **Using Playwright MCP**

```javascript
// 1. Start dev server
npm run dev  // -> http://localhost:1420

// 2. Navigate with Playwright (more reliable than Puppeteer)
await playwright_navigate("http://localhost:1420")

// 3. Capture console errors (better error handling)
await playwright_evaluate(`
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => {
    logs.push({type: 'error', timestamp: Date.now(), args: args.map(String)});
    originalError(...args);
  };
  return { logs, userAgent: navigator.userAgent, readyState: document.readyState };
`)

// 4. Test UI interactions (more reliable selectors)
await playwright_get_by_text("Add Videos")  // Better than DOM queries
await playwright_get_by_role("button", {name: "Open Editor"})
await playwright_screenshot({name: "test-result", fullPage: true})

// 5. Advanced waiting and interaction
await playwright_wait_for_selector('[data-testid="timeline"]')
await playwright_fill('input[placeholder="Search videos"]', "test query")
```

### Desktop Mode Testing (Tauri)

```bash
# Start Tauri dev mode for full functionality
npm run dev:app

# Test worker pipeline with real media processing
# Note: Requires actual video files and audio tracks
```

## Error Capture Methods

### 1. Console Monitoring

- Puppeteer can capture console.error, console.warn
- Real-time error detection during UI interactions
- Screenshot capture at error points

### 2. Network Error Detection

- Monitor failed API calls to worker
- Capture JSONL communication errors
- Detect sidecar binary failures

### 3. UI State Verification

- Verify component rendering
- Check for missing mock data
- Validate platform detection logic

## Test Results Summary

### ✅ Working Features

- Browser mode UI loads correctly
- Platform detection works (detects non-Tauri environment)
- Editor mode transition functions properly
- Cutting mode settings panel displays all 6 modes
- No console errors during basic navigation

### ⚠️ Expected Limitations in Browser Mode

- Add Videos doesn't open file dialog (requires Tauri)
- Worker stages cannot execute (desktop-only)
- Real media processing unavailable

### 🔧 Testing Tools Available

- Live screenshot capture during interactions
- Console error monitoring
- JavaScript evaluation in browser context
- File system access for checking outputs
- Memory storage for test session persistence

## Next Steps for Enhanced Testing

1. **Desktop Testing**: Use `npm run dev:app` for full Tauri testing
2. **Worker Integration**: Test actual media processing pipeline
3. **Error Log Integration**: Capture worker stderr/stdout
4. **Automated Test Suite**: Create repeatable test scenarios

## Console Error Access

Instead of relying on browser inspect tools, you can now:

```javascript
// Get current console state
await mcp_puppeteer_puppeteer_evaluate(`
  return {
    errors: window.errorLog || [],
    location: window.location.href,
    readyState: document.readyState
  };
`);
```

This provides direct access to console output without needing inspect tools.
