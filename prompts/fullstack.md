---
description: Parallel frontend + backend implementation, then review
---
Use the squad tool to execute this workflow:

1. Run "frontend" and "backend" agents in parallel using the tasks parameter. Give each agent the relevant part of this task: $@
2. Then use the "reviewer" agent to review all changes from both agents (pass both outputs via {previous})

For step 1, split the requirements into frontend tasks (UI, components, styles) and backend tasks (API, database, server logic).
If the task is purely frontend or purely backend, use only the relevant agent.
