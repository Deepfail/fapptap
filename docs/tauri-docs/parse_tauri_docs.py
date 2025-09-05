#!/usr/bin/env python3
"""
Tauri Documentation Parser for LLM Optimization
Processes Tauri docs into structured, searchable format optimized for LLM consumption
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import yaml
import hashlib

@dataclass
class CodeExample:
    """Represents a code example with metadata"""
    language: str
    code: str
    context: str
    file_path: Optional[str] = None
    description: Optional[str] = None
    dependencies: Optional[List[str]] = None
    
@dataclass
class Command:
    """Represents a CLI or code command"""
    name: str
    description: str
    syntax: str
    examples: List[str]
    options: Optional[Dict[str, str]] = None
    related_commands: Optional[List[str]] = None

@dataclass
class Concept:
    """Represents a key concept or topic"""
    name: str
    category: str
    description: str
    key_points: List[str]
    code_examples: List[CodeExample]
    related_concepts: List[str]
    difficulty: str  # beginner, intermediate, advanced
    tags: List[str]

@dataclass
class Workflow:
    """Represents a common workflow or pattern"""
    name: str
    description: str
    steps: List[Dict[str, Any]]
    prerequisites: List[str]
    code_snippets: List[CodeExample]
    common_errors: List[Dict[str, str]]
    best_practices: List[str]

class TauriDocParser:
    def __init__(self):
        self.concepts: List[Concept] = []
        self.commands: List[Command] = []
        self.workflows: List[Workflow] = []
        self.code_examples: List[CodeExample] = []
        self.index: Dict[str, List[str]] = {}
        self.metadata: Dict[str, Any] = {
            'version': '2.0',
            'parsed_at': datetime.now().isoformat(),
            'total_files': 0
        }
        
    def parse_frontmatter(self, content: str) -> Dict[str, Any]:
        """Extract YAML frontmatter from markdown"""
        pattern = r'^---\s*\n(.*?)\n---\s*\n'
        match = re.match(pattern, content, re.DOTALL)
        if match:
            try:
                return yaml.safe_load(match.group(1))
            except:
                return {}
        return {}
    
    def extract_code_blocks(self, content: str) -> List[CodeExample]:
        """Extract and categorize code blocks"""
        examples = []
        
        # Pattern for code blocks with language
        pattern = r'```(\w+)(?:\s+title=["\']?([^"\'\n]+)["\']?)?\s*(?:ins=[{"\']([^}"\']+)[}"\']\s*)?(?:del=[{"\']([^}"\']+)[}"\']\s*)?\n(.*?)```'
        
        for match in re.finditer(pattern, content, re.DOTALL):
            language = match.group(1)
            title = match.group(2) or ""
            code = match.group(5)
            
            # Determine context from surrounding text
            start_pos = max(0, match.start() - 200)
            context_text = content[start_pos:match.start()].strip()
            context = self.extract_context(context_text)
            
            examples.append(CodeExample(
                language=language,
                code=code.strip(),
                context=context,
                file_path=title if title else None,
                description=self.extract_description(content, match.start())
            ))
        
        return examples
    
    def extract_context(self, text: str) -> str:
        """Determine context from surrounding text"""
        if 'command' in text.lower():
            return 'command'
        elif 'state' in text.lower():
            return 'state_management'
        elif 'window' in text.lower():
            return 'window_management'
        elif 'permission' in text.lower():
            return 'permissions'
        elif 'plugin' in text.lower():
            return 'plugin'
        elif 'frontend' in text.lower() or 'javascript' in text.lower():
            return 'frontend_integration'
        elif 'rust' in text.lower():
            return 'rust_backend'
        else:
            return 'general'
    
    def extract_description(self, content: str, position: int) -> str:
        """Extract description from text before code block"""
        start = max(0, position - 500)
        text = content[start:position]
        
        # Look for the last sentence or paragraph
        sentences = text.split('.')
        if sentences:
            return sentences[-2].strip() if len(sentences) > 1 else sentences[-1].strip()
        return ""
    
    def extract_commands(self, content: str) -> List[Command]:
        """Extract CLI and API commands"""
        commands = []
        
        # Extract tauri CLI commands
        cli_pattern = r'(?:tauri|cargo tauri|npm run tauri|pnpm tauri)\s+(\w+(?:\s+\w+)*)'
        for match in re.finditer(cli_pattern, content):
            cmd_name = match.group(1)
            commands.append(Command(
                name=f"tauri_{cmd_name.replace(' ', '_')}",
                description=self.extract_command_description(content, match.start()),
                syntax=match.group(0),
                examples=[match.group(0)],
                options=self.extract_command_options(content, match.start())
            ))
        
        # Extract Rust commands/functions
        rust_cmd_pattern = r'#\[tauri::command\]\s*\n(?:pub\s+)?(?:async\s+)?fn\s+(\w+)'
        for match in re.finditer(rust_cmd_pattern, content):
            cmd_name = match.group(1)
            commands.append(Command(
                name=cmd_name,
                description=f"Tauri command: {cmd_name}",
                syntax=f"invoke('{cmd_name}', args)",
                examples=self.extract_invoke_examples(content, cmd_name)
            ))
        
        return commands
    
    def extract_command_description(self, content: str, position: int) -> str:
        """Extract description for a command"""
        start = max(0, position - 300)
        text = content[start:position]
        lines = text.split('\n')
        
        for line in reversed(lines):
            line = line.strip()
            if line and not line.startswith('#') and not line.startswith('```'):
                return line
        return ""
    
    def extract_command_options(self, content: str, position: int) -> Dict[str, str]:
        """Extract command options/flags"""
        options = {}
        
        # Look for option descriptions after the command
        end = min(len(content), position + 1000)
        text = content[position:end]
        
        option_pattern = r'(?:^|\n)\s*-+(\w+)(?:\s*,\s*-+(\w+))?\s*(?::|\s)\s*([^\n]+)'
        for match in re.finditer(option_pattern, text):
            option_name = match.group(1)
            option_alt = match.group(2)
            description = match.group(3)
            
            options[option_name] = description
            if option_alt:
                options[option_alt] = description
        
        return options if options else {}
    
    def extract_invoke_examples(self, content: str, command_name: str) -> List[str]:
        """Extract invoke examples for a command"""
        examples = []
        pattern = rf"invoke\(['\"]{{0,1}}{command_name}['\"]{{0,1}}[^)]*\)"
        
        for match in re.finditer(pattern, content):
            examples.append(match.group(0))
        
        return examples[:3]  # Limit to 3 examples
    
    def extract_workflows(self, content: str, filename: str) -> List[Workflow]:
        """Extract step-by-step workflows"""
        workflows = []
        
        # Look for numbered steps or Steps components
        steps_pattern = r'<Steps>(.*?)</Steps>'
        steps_matches = re.finditer(steps_pattern, content, re.DOTALL)
        
        for match in steps_matches:
            steps_content = match.group(1)
            workflow = self.parse_workflow(steps_content, filename)
            if workflow:
                workflows.append(workflow)
        
        # Also look for numbered lists as workflows
        numbered_pattern = r'(?:^|\n)(\d+)\.\s+(.+?)(?=\n\d+\.|\n\n|\Z)'
        numbered_sections = re.finditer(numbered_pattern, content, re.DOTALL)
        
        steps = []
        for match in numbered_sections:
            step_num = match.group(1)
            step_content = match.group(2)
            steps.append({
                'number': int(step_num),
                'description': step_content.strip()
            })
        
        if len(steps) >= 3:  # Only consider it a workflow if 3+ steps
            workflows.append(Workflow(
                name=f"workflow_{filename}_{len(workflows)}",
                description=f"Workflow from {filename}",
                steps=steps,
                prerequisites=[],
                code_snippets=self.extract_code_blocks(content),
                common_errors=[],
                best_practices=[]
            ))
        
        return workflows
    
    def parse_workflow(self, content: str, filename: str) -> Optional[Workflow]:
        """Parse a workflow from Steps component content"""
        steps = []
        
        # Extract individual steps
        step_pattern = r'(?:^|\n)\s*(?:\d+\.|\*|\-)\s*(.+?)(?=\n\s*(?:\d+\.|\*|\-)|\Z)'
        for match in re.finditer(step_pattern, content, re.DOTALL):
            step_content = match.group(1).strip()
            steps.append({
                'description': step_content[:200],  # Limit description length
                'details': step_content
            })
        
        if steps:
            return Workflow(
                name=f"workflow_{filename}_{hashlib.md5(content.encode()).hexdigest()[:8]}",
                description=f"Step-by-step guide from {filename}",
                steps=steps,
                prerequisites=self.extract_prerequisites(content),
                code_snippets=self.extract_code_blocks(content),
                common_errors=self.extract_common_errors(content),
                best_practices=self.extract_best_practices(content)
            )
        return None
    
    def extract_prerequisites(self, content: str) -> List[str]:
        """Extract prerequisites from content"""
        prereqs = []
        
        # Look for prerequisite sections
        prereq_pattern = r'(?:Prerequisites?|Requirements?|Before you start)[:\n]\s*(.+?)(?=\n\n|\Z)'
        match = re.search(prereq_pattern, content, re.IGNORECASE | re.DOTALL)
        
        if match:
            prereq_text = match.group(1)
            # Extract bullet points or numbered items
            items = re.findall(r'(?:^|\n)\s*[\*\-\d+\.]\s*(.+)', prereq_text)
            prereqs.extend([item.strip() for item in items])
        
        return prereqs
    
    def extract_common_errors(self, content: str) -> List[Dict[str, str]]:
        """Extract common errors and solutions"""
        errors = []
        
        # Look for error patterns
        error_pattern = r'(?:Error|Warning|Issue|Problem)[:\s]+(.+?)(?:Solution|Fix|Resolution|To fix)[:\s]+(.+?)(?=\n\n|\Z)'
        
        for match in re.finditer(error_pattern, content, re.IGNORECASE | re.DOTALL):
            errors.append({
                'error': match.group(1).strip()[:200],
                'solution': match.group(2).strip()[:200]
            })
        
        return errors
    
    def extract_best_practices(self, content: str) -> List[str]:
        """Extract best practices and tips"""
        practices = []
        
        # Look for tip/note/important sections
        tip_pattern = r'(?::::|💡|📝|⚠️|ℹ️)(?:tip|note|important|warning|info)\[([^\]]+)\]'
        
        for match in re.finditer(tip_pattern, content, re.IGNORECASE):
            practices.append(match.group(1).strip())
        
        # Also look for "should" statements
        should_pattern = r'(?:You should|It\'s recommended to|Best practice is to|Always|Never)\s+(.+?)(?:\.|$)'
        
        for match in re.finditer(should_pattern, content):
            practice = match.group(0).strip()
            if len(practice) < 200:  # Reasonable length
                practices.append(practice)
        
        return practices[:10]  # Limit to 10 best practices
    
    def create_concept(self, filename: str, content: str, frontmatter: Dict) -> Concept:
        """Create a concept from document content"""
        title = frontmatter.get('title', filename)
        
        # Determine category and difficulty
        category = self.determine_category(filename, content)
        difficulty = self.determine_difficulty(content)
        
        # Extract key points
        key_points = self.extract_key_points(content)
        
        # Extract related concepts
        related = self.extract_related_concepts(content)
        
        # Extract tags
        tags = self.extract_tags(filename, content, frontmatter)
        
        return Concept(
            name=title,
            category=category,
            description=self.extract_summary(content)[:500],
            key_points=key_points,
            code_examples=self.extract_code_blocks(content),
            related_concepts=related,
            difficulty=difficulty,
            tags=tags
        )
    
    def determine_category(self, filename: str, content: str) -> str:
        """Determine the category of the content"""
        filename_lower = filename.lower()
        content_lower = content.lower()
        
        if 'permission' in filename_lower or 'capability' in filename_lower:
            return 'security'
        elif 'plugin' in filename_lower:
            return 'plugins'
        elif 'state' in filename_lower:
            return 'state_management'
        elif 'window' in filename_lower or 'tray' in filename_lower:
            return 'ui_customization'
        elif 'migrate' in filename_lower or 'update' in filename_lower:
            return 'migration'
        elif 'build' in filename_lower or 'bundle' in filename_lower:
            return 'build_deployment'
        elif 'debug' in filename_lower:
            return 'debugging'
        elif 'sidecar' in filename_lower or 'resource' in filename_lower:
            return 'resources'
        elif 'calling' in filename_lower or 'command' in content_lower[:1000]:
            return 'communication'
        else:
            return 'general'
    
    def determine_difficulty(self, content: str) -> str:
        """Determine difficulty level based on content"""
        content_lower = content.lower()
        
        advanced_keywords = ['advanced', 'complex', 'custom', 'internal', 'low-level', 'async', 'mutex', 'arc']
        intermediate_keywords = ['state', 'permission', 'capability', 'plugin', 'migration']
        
        advanced_count = sum(1 for keyword in advanced_keywords if keyword in content_lower)
        intermediate_count = sum(1 for keyword in intermediate_keywords if keyword in content_lower)
        
        if advanced_count >= 3:
            return 'advanced'
        elif intermediate_count >= 2 or advanced_count >= 1:
            return 'intermediate'
        else:
            return 'beginner'
    
    def extract_key_points(self, content: str) -> List[str]:
        """Extract key points from content"""
        points = []
        
        # Look for bulleted lists near the beginning
        bullet_pattern = r'(?:^|\n)\s*[\*\-]\s+(.+?)(?=\n[\*\-]|\n\n|\Z)'
        
        for match in re.finditer(bullet_pattern, content[:3000], re.MULTILINE):
            point = match.group(1).strip()
            if 20 < len(point) < 200:  # Reasonable length for a key point
                points.append(point)
        
        # Look for important statements
        important_pattern = r'(?:Important|Note|Key point|Remember)[:\s]+(.+?)(?:\.|$)'
        
        for match in re.finditer(important_pattern, content, re.IGNORECASE):
            point = match.group(1).strip()
            if len(point) < 200:
                points.append(point)
        
        return points[:10]  # Limit to 10 key points
    
    def extract_summary(self, content: str) -> str:
        """Extract or generate a summary"""
        # Try to find an explicit summary or introduction
        lines = content.split('\n')
        
        # Skip frontmatter
        start_idx = 0
        if lines[0].strip() == '---':
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == '---':
                    start_idx = i + 1
                    break
        
        # Look for first substantial paragraph
        summary_lines = []
        for line in lines[start_idx:]:
            line = line.strip()
            if line and not line.startswith('#') and not line.startswith('```'):
                summary_lines.append(line)
                if len(' '.join(summary_lines)) > 200:
                    break
            elif summary_lines:  # Stop at next heading or code block
                break
        
        return ' '.join(summary_lines)
    
    def extract_related_concepts(self, content: str) -> List[str]:
        """Extract related concepts from links and references"""
        related = []
        
        # Extract internal links
        link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        for match in re.finditer(link_pattern, content):
            link_text = match.group(1)
            link_url = match.group(2)
            
            if link_url.startswith('/') or link_url.startswith('#'):
                related.append(link_text)
        
        # Extract "See also" or "Related" sections
        related_pattern = r'(?:See also|Related|Learn more)[:\s]+(.+?)(?=\n\n|\Z)'
        match = re.search(related_pattern, content, re.IGNORECASE | re.DOTALL)
        
        if match:
            related_text = match.group(1)
            items = re.findall(r'\[([^\]]+)\]', related_text)
            related.extend(items)
        
        return list(set(related))[:15]  # Unique, limited to 15
    
    def extract_tags(self, filename: str, content: str, frontmatter: Dict) -> List[str]:
        """Extract tags from content"""
        tags = []
        
        # Add frontmatter tags if present
        if 'tags' in frontmatter:
            tags.extend(frontmatter['tags'])
        
        # Add filename-based tags
        filename_parts = filename.lower().replace('-', '_').replace('.mdx', '').split('_')
        tags.extend([part for part in filename_parts if len(part) > 3])
        
        # Extract technology/framework mentions
        tech_keywords = ['rust', 'javascript', 'typescript', 'vue', 'react', 'svelte', 
                        'windows', 'macos', 'linux', 'android', 'ios', 'mobile', 'desktop']
        
        content_lower = content.lower()
        for keyword in tech_keywords:
            if keyword in content_lower:
                tags.append(keyword)
        
        return list(set(tags))[:20]  # Unique, limited to 20
    
    def build_index(self):
        """Build searchable index"""
        # Index by category
        for concept in self.concepts:
            if concept.category not in self.index:
                self.index[concept.category] = []
            self.index[concept.category].append(concept.name)
        
        # Index by tags
        for concept in self.concepts:
            for tag in concept.tags:
                index_key = f"tag:{tag}"
                if index_key not in self.index:
                    self.index[index_key] = []
                self.index[index_key].append(concept.name)
        
        # Index by difficulty
        for concept in self.concepts:
            index_key = f"difficulty:{concept.difficulty}"
            if index_key not in self.index:
                self.index[index_key] = []
            self.index[index_key].append(concept.name)
        
        # Index commands
        self.index['commands'] = [cmd.name for cmd in self.commands]
        
        # Index workflows
        self.index['workflows'] = [wf.name for wf in self.workflows]
    
    def parse_file(self, filename: str, content: str):
        """Parse a single documentation file"""
        self.metadata['total_files'] += 1
        
        # Extract frontmatter
        frontmatter = self.parse_frontmatter(content)
        
        # Create concept
        concept = self.create_concept(filename, content, frontmatter)
        self.concepts.append(concept)
        
        # Extract code examples
        examples = self.extract_code_blocks(content)
        self.code_examples.extend(examples)
        
        # Extract commands
        commands = self.extract_commands(content)
        self.commands.extend(commands)
        
        # Extract workflows
        workflows = self.extract_workflows(content, filename)
        self.workflows.extend(workflows)
    
    def generate_llm_optimized_output(self) -> Dict[str, Any]:
        """Generate the final LLM-optimized output"""
        # Build the index
        self.build_index()
        
        # Create quick reference
        quick_reference = {
            'common_commands': self.get_common_commands(),
            'essential_concepts': self.get_essential_concepts(),
            'frequent_patterns': self.get_frequent_patterns(),
            'platform_specific': self.organize_by_platform(),
            'difficulty_progression': self.organize_by_difficulty()
        }
        
        # Extract V2-specific information
        v2_changes = self.extract_v2_changes()
        permissions_info = self.extract_permissions_info()
        worker_patterns = self.extract_worker_patterns()
        plugin_info = self.extract_plugin_info()
        
        # Create the final output
        output = {
            'metadata': self.metadata,
            'quick_reference': quick_reference,
            'concepts': [asdict(c) for c in self.concepts],
            'commands': [asdict(c) for c in self.commands],
            'workflows': [asdict(w) for w in self.workflows],
            'code_examples': [asdict(e) for e in self.code_examples],
            'index': self.index,
            'search_hints': self.generate_search_hints(),
            # V2-specific sections
            'v2_changes': v2_changes,
            'permissions': permissions_info,
            'worker_patterns': worker_patterns,
            'plugins': plugin_info
        }
        
        return output
    
    def get_common_commands(self) -> List[Dict[str, str]]:
        """Get most common commands"""
        common = []
        
        # Prioritize certain commands
        priority_commands = ['tauri_dev', 'tauri_build', 'tauri_init', 'invoke', 
                            'tauri_migrate', 'tauri_add', 'tauri_icon']
        
        for cmd_name in priority_commands:
            for cmd in self.commands:
                if cmd_name in cmd.name:
                    common.append({
                        'name': cmd.name,
                        'description': cmd.description,
                        'syntax': cmd.syntax
                    })
                    break
        
        return common[:10]
    
    def get_essential_concepts(self) -> List[Dict[str, str]]:
        """Get essential concepts for beginners"""
        essential = []
        
        beginner_concepts = [c for c in self.concepts if c.difficulty == 'beginner']
        
        # Prioritize certain topics
        priority_topics = ['create', 'setup', 'prerequisites', 'project', 'develop', 
                          'calling', 'window', 'configuration']
        
        for topic in priority_topics:
            for concept in beginner_concepts:
                if topic in concept.name.lower():
                    essential.append({
                        'name': concept.name,
                        'category': concept.category,
                        'summary': concept.description[:200]
                    })
                    break
        
        return essential
    
    def get_frequent_patterns(self) -> List[Dict[str, Any]]:
        """Extract frequently used patterns"""
        patterns = []
        
        # Analyze code examples for patterns
        pattern_counts = {}
        
        for example in self.code_examples:
            if 'tauri::command' in example.code:
                pattern_counts['command_definition'] = pattern_counts.get('command_definition', 0) + 1
            if 'invoke(' in example.code:
                pattern_counts['command_invocation'] = pattern_counts.get('command_invocation', 0) + 1
            if 'State<' in example.code:
                pattern_counts['state_management'] = pattern_counts.get('state_management', 0) + 1
            if '.manage(' in example.code:
                pattern_counts['state_initialization'] = pattern_counts.get('state_initialization', 0) + 1
            if 'Window' in example.code or 'webview' in example.code.lower():
                pattern_counts['window_manipulation'] = pattern_counts.get('window_manipulation', 0) + 1
            # V2-specific patterns
            if 'capabilities' in example.code.lower() or 'permissions' in example.code.lower():
                pattern_counts['v2_permissions'] = pattern_counts.get('v2_permissions', 0) + 1
            if 'sidecar' in example.code.lower() or 'Command.sidecar' in example.code:
                pattern_counts['sidecar_execution'] = pattern_counts.get('sidecar_execution', 0) + 1
            if 'plugin' in example.code.lower() or '@tauri-apps/plugin-' in example.code:
                pattern_counts['plugin_usage'] = pattern_counts.get('plugin_usage', 0) + 1
            if 'WebviewWindow' in example.code:
                pattern_counts['v2_window_api'] = pattern_counts.get('v2_window_api', 0) + 1
            if 'worker' in example.code.lower() and ('spawn' in example.code or 'execute' in example.code):
                pattern_counts['worker_execution'] = pattern_counts.get('worker_execution', 0) + 1
        
        for example in self.code_examples:
            if 'tauri::command' in example.code:
                pattern_counts['command_definition'] = pattern_counts.get('command_definition', 0) + 1
            if 'invoke(' in example.code:
                pattern_counts['command_invocation'] = pattern_counts.get('command_invocation', 0) + 1
            if 'State<' in example.code:
                pattern_counts['state_management'] = pattern_counts.get('state_management', 0) + 1
            if '.manage(' in example.code:
                pattern_counts['state_initialization'] = pattern_counts.get('state_initialization', 0) + 1
            if 'WebviewWindow' in example.code:
                pattern_counts['window_manipulation'] = pattern_counts.get('window_manipulation', 0) + 1
        
        # Get top patterns with examples
        for pattern_name, count in sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            # Find a good example for this pattern
            example = None
            for ex in self.code_examples:
                if pattern_name == 'command_definition' and 'tauri::command' in ex.code:
                    example = ex
                    break
                elif pattern_name == 'command_invocation' and 'invoke(' in ex.code:
                    example = ex
                    break
                # ... etc
            
            patterns.append({
                'name': pattern_name,
                'frequency': count,
                'example': asdict(example) if example else None
            })
        
        return patterns
    
    def organize_by_platform(self) -> Dict[str, List[str]]:
        """Organize content by platform"""
        platforms = {
            'windows': [],
            'macos': [],
            'linux': [],
            'android': [],
            'ios': [],
            'cross_platform': []
        }
        
        for concept in self.concepts:
            content_str = ' '.join([concept.name, concept.description] + concept.tags)
            content_lower = content_str.lower()
            
            matched = False
            for platform in ['windows', 'macos', 'linux', 'android', 'ios']:
                if platform in content_lower:
                    platforms[platform].append(concept.name)
                    matched = True
            
            if not matched:
                platforms['cross_platform'].append(concept.name)
        
        return platforms
    
    def organize_by_difficulty(self) -> Dict[str, List[str]]:
        """Organize learning path by difficulty"""
        progression = {
            'beginner': [],
            'intermediate': [],
            'advanced': []
        }
        
        for concept in self.concepts:
            progression[concept.difficulty].append(concept.name)
        
        return progression
    
    def generate_search_hints(self) -> Dict[str, List[str]]:
        """Generate search hints for common queries"""
        hints = {
            'how_to_start': ['prerequisites', 'create-project', 'develop'],
            'frontend_backend_communication': ['calling-rust', 'calling-frontend', 'commands', 'events'],
            'ui_customization': ['window-customization', 'system-tray', 'window-menu', 'splashscreen'],
            'security': ['capabilities', 'permissions', 'core-permissions'],
            'deployment': ['build', 'icons', 'resources', 'sidecar'],
            'state_and_data': ['state-management', 'resources'],
            'debugging': ['debug-vscode', 'environment-variables'],
            'migration': ['migrate-from-tauri-1', 'migrate-from-tauri-2-beta', 'updating-dependencies'],
            'platform_specific': ['windows', 'macos', 'linux', 'android', 'ios'],
            'plugins': ['using-plugin-permissions', 'writing-plugin-permissions']
        }
        
        return hints

    def extract_v2_changes(self) -> Dict[str, Any]:
        """Extract Tauri v2 specific changes and migration info"""
        v2_info = {
            'breaking_changes': [],
            'new_features': [],
            'migration_steps': [],
            'deprecated_apis': [],
            'new_permissions_model': []
        }
        
        for concept in self.concepts:
            name_lower = concept.name.lower()
            desc_lower = concept.description.lower()
            
            if 'migrate' in name_lower or 'migration' in desc_lower:
                v2_info['migration_steps'].append({
                    'name': concept.name,
                    'description': concept.description[:300],
                    'category': concept.category
                })
            
            if 'v2' in desc_lower or 'tauri 2' in desc_lower:
                if 'breaking' in desc_lower or 'removed' in desc_lower:
                    v2_info['breaking_changes'].append(concept.name)
                elif 'new' in desc_lower or 'added' in desc_lower:
                    v2_info['new_features'].append(concept.name)
            
            if 'permission' in name_lower or 'capabilities' in name_lower:
                v2_info['new_permissions_model'].append({
                    'name': concept.name,
                    'description': concept.description[:200]
                })
        
        # Extract migration patterns from code examples
        for example in self.code_examples:
            if 'v1' in example.context.lower() or 'migrate' in example.context.lower():
                if '// v1' in example.code or '// v2' in example.code:
                    v2_info['migration_steps'].append({
                        'type': 'code_migration',
                        'language': example.language,
                        'code': example.code[:500],
                        'context': example.context
                    })
        
        return v2_info
    
    def extract_permissions_info(self) -> Dict[str, Any]:
        """Extract comprehensive permissions and capabilities information"""
        permissions = {
            'core_permissions': [],
            'plugin_permissions': [],
            'capability_patterns': [],
            'permission_scopes': [],
            'security_best_practices': []
        }
        
        for concept in self.concepts:
            name_lower = concept.name.lower()
            desc_lower = concept.description.lower()
            
            if 'permission' in name_lower or 'capabilities' in name_lower:
                if 'core' in name_lower:
                    permissions['core_permissions'].append({
                        'name': concept.name,
                        'description': concept.description[:250],
                        'category': concept.category
                    })
                elif 'plugin' in name_lower:
                    permissions['plugin_permissions'].append({
                        'name': concept.name,
                        'description': concept.description[:250]
                    })
        
        # Extract permission patterns from code examples
        for example in self.code_examples:
            if 'capabilities' in example.code.lower() or 'permissions' in example.code.lower():
                permissions['capability_patterns'].append({
                    'language': example.language,
                    'pattern': example.code[:300],
                    'context': example.context
                })
            
            if 'scope' in example.code.lower() and ('fs:' in example.code or 'shell:' in example.code):
                permissions['permission_scopes'].append({
                    'type': 'scope_example',
                    'code': example.code[:200],
                    'language': example.language
                })
        
        return permissions
    
    def extract_worker_patterns(self) -> Dict[str, Any]:
        """Extract worker and sidecar execution patterns"""
        worker_info = {
            'sidecar_patterns': [],
            'worker_execution': [],
            'command_patterns': [],
            'binary_configuration': []
        }
        
        for example in self.code_examples:
            code_lower = example.code.lower()
            
            if 'sidecar' in code_lower:
                worker_info['sidecar_patterns'].append({
                    'language': example.language,
                    'code': example.code[:400],
                    'context': example.context,
                    'description': example.description
                })
            
            if 'command' in code_lower and ('spawn' in code_lower or 'execute' in code_lower):
                worker_info['command_patterns'].append({
                    'language': example.language,
                    'pattern': example.code[:300],
                    'context': example.context
                })
            
            if 'worker' in code_lower or 'ffmpeg' in code_lower or 'ffprobe' in code_lower:
                worker_info['worker_execution'].append({
                    'type': 'worker_example',
                    'language': example.language,
                    'code': example.code[:350],
                    'context': example.context
                })
            
            if 'externalbind' in code_lower or 'binaries' in code_lower:
                worker_info['binary_configuration'].append({
                    'language': example.language,
                    'config': example.code[:250],
                    'context': example.context
                })
        
        return worker_info
    
    def extract_plugin_info(self) -> Dict[str, Any]:
        """Extract comprehensive plugin information"""
        plugin_info = {
            'available_plugins': [],
            'plugin_usage_patterns': [],
            'plugin_permissions': [],
            'migration_to_plugins': [],
            'custom_plugin_dev': []
        }
        
        for concept in self.concepts:
            name_lower = concept.name.lower()
            desc_lower = concept.description.lower()
            
            if 'plugin' in name_lower:
                if 'writing' in name_lower or 'custom' in name_lower:
                    plugin_info['custom_plugin_dev'].append({
                        'name': concept.name,
                        'description': concept.description[:300]
                    })
                else:
                    plugin_info['available_plugins'].append({
                        'name': concept.name,
                        'description': concept.description[:250],
                        'category': concept.category
                    })
        
        # Extract plugin patterns from code examples
        for example in self.code_examples:
            code_lower = example.code.lower()
            
            if '@tauri-apps/plugin-' in example.code:
                plugin_name = self.extract_plugin_name(example.code)
                plugin_info['plugin_usage_patterns'].append({
                    'plugin': plugin_name,
                    'language': example.language,
                    'usage': example.code[:300],
                    'context': example.context
                })
            
            if 'plugin' in code_lower and 'permission' in code_lower:
                plugin_info['plugin_permissions'].append({
                    'language': example.language,
                    'permission_code': example.code[:250],
                    'context': example.context
                })
            
            if 'migrate' in example.context.lower() and 'plugin' in code_lower:
                plugin_info['migration_to_plugins'].append({
                    'language': example.language,
                    'migration_example': example.code[:400],
                    'context': example.context
                })
        
        return plugin_info
    
    def extract_plugin_name(self, code: str) -> str:
        """Extract plugin name from import statement"""
        import re
        match = re.search(r'@tauri-apps/plugin-([a-zA-Z-]+)', code)
        return match.group(1) if match else 'unknown'

def create_llm_reference_document(parsed_data: Dict[str, Any]) -> str:
    """Create a concise reference document for LLM consumption"""
    doc = []
    
    doc.append("# Tauri 2.0 Quick Reference for LLM\n")
    doc.append(f"Generated: {parsed_data['metadata']['parsed_at']}\n")
    doc.append(f"Total concepts: {len(parsed_data['concepts'])}\n")
    doc.append(f"Total commands: {len(parsed_data['commands'])}\n")
    doc.append(f"Total workflows: {len(parsed_data['workflows'])}\n\n")
    
    doc.append("## Quick Command Reference\n")
    for cmd in parsed_data['quick_reference']['common_commands']:
        doc.append(f"- **{cmd['name']}**: `{cmd['syntax']}` - {cmd['description']}\n")
    
    doc.append("\n## Essential Concepts\n")
    for concept in parsed_data['quick_reference']['essential_concepts']:
        doc.append(f"- **{concept['name']}** ({concept['category']}): {concept['summary']}\n")
    
    # V2 Changes Section
    if 'v2_changes' in parsed_data and parsed_data['v2_changes']:
        doc.append("\n## Tauri v2 Changes & Migration\n")
        v2_data = parsed_data['v2_changes']
        
        if v2_data.get('breaking_changes'):
            doc.append("### Breaking Changes\n")
            for change in v2_data['breaking_changes'][:5]:
                doc.append(f"- {change}\n")
        
        if v2_data.get('new_features'):
            doc.append("### New Features\n")
            for feature in v2_data['new_features'][:5]:
                doc.append(f"- {feature}\n")
        
        if v2_data.get('migration_steps'):
            doc.append("### Migration Examples\n")
            for step in v2_data['migration_steps'][:3]:
                if 'code' in step:
                    doc.append(f"- **{step.get('type', 'Migration')}** ({step.get('language', 'code')})\n")
                    doc.append(f"  ```{step.get('language', 'text')}\n  {step['code'][:150]}...\n  ```\n")
                else:
                    doc.append(f"- **{step['name']}**: {step['description'][:100]}...\n")
    
    # Permissions Section
    if 'permissions' in parsed_data and parsed_data['permissions']:
        doc.append("\n## Permissions & Capabilities\n")
        perm_data = parsed_data['permissions']
        
        if perm_data.get('core_permissions'):
            doc.append("### Core Permissions\n")
            for perm in perm_data['core_permissions'][:3]:
                doc.append(f"- **{perm['name']}**: {perm['description'][:100]}...\n")
        
        if perm_data.get('capability_patterns'):
            doc.append("### Capability Patterns\n")
            for pattern in perm_data['capability_patterns'][:2]:
                doc.append(f"- **{pattern['language']}**: `{pattern['pattern'][:100]}...`\n")
    
    # Worker Patterns Section
    if 'worker_patterns' in parsed_data and parsed_data['worker_patterns']:
        doc.append("\n## Worker & Sidecar Patterns\n")
        worker_data = parsed_data['worker_patterns']
        
        if worker_data.get('sidecar_patterns'):
            doc.append("### Sidecar Execution\n")
            for pattern in worker_data['sidecar_patterns'][:2]:
                doc.append(f"- **{pattern['language']}**: {pattern['context']}\n")
                doc.append(f"  ```{pattern['language']}\n  {pattern['code'][:150]}...\n  ```\n")
        
        if worker_data.get('worker_execution'):
            doc.append("### Worker Examples\n")
            for worker in worker_data['worker_execution'][:2]:
                doc.append(f"- **{worker['type']}** ({worker['language']}): {worker['context'][:80]}...\n")
    
    # Plugin Section
    if 'plugins' in parsed_data and parsed_data['plugins']:
        doc.append("\n## Plugin Usage\n")
        plugin_data = parsed_data['plugins']
        
        if plugin_data.get('available_plugins'):
            doc.append("### Available Plugins\n")
            for plugin in plugin_data['available_plugins'][:5]:
                doc.append(f"- **{plugin['name']}**: {plugin['description'][:100]}...\n")
        
        if plugin_data.get('plugin_usage_patterns'):
            doc.append("### Plugin Usage Patterns\n")
            for pattern in plugin_data['plugin_usage_patterns'][:3]:
                doc.append(f"- **@tauri-apps/plugin-{pattern['plugin']}** ({pattern['language']})\n")
                doc.append(f"  ```{pattern['language']}\n  {pattern['usage'][:120]}...\n  ```\n")
    
    doc.append("\n## Common Patterns\n")
    for pattern in parsed_data['quick_reference']['frequent_patterns']:
        doc.append(f"- **{pattern['name']}** (used {pattern['frequency']} times)\n")
        if pattern['example']:
            doc.append(f"  ```{pattern['example']['language']}\n  {pattern['example']['code'][:200]}...\n  ```\n")
    
    doc.append("\n## Platform-Specific Topics\n")
    for platform, topics in parsed_data['quick_reference']['platform_specific'].items():
        if topics:
            doc.append(f"- **{platform}**: {', '.join(topics[:5])}\n")
    
    doc.append("\n## Learning Path\n")
    for difficulty, topics in parsed_data['quick_reference']['difficulty_progression'].items():
        doc.append(f"- **{difficulty.capitalize()}**: {', '.join(topics[:5])}\n")
    
    doc.append("\n## Search Hints\n")
    for query, hints in parsed_data['search_hints'].items():
        doc.append(f"- **{query.replace('_', ' ')}**: {', '.join(hints)}\n")
    
    return ''.join(doc)

def main():
    """Main function to run the parser"""
    import os
    import glob
    
    parser = TauriDocParser()
    
    # Get current directory and check for .mdx files
    current_dir = os.getcwd()
    print(f"Parsing Tauri docs from: {current_dir}")
    
    # Look for .mdx files in current directory first, then in subdirectories
    mdx_files = glob.glob("*.mdx")
    if not mdx_files:
        # Try the raw subdirectory
        raw_path = os.path.join(current_dir, "raw")
        if os.path.exists(raw_path):
            os.chdir(raw_path)
            mdx_files = glob.glob("*.mdx")
            print(f"Found .mdx files in raw directory: {raw_path}")
        else:
            # Try going up one level and then into raw
            parent_dir = os.path.dirname(current_dir)
            raw_path = os.path.join(parent_dir, "raw")
            if os.path.exists(raw_path):
                os.chdir(raw_path)
                mdx_files = glob.glob("*.mdx")
                print(f"Found .mdx files in parent raw directory: {raw_path}")
    
    if not mdx_files:
        print("No .mdx files found in current directory or raw subdirectory!")
        return
    
    print(f"Found {len(mdx_files)} .mdx files to process")
    
    # Parse each .mdx file
    for filename in sorted(mdx_files):
        print(f"Parsing {filename}...")
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
            parser.parse_file(filename, content)
        except Exception as e:
            print(f"Error parsing {filename}: {e}")
            continue
    
    # Generate and print the LLM-optimized output
    print("\nGenerating LLM-optimized output...")
    parsed_data = parser.generate_llm_optimized_output()
    
    print(f"\n=== PARSING RESULTS ===")
    print(f"Concepts: {len(parsed_data['concepts'])}")
    print(f"Commands: {len(parsed_data['commands'])}")
    print(f"Workflows: {len(parsed_data['workflows'])}")
    print(f"Code Examples: {len(parsed_data['code_examples'])}")
    
    # Save comprehensive output to JSON
    output_file = 'tauri_docs_parsed.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        import json
        json.dump(parsed_data, f, indent=2, ensure_ascii=False)
    print(f"\nComprehensive data saved to: {output_file}")
    
    # Create and save LLM reference document
    llm_doc = create_llm_reference_document(parsed_data)
    llm_output_file = 'tauri_llm_reference.md'
    with open(llm_output_file, 'w', encoding='utf-8') as f:
        f.write(llm_doc)
    print(f"LLM reference document saved to: {llm_output_file}")
    
    print(f"\n=== QUICK STATS ===")
    if parsed_data['quick_reference']['common_commands']:
        print(f"Most common commands: {', '.join([cmd['name'] for cmd in parsed_data['quick_reference']['common_commands'][:5]])}")
    if parsed_data['quick_reference']['essential_concepts']:
        print(f"Key concepts: {', '.join([concept['name'] for concept in parsed_data['quick_reference']['essential_concepts'][:5]])}")
    
    print("\nParsing complete!")

if __name__ == "__main__":
    main()
