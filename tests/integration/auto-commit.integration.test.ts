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

describeIf('auto-commit.sh integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-test-'));
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
    fs.mkdirSync(path.join(tmpDir, '.hive'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.hive', 'init.json'), '{}');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function commitCount(): number {
    const out = execSync('git log --oneline', { cwd: tmpDir, stdio: 'pipe' });
    return out.toString().trim().split('\n').length;
  }

  it('should commit when input path contains .hive/', () => {
    // Create a new file in .hive/ so there is something to commit
    fs.writeFileSync(path.join(tmpDir, '.hive', 'state.json'), '{"x":1}');

    const input = { tool_input: { file_path: '.hive/state.json' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'auto-commit.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    expect(commitCount()).toBe(2);
  });

  it('should not commit when input path does not contain .hive/', () => {
    fs.writeFileSync(path.join(tmpDir, 'src.txt'), 'hello');

    const input = { tool_input: { file_path: 'src/index.ts' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'auto-commit.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    expect(commitCount()).toBe(1);
  });

  it('should use "hive: auto-state" prefix in commit message', () => {
    fs.writeFileSync(path.join(tmpDir, '.hive', 'work.json'), '{"done":true}');

    const input = { tool_input: { file_path: '.hive/work.json' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'auto-commit.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const log = execSync('git log --oneline -1', { cwd: tmpDir, stdio: 'pipe' }).toString().trim();
    expect(log).toContain('hive: auto-state');
  });

  it('should be a silent no-op when .hive has no changes', () => {
    // No new files in .hive/ — nothing to commit
    const input = { tool_input: { file_path: '.hive/init.json' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'auto-commit.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    expect(commitCount()).toBe(1);
  });

  it('should not commit on invalid JSON input', () => {
    fs.writeFileSync(path.join(tmpDir, '.hive', 'extra.json'), '{}');

    const scriptPath = path.join(SCRIPTS_DIR, 'auto-commit.sh');
    execSync(`bash "${scriptPath}"`, {
      input: 'not valid json',
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    expect(commitCount()).toBe(1);
  });
});
