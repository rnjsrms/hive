export function checkForIdleWork(indexContent: string): 'found' | 'none' {
  try {
    const items = JSON.parse(indexContent).items || [];
    const unassigned = items.filter(
      (i: { status?: string; assignee?: string | null }) =>
        i.status === 'open' && i.assignee == null
    );
    return unassigned.length > 0 ? 'found' : 'none';
  } catch {
    return 'none';
  }
}
