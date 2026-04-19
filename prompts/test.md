---
description: Write tests for specified code or recent changes
---
Use the squad tool with the chain parameter:

1. First, use the "scout" agent to find the code and existing test patterns relevant to: $@
2. Then, use the "tester" agent to write tests based on the scout's findings (use {previous} placeholder)

Execute this as a chain, passing output between steps via {previous}.
