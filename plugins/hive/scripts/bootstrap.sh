#!/usr/bin/env bash
# Bootstrap hook: initializes .hive/ directory structure if it doesn't exist
set -euo pipefail

PROJ_DIR="${CLAUDE_PROJECT_DIR:-.}"
HIVE_DIR="$PROJ_DIR/.hive"

if [ -d "$HIVE_DIR" ]; then
  # Already initialized — run validation
  node -e "
const fs = require('fs');
const hiveDir = process.argv[1];
const files = [
  'work-items/_index.json', 'work-items/_sequence.json',
  'features/_index.json', 'features/_sequence.json',
  'agents/_index.json',
  'config.json'
];
let warnings = 0;
for (const f of files) {
  const p = hiveDir + '/' + f;
  if (!fs.existsSync(p)) { process.stderr.write('hive-bootstrap: missing ' + f + '\n'); warnings++; continue; }
  try { JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { process.stderr.write('hive-bootstrap: invalid JSON in ' + f + '\n'); warnings++; }
}
if (warnings > 0) process.stderr.write('hive-bootstrap: ' + warnings + ' warning(s)\n');
else process.stderr.write('hive-bootstrap: state valid\n');
" "$HIVE_DIR" 2>&1 || true
else
  # Full bootstrap
  mkdir -p "$HIVE_DIR/plans" "$HIVE_DIR/research" "$HIVE_DIR/work-items" \
           "$HIVE_DIR/features" "$HIVE_DIR/agents" "$HIVE_DIR/logs" "$HIVE_DIR/archive"

  printf '{\n  "items": []\n}\n' > "$HIVE_DIR/work-items/_index.json"
  printf '{\n  "next_id": 1\n}\n' > "$HIVE_DIR/work-items/_sequence.json"
  printf '{\n  "items": []\n}\n' > "$HIVE_DIR/features/_index.json"
  printf '{\n  "next_id": 1\n}\n' > "$HIVE_DIR/features/_sequence.json"
  printf '{\n  "agents": []\n}\n' > "$HIVE_DIR/agents/_index.json"

  printf '{\n  "name": "hive",\n  "version": "2.0.0",\n  "base_branch": "master"\n}\n' > "$HIVE_DIR/config.json"

  touch "$HIVE_DIR/logs/activity.jsonl" \
        "$HIVE_DIR/logs/communications.jsonl" \
        "$HIVE_DIR/logs/task-ledger.jsonl"

  touch "$HIVE_DIR/plans/.gitkeep" \
        "$HIVE_DIR/research/.gitkeep" \
        "$HIVE_DIR/archive/.gitkeep"

  echo "hive-bootstrap: initialized $HIVE_DIR" >&2
fi
