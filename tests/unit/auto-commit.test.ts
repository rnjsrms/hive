import { describe, it, expect } from 'vitest';
import { shouldAutoCommit } from '../../src/auto-commit.js';

describe('shouldAutoCommit', () => {
  it('should return true for .hive/ path (forward slash)', () => {
    const input = JSON.stringify({ tool_input: { file_path: '.hive/work-items/wi-1.json' } });
    expect(shouldAutoCommit(input)).toBe(true);
  });

  it('should return true for .hive\\ path (backslash)', () => {
    const input = JSON.stringify({ tool_input: { file_path: '.hive\\agents\\dev.md' } });
    expect(shouldAutoCommit(input)).toBe(true);
  });

  it('should return true for nested .hive/ path', () => {
    const input = JSON.stringify({ tool_input: { file_path: '/home/user/project/.hive/logs/x.jsonl' } });
    expect(shouldAutoCommit(input)).toBe(true);
  });

  it('should return false for non-.hive path', () => {
    const input = JSON.stringify({ tool_input: { file_path: 'src/index.ts' } });
    expect(shouldAutoCommit(input)).toBe(false);
  });

  it('should return false for path containing hive without dot prefix', () => {
    const input = JSON.stringify({ tool_input: { file_path: 'hive/config.json' } });
    expect(shouldAutoCommit(input)).toBe(false);
  });

  it('should return false when file_path is missing', () => {
    const input = JSON.stringify({ tool_input: {} });
    expect(shouldAutoCommit(input)).toBe(false);
  });

  it('should return false when tool_input is missing', () => {
    const input = JSON.stringify({});
    expect(shouldAutoCommit(input)).toBe(false);
  });

  it('should return false for empty file_path', () => {
    const input = JSON.stringify({ tool_input: { file_path: '' } });
    expect(shouldAutoCommit(input)).toBe(false);
  });

  it('should return false for invalid JSON', () => {
    expect(shouldAutoCommit('not json')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(shouldAutoCommit('')).toBe(false);
  });
});
