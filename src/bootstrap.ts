import { DEFAULT_ROLE_CATALOG } from './role-catalog-defaults.js';

export interface FsOps {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  writeFileSync(path: string, data: string): void;
  readFileSync(path: string, encoding: string): string;
  readdirSync(path: string): string[];
}

export interface InitResult {
  created: boolean;
  directories: string[];
  files: string[];
}

export interface StateFileValidation {
  valid: boolean;
  errors: string[];
}

export interface WorkItemRefValidation {
  valid: boolean;
  danglingRefs: string[];
}

export interface ValidationWarning {
  file: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
}

/**
 * Returns the list of required .hive/ subdirectories.
 */
export function getRequiredDirs(): string[] {
  return ['plans', 'research', 'work-items', 'sprints', 'agents', 'logs', 'archive'];
}

/**
 * Returns a map of required state files and their initial JSON content.
 * @param baseBranch - The base branch name (default: 'master'). Callers should
 *   auto-detect via `git symbolic-ref refs/remotes/origin/HEAD` when possible.
 */
export function getRequiredFiles(baseBranch: string = 'master'): Record<string, object> {
  return {
    'config.json': { name: 'hive', version: '2.1.1', base_branch: baseBranch },
    'work-items/_index.json': { items: [] },
    'work-items/_sequence.json': { next_id: 1 },
    'sprints/_index.json': { items: [] },
    'sprints/_sequence.json': { next_id: 1 },
    'agents/_index.json': { agents: [] },
    'role-catalog.json': DEFAULT_ROLE_CATALOG,
  };
}

/**
 * Validates that a string is parseable JSON.
 */
export function validateStateFile(content: string): StateFileValidation {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(content);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push('Content is not a JSON object');
    }
  } catch (e) {
    errors.push(`Invalid JSON: ${(e as Error).message}`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Checks that all WI IDs in a sprint's work_items array exist in the given list.
 */
export function validateWorkItemRefs(
  sprintData: { work_items?: string[] },
  existingWiIds: string[],
): WorkItemRefValidation {
  const workItems = sprintData.work_items || [];
  const existingSet = new Set(existingWiIds);
  const danglingRefs = workItems.filter(id => !existingSet.has(id));
  return { valid: danglingRefs.length === 0, danglingRefs };
}

const LOG_FILES = [
  'logs/activity.jsonl',
  'logs/communications.jsonl',
  'logs/task-ledger.jsonl',
];

const GITKEEP_DIRS = ['plans', 'research', 'archive'];

/**
 * Initializes a .hive/ directory with all required structure and state files.
 */
export function initializeHive(rootDir: string, fs: FsOps): InitResult {
  const hiveDir = `${rootDir}/.hive`;

  if (fs.existsSync(hiveDir)) {
    return { created: false, directories: [], files: [] };
  }

  const directories: string[] = [];
  const files: string[] = [];

  for (const dir of getRequiredDirs()) {
    const path = `${hiveDir}/${dir}`;
    fs.mkdirSync(path, { recursive: true });
    directories.push(dir);
  }

  for (const [file, content] of Object.entries(getRequiredFiles())) {
    const path = `${hiveDir}/${file}`;
    fs.writeFileSync(path, JSON.stringify(content, null, 2) + '\n');
    files.push(file);
  }

  for (const logFile of LOG_FILES) {
    const path = `${hiveDir}/${logFile}`;
    fs.writeFileSync(path, '');
    files.push(logFile);
  }

  for (const dir of GITKEEP_DIRS) {
    const path = `${hiveDir}/${dir}/.gitkeep`;
    fs.writeFileSync(path, '');
    files.push(`${dir}/.gitkeep`);
  }

  return { created: true, directories, files };
}

/**
 * Validates an existing .hive/ directory's state integrity.
 */
export function validateState(rootDir: string, fs: FsOps): ValidationResult {
  const hiveDir = `${rootDir}/.hive`;
  const warnings: ValidationWarning[] = [];

  if (!fs.existsSync(hiveDir)) {
    return { valid: false, warnings: [{ file: '.hive', message: 'Directory does not exist' }] };
  }

  // Validate required JSON state files
  for (const file of Object.keys(getRequiredFiles())) {
    const path = `${hiveDir}/${file}`;
    if (!fs.existsSync(path)) {
      warnings.push({ file, message: 'File missing' });
      continue;
    }
    const result = validateStateFile(fs.readFileSync(path, 'utf8'));
    if (!result.valid) {
      warnings.push({ file, message: result.errors[0] });
    }
  }

  // Validate sprint files and cross-references
  const sprintsDir = `${hiveDir}/sprints`;
  if (fs.existsSync(sprintsDir)) {
    const sprintFiles = fs.readdirSync(sprintsDir).filter(f => f.startsWith('sprint-') && f.endsWith('.json'));
    for (const file of sprintFiles) {
      const path = `${sprintsDir}/${file}`;
      try {
        const sprint = JSON.parse(fs.readFileSync(path, 'utf8'));
        // Collect existing WI IDs for cross-reference check
        const wiDir = `${hiveDir}/work-items`;
        const existingWiIds = fs.existsSync(wiDir)
          ? fs.readdirSync(wiDir)
              .filter(f => f.startsWith('wi-') && f.endsWith('.json'))
              .map(f => f.replace('.json', ''))
          : [];
        const refResult = validateWorkItemRefs(sprint, existingWiIds);
        for (const ref of refResult.danglingRefs) {
          warnings.push({ file: `sprints/${file}`, message: `References missing work item: ${ref}` });
        }
      } catch {
        warnings.push({ file: `sprints/${file}`, message: 'Invalid JSON' });
      }
    }
  }

  // Check for duplicate work item IDs
  const wiDir = `${hiveDir}/work-items`;
  if (fs.existsSync(wiDir)) {
    const wiFiles = fs.readdirSync(wiDir).filter(f => f.startsWith('wi-') && f.endsWith('.json'));
    const seenIds = new Set<string>();
    for (const file of wiFiles) {
      const path = `${wiDir}/${file}`;
      try {
        const wi = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (wi.id && seenIds.has(wi.id)) {
          warnings.push({ file: `work-items/${file}`, message: `Duplicate work item ID: ${wi.id}` });
        }
        if (wi.id) seenIds.add(wi.id);
      } catch {
        warnings.push({ file: `work-items/${file}`, message: 'Invalid JSON' });
      }
    }
  }

  return { valid: warnings.length === 0, warnings };
}
