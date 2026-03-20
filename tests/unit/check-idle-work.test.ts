import { describe, it, expect } from 'vitest';
import { checkForIdleWork } from '../../src/check-idle-work.js';

describe('checkForIdleWork', () => {
  it('should return "found" when there are open unassigned items', () => {
    const index = JSON.stringify({
      items: [{ status: 'open', assignee: null }],
    });
    expect(checkForIdleWork(index)).toBe('found');
  });

  it('should return "found" when assignee is undefined', () => {
    const index = JSON.stringify({
      items: [{ status: 'open' }],
    });
    expect(checkForIdleWork(index)).toBe('found');
  });

  it('should return "none" when all open items have assignees', () => {
    const index = JSON.stringify({
      items: [{ status: 'open', assignee: 'dev-1' }],
    });
    expect(checkForIdleWork(index)).toBe('none');
  });

  it('should return "none" when items are closed with no assignee', () => {
    const index = JSON.stringify({
      items: [{ status: 'closed', assignee: null }],
    });
    expect(checkForIdleWork(index)).toBe('none');
  });

  it('should return "none" when items array is empty', () => {
    const index = JSON.stringify({ items: [] });
    expect(checkForIdleWork(index)).toBe('none');
  });

  it('should return "none" when items key is missing', () => {
    const index = JSON.stringify({});
    expect(checkForIdleWork(index)).toBe('none');
  });

  it('should return "found" with mixed items including one open unassigned', () => {
    const index = JSON.stringify({
      items: [
        { status: 'closed', assignee: null },
        { status: 'open', assignee: 'dev-2' },
        { status: 'open', assignee: null },
      ],
    });
    expect(checkForIdleWork(index)).toBe('found');
  });

  it('should return "none" with all items assigned or non-open', () => {
    const index = JSON.stringify({
      items: [
        { status: 'open', assignee: 'dev-1' },
        { status: 'closed', assignee: null },
        { status: 'in-progress', assignee: 'dev-2' },
      ],
    });
    expect(checkForIdleWork(index)).toBe('none');
  });

  it('should return "none" for invalid JSON', () => {
    expect(checkForIdleWork('not json')).toBe('none');
  });

  it('should return "none" for empty string', () => {
    expect(checkForIdleWork('')).toBe('none');
  });

  it('should treat assignee empty string as assigned (not null)', () => {
    const index = JSON.stringify({
      items: [{ status: 'open', assignee: '' }],
    });
    expect(checkForIdleWork(index)).toBe('none');
  });
});
