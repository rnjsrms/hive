# Hive

Hive is a multi-agent orchestration framework for Claude Code. It enables a team of
specialized AI agents to collaborate on software projects using structured workflows,
shared state files, and git-based coordination. Give it an objective and it handles
planning, task breakdown, implementation, review, and testing automatically.

## Quick Start

```bash
cd hive
claude
```

Then describe your objective. The lead agent will interview you to clarify requirements,
create a plan, spin up a team, and begin execution.

## How the Workflow Works

1. **Interview** -- The lead agent asks clarifying questions about your objective to
   understand scope, constraints, and priorities.
2. **Plan** -- A structured plan is created in `.hive/plans/` breaking the objective
   into work items with dependencies, risk levels, and acceptance criteria.
3. **Team** -- Agents are spawned for each role (developers, reviewer, tester,
   researcher) and registered in `.hive/agents/`.
4. **Execute** -- Developers pick up work items, implement on feature branches, and
   update status in `.hive/work-items/`. The lead coordinates via message passing.
5. **Validate** -- The reviewer checks code quality and the tester runs verification.
   Completion hooks enforce that items pass review and testing before merging.

## Architecture

Hive uses a role-based agent hierarchy:

| Role         | Responsibility                                          |
|--------------|---------------------------------------------------------|
| **Lead**     | Plans work, assigns tasks, coordinates the team         |
| **Developer**| Implements features on feature branches                 |
| **Reviewer** | Reviews code, approves or requests changes              |
| **Tester**   | Runs tests, verifies acceptance criteria                |
| **Researcher**| Investigates unknowns, spikes, and technical questions |

All agents communicate through structured messages and share state via `.hive/` files.

## Gitflow

Agents only work on feature branches, never directly on main. The typical flow:

- Lead creates a feature branch for each work item (e.g., `feature/wi-{id}-{slug}`)
- Developer implements on that branch
- Reviewer and tester validate the branch
- Lead marks branches as ready to merge when all checks pass
- You merge into main at your discretion

## Checking Status

All project state lives in `.hive/`:

- `.hive/work-items/_index.json` -- list of all work items and their status
- `.hive/convoys/_index.json` -- active execution groups
- `.hive/agents/_index.json` -- registered agents and their roles
- `.hive/plans/` -- planning documents
- `.hive/research/` -- research findings from the researcher agent (topic-based markdown files)
- `.hive/archive/` -- archived (completed or abandoned) convoys
- `.hive/logs/activity.jsonl` -- general activity log (heartbeats, milestones, state transitions)
- `.hive/logs/communications.jsonl` -- inter-agent message log
- `.hive/logs/task-ledger.jsonl` -- task creation and update log
- `.hive/logs/decisions.jsonl` -- lead's architectural decision records (tech choices, scope changes, conflict resolutions)
- `.hive/logs/autoresearch.jsonl` -- AutoResearch iteration log (metric deltas, outcomes per iteration)

## AutoResearch Mode

AutoResearch is a continuous, metric-driven improvement loop. Activate it by giving the
lead a target metric and value (e.g., "increase test coverage to 90%", "reduce lint
violations to zero").

The system runs a 7-phase loop: MEASURE → IDENTIFY → PROPOSE → IMPLEMENT → VALIDATE →
LOG → MERGE/REVERT. Each iteration targets a single atomic change. Changes that don't
improve the metric are automatically reverted. Progress is logged to
`.hive/logs/autoresearch.jsonl`.

### Concurrency protection

Before starting an iteration, the lead checks `.hive/metrics.json` for
`autoresearch_status`. If the value is `"running"`, the cycle is skipped to prevent
overlapping iterations (git conflicts, race conditions on state files). The field is set
to `"running"` at iteration start and `"idle"` at iteration end (or on error/revert).

```json
{
  "autoresearch_status": "running",
  "autoresearch_iteration": 5,
  "autoresearch_started_at": "2026-03-21T05:00:00Z"
}
```

If `autoresearch_status` is `"running"` but `autoresearch_started_at` is older than
15 minutes, the iteration is assumed crashed and the status is reset to `"idle"`.

### Guard constraints

- 15-minute per-iteration budget (stale lock auto-cleared)
- Auto-stop after 3 consecutive reverts

## Resuming After a Crash

If a session is interrupted, just start Claude again:

```bash
cd hive
claude
```

The lead agent detects in-progress convoys and work items by reading `.hive/` state
files. It validates file integrity (skipping corrupt entries rather than crashing),
handles multiple active convoys by picking the most recent, and resumes where it left
off -- reassigning stalled work items and continuing the active plan.

## Ready-to-Merge Branches

When work items pass review and testing, the lead updates their status to
`ready-to-merge`. Check for branches ready to merge:

```bash
cat .hive/work-items/_index.json | python3 -c "
import json, sys
items = json.load(sys.stdin).get('items', [])
for i in items:
    if i.get('status') == 'ready-to-merge':
        print(f\"{i.get('id')}: {i.get('title')} -> {i.get('branch')}\")
"
```

Or simply ask the lead agent to list branches ready for merge.

## Operational Guidance

### Stuck Work Items

If a work item appears stuck (no progress for >10 minutes):
1. Check `.hive/logs/activity.jsonl` for the last heartbeat from the assigned agent.
2. The lead's health-check cron (every 3 minutes) automatically pings stale agents
   and re-spawns dead ones. You can also ask the lead directly: "What's the status of WI-NNNN?"
3. If an agent is truly stuck, the lead will re-assign the work item to another developer.

### Cancelling a Convoy

Ask the lead: "Cancel the current convoy." It will:
1. Set all open/in-progress work items to `cancelled`.
2. Set the convoy status to `cancelled`.
3. Shut down all agents.
4. Archive the convoy to `.hive/archive/`.

### Handling Merge Conflicts

If a developer reports a merge conflict:
1. The lead routes the conflict back to the developer with resolution guidance.
2. The developer rebases onto the latest base branch and resolves conflicts.
3. After resolving, the developer re-submits for review.
4. If conflicts persist after 30 minutes, the lead escalates to you.

## Hooks

Hive uses Claude Code hooks (configured in `plugins/hive/hooks/hooks.json`) to:

- **Log communications** between agents to `communications.jsonl`
- **Log task changes** (create/update) to `task-ledger.jsonl`
- **Auto-commit** `.hive/` state changes to git after each write
- **Validate completion** ensuring work items pass review and testing
- **Send notifications** via Windows desktop notifications

### Hook Debugging Tips

If hooks aren't firing as expected:

1. **Check `plugins/hive/hooks/hooks.json`** — Verify hook matchers
   are correct (`SendMessage`, `TaskCreate|TaskUpdate`, `Write|Edit`).
2. **Test scripts manually** — Run a script with sample JSON piped to stdin:
   ```bash
   echo '{"tool_input":{"file_path":".hive/test.json"}}' | bash plugins/hive/scripts/auto-commit.sh
   ```
3. **Check script permissions** — Scripts must be executable: `chmod +x plugins/hive/scripts/*.sh`
4. **Review stderr** — Hook scripts write errors to stderr. Check Claude Code's
   output for hook failure messages.
5. **Node.js required** — All hook scripts use `node -e` for JSON parsing. Ensure
   Node.js v16+ is on `$PATH`.
6. **Path issues on Windows** — Scripts use `${CLAUDE_PROJECT_DIR:-.}`. If this
   variable isn't set, scripts default to the current directory.

## Development

### Prerequisites

- Node.js 16+
- npm
- Git
- Bash (for integration tests; Git Bash on Windows)

### Setup

```bash
cd hive
npm install
```

### Running Tests

```bash
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report (90% threshold enforced)
npm run test:unit         # Unit tests only (src/ module logic)
npm run test:integration  # Integration tests (real script execution)
npm run test:schema       # Schema validation tests (JSON schemas + config files)
npm run test:agents       # Agent prompt validation (frontmatter, structure, consistency)
npm run typecheck         # TypeScript type checking (zero errors required)
npm run ci                # All checks: typecheck + tests + coverage (use in CI pipelines)
```

### Test Architecture

| Category | Dir | Tests | What it validates |
|----------|-----|-------|-------------------|
| **Unit** | `tests/unit/` | ~100 | Pure function logic in `src/*.ts` modules |
| **Integration** | `tests/integration/` | ~35 | Real bash/powershell script execution with temp dirs |
| **Schema** | `tests/schema/` | ~65 | JSON schemas, config file validation, version consistency |
| **Agents** | `tests/agents/` | ~75 | YAML frontmatter, markdown structure, cross-agent consistency |

### Source Modules

The `src/` directory contains TypeScript modules that mirror the inline JavaScript
in `plugins/hive/scripts/*.sh`. These enable unit testing of hook logic without
executing bash. Mirror tests in `tests/integration/module-script-mirror.test.ts`
verify the modules stay in sync with the actual scripts.

### Commit Conventions

```
feat:     New features (test infrastructure, schemas)
fix:      Bug fixes (audit issues)
test:     Adding/updating tests
refactor: Code restructuring (JS extraction)
docs:     Documentation updates
chore:    Maintenance (gitignore, config, metrics)
```
