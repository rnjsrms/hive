#!/usr/bin/env bash
# TeammateIdle hook: checks for unassigned open work items
set -euo pipefail

INDEX="${CLAUDE_PROJECT_DIR:-.}/.hive/work-items/_index.json"
[ -f "$INDEX" ] || exit 0

RESULT=$(node -e "
const fs = require('fs');
try {
  const items = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).items || [];
  const unassigned = items.filter(i => i.status === 'open' && i.assignee == null);
  console.log(unassigned.length > 0 ? 'found' : 'none');
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\n'); console.log('none'); }
" "$INDEX" 2>/dev/null || echo "none")

if [ "$RESULT" = "found" ]; then
  echo "Unassigned work items available. Check with lead for your next task." >&2
  exit 2
fi
exit 0
