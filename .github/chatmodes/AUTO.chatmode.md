# AUTO chat mode

This file documents the repository's AUTO chat mode for human readers. It intentionally contains no YAML frontmatter or embedded machine-readable blocks to avoid linter/schema complaints from Copilot or the editor.

How to trigger AUTO behavior (human instructions):

- When sending messages to an agent, include the line `mode: agent` at the top to request a non-interactive, CI-style run.
- Expected agent behavior when requested in AUTO mode:
  - Assume CI=true (no interactive prompts, no watch modes).
  - Attempt up to 3 automated fixes for transient failures.
  - Produce a single final summary with: what shipped, how to run (≤3 commands), artifacts, assumptions, and follow-ups.
  - Avoid destructive operations (no credential/secret use without explicit consent).

MODES:
AUTO:
id: AUTO
priority: true
non_interactive: true
trigger_header: "mode: agent" # List of repository files the agent should load (in order of precedence) # These files are human-authored and contain the canonical AUTO-MODE guidance.
instructions_paths: - ".github/copilot-instructions.md" - ".github/chatmodes/AUTO.chatmode.md" - "C:\\Files\\Projects\\fapptap\\.github\\prompts\\AUTO MODE.prompt.md"
allowed_tools: - npm - npx - node - vite - tsc - python - ffmpeg
behavior:
non_interactive: true
assume_ci: true
no_watch_modes: true
auto_fix_attempts: 3
produce_final_summary: true
safety:
allow_destructive_ops: false
require_secret_consent: true
INTERACTIVE:
id: INTERACTIVE
priority: false
non_interactive: false
behavior:
non_interactive: false
ask_clarifying_questions: true
SAFE:
id: SAFE
priority: false
non_interactive: false
behavior:
non_interactive: false
disallow_destructive_ops: true
