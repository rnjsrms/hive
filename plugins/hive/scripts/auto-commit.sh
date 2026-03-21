#!/usr/bin/env bash
# PostToolUse hook: auto-commits .hive/ state changes after Write/Edit
set -euo pipefail

INPUT=$(cat)

MATCH=$(echo "$INPUT" | node -e "
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const path = (data.tool_input || {}).file_path || '';
  console.log(/\.hive[\\/\\\\]/.test(path) ? 'yes' : 'no');
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\n'); console.log('no'); }
" 2>/dev/null || echo "no")

if [ "$MATCH" = "yes" ]; then
  cd "${CLAUDE_PROJECT_DIR:-.}" && \
    git add .hive/ 2>/dev/null && \
    # --no-verify: skip pre-commit hooks for automated state commits to avoid hook loops
    git commit -m "hive: auto-state $(date -u +%Y-%m-%dT%H:%M:%SZ)" --no-verify 2>/dev/null || true
fi
