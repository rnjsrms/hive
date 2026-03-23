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

  it('does not have TeammateIdle entries (removed — caused interrupt loops)', () => {
    expect(hooks.hooks.TeammateIdle).toBeUndefined();
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
// hive.md state machine / schema alignment
// ---------------------------------------------------------------------------

describe('state machine alignment', () => {
  it('hive.md state machine statuses match work-item schema enum', () => {
    const wiSchema = loadSchema('work-item.schema.json');
    const schemaStatuses: string[] = wiSchema.properties.status.enum;

    const hiveMd = readFileSync(
      join(ROOT, 'plugins/hive/agents/hive.md'),
      'utf-8',
    );

    // Every status in the schema should appear somewhere in hive.md
    for (const status of schemaStatuses) {
      expect(
        hiveMd,
        `Status "${status}" from schema not found in hive.md`,
      ).toContain(status);
    }
  });

  it('feature schema statuses are documented in hive.md', () => {
    const featureSchema = loadSchema('feature.schema.json');
    const schemaStatuses: string[] = featureSchema.properties.status.enum;

    const hiveMd = readFileSync(
      join(ROOT, 'plugins/hive/agents/hive.md'),
      'utf-8',
    );

    for (const status of schemaStatuses) {
      expect(
        hiveMd,
        `Feature status "${status}" from schema not found in hive.md`,
      ).toContain(status);
    }
  });

  it('agent registry base roles from schema pattern appear in hive.md', () => {
    const agentSchema = loadSchema('agent-registry.schema.json');
    const rolePattern: string = agentSchema.properties.agents.items.properties.role.pattern;
    // Extract base roles from the pattern: ^(developer|reviewer|tester|researcher|monitor)(:[a-z]...)?$
    const baseRolesMatch = rolePattern.match(/\(([^)]+)\)/);
    expect(baseRolesMatch).not.toBeNull();
    const roles = baseRolesMatch![1].split('|');

    const hiveMd = readFileSync(
      join(ROOT, 'plugins/hive/agents/hive.md'),
      'utf-8',
    );

    for (const role of roles) {
      expect(
        hiveMd,
        `Agent base role "${role}" from schema not found in hive.md`,
      ).toContain(role);
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

// ---------------------------------------------------------------------------
// cross-file version consistency
// ---------------------------------------------------------------------------

describe('version consistency across all config files', () => {
  it('package.json version matches plugin.json version', () => {
    const pkg = loadJson(join(ROOT, 'package.json'));
    const plugin = loadJson(PLUGIN_PATH);
    expect(pkg.version).toBe(plugin.version);
  });

  it('all 4 version sources agree (package.json, package-lock.json, plugin.json, marketplace.json)', () => {
    const pkg = loadJson(join(ROOT, 'package.json'));
    const pkgLock = loadJson(join(ROOT, 'package-lock.json'));
    const plugin = loadJson(PLUGIN_PATH);
    const marketplace = loadJson(MARKETPLACE_PATH);
    const marketplaceVersion =
      marketplace.metadata?.version ||
      marketplace.plugins?.[0]?.version;

    const versions = new Set([pkg.version, pkgLock.version, plugin.version, marketplaceVersion]);
    expect(
      versions.size,
      `Version mismatch: package.json=${pkg.version}, package-lock.json=${pkgLock.version}, plugin.json=${plugin.version}, marketplace.json=${marketplaceVersion}`,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// .hive/config.json schema
// ---------------------------------------------------------------------------

describe('.hive/config.json schema validation', () => {
  it('validates a correct config with base_branch', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ name: 'hive', version: '1.2.0', base_branch: 'develop' })).toBe(true);
  });

  it('validates config without optional base_branch', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ name: 'hive', version: '1.2.0' })).toBe(true);
  });

  it('rejects config without required name', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ version: '1.2.0' })).toBe(false);
  });

  it('rejects config with invalid version format', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ name: 'hive', version: 'bad' })).toBe(false);
  });

  it('rejects config with extra fields', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ name: 'hive', version: '1.0.0', rogue: true })).toBe(false);
  });

  it('accepts valid created_at with ISO 8601 date-time format', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ name: 'hive', version: '1.0.0', created_at: '2026-03-21T12:00:00Z' })).toBe(true);
  });

  it('rejects created_at with invalid date-time format', () => {
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate({ name: 'hive', version: '1.0.0', created_at: 'not-a-date' })).toBe(false);
  });

  it('hive.md bootstrap config template matches config schema', () => {
    const hiveMd = readFileSync(join(ROOT, 'plugins/hive/agents/hive.md'), 'utf-8');
    // Extract the JSON config template from hive.md
    const configMatch = hiveMd.match(/\{"name":\s*"hive".*?"base_branch".*?\}/);
    expect(configMatch).not.toBeNull();
    const configTemplate = JSON.parse(configMatch![0]);
    const validate = ajv.compile(loadSchema('config.schema.json'));
    expect(validate(configTemplate)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// settings.json (agent replacement config)
// ---------------------------------------------------------------------------

describe('plugin settings.json validation', () => {
  const SETTINGS_PATH = join(ROOT, 'plugins/hive/settings.json');

  it('exists and is valid JSON', () => {
    expect(existsSync(SETTINGS_PATH)).toBe(true);
    const settings = loadJson(SETTINGS_PATH);
    expect(typeof settings).toBe('object');
  });

  it('specifies "agent": "hive" to replace default Claude agent', () => {
    const settings = loadJson(SETTINGS_PATH);
    expect(settings.agent).toBe('hive');
  });

  it('agent value matches lead agent filename (hive.md)', () => {
    const settings = loadJson(SETTINGS_PATH);
    const agentFile = join(ROOT, 'plugins/hive/agents', `${settings.agent}.md`);
    expect(
      existsSync(agentFile),
      `Agent "${settings.agent}" specified in settings.json but ${agentFile} not found`,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// bootstrap directory/file structure (validates hive.md Step 1 + Step 2)
// ---------------------------------------------------------------------------

describe('hive.md bootstrap structure validation', () => {
  it('hive.md Step 1 references all required .hive/ subdirectories', () => {
    const hiveMd = readFileSync(
      join(ROOT, 'plugins/hive/agents/hive.md'),
      'utf-8',
    );
    const requiredDirs = ['plans', 'research', 'work-items', 'features', 'agents', 'logs', 'archive'];
    for (const dir of requiredDirs) {
      expect(
        hiveMd,
        `Bootstrap should create .hive/${dir}`,
      ).toContain(`.hive/${dir}`);
    }
  });

  it('hive.md Step 2 references all required state files', () => {
    const hiveMd = readFileSync(
      join(ROOT, 'plugins/hive/agents/hive.md'),
      'utf-8',
    );
    const requiredFiles = [
      'config.json',
      '_index.json',
      'activity.jsonl',
      'communications.jsonl',
      'task-ledger.jsonl',
    ];
    for (const file of requiredFiles) {
      expect(
        hiveMd,
        `Bootstrap should create ${file}`,
      ).toContain(file);
    }
  });

  it('all scripts referenced in hooks.json exist on disk', () => {
    // This is a cross-check: hooks.json references scripts, verify they're all real files
    const hooks = loadJson(HOOKS_PATH);
    const scriptNames: string[] = [];
    for (const [, entries] of Object.entries(hooks.hooks)) {
      for (const entry of entries as any[]) {
        for (const h of (entry.hooks || [])) {
          const match = (h.command || '').match(/scripts\/([^\s"]+)/);
          if (match) scriptNames.push(match[1]);
        }
      }
    }
    // Verify we found scripts AND they all exist
    expect(scriptNames.length).toBeGreaterThanOrEqual(5);
    for (const name of scriptNames) {
      expect(
        existsSync(join(SCRIPTS_DIR, name)),
        `Hook script ${name} not found in ${SCRIPTS_DIR}`,
      ).toBe(true);
    }
  });
});
