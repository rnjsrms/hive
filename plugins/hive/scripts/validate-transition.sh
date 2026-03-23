#!/usr/bin/env bash
# PostToolUse hook: validates work item status transitions on wi-*.json writes
set -euo pipefail

INPUT=$(cat)

echo "$INPUT" | node -e "
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
try {
  const data = JSON.parse(fs.readFileSync(0, 'utf8'));
  const filePath = (data.tool_input || {}).file_path || '';
  const normalized = filePath.replace(/\\\\/g, '/');

  // Only process work-item files
  const match = normalized.match(/\.hive\/work-items\/[A-Z][A-Z0-9]+-\d+_WI-\d+\.json$/) || normalized.match(/\.hive\/work-items\/(?:feature-\w+_)?(wi-\d+)\.json$/);
  if (!match) process.exit(0);

  // Read the new file content from disk
  let newWi;
  try {
    newWi = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    process.exit(0);
  }
  const newStatus = newWi.status;
  if (!newStatus) process.exit(0);

  // Get the old status from git (last committed version)
  const projectDir = process.argv[1];
  const relPath = path.relative(projectDir, filePath).replace(/\\\\/g, '/');
  let oldStatus;
  try {
    const old = require('child_process').execFileSync('git', ['show', 'HEAD:' + relPath], { cwd: projectDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    oldStatus = JSON.parse(old).status;
  } catch (e) {
    // File is new (not in git yet) — no previous status to validate against
    process.exit(0);
  }
  if (!oldStatus) process.exit(0);

  // Same status — no transition, allow
  if (oldStatus === newStatus) process.exit(0);

  // Validate the transition using the state machine.
  // NOTE: This map duplicates src/state-machine.ts because bash hooks
  // cannot import TypeScript modules directly. Keep both in sync.
  const VALID_TRANSITIONS = {
    OPEN: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['REVIEW', 'BLOCKED', 'CANCELLED'],
    REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'CANCELLED'],
    APPROVED: ['TESTING', 'CANCELLED'],
    CHANGES_REQUESTED: ['IN_PROGRESS', 'CANCELLED'],
    TESTING: ['READY_TO_MERGE', 'TESTS_FAILED', 'CANCELLED'],
    TESTS_FAILED: ['IN_PROGRESS', 'CANCELLED'],
    READY_TO_MERGE: ['MERGED', 'CANCELLED'],
    BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
    MERGED: [],
    CANCELLED: []
  };

  const allowed = VALID_TRANSITIONS[oldStatus];
  if (!allowed) {
    process.stderr.write('validate-transition: unknown status \"' + oldStatus + '\"\\n');
    process.exit(2);
  }

  if (!allowed.includes(newStatus)) {
    process.stderr.write('validate-transition: invalid transition \"' + oldStatus + '\" → \"' + newStatus + '\"\\n');
    process.stderr.write('  allowed transitions from ' + oldStatus + ': ' + (allowed.length > 0 ? allowed.join(', ') : '(none — terminal state)') + '\\n');
    process.exit(2);
  }
} catch (e) { process.stderr.write('hive-hook: ' + e.message + '\\n'); }
" "${CLAUDE_PROJECT_DIR:-.}"

exit $?
