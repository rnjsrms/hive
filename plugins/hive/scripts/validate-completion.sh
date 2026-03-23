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
  // Supports both "wi-123" and "feature-42_wi-123" formats
  if (!wiId) {
    const match = subject.match(/[A-Z][A-Z0-9]+-\d+_WI-\d+/) || subject.match(/(?:feature-\w+_)?WI-\d+/i);
    if (match) wiId = match[0];
  }

  if (!wiId) process.exit(0);

  let wiFile = path.join(wiDir, wiId + '.json');
  if (!fs.existsSync(wiFile)) {
    // Try case-insensitive match, supporting both wi-N.json and feature-X_wi-N.json
    const wiIdLower = wiId.toLowerCase();
    const files = fs.readdirSync(wiDir).filter(f => {
      const fl = f.toLowerCase();
      return fl === wiIdLower + '.json' || fl.endsWith('_' + wiIdLower + '.json');
    });
    if (files.length > 0) wiFile = path.join(wiDir, files[0]);
    else process.exit(0);
  }

  const wi = JSON.parse(fs.readFileSync(wiFile, 'utf8'));
  const errors = [];

  // Valid WI statuses that indicate completion gates have been reached
  const validStatuses = ['READY_TO_MERGE', 'MERGED'];
  if (!validStatuses.includes(wi.status || ''))
    errors.push('Work item status is \"' + (wi.status || '') + '\", must be \"READY_TO_MERGE\" or \"MERGED\"');

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
" "$HIVE_DIR"

exit $?
