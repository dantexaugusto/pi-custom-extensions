#!/bin/bash
# Setup alias for pi-with-persistence

echo "Adding alias to shell configuration..."

# Detect shell
if [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
else
    SHELL_RC="$HOME/.profile"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cat >> "$SHELL_RC" << EOF

# Pi with full persistence (added by setup-alias.sh)
alias pi-persistent='pi --system-prompt @$SCRIPT_DIR/PERSISTENCE_SYSTEM_PROMPT.md'
EOF

echo "Alias added to $SHELL_RC"
echo ""
echo "Usage:"
echo "  source $SHELL_RC"
echo "  pi-persistent"
echo ""
echo "Or directly:"
echo "  pi --system-prompt @$SCRIPT_DIR/PERSISTENCE_SYSTEM_PROMPT.md"
