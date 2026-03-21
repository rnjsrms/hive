export interface CommunicationEntry {
  ts: string;
  session_id: string;
  from: string;
  to: string;
  summary: string;
  message: string;
}

export function buildCommunicationEntry(inputJson: string): CommunicationEntry | null {
  try {
    const data = JSON.parse(inputJson);
    let message = (data.tool_input || {}).message || '';
    if (typeof message === 'object') message = JSON.stringify(message);
    // Safety ceiling to prevent unbounded log growth
    if (message.length > 100000) message = message.substring(0, 100000) + '...[safety-truncated]';
    // Parse sender identity from [hive:xxx] tag in message content.
    // Falls back to empty string if tag is absent (e.g., protocol messages).
    const fromMatch = typeof message === 'string' ? message.match(/\[hive:([^\]]+)\]/) : null;
    const from = fromMatch ? fromMatch[1] : '';
    const summary = (data.tool_input || {}).summary || '';
    return {
      ts: new Date().toISOString(),
      session_id: data.session_id || '',
      from,
      to: (data.tool_input || {}).to || '',
      summary,
      message,
    };
  } catch {
    return null;
  }
}
