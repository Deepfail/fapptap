# Planning MCP Rules (Fapptap)

## Purpose

Keep a single, living delivery plan the model can query/update without noise.

## Scope

- Use **software-planning** MCP only.
- Plan file: `cache/plans/v0.json` (single source of truth).

## Golden Rules

1. One active plan only (v0).
2. Keep tasks atomic, estimable, and testable.
3. Update plan after any scope change; export immediately.

## Auto-approved

- `create_plan`, `add_task`, `update_task`, `list_tasks`, `export_plan`

## Manual approval

- Any action that deletes tasks or entire plans.

## Task format

- `title` (imperative), `estimate_days` (float), `owner` ("me"), `status` ("todo|doing|done"),
  `acceptance` (bullet list), `blocked_by` (ids).

## Behavior

- On session start: `list_tasks` → summarize status in 5 bullets.
- After changes: `export_plan` to `cache/plans/v0.json`.
