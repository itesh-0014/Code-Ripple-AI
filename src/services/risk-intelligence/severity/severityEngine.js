import { SEVERITY_POLICIES } from './severityPolicies.js';

export function calculateSeverity({ riskScore, confidence }) {
  const score = Number(riskScore) || 0;
  const certainty = Number(confidence) || 0;

  if (
    score >= SEVERITY_POLICIES.criticalRiskScore &&
    certainty >= SEVERITY_POLICIES.criticalConfidence
  ) {
    return 'CRITICAL';
  }

  if (
    score >= SEVERITY_POLICIES.highRiskScore &&
    certainty >= SEVERITY_POLICIES.highConfidence
  ) {
    return 'HIGH';
  }

  if (score >= SEVERITY_POLICIES.mediumRiskScore) {
    return 'MEDIUM';
  }

  return 'LOW';
}
