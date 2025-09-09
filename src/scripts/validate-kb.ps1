#!/usr/bin/env pwsh

# Knowledge Base Validation Script
# Checks if Tauri-related changes reference the knowledge base

param(
    [string]$CommitMessage = "",
    [string]$FilesChanged = ""
)

$KnowledgeBase = "TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE.md"
$TauriFiles = @(
    "src-tauri/tauri.conf.json",
    "src-tauri/capabilities/*.json",
    "src-tauri/Cargo.toml",
    "src/lib/exec.ts",
    "src/lib/platform.ts", 
    "src/lib/mediaUrl.ts"
)

function Test-TauriChanges {
    param([string[]]$ChangedFiles)
    
    foreach ($file in $ChangedFiles) {
        foreach ($tauriPattern in $TauriFiles) {
            if ($file -like $tauriPattern) {
                return $true
            }
        }
        
        # Check if file contains Tauri-specific patterns
        if (Test-Path $file) {
            $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
            if ($content -match "tauri|Command\.sidecar|convertFileSrc|TAURI_ENV|@tauri-apps") {
                return $true
            }
        }
    }
    
    return $false
}

function Test-KnowledgeBaseReference {
    param([string]$Message)
    
    return $Message -match "KB Updated:|KB Reference:|TAURI_V2_COMPREHENSIVE_KNOWLEDGE_BASE"
}

# Main validation
$changedFilesList = $FilesChanged -split "`n" | Where-Object { $_ -ne "" }

if (Test-TauriChanges -ChangedFiles $changedFilesList) {
    Write-Host "🔍 Tauri-related changes detected" -ForegroundColor Yellow
    
    if (Test-KnowledgeBaseReference -Message $CommitMessage) {
        Write-Host "✅ Knowledge base referenced in commit message" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Consider referencing the knowledge base:" -ForegroundColor Yellow
        Write-Host "   - Add 'KB Reference: [section]' if you used the knowledge base"
        Write-Host "   - Add 'KB Updated: [section] - [what you learned]' if you discovered something new"
        Write-Host "   - Knowledge base: $KnowledgeBase"
    }
}

# Check if knowledge base itself was updated
if ($changedFilesList -contains $KnowledgeBase) {
    Write-Host "📚 Knowledge base updated - excellent!" -ForegroundColor Green
}