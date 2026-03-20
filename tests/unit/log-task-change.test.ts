import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTaskChangeEntry } from '../../src/log-task-change.js';

describe('buildTaskChangeEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should build entry from valid input with string output', () => {
    const input = JSON.stringify({
      tool_name: 'TaskUpdate',
      tool_input: { taskId: '1', status: 'completed' },
      tool_output: 'Task updated',
    });
    const result = buildTaskChangeEntry(input);
    expect(result).toEqual({
      ts: '2026-03-21T12:00:00.000Z',
      tool: 'TaskUpdate',
      input: { taskId: '1', status: 'completed' },
      output: 'Task updated',
    });
  });

  it('should stringify object output', () => {
    const input = JSON.stringify({
      tool_name: 'TaskCreate',
      tool_input: { subject: 'test' },
      tool_output: { id: '5', ok: true },
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('{"id":"5","ok":true}');
  });

  it('should truncate output longer than 2000 characters', () => {
    const longOutput = 'z'.repeat(2500);
    const input = JSON.stringify({
      tool_name: 'TaskGet',
      tool_input: {},
      tool_output: longOutput,
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toHaveLength(2000 + '...[truncated]'.length);
    expect(result!.output.endsWith('...[truncated]')).toBe(true);
  });

  it('should not truncate output exactly 2000 characters', () => {
    const exactOutput = 'y'.repeat(2000);
    const input = JSON.stringify({
      tool_name: 'TaskGet',
      tool_input: {},
      tool_output: exactOutput,
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toHaveLength(2000);
    expect(result!.output).not.toContain('...[truncated]');
  });

  it('should truncate output of 2001 characters', () => {
    const output = 'w'.repeat(2001);
    const input = JSON.stringify({
      tool_name: 'TaskGet',
      tool_input: {},
      tool_output: output,
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output.endsWith('...[truncated]')).toBe(true);
  });

  it('should default tool to empty string when missing', () => {
    const input = JSON.stringify({ tool_input: {}, tool_output: 'ok' });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('');
  });

  it('should default input to empty object when missing', () => {
    const input = JSON.stringify({ tool_name: 'X', tool_output: 'ok' });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.input).toEqual({});
  });

  it('should default output to empty string when missing', () => {
    const input = JSON.stringify({ tool_name: 'X', tool_input: {} });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('');
  });

  it('should handle empty object input', () => {
    const input = JSON.stringify({});
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('');
    expect(result!.input).toEqual({});
    expect(result!.output).toBe('');
  });

  it('should return null for invalid JSON', () => {
    expect(buildTaskChangeEntry('not json')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(buildTaskChangeEntry('')).toBeNull();
  });

  // --- falsy and non-string edge cases ---

  it('should stringify array output', () => {
    const input = JSON.stringify({
      tool_name: 'X',
      tool_input: {},
      tool_output: [1, 2, 3],
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('[1,2,3]');
  });

  it('should default numeric 0 output to empty string (falsy)', () => {
    const input = JSON.stringify({
      tool_name: 'X',
      tool_input: {},
      tool_output: 0,
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('');
  });

  it('should default boolean false output to empty string (falsy)', () => {
    const input = JSON.stringify({
      tool_name: 'X',
      tool_input: {},
      tool_output: false,
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('');
  });

  it('should default null output to empty string (falsy)', () => {
    const input = JSON.stringify({
      tool_name: 'X',
      tool_input: {},
      tool_output: null,
    });
    const result = buildTaskChangeEntry(input);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('');
  });
});
