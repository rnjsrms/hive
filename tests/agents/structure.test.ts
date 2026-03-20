import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const AGENTS_DIR = join(__dirname, '../../plugins/hive/agents');

function readAgent(file: string): string {
  return readFileSync(join(AGENTS_DIR, file), 'utf-8');
}

const agentFiles = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
const agentContents: Record<string, string> = {};
for (const file of agentFiles) {
  agentContents[file] = readAgent(file);
}

/** Worker agents (all except the lead orchestrator) */
const workerFiles = [
  'hive-developer.md',
  'hive-reviewer.md',
  'hive-tester.md',
  'hive-researcher.md',
];

describe('Agent markdown structure', () => {
  describe.each(agentFiles)('%s', (file) => {
    const content = agentContents[file];

    it('has a top-level # heading', () => {
      // Match a line that starts with exactly "# " (not "## ")
      expect(content).toMatch(/^# .+/m);
    });

    it('has a Communication Protocol section (or Shared Protocol for lead)', () => {
      // Worker agents use "## Communication Protocol"
      // Lead agent (hive.md) uses "## Phase 6: Shared Protocol" which covers communication
      const hasCommunicationSection =
        content.includes('## Communication Protocol') ||
        content.includes('## Phase 6: Shared Protocol');
      expect(hasCommunicationSection).toBe(true);
    });

    it('has a Gitflow section', () => {
      // Worker agents use "### Gitflow Reminder", lead uses "### Gitflow"
      expect(content).toMatch(/##[#]? Gitflow( Reminder)?/);
    });

    it('does not reference .hive/activity.jsonl (should be .hive/logs/activity.jsonl)', () => {
      // Check that there is no bare `.hive/activity.jsonl` (without `/logs/` prefix)
      // Allow `.hive/logs/activity.jsonl` which is correct
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('.hive/activity.jsonl')) {
          // Ensure every occurrence is the correct `.hive/logs/activity.jsonl` path
          expect(line).toContain('.hive/logs/activity.jsonl');
        }
      }
    });
  });

  describe('Worker agents have Bias for Action section (ISS-7 fix)', () => {
    it.each(workerFiles)('%s has "Bias for Action" section', (file) => {
      expect(agentContents[file]).toContain('## Bias for Action');
    });
  });
});
