import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
const SCRIPT_PATH = path.join(SCRIPTS_DIR, 'validate-transition.sh');

describeIf('validate-transition.sh integration', () => {
  let tmpDir: string;
  let wiDir: string;

  function initGitRepo(): void {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  }

  function commitWiFile(id: string, wi: object): void {
    const filePath = path.join(wiDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(wi, null, 2));
    execSync(`git add .hive/work-items/${id}.json`, { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "add wi" --no-verify', { cwd: tmpDir, stdio: 'pipe' });
  }

  function runHook(filePath: string): Buffer {
    const input = { tool_input: { file_path: filePath } };
    return execSync(`bash "${SCRIPT_PATH}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-transition-'));
    wiDir = path.join(tmpDir, '.hive', 'work-items');
    fs.mkdirSync(wiDir, { recursive: true });
    initGitRepo();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should exit 0 for non-work-item file paths', () => {
    const input = { tool_input: { file_path: '/some/other/file.ts' } };
    const result = execSync(`bash "${SCRIPT_PATH}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });

  it('should exit 0 for a new work item not yet in git', () => {
    const wi = { id: 'wi-1', status: 'OPEN' };
    const filePath = path.join(wiDir, 'wi-1.json');
    fs.writeFileSync(filePath, JSON.stringify(wi));

    const result = runHook(filePath);
    expect(result).toBeDefined();
  });

  it('should exit 0 when status has not changed', () => {
    const wi = { id: 'wi-1', status: 'OPEN' };
    commitWiFile('wi-1', wi);
    // Write same status
    fs.writeFileSync(path.join(wiDir, 'wi-1.json'), JSON.stringify(wi));

    const result = runHook(path.join(wiDir, 'wi-1.json'));
    expect(result).toBeDefined();
  });

  it('should exit 0 for valid transition OPEN → ASSIGNED', () => {
    commitWiFile('wi-1', { id: 'wi-1', status: 'OPEN' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-1.json'),
      JSON.stringify({ id: 'wi-1', status: 'ASSIGNED' }),
    );

    const result = runHook(path.join(wiDir, 'wi-1.json'));
    expect(result).toBeDefined();
  });

  it('should exit 0 for valid transition IN_PROGRESS → REVIEW', () => {
    commitWiFile('wi-2', { id: 'wi-2', status: 'IN_PROGRESS' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-2.json'),
      JSON.stringify({ id: 'wi-2', status: 'REVIEW' }),
    );

    const result = runHook(path.join(wiDir, 'wi-2.json'));
    expect(result).toBeDefined();
  });

  it('should exit 0 for valid transition to CANCELLED from any state', () => {
    const states = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'BLOCKED'];
    for (const status of states) {
      const id = `wi-cancel-${status.toLowerCase()}`;
      commitWiFile(id, { id, status });
      fs.writeFileSync(
        path.join(wiDir, `${id}.json`),
        JSON.stringify({ id, status: 'CANCELLED' }),
      );
      const result = runHook(path.join(wiDir, `${id}.json`));
      expect(result).toBeDefined();
    }
  });

  it('should exit 2 for invalid transition OPEN → IN_PROGRESS', () => {
    commitWiFile('wi-3', { id: 'wi-3', status: 'OPEN' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-3.json'),
      JSON.stringify({ id: 'wi-3', status: 'IN_PROGRESS' }),
    );

    try {
      runHook(path.join(wiDir, 'wi-3.json'));
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
    }
  });

  it('should exit 2 for invalid transition OPEN → REVIEW', () => {
    commitWiFile('wi-4', { id: 'wi-4', status: 'OPEN' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-4.json'),
      JSON.stringify({ id: 'wi-4', status: 'REVIEW' }),
    );

    try {
      runHook(path.join(wiDir, 'wi-4.json'));
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
    }
  });

  it('should exit 2 for invalid transition from terminal state MERGED', () => {
    commitWiFile('wi-5', { id: 'wi-5', status: 'MERGED' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-5.json'),
      JSON.stringify({ id: 'wi-5', status: 'IN_PROGRESS' }),
    );

    try {
      runHook(path.join(wiDir, 'wi-5.json'));
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
    }
  });

  it('should exit 2 for invalid transition from terminal state CANCELLED', () => {
    commitWiFile('wi-6', { id: 'wi-6', status: 'CANCELLED' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-6.json'),
      JSON.stringify({ id: 'wi-6', status: 'OPEN' }),
    );

    try {
      runHook(path.join(wiDir, 'wi-6.json'));
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
    }
  });

  it('should exit 0 when new file has no status field', () => {
    commitWiFile('wi-7', { id: 'wi-7', status: 'OPEN' });
    fs.writeFileSync(
      path.join(wiDir, 'wi-7.json'),
      JSON.stringify({ id: 'wi-7' }),
    );

    const result = runHook(path.join(wiDir, 'wi-7.json'));
    expect(result).toBeDefined();
  });

  it('should exit 0 when new file is invalid JSON', () => {
    commitWiFile('wi-8', { id: 'wi-8', status: 'OPEN' });
    fs.writeFileSync(path.join(wiDir, 'wi-8.json'), '{broken');

    const result = runHook(path.join(wiDir, 'wi-8.json'));
    expect(result).toBeDefined();
  });

  it('should exit 0 for empty tool_input', () => {
    const input = { tool_input: {} };
    const result = execSync(`bash "${SCRIPT_PATH}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });
});
