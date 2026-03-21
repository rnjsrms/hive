#!/usr/bin/env bash
# TaskCompleted hook: validates work item status before allowing completion
set -euo pipefail

HIVE_DIR="${CLAUDE_PROJECT_DIR:-.}/.hive"
INPUT=$(cat)

echo "$INPUT" | node -e "
const fs = require('fs'), path = require('path');
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const wiDir = path.join(process.argv[1], 'work-items');
  const taskInput = data.tool_input || {};

  // Try to extract a work item ID from metadata, subject, or description
  const subject = taskInput.subject || '';
  const metadata = taskInput.metadata || {};
  let wiId = metadata.work_item_id || taskInput.work_item_id || taskInput.id || '';

  // Fallback: try to extract WI ID from subject via regex (case-insensitive)
  if (!wiId) {
    const match = subject.match(/WI-\d+/i);
    if (match) wiId = match[0];
  }

  if (!wiId) process.exit(0);

  let wiFile = path.join(wiDir, wiId + '.json');
  if (!fs.existsSync(wiFile)) {
    const files = fs.readdirSync(wiDir).filter(f => f === wiId.toLowerCase() + '.json');
    if (files.length > 0) wiFile = path.join(wiDir, files[0]);
    else process.exit(0);
  }

  const wi = JSON.parse(fs.readFileSync(wiFile, 'utf8'));
  const errors = [];

  // Valid WI statuses that indicate completion gates have been reached
  const validStatuses = ['ready-to-merge', 'merged'];
  if (!validStatuses.includes(wi.status || ''))
    errors.push('Work item status is \"' + (wi.status || '') + '\", must be \"ready-to-merge\" or \"merged\"');

  const history = wi.history || [];
  if (!history.some(h => h.action === 'TESTS_PASS'))
    errors.push('Missing tester TESTS_PASS entry in history');
  if (!history.some(h => h.action === 'APPROVED'))
    errors.push('Missing reviewer APPROVED entry in history');

  if (errors.length > 0) {
    process.stderr.write(errors.join('\\n') + '\\n');
    process.exit(2);
  }
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\n'); }
" "$HIVE_DIR" 2>/dev/null

exit $?
