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

# Copy web-search extension
if [ -f "$SCRIPT_DIR/extensions/web-search.ts" ]; then
    cp "$SCRIPT_DIR/extensions/web-search.ts" "$TARGET_DIR/extensions/"
    echo "   ✓ web-search.ts"
fi

# Copy kiro-subagent extension
if [ -f "$SCRIPT_DIR/extensions/kiro-subagent.ts" ]; then
    cp "$SCRIPT_DIR/extensions/kiro-subagent.ts" "$TARGET_DIR/extensions/"
    echo "   ✓ kiro-subagent.ts"
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
echo "   • scout    -> bedrock/deepseek.v3.2"
echo "   • planner  -> bedrock/qwen.qwen3-coder-next"
echo "   • worker   -> bedrock/us.anthropic.claude-opus-4-5-20251101-v1:0"
echo "   • tester   -> bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0"
echo "   • reviewer -> bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0"
echo "   • langgraph -> bedrock/us.anthropic.claude-opus-4-5-20251101-v1:0"
echo "   • kiro     -> (uses kiro CLI)"
echo ""
echo "Requirements:"
echo "   • AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)"
echo "   • Bedrock models enabled in your AWS account"
echo "   • For web-search: TAVILY_API_KEY in ~/.secrets/ or env var"
echo "   • For kiro: Install with 'curl -fsSL https://cli.kiro.dev/install | bash'"
echo ""
echo "Usage:"
echo "   The 'subagent' tool is now available. Use it with:"
echo '      { "agent": "scout", "task": "explore codebase" }'
echo '      { "tasks": [{"agent": "worker", "task": "..."}, ...] }  // parallel'
echo '      { "chain": [{"agent": "planner", "task": "..."}, ...] }   // sequential'
