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

- Lead creates a feature branch for each work item (e.g., `feature/WI-0001-add-auth`)
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
- `.hive/logs/activity.jsonl` -- general activity log
- `.hive/logs/communications.jsonl` -- inter-agent message log
- `.hive/logs/task-ledger.jsonl` -- task creation and update log
- `.hive/logs/decisions.jsonl` -- decision records

## Resuming After a Crash

If a session is interrupted, just start Claude again:

```bash
cd hive
claude
```

The lead agent detects in-progress convoys and work items by reading `.hive/` state
files. It will resume where it left off -- reassigning stalled work items and
continuing the active plan.

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

## Hooks

Hive uses Claude Code hooks (configured in `.claude/settings.json`) to:

- **Log communications** between agents to `communications.jsonl`
- **Log task changes** (create/update) to `task-ledger.jsonl`
- **Auto-commit** `.hive/` state changes to git after each write
- **Validate completion** ensuring work items pass review and testing
- **Check idle work** prompting idle agents to pick up unassigned items
- **Send notifications** via Windows desktop notifications
