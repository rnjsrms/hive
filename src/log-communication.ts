export interface CommunicationEntry {
  ts: string;
  session_id: string;
  to: string;
  message: string;
}

export function buildCommunicationEntry(inputJson: string): CommunicationEntry | null {
  try {
    const data = JSON.parse(inputJson);
    let message = (data.tool_input || {}).message || '';
    if (typeof message === 'object') message = JSON.stringify(message);
    if (message.length > 1000) message = message.substring(0, 1000) + '...[truncated]';
    return {
      ts: new Date().toISOString(),
      session_id: data.session_id || '',
      to: (data.tool_input || {}).to || '',
      message,
    };
  } catch {
    return null;
  }
}
