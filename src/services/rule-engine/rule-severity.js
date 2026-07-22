export const RULE_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const SEVERITY_RANK = Object.freeze({
  [RULE_SEVERITY.LOW]: 1,
  [RULE_SEVERITY.MEDIUM]: 2,
  [RULE_SEVERITY.HIGH]: 3,
  [RULE_SEVERITY.CRITICAL]: 4,
});

export function normalizeSeverity(severity) {
  const normalized = String(severity || '').toUpperCase();

  return RULE_SEVERITY[normalized] || RULE_SEVERITY.LOW;
}

export function createSeverityCounter() {
  return {
    [RULE_SEVERITY.CRITICAL]: 0,
    [RULE_SEVERITY.HIGH]: 0,
    [RULE_SEVERITY.MEDIUM]: 0,
    [RULE_SEVERITY.LOW]: 0,
  };
}

export function compareSeverityDesc(left, right) {
  return SEVERITY_RANK[right] - SEVERITY_RANK[left];
}
