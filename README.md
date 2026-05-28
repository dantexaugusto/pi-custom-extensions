# Pi Extensions & Agent Groups

A collection of custom extensions, specialized agents, prompt templates, and workflows for the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

> [!NOTE]
> This repository has been restructured to serve as a **multi-group repository**. It houses different agent setups, custom tools, and experimental configurations. You can use it not only to install the initial agent configurations but also to **develop, update, and manage multiple independent agent groups** (such as specialized versions for OpenRouter, multi-model execution, or specific coding tasks).

---

## What is Pi?

[Pi](https://github.com/badlogic/pi-mono) is an interactive terminal coding agent that supports multiple LLM providers (OpenAI, Anthropic, Google, etc.). It can be extended through:

- **Extensions** — TypeScript modules that add tools, commands, event hooks, and custom UI
- **Skills** — Markdown-based capability packages loaded on demand
- **Prompt Templates** — Reusable prompts invoked via `/template-name`
- **Agents** — Markdown-defined agent profiles used by squad/subagent extensions for multi-agent orchestration

---

## Directory Structure

This repository is organized into independent **Agent Groups**:

```
├── subagentsV1/                     # V1 Agent Group (Core / Classic setup)
│   ├── extensions/
│   │   ├── files.ts                 # /files command — browse session files
│   │   ├── web-search.ts            # web_search + web_fetch tools
│   │   ├── diff.ts                  # /diff command — git diff viewer
│   │   ├── squad/                   # Classic multi-agent orchestration (squad tool)
│   │   │   ├── index.ts
│   │   │   └── agents.ts
│   │   ├── tps.ts                   # Tokens-per-second stats on each turn
│   │   ├── prompt-url-widget.ts     # Widget for PR/issue URL context
│   │   └── redraws.ts               # /tui command — TUI redraw stats
│   ├── agents/                      # Agent profiles for the squad extension
│   │   ├── scout.md
│   │   ├── planner.md
│   │   ├── frontend.md
│   │   ├── backend.md
│   │   ├── tester.md
│   │   └── reviewer.md
│   ├── prompts/                     # Prompt templates
│   │   ├── feature.md               # /feature — full feature workflow
│   │   ├── fullstack.md             # /fullstack — parallel frontend+backend
│   │   ├── implement-review.md      # /implement-review — implement, review, fix
│   │   ├── review.md                # /review — code review
│   │   ├── test.md                  # /test — write tests
│   │   ├── pr.md                    # /pr — structured PR review
│   │   ├── is.md                    # /is — GitHub issue analysis
│   │   ├── cl.md                    # /cl — changelog audit
│   │   └── wr.md                    # /wr — wrap up task (changelog, commit, push)
│   ├── skills/                      # Skills (on-demand reference for the LLM)
│   │   └── squad-workflows/
│   │       └── SKILL.md             # Squad agent and workflow reference
│   └── install.sh                   # Dynamic deploy script for V1
│
├── subagents_OpenRouter_multimodel/ # Multi-Model / OpenRouter Optimized Group
│   ├── extensions/
│   │   └── subagent/                # Specialized subagent orchestrator (subagent tool)
│   │       ├── index.ts
│   │       └── agents.ts
│   └── agents/                      # Agent profiles for OpenRouter
│       ├── scout.md
│       ├── planner.md
│       ├── worker.md
│       ├── tester.md
│       └── reviewer.md
```

---

## Developing and Adding New Agent Groups

This repository is designed to be easily extensible. If you want to create a new group of custom agents (e.g., `subagents_devops`, `subagents_data_science`, etc.):

1. Create a new directory in the root: `subagents_<your_group_name>/`.
2. Add your custom TS extensions under `extensions/` and markdown agents under `agents/`.
3. Add a dedicated `install.sh` inside your directory, modeled after `subagentsV1/install.sh`, to allow clean global installation.

---

## Agent Group Details

### 1. `subagentsV1` (Classic Group)
This group registers the `/files`, `/diff`, `/tui` commands and the `squad` tool.

* **Orchestration Tool**: `squad`
* **Workflow Templates**: `/feature`, `/fullstack`, `/implement-review`, `/review`, `/test`, `/pr`, `/is`, `/cl`, `/wr`
* **Agent Rosters**:
  | Agent | Model | Description |
  |-------|-------|-------------|
  | scout | Haiku (fast) | Codebase recon — finds relevant code and returns structured context |
  | planner | Sonnet | Creates implementation plans from context and requirements |
  | frontend | Sonnet | React, CSS, HTML, responsive design, accessibility |
  | backend | Sonnet | APIs, databases, server logic, authentication |
  | tester | Sonnet | Unit, integration, and e2e tests |
  | reviewer | Sonnet | Code review for quality, security, and performance |

### 2. `subagents_OpenRouter_multimodel` (OpenRouter Optimized)
This group is tailored for OpenRouter multi-model architectures.

* **Orchestration Tool**: `subagent`
* **Agent Rosters**:
  | Agent | Description |
  |-------|-------------|
  | scout | Finds relevant code and returns structured context |
  | planner | Prepares implementation plans |
  | worker | Implements full stack backend and frontend tasks |
  | tester | Authors test configurations and sweeps |
  | reviewer | Performs structured code and style review |

---

## Installation & Configuration

### Option 1: Install globally via script (Recommended)

To deploy the **`subagentsV1`** classic group globally:
```bash
./subagentsV1/install.sh
```
This dynamically copies V1 extensions, agents, prompts, and skills to your global `~/.pi/agent/` directory, where Pi will auto-discover them.

### Option 2: Copy to your project local directory

You can copy any agent group's folders into your project's `.pi/` directory to have them project-scoped:
```bash
# Example: Copying subagentsV1 to your project
cp -r subagentsV1/extensions/ /path/to/your/project/.pi/extensions/
cp -r subagentsV1/agents/ /path/to/your/project/.pi/agents/
cp -r subagentsV1/prompts/ /path/to/your/project/.pi/prompts/
```

### Option 3: Reference via settings.json

Point Pi to this repository's extensions dynamically via your project or global `settings.json`:

```json
{
  "extensions": [
    "/path/to/this-repo/subagentsV1/extensions/files.ts",
    "/path/to/this-repo/subagentsV1/extensions/web-search.ts",
    "/path/to/this-repo/subagentsV1/extensions/diff.ts",
    "/path/to/this-repo/subagentsV1/extensions/squad",
    "/path/to/this-repo/subagents_OpenRouter_multimodel/extensions/subagent"
  ]
}
```

Settings file locations:
* Project-local: `.pi/settings.json`
* Global: `~/.pi/agent/settings.json`

---

## Requirements

- [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) installed and working.
- `web-search.ts` (V1) requires one of: `TAVILY_API_KEY`, `BRAVE_API_KEY`, or `SERP_API_KEY`.
- `files.ts` and `diff.ts` require VS Code (`code` CLI) for file opening.
- `diff.ts` requires `git difftool` configured for VS Code.
- `prompt-url-widget.ts` requires the [GitHub CLI](https://cli.github.com/) (`gh`).
- `squad/` and `subagent/` require pi to be globally available as a command (they spawn subprocesses).

---

## License

MIT
