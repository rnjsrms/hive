# Hive Plugin for Claude Code

Multi-agent orchestration system that coordinates teams of agents to plan, implement, review, test, and validate code changes with enterprise quality.

Inspired by [Gastown](https://github.com/steveyegge/gastown), built with pure Claude Code Agent Teams.

## Quick Start

```bash
# Test locally
claude --plugin-dir ~/hive/plugins/hive

# Or install permanently
claude plugin install ~/hive/plugins/hive --scope user
```

When enabled, every `claude` session starts as the Hive lead orchestrator. The `"agent": "hive"` setting in `settings.json` replaces the default Claude Code agent with the Hive lead.

## How It Works

1. **Interview** — Hive asks 10-15 comprehensive questions about your objective
2. **Plan** — Creates a detailed plan with work items, risks, and acceptance criteria
3. **Team** — Spawns agent teammates: developers, reviewer, tester, researcher
4. **Execute** — Workers implement in isolated git worktrees on feature branches
5. **Validate** — Risk-based pipeline: code review → tests → ready-to-merge
6. **Complete** — Reports feature branches ready for you to merge

## Architecture

| Agent | Role |
|-------|------|
| **hive** (lead) | Plans, coordinates, monitors — never writes code |
| **hive-developer** | Implements features with enterprise quality, worktree isolation |
| **hive-reviewer** | Reviews code, runs /simplify, challenges design decisions |
| **hive-tester** | Writes tests, runs suites, validates correctness |
| **hive-researcher** | Explores codebase, researches APIs, finds reusable patterns |

## Key Features

- **No subagents** — Hive lead IS the main session (via plugin agent replacement)
- **Agent teams** — Workers are full teammates with their own 1M context windows
- **Gitflow** — Agents only work on `feature/*` branches. Never touch main/develop.
- **Enterprise quality** — No hardcoding, security-first, performance-aware
- **Agents challenge assumptions** — Push back on suboptimal approaches
- **Persistent ledgers** — Communications and task state auto-logged by hooks
- **Crash recovery** — Resume in-progress convoys on restart (validates state integrity, handles corrupt files gracefully)
- **Health monitoring** — `CronCreate` schedules periodic health checks
- **Blocker escalation** — Timed ladder (15m re-ping → 30m user escalation)
- **AutoResearch mode** (planned) — Metric-driven improvement loop (measure → implement → validate → merge/revert)

## State

Hive bootstraps a `.hive/` directory in your project for state management:

```
.hive/
├── plans/          # Interview plans
├── research/       # Research findings
├── work-items/     # Task state (JSON)
├── convoys/        # Work bundles
├── agents/         # Agent registry
├── archive/        # Completed/abandoned convoys
└── logs/           # Activity, communications, task ledger, decisions, autoresearch (JSONL)
```

All state is git-committed automatically by hooks.

## Enable/Disable

```bash
# Per-project (gitignored)
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
- Windows: PowerShell 5+ (for desktop notifications)
