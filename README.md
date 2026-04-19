# Pi Extensions

A collection of custom extensions, agents, and prompt templates for the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

## What is Pi?

[Pi](https://github.com/badlogic/pi-mono) is an interactive terminal coding agent that supports multiple LLM providers (OpenAI, Anthropic, Google, etc.). It can be extended through:

- **Extensions** — TypeScript modules that add tools, commands, event hooks, and custom UI
- **Skills** — Markdown-based capability packages loaded on demand
- **Prompt Templates** — Reusable prompts invoked via `/template-name`
- **Agents** — Markdown-defined agent profiles used by the squad extension for multi-agent orchestration

This repo contains custom implementations of all of the above.

## Contents

```
├── extensions/
│   ├── files.ts              # /files command — browse session files
│   ├── web-search.ts         # web_search + web_fetch tools
│   ├── diff.ts               # /diff command — git diff viewer
│   ├── squad/                # Multi-agent orchestration tool
│   │   ├── index.ts
│   │   └── agents.ts
│   ├── tps.ts                # Tokens-per-second stats on each turn
│   ├── prompt-url-widget.ts  # Widget for PR/issue URL context
│   └── redraws.ts            # /tui command — TUI redraw stats
├── agents/                   # Agent profiles for the squad extension
│   ├── scout.md
│   ├── planner.md
│   ├── frontend.md
│   ├── backend.md
│   ├── tester.md
│   └── reviewer.md
├── prompts/                  # Prompt templates
│   ├── feature.md            # /feature — full feature workflow
│   ├── fullstack.md          # /fullstack — parallel frontend+backend
│   ├── implement-review.md   # /implement-review — implement, review, fix
│   ├── review.md             # /review — code review
│   ├── test.md               # /test — write tests
│   ├── pr.md                 # /pr — structured PR review
│   ├── is.md                 # /is — GitHub issue analysis
│   ├── cl.md                 # /cl — changelog audit
│   └── wr.md                 # /wr — wrap up task (changelog, commit, push)
├── skills/                   # Skills (on-demand reference for the LLM)
│   └── squad-workflows/
│       └── SKILL.md          # Squad agent and workflow reference
└── install.sh                # Deploy script for global pi installation
```

## Extensions

### files.ts

Registers the `/files` command. Lists all files the model has read, written, or edited in the current session branch. Selecting a file opens it in VS Code.

- Shows operation type per file: (R)ead, (W)rite, (E)dit
- Sorted by most recent interaction
- Interactive picker with keyboard navigation

### web-search.ts

Registers two LLM-callable tools:

- `web_search` — Search the web via Tavily, Brave, or SerpAPI (first available key wins)
- `web_fetch` — Fetch a URL and return text content (HTML stripped, JSON as-is)

Requires one of these env vars: `TAVILY_API_KEY`, `BRAVE_API_KEY`, or `SERP_API_KEY`.

### diff.ts

Registers the `/diff` command. Shows `git status` changes with colored status indicators (M/A/D/?) and opens the selected file in VS Code's diff view via `git difftool`.

### squad/

Registers the `squad` tool for multi-agent orchestration. Delegates tasks to specialized agents that run as isolated pi subprocesses, each with their own context window.

Three execution modes:
- **single** — `{ agent, task }` — one agent, one task
- **parallel** — `{ tasks: [{agent, task}, ...] }` — up to 8 agents concurrently (max 4 simultaneous)
- **chain** — `{ chain: [{agent, task}, ...] }` — sequential with `{previous}` placeholder for passing output

Includes full TUI rendering with token usage stats, tool call previews, and expandable output.

### tps.ts

Displays tokens-per-second statistics after each agent turn. Shows output tokens, input tokens, cache read/write, total tokens, and elapsed time.

### prompt-url-widget.ts

Detects GitHub PR or issue URLs in user prompts and displays a persistent widget with the title and author (fetched via `gh` CLI). Also sets the session name automatically.

### redraws.ts

Registers the `/tui` command. Shows TUI full redraw count — useful for debugging rendering performance.

## Agents

Agent profiles are Markdown files in `.pi/agents/` with YAML frontmatter. They are used by the `squad` extension to configure specialized sub-agents.

| Agent | Model | Description |
|-------|-------|-------------|
| scout | Haiku (fast) | Codebase recon — finds relevant code and returns structured context |
| planner | Sonnet | Creates implementation plans from context and requirements |
| frontend | Sonnet | React, CSS, HTML, responsive design, accessibility |
| backend | Sonnet | APIs, databases, server logic, authentication |
| tester | Sonnet | Unit, integration, and e2e tests |
| reviewer | Sonnet | Code review for quality, security, and performance |

## Prompt Templates

Prompt templates are invoked in pi via `/template-name`. They orchestrate the squad agents for common workflows.

| Template | Description |
|----------|-------------|
| `/feature` | Full workflow: scout → planner → parallel frontend+backend → reviewer |
| `/fullstack` | Parallel frontend + backend, then review |
| `/implement-review` | Implement → review → apply fixes |
| `/review` | Code review of recent changes |
| `/test` | Scout for context, then write tests |
| `/pr` | Structured PR review with changelog verification |
| `/is` | GitHub issue analysis (bugs and feature requests) |
| `/cl` | Changelog audit against commits since last release |
| `/wr` | Wrap up: changelog, commit, push |

## Installation

### Option 1: Install globally (recommended)

Clone the repo and run the install script:

```bash
git clone <repo-url> pi-custom-extensions
cd pi-custom-extensions
./install.sh
```

This copies all extensions, agents, and prompts to `~/.pi/agent/` where pi auto-discovers them globally.

### Option 2: Copy to your project

Copy the directories into your project's `.pi/` folder:

```bash
cp -r extensions/ /path/to/your/project/.pi/extensions/
cp -r agents/ /path/to/your/project/.pi/agents/
cp -r prompts/ /path/to/your/project/.pi/prompts/
```

### Option 3: Reference via settings.json

Point pi to this repo's extensions in your project or global `settings.json`:

```json
{
  "extensions": [
    "/path/to/this-repo/extensions/files.ts",
    "/path/to/this-repo/extensions/web-search.ts",
    "/path/to/this-repo/extensions/diff.ts",
    "/path/to/this-repo/extensions/squad"
  ]
}
```

Settings file locations:
- Project: `.pi/settings.json`
- Global: `~/.pi/agent/settings.json`

### Option 4: Load individual extensions on the fly

```bash
pi -e /path/to/this-repo/extensions/web-search.ts
```

## Requirements

- [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) installed and working
- `web-search.ts` requires one of: `TAVILY_API_KEY`, `BRAVE_API_KEY`, or `SERP_API_KEY`
- `files.ts` and `diff.ts` require VS Code (`code` CLI) for file opening
- `diff.ts` requires `git difftool` configured for VS Code
- `prompt-url-widget.ts` requires the [GitHub CLI](https://cli.github.com/) (`gh`)
- `squad/` requires pi to be available as a command (it spawns subprocesses)

## How Pi Extensions Work

Extensions are TypeScript modules that export a default function receiving an `ExtensionAPI` object. They are loaded via [jiti](https://github.com/unjs/jiti) — no compilation needed.

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Register tools the LLM can call
  pi.registerTool({ name: "my_tool", ... });

  // Register slash commands
  pi.registerCommand("my-cmd", { handler: async (args, ctx) => { ... } });

  // Subscribe to lifecycle events
  pi.on("tool_call", async (event, ctx) => { ... });
  pi.on("session_start", async (event, ctx) => { ... });
}
```

Key capabilities:
- **Custom tools** — `pi.registerTool()` registers tools callable by the LLM
- **Commands** — `pi.registerCommand()` adds `/slash-commands`
- **Event hooks** — `pi.on()` intercepts tool calls, session events, agent lifecycle
- **UI** — `ctx.ui` provides dialogs, widgets, status indicators, and custom TUI components
- **State** — `pi.appendEntry()` persists state across restarts
- **Shell** — `pi.exec()` runs shell commands

For the full extension API, see the [pi extensions documentation](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md).

## License

MIT
