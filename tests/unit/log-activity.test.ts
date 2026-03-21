import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildActivityEntry } from '../../src/log-activity.js';

describe('buildActivityEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeWi = (overrides: any = {}) => JSON.stringify({
    id: 'wi-5',
    status: 'IN_PROGRESS',
    history: [
      { agent: 'dev-1', action: 'started', notes: 'beginning work' },
    ],
    ...overrides,
  });

  const makeInput = (filePath: string) => JSON.stringify({
    tool_input: { file_path: filePath },
  });

  const mockReadFile = (content: string) => () => content;

  it('should build entry from valid work-item file', () => {
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(makeWi()));
    expect(result).toEqual({
      ts: '2026-03-21T12:00:00.000Z',
      agent: 'dev-1',
      action: 'started',
      work_item: 'wi-5',
      status: 'IN_PROGRESS',
      notes: 'beginning work',
    });
  });

  it('should use the LAST history entry', () => {
    const wi = makeWi({
      history: [
        { agent: 'dev-1', action: 'started', notes: 'first' },
        { agent: 'dev-2', action: 'reviewed', notes: 'second' },
      ],
    });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).not.toBeNull();
    expect(result!.agent).toBe('dev-2');
    expect(result!.action).toBe('reviewed');
    expect(result!.notes).toBe('second');
  });

  it('should return null for non-work-item file paths', () => {
    const input = makeInput('/project/src/index.ts');
    const result = buildActivityEntry(input, mockReadFile('{}'));
    expect(result).toBeNull();
  });

  it('should return null when history is empty', () => {
    const wi = makeWi({ history: [] });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).toBeNull();
  });

  it('should return null when history is missing', () => {
    const wi = JSON.stringify({ id: 'wi-5', status: 'pending' });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).toBeNull();
  });

  it('should default notes to empty string when missing', () => {
    const wi = makeWi({
      history: [{ agent: 'dev-1', action: 'started' }],
    });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).not.toBeNull();
    expect(result!.notes).toBe('');
  });

  it('should default agent to empty string when missing', () => {
    const wi = makeWi({
      history: [{ action: 'started', notes: 'x' }],
    });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).not.toBeNull();
    expect(result!.agent).toBe('');
  });

  it('should default action to empty string when missing', () => {
    const wi = makeWi({
      history: [{ agent: 'dev-1', notes: 'x' }],
    });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).not.toBeNull();
    expect(result!.action).toBe('');
  });

  it('should default work_item id to empty string when missing', () => {
    const wi = JSON.stringify({
      status: 'done',
      history: [{ agent: 'a', action: 'b' }],
    });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).not.toBeNull();
    expect(result!.work_item).toBe('');
  });

  it('should default status to empty string when missing', () => {
    const wi = JSON.stringify({
      id: 'wi-5',
      history: [{ agent: 'a', action: 'b' }],
    });
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const result = buildActivityEntry(input, mockReadFile(wi));
    expect(result).not.toBeNull();
    expect(result!.status).toBe('');
  });

  it('should return null for invalid JSON input', () => {
    expect(buildActivityEntry('not json', mockReadFile('{}'))).toBeNull();
  });

  it('should return null for empty string input', () => {
    expect(buildActivityEntry('', mockReadFile('{}'))).toBeNull();
  });

  it('should return null when readFile throws', () => {
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    const throwingReader = () => { throw new Error('ENOENT'); };
    expect(buildActivityEntry(input, throwingReader)).toBeNull();
  });

  it('should return null when file content is invalid JSON', () => {
    const input = makeInput('/project/.hive/work-items/wi-5.json');
    expect(buildActivityEntry(input, mockReadFile('not json'))).toBeNull();
  });

  it('should return null when tool_input is missing', () => {
    const input = JSON.stringify({});
    expect(buildActivityEntry(input, mockReadFile('{}'))).toBeNull();
  });
});
