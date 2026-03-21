import * as fs from 'fs';

export interface ActivityEntry {
  ts: string;
  agent: string;
  action: string;
  work_item: string;
  status: string;
  notes: string;
}

export function buildActivityEntry(inputJson: string, readFile: (filePath: string) => string = (p) => fs.readFileSync(p, 'utf8')): ActivityEntry | null {
  try {
    const data = JSON.parse(inputJson);
    const filePath = (data.tool_input || {}).file_path || '';
    // Only process work-item files (handle both / and \ separators)
    const normalized = filePath.replace(/\\/g, '/');
    if (!normalized.includes('.hive/work-items/wi-')) return null;
    const content = readFile(filePath);
    const wi = JSON.parse(content);
    const history = wi.history || [];
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    return {
      ts: new Date().toISOString(),
      agent: last.agent || '',
      action: last.action || '',
      work_item: wi.id || '',
      status: wi.status || '',
      notes: last.notes || '',
    };
  } catch {
    return null;
  }
}
