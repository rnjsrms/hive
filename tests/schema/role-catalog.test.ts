import { describe, it, expect, beforeAll } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_ROLE_CATALOG, DEFAULT_SPECIALIZATIONS } from '../../src/role-catalog-defaults.js';

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

describe('Role catalog schema', () => {
  it('validates the default role catalog', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    expect(validate(DEFAULT_ROLE_CATALOG)).toBe(true);
  });

  it('validates empty specializations array', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    expect(validate({ specializations: [] })).toBe(true);
  });

  it('rejects specialization with invalid base_role', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'test', base_role: 'manager', triggers: ['tag:test'],
        brief: 'Focus on testing', model: 'opus',
      }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects specialization with invalid model', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'test', base_role: 'reviewer', triggers: ['tag:test'],
        brief: 'Focus on testing', model: 'gpt-4',
      }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects specialization with invalid trigger format', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'test', base_role: 'reviewer', triggers: ['invalid-trigger'],
        brief: 'Focus on testing', model: 'opus',
      }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects specialization with empty triggers array', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'test', base_role: 'reviewer', triggers: [],
        brief: 'Focus on testing', model: 'opus',
      }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects specialization with empty brief', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'test', base_role: 'reviewer', triggers: ['tag:test'],
        brief: '', model: 'opus',
      }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects specialization with uppercase name', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'Security', base_role: 'reviewer', triggers: ['tag:auth'],
        brief: 'Focus on security', model: 'opus',
      }],
    };
    expect(validate(bad)).toBe(false);
  });

  it('rejects additional properties on specialization', () => {
    const validate = ajv.compile(loadSchema('role-catalog.schema.json'));
    const bad = {
      specializations: [{
        name: 'test', base_role: 'reviewer', triggers: ['tag:test'],
        brief: 'Focus on testing', model: 'opus', extra: 'not allowed',
      }],
    };
    expect(validate(bad)).toBe(false);
  });
});

describe('Default specializations', () => {
  it('has exactly 5 default specializations', () => {
    expect(DEFAULT_SPECIALIZATIONS).toHaveLength(5);
  });

  it('includes security specialization', () => {
    const sec = DEFAULT_SPECIALIZATIONS.find(s => s.name === 'security');
    expect(sec).toBeDefined();
    expect(sec!.base_role).toBe('reviewer');
    expect(sec!.model).toBe('opus');
    expect(sec!.triggers).toContain('risk:high');
  });

  it('includes architecture specialization', () => {
    const arch = DEFAULT_SPECIALIZATIONS.find(s => s.name === 'architecture');
    expect(arch).toBeDefined();
    expect(arch!.base_role).toBe('reviewer');
    expect(arch!.model).toBe('opus');
  });

  it('includes api-contract specialization', () => {
    const api = DEFAULT_SPECIALIZATIONS.find(s => s.name === 'api-contract');
    expect(api).toBeDefined();
    expect(api!.base_role).toBe('reviewer');
    expect(api!.model).toBe('sonnet');
  });

  it('includes performance specialization', () => {
    const perf = DEFAULT_SPECIALIZATIONS.find(s => s.name === 'performance');
    expect(perf).toBeDefined();
    expect(perf!.base_role).toBe('reviewer');
    expect(perf!.model).toBe('sonnet');
  });

  it('includes compliance specialization', () => {
    const comp = DEFAULT_SPECIALIZATIONS.find(s => s.name === 'compliance');
    expect(comp).toBeDefined();
    expect(comp!.base_role).toBe('reviewer');
    expect(comp!.model).toBe('sonnet');
  });

  it('all specializations have non-empty briefs', () => {
    for (const spec of DEFAULT_SPECIALIZATIONS) {
      expect(spec.brief.length, `${spec.name} brief should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('all specialization names are unique', () => {
    const names = DEFAULT_SPECIALIZATIONS.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all triggers follow tag:/type:/risk: pattern', () => {
    for (const spec of DEFAULT_SPECIALIZATIONS) {
      for (const trigger of spec.triggers) {
        expect(trigger, `Invalid trigger "${trigger}" in ${spec.name}`).toMatch(/^(tag|type|risk):[a-z][a-z0-9-]*$/);
      }
    }
  });
});
