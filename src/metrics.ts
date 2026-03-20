/**
 * Hive continuous improvement metrics collection
 *
 * Provides functions to measure code quality, test health, and improvement progress.
 * Used by the AutoResearch improvement loop.
 */

export interface HiveMetrics {
  timestamp: string;
  tests: {
    total: number;
    passed: number;
    failed: number;
    files: number;
  };
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  quality: {
    emptyCatches: number;
    todos: number;
    hardcodedStrings: number;
    scriptModuleAlignment: number; // count of scripts with matching modules
  };
  scripts: {
    total: number;
    withStdinInput: number;    // ISS-4: using stdin vs argv
    withErrorLogging: number;  // ISS-5: proper error handling
  };
}

export interface MetricsDelta {
  metric: string;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
}

export function computeDelta(before: HiveMetrics, after: HiveMetrics): MetricsDelta[] {
  const deltas: MetricsDelta[] = [];

  const compare = (name: string, b: number, a: number, higherIsBetter = true) => {
    deltas.push({
      metric: name,
      before: b,
      after: a,
      delta: a - b,
      improved: higherIsBetter ? a >= b : a <= b,
    });
  };

  compare('tests.total', before.tests.total, after.tests.total);
  compare('tests.passed', before.tests.passed, after.tests.passed);
  compare('tests.failed', before.tests.failed, after.tests.failed, false);
  compare('coverage.statements', before.coverage.statements, after.coverage.statements);
  compare('coverage.branches', before.coverage.branches, after.coverage.branches);
  compare('quality.emptyCatches', before.quality.emptyCatches, after.quality.emptyCatches, false);
  compare('quality.todos', before.quality.todos, after.quality.todos, false);
  compare('scripts.withStdinInput', before.scripts.withStdinInput, after.scripts.withStdinInput);
  compare('scripts.withErrorLogging', before.scripts.withErrorLogging, after.scripts.withErrorLogging);

  return deltas;
}

export function hasRegression(deltas: MetricsDelta[]): boolean {
  return deltas.some(d => !d.improved && d.delta !== 0);
}

export function formatDeltaSummary(deltas: MetricsDelta[]): string {
  const improved = deltas.filter(d => d.improved && d.delta !== 0);
  const regressed = deltas.filter(d => !d.improved && d.delta !== 0);
  const unchanged = deltas.filter(d => d.delta === 0);

  const lines: string[] = [];
  if (improved.length > 0) {
    lines.push(`Improved: ${improved.map(d => `${d.metric} ${d.before}→${d.after}`).join(', ')}`);
  }
  if (regressed.length > 0) {
    lines.push(`Regressed: ${regressed.map(d => `${d.metric} ${d.before}→${d.after}`).join(', ')}`);
  }
  lines.push(`Unchanged: ${unchanged.length} metrics`);
  return lines.join('\n');
}
