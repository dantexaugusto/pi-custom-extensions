---
name: squad-workflows
description: Reference for the squad multi-agent orchestration tool and its workflows. Load when you need to delegate tasks to specialized agents (scout, planner, frontend, backend, tester, reviewer) or choose the right workflow for a task.
---

# Squad Workflows

The `squad` tool delegates tasks to specialized agents running as isolated pi subprocesses. Each agent has its own context window, tools, and system prompt.

## Agents

| Agent | Model | Tools | Use when |
|-------|-------|-------|----------|
| scout | Haiku (fast) | read, grep, find, ls, bash, web_search, web_fetch | You need to understand a codebase area before planning or implementing |
| planner | Sonnet | read, grep, find, ls, web_search, web_fetch | You need a structured implementation plan before coding |
| frontend | Sonnet | read, write, edit, grep, find, ls, bash | The task involves UI, components, styles, or client-side logic |
| backend | Sonnet | read, write, edit, grep, find, ls, bash | The task involves APIs, databases, server logic, or middleware |
| tester | Sonnet | read, write, edit, grep, find, ls, bash | You need to write or update tests |
| reviewer | Sonnet | read, grep, find, ls, bash | You need a code review of changes |

## Execution Modes

### Single — one agent, one task
```json
{ "agent": "reviewer", "task": "Review the changes in src/auth/" }
```

### Parallel — multiple agents concurrently (max 8, 4 simultaneous)
```json
{ "tasks": [
  { "agent": "frontend", "task": "Build the login form component" },
  { "agent": "backend", "task": "Create the /api/auth/login endpoint" }
]}
```

### Chain — sequential, output passed via `{previous}`
```json
{ "chain": [
  { "agent": "scout", "task": "Find all code related to user authentication" },
  { "agent": "planner", "task": "Plan implementation based on: {previous}" }
]}
```

## Recommended Workflows

### New feature (full)
1. **scout** — find relevant code
2. **planner** — create implementation plan from scout output
3. **frontend + backend** (parallel) — implement from plan
4. **reviewer** — review all changes

Use `/feature <description>` to run this automatically.

### Quick fix
Use a single **frontend** or **backend** agent directly for small, focused changes.

### Implement + review + fix
1. **frontend** or **backend** — implement
2. **reviewer** — review
3. Same agent — apply fixes

Use `/implement-review <description>` to run this automatically.

### Fullstack (parallel)
1. **frontend + backend** (parallel) — implement both sides
2. **reviewer** — review

Use `/fullstack <description>` to run this automatically.

### Tests
1. **scout** — find code and existing test patterns
2. **tester** — write tests

Use `/test <description>` to run this automatically.

### Code review
Single **reviewer** agent. Use `/review` to run this automatically.

## Prompt Templates

These templates orchestrate squad workflows via slash commands:

| Command | Workflow |
|---------|----------|
| `/feature <desc>` | scout → planner → parallel(frontend, backend) → reviewer |
| `/fullstack <desc>` | parallel(frontend, backend) → reviewer |
| `/implement-review <desc>` | implement → review → fix |
| `/review [files]` | reviewer on recent changes or specified files |
| `/test <desc>` | scout → tester |
| `/pr <url>` | Structured PR review with changelog check |
| `/is <url>` | GitHub issue analysis |
| `/cl` | Changelog audit against commits since last release |
| `/wr` | Wrap up: changelog, commit, push |

## Decision Guide

- **"I need to build a feature"** → `/feature` or chain scout → planner → parallel → reviewer
- **"Fix this bug"** → single frontend or backend agent
- **"Review my changes"** → `/review` or single reviewer
- **"Write tests for X"** → `/test` or chain scout → tester
- **"Build frontend and backend together"** → `/fullstack` or parallel mode
- **"Implement, get feedback, iterate"** → `/implement-review`
- **"Review this PR"** → `/pr <url>`
- **"Analyze this issue"** → `/is <url>`
- **"I'm done, wrap up"** → `/wr`
