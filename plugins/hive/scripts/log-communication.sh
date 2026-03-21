#!/usr/bin/env bash
# PostToolUse hook: logs SendMessage calls to communications.jsonl
set -euo pipefail

LOG_DIR="${CLAUDE_PROJECT_DIR:-.}/.hive/logs"
mkdir -p "$LOG_DIR"

INPUT=$(cat)

echo "$INPUT" | node -e "
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const logDir = process.argv[1];
  let message = (data.tool_input || {}).message || '';
  // Stringify if message is a structured object (e.g., protocol messages)
  if (typeof message === 'object') message = JSON.stringify(message);
  // Safety ceiling to prevent unbounded log growth
  if (message.length > 100000) message = message.substring(0, 100000) + '...[safety-truncated]';
  // Parse sender identity from [hive:xxx] tag in message content
  const fromMatch = typeof message === 'string' ? message.match(/\[hive:([^\]]+)\]/) : null;
  const from = fromMatch ? fromMatch[1] : '';
  const summary = (data.tool_input || {}).summary || '';
  const entry = {
    ts: new Date().toISOString(),
    session_id: data.session_id || '',
    from: from,
    to: (data.tool_input || {}).to || '',
    summary: summary,
    message: message
  };
  fs.appendFileSync(logDir + '/communications.jsonl', JSON.stringify(entry) + '\n');
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\n'); }
" "$LOG_DIR" 2>/dev/null || true
