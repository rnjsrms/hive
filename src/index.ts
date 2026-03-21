/**
 * Hive Plugin - Testable module exports
 *
 * These modules mirror the inline JavaScript in plugins/hive/scripts/*.sh
 * and provide pure functions that can be unit tested without executing bash.
 */

export { buildCommunicationEntry, type CommunicationEntry } from './log-communication.js';
export { buildTaskChangeEntry, type TaskChangeEntry } from './log-task-change.js';
export { shouldAutoCommit } from './auto-commit.js';
export {
  extractWorkItemId,
  validateCompletion,
  type FsOps,
  type ValidationResult,
} from './validate-completion.js';
export { buildActivityEntry, type ActivityEntry } from './log-activity.js';
export { isValidTransition, type WorkItemStatus } from './state-machine.js';
