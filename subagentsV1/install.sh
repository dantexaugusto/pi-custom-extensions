#!/usr/bin/env bash
set -euo pipefail

PI_DIR="${HOME}/.pi/agent"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing pi custom extensions to ${PI_DIR}..."

# Extensions
mkdir -p "${PI_DIR}/extensions"
cp "${SCRIPT_DIR}/extensions/"*.ts "${PI_DIR}/extensions/"
cp -r "${SCRIPT_DIR}/extensions/squad" "${PI_DIR}/extensions/"

# Agents
mkdir -p "${PI_DIR}/agents"
cp "${SCRIPT_DIR}/agents/"*.md "${PI_DIR}/agents/"

# Prompts
mkdir -p "${PI_DIR}/prompts"
cp "${SCRIPT_DIR}/prompts/"*.md "${PI_DIR}/prompts/"

# Skills
mkdir -p "${PI_DIR}/skills"
cp -r "${SCRIPT_DIR}/skills/"* "${PI_DIR}/skills/"

echo "Done. Installed:"
echo "  Extensions → ${PI_DIR}/extensions/"
echo "  Agents     → ${PI_DIR}/agents/"
echo "  Prompts    → ${PI_DIR}/prompts/"
echo "  Skills     → ${PI_DIR}/skills/"
