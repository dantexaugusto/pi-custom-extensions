#!/usr/bin/env bash
set -euo pipefail

PI_DIR="${HOME}/.pi/agent"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing OpenRouter multi-model custom extensions to ${PI_DIR}..."

# Extensions
mkdir -p "${PI_DIR}/extensions"
cp -r "${SCRIPT_DIR}/extensions/subagent" "${PI_DIR}/extensions/"

# Agents
mkdir -p "${PI_DIR}/agents"
cp "${SCRIPT_DIR}/agents/"*.md "${PI_DIR}/agents/"

echo "Done. Installed:"
echo "  Extensions → ${PI_DIR}/extensions/subagent/"
echo "  Agents     → ${PI_DIR}/agents/"
