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
export { isValidTransition, VALID_TRANSITIONS, type WorkItemStatus } from './state-machine.js';
export {
  createSprint,
  createWorkItem,
  getNextId,
  incrementSequence,
  type FsOps as SprintFactoryFsOps,
  type SequenceData,
  type SprintConfig,
  type SprintData,
  type WorkItemConfig,
  type WorkItemData,
} from './sprint-factory.js';
export {
  getRequiredDirs,
  getRequiredFiles,
  validateStateFile,
  validateWorkItemRefs,
  initializeHive,
  validateState,
  type FsOps as BootstrapFsOps,
  type InitResult,
  type StateFileValidation,
  type WorkItemRefValidation,
  type ValidationResult as BootstrapValidationResult,
  type ValidationWarning,
} from './bootstrap.js';
