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

export interface FeatureConfig {
  ticketId: string;
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
  next_wi_id: number;
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
// Internal helpers
// ---------------------------------------------------------------------------

function readJson<T>(fs: FsOps, path: string): T {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as T;
}

function writeJson(fs: FsOps, path: string, data: unknown): void {
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

/** Jira-style ticket ID pattern: uppercase project key + hyphen + number */
const TICKET_ID_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/;

// ---------------------------------------------------------------------------
// createFeature
// ---------------------------------------------------------------------------

/**
 * Creates a feature using a Jira-style ticket ID (e.g., 'ABC-1234').
 * Feature IDs are lead-provided, not auto-incremented.
 * Branch defaults to `feature/{ticketId}` (git-flow convention).
 */
export function createFeature(
  config: FeatureConfig,
  hiveDir: string,
  fs: FsOps,
): FeatureData {
  // Validate ticket ID format
  if (!TICKET_ID_PATTERN.test(config.ticketId)) {
    throw new Error(`Invalid ticket ID: "${config.ticketId}" — must match Jira format (e.g., ABC-1234)`);
  }

  const featuresDir = `${hiveDir}/features`;
  const indexPath = `${featuresDir}/_index.json`;

  const id = config.ticketId;
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
    next_wi_id: 1,
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

/**
 * Creates a work item with a feature-scoped ID.
 * WI IDs restart at 1 per feature. The globally unique ID is
 * `{ticket-id}_WI-{wid}` (e.g., `ABC-1234_WI-1`).
 * The WI counter is stored as `next_wi_id` in the feature JSON file.
 */
export function createWorkItem(
  config: WorkItemConfig,
  hiveDir: string,
  fs: FsOps,
): WorkItemData {
  // Validate feature name format (Jira-style ticket ID)
  if (!TICKET_ID_PATTERN.test(config.feature)) {
    throw new Error(`Invalid feature name: "${config.feature}" — must match Jira format (e.g., ABC-1234)`);
  }

  const wiDir = `${hiveDir}/work-items`;
  const indexPath = `${wiDir}/_index.json`;

  // IMPORTANT: This read-modify-write is safe under the single-writer invariant
  // (only the lead agent calls createWorkItem). If concurrent callers are ever
  // supported, add file locking or use { flag: 'wx' } on the WI file write.

  // Read the feature file to get the per-feature WI counter
  const featurePath = `${hiveDir}/features/${config.feature}.json`;
  const featureData = readJson<FeatureData>(fs, featurePath);
  const wiNum = featureData.next_wi_id;

  // Validate next_wi_id is a positive integer
  if (!Number.isInteger(wiNum) || wiNum < 1) {
    throw new Error(`Invalid next_wi_id in feature file: ${wiNum} — must be a positive integer`);
  }

  // Build feature-scoped ID: {ticket-id}_WI-{wid}
  const id = `${config.feature}_WI-${wiNum}`;
  const filePath = `${wiDir}/${id}.json`;

  // Duplicate check
  if (fs.existsSync(filePath)) {
    throw new Error(`Work item file already exists: ${filePath}`);
  }

  // Increment the feature's WI counter and register WI in the feature
  featureData.next_wi_id = wiNum + 1;
  featureData.work_items.push(id);
  writeJson(fs, featurePath, featureData);

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
