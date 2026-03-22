import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

const AGENTS_DIR = join(__dirname, '../../plugins/hive/agents');

/** Known valid Claude Code tool names */
const VALID_TOOLS = new Set([
  'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Agent',
  'SendMessage', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
  'TeamCreate', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode',
  'CronCreate', 'WebFetch', 'WebSearch',
]);

const VALID_MODELS = ['opus', 'sonnet', 'haiku'];

interface AgentFrontmatter {
  name: string;
  description: string;
  tools: string;
  model: string;
  color: string;
  isolation?: string;
  skills?: string;
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Frontmatter is between the first pair of `---` lines.
 * Handles both LF and CRLF line endings.
 */
function parseFrontmatter(content: string): AgentFrontmatter {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('No frontmatter found');
  return parseYaml(match[1]) as AgentFrontmatter;
}

// Load all agents synchronously at module level so describe.each can use them
const agentFiles = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
const agents: Record<string, AgentFrontmatter> = {};
for (const file of agentFiles) {
  const content = readFileSync(join(AGENTS_DIR, file), 'utf-8');
  agents[file] = parseFrontmatter(content);
}

const MINIMUM_REQUIRED_FILES = [
  'hive.md',
  'hive-developer.md',
  'hive-reviewer.md',
  'hive-tester.md',
  'hive-researcher.md',
  'hive-monitor.md',
];

describe('Agent frontmatter', () => {
  it('has all required agent markdown files', () => {
    for (const file of MINIMUM_REQUIRED_FILES) {
      expect(agentFiles, `Missing required agent file: ${file}`).toContain(file);
    }
  });

  it('has at least 6 agent markdown files', () => {
    expect(agentFiles.length).toBeGreaterThanOrEqual(6);
  });

  describe.each(agentFiles)('%s', (file) => {
    it('has valid YAML frontmatter', () => {
      expect(agents[file]).toBeDefined();
      expect(typeof agents[file]).toBe('object');
    });

    it('has required fields: name, description, tools, model, color', () => {
      const fm = agents[file];
      expect(fm.name).toBeDefined();
      expect(fm.description).toBeDefined();
      expect(fm.tools).toBeDefined();
      expect(fm.model).toBeDefined();
      expect(fm.color).toBeDefined();
    });

    it('agent name matches filename', () => {
      const expectedName = file.replace('.md', '');
      expect(agents[file].name).toBe(expectedName);
    });

    it('all listed tools are valid Claude Code tool names', () => {
      const tools = agents[file].tools.split(',').map(t => t.trim());
      for (const tool of tools) {
        expect(VALID_TOOLS.has(tool), `Unknown tool: "${tool}" in ${file}`).toBe(true);
      }
    });

    it('model is one of opus, sonnet, haiku', () => {
      expect(VALID_MODELS).toContain(agents[file].model);
    });
  });

  it('hive-developer has isolation: worktree', () => {
    expect(agents['hive-developer.md'].isolation).toBe('worktree');
  });

  it('hive-tester has isolation: worktree', () => {
    expect(agents['hive-tester.md'].isolation).toBe('worktree');
  });

  it('hive-reviewer has Write in tools (ISS-25 fix)', () => {
    const tools = agents['hive-reviewer.md'].tools.split(',').map(t => t.trim());
    expect(tools).toContain('Write');
  });

  it('hive-researcher has Write in tools (ISS-26 fix)', () => {
    const tools = agents['hive-researcher.md'].tools.split(',').map(t => t.trim());
    expect(tools).toContain('Write');
  });

  it('hive-reviewer has skills: simplify', () => {
    expect(agents['hive-reviewer.md'].skills).toBe('simplify');
  });
});
