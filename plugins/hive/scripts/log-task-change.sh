#!/usr/bin/env bash
# PostToolUse hook: logs TaskCreate/TaskUpdate calls to task-ledger.jsonl
set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.hive/logs"
mkdir -p "$LOG_DIR"

INPUT=$(cat)

echo "$INPUT" | node -e "
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const logDir = process.argv[1];
  let output = data.tool_output || '';
  if (typeof output === 'object') output = JSON.stringify(output);
  const entry = {
    ts: new Date().toISOString(),
    tool: data.tool_name || '',
    input: data.tool_input || {},
    output: output
  };
  fs.appendFileSync(logDir + '/task-ledger.jsonl', JSON.stringify(entry) + '\n');
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\n'); }
" "$LOG_DIR" 2>/dev/null || true
