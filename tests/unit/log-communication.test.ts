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
      tool_input: { to: 'team-lead', message: 'hello' },
    });
    const result = buildCommunicationEntry(input);
    expect(result).toEqual({
      ts: '2026-03-21T12:00:00.000Z',
      session_id: 'sess-1',
      to: 'team-lead',
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

  it('should truncate messages longer than 1000 characters', () => {
    const longMsg = 'x'.repeat(1500);
    const input = JSON.stringify({
      session_id: 'sess-3',
      tool_input: { to: 'dev-2', message: longMsg },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toHaveLength(1000 + '...[truncated]'.length);
    expect(result!.message.endsWith('...[truncated]')).toBe(true);
  });

  it('should not truncate messages exactly 1000 characters', () => {
    const exactMsg = 'a'.repeat(1000);
    const input = JSON.stringify({
      session_id: 'sess-4',
      tool_input: { to: 'dev-1', message: exactMsg },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message).toHaveLength(1000);
    expect(result!.message).not.toContain('...[truncated]');
  });

  it('should truncate messages of 1001 characters', () => {
    const msg = 'b'.repeat(1001);
    const input = JSON.stringify({
      session_id: 'sess-5',
      tool_input: { to: 'dev-1', message: msg },
    });
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.message.endsWith('...[truncated]')).toBe(true);
  });

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
  });

  it('should handle empty object input', () => {
    const input = JSON.stringify({});
    const result = buildCommunicationEntry(input);
    expect(result).not.toBeNull();
    expect(result!.session_id).toBe('');
    expect(result!.to).toBe('');
    expect(result!.message).toBe('');
  });

  it('should return null for invalid JSON', () => {
    expect(buildCommunicationEntry('not json')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(buildCommunicationEntry('')).toBeNull();
  });
});
