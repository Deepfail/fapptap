# FapTap MCP Setup Guide

## 🎯 **Installed MCP Extensions**

### Core Extensions
- ✅ **Copilot MCP** (`automatalabs.copilot-mcp`) - Main MCP management
- ✅ **MCP Server Runner** (`zebradev.mcp-server-runner`) - Local server management  
- ✅ **MCP Explorer** (`moonolgerdai.mcp-explorer`) - Server discovery
- ✅ **Azure MCP Server** (`ms-azuretools.vscode-azure-mcp-server`) - Cloud integration
- ✅ **VSCode MCP Server** (`semanticworkbenchteam.mcp-server-vscode`) - VS Code tools

## 🔧 **Configuration Steps**

### 1. Access GitHub Copilot MCP Settings
1. Open **Command Palette** (`Ctrl+Shift+P`)
2. Type `GitHub Copilot: Open MCP Settings`
3. Configure the servers listed in `.vscode/mcp-config.json`

### 2. Available MCP Servers for FapTap

#### **filesystem-enhanced** 
- **Purpose**: Advanced file operations for your media files
- **Usage**: Enhanced file browsing, batch operations on video files
- **Commands**: `npx @modelcontextprotocol/server-filesystem`

#### **ffmpeg-tools**
- **Purpose**: Direct FFmpeg integration for video processing  
- **Usage**: Video analysis, thumbnail generation, format conversion
- **Commands**: Custom server for your FFmpeg binaries

#### **tauri-dev**
- **Purpose**: Tauri v2 configuration validation and management
- **Usage**: Capability validation, sidecar binary management
- **Commands**: Custom server for Tauri development

#### **python-worker**
- **Purpose**: Integration with your Python worker pipeline
- **Usage**: Beat detection, shot analysis, pipeline management
- **Commands**: Direct access to your worker scripts

### 3. Install Required MCP Servers

```powershell
# Core filesystem server
npm install -g @modelcontextprotocol/server-filesystem

# Install additional servers via MCP Explorer
# Use Command Palette: "MCP Explorer: Search Servers"
```

### 4. GitHub Copilot Integration

1. **Open Settings**: `Ctrl+,`
2. **Search**: "github copilot mcp"
3. **Enable MCP**: Check "Enable MCP Server Integration"
4. **Add Servers**: Point to `.vscode/mcp-config.json`

### 5. Test MCP Integration

1. **Open any file** in your project
2. **Use Copilot Chat** and ask about:
   - "Analyze video files in media_samples/"
   - "Check Tauri v2 configuration"
   - "Run beat detection on sample video"
   - "Validate FFmpeg setup"

## 🎬 **FapTap-Specific MCP Workflows**

### Video Processing Workflow
```
Copilot + MCP → Analyze video → Generate thumbnails → Extract beats → Create timeline
```

### Tauri Development Workflow  
```
Copilot + MCP → Validate config → Check permissions → Test sidecar binaries → Deploy
```

### Knowledge Base Integration
```
Copilot + MCP → Reference KB → Update patterns → Validate changes → Document learnings
```

## 📚 **Next Steps**

1. **Explore MCP Explorer** to find specialized servers
2. **Configure custom servers** for your specific video processing needs  
3. **Test Copilot integration** with your existing workflows
4. **Update knowledge base** with MCP-enhanced patterns

## 🔍 **Troubleshooting**

### Common Issues
- **Server not found**: Ensure server is installed globally or locally
- **Permission denied**: Check file paths and execution permissions
- **Config not loaded**: Verify `.vscode/mcp-config.json` syntax

### Debug Commands
```powershell
# Test MCP server runner
# Command Palette: "MCP Server Runner: Show Status"

# Check installed servers  
# Command Palette: "MCP Explorer: List Installed Servers"

# Validate configuration
# Command Palette: "Copilot MCP: Validate Configuration"
```

**KB Reference**: Technical Architecture - MCP integration enhances AI-assisted development workflows for Tauri v2 video processing applications.