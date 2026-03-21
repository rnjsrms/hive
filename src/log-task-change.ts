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
