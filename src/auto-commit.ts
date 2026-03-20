export function shouldAutoCommit(inputJson: string): boolean {
  try {
    const data = JSON.parse(inputJson);
    const filePath = (data.tool_input || {}).file_path || '';
    return filePath.includes('.hive/') || filePath.includes('.hive\\');
  } catch {
    return false;
  }
}
