import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const AGENTS_DIR = join(__dirname, '../../plugins/hive/agents');

function readAgent(file: string): string {
  return readFileSync(join(AGENTS_DIR, file), 'utf-8');
}

// Worker files: all agent MDs except hive.md (lead) and hive-monitor.md (monitor)
const workerFiles = readdirSync(AGENTS_DIR)
  .filter(f => f.endsWith('.md') && f !== 'hive.md' && f !== 'hive-monitor.md');

const allFiles = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));

describe('Agent cross-consistency', () => {
  it('all worker agents use [STATUS] WI-{id}: message format', () => {
    for (const file of workerFiles) {
      const content = readAgent(file);
      expect(
        content,
        `${file} should contain [STATUS] WI-{id}: message format`,
      ).toMatch(/\[STATUS\] WI-\{id\}/);
    }
  });

  it('all agents reference .hive/logs/activity.jsonl (not .hive/activity.jsonl)', () => {
    for (const file of allFiles) {
      const content = readAgent(file);
      // If the agent mentions activity.jsonl at all, it must use the /logs/ path
      if (content.includes('activity.jsonl')) {
        expect(
          content,
          `${file} should reference .hive/logs/activity.jsonl`,
        ).toContain('.hive/logs/activity.jsonl');
        // Ensure there is no bare .hive/activity.jsonl reference
        const barePattern = /\.hive\/activity\.jsonl/g;
        const allMatches = [...content.matchAll(barePattern)];
        const logsPattern = /\.hive\/logs\/activity\.jsonl/g;
        const logsMatches = [...content.matchAll(logsPattern)];
        // Every occurrence of .hive/activity.jsonl should be within .hive/logs/activity.jsonl
        // so the count of bare matches should equal the count of logs matches
        // (since .hive/logs/activity.jsonl contains .hive/ ... activity.jsonl but as a substring)
        // Actually, the bare pattern won't match .hive/logs/activity.jsonl, so bare count should be 0
        expect(
          allMatches.length,
          `${file} has bare .hive/activity.jsonl references`,
        ).toBe(0);
      }
    }
  });

  it('developer agent uses _wi-{id} compound branch naming', () => {
    const devContent = readAgent('hive-developer.md');
    expect(devContent).toContain('_wi-{id}');
    expect(devContent).not.toContain('feature/wi-');
  });

  it('no agent references origin/develop (should use configurable base branch)', () => {
    for (const file of allFiles) {
      const content = readAgent(file);
      expect(
        content,
        `${file} should not reference origin/develop`,
      ).not.toContain('origin/develop');
    }
  });

  it('hive.md (lead) uses _wi-{id} compound branch naming convention', () => {
    const leadContent = readAgent('hive.md');
    expect(leadContent).toContain('_wi-{id}');
  });

  it('no agent references WI-NNNN.json file paths (should be wi-{id}.json)', () => {
    for (const file of allFiles) {
      const content = readAgent(file);
      expect(
        content,
        `${file} should not contain WI-NNNN.json references`,
      ).not.toContain('WI-NNNN.json');
    }
  });

  it('reviewer and researcher agents have Write tool in frontmatter', () => {
    const reviewer = readAgent('hive-reviewer.md');
    const researcher = readAgent('hive-researcher.md');
    const toolsLine = (content: string) => {
      const match = content.match(/^tools:\s*(.+)$/m);
      return match ? match[1] : '';
    };
    expect(toolsLine(reviewer)).toContain('Write');
    expect(toolsLine(researcher)).toContain('Write');
  });

  it('hive.md bootstrap config version matches plugin.json version', () => {
    const leadContent = readAgent('hive.md');
    const pluginJson = JSON.parse(
      readFileSync(join(__dirname, '../../plugins/hive/.claude-plugin/plugin.json'), 'utf-8'),
    );
    const versionPattern = new RegExp(`"version":\\s*"${pluginJson.version.replace(/\./g, '\\.')}"`);
    expect(leadContent).toMatch(versionPattern);
  });

  it('no empty catch blocks in any agent prompt code snippets', () => {
    for (const file of allFiles) {
      const content = readAgent(file);
      expect(
        content,
        `${file} should not contain empty catch blocks`,
      ).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
    }
  });

  it('hive.md activation banner version matches plugin.json version', () => {
    const leadContent = readAgent('hive.md');
    const pluginJson = JSON.parse(
      readFileSync(join(__dirname, '../../plugins/hive/.claude-plugin/plugin.json'), 'utf-8'),
    );
    // Banner format: [hive:lead] Hive Orchestration System v1.3.0
    const bannerPattern = new RegExp(
      `Hive Orchestration System v${pluginJson.version.replace(/\./g, '\\.')}`,
    );
    expect(
      leadContent,
      `hive.md banner version should match plugin.json version ${pluginJson.version}`,
    ).toMatch(bannerPattern);
  });

  it('developer references feature branch, reviewer references feature branch for diff', () => {
    const dev = readAgent('hive-developer.md');
    const reviewer = readAgent('hive-reviewer.md');
    // Developer rebases on feature branch
    expect(dev).toContain('feature-{id}');
    expect(dev).toContain('feature branch');
    // Reviewer diffs against feature branch
    expect(reviewer).toContain('feature-{id}');
    expect(reviewer).toContain('_wi-{id}');
  });
});
