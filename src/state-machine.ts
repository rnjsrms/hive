export type WorkItemStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'TESTING'
  | 'TESTS_FAILED'
  | 'READY_TO_MERGE'
  | 'BLOCKED'
  | 'MERGED'
  | 'CANCELLED';

const VALID_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  OPEN: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['REVIEW', 'BLOCKED', 'CANCELLED'],
  REVIEW: ['APPROVED', 'CHANGES_REQUESTED', 'CANCELLED'],
  APPROVED: ['TESTING', 'CANCELLED'],
  CHANGES_REQUESTED: ['IN_PROGRESS', 'CANCELLED'],
  TESTING: ['READY_TO_MERGE', 'TESTS_FAILED', 'CANCELLED'],
  TESTS_FAILED: ['IN_PROGRESS', 'CANCELLED'],
  READY_TO_MERGE: ['MERGED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  MERGED: [],
  CANCELLED: [],
};

export function isValidTransition(from: WorkItemStatus, to: WorkItemStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}
