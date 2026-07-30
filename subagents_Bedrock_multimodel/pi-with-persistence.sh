#!/bin/bash
# Pi with Full Persistence - Wrapper script
# Automatically loads the persistence-aware system prompt

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/PERSISTENCE_SYSTEM_PROMPT.md"

if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: System prompt file not found: $PROMPT_FILE"
    exit 1
fi

# Run pi with custom system prompt
exec pi --system-prompt "@$PROMPT_FILE" "$@"
