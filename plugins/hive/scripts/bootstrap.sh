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
  'config.json',
  'role-catalog.json'
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
" "$HIVE_DIR" || true
else
  # Auto-detect default branch (fallback to master)
  BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|.*/||')
  BASE_BRANCH="${BASE_BRANCH:-master}"

  # Full bootstrap
  mkdir -p "$HIVE_DIR/plans" "$HIVE_DIR/research" "$HIVE_DIR/work-items" \
           "$HIVE_DIR/features" "$HIVE_DIR/agents" "$HIVE_DIR/logs" "$HIVE_DIR/archive"

  printf '{\n  "items": []\n}\n' > "$HIVE_DIR/work-items/_index.json"
  printf '{\n  "next_id": 1\n}\n' > "$HIVE_DIR/work-items/_sequence.json"
  printf '{\n  "items": []\n}\n' > "$HIVE_DIR/features/_index.json"
  printf '{\n  "next_id": 1\n}\n' > "$HIVE_DIR/features/_sequence.json"
  printf '{\n  "agents": []\n}\n' > "$HIVE_DIR/agents/_index.json"

  printf '{\n  "name": "hive",\n  "version": "2.1.1",\n  "base_branch": "%s"\n}\n' "$BASE_BRANCH" > "$HIVE_DIR/config.json"

  # Default role catalog with specializations
  cat > "$HIVE_DIR/role-catalog.json" << 'CATALOG'
{
  "specializations": [
    {
      "name": "security",
      "base_role": "reviewer",
      "triggers": ["tag:auth", "tag:crypto", "tag:input-validation", "tag:secrets", "risk:high"],
      "brief": "Focus exclusively on security: authentication, authorization, input validation, injection attacks (SQL, XSS, command), cryptographic practices, secrets handling, SSRF, and path traversal. Ignore style and naming unless security-relevant.",
      "model": "opus"
    },
    {
      "name": "architecture",
      "base_role": "reviewer",
      "triggers": ["tag:new-module", "tag:refactor", "tag:architecture", "type:feature"],
      "brief": "Focus exclusively on architecture: coupling, cohesion, SOLID principles, dependency direction, module boundaries, scalability implications, and consistency with established codebase patterns. Ignore minor style issues.",
      "model": "opus"
    },
    {
      "name": "api-contract",
      "base_role": "reviewer",
      "triggers": ["tag:api", "tag:schema", "tag:breaking-change", "tag:graphql"],
      "brief": "Focus exclusively on API contracts: backward compatibility, versioning adherence, request/response schema changes, breaking change detection, REST conventions, and contract adherence for inter-service communication.",
      "model": "sonnet"
    },
    {
      "name": "performance",
      "base_role": "reviewer",
      "triggers": ["tag:performance", "tag:database", "tag:algorithm", "tag:concurrency"],
      "brief": "Focus exclusively on performance: algorithmic complexity (time/space), memory allocation patterns, concurrency correctness, I/O bottlenecks, N+1 query patterns, cache efficiency, and hot-path optimization.",
      "model": "sonnet"
    },
    {
      "name": "compliance",
      "base_role": "reviewer",
      "triggers": ["tag:compliance", "tag:gdpr", "tag:pci", "tag:hipaa", "tag:a11y", "tag:licensing"],
      "brief": "Focus exclusively on compliance: licensing compatibility (GPL vs MIT vs proprietary), accessibility standards (WCAG 2.1), data protection regulations (GDPR, PCI-DSS, HIPAA), and legal constraints on code usage.",
      "model": "sonnet"
    }
  ]
}
CATALOG

  touch "$HIVE_DIR/logs/activity.jsonl" \
        "$HIVE_DIR/logs/communications.jsonl" \
        "$HIVE_DIR/logs/task-ledger.jsonl"

  touch "$HIVE_DIR/plans/.gitkeep" \
        "$HIVE_DIR/research/.gitkeep" \
        "$HIVE_DIR/archive/.gitkeep"

  echo "hive-bootstrap: initialized $HIVE_DIR" >&2
fi
