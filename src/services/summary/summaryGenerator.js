export function generatePRSummary(state) {
  const reviewSummary = state.reviewSummary || {};
  const changedFiles = state.changedFiles || [];
  const affectedSystems = normalizeAffectedSystems(
    reviewSummary.affectedSystems,
    state.architectureAnalysis?.criticalSystemsAffected,
    state.affectedModules
  );
  const topFiles = changedFiles.slice(0, 4).map(file => file.filename).filter(Boolean);
  const fileSummary = topFiles.length
    ? `This PR modifies ${topFiles.join(', ')}${changedFiles.length > topFiles.length ? ' and related files' : ''}.`
    : 'This PR was analyzed for architectural and risk impact.';

  return {
    title: 'GitSense AI Summary',
    executiveSummary: reviewSummary.headline || fileSummary,
    affectedSystems,
    riskScore: state.riskScore ?? reviewSummary.riskScore ?? 0,
    riskLevel: state.riskLevel || reviewSummary.riskLevel || 'LOW',
    confidence: state.confidence ?? reviewSummary.confidence ?? 0,
    severity: state.severity || reviewSummary.severity || 'LOW',
    architectureImpact: reviewSummary.architectureImpact || 'NOT_ANALYZED',
    suggestedNextSteps: reviewSummary.suggestedNextSteps || [],
  };
}

function normalizeAffectedSystems(...groups) {
  const values = groups.flatMap(group => Array.isArray(group) ? group : []);
  const names = values
    .map(item => {
      if (typeof item === 'string') return item;
      return item.name || item.path || item.file || item.filename;
    })
    .filter(Boolean);

  return [...new Set(names)].slice(0, 10);
}
