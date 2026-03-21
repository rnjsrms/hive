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

export interface ValidationWarning {
  file: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
}

const REQUIRED_DIRS = [
  'plans',
  'research',
  'work-items',
  'sprints',
  'agents',
  'logs',
  'archive',
];

const STATE_FILES: Record<string, string> = {
  'work-items/_index.json': '{"items":[]}',
  'work-items/_sequence.json': '{"next_id":1}',
  'sprints/_index.json': '{"items":[]}',
  'sprints/_sequence.json': '{"next_id":1}',
  'agents/_index.json': '{"agents":[]}',
};

const LOG_FILES = [
  'logs/activity.jsonl',
  'logs/communications.jsonl',
  'logs/task-ledger.jsonl',
];

const GITKEEP_DIRS = ['plans', 'research', 'archive'];

export function initializeHive(rootDir: string, fs: FsOps): InitResult {
  const hiveDir = `${rootDir}/.hive`;

  if (fs.existsSync(hiveDir)) {
    return { created: false, directories: [], files: [] };
  }

  const directories: string[] = [];
  const files: string[] = [];

  for (const dir of REQUIRED_DIRS) {
    const path = `${hiveDir}/${dir}`;
    fs.mkdirSync(path, { recursive: true });
    directories.push(dir);
  }

  for (const [file, content] of Object.entries(STATE_FILES)) {
    const path = `${hiveDir}/${file}`;
    fs.writeFileSync(path, content);
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

export function validateState(rootDir: string, fs: FsOps): ValidationResult {
  const hiveDir = `${rootDir}/.hive`;
  const warnings: ValidationWarning[] = [];

  if (!fs.existsSync(hiveDir)) {
    return { valid: false, warnings: [{ file: '.hive', message: 'Directory does not exist' }] };
  }

  // Validate JSON files: _index.json, _sequence.json
  const jsonFiles = [
    'work-items/_index.json',
    'work-items/_sequence.json',
    'sprints/_index.json',
    'sprints/_sequence.json',
    'agents/_index.json',
  ];

  for (const file of jsonFiles) {
    const path = `${hiveDir}/${file}`;
    if (!fs.existsSync(path)) {
      warnings.push({ file, message: 'File missing' });
      continue;
    }
    try {
      JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch {
      warnings.push({ file, message: 'Invalid JSON' });
    }
  }

  // Validate sprint files
  const sprintsDir = `${hiveDir}/sprints`;
  if (fs.existsSync(sprintsDir)) {
    const sprintFiles = fs.readdirSync(sprintsDir).filter(f => f.startsWith('sprint-') && f.endsWith('.json'));
    for (const file of sprintFiles) {
      const path = `${sprintsDir}/${file}`;
      try {
        const sprint = JSON.parse(fs.readFileSync(path, 'utf8'));
        // Cross-reference: verify each WI in work_items exists
        const workItems: string[] = sprint.work_items || [];
        for (const wiId of workItems) {
          const wiPath = `${hiveDir}/work-items/${wiId}.json`;
          if (!fs.existsSync(wiPath)) {
            warnings.push({ file: `sprints/${file}`, message: `References missing work item: ${wiId}` });
          }
        }
      } catch {
        warnings.push({ file: `sprints/${file}`, message: 'Invalid JSON' });
      }
    }
  }

  // Validate work item files
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
