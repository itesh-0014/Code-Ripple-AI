import { config } from '../../../config/env.js';
import { normalizeSeverity, SEVERITY_RANK } from '../../orchestration/utils/severity.util.js';

export function evaluateNotificationPolicy(state, policyConfig = config.notifications) {
  const severity = normalizeSeverity(state.severity || state.riskLevel || 'LOW');
  const confidence = Number(state.confidence);
  const architectureRisk = normalizeSeverity(
    state.reviewSummary?.architectureImpact ||
    state.architectureAnalysis?.architecturalRisk ||
    'LOW'
  );
  const lowConfidence =
    Number.isFinite(confidence) &&
    confidence < policyConfig.lowConfidenceThreshold;
  const minimumSeverity = normalizeSeverity(policyConfig.minimumSeverity || 'HIGH');
  const severityEligible =
    SEVERITY_RANK[severity] >= SEVERITY_RANK[minimumSeverity] ||
    (severity === 'MEDIUM' && policyConfig.notifyMediumRisk);
  const architectureAlert = ['HIGH', 'CRITICAL'].includes(architectureRisk);
  const shouldNotify =
    policyConfig.enabled !== false &&
    (severityEligible || lowConfidence || architectureAlert);

  const reasons = [];
  if (severityEligible) reasons.push(`${severity} severity meets notification policy`);
  if (lowConfidence) reasons.push(`Review confidence is ${Math.round(confidence)}%`);
  if (architectureAlert) reasons.push(`${architectureRisk} architecture impact detected`);

  return {
    shouldNotify,
    severity,
    lowConfidence,
    architectureAlert,
    reasons,
    template: selectTemplate({
      severity,
      lowConfidence,
      architectureAlert,
    }),
    reason: shouldNotify
      ? reasons.join('; ')
      : policyConfig.enabled === false
        ? 'Notifications are disabled.'
        : 'Review did not meet notification policy.',
  };
}

function selectTemplate({ severity, lowConfidence, architectureAlert }) {
  if (severity === 'CRITICAL') return 'criticalRisk';
  if (severity === 'HIGH') return 'highRisk';
  if (architectureAlert) return 'architecture';
  if (lowConfidence) return 'lowConfidence';
  return 'mediumRisk';
}
