#!/usr/bin/env bash
# PostToolUse hook (matcher: TaskUpdate): validates work item completion gates
# Fires on every TaskUpdate call. Checks if a work item is being marked as
# completed/ready-to-merge and enforces that review + testing gates are met.
set -euo pipefail

HIVE_DIR="${CLAUDE_PROJECT_DIR:-.}/.hive"
INPUT=$(cat)

node -e "
const fs = require('fs'), path = require('path');
try {
  const data = JSON.parse(process.argv[1]);
  const hiveDir = process.argv[2];
  const wiDir = path.join(hiveDir, 'work-items');

  // PostToolUse format: data.tool_input contains the TaskUpdate parameters
  // and data.tool_output contains the result
  const taskInput = data.tool_input || {};

  // Try to extract a work item ID from metadata, subject, or description
  const subject = taskInput.subject || '';
  const description = taskInput.description || '';
  const status = taskInput.status || '';
  const metadata = taskInput.metadata || {};
  let wiId = metadata.work_item_id || '';

  // Fallback: try to extract WI ID from subject via regex
  if (!wiId) {
    const match = subject.match(/WI-\d+/);
    if (match) wiId = match[0];
  }

  // Only validate when status is being set to 'completed' (Claude Code task status)
  // This maps to WI statuses: ready-to-merge, done, or merged
  if (status !== 'completed') process.exit(0);
  if (!wiId) process.exit(0);

  // Find the work item file
  let wiFile = path.join(wiDir, wiId + '.json');
  if (!fs.existsSync(wiFile)) {
    // Try with WI- prefix variations
    const files = fs.readdirSync(wiDir).filter(f => f.includes(wiId) && !f.startsWith('_'));
    if (files.length > 0) wiFile = path.join(wiDir, files[0]);
    else process.exit(0);
  }

  const wi = JSON.parse(fs.readFileSync(wiFile, 'utf8'));
  const errors = [];

  // Valid WI statuses that indicate completion gates have been reached
  const validStatuses = ['ready-to-merge', 'done', 'merged'];
  if (!validStatuses.includes(wi.status || ''))
    errors.push('Work item status is \"' + (wi.status || '') + '\", must be \"ready-to-merge\", \"done\", or \"merged\"');

  const history = JSON.stringify(wi.history || []);
  if (!history.includes('TESTS_PASS'))
    errors.push('Missing tester TESTS_PASS entry in history');
  if (wi.risk === 'high' && !history.includes('APPROVED'))
    errors.push('High-risk item missing reviewer APPROVED entry in history');

  if (errors.length > 0) {
    process.stderr.write(errors.join('\\n') + '\\n');
    process.exit(2);
  }
} catch (e) { /* allow on parse errors — don't block unrelated TaskUpdate calls */ }
" "$INPUT" "$HIVE_DIR" 2>/dev/null

exit $?
