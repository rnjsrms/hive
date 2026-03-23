export interface FsOps {
  existsSync(path: string): boolean;
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: string): string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function extractWorkItemId(inputJson: string): string | null {
  try {
    const data = JSON.parse(inputJson);
    const taskInput = data.tool_input || {};
    const subject = taskInput.subject || '';
    const metadata = taskInput.metadata || {};
    let wiId = metadata.work_item_id || taskInput.work_item_id || taskInput.id || '';
    if (!wiId) {
      const match = subject.match(/[A-Z][A-Z0-9]+-\d+_WI-\d+/) || subject.match(/(?:feature-\w+_)?WI-\d+/i);
      if (match) wiId = match[0];
    }
    return wiId || null;
  } catch {
    return null;
  }
}

export function validateCompletion(
  inputJson: string,
  wiDir: string,
  fs: FsOps
): ValidationResult {
  const wiId = extractWorkItemId(inputJson);
  if (!wiId) return { valid: true, errors: [] };

  let wiFile = `${wiDir}/${wiId}.json`;
  if (!fs.existsSync(wiFile)) {
    const wiIdLower = wiId!.toLowerCase();
    const files = fs.readdirSync(wiDir).filter(
      (f: string) => {
        const fl = f.toLowerCase();
        return fl === wiIdLower + '.json' || fl.endsWith('_' + wiIdLower + '.json');
      }
    );
    if (files.length > 0) wiFile = `${wiDir}/${files[0]}`;
    else return { valid: true, errors: [] };
  }

  try {
    const wi = JSON.parse(fs.readFileSync(wiFile, 'utf8'));
    const errors: string[] = [];

    const validStatuses = ['READY_TO_MERGE', 'MERGED'];
    if (!validStatuses.includes(wi.status || ''))
      errors.push(`Work item status is "${wi.status || ''}", must be "READY_TO_MERGE" or "MERGED"`);

    const history: Array<{ action?: string }> = wi.history || [];
    if (!history.some((h) => h.action === 'TESTS_PASS'))
      errors.push('Missing tester TESTS_PASS entry in history');

    if (!history.some((h) => h.action === 'APPROVED'))
      errors.push('Missing reviewer APPROVED entry in history');

    return { valid: errors.length === 0, errors };
  } catch {
    return { valid: true, errors: [] };
  }
}
