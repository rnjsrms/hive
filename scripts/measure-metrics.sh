#!/usr/bin/env bash
# Hive continuous improvement: measure current metrics
# Returns JSON with test counts, coverage, and quality indicators
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Run tests and capture output
TEST_OUTPUT=$(npx vitest run 2>&1 || true)
TEST_PASS=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' || echo "0")
TEST_FAIL=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= failed)' || echo "0")
TEST_FILES=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' | head -1 || echo "0")

# Run coverage
COV_OUTPUT=$(npx vitest run --coverage 2>&1 || true)
COV_STMTS=$(echo "$COV_OUTPUT" | grep "All files" | awk '{print $4}' || echo "0")
COV_BRANCH=$(echo "$COV_OUTPUT" | grep "All files" | awk '{print $6}' || echo "0")
COV_FUNCS=$(echo "$COV_OUTPUT" | grep "All files" | awk '{print $8}' || echo "0")
COV_LINES=$(echo "$COV_OUTPUT" | grep "All files" | awk '{print $10}' || echo "0")

# Count source issues (lint-style checks)
EMPTY_CATCHES=$(grep -r "catch.*{}" src/ plugins/hive/scripts/ 2>/dev/null | wc -l || echo "0")
TODO_COUNT=$(grep -ri "TODO\|FIXME\|HACK\|XXX" src/ plugins/hive/ 2>/dev/null | wc -l || echo "0")

# Output as JSON
node -e "
console.log(JSON.stringify({
  ts: new Date().toISOString(),
  tests: { pass: parseInt('${TEST_PASS}') || 0, fail: parseInt('${TEST_FAIL}') || 0 },
  coverage: { stmts: parseFloat('${COV_STMTS}') || 0, branch: parseFloat('${COV_BRANCH}') || 0, funcs: parseFloat('${COV_FUNCS}') || 0, lines: parseFloat('${COV_LINES}') || 0 },
  quality: { empty_catches: parseInt('${EMPTY_CATCHES}') || 0, todos: parseInt('${TODO_COUNT}') || 0 }
}, null, 2));
"
