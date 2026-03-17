#!/usr/bin/env bash
# PostToolUse hook: auto-commits .hive/ state changes after Write/Edit
set -euo pipefail

INPUT=$(cat)

MATCH=$(node -e "
try {
  const data = JSON.parse(process.argv[1]);
  const path = (data.tool_input || {}).file_path || '';
  console.log(path.includes('.hive/') || path.includes('.hive\\\\') ? 'yes' : 'no');
} catch (e) { console.log('no'); }
" "$INPUT" 2>/dev/null || echo "no")

if [ "$MATCH" = "yes" ]; then
  cd "${CLAUDE_PROJECT_DIR:-.}" && git add .hive/ && \
    git commit -m "hive: auto-state $(date -u +%Y-%m-%dT%H:%M:%SZ)" --no-verify 2>/dev/null || true
fi
