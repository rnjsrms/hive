# Hive

Multi-agent orchestration plugin for [Claude Code](https://claude.com/claude-code), inspired by [Gastown](https://github.com/steveyegge/gastown). Built with pure Claude Code Agent Teams.

## Install

```bash
# Add the marketplace
/plugin marketplace add rnjsrms/hive

# Install the plugin
/plugin install hive@hive
```

Or test locally:
```bash
claude --plugin-dir ~/hive-marketplace/plugins/hive
```

## What It Does

When enabled, Hive replaces the main Claude session with an orchestration lead that coordinates a full development team:

1. **Interviews** you with 10-15 comprehensive questions about your objective
2. **Plans** using /plan mode — work items, risks, dependencies, acceptance criteria
3. **Spawns** agent teammates (developers, reviewer, tester, researcher)
4. **Coordinates** parallel development in isolated git worktrees
5. **Validates** via risk-based pipeline (code review + tests)
6. **Reports** feature branches ready for you to merge

## Architecture

```
                        YOU
                         |
                    [Hive Lead]
                   /    |    \      \
          developer  reviewer  tester  researcher
          developer
          developer
```

| Agent | Role |
|-------|------|
| **Lead** (main session) | Interviews, plans, coordinates, monitors — never writes code |
| **Developer** (1-5 instances) | Implements features in worktrees with enterprise quality |
| **Reviewer** | Reviews code, runs /simplify, challenges design decisions |
| **Tester** | Writes tests, runs suites, validates correctness |
| **Researcher** | Explores codebase, researches APIs, finds reusable patterns |

## Key Features

- **No subagents** — the main session IS the Hive lead (via plugin agent replacement)
- **Agent teams** — each worker gets its own full 1M-token context window
- **Gitflow** — agents only work on `feature/*` branches, never touch main/develop
- **Enterprise quality** — no hardcoding, security-first, performance-aware, reuse existing code
- **Agents challenge assumptions** — push back on suboptimal approaches and suggest improvements
- **Risk-based validation** — high-risk items get full review + tests; low-risk items get tests only
- **Persistent ledgers** — all communications and task state auto-logged by hooks
- **Crash recovery** — resume in-progress work on restart (state persisted in `.hive/`)
- **Health monitoring** — `/loop 3m` detects stuck agents and reassigns work
- **Two-stage completion** — agents finish, you merge at your own pace

## How It Works

### State Management

Hive bootstraps a `.hive/` directory in your project:

```
.hive/
├── plans/              # Interview plans
├── research/           # Research findings
├── work-items/         # Task state (JSON per item)
├── convoys/            # Work bundles
├── agents/             # Agent registry + heartbeats
└── logs/
    ├── activity.jsonl        # All agent actions
    ├── communications.jsonl  # Every message (auto-logged by hook)
    ├── task-ledger.jsonl     # Every task change (auto-logged by hook)
    └── decisions.jsonl       # Lead's decision rationale
```

All state is auto-committed to git by hooks, providing full version history.

### Hooks (bundled with plugin)

| Hook | Trigger | Action |
|------|---------|--------|
| Communication ledger | PostToolUse(SendMessage) | Logs every message to communications.jsonl |
| Task ledger | PostToolUse(TaskCreate/Update) | Logs every task change to task-ledger.jsonl |
| Auto-commit | PostToolUse(Write/Edit on .hive/) | Git commits state changes automatically |
| Completion gate | TaskCompleted | Blocks completion without TESTS_PASS + reviewer APPROVED (high-risk) |
| Idle prevention | TeammateIdle | Keeps workers active when unassigned work exists |
| Desktop notification | Notification | Windows toast notification on milestones |

### Validation Pipeline

```
HIGH risk (auth, data, APIs):
  developer → reviewer (/simplify) → tester → ready-to-merge

MEDIUM risk (features, refactors):
  developer → reviewer → tester → ready-to-merge

LOW risk (config, docs):
  developer → tester → ready-to-merge
```

Agents never merge — feature branches are left for you to merge when ready.

## Enable / Disable

```bash
# Per-project
claude plugin enable hive --scope local
claude plugin disable hive --scope local

# Globally
claude plugin enable hive --scope user
claude plugin disable hive --scope user
```

## Requirements

- Claude Code with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- Node.js (for hook scripts)
- Git

## License

MIT
