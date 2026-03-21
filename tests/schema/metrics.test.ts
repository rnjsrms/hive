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
  validate = ajv.compile(loadSchema('metrics.schema.json'));
});

describe('metrics.schema.json', () => {
  it('should accept valid idle metrics', () => {
    const valid = validate({
      autoresearch_status: 'idle',
      autoresearch_started_at: null,
      consecutive_reverts: 0,
    });
    expect(valid).toBe(true);
  });

  it('should accept valid running metrics with timestamp', () => {
    const valid = validate({
      autoresearch_status: 'running',
      autoresearch_started_at: '2026-03-22T10:00:00Z',
      consecutive_reverts: 3,
    });
    expect(valid).toBe(true);
  });

  it('should accept minimal object with only required field', () => {
    const valid = validate({
      autoresearch_status: 'idle',
    });
    expect(valid).toBe(true);
  });

  it('should reject missing autoresearch_status', () => {
    const valid = validate({
      consecutive_reverts: 0,
    });
    expect(valid).toBe(false);
  });

  it('should reject invalid autoresearch_status value', () => {
    const valid = validate({
      autoresearch_status: 'paused',
    });
    expect(valid).toBe(false);
  });

  it('should reject negative consecutive_reverts', () => {
    const valid = validate({
      autoresearch_status: 'idle',
      consecutive_reverts: -1,
    });
    expect(valid).toBe(false);
  });

  it('should reject additional properties', () => {
    const valid = validate({
      autoresearch_status: 'idle',
      extra_field: 'not allowed',
    });
    expect(valid).toBe(false);
  });

  it('should reject non-integer consecutive_reverts', () => {
    const valid = validate({
      autoresearch_status: 'idle',
      consecutive_reverts: 1.5,
    });
    expect(valid).toBe(false);
  });

  it('should reject autoresearch_started_at as non-datetime string', () => {
    const valid = validate({
      autoresearch_status: 'running',
      autoresearch_started_at: 'not-a-date',
    });
    expect(valid).toBe(false);
  });
});
