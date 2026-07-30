# subagents_Bedrock_multimodel

Multi-model agent group optimized for **AWS Bedrock** — the same orchestration architecture as `subagents_OpenRouter_multimodel`, but using Amazon Bedrock's native model IDs.

## Overview

This agent group provides specialized subagents, each configured with a specific Bedrock model optimized for its task:

| Agent | Bedrock Model | Description | Use Case |
|-------|---------------|-------------|----------|
| **scout** | `us.anthropic.claude-sonnet-5-20251022-v2:0` | Fast codebase reconnaissance | Quick exploration, finding files |
| **planner** | `us.anthropic.claude-sonnet-5-20251022-v2:0` | Creates implementation plans | Architecture planning, task breakdown |
| **worker** | `us.anthropic.claude-opus-5-20252001-v1:0` | Full-capability implementation | Code writing, refactoring, complex tasks |
| **tester** | `us.anthropic.claude-sonnet-5-20251022-v2:0` | Test writing and execution | Unit tests, integration tests, TDD |
| **reviewer** | `us.anthropic.claude-sonnet-5-20251022-v2:0` | Code review specialist | Quality analysis, security review |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Pi Session                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              'subagent' Tool                       │    │
│  │  ┌───────┬───────┬────────┬────────┬─────────┐   │    │
│  │  │scout  │planner│ worker │ tester │ reviewer│   │    │
│  │  │(fast) │(plan) │(code)  │(test)  │(review) │   │    │
│  │  └───┬───┴───┬───┴───┬────┴───┬────┴────┬────┘   │    │
│  │      │       │       │        │         │        │    │
│  │      └───────┴───────┴────────┴─────────┘        │    │
│  │                    JSON Mode                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                    ↓ Spawn isolated processes
        ┌───────────────────────────────────────┐
        │    Each subagent: pi --mode json    │
        │    • Dedicated model via --model      │
        │    • Isolated context window          │
        │    • Streaming results back           │
        └───────────────────────────────────────┘
```

## Model Selection Rationale

### Claude Sonnet v2 (scout, planner, tester, reviewer)
- **Cost-effective** for high-volume tasks
- **Fast** inference for exploration and planning
- **Strong** at following instructions and structured output
- **Good** for code review and test generation

### Claude Opus v1 (worker)
- **Most capable** at complex coding tasks
- **Best** at understanding large codebases
- **Excellent** for multi-step implementation
- **Worth the cost** for critical coding work

## Prerequisites

1. **AWS CLI configured** with credentials that have Bedrock access:
   ```bash
   aws configure
   ```

2. **Bedrock model access** enabled in your AWS account:
   - Go to AWS Console → Bedrock → Model access
   - Enable: Anthropic Claude Sonnet v2, Claude Opus v1

3. **Environment variables** (optional but recommended):
   ```bash
   export AWS_REGION=us-east-1  # or your preferred region
   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   ```

## Installation

```bash
# From this directory
./install.sh
```

This will copy agents and extensions to `~/.pi/agent/`.

## Usage

### Single Agent
```json
{
  "agent": "scout",
  "task": "Find all authentication-related files in this codebase"
}
```

### Parallel Execution
```json
{
  "tasks": [
    {"agent": "worker", "task": "Implement user login endpoint", "cwd": "./backend"},
    {"agent": "worker", "task": "Create login form component", "cwd": "./frontend"}
  ]
}
```

### Chain (Sequential with Context)
```json
{
  "chain": [
    {"agent": "scout", "task": "Find the payment processing module"},
    {"agent": "planner", "task": "Plan refactoring of {previous} to support Stripe"},
    {"agent": "worker", "task": "Implement the plan from {previous}"},
    {"agent": "reviewer", "task": "Review the changes from {previous}"}
  ]
}
```

### Project-Local Agents
```json
{
  "agent": "custom-agent",
  "task": "...",
  "agentScope": "both"
}
```

## Comparison: Bedrock vs OpenRouter

| Aspect | Bedrock | OpenRouter |
|--------|---------|------------|
| **Latency** | Lower (direct AWS) | Higher (proxy) |
| **Cost** | AWS pricing | Marked up |
| **Reliability** | Enterprise SLA | Best effort |
| **Model variety** | Limited to Bedrock | 100+ models |
| **Private data** | Stays in AWS | Goes to OpenRouter |
| **Setup** | AWS credentials needed | API key only |

## Troubleshooting

### "Model not found"
- Check that the model is enabled in AWS Bedrock console
- Verify your AWS region supports the model
- Try with region prefix: `bedrock/<region>.anthropic.claude-...`

### "Access denied"
- Ensure IAM user/role has `bedrock:InvokeModel` permission
- Check AWS credentials are valid: `aws sts get-caller-identity`

### Slow responses
- Bedrock has rate limits; consider requesting increased quotas
- Sonnet is faster than Opus for simpler tasks

## Files

```
subagents_Bedrock_multimodel/
├── agents/
│   ├── scout.md      # Fast exploration
│   ├── planner.md    # Implementation planning
│   ├── worker.md     # Full coding capabilities
│   ├── tester.md     # Test generation
│   └── reviewer.md   # Code review
├── extensions/
│   └── subagent/
│       ├── index.ts  # Main orchestration logic
│       └── agents.ts # Agent discovery
├── install.sh        # Installation script
└── README.md         # This file
```

## License

MIT (same as parent repository)
