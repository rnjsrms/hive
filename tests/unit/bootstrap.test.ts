import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRequiredDirs,
  getRequiredFiles,
  validateStateFile,
  validateWorkItemRefs,
  initializeHive,
  validateState,
  type FsOps,
} from '../../src/bootstrap.js';

/** In-memory filesystem mock */
function createMockFs(): FsOps & { files: Record<string, string>; dirs: Set<string> } {
  const files: Record<string, string> = {};
  const dirs = new Set<string>();
  return {
    files,
    dirs,
    existsSync(path: string) {
      return dirs.has(path) || path in files;
    },
    mkdirSync(path: string) {
      dirs.add(path);
    },
    writeFileSync(path: string, data: string) {
      files[path] = data;
    },
    readFileSync(path: string) {
      if (!(path in files)) throw new Error(`ENOENT: ${path}`);
      return files[path];
    },
    readdirSync(path: string) {
      const prefix = path.endsWith('/') ? path : path + '/';
      const entries = new Set<string>();
      for (const key of Object.keys(files)) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const name = rest.split('/')[0];
          entries.add(name);
        }
      }
      return [...entries];
    },
  };
}

// ---------------------------------------------------------------------------
// getRequiredDirs
// ---------------------------------------------------------------------------

describe('getRequiredDirs', () => {
  it('returns all 7 required directories', () => {
    const dirs = getRequiredDirs();
    expect(dirs).toHaveLength(7);
    expect(dirs).toContain('plans');
    expect(dirs).toContain('research');
    expect(dirs).toContain('work-items');
    expect(dirs).toContain('features');
    expect(dirs).toContain('agents');
    expect(dirs).toContain('logs');
    expect(dirs).toContain('archive');
  });

  it('returns a new array each call (no shared mutation)', () => {
    const a = getRequiredDirs();
    const b = getRequiredDirs();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// getRequiredFiles
// ---------------------------------------------------------------------------

describe('getRequiredFiles', () => {
  it('returns 6 required state files (includes role-catalog.json)', () => {
    const files = getRequiredFiles();
    expect(Object.keys(files)).toHaveLength(6);
  });

  it('includes config.json', () => {
    const files = getRequiredFiles();
    expect(files['config.json']).toEqual({ name: 'hive', version: '2.2.0', base_branch: 'develop' });
  });

  it('includes work-items index and sequence', () => {
    const files = getRequiredFiles();
    expect(files['work-items/_index.json']).toEqual({ items: [] });
    expect(files['work-items/_sequence.json']).toEqual({ next_id: 1 });
  });

  it('includes features index', () => {
    const files = getRequiredFiles();
    expect(files['features/_index.json']).toEqual({ items: [] });
  });

  it('includes agents index', () => {
    const files = getRequiredFiles();
    expect(files['agents/_index.json']).toEqual({ agents: [] });
  });

  it('includes role-catalog.json with default specializations', () => {
    const files = getRequiredFiles();
    const catalog = files['role-catalog.json'] as { specializations: unknown[] };
    expect(catalog).toBeDefined();
    expect(catalog.specializations).toBeDefined();
    expect(Array.isArray(catalog.specializations)).toBe(true);
    expect(catalog.specializations.length).toBeGreaterThan(0);
  });

  it('all values are valid JSON-serializable objects', () => {
    const files = getRequiredFiles();
    for (const [, value] of Object.entries(files)) {
      expect(typeof value).toBe('object');
      expect(() => JSON.stringify(value)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// validateStateFile
// ---------------------------------------------------------------------------

describe('validateStateFile', () => {
  it('returns valid for correct JSON object', () => {
    expect(validateStateFile('{"items":[]}')).toEqual({ valid: true, errors: [] });
  });

  it('returns valid for JSON with nested data', () => {
    expect(validateStateFile('{"a":{"b":1},"c":[1,2]}')).toEqual({ valid: true, errors: [] });
  });

  it('returns invalid for malformed JSON', () => {
    const result = validateStateFile('{bad json');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Invalid JSON/);
  });

  it('returns invalid for empty string', () => {
    const result = validateStateFile('');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for JSON array (not an object)', () => {
    const result = validateStateFile('[1,2,3]');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a JSON object');
  });

  it('returns invalid for JSON primitive', () => {
    const result = validateStateFile('"hello"');
    expect(result.valid).toBe(false);
  });

  it('returns invalid for null', () => {
    const result = validateStateFile('null');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateWorkItemRefs
// ---------------------------------------------------------------------------

describe('validateWorkItemRefs', () => {
  it('returns valid when all refs exist', () => {
    const result = validateWorkItemRefs(
      { work_items: ['wi-1', 'wi-2'] },
      ['wi-1', 'wi-2', 'wi-3'],
    );
    expect(result.valid).toBe(true);
    expect(result.danglingRefs).toHaveLength(0);
  });

  it('returns dangling refs for missing work items', () => {
    const result = validateWorkItemRefs(
      { work_items: ['wi-1', 'wi-2', 'wi-3'] },
      ['wi-1'],
    );
    expect(result.valid).toBe(false);
    expect(result.danglingRefs).toEqual(['wi-2', 'wi-3']);
  });

  it('returns valid for empty work_items array', () => {
    const result = validateWorkItemRefs({ work_items: [] }, ['wi-1']);
    expect(result.valid).toBe(true);
    expect(result.danglingRefs).toHaveLength(0);
  });

  it('returns valid when work_items field is missing', () => {
    const result = validateWorkItemRefs({}, ['wi-1']);
    expect(result.valid).toBe(true);
    expect(result.danglingRefs).toHaveLength(0);
  });

  it('returns valid for empty existing IDs with empty refs', () => {
    const result = validateWorkItemRefs({ work_items: [] }, []);
    expect(result.valid).toBe(true);
  });

  it('returns all refs as dangling when existing IDs is empty', () => {
    const result = validateWorkItemRefs({ work_items: ['wi-1'] }, []);
    expect(result.valid).toBe(false);
    expect(result.danglingRefs).toEqual(['wi-1']);
  });
});

// ---------------------------------------------------------------------------
// initializeHive
// ---------------------------------------------------------------------------

describe('initializeHive', () => {
  let fs: ReturnType<typeof createMockFs>;

  beforeEach(() => {
    fs = createMockFs();
  });

  it('creates all required directories', () => {
    const result = initializeHive('/project', fs);
    expect(result.created).toBe(true);
    expect(result.directories).toContain('plans');
    expect(result.directories).toContain('research');
    expect(result.directories).toContain('work-items');
    expect(result.directories).toContain('features');
    expect(result.directories).toContain('agents');
    expect(result.directories).toContain('logs');
    expect(result.directories).toContain('archive');
    expect(result.directories).toHaveLength(7);
  });

  it('creates all state files with correct content', () => {
    initializeHive('/project', fs);
    expect(JSON.parse(fs.files['/project/.hive/config.json'])).toEqual({ name: 'hive', version: '2.2.0', base_branch: 'develop' });
    expect(JSON.parse(fs.files['/project/.hive/work-items/_index.json'])).toEqual({ items: [] });
    expect(JSON.parse(fs.files['/project/.hive/work-items/_sequence.json'])).toEqual({ next_id: 1 });
    expect(JSON.parse(fs.files['/project/.hive/features/_index.json'])).toEqual({ items: [] });
    expect(JSON.parse(fs.files['/project/.hive/agents/_index.json'])).toEqual({ agents: [] });
    const catalog = JSON.parse(fs.files['/project/.hive/role-catalog.json']);
    expect(catalog.specializations).toBeDefined();
    expect(catalog.specializations.length).toBe(5);
  });

  it('creates empty log files', () => {
    initializeHive('/project', fs);
    expect(fs.files['/project/.hive/logs/activity.jsonl']).toBe('');
    expect(fs.files['/project/.hive/logs/communications.jsonl']).toBe('');
    expect(fs.files['/project/.hive/logs/task-ledger.jsonl']).toBe('');
  });

  it('creates .gitkeep files in plans, research, and archive', () => {
    initializeHive('/project', fs);
    expect(fs.files['/project/.hive/plans/.gitkeep']).toBe('');
    expect(fs.files['/project/.hive/research/.gitkeep']).toBe('');
    expect(fs.files['/project/.hive/archive/.gitkeep']).toBe('');
  });

  it('returns file list including state files, logs, and gitkeeps', () => {
    const result = initializeHive('/project', fs);
    expect(result.files).toContain('work-items/_index.json');
    expect(result.files).toContain('features/_index.json');
    expect(result.files).toContain('logs/activity.jsonl');
    expect(result.files).toContain('plans/.gitkeep');
  });

  it('skips initialization if .hive/ already exists', () => {
    fs.dirs.add('/project/.hive');
    const result = initializeHive('/project', fs);
    expect(result.created).toBe(false);
    expect(result.directories).toHaveLength(0);
    expect(result.files).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateState
// ---------------------------------------------------------------------------

describe('validateState', () => {
  let fs: ReturnType<typeof createMockFs>;

  beforeEach(() => {
    fs = createMockFs();
    // Set up a valid .hive directory
    fs.dirs.add('/project/.hive');
    fs.dirs.add('/project/.hive/work-items');
    fs.dirs.add('/project/.hive/features');
    fs.dirs.add('/project/.hive/agents');
    fs.files['/project/.hive/config.json'] = '{"name":"hive","version":"2.2.0","base_branch":"develop"}';
    fs.files['/project/.hive/work-items/_index.json'] = '{"items":[]}';
    fs.files['/project/.hive/work-items/_sequence.json'] = '{"next_id":1}';
    fs.files['/project/.hive/features/_index.json'] = '{"items":[]}';
    fs.files['/project/.hive/agents/_index.json'] = '{"agents":[]}';
    fs.files['/project/.hive/role-catalog.json'] = '{"specializations":[]}';
  });

  it('returns valid for a correct .hive directory', () => {
    const result = validateState('/project', fs);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns invalid if .hive/ does not exist', () => {
    const emptyFs = createMockFs();
    const result = validateState('/project', emptyFs);
    expect(result.valid).toBe(false);
    expect(result.warnings[0].message).toBe('Directory does not exist');
  });

  it('warns on missing state files', () => {
    delete fs.files['/project/.hive/work-items/_index.json'];
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual({
      file: 'work-items/_index.json',
      message: 'File missing',
    });
  });

  it('warns on invalid JSON in state files', () => {
    fs.files['/project/.hive/features/_index.json'] = '{bad json';
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    const warning = result.warnings.find(w => w.file === 'features/_index.json');
    expect(warning).toBeDefined();
    expect(warning!.message).toMatch(/Invalid JSON/);
  });

  it('warns on invalid JSON in feature files', () => {
    fs.files['/project/.hive/features/TEST-1.json'] = '{not valid}';
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual({
      file: 'features/TEST-1.json',
      message: 'Invalid JSON',
    });
  });

  it('warns when feature references missing work item', () => {
    fs.files['/project/.hive/features/TEST-1.json'] = JSON.stringify({
      id: 'TEST-1',
      work_items: ['TEST-1_WI-1', 'TEST-1_WI-2'],
    });
    fs.files['/project/.hive/work-items/TEST-1_WI-1.json'] = JSON.stringify({ id: 'TEST-1_WI-1' });
    // TEST-1_WI-2 is missing
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual({
      file: 'features/TEST-1.json',
      message: 'References missing work item: TEST-1_WI-2',
    });
  });

  it('does not warn when all feature work items exist', () => {
    fs.files['/project/.hive/features/TEST-1.json'] = JSON.stringify({
      id: 'TEST-1',
      work_items: ['TEST-1_WI-1'],
    });
    fs.files['/project/.hive/work-items/TEST-1_WI-1.json'] = JSON.stringify({ id: 'TEST-1_WI-1' });
    const result = validateState('/project', fs);
    expect(result.valid).toBe(true);
  });

  it('warns on duplicate work item IDs', () => {
    fs.files['/project/.hive/work-items/TEST-1_WI-1.json'] = JSON.stringify({ id: 'TEST-1_WI-1' });
    fs.files['/project/.hive/work-items/TEST-2_WI-1.json'] = JSON.stringify({ id: 'TEST-1_WI-1' });
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    const dupWarning = result.warnings.find(w => w.message.includes('Duplicate'));
    expect(dupWarning).toBeDefined();
  });

  it('warns on invalid JSON in work item files', () => {
    fs.files['/project/.hive/work-items/TEST-1_WI-1.json'] = 'not json';
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    expect(result.warnings).toContainEqual({
      file: 'work-items/TEST-1_WI-1.json',
      message: 'Invalid JSON',
    });
  });

  it('handles feature with empty work_items array', () => {
    fs.files['/project/.hive/features/TEST-1.json'] = JSON.stringify({
      id: 'TEST-1',
      work_items: [],
    });
    const result = validateState('/project', fs);
    expect(result.valid).toBe(true);
  });

  it('handles feature with no work_items field', () => {
    fs.files['/project/.hive/features/TEST-1.json'] = JSON.stringify({
      id: 'TEST-1',
    });
    const result = validateState('/project', fs);
    expect(result.valid).toBe(true);
  });

  it('ignores non-feature files in features directory', () => {
    fs.files['/project/.hive/features/_index.json'] = '{"items":[]}';
    fs.files['/project/.hive/features/_sequence.json'] = '{"next_id":1}';
    // These should not be parsed as feature files
    const result = validateState('/project', fs);
    expect(result.valid).toBe(true);
  });

  it('accumulates multiple warnings', () => {
    delete fs.files['/project/.hive/work-items/_index.json'];
    fs.files['/project/.hive/features/_index.json'] = '{bad}';
    fs.files['/project/.hive/work-items/TEST-1_WI-1.json'] = 'invalid';
    const result = validateState('/project', fs);
    expect(result.valid).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
  });
});
