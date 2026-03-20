# Hive Multi-Agent Orchestration System — Master Protocol

> This file is the operating manual for every agent in the Hive system.
> The lead orchestrator reads it on startup; spawned workers inherit its rules.

---

## 1. Startup & Resume Detection

On startup, read `.hive/convoys/_index.json`.

### 1.1 State Validation

Before acting on any state files, validate them:

1. **Parse check**: Attempt `JSON.parse()` on every `_index.json`, `_sequence.json`,
   and referenced `CV-*.json` / `WI-*.json` file. If any file fails to parse:
   - Log a warning to `activity.jsonl`: `{"event": "parse-error", "details": "..."}`
   - Skip that entry and continue — do NOT crash the entire resume.
2. **Referential integrity**: For each WI ID listed in a convoy's `work_items` array,
   verify the corresponding `WI-NNNN.json` exists on disk. If missing:
   - Log a warning and remove the dangling reference from the in-memory state.
3. **Multiple active convoys**: If more than one convoy has `status: "in-progress"`,
   pick the most recent by `created_at`. Warn the user about the others:
   > "Found 2 active convoys. Resuming most recent: '[name]'. Other: '[name2]' (created [date])."

### 1.2 Resume or Fresh

**If any convoy has `status: "in-progress"`:**

1. Use `AskUserQuestion`:
   > "Active convoy '[name]' detected ([X]% complete). Resume or start fresh?"
2. **Resume path:**
   - Read full `.hive/` state: convoys, work-items, agents, logs.
   - `TeamCreate("hive-session")`.
   - Re-spawn agents matching the agent registry (`_index.json`).
   - **Re-spawn timeout**: If an agent does not respond within 60 seconds of spawning,
     mark it `dead` in the agent registry and attempt one more spawn. If the second
     spawn also fails after 60 seconds, log the failure and notify the user.
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

Execute once the user approves the plan.

> **Platform limitation (GitHub #30703):** When agents are spawned with `team_name`,
> custom `.claude/agents/` frontmatter (`tools`, `model`, `isolation`, `color`, `skills`)
> is **silently ignored**. To work around this, always pass spawn parameters explicitly
> via the `Agent()` call. The `.claude/agents/*.agent.md` files remain canonical
> behavioral documentation — they will "just work" when the platform bug is fixed.

```
Step 1  TeamCreate("hive-session")

Step 2  Spawn agents using EXPLICIT Agent() parameters (do NOT rely on frontmatter):

        Developer (×N from plan):
          Agent(
            name:        "dev-{n}",
            team_name:   "hive-session",
            model:       "opus",
            isolation:   "worktree",
            subagent_type: "hive-developer",
            prompt:      <full behavioral prompt from developer.agent.md body>
          )

        Reviewer (×1):
          Agent(
            name:        "reviewer",
            team_name:   "hive-session",
            model:       "opus",
            subagent_type: "hive-reviewer",
            prompt:      <full behavioral prompt from reviewer.agent.md body>
          )
          NOTE: No isolation — reviewer operates read-only on the main worktree.
                Do NOT give the reviewer Write or Edit tools in the prompt.

        Tester (×1):
          Agent(
            name:        "tester",
            team_name:   "hive-session",
            model:       "opus",
            isolation:   "worktree",
            subagent_type: "hive-tester",
            prompt:      <full behavioral prompt from tester.agent.md body>
          )

        Researcher (×1, optional — only if plan flags unknowns):
          Agent(
            name:        "researcher",
            team_name:   "hive-session",
            model:       "opus",
            subagent_type: "hive-researcher",
            prompt:      <full behavioral prompt from researcher.agent.md body>
          )
          NOTE: No isolation — researcher is read-only + web tools.
                Do NOT give the researcher Write or Edit tools in the prompt.

          Spawn a researcher when ANY of these conditions apply:
          - Unfamiliar external APIs that need documentation review
          - No existing patterns in the codebase for the required feature
          - Performance-sensitive algorithm choices requiring benchmarks or research
          - External service integration (auth providers, payment, cloud APIs)
          - The plan explicitly flags "unknowns" or "spike needed"

Step 3  Create convoy file: .hive/convoys/CV-NNNN.json
        Create work-item files: .hive/work-items/WI-NNNN.json (one per item)
        Update _index.json and _sequence.json

Step 4  TaskCreate for each work item (Claude Code task per WI)

Step 5  SendMessage to each developer with their initial assignment(s)

Step 6  Start health-monitoring loop via CronCreate:

        CronCreate("*/3 * * * *", "Health check: Read .hive/agents/_index.json
          and check for stale heartbeats >5min. Read last 30 lines of
          .hive/logs/activity.jsonl. If any agent stuck >10min, SendMessage
          asking status. Also run: bash scripts/check-idle-work.sh to detect
          unassigned open work items — if found, assign them to idle agents.
          Report issues to me.")

Step 7  Enter coordination loop (Section 5)
```

---

## 5. Coordination Loop (Cyclical Operation)

The lead runs this loop continuously. It is event-driven: act on every
incoming `SendMessage`.

### 5.0 Message Validation & Deduplication

Before processing any incoming message:

1. **Malformed message check**: If a message is missing required fields (no identifiable
   agent name, no event type, no WI reference when expected), log a warning to
   `activity.jsonl` and skip the message. Do NOT crash or halt the loop.
2. **Duplicate detection**: Track the last 50 processed events as `{event, wi_id, agent, ts}`.
   If the same `event + wi_id + agent` combination arrives within 30 seconds of a
   previous identical entry, ignore it as a duplicate and log:
   `{"event": "duplicate-ignored", "details": "..."}`
3. **Review/testing timeout**: If a WI has been in `review` or `testing` status for
   more than 15 minutes with no response from the reviewer/tester, re-ping them with
   a reminder message. Log the re-ping to `activity.jsonl`.

### 5.1 Blocker Escalation Ladder

When a `BLOCKED` event is received or a WI is detected as stuck:

| Elapsed time | Action |
|--------------|--------|
| 0 min        | Log the block, analyze type (see below), route to appropriate agent |
| 15 min       | Re-ping the blocking agent with `[PRIORITY]` flag |
| 30 min       | Escalate to user via `AskUserQuestion`: "WI-NNNN blocked for 30 min: [reason]" |

**Blocker types and routing:**
- **Dependency blocker** (WI-X needs WI-Y): Route `[PRIORITY]` message to WI-Y's assignee
- **Technical blocker** (missing API, env issue): Escalate to user immediately (skip ladder)
- **Conflict blocker** (rebase/merge conflict): Route to developer with resolution guidance:
  rebase onto latest base branch, resolve conflicts, force-push feature branch

```
LOOP forever:
  RECEIVE message
  VALIDATE message (Section 5.0)

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

### 5.2 Decision Logging

When the lead makes a significant routing, assignment, scope, or technical decision
during coordination, append an entry to `.hive/logs/decisions.jsonl`.

**Triggers that require a decision log entry:**
- **Tech choice resolution**: Choosing between competing libraries, patterns, or approaches
- **Scope change**: Adding, removing, or modifying a work item mid-convoy
- **Dependency substitution**: Changing WI dependency order or removing a dependency
- **WI cancellation**: Cancelling a work item with rationale
- **Re-assignment**: Moving a WI from one developer to another (with reason)
- **Conflict resolution**: Resolving disagreements between reviewer and developer

**Format** (see Section 7.7 for full schema):
```json
{"ts":"...","agent":"lead","convoy":"CV-NNNN","wi":"WI-NNNN","decision":"...","alternatives":["..."],"rationale":"..."}
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

**Shutdown sequence (lead):**
1. Send `shutdown_request` to each agent.
2. Wait up to **30 seconds per agent** for a `shutdown_response`.
3. If an agent does not respond within 30 seconds, force-terminate it and log:
   `{"event": "force-shutdown", "agent": "...", "details": "No response after 30s"}`
4. After all agents have stopped, verify the agent registry: every agent's status
   must show `"stopped"`. If any agent is not `"stopped"`, log a warning.
5. List any remaining git worktrees created by agents for manual cleanup.
6. Archive the convoy: copy `CV-NNNN.json` to `.hive/archive/`.

**Agent shutdown duties:**
1. Flush all pending log entries.
2. Update their status in `_index.json` to `"stopped"`.
3. Exit cleanly.

---

## 7. Embedded State Schemas

### 7.1 Work Item — `WI-NNNN.json`

#### State Machine

```
                ┌──────────────────────────────────────────────┐
                │                                              │
                │  ┌──────┐    ┌──────────┐    ┌─────────────┐ │
  ──────────►   │  │ open ├───►│ assigned ├───►│ in-progress │ │
                │  └──┬───┘    └──────────┘    └──┬──────┬───┘ │
                │     │                           │      │     │
                │     │         ┌─────────────────┘      │     │
                │     │         ▼                         │     │
                │     │      ┌────────┐                   │     │
                │     │      │ review │◄──────────────┐   │     │
                │     │      └───┬────┘               │   │     │
                │     │          │                     │   │     │
                │     │    ┌─────┴──────┐              │   │     │
                │     │    ▼            ▼              │   │     │
                │     │ ┌──────────┐ ┌──────────────┐  │   │     │
                │     │ │ APPROVED │ │ CHANGES_REQ. ├──┘   │     │
                │     │ └────┬─────┘ └──────────────┘      │     │
                │     │      ▼                              │     │
                │     │ ┌──────────┐                        │     │
                │     │ │ testing  │                        │     │
                │     │ └────┬─────┘                        │     │
                │     │      │                              │     │
                │     │ ┌────┴───────┐                      │     │
                │     │ ▼            ▼                      │     │
                │     │ ┌────────┐ ┌──────────────┐         │     │
                │     │ │ PASS   │ │ TESTS_FAIL   ├────────►│     │
                │     │ └───┬────┘ └──────────────┘   (back to    │
                │     │     ▼                        in-progress)  │
                │     │ ┌────────────────┐                  │     │
                │     │ │ ready-to-merge │                  │     │
                │     │ └───────┬────────┘                  │     │
                │     │         ▼                           │     │
                │     │     ┌────────┐                      │     │
                │     │     │ merged │                      │     │
                │     │     └────────┘                      │     │
                │     │                                     │     │
                │     │  ┌─────────┐◄───────────────────────┘     │
                │     │  │ blocked ├────►(back to in-progress)    │
                │     │  └─────────┘                              │
                │     │                                           │
                │     └────────────►┌───────────┐                 │
                │                   │ cancelled │ (from any state)│
                │                   └───────────┘                 │
                └──────────────────────────────────────────────────┘
```

Valid transitions:
- `open` → `assigned`, `cancelled`
- `assigned` → `in-progress`, `cancelled`
- `in-progress` → `review`, `blocked`, `cancelled`
- `review` → `in-progress` (changes requested), `testing` (approved), `cancelled`
- `testing` → `ready-to-merge` (tests pass), `in-progress` (tests fail), `cancelled`
- `ready-to-merge` → `merged`, `cancelled`
- `blocked` → `in-progress` (unblocked), `cancelled`
- `done` → alias for `merged` (legacy compatibility)

#### Canonical History Event Types

The `event` field in history entries MUST be one of these canonical values:

| Event               | Emitted by | Meaning |
|---------------------|------------|---------|
| `created`           | lead       | Work item was created |
| `assigned`          | lead       | Work item assigned to a developer |
| `in-progress`       | developer  | Developer started implementation |
| `entering-review`   | developer  | Developer submitted for review |
| `APPROVED`          | reviewer   | Reviewer approved the change |
| `CHANGES_REQUESTED` | reviewer   | Reviewer requested changes |
| `TESTS_PASS`        | tester     | All tests pass, metric gates met |
| `TESTS_FAIL`        | tester     | Tests failed or metric regression |
| `ready-to-merge`    | lead       | All gates passed, ready for merge |
| `merged`            | lead       | Branch merged into base branch |
| `blocked`           | developer  | Work is blocked (details required) |
| `unblocked`         | lead       | Blocker resolved, work can resume |
| `cancelled`         | lead       | Work item cancelled |

#### Schema

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
  ],
  "created_at": "2026-03-18T10:00:00Z",
  "updated_at": "2026-03-18T10:05:00Z"
}
```

Valid `status` values: `open` | `assigned` | `in-progress` | `review` | `testing` | `ready-to-merge` | `done` | `merged` | `blocked` | `cancelled`

Valid `risk` values: `high` | `medium` | `low`

### 7.2 Convoy — `CV-NNNN.json`

#### State Machine

```
  ┌────────┐     ┌─────────────┐     ┌──────────────────┐     ┌────────┐
  │ staged ├────►│ in-progress ├────►│ agents-complete  ├────►│ merged │
  └───┬────┘     └──────┬──────┘     └────────┬─────────┘     └────────┘
      │                 │                     │
      │                 ▼                     │
      │           ┌───────────┐               │
      └──────────►│ cancelled │◄──────────────┘
                  └───────────┘
```

Valid transitions:
- `staged` → `in-progress` (team spawned, work begins), `cancelled`
- `in-progress` → `agents-complete` (all WIs ready-to-merge), `cancelled`
- `agents-complete` → `merged` (user confirms merge), `cancelled`

#### Schema

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
  "agents": ["dev-alpha", "dev-beta", "reviewer", "tester"],
  "progress": {
    "total": 3,
    "done": 0,
    "ready_to_merge": 1,
    "in_progress": 1,
    "open": 1,
    "percent_complete": 33
  },
  "created_at": "2026-03-18T09:55:00Z",
  "updated_at": "2026-03-18T10:12:00Z"
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
      "convoy_id": "CV-0001",
      "last_heartbeat": "2026-03-18T10:12:00Z",
      "health": "ok"
    },
    {
      "name": "reviewer",
      "role": "reviewer",
      "status": "idle",
      "current_task": null,
      "convoy_id": "CV-0001",
      "last_heartbeat": "2026-03-18T10:11:30Z",
      "health": "ok"
    }
  ]
}
```

Valid `health` values and thresholds:
- `ok` — heartbeat received within the last 5 minutes
- `stale` — heartbeat between 5 and 10 minutes old (ping the agent)
- `dead` — heartbeat older than 10 minutes (kill and re-spawn)

### 7.4 Activity Log — `.hive/logs/activity.jsonl`

One JSON object per line:

```json
{"ts":"2026-03-18T10:05:00Z","agent":"dev-alpha","event":"task-start","target":"WI-0001","details":"Beginning implementation of login endpoint"}
{"ts":"2026-03-18T10:30:00Z","agent":"dev-alpha","event":"heartbeat","target":"WI-0001","details":"50% through endpoint logic"}
{"ts":"2026-03-18T10:55:00Z","agent":"dev-alpha","event":"entering-review","target":"WI-0001","details":"Pushed to feature/hive/dev-alpha/WI-0001, rebased on develop"}
```

### 7.5 Communications Log — `.hive/logs/communications.jsonl`

```json
{"ts":"2026-03-18T10:05:00Z","session":"hive-session","to":"dev-alpha","message":"Begin WI-0001. Branch: feature/hive/dev-alpha/WI-0001.","raw":"..."}
{"ts":"2026-03-18T10:55:00Z","session":"hive-session","to":"lead","message":"entering-review WI-0001","raw":"..."}
```

### 7.6 Task Ledger — `.hive/logs/task-ledger.jsonl`

```json
{"ts":"2026-03-18T10:00:00Z","tool":"TaskCreate","input":{"title":"WI-0001","assignee":"dev-alpha"},"output":{"task_id":"t-abc123"}}
{"ts":"2026-03-18T10:05:00Z","tool":"SendMessage","input":{"to":"dev-alpha","message":"Begin WI-0001"},"output":{"delivered":true}}
```

### 7.7 Decision Log — `.hive/logs/decisions.jsonl`

The lead logs significant architectural decisions made during coordination — tech
choices, scope changes, dependency swaps, or trade-off resolutions. One JSON object
per line:

```json
{"ts":"2026-03-18T10:15:00Z","agent":"lead","convoy":"CV-0001","wi":"WI-0002","decision":"Use bcrypt over argon2 — project already depends on bcrypt, avoids new native dep","alternatives":["argon2","scrypt"],"rationale":"Minimize dependency surface; bcrypt is already vetted in package-lock"}
```

### 7.8 Index File Schemas

**`.hive/work-items/_index.json`** — Quick-lookup index of all work items (lead-owned):
```json
{
  "items": [
    {
      "id": "WI-0001",
      "title": "Implement user login endpoint",
      "status": "in-progress",
      "assignee": "dev-alpha",
      "risk": "high",
      "convoy_id": "CV-0001",
      "branch": "feature/hive/dev-alpha/WI-0001"
    }
  ]
}
```

**`.hive/convoys/_index.json`** — Quick-lookup index of all convoys (lead-owned):
```json
{
  "items": [
    {
      "id": "CV-0001",
      "name": "User Authentication System",
      "status": "in-progress",
      "work_item_count": 3,
      "percent_complete": 33
    }
  ]
}
```

**`.hive/work-items/_sequence.json`** — Next work item ID counter:
```json
{"next_id": 4}
```

**`.hive/convoys/_sequence.json`** — Next convoy ID counter (separate from WI counter):
```json
{"next_id": 2}
```

### 7.9 System Requirements

- **Node.js** (v16+): All hook scripts in `scripts/` use `node -e` for JSON
  parsing and file manipulation. Node must be available on `$PATH`.
- **Git**: Required for branch management, auto-commit, and worktree isolation.
- **Bash**: Hook scripts are bash scripts. On Windows, Git Bash or WSL is required.

### 7.10 Hook Script Notes

- **`auto-commit.sh`** uses `--no-verify` intentionally when committing `.hive/`
  state files. This prevents pre-commit hooks (linters, formatters) from blocking
  internal state persistence. Production code commits by developers do NOT use
  `--no-verify`.

---

## Quick Reference: File Tree

```
.hive/
  agents/
    _index.json          # Agent registry (lead-owned)
  convoys/
    _index.json          # Convoy index (lead-owned)
    _sequence.json       # Next convoy id counter (lead-owned)
    CV-0001.json         # Individual convoy state
  work-items/
    _index.json          # Work item index (lead-owned)
    _sequence.json       # Next work item id counter (lead-owned)
    WI-0001.json         # Individual work item state
    WI-0002.json
  plans/
    plan-2026-03-18-1000.md
  research/
    {topic}.md           # Research findings
  logs/
    activity.jsonl       # Heartbeats and milestones
    communications.jsonl # Inter-agent messages
    task-ledger.jsonl    # Tool invocation ledger
    decisions.jsonl      # Lead's architectural decision records
  archive/               # Completed or abandoned convoys
```

---

## 8. AutoResearch Improvement Loop

An optional mode the lead activates when the user requests continuous, metric-driven
improvement (e.g., "increase test coverage to 90%", "reduce lint violations to zero",
"optimize API response time below 200ms").

Inspired by Karpathy's autoresearch (time-boxed atomic experiments, single success
metric, git-based rollback) and Goenka's autoresearch (8-phase loop, guard
constraints, crash recovery, structured metrics logging).

### 8.1 Activation

The lead enters AutoResearch mode when the user provides:
1. A **target metric** (e.g., "test coverage", "lint violations", "p95 latency").
2. A **target value** (e.g., "≥ 90%", "0", "< 200ms").
3. Optionally: a **time budget** (default 2 hours) and **max iterations** (default 20).

### 8.2 The 8-Phase Loop

```
┌─────────────────────────────────────────────────────────────┐
│  MEASURE → IDENTIFY → PROPOSE → IMPLEMENT → VALIDATE →     │
│  DECIDE → LOG → REPEAT                                      │
└─────────────────────────────────────────────────────────────┘
```

**Phase 1: MEASURE**
- Researcher collects baseline metrics using project tooling (test runner with
  coverage, linter, benchmarks, etc.).
- Results saved to `.hive/research/metrics-baseline.json`:
  ```json
  {
    "ts": "2026-03-21T10:00:00Z",
    "metrics": {
      "test_coverage_pct": 72.3,
      "lint_violations": 14,
      "p95_latency_ms": 340
    }
  }
  ```

**Phase 2: IDENTIFY**
- Researcher ranks top 3 improvement opportunities by impact/effort ratio.
- For each opportunity: what to change, estimated metric delta, estimated time.
- Results saved to `.hive/research/improvement-candidates.md`.

**Phase 3: PROPOSE**
- Lead creates ONE atomic work item for the highest-impact candidate.
- Each iteration targets a single change — no bundling.
- Work item includes a **time budget** (default 15 minutes).

**Phase 4: IMPLEMENT**
- Developer creates a git tag before changes: `autoresearch/pre-WI-NNNN`
- Developer implements the change on a feature branch.
- Standard git workflow: `feature/hive/{agent-name}/WI-{id}`

**Phase 5: VALIDATE**
- If risk ≥ medium: reviewer reviews the change first.
- Tester runs the full test suite AND re-measures the target metric.
- **SUCCESS criterion**: the target metric MUST improve (not just "tests pass").
  A change that passes tests but doesn't move the metric is a failure.

**Phase 6: DECIDE**
- **Improved**: Merge the feature branch. Continue to next iteration.
- **Unchanged or worsened**: Revert via `git revert` on the feature branch.
  Do NOT merge. Log the failed attempt.
- **Time budget exceeded**: Force-stop the developer, revert changes, log timeout.

**Phase 7: LOG**
- Append to `.hive/logs/autoresearch.jsonl`:
  ```json
  {
    "ts": "2026-03-21T10:20:00Z",
    "iteration": 1,
    "wi_id": "WI-0005",
    "metric_name": "test_coverage_pct",
    "before": 72.3,
    "after": 75.1,
    "delta": 2.8,
    "outcome": "merged",
    "time_spent_seconds": 480
  }
  ```
- Valid `outcome` values: `merged` | `reverted` | `reverted-no-improvement` | `reverted-timeout` | `reverted-regression`

**Phase 8: REPEAT**
- Re-measure the target metric (back to Phase 1).
- Loop continues until:
  - Target value is met → log success, exit loop.
  - Max iterations reached → log exhaustion, report best achieved value.
  - Wall time budget exceeded → log timeout, report best achieved value.
  - 3 consecutive reverts → log stall, ask user for guidance.

### 8.3 Guard Constraints

| Guard                    | Default | Configurable? |
|--------------------------|---------|---------------|
| Max iterations           | 20      | Yes           |
| Max wall time            | 2 hours | Yes           |
| Per-iteration time budget| 15 min  | Yes           |
| Auto-revert on test regression | Always | No     |
| Consecutive revert stall | 3       | Yes           |

### 8.4 Crash Recovery

On restart, the lead checks for `.hive/logs/autoresearch.jsonl`. If it exists:
1. Read the last entry to determine the last completed iteration.
2. Check if the target metric has been met.
3. If not met and within budget: resume from Phase 1 (MEASURE) of the next iteration.
4. If met or budget exhausted: report final results and exit.

### 8.5 AutoResearch Log Schema — `.hive/logs/autoresearch.jsonl`

```json
{
  "ts": "ISO 8601",
  "iteration": "number (1-based)",
  "wi_id": "WI-NNNN",
  "metric_name": "string",
  "before": "number",
  "after": "number",
  "delta": "number (after - before)",
  "outcome": "merged | reverted | reverted-no-improvement | reverted-timeout | reverted-regression",
  "time_spent_seconds": "number",
  "notes": "string (optional — reason for revert, etc.)"
}
```

---

## Invariants

1. The lead NEVER writes code. It orchestrates, routes, and monitors.
2. Workers NEVER modify convoy or index files (except their own WI status/history).
3. Every state change is logged to `activity.jsonl`.
4. No agent touches protected branches. Ever.
5. The coordination loop does not exit until the convoy reaches `"merged"` or the user explicitly terminates.
6. When in doubt, ask the user — never guess on ambiguous requirements.
7. In AutoResearch mode: any test regression triggers an automatic revert — no exceptions.
