import { describe, it, expect, beforeAll } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const SCHEMAS_DIR = join(__dirname, '../../src/schemas');

function loadSchema(name: string) {
  const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, name), 'utf-8'));
  // Remove $schema meta-reference so AJV doesn't try to resolve draft-2020-12
  delete schema.$schema;
  return schema;
}

let ajv: InstanceType<typeof Ajv>;

beforeAll(() => {
  ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
});

// ---------------------------------------------------------------------------
// Work Item schema
// ---------------------------------------------------------------------------

describe('Work item schema', () => {
  const validWorkItem = {
    id: 'wi-1',
    title: 'Implement login',
    type: 'feature',
    risk: 'medium',
    status: 'OPEN',
    assignee: null,
    convoy: 'convoy-1',
    branch: null,
    description: 'Implement the login page',
    acceptance_criteria: ['Users can log in', 'Error messages shown'],
    dependencies: [],
    history: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  it('validates a correct work item', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    expect(validate(validWorkItem)).toBe(true);
  });

  it('validates a work item with history entries', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const wi = {
      ...validWorkItem,
      history: [
        { action: 'created', agent: 'lead', ts: '2025-01-01T00:00:00Z' },
        { action: 'assigned', agent: 'dev-1', ts: '2025-01-01T01:00:00Z', notes: 'Assigned to dev-1' },
      ],
    };
    expect(validate(wi)).toBe(true);
  });

  it('rejects missing required fields', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const incomplete = { id: 'wi-1', title: 'Test' };
    expect(validate(incomplete)).toBe(false);
  });

  it('rejects invalid status', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const bad = { ...validWorkItem, status: 'invalid-status' };
    expect(validate(bad)).toBe(false);
  });

  it('rejects invalid type', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const bad = { ...validWorkItem, type: 'epic' };
    expect(validate(bad)).toBe(false);
  });

  it('rejects invalid id pattern', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const bad = { ...validWorkItem, id: 'WI-1' };
    expect(validate(bad)).toBe(false);
  });

  it('rejects additional properties', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const bad = { ...validWorkItem, extra_field: 'not allowed' };
    expect(validate(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Convoy schema
// ---------------------------------------------------------------------------

describe('Convoy schema', () => {
  const validConvoy = {
    id: 'convoy-1',
    name: 'Login Feature',
    status: 'IN_PROGRESS',
    plan: 'plan-2025-01-01.md',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    work_items: ['wi-1', 'wi-2'],
    agents: ['dev-1', 'reviewer', 'tester'],
  };

  it('validates a correct convoy', () => {
    const validate = ajv.compile(loadSchema('convoy.schema.json'));
    expect(validate(validConvoy)).toBe(true);
  });

  it('rejects missing required fields', () => {
    const validate = ajv.compile(loadSchema('convoy.schema.json'));
    const incomplete = { id: 'convoy-1', name: 'Test' };
    expect(validate(incomplete)).toBe(false);
  });

  it('rejects invalid status', () => {
    const validate = ajv.compile(loadSchema('convoy.schema.json'));
    const bad = { ...validConvoy, status: 'running' };
    expect(validate(bad)).toBe(false);
  });

  it('rejects invalid id pattern', () => {
    const validate = ajv.compile(loadSchema('convoy.schema.json'));
    const bad = { ...validConvoy, id: 'CONVOY-1' };
    expect(validate(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Agent registry schema
// ---------------------------------------------------------------------------

describe('Agent registry schema', () => {
  const validRegistry = {
    agents: [
      { id: 'dev-1', role: 'developer', status: 'ACTIVE', current_work_item: 'wi-1', convoy_id: 'convoy-1', last_heartbeat: null },
      { id: 'reviewer', role: 'reviewer', status: 'IDLE', current_work_item: null, convoy_id: 'convoy-1', last_heartbeat: '2026-01-01T00:00:00Z' },
    ],
  };

  it('validates correct agent registry data', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    expect(validate(validRegistry)).toBe(true);
  });

  it('validates empty agents array', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    expect(validate({ agents: [] })).toBe(true);
  });

  it('rejects invalid role', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    const bad = {
      agents: [{ id: 'x', role: 'manager', status: 'ACTIVE', current_work_item: null, convoy_id: 'convoy-1', last_heartbeat: null }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects invalid status', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    const bad = {
      agents: [{ id: 'x', role: 'developer', status: 'running', current_work_item: null, convoy_id: 'convoy-1', last_heartbeat: null }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects agent entry missing convoy_id', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    const bad = {
      agents: [{ id: 'x', role: 'developer', status: 'ACTIVE', current_work_item: null, last_heartbeat: null }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects agent entry missing last_heartbeat', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    const bad = {
      agents: [{ id: 'x', role: 'developer', status: 'ACTIVE', current_work_item: null, convoy_id: 'convoy-1' }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects last_heartbeat with invalid date-time format', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    const bad = {
      agents: [{ id: 'x', role: 'developer', status: 'ACTIVE', current_work_item: null, convoy_id: 'convoy-1', last_heartbeat: 'not-a-date' }],
    };
    expect(validate(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sequence schema
// ---------------------------------------------------------------------------

describe('Sequence schema', () => {
  it('validates {"next_id": 1}', () => {
    const validate = ajv.compile(loadSchema('sequence.schema.json'));
    expect(validate({ next_id: 1 })).toBe(true);
  });

  it('validates higher next_id values', () => {
    const validate = ajv.compile(loadSchema('sequence.schema.json'));
    expect(validate({ next_id: 100 })).toBe(true);
  });

  it('rejects {"next_id": 0} (minimum is 1)', () => {
    const validate = ajv.compile(loadSchema('sequence.schema.json'));
    expect(validate({ next_id: 0 })).toBe(false);
  });

  it('rejects missing next_id', () => {
    const validate = ajv.compile(loadSchema('sequence.schema.json'));
    expect(validate({})).toBe(false);
  });

  it('rejects additional properties', () => {
    const validate = ajv.compile(loadSchema('sequence.schema.json'));
    expect(validate({ next_id: 1, extra: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Index schema
// ---------------------------------------------------------------------------

describe('Index schema', () => {
  it('validates correct index entries', () => {
    const validate = ajv.compile(loadSchema('index.schema.json'));
    const valid = {
      items: [
        { id: 'wi-1', status: 'OPEN', assignee: null },
        { id: 'wi-2', status: 'IN_PROGRESS', assignee: 'dev-1' },
      ],
    };
    expect(validate(valid)).toBe(true);
  });

  it('validates empty items array', () => {
    const validate = ajv.compile(loadSchema('index.schema.json'));
    expect(validate({ items: [] })).toBe(true);
  });

  it('rejects missing items field', () => {
    const validate = ajv.compile(loadSchema('index.schema.json'));
    expect(validate({})).toBe(false);
  });

  it('rejects extra fields on index entries (additionalProperties)', () => {
    const validate = ajv.compile(loadSchema('index.schema.json'));
    expect(validate({
      items: [{ id: 'wi-1', status: 'OPEN', assignee: null, extraField: 'bad' }],
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// additionalProperties enforcement across all schemas
// ---------------------------------------------------------------------------

describe('Schema strictness (additionalProperties: false)', () => {
  it('agent-registry rejects extra fields on agent entries', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    expect(validate({
      agents: [{
        id: 'dev-1', role: 'developer', status: 'ACTIVE',
        current_work_item: null, convoy_id: 'convoy-1', last_heartbeat: null,
        rogue_field: true,
      }],
    })).toBe(false);
  });

  it('agent-registry rejects extra fields at top level', () => {
    const validate = ajv.compile(loadSchema('agent-registry.schema.json'));
    expect(validate({
      agents: [],
      unexpected: 'value',
    })).toBe(false);
  });

  it('hooks-config rejects extra fields at top level', () => {
    const validate = ajv.compile(loadSchema('hooks-config.schema.json'));
    expect(validate({
      hooks: { PostToolUse: [] },
      extra: true,
    })).toBe(false);
  });

  it('plugin-manifest rejects extra fields', () => {
    const validate = ajv.compile(loadSchema('plugin-manifest.schema.json'));
    expect(validate({
      name: 'test', version: '1.0.0', description: 'test',
      notInSchema: 'bad',
    })).toBe(false);
  });

  it('work-item rejects extra fields', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const valid = {
      id: 'wi-1', title: 'Test', type: 'feature', risk: 'low',
      status: 'OPEN', convoy: 'convoy-1', description: 'Test',
      acceptance_criteria: [], dependencies: [], history: [],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };
    expect(validate(valid)).toBe(true);
    expect(validate({ ...valid, phantom: 'field' })).toBe(false);
  });

  it('work-item history entry accepts valid fields (action, agent, ts, notes)', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const wi = {
      id: 'wi-1', title: 'Test', type: 'feature', risk: 'low',
      status: 'OPEN', convoy: 'convoy-1', description: 'Test',
      acceptance_criteria: [], dependencies: [],
      history: [
        { action: 'TESTS_PASS', agent: 'tester', ts: '2026-01-01T00:00:00Z' },
        { action: 'APPROVED', agent: 'reviewer', ts: '2026-01-01T01:00:00Z', notes: 'LGTM' },
      ],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };
    expect(validate(wi)).toBe(true);
  });

  it('work-item history entry rejects extra fields (additionalProperties)', () => {
    const validate = ajv.compile(loadSchema('work-item.schema.json'));
    const wi = {
      id: 'wi-1', title: 'Test', type: 'feature', risk: 'low',
      status: 'OPEN', convoy: 'convoy-1', description: 'Test',
      acceptance_criteria: [], dependencies: [],
      history: [
        { action: 'TESTS_PASS', agent: 'tester', ts: '2026-01-01T00:00:00Z', rogue_field: 'bad' },
      ],
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    };
    expect(validate(wi)).toBe(false);
  });
});
