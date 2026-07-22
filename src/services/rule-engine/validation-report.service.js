import {
  RULE_SEVERITY,
  SEVERITY_RANK,
  createSeverityCounter,
} from './rule-severity.js';

class ValidationReportService {
  buildReport({
    repository,
    rules,
    targets,
    skippedTargets,
    findings,
    ruleErrors = [],
  }) {
    const sortedFindings = [...findings].sort(compareFindings);
    const bySeverity = createSeverityCounter();
    const byCategory = {};
    const byScope = {};
    const byRule = {};

    for (const finding of sortedFindings) {
      bySeverity[finding.severity] += 1;
      byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
      byScope[finding.scope] = (byScope[finding.scope] || 0) + 1;

      if (!byRule[finding.ruleId]) {
        byRule[finding.ruleId] = {
          ruleId: finding.ruleId,
          ruleName: finding.ruleName,
          severity: finding.severity,
          category: finding.category,
          count: 0,
        };
      }

      byRule[finding.ruleId].count += 1;
    }

    return {
      phase: 'phase-4-rule-engine',
      repository,
      rules: {
        total: rules.length,
        categories: [...new Set(rules.map(rule => rule.category))].sort(),
        catalog: rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
        })),
      },
      targets: {
        total: targets.length,
        changedFiles: targets.filter(target => target.scope === 'changed').length,
        affectedContextModules: targets.filter(
          target => target.scope === 'affected-context'
        ).length,
        skipped: skippedTargets,
      },
      findings: sortedFindings,
      ruleErrors,
      summary: {
        totalFindings: sortedFindings.length,
        ruleErrorCount: ruleErrors.length,
        highestSeverity: getHighestSeverity(bySeverity),
        bySeverity,
        byCategory,
        byScope,
        byRule: Object.values(byRule).sort(
          (left, right) =>
            right.count - left.count ||
            SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
            left.ruleId.localeCompare(right.ruleId)
        ),
      },
    };
  }
}

function compareFindings(left, right) {
  return (
    SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
    left.filePath.localeCompare(right.filePath) ||
    left.line - right.line ||
    left.ruleId.localeCompare(right.ruleId)
  );
}

function getHighestSeverity(bySeverity) {
  return [
    RULE_SEVERITY.CRITICAL,
    RULE_SEVERITY.HIGH,
    RULE_SEVERITY.MEDIUM,
    RULE_SEVERITY.LOW,
  ].find(severity => bySeverity[severity] > 0) || null;
}

export const validationReportService = new ValidationReportService();
