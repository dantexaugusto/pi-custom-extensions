---
description: Implement with frontend or backend agent, review, then apply fixes
---
Use the squad tool with the chain parameter to execute this workflow:

1. First, use the most appropriate agent ("frontend" or "backend") to implement: $@
2. Then, use the "reviewer" agent to review the implementation (use {previous} placeholder)
3. Finally, use the same agent from step 1 to apply the reviewer's feedback (use {previous} placeholder)

Execute this as a chain, passing output between steps via {previous}.
Choose "frontend" if the task involves UI/components/styles, "backend" if it involves API/DB/server logic.
