import { normalizeSeverity } from './rule-severity.js';

export function createFinding({
  rule,
  file,
  message,
  line = 1,
  column = 0,
  severity,
  evidence = [],
  recommendation,
  confidence = 'medium',
  metadata = {},
}) {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    category: rule.category,
    severity: normalizeSeverity(severity || rule.severity),
    message,
    filePath: file.normalizedPath,
    line,
    column,
    scope: file.scope,
    layer: file.layer,
    evidence,
    recommendation: recommendation || rule.recommendation,
    confidence,
    metadata,
  };
}
