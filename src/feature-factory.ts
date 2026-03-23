/**
 * Feature Factory — creates feature and work-item JSON files.
 *
 * Pure functions with injected file-system operations so the module
 * is fully testable without touching disk.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FsOps {
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string): void;
  existsSync(path: string): boolean;
}

export interface SequenceData {
  next_id: number;
}

export interface FeatureConfig {
  name: string;
  plan: string;
  agents?: string[];
  branch?: string;
  timestamp?: string;
}

export interface WorkItemConfig {
  title: string;
  type: 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'research';
  risk: 'low' | 'medium' | 'high';
  feature: string;
  description: string;
  acceptance_criteria: string[];
  dependencies?: string[];
  tags?: string[];
  reviewers?: string[];
  timestamp?: string;
}

export interface FeatureData {
  id: string;
  name: string;
  status: 'PLANNING' | 'IN_PROGRESS' | 'AGENTS_COMPLETE' | 'MERGED' | 'CANCELLED';
  plan: string;
  branch: string;
  created_at: string;
  updated_at: string;
  work_items: string[];
  agents: string[];
}

export interface WorkItemData {
  id: string;
  title: string;
  type: string;
  risk: string;
  status: string;
  assignee: string | null;
  feature: string;
  branch: string | null;
  description: string;
  acceptance_criteria: string[];
  dependencies: string[];
  tags: string[];
  reviewers: string[];
  history: Array<{ action: string; agent: string; ts: string; notes?: string }>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Sequence helpers
// ---------------------------------------------------------------------------

export function getNextId(sequenceFile: SequenceData): number {
  return sequenceFile.next_id;
}

export function incrementSequence(sequenceFile: SequenceData): SequenceData {
  return { next_id: sequenceFile.next_id + 1 };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readJson<T>(fs: FsOps, path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
}

function writeJson(fs: FsOps, path: string, data: unknown): void {
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function allocateId(fs: FsOps, seqPath: string): number {
  const seq = readJson<SequenceData>(fs, seqPath);
  const id = getNextId(seq);
  writeJson(fs, seqPath, incrementSequence(seq));
  return id;
}

// ---------------------------------------------------------------------------
// createFeature
// ---------------------------------------------------------------------------

export function createFeature(
  config: FeatureConfig,
  hiveDir: string,
  fs: FsOps,
): FeatureData {
  const featuresDir = `${hiveDir}/features`;
  const seqPath = `${featuresDir}/_sequence.json`;
  const indexPath = `${featuresDir}/_index.json`;

  const num = allocateId(fs, seqPath);
  const id = `feature-${num}`;
  const filePath = `${featuresDir}/${id}.json`;

  // Duplicate check
  if (fs.existsSync(filePath)) {
    throw new Error(`Feature file already exists: ${filePath}`);
  }

  const now = config.timestamp ?? new Date().toISOString();
  const feature: FeatureData = {
    id,
    name: config.name,
    status: 'IN_PROGRESS',
    plan: config.plan,
    branch: config.branch ?? `feature/${id}`,
    created_at: now,
    updated_at: now,
    work_items: [],
    agents: config.agents ?? [],
  };

  writeJson(fs, filePath, feature);

  // Update index
  const index = readJson<{ items: Array<{ id: string; status: string }> }>(fs, indexPath);
  index.items.push({ id, status: feature.status });
  writeJson(fs, indexPath, index);

  return feature;
}

// ---------------------------------------------------------------------------
// createWorkItem
// ---------------------------------------------------------------------------

export function createWorkItem(
  config: WorkItemConfig,
  hiveDir: string,
  fs: FsOps,
): WorkItemData {
  const wiDir = `${hiveDir}/work-items`;
  const seqPath = `${wiDir}/_sequence.json`;
  const indexPath = `${wiDir}/_index.json`;

  const num = allocateId(fs, seqPath);
  const id = `wi-${num}`;
  const filePath = `${wiDir}/${id}.json`;

  // Duplicate check
  if (fs.existsSync(filePath)) {
    throw new Error(`Work item file already exists: ${filePath}`);
  }

  const now = config.timestamp ?? new Date().toISOString();
  const wi: WorkItemData = {
    id,
    title: config.title,
    type: config.type,
    risk: config.risk,
    status: 'OPEN',
    assignee: null,
    feature: config.feature,
    branch: null,
    description: config.description,
    acceptance_criteria: config.acceptance_criteria,
    dependencies: config.dependencies ?? [],
    tags: config.tags ?? [],
    reviewers: config.reviewers ?? [],
    history: [],
    created_at: now,
    updated_at: now,
  };

  writeJson(fs, filePath, wi);

  // Update index
  const index = readJson<{ items: Array<{ id: string; status: string; assignee: string | null }> }>(fs, indexPath);
  index.items.push({ id, status: wi.status, assignee: wi.assignee });
  writeJson(fs, indexPath, index);

  return wi;
}
