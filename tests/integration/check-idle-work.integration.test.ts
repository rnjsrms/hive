import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Skip all integration tests if bash is not available
const hasBash = (() => {
  try {
    execSync('bash --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
})();

const describeIf = hasBash ? describe : describe.skip;

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'plugins/hive/scripts');

describeIf('check-idle-work.sh integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-test-'));
    fs.mkdirSync(path.join(tmpDir, '.hive', 'work-items'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should exit 0 when no index file exists', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'check-idle-work.sh');
    // No _index.json created, so script should exit 0
    const result = execSync(`bash "${scriptPath}"`, {
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    // If we get here, exit code was 0
    expect(result).toBeDefined();
  });

  it('should exit 0 when index has no unassigned open items', () => {
    const index = {
      items: [
        { id: 'WI-1', status: 'open', assignee: 'dev-1' },
        { id: 'WI-2', status: 'done', assignee: null },
        { id: 'WI-3', status: 'in-progress', assignee: 'dev-2' },
      ],
    };
    fs.writeFileSync(
      path.join(tmpDir, '.hive', 'work-items', '_index.json'),
      JSON.stringify(index),
    );

    const scriptPath = path.join(SCRIPTS_DIR, 'check-idle-work.sh');
    const result = execSync(`bash "${scriptPath}"`, {
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });

  it('should exit 2 when index has unassigned open items', () => {
    const index = {
      items: [
        { id: 'WI-1', status: 'open', assignee: null },
        { id: 'WI-2', status: 'done', assignee: null },
      ],
    };
    fs.writeFileSync(
      path.join(tmpDir, '.hive', 'work-items', '_index.json'),
      JSON.stringify(index),
    );

    const scriptPath = path.join(SCRIPTS_DIR, 'check-idle-work.sh');
    try {
      execSync(`bash "${scriptPath}"`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      // Should not reach here
      expect.unreachable('Expected script to exit with code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
    }
  });

  it('should output message to stderr when unassigned items found', () => {
    const index = {
      items: [{ id: 'WI-5', status: 'open', assignee: null }],
    };
    fs.writeFileSync(
      path.join(tmpDir, '.hive', 'work-items', '_index.json'),
      JSON.stringify(index),
    );

    const scriptPath = path.join(SCRIPTS_DIR, 'check-idle-work.sh');
    try {
      execSync(`bash "${scriptPath}"`, {
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      expect.unreachable('Expected script to exit with code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
      expect(e.stderr.toString()).toContain('Unassigned work items available');
    }
  });

  it('should exit 0 when index contains malformed JSON', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.hive', 'work-items', '_index.json'),
      '{broken json content!!!',
    );

    const scriptPath = path.join(SCRIPTS_DIR, 'check-idle-work.sh');
    const result = execSync(`bash "${scriptPath}"`, {
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });
});
