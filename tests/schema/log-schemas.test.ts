import { describe, it, expect, beforeAll } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const SCHEMAS_DIR = join(__dirname, '../../src/schemas');

function loadSchema(name: string) {
  const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, name), 'utf-8'));
  delete schema.$schema;
  return schema;
}

let ajv: InstanceType<typeof Ajv>;

beforeAll(() => {
  ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
});

// ---------------------------------------------------------------------------
// Activity Log schema
// ---------------------------------------------------------------------------

describe('activity-log.schema.json', () => {
  let validate: ReturnType<InstanceType<typeof Ajv>['compile']>;

  beforeAll(() => {
    validate = ajv.compile(loadSchema('activity-log.schema.json'));
  });

  it('accepts a valid full entry', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'dev-1',
      action: 'STATUS_CHANGE',
      work_item: 'wi-3',
      status: 'IN_PROGRESS',
      notes: 'Changed status to IN_PROGRESS',
    })).toBe(true);
  });

  it('accepts minimal entry (required fields only)', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'lead',
      action: 'HEARTBEAT',
    })).toBe(true);
  });

  it('rejects missing ts', () => {
    expect(validate({ agent: 'dev-1', action: 'X' })).toBe(false);
  });

  it('rejects missing agent', () => {
    expect(validate({ ts: '2026-03-22T10:00:00Z', action: 'X' })).toBe(false);
  });

  it('rejects missing action', () => {
    expect(validate({ ts: '2026-03-22T10:00:00Z', agent: 'dev-1' })).toBe(false);
  });

  it('rejects additional properties', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'dev-1',
      action: 'X',
      extra: 'bad',
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Communications Log schema
// ---------------------------------------------------------------------------

describe('communications-log.schema.json', () => {
  let validate: ReturnType<InstanceType<typeof Ajv>['compile']>;

  beforeAll(() => {
    validate = ajv.compile(loadSchema('communications-log.schema.json'));
  });

  it('accepts a valid full entry', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      session_id: 'sess-abc',
      from: 'dev-1',
      to: 'lead',
      summary: 'Status update',
      message: 'Work item wi-3 is complete.',
    })).toBe(true);
  });

  it('accepts minimal entry (required fields only)', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      session_id: 'sess-abc',
      to: 'lead',
      message: 'Hello',
    })).toBe(true);
  });

  it('rejects missing ts', () => {
    expect(validate({
      session_id: 'sess-abc',
      to: 'lead',
      message: 'Hello',
    })).toBe(false);
  });

  it('rejects missing session_id', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      to: 'lead',
      message: 'Hello',
    })).toBe(false);
  });

  it('rejects missing to', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      session_id: 'sess-abc',
      message: 'Hello',
    })).toBe(false);
  });

  it('rejects missing message', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      session_id: 'sess-abc',
      to: 'lead',
    })).toBe(false);
  });

  it('rejects additional properties', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      session_id: 'sess-abc',
      to: 'lead',
      message: 'Hello',
      extra: 'bad',
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task Ledger schema
// ---------------------------------------------------------------------------

describe('task-ledger.schema.json', () => {
  let validate: ReturnType<InstanceType<typeof Ajv>['compile']>;

  beforeAll(() => {
    validate = ajv.compile(loadSchema('task-ledger.schema.json'));
  });

  it('accepts a valid full entry', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      tool: 'TaskUpdate',
      input: { taskId: '1', status: 'completed' },
      output: 'Updated task #1 status',
    })).toBe(true);
  });

  it('accepts minimal entry (required fields only)', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      tool: 'Bash',
    })).toBe(true);
  });

  it('rejects missing ts', () => {
    expect(validate({ tool: 'Bash' })).toBe(false);
  });

  it('rejects missing tool', () => {
    expect(validate({ ts: '2026-03-22T10:00:00Z' })).toBe(false);
  });

  it('rejects additional properties', () => {
    expect(validate({
      ts: '2026-03-22T10:00:00Z',
      tool: 'Bash',
      extra: 'bad',
    })).toBe(false);
  });
});
