/**
 * Default role catalog specializations.
 *
 * These are bootstrapped into .hive/role-catalog.json when a new hive is initialized.
 * Projects can customize the catalog by editing the file directly.
 */

export interface Specialization {
  name: string;
  base_role: 'developer' | 'reviewer' | 'tester' | 'researcher';
  triggers: string[];
  brief: string;
  model: 'opus' | 'sonnet' | 'haiku';
}

export interface RoleCatalog {
  specializations: Specialization[];
}

export const DEFAULT_SPECIALIZATIONS: Specialization[] = [
  {
    name: 'security',
    base_role: 'reviewer',
    triggers: ['tag:auth', 'tag:crypto', 'tag:input-validation', 'tag:secrets', 'risk:high'],
    brief:
      'Focus exclusively on security: authentication, authorization, input validation, injection attacks (SQL, XSS, command), cryptographic practices, secrets handling, SSRF, and path traversal. Ignore style and naming unless security-relevant.',
    model: 'opus',
  },
  {
    name: 'architecture',
    base_role: 'reviewer',
    triggers: ['tag:new-module', 'tag:refactor', 'tag:architecture', 'type:feature'],
    brief:
      'Focus exclusively on architecture: coupling, cohesion, SOLID principles, dependency direction, module boundaries, scalability implications, and consistency with established codebase patterns. Ignore minor style issues.',
    model: 'opus',
  },
  {
    name: 'api-contract',
    base_role: 'reviewer',
    triggers: ['tag:api', 'tag:schema', 'tag:breaking-change', 'tag:graphql'],
    brief:
      'Focus exclusively on API contracts: backward compatibility, versioning adherence, request/response schema changes, breaking change detection, REST conventions, and contract adherence for inter-service communication.',
    model: 'opus',
  },
  {
    name: 'performance',
    base_role: 'reviewer',
    triggers: ['tag:performance', 'tag:database', 'tag:algorithm', 'tag:concurrency'],
    brief:
      'Focus exclusively on performance: algorithmic complexity (time/space), memory allocation patterns, concurrency correctness, I/O bottlenecks, N+1 query patterns, cache efficiency, and hot-path optimization.',
    model: 'opus',
  },
  {
    name: 'compliance',
    base_role: 'reviewer',
    triggers: ['tag:compliance', 'tag:gdpr', 'tag:pci', 'tag:hipaa', 'tag:a11y', 'tag:licensing'],
    brief:
      'Focus exclusively on compliance: licensing compatibility (GPL vs MIT vs proprietary), accessibility standards (WCAG 2.1), data protection regulations (GDPR, PCI-DSS, HIPAA), and legal constraints on code usage.',
    model: 'opus',
  },
];

export const DEFAULT_ROLE_CATALOG: RoleCatalog = {
  specializations: DEFAULT_SPECIALIZATIONS,
};
