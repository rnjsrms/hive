import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCommunicationEntry } from '../../src/log-communication.js';

describe('buildCommunicationEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should build entry from valid input with string message', () => {
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_input: { to: 'team-lead', message: 'hello', summary: 'greeting' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).toEqual({
      ts: '2026-03-21T12:00:00.000Z',
      session_id: 'sess-1',
      from: '',
      to: 'team-lead',
      summary: 'greeting',
      message: 'hello',
    });
  });

  it('should stringify object messages', () => {
    const input = JSON.stringify({
      session_id: 'sess-2',
      tool_input: { to: 'dev-1', message: { type: 'status', ok: true } },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('{"type":"status","ok":true}');
  });

  it('should not truncate long messages', () => {
    const longMsg = 'x'.repeat(5000);
    const input = JSON.stringify({
      session_id: 'sess-3',
      tool_input: { to: 'dev-2', message: longMsg },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toHaveLength(5000);
    expect(result!.message).not.toContain('...[truncated]');
  });

  // --- from field tests ---

  it('should parse from field from [hive:xxx] tag in message', () => {
    const input = JSON.stringify({
      session_id: 'sess-f1',
      tool_input: { to: 'team-lead', message: '[hive:dev-1] task complete' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.from).toBe('dev-1');
  });

  it('should parse from field with lead identity', () => {
    const input = JSON.stringify({
      session_id: 'sess-f2',
      tool_input: { to: 'dev-1', message: '[hive:lead] please work on WI-5' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.from).toBe('lead');
  });

  it('should default from to empty string when no hive tag', () => {
    const input = JSON.stringify({
      session_id: 'sess-f3',
      tool_input: { to: 'dev-1', message: 'no tag here' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.from).toBe('');
  });

  it('should default from to empty string for object messages', () => {
    const input = JSON.stringify({
      session_id: 'sess-f4',
      tool_input: { to: 'dev-1', message: { type: 'shutdown_request' } },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.from).toBe('');
  });

  // --- summary field tests ---

  it('should capture summary from tool_input', () => {
    const input = JSON.stringify({
      session_id: 'sess-s1',
      tool_input: { to: 'dev-1', message: 'hello', summary: 'Quick greeting' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Quick greeting');
  });

  it('should default summary to empty string when missing', () => {
    const input = JSON.stringify({
      session_id: 'sess-s2',
      tool_input: { to: 'dev-1', message: 'hello' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('');
  });

  // --- default/edge cases ---

  it('should default session_id to empty string when missing', () => {
    const input = JSON.stringify({ tool_input: { to: 'x', message: 'hi' } });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe('');
  });

  it('should default to to empty string when missing', () => {
    const input = JSON.stringify({ session_id: 's', tool_input: { message: 'hi' } });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.to).toBe('');
  });

  it('should default message to empty string when missing', () => {
    const input = JSON.stringify({ session_id: 's', tool_input: { to: 'x' } });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('');
  });

  it('should handle missing tool_input gracefully', () => {
    const input = JSON.stringify({ session_id: 's' });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.to).toBe('');
    expect(result!.message).toBe('');
    expect(result!.from).toBe('');
    expect(result!.summary).toBe('');
  });

  it('should handle empty object input', () => {
    const input = JSON.stringify({});
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe('');
    expect(result!.to).toBe('');
    expect(result!.message).toBe('');
    expect(result!.from).toBe('');
    expect(result!.summary).toBe('');
  });

  it('should return null for invalid JSON', () => {
    expect(buildCommunicationEntry('not json')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(buildCommunicationEntry('')).toBeNull();
  });

  // --- falsy and non-string edge cases ---

  it('should stringify array message', () => {
    const input = JSON.stringify({
      tool_input: { message: ['item1', 'item2'] },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('["item1","item2"]');
  });

  it('should default numeric 0 message to empty string (falsy)', () => {
    const input = JSON.stringify({
      tool_input: { message: 0 },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('');
  });

  it('should default boolean false message to empty string (falsy)', () => {
    const input = JSON.stringify({
      tool_input: { message: false },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('');
  });

  it('should default null message to empty string (falsy)', () => {
    const input = JSON.stringify({
      tool_input: { message: null },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('');
  });
});
