#!/usr/bin/env python3
"""
Context Manager for Tauri v2 Project
Automatically provides relevant context based on user queries and project state
"""

import json
import os
import re
from typing import Dict, List, Any, Optional
from pathlib import Path

class TauriContextManager:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.docs_path = self.project_root / "docs" / "tauri-v2-READ"
        self.parsed_docs = self.load_parsed_docs()
        self._tauri_config = None
        self._capabilities = None
        self.project_context = self.analyze_project()
        
    def load_parsed_docs(self) -> Dict:
        """Load the parsed Tauri documentation"""
        docs_file = self.docs_path / "tauri_docs_parsed.json"
        if docs_file.exists():
            with open(docs_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def analyze_project(self) -> Dict:
        """Analyze current project state"""
        context = {
            "tauri_config": self.analyze_tauri_config(),
            "capabilities": self.analyze_capabilities(),
            "plugins_used": self.detect_plugins(),
            "sidecar_binaries": self.analyze_sidecars(),
            "recent_issues": self.detect_common_issues()
        }
        return context
    
    def analyze_tauri_config(self) -> Dict:
        """Analyze tauri.conf.json"""
        config_path = self.project_root / "src-tauri" / "tauri.conf.json"
        if not config_path.exists():
            return {"error": "tauri.conf.json not found"}
        
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        return {
            "has_sidecar": bool(config.get("bundle", {}).get("externalBin")),
            "external_bins": config.get("bundle", {}).get("externalBin", []),
            "dev_url": config.get("build", {}).get("devUrl"),
            "plugins_configured": list(config.get("plugins", {}).keys()) if config.get("plugins") else []
        }
    
    def analyze_capabilities(self) -> Dict:
        """Analyze capabilities/permissions"""
        caps_path = self.project_root / "src-tauri" / "capabilities" / "default.json"
        if not caps_path.exists():
            return {"error": "capabilities file not found"}
        
        with open(caps_path, 'r') as f:
            caps = json.load(f)
        
        permissions = caps.get("permissions", [])
        
        return {
            "shell_permissions": [p for p in permissions if isinstance(p, str) and p.startswith("shell:")],
            "fs_permissions": [p for p in permissions if isinstance(p, str) and p.startswith("fs:")],
            "sidecar_commands": self.extract_sidecar_permissions(permissions),
            "total_permissions": len(permissions)
        }
    
    def extract_sidecar_permissions(self, permissions: List) -> List[str]:
        """Extract sidecar command names from permissions"""
        sidecar_commands = []
        for perm in permissions:
            if isinstance(perm, dict) and perm.get("allow"):
                for allow_item in perm["allow"]:
                    if isinstance(allow_item, dict) and allow_item.get("sidecar"):
                        sidecar_commands.append(allow_item.get("name", "unknown"))
        return sidecar_commands
    
    def detect_plugins(self) -> List[str]:
        """Detect which Tauri plugins are being used"""
        package_json = self.project_root / "package.json"
        plugins = []
        
        if package_json.exists():
            with open(package_json, 'r') as f:
                data = json.load(f)
            
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            plugins = [key for key in deps.keys() if key.startswith("@tauri-apps/plugin-")]
        
        return plugins
    
    def analyze_sidecars(self) -> Dict:
        """Analyze sidecar binary status"""
        binaries_path = self.project_root / "src-tauri" / "binaries"
        result = {"path_exists": binaries_path.exists(), "binaries": {}}
        
        if binaries_path.exists():
            for item in binaries_path.iterdir():
                if item.is_dir():
                    exe_files = list(item.glob("*.exe"))
                    result["binaries"][item.name] = {
                        "has_executable": len(exe_files) > 0,
                        "executables": [f.name for f in exe_files]
                    }
        
        return result
    
    def detect_common_issues(self) -> List[str]:
        """Detect common configuration issues"""
        issues = []
        
        # Get fresh data instead of using self.project_context
        tauri_config = self.analyze_tauri_config()
        capabilities = self.analyze_capabilities()
        
        # Check for sidecar permission mismatches
        config_bins = set(tauri_config.get("external_bins", []))
        perm_bins = set(capabilities.get("sidecar_commands", []))
        
        config_names = {os.path.basename(bin) for bin in config_bins}
        if config_names != perm_bins:
            issues.append("sidecar_permission_mismatch")
        
        # Check for missing binaries
        sidecar_analysis = self.analyze_sidecars()
        for name, info in sidecar_analysis.get("binaries", {}).items():
            if not info.get("has_executable"):
                issues.append(f"missing_binary_{name}")
        
        return issues
    
    def get_relevant_context(self, query: str) -> Dict[str, Any]:
        """Get relevant context based on user query"""
        query_lower = query.lower()
        
        # Intent recognition
        intent = self.classify_intent(query_lower)
        
        # Get relevant documentation
        relevant_docs = self.find_relevant_docs(query_lower, intent)
        
        # Get project-specific context
        project_context = self.get_project_context_for_intent(intent)
        
        return {
            "intent": intent,
            "query": query,
            "relevant_documentation": relevant_docs,
            "project_context": project_context,
            "suggested_actions": self.get_suggested_actions(intent),
            "related_files": self.get_related_files(intent)
        }
    
    def classify_intent(self, query: str) -> str:
        """Classify user intent from query"""
        intent_patterns = {
            "sidecar_issues": ["ffmpeg", "ffprobe", "worker", "sidecar", "external binary", "binary not found"],
            "permission_issues": ["permission denied", "access denied", "not allowed", "capabilities"],
            "build_issues": ["build failed", "compilation error", "cannot build", "cargo build"],
            "config_issues": ["tauri.conf", "configuration", "config error"],
            "runtime_issues": ["app not working", "command failed", "invoke error"],
            "development": ["tauri dev", "dev server", "development mode"]
        }
        
        for intent, patterns in intent_patterns.items():
            if any(pattern in query for pattern in patterns):
                return intent
        
        return "general"
    
    def find_relevant_docs(self, query: str, intent: str) -> List[Dict]:
        """Find relevant documentation sections"""
        if not self.parsed_docs:
            return []
        
        relevant = []
        
        # Search concepts
        for concept in self.parsed_docs.get("concepts", []):
            if self.is_relevant(concept, query, intent):
                relevant.append({"type": "concept", "data": concept})
        
        # Search commands
        for command in self.parsed_docs.get("commands", []):
            if self.is_relevant(command, query, intent):
                relevant.append({"type": "command", "data": command})
        
        # Search workflows
        for workflow in self.parsed_docs.get("workflows", []):
            if self.is_relevant(workflow, query, intent):
                relevant.append({"type": "workflow", "data": workflow})
        
        return relevant[:10]  # Limit to top 10 most relevant
    
    def is_relevant(self, item: Dict, query: str, intent: str) -> bool:
        """Check if documentation item is relevant to query/intent"""
        # Check name/title
        if query in item.get("name", "").lower():
            return True
        
        # Check description/summary
        if query in item.get("description", "").lower():
            return True
        if query in item.get("summary", "").lower():
            return True
        
        # Check category/context alignment
        if intent == "sidecar_issues" and "sidecar" in item.get("context", "").lower():
            return True
        if intent == "permission_issues" and "permission" in item.get("context", "").lower():
            return True
        
        return False
    
    def get_project_context_for_intent(self, intent: str) -> Dict:
        """Get project-specific context based on intent"""
        base_context = {
            "tauri_config": self.project_context.get("tauri_config", {}),
            "detected_issues": self.project_context.get("recent_issues", [])
        }
        
        if intent == "sidecar_issues":
            base_context.update({
                "sidecar_binaries": self.project_context.get("sidecar_binaries", {}),
                "sidecar_permissions": self.project_context.get("capabilities", {}).get("sidecar_commands", [])
            })
        elif intent == "permission_issues":
            base_context["capabilities"] = self.project_context.get("capabilities", {})
        
        return base_context
    
    def get_suggested_actions(self, intent: str) -> List[str]:
        """Get suggested actions based on intent and project state"""
        actions = []
        recent_issues = self.project_context.get("recent_issues", [])
        
        if intent == "sidecar_issues":
            if "missing_binary_ffmpeg" in recent_issues:
                actions.append("Download ffmpeg.exe and place in src-tauri/binaries/ffmpeg/")
            if "missing_binary_ffprobe" in recent_issues:
                actions.append("Download ffprobe.exe and place in src-tauri/binaries/ffprobe/")
            if "missing_binary_worker" in recent_issues:
                actions.append("Build worker.exe in src-tauri/binaries/worker/")
            if "sidecar_permission_mismatch" in recent_issues:
                actions.append("Update capabilities/default.json to match sidecar binary names")
        
        elif intent == "permission_issues":
            actions.append("Check capabilities/default.json for required permissions")
            actions.append("Ensure shell:allow-execute permissions include your sidecar binaries")
        
        elif intent == "build_issues":
            actions.append("Run: npm run tauri build")
            actions.append("Check for Rust compilation errors")
        
        return actions
    
    def get_related_files(self, intent: str) -> List[str]:
        """Get list of files relevant to the intent"""
        base_files = ["src-tauri/tauri.conf.json"]
        
        intent_files = {
            "sidecar_issues": [
                "src-tauri/capabilities/default.json",
                "src-tauri/binaries/",
                "src/lib/exec.ts"
            ],
            "permission_issues": [
                "src-tauri/capabilities/default.json"
            ],
            "config_issues": [
                "src-tauri/tauri.conf.json",
                "package.json"
            ]
        }
        
        return base_files + intent_files.get(intent, [])

def main():
    """Demo the context manager"""
    project_root = os.path.abspath("../..")  # Adjust path as needed
    manager = TauriContextManager(project_root)
    
    # Show project analysis first
    print("=== PROJECT ANALYSIS ===")
    print(f"Project root: {manager.project_root}")
    print(f"Parsed docs available: {bool(manager.parsed_docs)}")
    if manager.parsed_docs:
        print(f"  - Concepts: {len(manager.parsed_docs.get('concepts', []))}")
        print(f"  - Commands: {len(manager.parsed_docs.get('commands', []))}")
        print(f"  - Workflows: {len(manager.parsed_docs.get('workflows', []))}")
    
    print(f"\nTauri Config: {manager.project_context['tauri_config']}")
    print(f"Capabilities: {manager.project_context['capabilities']}")
    print(f"Sidecar Status: {manager.project_context['sidecar_binaries']}")
    print(f"Detected Issues: {manager.project_context['recent_issues']}")
    
    # Example queries
    test_queries = [
        "ffmpeg binary not found",
        "permission denied when running worker",
        "how to configure sidecar binaries",
        "tauri build failing"
    ]
    
    for query in test_queries:
        print(f"\n=== Query: {query} ===")
        context = manager.get_relevant_context(query)
        print(f"Intent: {context['intent']}")
        print(f"Relevant docs: {len(context['relevant_documentation'])}")
        print(f"Suggested actions: {context['suggested_actions']}")
        print(f"Related files: {context['related_files']}")
        
        # Show first relevant doc if available
        if context['relevant_documentation']:
            doc = context['relevant_documentation'][0]
            print(f"Top relevant doc: {doc['data'].get('name', 'Unknown')} ({doc['type']})")

if __name__ == "__main__":
    main()