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

describeIf('log-activity.sh integration', () => {
  let tmpDir: string;
  let wiDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-test-'));
    fs.mkdirSync(path.join(tmpDir, '.hive', 'logs'), { recursive: true });
    wiDir = path.join(tmpDir, '.hive', 'work-items');
    fs.mkdirSync(wiDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeWi = (filename: string, content: any) => {
    const filePath = path.join(wiDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(content));
    return filePath;
  };

  const runScript = (input: any) => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-activity.sh');
    execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
  };

  it('should create an activity log entry for a work-item write', () => {
    const wiPath = writeWi('wi-5.json', {
      id: 'wi-5',
      status: 'in-progress',
      history: [{ agent: 'dev-1', action: 'started', notes: 'beginning work' }],
    });

    runScript({ tool_input: { file_path: wiPath } });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.ts).toBeTruthy();
    expect(entry.agent).toBe('dev-1');
    expect(entry.action).toBe('started');
    expect(entry.work_item).toBe('wi-5');
    expect(entry.status).toBe('in-progress');
    expect(entry.notes).toBe('beginning work');
  });

  it('should use the last history entry', () => {
    const wiPath = writeWi('wi-3.json', {
      id: 'wi-3',
      status: 'done',
      history: [
        { agent: 'dev-1', action: 'started', notes: 'first' },
        { agent: 'dev-2', action: 'completed', notes: 'finished' },
      ],
    });

    runScript({ tool_input: { file_path: wiPath } });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.agent).toBe('dev-2');
    expect(entry.action).toBe('completed');
    expect(entry.notes).toBe('finished');
  });

  it('should skip non-work-item files silently', () => {
    const otherFile = path.join(tmpDir, 'src', 'index.ts');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(otherFile, 'console.log("hi")');

    runScript({ tool_input: { file_path: otherFile } });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    if (fs.existsSync(logFile)) {
      expect(fs.readFileSync(logFile, 'utf8').trim()).toBe('');
    }
  });

  it('should skip work-items with no history', () => {
    const wiPath = writeWi('wi-1.json', {
      id: 'wi-1',
      status: 'pending',
      history: [],
    });

    runScript({ tool_input: { file_path: wiPath } });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    if (fs.existsSync(logFile)) {
      expect(fs.readFileSync(logFile, 'utf8').trim()).toBe('');
    }
  });

  it('should append multiple entries on repeated calls', () => {
    for (let i = 1; i <= 3; i++) {
      const wiPath = writeWi(`wi-${i}.json`, {
        id: `wi-${i}`,
        status: 'in-progress',
        history: [{ agent: `dev-${i}`, action: 'updated', notes: `note-${i}` }],
      });
      runScript({ tool_input: { file_path: wiPath } });
    }

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).work_item).toBe('wi-1');
    expect(JSON.parse(lines[1]).work_item).toBe('wi-2');
    expect(JSON.parse(lines[2]).work_item).toBe('wi-3');
  });

  it('should handle invalid JSON input silently (exit 0)', () => {
    const scriptPath = path.join(SCRIPTS_DIR, 'log-activity.sh');
    execSync(`bash "${scriptPath}"`, {
      input: 'not valid json {{{',
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    if (fs.existsSync(logFile)) {
      expect(fs.readFileSync(logFile, 'utf8').trim()).toBe('');
    }
  });

  it('should create log directory if missing', () => {
    fs.rmSync(path.join(tmpDir, '.hive', 'logs'), { recursive: true, force: true });

    const wiPath = writeWi('wi-5.json', {
      id: 'wi-5',
      status: 'done',
      history: [{ agent: 'dev-1', action: 'completed', notes: '' }],
    });

    runScript({ tool_input: { file_path: wiPath } });

    const logFile = path.join(tmpDir, '.hive', 'logs', 'activity.jsonl');
    expect(fs.existsSync(logFile)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(logFile, 'utf8').trim());
    expect(entry.work_item).toBe('wi-5');
  });
});
