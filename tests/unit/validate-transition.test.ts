import { describe, it, expect } from 'vitest';
import { validateTransition } from '../../src/validate-transition.js';

function makeInput(filePath: string): string {
  return JSON.stringify({ tool_input: { file_path: filePath } });
}

function makeWi(status: string): string {
  return JSON.stringify({ id: 'wi-1', status });
}

describe('validateTransition', () => {
  it('should return valid for non-work-item file paths', () => {
    const input = makeInput('/project/src/index.ts');
    const result = validateTransition(input, '{}', null);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should return valid for sprint files', () => {
    const input = makeInput('/project/.hive/sprints/sprint-1.json');
    const result = validateTransition(input, '{}', null);
    expect(result.valid).toBe(true);
  });

  it('should return valid for index files', () => {
    const input = makeInput('/project/.hive/work-items/_index.json');
    const result = validateTransition(input, '{}', null);
    expect(result.valid).toBe(true);
  });

  it('should return valid for new file (no previous content)', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('OPEN'), null);
    expect(result.valid).toBe(true);
  });

  it('should return valid when status has not changed', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('OPEN'), makeWi('OPEN'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for OPEN → ASSIGNED', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('ASSIGNED'), makeWi('OPEN'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for OPEN → CANCELLED', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('CANCELLED'), makeWi('OPEN'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for ASSIGNED → IN_PROGRESS', () => {
    const input = makeInput('/project/.hive/work-items/wi-2.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('ASSIGNED'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for IN_PROGRESS → REVIEW', () => {
    const input = makeInput('/project/.hive/work-items/wi-3.json');
    const result = validateTransition(input, makeWi('REVIEW'), makeWi('IN_PROGRESS'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for IN_PROGRESS → BLOCKED', () => {
    const input = makeInput('/project/.hive/work-items/wi-3.json');
    const result = validateTransition(input, makeWi('BLOCKED'), makeWi('IN_PROGRESS'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for REVIEW → APPROVED', () => {
    const input = makeInput('/project/.hive/work-items/wi-4.json');
    const result = validateTransition(input, makeWi('APPROVED'), makeWi('REVIEW'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for REVIEW → CHANGES_REQUESTED', () => {
    const input = makeInput('/project/.hive/work-items/wi-4.json');
    const result = validateTransition(input, makeWi('CHANGES_REQUESTED'), makeWi('REVIEW'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for CHANGES_REQUESTED → IN_PROGRESS', () => {
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('CHANGES_REQUESTED'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for APPROVED → TESTING', () => {
    const input = makeInput('/project/.hive/work-items/wi-6.json');
    const result = validateTransition(input, makeWi('TESTING'), makeWi('APPROVED'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for TESTING → READY_TO_MERGE', () => {
    const input = makeInput('/project/.hive/work-items/wi-7.json');
    const result = validateTransition(input, makeWi('READY_TO_MERGE'), makeWi('TESTING'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for TESTING → TESTS_FAILED', () => {
    const input = makeInput('/project/.hive/work-items/wi-7.json');
    const result = validateTransition(input, makeWi('TESTS_FAILED'), makeWi('TESTING'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for TESTS_FAILED → IN_PROGRESS', () => {
    const input = makeInput('/project/.hive/work-items/wi-8.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('TESTS_FAILED'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for READY_TO_MERGE → MERGED', () => {
    const input = makeInput('/project/.hive/work-items/wi-9.json');
    const result = validateTransition(input, makeWi('MERGED'), makeWi('READY_TO_MERGE'));
    expect(result.valid).toBe(true);
  });

  it('should return valid for BLOCKED → IN_PROGRESS', () => {
    const input = makeInput('/project/.hive/work-items/wi-10.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('BLOCKED'));
    expect(result.valid).toBe(true);
  });

  // Invalid transitions

  it('should return invalid for OPEN → IN_PROGRESS (skipping ASSIGNED)', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('OPEN'));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Invalid transition');
    expect(result.message).toContain('OPEN');
    expect(result.message).toContain('IN_PROGRESS');
    expect(result.message).toContain('ASSIGNED, CANCELLED');
  });

  it('should return invalid for OPEN → REVIEW', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('REVIEW'), makeWi('OPEN'));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Invalid transition');
  });

  it('should return invalid for MERGED → anything (terminal state)', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('OPEN'), makeWi('MERGED'));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('terminal state');
  });

  it('should return invalid for CANCELLED → anything (terminal state)', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('CANCELLED'));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('terminal state');
  });

  it('should return invalid for REVIEW → IN_PROGRESS (must go through CHANGES_REQUESTED)', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('REVIEW'));
    expect(result.valid).toBe(false);
  });

  it('should return invalid for ASSIGNED → REVIEW (skipping IN_PROGRESS)', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('REVIEW'), makeWi('ASSIGNED'));
    expect(result.valid).toBe(false);
  });

  // Edge cases

  it('should return valid when new content has no status', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, JSON.stringify({ id: 'wi-1' }), makeWi('OPEN'));
    expect(result.valid).toBe(true);
  });

  it('should return valid when previous content has no status', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('OPEN'), JSON.stringify({ id: 'wi-1' }));
    expect(result.valid).toBe(true);
  });

  it('should return valid when new content is invalid JSON', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, '{broken', makeWi('OPEN'));
    expect(result.valid).toBe(true);
  });

  it('should return valid when previous content is invalid JSON', () => {
    const input = makeInput('/project/.hive/work-items/wi-1.json');
    const result = validateTransition(input, makeWi('ASSIGNED'), '{broken');
    expect(result.valid).toBe(true);
  });

  it('should return valid when input JSON is invalid', () => {
    const result = validateTransition('not json', makeWi('OPEN'), null);
    expect(result.valid).toBe(true);
  });

  it('should return valid for empty tool_input', () => {
    const input = JSON.stringify({ tool_input: {} });
    const result = validateTransition(input, makeWi('OPEN'), null);
    expect(result.valid).toBe(true);
  });

  it('should handle Windows-style backslash paths', () => {
    const input = makeInput('C:\\project\\.hive\\work-items\\wi-1.json');
    const result = validateTransition(input, makeWi('IN_PROGRESS'), makeWi('OPEN'));
    expect(result.valid).toBe(false);
  });

  it('should validate all CANCELLED transitions are allowed', () => {
    const states = [
      'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'APPROVED',
      'CHANGES_REQUESTED', 'TESTING', 'TESTS_FAILED', 'READY_TO_MERGE', 'BLOCKED',
    ];
    for (const status of states) {
      const input = makeInput('/project/.hive/work-items/wi-1.json');
      const result = validateTransition(input, makeWi('CANCELLED'), makeWi(status));
      expect(result.valid).toBe(true);
    }
  });
});
