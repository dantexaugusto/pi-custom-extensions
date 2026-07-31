#!/bin/bash
# Install script for subagents_Bedrock_multimodel
# Deploys Bedrock-optimized multi-model agent group to global ~/.pi/agent/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$HOME/.pi/agent"

echo "=== Installing subagents_Bedrock_multimodel ==="
echo "Source: $SCRIPT_DIR"
echo "Target: $TARGET_DIR"
echo ""

# Create target directories
mkdir -p "$TARGET_DIR/agents"
mkdir -p "$TARGET_DIR/extensions"

# Copy agents
echo "📋 Copying agents..."
for agent_file in "$SCRIPT_DIR/agents"/*.md; do
    if [ -f "$agent_file" ]; then
        cp "$agent_file" "$TARGET_DIR/agents/"
        echo "   ✓ $(basename "$agent_file")"
    fi
done

# Copy extensions
echo ""
echo "🔧 Copying extensions..."
if [ -d "$SCRIPT_DIR/extensions/subagent" ]; then
    rm -rf "$TARGET_DIR/extensions/subagent" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/extensions/subagent" "$TARGET_DIR/extensions/"
    echo "   ✓ subagent/"
fi

# Copy widgets
if [ -f "$SCRIPT_DIR/extensions/subagent-cost-widget.ts" ]; then
    cp "$SCRIPT_DIR/extensions/subagent-cost-widget.ts" "$TARGET_DIR/extensions/"
    echo "   ✓ subagent-cost-widget.ts"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Agents installed:"
ls -1 "$TARGET_DIR/agents"/*.md 2>/dev/null | while read f; do
    name=$(basename "$f" .md)
    echo "   • $name"
done
echo ""
echo "Extensions installed:"
ls -1 "$TARGET_DIR/extensions"/*.ts 2>/dev/null | while read f; do
    name=$(basename "$f")
    echo "   • $name"
done || true
echo ""
echo "Models configured:"
echo "   • scout    -> bedrock/us.anthropic.claude-sonnet-5-20251022-v2:0"
echo "   • planner  -> bedrock/us.anthropic.claude-sonnet-5-20251022-v2:0"
echo "   • worker   -> bedrock/us.anthropic.claude-opus-5-20252001-v1:0"
echo "   • tester   -> bedrock/us.anthropic.claude-sonnet-5-20251022-v2:0"
echo "   • reviewer -> bedrock/us.anthropic.claude-sonnet-5-20251022-v2:0"
echo ""
echo "Requirements:"
echo "   • AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)"
echo "   • Bedrock models enabled in your AWS account"
echo ""
echo "Usage:"
echo "   The 'subagent' tool is now available. Use it with:"
echo '      { "agent": "scout", "task": "explore codebase" }'
echo '      { "tasks": [{"agent": "worker", "task": "..."}, ...] }  // parallel'
echo '      { "chain": [{"agent": "planner", "task": "..."}, ...] }   // sequential'
