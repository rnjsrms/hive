import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

// Only run on Windows where PowerShell is available
const isWindows = process.platform === 'win32';
const describeIfWin = isWindows ? describe : describe.skip;

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'plugins/hive/scripts');

describeIfWin('notify.ps1 integration', () => {
  const scriptPath = path.join(SCRIPTS_DIR, 'notify.ps1');

  it('should run without error on empty stdin', () => {
    // Use echo "" to provide empty stdin to PowerShell
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      {
        input: '',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      },
    );
    // If we get here, exit code was 0
    expect(result).toBeDefined();
  });

  it('should run without error on valid JSON event', () => {
    const event = { event_type: 'test_event', message: 'Hello from integration test' };
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      {
        input: JSON.stringify(event),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      },
    );
    expect(result).toBeDefined();
  });

  it('should run without error on non-JSON input', () => {
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      {
        input: 'this is not json at all',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      },
    );
    expect(result).toBeDefined();
  });

  it('should handle event with tool_name field', () => {
    const event = { tool_name: 'SendMessage', event_type: 'post_tool' };
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
      {
        input: JSON.stringify(event),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 15000,
      },
    );
    expect(result).toBeDefined();
  });
});
