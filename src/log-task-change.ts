export interface TaskChangeEntry {
  ts: string;
  tool: string;
  input: Record<string, unknown>;
  output: string;
}

export function buildTaskChangeEntry(inputJson: string): TaskChangeEntry | null {
  try {
    const data = JSON.parse(inputJson);
    let output = data.tool_output || '';
    if (typeof output === 'object') output = JSON.stringify(output);
    if (output.length > 2000) output = output.substring(0, 2000) + '...[truncated]';
    return {
      ts: new Date().toISOString(),
      tool: data.tool_name || '',
      input: data.tool_input || {},
      output,
    };
  } catch {
    return null;
  }
}
