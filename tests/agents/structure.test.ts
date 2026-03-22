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
      // Lead agent (hive.md) uses "## Shared Protocol" which covers communication
      const hasCommunicationSection =
        content.includes('## Communication Protocol') ||
        content.includes('## Shared Protocol');
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

// ---------------------------------------------------------------------------
// hive.md invariant safety contract
// ---------------------------------------------------------------------------

describe('hive.md invariants (Phase 8 safety contract)', () => {
  const leadContent = agentContents['hive.md'];

  it('contains exactly 10 numbered invariants in Invariants section', () => {
    // Extract the Invariants section (between "## Invariants" and the next "## " or end)
    const phase8Match = leadContent.match(/## Invariants[\s\S]*?(?=\n---|\n## [^#]|$)/);
    expect(phase8Match).not.toBeNull();
    const phase8 = phase8Match![0];
    const invariantMatches = phase8.match(/^\d+\.\s+\*\*.+\*\*/gm);
    expect(invariantMatches).not.toBeNull();
    expect(invariantMatches!.length).toBe(10);
  });

  it('invariant 1: lead never writes production code', () => {
    expect(leadContent).toContain('Lead never writes production code');
  });

  it('invariant 2: workers restricted from index/sequence/sprint files (ISS-13 updated)', () => {
    expect(leadContent).toMatch(/Workers never modify index.*sequence.*sprint/i);
    // ISS-13 fix: workers MAY update their own wi-*.json
    expect(leadContent).toContain('wi-*.json');
  });

  it('invariant 3: every state change is logged', () => {
    expect(leadContent).toContain('Every state change is logged');
    expect(leadContent).toContain('.hive/logs/activity.jsonl');
  });

  it('invariant 4: no agent touches protected branches', () => {
    expect(leadContent).toContain('No agent touches protected branches');
  });

  it('invariant 5: coordination loop never exits prematurely', () => {
    expect(leadContent).toContain('coordination loop never exits prematurely');
  });

  it('invariant 6: review AND testing required before merge', () => {
    expect(leadContent).toMatch(/review AND testing before merge/i);
  });

  it('invariant 7: dependencies are respected', () => {
    expect(leadContent).toContain('Dependencies are respected');
  });

  it('invariant 8: communication is structured (GUPP)', () => {
    expect(leadContent).toContain('Communication is structured');
    expect(leadContent).toContain('GUPP');
  });

  it('invariant 9: branch naming convention enforced', () => {
    expect(leadContent).toContain('Branches follow naming convention');
    expect(leadContent).toContain('feature/wi-{id}-{slug}');
  });

  it('invariant 10: state files are source of truth', () => {
    expect(leadContent).toContain('State files are the source of truth');
  });
});
