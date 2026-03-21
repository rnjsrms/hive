export function shouldAutoCommit(inputJson: string): boolean {
  try {
    const data = JSON.parse(inputJson);
    const filePath = (data.tool_input || {}).file_path || '';
    return /\.hive[/\\]/.test(filePath);
  } catch {
    return false;
  }
}
