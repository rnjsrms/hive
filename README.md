# Hive

Hive is an AI-powered multi-agent system for Claude Code. You describe what you want to build, and Hive assembles a team of specialized AI agents that plan, code, review, test, and deliver it — all coordinated automatically.

## Installation

```bash
# Install the hive plugin for Claude Code
claude plugin install ~/hive/plugins/hive --scope user

# Or test it locally without installing
claude --plugin-dir ~/hive/plugins/hive
```

Once installed, every `claude` session starts as the Hive lead agent. Just describe your objective and Hive takes it from there.

## Your First Project

```bash
cd my-project
claude
```

Then type something like:

> "Add user authentication with JWT tokens, login/logout endpoints, and password hashing."

Hive will:
1. Ask you 10-15 clarifying questions about scope, tech stack, and priorities
2. Create a detailed plan broken into work items
3. Spin up a team of agents (developers, reviewer, tester)
4. Implement everything on isolated branches
5. Review and test each piece
6. Report when branches are ready for you to merge

You stay in control — Hive asks for your sign-off on the plan before writing any code, and you decide when to merge.

## How It Works

Hive follows a structured workflow with 7 phases:

### Phase 1: Interview

The lead agent asks you questions to understand your objective.

```
[hive:lead] Tell me about the feature you'd like to build.
What framework are you using? Any authentication preferences?
What's the priority — security, speed, or simplicity?
```

### Phase 2: Plan

Hive spawns a researcher to investigate your codebase, then creates a detailed plan with work items.

```
[hive:lead] Here's the plan:

Work Items:
  WI-1: Add JWT token generation and validation
  WI-2: Create login endpoint with password hashing
  WI-3: Create logout endpoint with token blacklisting

Shall I proceed?
```

### Phase 3: Team Spawn

Hive creates a feature branch and assembles a team.

```
[hive:lead] Creating feature branch: feature-1
Spawning monitor agent... ✓
Spawning developer for feature-1_wi-1... ✓
```

### Phase 4: Execute

Developers implement each work item on isolated branches. Each developer works in its own git worktree so there are no conflicts.

```
[hive:dev-1] [IN_PROGRESS] feature-1_wi-1: Implementing JWT token generation...
[hive:dev-1] [REVIEW] feature-1_wi-1: Ready for review. Added token.ts with sign/verify functions and unit tests.
```

### Phase 5: Review & Test

After each developer finishes, Hive automatically spawns a reviewer and then a tester.

```
[hive:reviewer] [APPROVED] feature-1_wi-1: Code quality is good. Token expiry handling is solid.
[hive:tester] [TESTS_PASS] feature-1_wi-1: All 12 tests pass. Edge cases covered.
```

### Phase 6: Feature Complete

When all work items pass review and testing, Hive creates a PR for you to merge.

```
[hive:lead] All work items merged to feature-1.
Created PR #42: [hive] JWT Authentication (feature-1)
  Base: develop ← Head: feature-1
  Ready for your review and merge.
```

### Phase 7: Shutdown

Hive gracefully shuts down all agents and archives the feature.

## Agent Roles

| Agent | What It Does | Model | Worktree? |
|-------|-------------|-------|-----------|
| **Lead** | Plans work, assigns tasks, coordinates the team. Only agent that talks to you. | opus | no |
| **Developer** | Implements features and writes unit tests on isolated branches. | opus | yes |
| **Reviewer** | Reviews code for bugs, security issues, and design problems. Runs `/simplify`. | opus | yes |
| **Tester** | Writes additional tests, runs test suites, validates acceptance criteria. Attacks edge cases. | opus | yes |
| **Researcher** | Investigates your codebase, researches APIs, finds reusable patterns. | opus | yes |
| **Monitor** | Runs health checks every 5 minutes. Detects stuck or idle agents. | haiku | no |

All agents except the monitor use the opus model for maximum quality. The monitor uses haiku because it only needs to read status files.

Agents that make changes (code, tests, documents) work in isolated git worktrees so they don't interfere with each other. The monitor is read-only and doesn't need a worktree.

## Branch Model

Hive uses a three-level branch hierarchy:

```
develop                          ← base branch (your integration branch)
  └── feature-1                  ← feature branch (created by Hive)
        ├── feature-1_wi-1       ← work item branch (one per task)
        ├── feature-1_wi-2
        └── feature-1_wi-3
  └── feature-2
        ├── feature-2_wi-1       ← WI IDs restart at 1 per feature
        └── feature-2_wi-2
```

**How it flows:**
1. Lead creates `feature-1` from `develop`
2. Developer creates `feature-1_wi-1` from `feature-1`
3. Developer implements, reviewer reviews, tester tests
4. Lead merges `feature-1_wi-1` back into `feature-1` (with `--no-ff`)
5. Repeat for all work items
6. Lead creates a PR from `feature-1` to `develop` — you merge it

**Base branch detection:**
Hive auto-detects your base branch in this order:
1. `develop` (if it exists — standard git-flow)
2. Your repo's default branch (auto-detected from remote)
3. `main` (fallback)

**Work item IDs are feature-scoped.** `feature-1_wi-1` and `feature-2_wi-1` are different work items. The compound ID (`feature-{id}_wi-{id}`) is globally unique.

## Checking Status

All project state lives in `.hive/`:

```bash
# See all work items and their status
node -e "
const items = require('./.hive/work-items/_index.json').items;
items.forEach(i => console.log(i.id + ': ' + i.status));
"

# See the active feature
cat .hive/features/_index.json

# See registered agents
cat .hive/agents/_index.json

# See recent activity
tail -5 .hive/logs/activity.jsonl
```

Or just ask the lead agent: *"What's the status?"*

### What's in `.hive/`?

```
.hive/
├── config.json              # Project config (name, version, base branch)
├── role-catalog.json         # Reviewer specializations (security, performance, etc.)
├── plans/                    # Planning documents
├── research/                 # Research findings from the researcher agent
├── work-items/               # Work item JSON files (one per task)
│   ├── _index.json           # Summary of all work items
│   ├── feature-1_wi-1.json   # Individual work item state
│   └── feature-1_wi-2.json
├── features/                 # Feature groupings
│   ├── _index.json           # Summary of all features
│   ├── _sequence.json        # Feature ID counter
│   └── feature-1.json        # Feature state (includes WI counter)
├── agents/                   # Agent registry
│   └── _index.json           # Active agents and their roles
├── logs/                     # Activity logs (auto-generated by hooks)
│   ├── activity.jsonl        # Work item state changes
│   ├── communications.jsonl  # Messages between agents
│   └── task-ledger.jsonl     # Task creation/update log
└── archive/                  # Completed or cancelled features
```

All state files are auto-committed to git by hooks — you never need to manage them manually.

## Recovering from Crashes

If a session is interrupted, just restart:

```bash
cd my-project
claude
```

Hive detects in-progress features by reading `.hive/` state files. It validates file integrity, picks up the most recent active feature, and resumes — reassigning stalled work items and continuing the active plan.

**Example:**
```
[hive:lead] Hive Orchestration System v2.2.0
Initializing workspace...
Detected in-progress feature: feature-1 (JWT Authentication)
  WI-1: MERGED ✓
  WI-2: IN_PROGRESS (stalled — reassigning)
  WI-3: OPEN
Resuming feature-1...
```

## Cancelling Work

Ask the lead: *"Cancel the current feature."*

Hive will:
1. Set all open/in-progress work items to `CANCELLED`
2. Set the feature status to `CANCELLED`
3. Shut down all agents
4. Archive the feature to `.hive/archive/`

## Reviewer Specializations

Hive can spawn specialist reviewers based on what your code touches:

| Specialization | Triggered By | Focus |
|---|---|---|
| **Security** | auth, crypto, input-validation tags, high risk | Authentication, injection attacks, secrets handling |
| **Architecture** | new-module, refactor tags | SOLID principles, coupling, module boundaries |
| **API Contract** | api, schema, breaking-change tags | Backward compatibility, REST conventions |
| **Performance** | performance, database, algorithm tags | Complexity, N+1 queries, memory patterns |
| **Compliance** | compliance, gdpr, pci, a11y tags | Licensing, accessibility, data protection |

Specialists are spawned automatically based on work item tags. For high-risk items, specialists are always included regardless of count.

## Hooks

Hive uses Claude Code hooks to automate logging and validation. You don't need to configure these — they work automatically:

| Hook | What It Does |
|------|-------------|
| **log-communication** | Records all messages between agents |
| **log-activity** | Records work item state changes |
| **log-task-change** | Records task creation and updates |
| **validate-transition** | Ensures work item status changes follow the state machine |
| **validate-completion** | Ensures work items pass review AND testing before merge (on task completion) |
| **auto-commit** | Auto-commits `.hive/` state changes to git |

All timestamps are generated by hook scripts (never by agents), ensuring consistency.

## Work Item Lifecycle

Every work item follows this path:

```
OPEN → ASSIGNED → IN_PROGRESS → REVIEW → APPROVED → TESTING → READY_TO_MERGE → MERGED
```

If issues are found:
- Reviewer returns `CHANGES_REQUESTED` → back to `IN_PROGRESS`
- Tester returns `TESTS_FAILED` → back to `IN_PROGRESS`
- Agent is stuck → `BLOCKED` → `IN_PROGRESS` when resolved

No shortcuts — every work item must pass both review AND testing before it can be merged.

## Development

### Prerequisites

- Node.js 16+
- npm
- Git
- Bash (Git Bash on Windows)

### Setup

```bash
cd hive
npm install
```

### Running Tests

```bash
npm test                  # Run all tests (~375 tests)
npm run test:coverage     # With coverage report (90% threshold)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests (real script execution)
npm run test:schema       # Schema validation tests
npm run test:agents       # Agent prompt validation
npm run typecheck         # TypeScript type checking
npm run ci                # Full pipeline: typecheck + tests + coverage
```

### Test Architecture

| Category | Tests | What It Validates |
|----------|-------|-------------------|
| **Unit** | ~170 | Pure function logic in `src/*.ts` modules |
| **Integration** | ~55 | Real bash script execution with temp dirs |
| **Schema** | ~75 | JSON schemas, config files, version consistency |
| **Agents** | ~75 | YAML frontmatter, markdown structure, cross-agent consistency |

### Commit Conventions

```
feat:     New features
fix:      Bug fixes
test:     Adding/updating tests
refactor: Code restructuring
docs:     Documentation updates
chore:    Maintenance (config, tooling)
```

## FAQ

**Q: Can I use Hive with any project?**
A: Yes. Hive works with any codebase that uses git. It adapts to your project's language, framework, and conventions.

**Q: What if an agent gets stuck?**
A: The monitor agent runs health checks every 5 minutes and alerts the lead. The lead will re-assign stuck work items or spawn fresh agents.

**Q: Can I talk to the agents directly?**
A: No. All communication goes through the lead agent. You tell the lead what you want, and it coordinates the team.

**Q: What model do agents use?**
A: All agents use Opus (the most capable model) except the monitor, which uses Haiku for efficiency.

**Q: Does Hive push to my main branch?**
A: Never. Agents only work on feature branches. You merge to your base branch (usually `develop`) at your discretion.

**Q: How do I see what agents are doing?**
A: Check `.hive/logs/activity.jsonl` for work item changes, `.hive/logs/communications.jsonl` for agent messages, or just ask the lead: "What's the status?"
