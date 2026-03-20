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

// Get the project root (where plugins/hive/scripts/ lives)
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'plugins/hive/scripts');

describeIf('log-communication.sh integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-test-'));
    fs.mkdirSync(path.join(tmpDir, '.hive', 'logs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a JSONL entry from valid input', () => {
    const input = {
      session_id: 's1',
      tool_input: { to: 'dev-1', message: 'hello' },
    };
    const scriptPath = path.join(SCRIPTS_DIR, 'log-communication.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'communications.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.session_id).toBe('s1');
    expect(entry.to).toBe('dev-1');
    expect(entry.message).toBe('hello');
    expect(entry.ts).toBeTruthy();
  });

  it('should append multiple entries on repeated calls', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-communication.sh');
    const env = { ...process.env, CLAUDE_PROJECT_DIR: tmpDir };

    for (let i = 1; i <= 3; i++) {
      const input = {
        session_id: `s${i}`,
        tool_input: { to: `dev-${i}`, message: `msg-${i}` },
      };
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify(input),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
    }

    const logFile = path.join(tmpDir, '.hive', 'logs', 'communications.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).message).toBe('msg-1');
    expect(JSON.parse(lines[1]).message).toBe('msg-2');
    expect(JSON.parse(lines[2]).message).toBe('msg-3');
  });

  it('should handle invalid JSON input silently (exit 0)', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-communication.sh');
    // Should not throw
    execSync(`bash "${scriptPath}"`, {
      input: 'not valid json {{{',
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'communications.jsonl');
    // Log file should either not exist or be empty
    if (fs.existsSync(logFile)) {
      expect(fs.readFileSync(logFile, 'utf8').trim()).toBe('');
    }
  });

  it('should create log directory if missing', () => {
    // Remove the logs directory we created in beforeEach
    fs.rmSync(path.join(tmpDir, '.hive', 'logs'), { recursive: true, force: true });

    const input = {
      session_id: 's1',
      tool_input: { to: 'dev-1', message: 'hello' },
    };
    const scriptPath = path.join(SCRIPTS_DIR, 'log-communication.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'communications.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.message).toBe('hello');
  });

  it('should produce valid JSON on each line', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-communication.sh');
    const env = { ...process.env, CLAUDE_PROJECT_DIR: tmpDir };

    for (let i = 0; i < 5; i++) {
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify({
          session_id: `s${i}`,
          tool_input: { to: 'x', message: `m${i}` },
        }),
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
    }

    const logFile = path.join(tmpDir, '.hive', 'logs', 'communications.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
      const entry = JSON.parse(line);
      expect(entry).toHaveProperty('ts');
      expect(entry).toHaveProperty('session_id');
      expect(entry).toHaveProperty('to');
      expect(entry).toHaveProperty('message');
    }
  });
});
