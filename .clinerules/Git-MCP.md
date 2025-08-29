# Git + GitHub MCP Rules (AutoEdit)

## Purpose

Guide safe, efficient use of Git MCP (local repo) and GitHub MCP (remote repo) inside the AutoEdit project.

## Scope

- Local repo root: `C:/Files/Projects/fapptap`
- Git MCP: local status, commits, diffs, branches
- GitHub MCP: issues, pull requests, remote state
- Do not touch repositories outside project root without approval

---

## Golden Rules

1. **Safety first** — verify changes before committing or pushing
2. **Atomic commits** — focused, descriptive, < 200 lines
3. **Branch discipline** — never commit directly to `main`
4. **Review before push** — always review diffs/logs
5. **PR-first workflow** — merge via PRs, not direct pushes

---

## Auto-Approved Operations

### Git MCP

- `git_status` — check repo state
- `git_log` — view commit history
- `git_diff` — inspect changes
- `git_branch` — list/manage branches
- `git_commit` — local commit (safe, reversible)

### GitHub MCP

- `get_me` — confirm identity
- `get_repository`, `list_repositories`
- `list_commits`, `get_commit`
- `list_pull_requests`, `get_pull_request`
- `list_issues`, `get_issue`

---

## Manual Approval Required

### Git MCP

- `git_push` — push to remote
- `git_merge` — merge branches
- `git_reset` — reset state
- `git_rebase` — rebase commits
- `delete_branch` — local or remote

### GitHub MCP

- `create_issue` — open new issue
- `create_pull_request` — open PR
- `merge_pull_request` — merge PR
- `close_issue` or `close_pull_request`

---

## Best Practices

- **Commit messages**: conventional commits style (`feat: …`, `fix: …`, `chore: …`)
- **Branching**:
  - `main` → stable code only
  - `feature/*` → new features
  - `fix/*` → bug fixes
- **Tags**: use semantic versioning for releases
- **Reviews**: use PRs for review/merge; no direct pushes to `main`

---

## Security

- Never commit API keys, tokens, secrets
- Maintain `.gitignore` for build artifacts, cache, `render/`
- Use signed commits for releases and tags

---

## Recovery

- Use `git stash` for WIP
- Use `git reflog` to restore lost commits
- Never `reset --hard` without explicit manual approval

---

## Integration with Other MCPs

- **Filesystem MCP** → read/write `.gitignore`, config files
- **Memory MCP** → save branch naming conventions, commit format
- **Planning MCP** → sync tasks/issues with GitHub issues
- **Process MCP** → never used for git; Git MCP only

---

**Optimized for disciplined local commits, GitHub-based collaboration, and safe recovery practices.**
