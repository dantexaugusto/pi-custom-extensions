---
description: Full feature workflow - scout, plan, implement frontend+backend in parallel, then review
---
Use the squad tool with the chain parameter to execute this workflow:

1. First, use the "scout" agent to find all code relevant to: $@
2. Then, use the "planner" agent to create an implementation plan for "$@" using the context from the previous step (use {previous} placeholder)
3. Then, use the squad tool in parallel mode to run "frontend" and "backend" agents simultaneously, each receiving the plan from step 2 (use {previous} placeholder). Give each agent only the tasks relevant to their role from the plan.
4. Finally, use the "reviewer" agent to review all changes (use {previous} placeholder)

Execute steps 1-2 as a chain. Then use parallel mode for step 3. Then single mode for step 4.
If the planner indicates only frontend or only backend work is needed, skip the irrelevant agent.
