export const NOTIFICATION_TEMPLATES = {
  criticalRisk: {
    name: 'CRITICAL_RISK',
    title: 'GitSense AI Critical Alert',
    summary: 'Critical PR risk detected. Immediate engineering review is required.',
  },
  highRisk: {
    name: 'HIGH_RISK',
    title: 'GitSense AI High Risk Alert',
    summary: 'High PR risk detected. Review the findings before merge.',
  },
  mediumRisk: {
    name: 'MEDIUM_RISK',
    title: 'GitSense AI Risk Notice',
    summary: 'Medium PR risk detected. Team review is recommended.',
  },
  lowConfidence: {
    name: 'LOW_CONFIDENCE_REVIEW',
    title: 'GitSense AI Confidence Notice',
    summary: 'Review confidence is low. Additional manual review is recommended.',
  },
  architecture: {
    name: 'ARCHITECTURE_ALERT',
    title: 'GitSense AI Architecture Alert',
    summary: 'A significant architectural change was detected.',
  },
};

export function buildNotificationMessage(state, decision) {
  const template = NOTIFICATION_TEMPLATES[decision.template];
  const repository = state.repository || {};
  const affectedSystems = normalizeNames(
    state.reviewSummary?.affectedSystems ||
    state.architectureAnalysis?.criticalSystemsAffected ||
    state.affectedModules
  );

  return {
    templateName: template.name,
    title: template.title,
    summary: state.reviewSummary?.headline || template.summary,
    repository: [repository.owner, repository.repo].filter(Boolean).join('/') ||
      repository.path ||
      'unknown',
    pullNumber: repository.pullNumber || 'N/A',
    prUrl: buildPullRequestUrl(repository),
    riskScore: formatRiskScore(state.riskScore),
    severity: decision.severity,
    confidence: clampPercent(state.confidence),
    affectedSystems: affectedSystems.slice(0, 8),
    reasons: decision.reasons,
  };
}

function buildPullRequestUrl(repository) {
  if (repository.pullRequestUrl) {
    return repository.pullRequestUrl;
  }

  if (repository.owner && repository.repo && repository.pullNumber) {
    return `https://github.com/${repository.owner}/${repository.repo}/pull/${repository.pullNumber}`;
  }

  return 'https://github.com';
}

function normalizeNames(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(value => {
      if (typeof value === 'string') return value;
      return value.name || value.path || value.file || value.filename;
    })
    .filter(Boolean);
}

function formatRiskScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(1) : '0.0';
}

function clampPercent(value) {
  const percent = Number(value);
  return Number.isFinite(percent)
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : 0;
}
