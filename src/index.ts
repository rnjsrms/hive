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
  createFeature,
  createWorkItem,
  getNextId,
  incrementSequence,
  type FsOps as FeatureFactoryFsOps,
  type SequenceData,
  type FeatureConfig,
  type FeatureData,
  type WorkItemConfig,
  type WorkItemData,
} from './feature-factory.js';
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
export { validateTransition, type TransitionResult } from './validate-transition.js';
export {
  DEFAULT_SPECIALIZATIONS,
  DEFAULT_ROLE_CATALOG,
  type Specialization,
  type RoleCatalog,
} from './role-catalog-defaults.js';
export {
  buildPrBody,
  buildPrTitle,
  buildPrCreateCommand,
  buildPrReviewCommand,
  buildPrCommentCommand,
  validateFeaturePrConfig,
  checkPrerequisites,
  type FeaturePrConfig,
  type FeatureWorkItemSummary,
  type PrCreateCommand,
  type ReviewComment,
  type PrReviewCommand,
  type PrCommentCommand,
  type PrerequisiteCheck,
} from './feature-pr.js';
