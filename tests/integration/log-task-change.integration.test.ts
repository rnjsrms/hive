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

describeIf('log-task-change.sh integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-test-'));
    fs.mkdirSync(path.join(tmpDir, '.hive', 'logs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a JSONL entry for TaskCreate input', () => {
    const input = {
      tool_name: 'TaskCreate',
      tool_input: { subject: 'Implement feature X', description: 'Details here' },
      tool_output: 'Task created: #42',
    };
    const scriptPath = path.join(SCRIPTS_DIR, 'log-task-change.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'task-ledger.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.tool).toBe('TaskCreate');
    expect(entry.input.subject).toBe('Implement feature X');
    expect(entry.output).toBe('Task created: #42');
    expect(entry.ts).toBeTruthy();
  });

  it('should create a JSONL entry for TaskUpdate input', () => {
    const input = {
      tool_name: 'TaskUpdate',
      tool_input: { taskId: '42', status: 'completed' },
      tool_output: 'Task updated',
    };
    const scriptPath = path.join(SCRIPTS_DIR, 'log-task-change.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'task-ledger.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.tool).toBe('TaskUpdate');
    expect(entry.input.taskId).toBe('42');
    expect(entry.input.status).toBe('completed');
  });

  it('should truncate tool_output longer than 2000 characters', () => {
    const longOutput = 'z'.repeat(3000);
    const input = {
      tool_name: 'TaskCreate',
      tool_input: { subject: 'test' },
      tool_output: longOutput,
    };
    const scriptPath = path.join(SCRIPTS_DIR, 'log-task-change.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'task-ledger.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.output.length).toBeLessThanOrEqual(2000 + '...[truncated]'.length);
    expect(entry.output).toContain('...[truncated]');
  });

  it('should handle invalid JSON input gracefully (exit 0)', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-task-change.sh');
    // Should not throw
    execSync(`bash "${scriptPath}"`, {
      input: '<<<not json>>>',
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'task-ledger.jsonl');
    if (fs.existsSync(logFile)) {
      expect(fs.readFileSync(logFile, 'utf8').trim()).toBe('');
    }
  });

  it('should append entries on multiple calls', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-task-change.sh');
    const env = { ...process.env, CLAUDE_PROJECT_DIR: tmpDir };

    for (let i = 1; i <= 4; i++) {
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify({
          tool_name: 'TaskCreate',
          tool_input: { subject: `Task ${i}` },
          tool_output: `Created #${i}`,
        }),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
    }

    const logFile = path.join(tmpDir, '.hive', 'logs', 'task-ledger.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
