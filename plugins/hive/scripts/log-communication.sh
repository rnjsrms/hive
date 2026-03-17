#!/usr/bin/env bash
# PostToolUse hook: logs SendMessage calls to communications.jsonl
set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.hive/logs"
mkdir -p "$LOG_DIR"

INPUT=$(cat)

node -e "
const fs = require('fs');
try {
  const data = JSON.parse(process.argv[1]);
  const entry = {
    ts: new Date().toISOString(),
    session_id: data.session_id || '',
    to: (data.tool_input || {}).to || '',
    message: (data.tool_input || {}).message || ''
  };
  fs.appendFileSync(process.argv[2] + '/communications.jsonl', JSON.stringify(entry) + '\n');
} catch (e) {}
" "$INPUT" "$LOG_DIR" 2>/dev/null || true
