import { describe, it, expect } from 'vitest';
import { isValidTransition, type WorkItemStatus } from '../../src/state-machine.js';

const ALL_STATUSES: WorkItemStatus[] = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'APPROVED',
  'CHANGES_REQUESTED', 'TESTING', 'TESTS_FAILED', 'READY_TO_MERGE',
  'BLOCKED', 'MERGED', 'CANCELLED',
];

describe('isValidTransition', () => {
  // --- Happy path: all valid transitions ---

  describe('valid transitions', () => {
    const validCases: [WorkItemStatus, WorkItemStatus][] = [
      ['OPEN', 'ASSIGNED'],
      ['ASSIGNED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'REVIEW'],
      ['IN_PROGRESS', 'BLOCKED'],
      ['REVIEW', 'APPROVED'],
      ['REVIEW', 'CHANGES_REQUESTED'],
      ['APPROVED', 'TESTING'],
      ['CHANGES_REQUESTED', 'IN_PROGRESS'],
      ['TESTING', 'READY_TO_MERGE'],
      ['TESTING', 'TESTS_FAILED'],
      ['TESTS_FAILED', 'IN_PROGRESS'],
      ['READY_TO_MERGE', 'MERGED'],
      ['BLOCKED', 'IN_PROGRESS'],
    ];

    it.each(validCases)('%s → %s returns true', (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  });

  // --- CANCELLED reachable from any non-terminal state ---

  describe('CANCELLED reachable from any non-terminal state', () => {
    const cancellableSources: WorkItemStatus[] = ALL_STATUSES.filter(
      s => s !== 'MERGED' && s !== 'CANCELLED',
    );

    it.each(cancellableSources)('%s → CANCELLED returns true', (from) => {
      expect(isValidTransition(from, 'CANCELLED')).toBe(true);
    });
  });

  // --- Terminal states have no outgoing transitions ---

  describe('terminal states', () => {
    it.each(ALL_STATUSES)('MERGED → %s returns false', (to) => {
      expect(isValidTransition('MERGED', to)).toBe(false);
    });

    it.each(ALL_STATUSES)('CANCELLED → %s returns false', (to) => {
      expect(isValidTransition('CANCELLED', to)).toBe(false);
    });
  });

  // --- Invalid transitions ---

  describe('invalid transitions', () => {
    const invalidCases: [WorkItemStatus, WorkItemStatus][] = [
      ['OPEN', 'IN_PROGRESS'],
      ['OPEN', 'REVIEW'],
      ['OPEN', 'MERGED'],
      ['ASSIGNED', 'REVIEW'],
      ['ASSIGNED', 'OPEN'],
      ['IN_PROGRESS', 'ASSIGNED'],
      ['IN_PROGRESS', 'APPROVED'],
      ['IN_PROGRESS', 'MERGED'],
      ['REVIEW', 'IN_PROGRESS'],
      ['REVIEW', 'TESTING'],
      ['REVIEW', 'MERGED'],
      ['APPROVED', 'REVIEW'],
      ['APPROVED', 'MERGED'],
      ['APPROVED', 'IN_PROGRESS'],
      ['CHANGES_REQUESTED', 'REVIEW'],
      ['CHANGES_REQUESTED', 'APPROVED'],
      ['TESTING', 'REVIEW'],
      ['TESTING', 'IN_PROGRESS'],
      ['TESTS_FAILED', 'TESTING'],
      ['TESTS_FAILED', 'REVIEW'],
      ['READY_TO_MERGE', 'TESTING'],
      ['READY_TO_MERGE', 'IN_PROGRESS'],
      ['BLOCKED', 'REVIEW'],
      ['BLOCKED', 'OPEN'],
    ];

    it.each(invalidCases)('%s → %s returns false', (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  });

  // --- Self-transitions are not allowed ---

  describe('self-transitions are not allowed', () => {
    it.each(ALL_STATUSES)('%s → %s returns false', (status) => {
      expect(isValidTransition(status, status)).toBe(false);
    });
  });
});
