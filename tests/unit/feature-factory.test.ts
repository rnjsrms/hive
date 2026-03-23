import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFeature,
  createWorkItem,
  getNextId,
  incrementSequence,
  type FsOps,
  type SequenceData,
  type FeatureConfig,
  type FeatureData,
  type WorkItemConfig,
  type WorkItemData,
} from '../../src/feature-factory.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFsOps(files: Record<string, string>): FsOps {
  return {
    readFileSync: (path: string, _encoding: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: ${path}`);
    },
    writeFileSync: (path: string, data: string) => {
      files[path] = data;
    },
    existsSync: (path: string) => path in files,
  };
}

function seedFeatureFs(): { files: Record<string, string>; fs: FsOps } {
  const files: Record<string, string> = {
    '/h/features/_index.json': JSON.stringify({ items: [] }),
  };
  return { files, fs: makeFsOps(files) };
}

function seedWorkItemFs(): { files: Record<string, string>; fs: FsOps } {
  const files: Record<string, string> = {
    '/h/work-items/_index.json': JSON.stringify({ items: [] }),
    '/h/features/TEST-1.json': JSON.stringify({
      id: 'TEST-1', name: 'Test', status: 'IN_PROGRESS',
      plan: 'test.md', branch: 'feature/TEST-1',
      created_at: '2026-03-22T10:00:00.000Z', updated_at: '2026-03-22T10:00:00.000Z',
      work_items: [], agents: [], next_wi_id: 1
    }),
  };
  return { files, fs: makeFsOps(files) };
}

const BASE_FEATURE_CONFIG: FeatureConfig = {
  ticketId: 'TEST-1',
  name: 'Test Feature',
  plan: 'plan-test.md',
};

const BASE_WI_CONFIG: WorkItemConfig = {
  title: 'Implement feature X',
  type: 'feature',
  risk: 'medium',
  feature: 'TEST-1',
  description: 'Build feature X',
  acceptance_criteria: ['It works', 'Tests pass'],
};

// ---------------------------------------------------------------------------
// getNextId
// ---------------------------------------------------------------------------

describe('getNextId', () => {
  it('should return the next_id from sequence data', () => {
    const seq: SequenceData = { next_id: 1 };
    expect(getNextId(seq)).toBe(1);
  });

  it('should return high sequence numbers', () => {
    const seq: SequenceData = { next_id: 999 };
    expect(getNextId(seq)).toBe(999);
  });
});

// ---------------------------------------------------------------------------
// incrementSequence
// ---------------------------------------------------------------------------

describe('incrementSequence', () => {
  it('should return a new sequence with incremented next_id', () => {
    const seq: SequenceData = { next_id: 1 };
    const result = incrementSequence(seq);
    expect(result).toEqual({ next_id: 2 });
  });

  it('should not mutate the original sequence', () => {
    const seq: SequenceData = { next_id: 5 };
    const result = incrementSequence(seq);
    expect(seq.next_id).toBe(5);
    expect(result.next_id).toBe(6);
  });

  it('should handle large sequence numbers', () => {
    const seq: SequenceData = { next_id: 1000 };
    expect(incrementSequence(seq)).toEqual({ next_id: 1001 });
  });
});

// ---------------------------------------------------------------------------
// createFeature
// ---------------------------------------------------------------------------

describe('createFeature', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'));
  });

  it('should create a feature with correct id and fields', () => {
    const { fs } = seedFeatureFs();
    const feature = createFeature(BASE_FEATURE_CONFIG, '/h', fs);

    expect(feature.id).toBe('TEST-1');
    expect(feature.name).toBe('Test Feature');
    expect(feature.status).toBe('IN_PROGRESS');
    expect(feature.plan).toBe('plan-test.md');
    expect(feature.work_items).toEqual([]);
    expect(feature.agents).toEqual([]);
    expect(feature.next_wi_id).toBe(1);
    expect(feature.created_at).toBe('2026-03-22T10:00:00.000Z');
    expect(feature.updated_at).toBe('2026-03-22T10:00:00.000Z');
  });

  it('should write the feature JSON file to disk', () => {
    const { files, fs } = seedFeatureFs();
    createFeature(BASE_FEATURE_CONFIG, '/h', fs);

    const written = JSON.parse(files['/h/features/TEST-1.json']);
    expect(written.id).toBe('TEST-1');
    expect(written.name).toBe('Test Feature');
    expect(written.status).toBe('IN_PROGRESS');
  });

  it('should update the feature index', () => {
    const { files, fs } = seedFeatureFs();
    createFeature(BASE_FEATURE_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/features/_index.json']);
    expect(index.items).toEqual([{ id: 'TEST-1', status: 'IN_PROGRESS' }]);
  });

  it('should include agents when provided', () => {
    const { fs } = seedFeatureFs();
    const feature = createFeature(
      { ...BASE_FEATURE_CONFIG, agents: ['dev-1', 'dev-2'] },
      '/h',
      fs,
    );
    expect(feature.agents).toEqual(['dev-1', 'dev-2']);
  });

  it('should throw on duplicate feature file', () => {
    const { files, fs } = seedFeatureFs();
    files['/h/features/TEST-1.json'] = '{}';

    expect(() => createFeature(BASE_FEATURE_CONFIG, '/h', fs)).toThrow(
      'Feature file already exists',
    );
  });

  it('should append to existing index items', () => {
    const files: Record<string, string> = {
      '/h/features/_index.json': JSON.stringify({
        items: [{ id: 'TEST-1', status: 'IN_PROGRESS' }],
      }),
    };
    const fs = makeFsOps(files);

    createFeature({ ...BASE_FEATURE_CONFIG, ticketId: 'TEST-2' }, '/h', fs);

    const index = JSON.parse(files['/h/features/_index.json']);
    expect(index.items).toHaveLength(2);
    expect(index.items[1]).toEqual({ id: 'TEST-2', status: 'IN_PROGRESS' });
  });

  it('should include correct branch field', () => {
    const { fs } = seedFeatureFs();
    const feature = createFeature(BASE_FEATURE_CONFIG, '/h', fs);
    expect(feature.branch).toBe('feature/TEST-1');
  });

  it('should use custom branch when provided in config', () => {
    const { fs } = seedFeatureFs();
    const feature = createFeature(
      { ...BASE_FEATURE_CONFIG, branch: 'feature/CUSTOM-42' },
      '/h',
      fs,
    );
    expect(feature.branch).toBe('feature/CUSTOM-42');
  });

  it('should produce an object matching feature schema structure', () => {
    const { fs } = seedFeatureFs();
    const feature = createFeature(
      { ...BASE_FEATURE_CONFIG, agents: ['dev-1'] },
      '/h',
      fs,
    );

    // Verify all required schema fields are present
    expect(feature).toHaveProperty('id');
    expect(feature).toHaveProperty('name');
    expect(feature).toHaveProperty('status');
    expect(feature).toHaveProperty('plan');
    expect(feature).toHaveProperty('branch');
    expect(feature).toHaveProperty('created_at');
    expect(feature).toHaveProperty('updated_at');
    expect(feature).toHaveProperty('work_items');
    expect(feature).toHaveProperty('agents');
    expect(feature).toHaveProperty('next_wi_id');

    // Verify id pattern (Jira-style)
    expect(feature.id).toMatch(/^[A-Z][A-Z0-9]+-\d+$/);
  });

  it('should throw for invalid ticket ID format', () => {
    const { fs } = seedFeatureFs();
    expect(() => createFeature(
      { ...BASE_FEATURE_CONFIG, ticketId: 'lowercase-1' },
      '/h',
      fs,
    )).toThrow(/Invalid ticket ID/);
  });
});

// ---------------------------------------------------------------------------
// createWorkItem
// ---------------------------------------------------------------------------

describe('createWorkItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'));
  });

  it('should create a work item with correct id and fields', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);

    expect(wi.id).toBe('TEST-1_WI-1');
    expect(wi.title).toBe('Implement feature X');
    expect(wi.type).toBe('feature');
    expect(wi.risk).toBe('medium');
    expect(wi.status).toBe('OPEN');
    expect(wi.assignee).toBeNull();
    expect(wi.feature).toBe('TEST-1');
    expect(wi.branch).toBeNull();
    expect(wi.description).toBe('Build feature X');
    expect(wi.acceptance_criteria).toEqual(['It works', 'Tests pass']);
    expect(wi.dependencies).toEqual([]);
    expect(wi.history).toEqual([]);
    expect(wi.created_at).toBe('2026-03-22T10:00:00.000Z');
    expect(wi.updated_at).toBe('2026-03-22T10:00:00.000Z');
  });

  it('should write the work item JSON file to disk', () => {
    const { files, fs } = seedWorkItemFs();
    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const written = JSON.parse(files['/h/work-items/TEST-1_WI-1.json']);
    expect(written.id).toBe('TEST-1_WI-1');
    expect(written.title).toBe('Implement feature X');
  });

  it('should increment the feature next_wi_id', () => {
    const { files, fs } = seedWorkItemFs();
    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const feature = JSON.parse(files['/h/features/TEST-1.json']);
    expect(feature.next_wi_id).toBe(2);
  });

  it('should update the work item index', () => {
    const { files, fs } = seedWorkItemFs();
    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/work-items/_index.json']);
    expect(index.items).toEqual([
      { id: 'TEST-1_WI-1', status: 'OPEN', assignee: null },
    ]);
  });

  it('should auto-increment ids across multiple calls', () => {
    const { files, fs } = seedWorkItemFs();

    const w1 = createWorkItem(BASE_WI_CONFIG, '/h', fs);
    const w2 = createWorkItem(
      { ...BASE_WI_CONFIG, title: 'Second item' },
      '/h',
      fs,
    );

    expect(w1.id).toBe('TEST-1_WI-1');
    expect(w2.id).toBe('TEST-1_WI-2');

    const feature = JSON.parse(files['/h/features/TEST-1.json']);
    expect(feature.next_wi_id).toBe(3);

    const index = JSON.parse(files['/h/work-items/_index.json']);
    expect(index.items).toHaveLength(2);
  });

  it('should include dependencies when provided', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(
      { ...BASE_WI_CONFIG, dependencies: ['wi-1', 'wi-2'] },
      '/h',
      fs,
    );
    expect(wi.dependencies).toEqual(['wi-1', 'wi-2']);
  });

  it('should throw on duplicate work item file', () => {
    const { files, fs } = seedWorkItemFs();
    files['/h/work-items/TEST-1_WI-1.json'] = '{}';

    expect(() => createWorkItem(BASE_WI_CONFIG, '/h', fs)).toThrow(
      'Work item file already exists',
    );
  });

  it('should start from existing sequence number', () => {
    const files: Record<string, string> = {
      '/h/work-items/_index.json': JSON.stringify({ items: [] }),
      '/h/features/TEST-1.json': JSON.stringify({
        id: 'TEST-1', name: 'Test', status: 'IN_PROGRESS',
        plan: 'test.md', branch: 'feature/TEST-1',
        created_at: '2026-03-22T10:00:00.000Z', updated_at: '2026-03-22T10:00:00.000Z',
        work_items: [], agents: [], next_wi_id: 19
      }),
    };
    const fs = makeFsOps(files);

    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);
    expect(wi.id).toBe('TEST-1_WI-19');

    const feature = JSON.parse(files['/h/features/TEST-1.json']);
    expect(feature.next_wi_id).toBe(20);
  });

  it('should append to existing index items', () => {
    const files: Record<string, string> = {
      '/h/work-items/_index.json': JSON.stringify({
        items: [{ id: 'TEST-1_WI-1', status: 'OPEN', assignee: null }],
      }),
      '/h/features/TEST-1.json': JSON.stringify({
        id: 'TEST-1', name: 'Test', status: 'IN_PROGRESS',
        plan: 'test.md', branch: 'feature/TEST-1',
        created_at: '2026-03-22T10:00:00.000Z', updated_at: '2026-03-22T10:00:00.000Z',
        work_items: [], agents: [], next_wi_id: 2
      }),
    };
    const fs = makeFsOps(files);

    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/work-items/_index.json']);
    expect(index.items).toHaveLength(2);
    expect(index.items[1]).toEqual({ id: 'TEST-1_WI-2', status: 'OPEN', assignee: null });
  });

  it('should handle all work item types', () => {
    const types = ['feature', 'bugfix', 'refactor', 'test', 'docs', 'research'] as const;
    for (const type of types) {
      const { fs } = seedWorkItemFs();
      const wi = createWorkItem({ ...BASE_WI_CONFIG, type }, '/h', fs);
      expect(wi.type).toBe(type);
    }
  });

  it('should handle all risk levels', () => {
    const risks = ['low', 'medium', 'high'] as const;
    for (const risk of risks) {
      const { fs } = seedWorkItemFs();
      const wi = createWorkItem({ ...BASE_WI_CONFIG, risk }, '/h', fs);
      expect(wi.risk).toBe(risk);
    }
  });

  it('should default dependencies to empty array when omitted', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);
    expect(wi.dependencies).toEqual([]);
  });

  it('should default tags to empty array when omitted', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);
    expect(wi.tags).toEqual([]);
  });

  it('should default reviewers to empty array when omitted', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);
    expect(wi.reviewers).toEqual([]);
  });

  it('should include tags when provided', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(
      { ...BASE_WI_CONFIG, tags: ['auth', 'crypto', 'api'] },
      '/h',
      fs,
    );
    expect(wi.tags).toEqual(['auth', 'crypto', 'api']);
  });

  it('should include reviewers when provided', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(
      { ...BASE_WI_CONFIG, reviewers: ['security', 'architecture'] },
      '/h',
      fs,
    );
    expect(wi.reviewers).toEqual(['security', 'architecture']);
  });

  it('should create independent WI counters across features', () => {
    const files: Record<string, string> = {
      '/h/work-items/_index.json': JSON.stringify({ items: [] }),
      '/h/features/TEST-1.json': JSON.stringify({
        id: 'TEST-1', name: 'Feature A', status: 'IN_PROGRESS',
        plan: 'a.md', branch: 'feature/TEST-1',
        created_at: '2026-03-22T10:00:00.000Z', updated_at: '2026-03-22T10:00:00.000Z',
        work_items: [], agents: [], next_wi_id: 1
      }),
      '/h/features/TEST-2.json': JSON.stringify({
        id: 'TEST-2', name: 'Feature B', status: 'IN_PROGRESS',
        plan: 'b.md', branch: 'feature/TEST-2',
        created_at: '2026-03-22T10:00:00.000Z', updated_at: '2026-03-22T10:00:00.000Z',
        work_items: [], agents: [], next_wi_id: 1
      }),
    };
    const fs = makeFsOps(files);
    const w1 = createWorkItem({ ...BASE_WI_CONFIG, feature: 'TEST-1' }, '/h', fs);
    const w2 = createWorkItem({ ...BASE_WI_CONFIG, feature: 'TEST-2' }, '/h', fs);
    expect(w1.id).toBe('TEST-1_WI-1');
    expect(w2.id).toBe('TEST-2_WI-1');
  });

  it('should throw when feature file does not exist', () => {
    const files: Record<string, string> = {
      '/h/work-items/_index.json': JSON.stringify({ items: [] }),
    };
    const fs = makeFsOps(files);
    expect(() => createWorkItem({ ...BASE_WI_CONFIG, feature: 'TEST-999' }, '/h', fs))
      .toThrow(/ENOENT/);
  });

  it('should throw for invalid feature name (path traversal)', () => {
    const { fs } = seedWorkItemFs();
    expect(() => createWorkItem({ ...BASE_WI_CONFIG, feature: '../../etc' }, '/h', fs))
      .toThrow(/Invalid feature/);
  });

  it('should throw for invalid feature name (lowercase old format)', () => {
    const { fs } = seedWorkItemFs();
    expect(() => createWorkItem({ ...BASE_WI_CONFIG, feature: 'lowercase-1' }, '/h', fs))
      .toThrow(/Invalid feature/);
  });

  it('should produce an object matching work-item schema structure', () => {
    const { fs } = seedWorkItemFs();
    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);

    // Verify all required schema fields are present
    expect(wi).toHaveProperty('id');
    expect(wi).toHaveProperty('title');
    expect(wi).toHaveProperty('type');
    expect(wi).toHaveProperty('risk');
    expect(wi).toHaveProperty('status');
    expect(wi).toHaveProperty('assignee');
    expect(wi).toHaveProperty('feature');
    expect(wi).toHaveProperty('branch');
    expect(wi).toHaveProperty('description');
    expect(wi).toHaveProperty('acceptance_criteria');
    expect(wi).toHaveProperty('dependencies');
    expect(wi).toHaveProperty('tags');
    expect(wi).toHaveProperty('reviewers');
    expect(wi).toHaveProperty('history');
    expect(wi).toHaveProperty('created_at');
    expect(wi).toHaveProperty('updated_at');

    // Verify id pattern (Jira-style with uppercase WI)
    expect(wi.id).toMatch(/^[A-Z][A-Z0-9]+-\d+_WI-\d+$/);
  });
});
