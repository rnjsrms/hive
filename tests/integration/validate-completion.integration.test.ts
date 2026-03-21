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

describeIf('validate-completion.sh integration', () => {
  let tmpDir: string;
  let wiDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-test-'));
    wiDir = path.join(tmpDir, '.hive', 'work-items');
    fs.mkdirSync(wiDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should exit 0 when input has no work item ID', () => {
    const input = { tool_input: { subject: 'Just a regular task' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    const result = execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });

  it('should exit 0 for WI with ready-to-merge status and TESTS_PASS and APPROVED in history', () => {
    const wi = {
      id: 'WI-1',
      status: 'ready-to-merge',
      risk: 'low',
      history: [
        { action: 'TESTS_PASS', agent: 'tester', ts: '2026-01-01T00:00:00Z' },
        { action: 'APPROVED', agent: 'reviewer', ts: '2026-01-01T00:00:00Z' },
      ],
    };
    fs.writeFileSync(path.join(wiDir, 'WI-1.json'), JSON.stringify(wi));

    const input = { tool_input: { id: 'WI-1' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    const result = execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });

  it('should exit 2 when WI has in-progress status', () => {
    const wi = {
      id: 'WI-2',
      status: 'in-progress',
      risk: 'low',
      history: [
        { action: 'TESTS_PASS', agent: 'tester', ts: '2026-01-01T00:00:00Z' },
      ],
    };
    fs.writeFileSync(path.join(wiDir, 'WI-2.json'), JSON.stringify(wi));

    const input = { tool_input: { id: 'WI-2' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    try {
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      // Script exits 2 for invalid status; stderr is suppressed by 2>/dev/null in the script
      expect(e.status).toBe(2);
    }
  });

  it('should exit 2 when WI has no TESTS_PASS in history', () => {
    const wi = {
      id: 'WI-3',
      status: 'ready-to-merge',
      risk: 'low',
      history: [
        { action: 'started', agent: 'dev-1', ts: '2026-01-01T00:00:00Z' },
      ],
    };
    fs.writeFileSync(path.join(wiDir, 'WI-3.json'), JSON.stringify(wi));

    const input = { tool_input: { id: 'WI-3' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    try {
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      // Script exits 2 when TESTS_PASS is missing; stderr suppressed by 2>/dev/null
      expect(e.status).toBe(2);
    }
  });

  it('should exit 2 for high-risk WI without APPROVED in history', () => {
    const wi = {
      id: 'WI-4',
      status: 'ready-to-merge',
      risk: 'high',
      history: [
        { action: 'TESTS_PASS', agent: 'tester', ts: '2026-01-01T00:00:00Z' },
      ],
    };
    fs.writeFileSync(path.join(wiDir, 'WI-4.json'), JSON.stringify(wi));

    const input = { tool_input: { id: 'WI-4' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    try {
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      // Script exits 2 when high-risk item lacks APPROVED; stderr suppressed by 2>/dev/null
      expect(e.status).toBe(2);
    }
  });

  it('should exit 2 for low-risk WI without APPROVED in history', () => {
    const wi = {
      id: 'WI-6',
      status: 'ready-to-merge',
      risk: 'low',
      history: [
        { action: 'TESTS_PASS', agent: 'tester', ts: '2026-01-01T00:00:00Z' },
      ],
    };
    fs.writeFileSync(path.join(wiDir, 'WI-6.json'), JSON.stringify(wi));

    const input = { tool_input: { id: 'WI-6' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    try {
      execSync(`bash "${scriptPath}"`, {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
      });
      expect.unreachable('Expected exit code 2');
    } catch (e: any) {
      expect(e.status).toBe(2);
    }
  });

  it('should not match WI-1 against WI-10 file (exact matching)', () => {
    const wi10 = {
      id: 'WI-10',
      status: 'in-progress',
      risk: 'low',
      history: [],
    };
    fs.writeFileSync(path.join(wiDir, 'WI-10.json'), JSON.stringify(wi10));

    const input = { tool_input: { id: 'WI-1' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    // WI-1 does not exist, and WI-10 should NOT be matched — exit 0 (skip)
    const result = execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });

  it('should exit 0 gracefully when WI file has parse error', () => {
    fs.writeFileSync(path.join(wiDir, 'WI-5.json'), '{broken json!!');

    const input = { tool_input: { id: 'WI-5' } };
    const scriptPath = path.join(SCRIPTS_DIR, 'validate-completion.sh');
    // The script catches JSON parse errors and allows completion
    const result = execSync(`bash "${scriptPath}"`, {
      input: JSON.stringify(input),
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    expect(result).toBeDefined();
  });
});
