#!/usr/bin/env bash
# PostToolUse hook: logs work-item activity to activity.jsonl
set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.hive/logs"
mkdir -p "$LOG_DIR"

INPUT=$(cat)

echo "$INPUT" | node -e "
const fs = require('fs');
const path = require('path');
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const projectDir = process.argv[1];
  const logDir = process.argv[2];
  const filePath = (data.tool_input || {}).file_path || '';
  // Only process work-item files (handle both / and \ separators)
  const normalized = filePath.replace(/\\\\/g, '/');
  if (!normalized.match(/\.hive\/work-items\/(?:feature-\w+_)?wi-/)) process.exit(0);
  // Read the actual file from disk
  const content = fs.readFileSync(filePath, 'utf8');
  const wi = JSON.parse(content);
  const history = wi.history || [];
  if (history.length === 0) process.exit(0);
  const last = history[history.length - 1];
  const entry = {
    ts: new Date().toISOString(),
    agent: last.agent || '',
    action: last.action || '',
    work_item: wi.id || '',
    status: wi.status || '',
    notes: last.notes || ''
  };
  fs.appendFileSync(logDir + '/activity.jsonl', JSON.stringify(entry) + '\n');
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\n'); }
" "${CLAUDE_PROJECT_DIR:-.}" "$LOG_DIR" 2>/dev/null || { echo "log-activity: hook failed" >&2; exit 0; }
