import { describe, it, expect, beforeAll } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');
const SCHEMAS_DIR = join(ROOT, 'src/schemas');
const HOOKS_PATH = join(ROOT, 'plugins/hive/hooks/hooks.json');
const PLUGIN_PATH = join(ROOT, 'plugins/hive/.claude-plugin/plugin.json');
const MARKETPLACE_PATH = join(ROOT, '.claude-plugin/marketplace.json');
const SCRIPTS_DIR = join(ROOT, 'plugins/hive/scripts');

function loadSchema(name: string) {
  const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, name), 'utf-8'));
  // Remove $schema meta-reference so AJV doesn't try to resolve draft-2020-12
  delete schema.$schema;
  return schema;
}

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

let ajv: InstanceType<typeof Ajv>;

beforeAll(() => {
  ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
});

// ---------------------------------------------------------------------------
// hooks.json
// ---------------------------------------------------------------------------

describe('hooks.json validation', () => {
  let hooks: any;

  beforeAll(() => {
    hooks = loadJson(HOOKS_PATH);
  });

  it('is valid JSON and matches hooks schema', () => {
    const validate = ajv.compile(loadSchema('hooks-config.schema.json'));
    expect(validate(hooks)).toBe(true);
  });

  it('has PostToolUse entries', () => {
    expect(hooks.hooks.PostToolUse).toBeDefined();
    expect(Array.isArray(hooks.hooks.PostToolUse)).toBe(true);
    expect(hooks.hooks.PostToolUse.length).toBeGreaterThan(0);
  });

  it('has TaskCompleted entries', () => {
    expect(hooks.hooks.TaskCompleted).toBeDefined();
    expect(Array.isArray(hooks.hooks.TaskCompleted)).toBe(true);
    expect(hooks.hooks.TaskCompleted.length).toBeGreaterThan(0);
  });

  it('has TeammateIdle entries', () => {
    expect(hooks.hooks.TeammateIdle).toBeDefined();
    expect(Array.isArray(hooks.hooks.TeammateIdle)).toBe(true);
    expect(hooks.hooks.TeammateIdle.length).toBeGreaterThan(0);
  });

  it('hooks.json commands reference ${CLAUDE_PLUGIN_ROOT}/scripts/', () => {
    const allCommands: string[] = [];
    for (const [, entries] of Object.entries(hooks.hooks)) {
      for (const entry of entries as any[]) {
        const innerHooks = entry.hooks || [];
        for (const h of innerHooks) {
          if (h.command) allCommands.push(h.command);
        }
      }
    }
    // At least some commands should reference CLAUDE_PLUGIN_ROOT/scripts
    const scriptCommands = allCommands.filter(
      cmd => cmd.includes('${CLAUDE_PLUGIN_ROOT}/scripts/'),
    );
    expect(scriptCommands.length).toBeGreaterThan(0);
    // All bash commands should use the plugin root variable
    for (const cmd of allCommands) {
      if (cmd.includes('/scripts/') && cmd.startsWith('bash')) {
        expect(cmd).toContain('${CLAUDE_PLUGIN_ROOT}/scripts/');
      }
    }
  });

  it('all script files referenced in hooks.json actually exist', () => {
    const scriptRefs: string[] = [];
    for (const [, entries] of Object.entries(hooks.hooks)) {
      for (const entry of entries as any[]) {
        const innerHooks = entry.hooks || [];
        for (const h of innerHooks) {
          if (h.command) {
            // Extract script filename from commands like:
            //   bash "${CLAUDE_PLUGIN_ROOT}/scripts/foo.sh"
            //   powershell -File "${CLAUDE_PLUGIN_ROOT}/scripts/foo.ps1"
            const match = h.command.match(/scripts\/([^\s"]+)/);
            if (match) scriptRefs.push(match[1]);
          }
        }
      }
    }
    expect(scriptRefs.length).toBeGreaterThan(0);
    for (const scriptFile of scriptRefs) {
      const fullPath = join(SCRIPTS_DIR, scriptFile);
      expect(
        existsSync(fullPath),
        `Referenced script not found: ${scriptFile} (expected at ${fullPath})`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// plugin.json
// ---------------------------------------------------------------------------

describe('plugin.json validation', () => {
  let plugin: any;

  beforeAll(() => {
    plugin = loadJson(PLUGIN_PATH);
  });

  it('has required fields and matches plugin-manifest schema', () => {
    const validate = ajv.compile(loadSchema('plugin-manifest.schema.json'));
    expect(validate(plugin)).toBe(true);
  });

  it('version is valid semver', () => {
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ---------------------------------------------------------------------------
// marketplace.json
// ---------------------------------------------------------------------------

describe('marketplace.json validation', () => {
  let marketplace: any;

  beforeAll(() => {
    marketplace = loadJson(MARKETPLACE_PATH);
  });

  it('is valid JSON', () => {
    expect(marketplace).toBeDefined();
    expect(typeof marketplace).toBe('object');
  });

  it('version in plugin.json matches version in marketplace.json', () => {
    const plugin = loadJson(PLUGIN_PATH);
    // marketplace.json stores version in metadata.version and also in plugins[0].version
    const marketplaceVersion =
      marketplace.metadata?.version ||
      marketplace.plugins?.[0]?.version;
    expect(marketplaceVersion).toBe(plugin.version);
  });
});
