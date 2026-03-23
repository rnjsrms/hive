import { isValidTransition, VALID_TRANSITIONS, type WorkItemStatus } from './state-machine.js';

export interface TransitionResult {
  valid: boolean;
  message: string;
}

/**
 * Validates a work item status transition.
 *
 * @param inputJson  The hook input JSON (contains tool_input.file_path)
 * @param newContent The new file content (after write)
 * @param previousContent The previous file content (before write), or null if new file
 */
export function validateTransition(
  inputJson: string,
  newContent: string,
  previousContent: string | null,
): TransitionResult {
  try {
    const data = JSON.parse(inputJson);
    const filePath = (data.tool_input || {}).file_path || '';
    const normalized = filePath.replace(/\\/g, '/');

    // Only validate work-item JSON files (v2.2.0 Jira-format + legacy fallback)
    if (!normalized.match(/\.hive\/work-items\/[A-Z][A-Z0-9]+-\d+_WI-\d+\.json$/) && !normalized.match(/\.hive\/work-items\/(?:feature-\w+_)?wi-\d+\.json$/i)) {
      return { valid: true, message: '' };
    }

    // Parse new content
    let newStatus: string;
    try {
      const newWi = JSON.parse(newContent);
      newStatus = newWi.status;
    } catch {
      return { valid: true, message: '' };
    }
    if (!newStatus) return { valid: true, message: '' };

    // No previous content — new file, allow
    if (previousContent === null) {
      return { valid: true, message: '' };
    }

    // Parse previous content
    let oldStatus: string;
    try {
      const oldWi = JSON.parse(previousContent);
      oldStatus = oldWi.status;
    } catch {
      return { valid: true, message: '' };
    }
    if (!oldStatus) return { valid: true, message: '' };

    // Same status — no transition
    if (oldStatus === newStatus) {
      return { valid: true, message: '' };
    }

    // Validate the transition
    if (!isValidTransition(oldStatus as WorkItemStatus, newStatus as WorkItemStatus)) {
      const allowed = VALID_TRANSITIONS[oldStatus as WorkItemStatus];
      const allowedStr = allowed && allowed.length > 0
        ? allowed.join(', ')
        : '(none — terminal state)';
      return {
        valid: false,
        message: `Invalid transition "${oldStatus}" → "${newStatus}". Allowed from ${oldStatus}: ${allowedStr}`,
      };
    }

    return { valid: true, message: '' };
  } catch {
    // Intentional: hooks must not crash on unexpected input.
    // Swallow errors and allow the write to proceed.
    return { valid: true, message: '' };
  }
}
