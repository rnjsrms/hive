import { describe, it, expect, beforeAll } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');
const SCHEMAS_DIR = join(ROOT, 'src/schemas');

function loadSchema(name: string) {
  const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, name), 'utf-8'));
  delete schema.$schema;
  return schema;
}

let ajv: InstanceType<typeof Ajv>;
let validate: ReturnType<InstanceType<typeof Ajv>['compile']>;

beforeAll(() => {
  ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  validate = ajv.compile(loadSchema('activity-log.schema.json'));
});

describe('activity-log.schema.json', () => {
  it('should accept a valid full entry', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'dev-1',
      action: 'STATUS_CHANGE',
      work_item: 'wi-3',
      details: 'Changed status to IN-PROGRESS',
    });
    expect(valid).toBe(true);
  });

  it('should accept entry with null work_item', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'lead',
      action: 'CONVOY_CREATED',
      work_item: null,
      details: 'Created convoy-1',
    });
    expect(valid).toBe(true);
  });

  it('should accept minimal entry with only required fields', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'reviewer',
      action: 'HEARTBEAT',
    });
    expect(valid).toBe(true);
  });

  it('should reject missing ts', () => {
    const valid = validate({
      agent: 'dev-1',
      action: 'STATUS_CHANGE',
    });
    expect(valid).toBe(false);
  });

  it('should reject missing agent', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      action: 'STATUS_CHANGE',
    });
    expect(valid).toBe(false);
  });

  it('should reject missing action', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'dev-1',
    });
    expect(valid).toBe(false);
  });

  it('should reject invalid ts format', () => {
    const valid = validate({
      ts: 'not-a-date',
      agent: 'dev-1',
      action: 'STATUS_CHANGE',
    });
    expect(valid).toBe(false);
  });

  it('should reject invalid work_item format', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'dev-1',
      action: 'STATUS_CHANGE',
      work_item: 'invalid-id',
    });
    expect(valid).toBe(false);
  });

  it('should reject additional properties', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: 'dev-1',
      action: 'STATUS_CHANGE',
      extra: 'not allowed',
    });
    expect(valid).toBe(false);
  });

  it('should reject empty agent string', () => {
    const valid = validate({
      ts: '2026-03-22T10:00:00Z',
      agent: '',
      action: 'STATUS_CHANGE',
    });
    expect(valid).toBe(false);
  });
});
