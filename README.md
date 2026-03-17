# Hive Marketplace

Plugin marketplace for the Hive multi-agent orchestration system for Claude Code.

## Install

```bash
# Add this marketplace
/plugin marketplace add YOUR_GITHUB_USERNAME/hive-marketplace

# Install the Hive plugin
/plugin install hive@hive-marketplace
```

## What's Included

### Hive Plugin

Multi-agent orchestration system inspired by [Gastown](https://github.com/steveyegge/gastown), built with pure Claude Code Agent Teams.

When enabled, Hive replaces the main Claude session with an orchestration lead that:

1. **Interviews** you with 10-15 comprehensive questions
2. **Plans** using /plan mode with work items, risks, and acceptance criteria
3. **Spawns** agent teammates (developers, reviewer, tester, researcher)
4. **Coordinates** parallel development with enterprise quality standards
5. **Validates** via risk-based pipeline (code review + tests)
6. **Reports** feature branches ready for you to merge

Key features:
- No subagents — main session IS the lead
- Gitflow — agents only work on feature/* branches
- Persistent ledgers — auto-logged by hooks for crash recovery
- Health monitoring — /loop 3m detects stuck agents
- Enterprise quality — no hardcoding, security-first, agents challenge assumptions

## Requirements

- Claude Code with Agent Teams enabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- Node.js (for hook scripts)
- Git
