import { describe, it, expect } from 'vitest';
import {
  computeDelta,
  hasRegression,
  formatDeltaSummary,
  type HiveMetrics,
} from '../../src/metrics.js';

function makeMetrics(overrides: Partial<HiveMetrics> = {}): HiveMetrics {
  return {
    timestamp: new Date().toISOString(),
    tests: { total: 195, passed: 195, failed: 0, files: 16 },
    coverage: { statements: 100, branches: 100, functions: 100, lines: 100 },
    quality: { emptyCatches: 0, todos: 0, hardcodedStrings: 0, scriptModuleAlignment: 5 },
    scripts: { total: 5, withStdinInput: 5, withErrorLogging: 5 },
    ...overrides,
  };
}

describe('computeDelta', () => {
  it('should return empty deltas when metrics are identical', () => {
    const m = makeMetrics();
    const deltas = computeDelta(m, m);
    expect(deltas.every(d => d.delta === 0)).toBe(true);
  });

  it('should detect test count increase as improvement', () => {
    const before = makeMetrics();
    const after = makeMetrics({ tests: { total: 200, passed: 200, failed: 0, files: 17 } });
    const deltas = computeDelta(before, after);
    const testDelta = deltas.find(d => d.metric === 'tests.total');
    expect(testDelta?.improved).toBe(true);
    expect(testDelta?.delta).toBe(5);
  });

  it('should detect test failures as regression', () => {
    const before = makeMetrics();
    const after = makeMetrics({ tests: { total: 195, passed: 193, failed: 2, files: 16 } });
    const deltas = computeDelta(before, after);
    const failDelta = deltas.find(d => d.metric === 'tests.failed');
    expect(failDelta?.improved).toBe(false);
    expect(failDelta?.delta).toBe(2);
  });

  it('should detect coverage decrease as regression', () => {
    const before = makeMetrics();
    const after = makeMetrics({ coverage: { statements: 90, branches: 85, functions: 100, lines: 90 } });
    const deltas = computeDelta(before, after);
    const covDelta = deltas.find(d => d.metric === 'coverage.statements');
    expect(covDelta?.improved).toBe(false);
    expect(covDelta?.delta).toBe(-10);
  });

  it('should detect empty catches decrease as improvement (lower is better)', () => {
    const before = makeMetrics({ quality: { emptyCatches: 3, todos: 0, hardcodedStrings: 0, scriptModuleAlignment: 5 } });
    const after = makeMetrics({ quality: { emptyCatches: 1, todos: 0, hardcodedStrings: 0, scriptModuleAlignment: 5 } });
    const deltas = computeDelta(before, after);
    const catchDelta = deltas.find(d => d.metric === 'quality.emptyCatches');
    expect(catchDelta?.improved).toBe(true);
    expect(catchDelta?.delta).toBe(-2);
  });

  it('should detect stdin adoption increase as improvement', () => {
    const before = makeMetrics({ scripts: { total: 5, withStdinInput: 3, withErrorLogging: 5 } });
    const after = makeMetrics({ scripts: { total: 5, withStdinInput: 5, withErrorLogging: 5 } });
    const deltas = computeDelta(before, after);
    const stdinDelta = deltas.find(d => d.metric === 'scripts.withStdinInput');
    expect(stdinDelta?.improved).toBe(true);
    expect(stdinDelta?.delta).toBe(2);
  });
});

describe('hasRegression', () => {
  it('should return false when all metrics improved or unchanged', () => {
    const before = makeMetrics();
    const after = makeMetrics({ tests: { total: 200, passed: 200, failed: 0, files: 17 } });
    const deltas = computeDelta(before, after);
    expect(hasRegression(deltas)).toBe(false);
  });

  it('should return true when any metric regressed', () => {
    const before = makeMetrics();
    const after = makeMetrics({ tests: { total: 195, passed: 190, failed: 5, files: 16 } });
    const deltas = computeDelta(before, after);
    expect(hasRegression(deltas)).toBe(true);
  });

  it('should return false when all deltas are zero', () => {
    const m = makeMetrics();
    expect(hasRegression(computeDelta(m, m))).toBe(false);
  });
});

describe('formatDeltaSummary', () => {
  it('should format improved metrics', () => {
    const before = makeMetrics();
    const after = makeMetrics({ tests: { total: 200, passed: 200, failed: 0, files: 17 } });
    const summary = formatDeltaSummary(computeDelta(before, after));
    expect(summary).toContain('Improved');
    expect(summary).toContain('tests.total 195→200');
  });

  it('should format regressed metrics', () => {
    const before = makeMetrics();
    const after = makeMetrics({ tests: { total: 195, passed: 190, failed: 5, files: 16 } });
    const summary = formatDeltaSummary(computeDelta(before, after));
    expect(summary).toContain('Regressed');
    expect(summary).toContain('tests.failed 0→5');
  });

  it('should show unchanged count', () => {
    const m = makeMetrics();
    const summary = formatDeltaSummary(computeDelta(m, m));
    expect(summary).toContain('Unchanged:');
  });
});
