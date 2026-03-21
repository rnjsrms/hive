import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSprint,
  createWorkItem,
  getNextId,
  incrementSequence,
  type FsOps,
  type SequenceData,
  type SprintConfig,
  type SprintData,
  type WorkItemConfig,
  type WorkItemData,
} from '../../src/sprint-factory.js';

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

function seedSprintFs(): { files: Record<string, string>; fs: FsOps } {
  const files: Record<string, string> = {
    '/h/sprints/_sequence.json': JSON.stringify({ next_id: 1 }),
    '/h/sprints/_index.json': JSON.stringify({ items: [] }),
  };
  return { files, fs: makeFsOps(files) };
}

function seedWorkItemFs(): { files: Record<string, string>; fs: FsOps } {
  const files: Record<string, string> = {
    '/h/work-items/_sequence.json': JSON.stringify({ next_id: 1 }),
    '/h/work-items/_index.json': JSON.stringify({ items: [] }),
  };
  return { files, fs: makeFsOps(files) };
}

const BASE_SPRINT_CONFIG: SprintConfig = {
  name: 'Test Sprint',
  plan: 'plan-test.md',
};

const BASE_WI_CONFIG: WorkItemConfig = {
  title: 'Implement feature X',
  type: 'feature',
  risk: 'medium',
  sprint: 'sprint-1',
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
// createSprint
// ---------------------------------------------------------------------------

describe('createSprint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-22T10:00:00.000Z'));
  });

  it('should create a sprint with correct id and fields', () => {
    const { fs } = seedSprintFs();
    const sprint = createSprint(BASE_SPRINT_CONFIG, '/h', fs);

    expect(sprint.id).toBe('sprint-1');
    expect(sprint.name).toBe('Test Sprint');
    expect(sprint.status).toBe('IN_PROGRESS');
    expect(sprint.plan).toBe('plan-test.md');
    expect(sprint.work_items).toEqual([]);
    expect(sprint.agents).toEqual([]);
    expect(sprint.created_at).toBe('2026-03-22T10:00:00.000Z');
    expect(sprint.updated_at).toBe('2026-03-22T10:00:00.000Z');
  });

  it('should write the sprint JSON file to disk', () => {
    const { files, fs } = seedSprintFs();
    createSprint(BASE_SPRINT_CONFIG, '/h', fs);

    const written = JSON.parse(files['/h/sprints/sprint-1.json']);
    expect(written.id).toBe('sprint-1');
    expect(written.name).toBe('Test Sprint');
    expect(written.status).toBe('IN_PROGRESS');
  });

  it('should increment the sequence number', () => {
    const { files, fs } = seedSprintFs();
    createSprint(BASE_SPRINT_CONFIG, '/h', fs);

    const seq = JSON.parse(files['/h/sprints/_sequence.json']);
    expect(seq.next_id).toBe(2);
  });

  it('should update the sprint index', () => {
    const { files, fs } = seedSprintFs();
    createSprint(BASE_SPRINT_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/sprints/_index.json']);
    expect(index.items).toEqual([{ id: 'sprint-1', status: 'IN_PROGRESS' }]);
  });

  it('should auto-increment ids across multiple calls', () => {
    const { files, fs } = seedSprintFs();

    const s1 = createSprint({ name: 'Sprint A', plan: 'a.md' }, '/h', fs);
    const s2 = createSprint({ name: 'Sprint B', plan: 'b.md' }, '/h', fs);

    expect(s1.id).toBe('sprint-1');
    expect(s2.id).toBe('sprint-2');

    const seq = JSON.parse(files['/h/sprints/_sequence.json']);
    expect(seq.next_id).toBe(3);

    const index = JSON.parse(files['/h/sprints/_index.json']);
    expect(index.items).toHaveLength(2);
  });

  it('should include agents when provided', () => {
    const { fs } = seedSprintFs();
    const sprint = createSprint(
      { ...BASE_SPRINT_CONFIG, agents: ['dev-1', 'dev-2'] },
      '/h',
      fs,
    );
    expect(sprint.agents).toEqual(['dev-1', 'dev-2']);
  });

  it('should throw on duplicate sprint file', () => {
    const { files, fs } = seedSprintFs();
    files['/h/sprints/sprint-1.json'] = '{}';

    expect(() => createSprint(BASE_SPRINT_CONFIG, '/h', fs)).toThrow(
      'Sprint file already exists',
    );
  });

  it('should start from existing sequence number', () => {
    const files: Record<string, string> = {
      '/h/sprints/_sequence.json': JSON.stringify({ next_id: 5 }),
      '/h/sprints/_index.json': JSON.stringify({ items: [] }),
    };
    const fs = makeFsOps(files);

    const sprint = createSprint(BASE_SPRINT_CONFIG, '/h', fs);
    expect(sprint.id).toBe('sprint-5');

    const seq = JSON.parse(files['/h/sprints/_sequence.json']);
    expect(seq.next_id).toBe(6);
  });

  it('should append to existing index items', () => {
    const files: Record<string, string> = {
      '/h/sprints/_sequence.json': JSON.stringify({ next_id: 2 }),
      '/h/sprints/_index.json': JSON.stringify({
        items: [{ id: 'sprint-1', status: 'IN_PROGRESS' }],
      }),
    };
    const fs = makeFsOps(files);

    createSprint(BASE_SPRINT_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/sprints/_index.json']);
    expect(index.items).toHaveLength(2);
    expect(index.items[1]).toEqual({ id: 'sprint-2', status: 'IN_PROGRESS' });
  });

  it('should produce an object matching sprint schema structure', () => {
    const { fs } = seedSprintFs();
    const sprint = createSprint(
      { ...BASE_SPRINT_CONFIG, agents: ['dev-1'] },
      '/h',
      fs,
    );

    // Verify all required schema fields are present
    expect(sprint).toHaveProperty('id');
    expect(sprint).toHaveProperty('name');
    expect(sprint).toHaveProperty('status');
    expect(sprint).toHaveProperty('plan');
    expect(sprint).toHaveProperty('created_at');
    expect(sprint).toHaveProperty('updated_at');
    expect(sprint).toHaveProperty('work_items');
    expect(sprint).toHaveProperty('agents');

    // Verify id pattern
    expect(sprint.id).toMatch(/^sprint-\d+$/);
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

    expect(wi.id).toBe('wi-1');
    expect(wi.title).toBe('Implement feature X');
    expect(wi.type).toBe('feature');
    expect(wi.risk).toBe('medium');
    expect(wi.status).toBe('OPEN');
    expect(wi.assignee).toBeNull();
    expect(wi.sprint).toBe('sprint-1');
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

    const written = JSON.parse(files['/h/work-items/wi-1.json']);
    expect(written.id).toBe('wi-1');
    expect(written.title).toBe('Implement feature X');
  });

  it('should increment the sequence number', () => {
    const { files, fs } = seedWorkItemFs();
    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const seq = JSON.parse(files['/h/work-items/_sequence.json']);
    expect(seq.next_id).toBe(2);
  });

  it('should update the work item index', () => {
    const { files, fs } = seedWorkItemFs();
    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/work-items/_index.json']);
    expect(index.items).toEqual([
      { id: 'wi-1', status: 'OPEN', assignee: null },
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

    expect(w1.id).toBe('wi-1');
    expect(w2.id).toBe('wi-2');

    const seq = JSON.parse(files['/h/work-items/_sequence.json']);
    expect(seq.next_id).toBe(3);

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
    files['/h/work-items/wi-1.json'] = '{}';

    expect(() => createWorkItem(BASE_WI_CONFIG, '/h', fs)).toThrow(
      'Work item file already exists',
    );
  });

  it('should start from existing sequence number', () => {
    const files: Record<string, string> = {
      '/h/work-items/_sequence.json': JSON.stringify({ next_id: 19 }),
      '/h/work-items/_index.json': JSON.stringify({ items: [] }),
    };
    const fs = makeFsOps(files);

    const wi = createWorkItem(BASE_WI_CONFIG, '/h', fs);
    expect(wi.id).toBe('wi-19');

    const seq = JSON.parse(files['/h/work-items/_sequence.json']);
    expect(seq.next_id).toBe(20);
  });

  it('should append to existing index items', () => {
    const files: Record<string, string> = {
      '/h/work-items/_sequence.json': JSON.stringify({ next_id: 2 }),
      '/h/work-items/_index.json': JSON.stringify({
        items: [{ id: 'wi-1', status: 'OPEN', assignee: null }],
      }),
    };
    const fs = makeFsOps(files);

    createWorkItem(BASE_WI_CONFIG, '/h', fs);

    const index = JSON.parse(files['/h/work-items/_index.json']);
    expect(index.items).toHaveLength(2);
    expect(index.items[1]).toEqual({ id: 'wi-2', status: 'OPEN', assignee: null });
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
    expect(wi).toHaveProperty('sprint');
    expect(wi).toHaveProperty('branch');
    expect(wi).toHaveProperty('description');
    expect(wi).toHaveProperty('acceptance_criteria');
    expect(wi).toHaveProperty('dependencies');
    expect(wi).toHaveProperty('history');
    expect(wi).toHaveProperty('created_at');
    expect(wi).toHaveProperty('updated_at');

    // Verify id pattern
    expect(wi.id).toMatch(/^wi-\d+$/);
  });
});
