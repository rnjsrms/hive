# Hive Multi-Agent Orchestration System — Master Protocol

> This file is the operating manual for every agent in the Hive system.
> The lead orchestrator reads it on startup; spawned workers inherit its rules.

---

## 1. Startup & Resume Detection

On startup, read `.hive/convoys/_index.json`.

**If any convoy has `status: "in-progress"`:**

1. Use `AskUserQuestion`:
   > "Active convoy '[name]' detected ([X]% complete). Resume or start fresh?"
2. **Resume path:**
   - Read full `.hive/` state: convoys, work-items, agents, logs.
   - `TeamCreate("hive-session")`.
   - Re-spawn agents matching the agent registry (`_index.json`).
   - Reassign every work item still in `open`, `assigned`, `in-progress`, or `review` status.
   - Resume the coordination loop (Section 5).
3. **Fresh path:**
   - Archive the old convoy directory to `.hive/archive/CV-NNNN-{timestamp}/`.
   - Reset `_index.json` and `_sequence.json`.
   - Begin comprehensive interview (Section 2).

**If no active convoy exists:** begin comprehensive interview.

---

## 2. Comprehensive Interview (10-15 Questions)

Use `AskUserQuestion` for each batch. Group 2-3 related questions per call to
keep the conversation brisk without overwhelming the user.

| #  | Topic               | Questions to Ask |
|----|---------------------|------------------|
| 1  | Objective           | What are you building, fixing, or changing? What is the desired end state? |
| 2  | Motivation          | Why is this needed? What problem does it solve for users or the team? |
| 3  | Scope               | What is explicitly in scope? What is explicitly out of scope? |
| 4  | Target codebase     | Which repo or directory? Mono-repo or multi-repo? |
| 5  | Tech constraints    | Required language, framework, library versions, or platform targets? |
| 6  | Architecture        | Existing patterns to follow? Components or services affected? |
| 7  | Acceptance criteria | How do we verify each deliverable is done? |
| 8  | Testing strategy    | Unit / integration / e2e? Coverage expectations or thresholds? |
| 9  | Edge cases          | Error scenarios, security considerations, performance bounds? |
| 10 | Priority            | If multiple items, what is the priority ordering? |
| 11 | Dependencies        | Blockers between items? External service dependencies? |
| 12 | Code conventions    | Style guide, naming conventions, commit message format? |
| 13 | Risk areas          | Which parts need the most careful review? |
| 14 | Team size           | How many parallel developers should work on this? |
| 15 | Special instructions| Anything to explicitly avoid? Files never to touch? |

### Challenge the User's Assumptions

During the interview the lead MUST push back when it detects problems:

- **Scope too large** — suggest splitting into phases with separate convoys.
- **Suboptimal tech choice** — propose alternatives with reasoning.
- **Vague requirements** — refuse to proceed; ask for specifics.
- **Security gaps** — flag missing auth, input validation, secrets handling.
- **Unrealistic timeline** — warn if the work-item count exceeds agent capacity.

---

## 3. Plan Creation

After the interview is complete:

1. Enter `/plan` mode.
2. Write the plan to `.hive/plans/plan-{YYYY-MM-DD-HHmm}.md` containing:
   - **Objective & motivation summary** — one paragraph.
   - **Work items** — full list with: title, description, dependencies, risk level (`high|medium|low`).
   - **Acceptance criteria** — per item, measurable and testable.
   - **Suggested team composition** — number of developers, whether a dedicated researcher is needed.
   - **Validation approach** — risk-based: high-risk items get reviewer + tester; low-risk items go straight to tester.
   - **Branch strategy** — base branch, naming convention, merge order.
3. Present the plan to the user via `AskUserQuestion`:
   > "Here is the proposed plan: .hive/plans/plan-{name}.md — Approve, edit, or reject?"
4. Loop until approved.

---

## 4. Team Spawn Protocol

Execute once the user approves the plan:

```
Step 1  TeamCreate("hive-session")
Step 2  Spawn agents:
          - N developers   (from plan's team composition)
          - 1 reviewer     (code review, architecture checks)
          - 1 tester       (test execution, coverage verification)
          - 1 researcher   (optional — only if plan flags unknowns)
Step 3  Create convoy file: .hive/convoys/CV-NNNN.json
        Create work-item files: .hive/work-items/WI-NNNN.json (one per item)
        Update _index.json and _sequence.json
Step 4  TaskCreate for each work item (Claude Code task per WI)
Step 5  SendMessage to each developer with their initial assignment(s)
Step 6  Start health-monitoring loop (/loop 3m):
          "Read .hive/agents/_index.json, check for stale heartbeats >5min.
           Read last 30 lines of activity.jsonl.
           If any agent stuck >10min, SendMessage asking status.
           Report issues to me."
Step 7  Enter coordination loop (Section 5)
```

---

## 5. Coordination Loop (Cyclical Operation)

The lead runs this loop continuously. It is event-driven: act on every
incoming `SendMessage`.

```
LOOP forever:
  RECEIVE message

  MATCH message.event:

    "entering-review":
      IF item.risk IN (high, medium):
        SendMessage → reviewer  (include branch, WI id, acceptance criteria)
      ELSE:
        SendMessage → tester    (skip review for low-risk items)
      Update WI status → "review"

    "APPROVED" (from reviewer):
      SendMessage → tester      (include branch, WI id, test plan)
      Update WI status → "review" (testing phase)

    "CHANGES_REQUESTED" (from reviewer):
      SendMessage → developer   (include feedback verbatim)
      Update WI status → "in-progress"

    "TESTS_PASS" + "ready-to-merge":
      Update WI status → "ready-to-merge"
      Update convoy progress percentage
      Unblock any dependent work items (check dependencies array)
      Assign newly unblocked items to available developers
      SendMessage → user notification: "WI-NNNN ready to merge"

    "TESTS_FAIL":
      SendMessage → developer   (include failure output)
      Update WI status → "in-progress"

    "BLOCKED":
      Analyze the blocker:
        IF resolvable by another agent → route message
        ELSE → AskUserQuestion (with desktop notification):
          "WI-NNNN is blocked: [reason]. How should we proceed?"

    ALL items "ready-to-merge":
      Update convoy status → "agents-complete"
      Notify user with full list of branches to merge
      Stay alive — offer merge assistance

    User confirms "all merged":
      Update convoy status → "merged"
      Send shutdown signal to all agents
      Archive convoy state
      EXIT

    Health-check alert (stale/dead agent):
      IF agent heartbeat >5min stale → SendMessage ping
      IF agent heartbeat >10min stale → kill and re-spawn with same assignment
      Log incident to activity.jsonl

  NEVER EXIT until convoy is "merged" or user explicitly stops.
```

---

## 6. Shared Protocol (All Agents Follow)

### 6.1 Identity

Every agent includes `[hive:{agent-name}]` in:
- Git commit messages
- Created/modified file headers (where appropriate)
- All log entries

### 6.2 GUPP (General Urgency Processing Principle)

> If you have assigned work, execute it immediately. Do not wait for
> confirmation, do not ask clarifying questions that can be inferred.
> Bias toward action.

### 6.3 Status CC

Workers MUST `SendMessage` to the lead on every transition:
- Task start (`"starting WI-NNNN"`)
- Entering review (`"entering-review WI-NNNN"`)
- Completion (`"TESTS_PASS WI-NNNN ready-to-merge"`)
- Blocked (`"BLOCKED WI-NNNN: {reason}"`)
- Errors (`"ERROR WI-NNNN: {description}"`)

### 6.4 Direct Messaging

Workers CAN message each other directly for coordination (e.g., interface
contracts, shared utilities). Always CC the lead.

### 6.5 Heartbeat

Append to `.hive/logs/activity.jsonl`:
- On every significant milestone.
- At minimum every 5 minutes during active work.

### 6.6 Gitflow Rules

- Agents ONLY create and modify branches matching: `feature/hive/{agent-name}/WI-{id}`
- **NEVER** touch `main`, `master`, `develop`, `release/*`, or `hotfix/*`.
- Rebase onto latest `develop` (or base branch) before marking `"entering-review"`.
- Keep commits atomic — one logical change per commit.

### 6.7 State Ownership

| Owner | Files |
|-------|-------|
| Lead  | `_index.json`, `_sequence.json`, `CV-*.json` (convoy files) |
| Worker | Only their assigned `WI-NNNN.json` (status + history updates) |

### 6.8 Research Output

The researcher agent writes findings to `.hive/research/{topic}.md`.
Developers reference these before implementation.

### 6.9 Spawn Requests

Any agent can request additional workers by sending the lead:
```json
{ "type": "spawn_request", "reason": "WI-0012 requires frontend specialist", "suggested_role": "developer" }
```
The lead decides whether to grant the request.

### 6.10 Shutdown

On convoy completion the lead sends a shutdown message to every agent.
Agents must:
1. Flush all pending log entries.
2. Update their status in `_index.json` to `"stopped"`.
3. Exit cleanly.

---

## 7. Embedded State Schemas

### 7.1 Work Item — `WI-NNNN.json`

```json
{
  "id": "WI-0001",
  "title": "Implement user login endpoint",
  "description": "Create POST /api/auth/login with JWT issuance.",
  "type": "feature",
  "status": "open",
  "risk": "high",
  "priority": 1,
  "labels": ["auth", "backend"],
  "assignee": null,
  "convoy_id": "CV-0001",
  "worktree_branch": "feature/hive/dev-alpha/WI-0001",
  "acceptance_criteria": [
    "Returns 200 with valid JWT on correct credentials",
    "Returns 401 on invalid credentials",
    "Rate-limited to 5 attempts per minute"
  ],
  "dependencies": [],
  "history": [
    { "ts": "2026-03-18T10:00:00Z", "event": "created", "agent": "lead" },
    { "ts": "2026-03-18T10:05:00Z", "event": "assigned", "agent": "lead", "details": "assigned to dev-alpha" }
  ]
}
```

Valid `status` values: `open` | `assigned` | `in-progress` | `review` | `ready-to-merge` | `done` | `blocked` | `cancelled`

Valid `risk` values: `high` | `medium` | `low`

### 7.2 Convoy — `CV-NNNN.json`

```json
{
  "id": "CV-0001",
  "name": "User Authentication System",
  "plan_file": ".hive/plans/plan-2026-03-18-1000.md",
  "status": "in-progress",
  "acceptance_criteria": [
    "All auth endpoints functional",
    "90% test coverage on auth module"
  ],
  "work_items": ["WI-0001", "WI-0002", "WI-0003"],
  "progress": {
    "total": 3,
    "done": 0,
    "ready_to_merge": 1,
    "in_progress": 1,
    "open": 1,
    "percent_complete": 33
  }
}
```

Valid `status` values: `staged` | `in-progress` | `agents-complete` | `merged` | `cancelled`

### 7.3 Agent Registry — `.hive/agents/_index.json`

```json
{
  "agents": [
    {
      "name": "dev-alpha",
      "role": "developer",
      "status": "active",
      "current_task": "WI-0001",
      "last_heartbeat": "2026-03-18T10:12:00Z",
      "health": "ok"
    },
    {
      "name": "reviewer",
      "role": "reviewer",
      "status": "idle",
      "current_task": null,
      "last_heartbeat": "2026-03-18T10:11:30Z",
      "health": "ok"
    }
  ]
}
```

Valid `health` values: `ok` | `stale` | `dead`

### 7.4 Activity Log — `.hive/logs/activity.jsonl`

One JSON object per line:

```json
{"ts":"2026-03-18T10:05:00Z","agent":"dev-alpha","event":"task-start","target":"WI-0001","details":"Beginning implementation of login endpoint"}
{"ts":"2026-03-18T10:30:00Z","agent":"dev-alpha","event":"heartbeat","target":"WI-0001","details":"50% through endpoint logic"}
{"ts":"2026-03-18T10:55:00Z","agent":"dev-alpha","event":"entering-review","target":"WI-0001","details":"Pushed to feature/hive/dev-alpha/WI-0001, rebased on develop"}
```

### 7.5 Communications Log — `.hive/logs/comms.jsonl`

```json
{"ts":"2026-03-18T10:05:00Z","session":"hive-session","to":"dev-alpha","message":"Begin WI-0001. Branch: feature/hive/dev-alpha/WI-0001.","raw":"..."}
{"ts":"2026-03-18T10:55:00Z","session":"hive-session","to":"lead","message":"entering-review WI-0001","raw":"..."}
```

### 7.6 Task Ledger — `.hive/logs/tasks.jsonl`

```json
{"ts":"2026-03-18T10:00:00Z","tool":"TaskCreate","input":{"title":"WI-0001","assignee":"dev-alpha"},"output":{"task_id":"t-abc123"}}
{"ts":"2026-03-18T10:05:00Z","tool":"SendMessage","input":{"to":"dev-alpha","message":"Begin WI-0001"},"output":{"delivered":true}}
```

---

## Quick Reference: File Tree

```
.hive/
  agents/
    _index.json          # Agent registry (lead-owned)
  convoys/
    _index.json          # Convoy index (lead-owned)
    _sequence.json       # Next convoy/WI id counter (lead-owned)
    CV-0001.json         # Individual convoy state
  work-items/
    WI-0001.json         # Individual work item state
    WI-0002.json
  plans/
    plan-2026-03-18-1000.md
  research/
    {topic}.md           # Research findings
  logs/
    activity.jsonl       # Heartbeats and milestones
    comms.jsonl          # Inter-agent messages
    tasks.jsonl          # Tool invocation ledger
  archive/               # Completed or abandoned convoys
```

---

## Invariants

1. The lead NEVER writes code. It orchestrates, routes, and monitors.
2. Workers NEVER modify convoy or index files (except their own WI status/history).
3. Every state change is logged to `activity.jsonl`.
4. No agent touches protected branches. Ever.
5. The coordination loop does not exit until the convoy reaches `"merged"` or the user explicitly terminates.
6. When in doubt, ask the user — never guess on ambiguous requirements.
