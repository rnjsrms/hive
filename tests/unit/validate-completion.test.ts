import { describe, it, expect } from 'vitest';
import {
  extractWorkItemId,
  validateCompletion,
  type FsOps,
} from '../../src/validate-completion.js';

describe('extractWorkItemId', () => {
  it('should extract from metadata.work_item_id', () => {
    const input = JSON.stringify({
      tool_input: { metadata: { work_item_id: 'WI-5' } },
    });
    expect(extractWorkItemId(input)).toBe('WI-5');
  });

  it('should extract from tool_input.work_item_id', () => {
    const input = JSON.stringify({
      tool_input: { work_item_id: 'WI-3' },
    });
    expect(extractWorkItemId(input)).toBe('WI-3');
  });

  it('should extract from tool_input.id', () => {
    const input = JSON.stringify({
      tool_input: { id: 'WI-7' },
    });
    expect(extractWorkItemId(input)).toBe('WI-7');
  });

  it('should extract WI-N from subject when no explicit id', () => {
    const input = JSON.stringify({
      tool_input: { subject: 'Complete WI-12 implementation' },
    });
    expect(extractWorkItemId(input)).toBe('WI-12');
  });

  it('should prefer metadata.work_item_id over tool_input.id', () => {
    const input = JSON.stringify({
      tool_input: { id: 'WI-1', metadata: { work_item_id: 'WI-2' } },
    });
    expect(extractWorkItemId(input)).toBe('WI-2');
  });

  it('should return null when no id found', () => {
    const input = JSON.stringify({ tool_input: { subject: 'no id here' } });
    expect(extractWorkItemId(input)).toBeNull();
  });

  it('should return null for empty tool_input', () => {
    const input = JSON.stringify({ tool_input: {} });
    expect(extractWorkItemId(input)).toBeNull();
  });

  it('should return null for missing tool_input', () => {
    const input = JSON.stringify({});
    expect(extractWorkItemId(input)).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    expect(extractWorkItemId('bad')).toBeNull();
  });

  it('should match case-insensitive WI pattern in subject', () => {
    const input = JSON.stringify({
      tool_input: { subject: 'Fix wi-4 bug' },
    });
    expect(extractWorkItemId(input)).toBe('wi-4');
  });
});

describe('validateCompletion', () => {
  function makeFsOps(files: Record<string, string>): FsOps {
    return {
      existsSync: (path: string) => path in files,
      readdirSync: (_path: string) => Object.keys(files).map((p) => p.split('/').pop()!),
      readFileSync: (path: string, _encoding: string) => {
        if (path in files) return files[path];
        throw new Error('ENOENT');
      },
    };
  }

  const validWi = JSON.stringify({
    status: 'READY_TO_MERGE',
    history: [{ action: 'TESTS_PASS' }, { action: 'APPROVED' }],
  });

  it('should return valid for input with no work item id', () => {
    const input = JSON.stringify({ tool_input: {} });
    const fs = makeFsOps({});
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should return valid when work item file does not exist and no matching files', () => {
    const input = JSON.stringify({ tool_input: { id: 'WI-99' } });
    const fs: FsOps = {
      existsSync: () => false,
      readdirSync: () => [],
      readFileSync: () => { throw new Error('ENOENT'); },
    };
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should return valid for work item with status done and TESTS_PASS and APPROVED', () => {
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': validWi });
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should return valid for status READY_TO_MERGE with APPROVED', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      history: [{ action: 'TESTS_PASS' }, { action: 'APPROVED' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should return valid for status MERGED with APPROVED', () => {
    const wi = JSON.stringify({
      status: 'MERGED',
      history: [{ action: 'TESTS_PASS' }, { action: 'APPROVED' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should report error for invalid status', () => {
    const wi = JSON.stringify({
      status: 'IN_PROGRESS',
      history: [{ action: 'TESTS_PASS' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Work item status is "IN_PROGRESS", must be "READY_TO_MERGE" or "MERGED"'
    );
  });

  it('should report error for missing status', () => {
    const wi = JSON.stringify({ history: [{ action: 'TESTS_PASS' }] });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('must be "READY_TO_MERGE"');
  });

  it('should report error for missing TESTS_PASS', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      history: [{ action: 'REVIEWED' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing tester TESTS_PASS entry in history');
  });

  it('should report error for missing TESTS_PASS with empty history', () => {
    const wi = JSON.stringify({ status: 'READY_TO_MERGE', history: [] });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing tester TESTS_PASS entry in history');
  });

  it('should report error for any item missing APPROVED', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      risk: 'high',
      history: [{ action: 'TESTS_PASS' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing reviewer APPROVED entry in history');
  });

  it('should pass for high-risk item with APPROVED', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      risk: 'high',
      history: [{ action: 'TESTS_PASS' }, { action: 'APPROVED' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should reject low-risk item without APPROVED', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      risk: 'low',
      history: [{ action: 'TESTS_PASS' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing reviewer APPROVED entry in history');
  });

  it('should pass for low-risk item with APPROVED', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      risk: 'low',
      history: [{ action: 'TESTS_PASS' }, { action: 'APPROVED' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should accumulate multiple errors', () => {
    const wi = JSON.stringify({
      status: 'open',
      risk: 'high',
      history: [],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it('should find work item file by exact lowercase match in directory', () => {
    const wi = JSON.stringify({
      status: 'READY_TO_MERGE',
      history: [{ action: 'TESTS_PASS' }, { action: 'APPROVED' }],
    });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs: FsOps = {
      existsSync: (path: string) => {
        if (path === '/wi/WI-1.json') return false;
        return path === '/wi/wi-1.json';
      },
      readdirSync: () => ['wi-1.json', '_index.json'],
      readFileSync: (path: string) => {
        if (path === '/wi/wi-1.json') return wi;
        throw new Error('ENOENT');
      },
    };
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should NOT match wi-1 against wi-10 (exact matching)', () => {
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs: FsOps = {
      existsSync: () => false,
      readdirSync: () => ['wi-10.json', 'wi-11.json'],
      readFileSync: () => { throw new Error('ENOENT'); },
    };
    // wi-1 should NOT match wi-10.json — exact match only
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should not match partial filenames in directory scan', () => {
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs: FsOps = {
      existsSync: () => false,
      readdirSync: () => ['wi-1-feature.json', '_WI-1-backup.json'],
      readFileSync: () => { throw new Error('ENOENT'); },
    };
    // wi-1-feature.json is NOT an exact match for wi-1.json
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should return valid when readFileSync throws', () => {
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs: FsOps = {
      existsSync: () => true,
      readdirSync: () => [],
      readFileSync: () => { throw new Error('read error'); },
    };
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should return valid when work item file contains invalid JSON', () => {
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': 'not json' });
    expect(validateCompletion(input, '/wi', fs)).toEqual({ valid: true, errors: [] });
  });

  it('should handle missing history key', () => {
    const wi = JSON.stringify({ status: 'READY_TO_MERGE' });
    const input = JSON.stringify({ tool_input: { id: 'WI-1' } });
    const fs = makeFsOps({ '/wi/WI-1.json': wi });
    const result = validateCompletion(input, '/wi', fs);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing tester TESTS_PASS entry in history');
    expect(result.errors).toContain('Missing reviewer APPROVED entry in history');
  });
});
