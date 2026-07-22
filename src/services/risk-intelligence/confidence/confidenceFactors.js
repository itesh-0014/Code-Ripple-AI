import { normalizeSeverity } from '../../orchestration/utils/severity.util.js';

export const CONFIDENCE_FACTOR_WEIGHTS = Object.freeze({
  contextCoverage: 20,
  dependencyCoverage: 25,
  ruleEngineAgreement: 15,
  architectureAgreement: 15,
  reflectionCount: 10,
  aiCertainty: 15,
});

export function buildConfidenceFactors(state) {
  return [
    contextCoverage(state),
    dependencyCoverage(state),
    ruleEngineAgreement(state),
    architectureAgreement(state),
    reflectionCount(state),
    aiCertainty(state),
  ];
}

function contextCoverage(state) {
  const retrievedFiles =
    state.context?.summary?.uniqueRetrievedFiles ||
    new Set((state.retrievedContext || []).map(item => item.path || item.filePath)).size;
  const retrievedChunks =
    state.context?.summary?.retrievedChunks || state.retrievedContext?.length || 0;
  const score =
    retrievedFiles >= 20 || retrievedChunks >= 40
      ? 20
      : retrievedFiles >= 10 || retrievedChunks >= 20
        ? 16
        : retrievedFiles >= 3 || retrievedChunks >= 5
          ? 11
          : retrievedChunks > 0
            ? 6
            : 3;

  return factor('context-coverage', 'Context coverage', score, 20, {
    retrievedFiles,
    retrievedChunks,
  });
}

function dependencyCoverage(state) {
  const nodeCount = state.dependencyGraph?.nodes?.length || state.graph?.nodes?.size || 0;
  const parseErrors =
    state.dependencyGraph?.parseErrors?.length || state.graph?.parseErrors?.length || 0;
  const unresolvedImports = (state.dependencyGraph?.nodes || []).reduce(
    (total, node) => total + (node.unresolvedImports?.length || 0),
    0
  );
  let score = nodeCount > 0 ? 25 : 8;
  score -= Math.min(10, parseErrors * 2);
  score -= Math.min(7, unresolvedImports);

  return factor('dependency-coverage', 'Dependency coverage', score, 25, {
    nodeCount,
    parseErrors,
    unresolvedImports,
  });
}

function ruleEngineAgreement(state) {
  if (!state.validation?.summary) {
    return factor('rule-engine-agreement', 'Rule engine agreement', 5, 15, {
      available: false,
    });
  }

  const ruleSeverity = normalizeSeverity(state.validation.summary.highestSeverity);
  const aiSeverity = normalizeSeverity(state.aiReview?.riskLevel);
  const agrees =
    ruleSeverity === aiSeverity ||
    (['HIGH', 'CRITICAL'].includes(ruleSeverity) &&
      ['HIGH', 'CRITICAL'].includes(aiSeverity));

  return factor('rule-engine-agreement', 'Rule engine agreement', agrees ? 15 : 10, 15, {
    available: true,
    ruleSeverity,
    aiSeverity,
    agrees,
  });
}

function architectureAgreement(state) {
  if (!state.architectureAnalysis) {
    return factor('architecture-agreement', 'Architecture agreement', 7, 15, {
      available: false,
    });
  }

  const architectureSeverity = normalizeSeverity(
    state.architectureAnalysis.architecturalRisk
  );
  const aiSeverity = normalizeSeverity(state.aiReview?.riskLevel);
  const agrees =
    architectureSeverity === aiSeverity ||
    (['HIGH', 'CRITICAL'].includes(architectureSeverity) &&
      ['HIGH', 'CRITICAL'].includes(aiSeverity));

  return factor('architecture-agreement', 'Architecture agreement', agrees ? 15 : 10, 15, {
    available: true,
    architectureSeverity,
    aiSeverity,
    agrees,
  });
}

function reflectionCount(state) {
  const retries = state.retries?.contextExpansion || 0;
  const score = Math.max(4, 10 - retries * 2);

  return factor('reflection-count', 'Review reflection count', score, 10, {
    contextExpansionRetries: retries,
  });
}

function aiCertainty(state) {
  const aiConfidence = Number.parseInt(state.aiReview?.confidence, 10);
  const text = [
    state.aiReview?.summary,
    ...(state.aiReview?.findings || []).map(finding => finding.description),
  ]
    .filter(Boolean)
    .join(' ');
  const uncertaintySignals = (text.match(/\b(may|might|possibly|uncertain|could)\b/gi) || [])
    .length;
  const baseScore = Number.isFinite(aiConfidence)
    ? Math.round((Math.min(100, Math.max(0, aiConfidence)) / 100) * 15)
    : state.aiReview
      ? 10
      : 6;
  const score = Math.max(0, baseScore - Math.min(5, uncertaintySignals));

  return factor('ai-certainty', 'AI certainty', score, 15, {
    aiConfidence: Number.isFinite(aiConfidence) ? aiConfidence : null,
    uncertaintySignals,
  });
}

function factor(id, label, score, maxScore, evidence) {
  return {
    id,
    label,
    score: Math.min(maxScore, Math.max(0, Math.round(score))),
    maxScore,
    evidence,
  };
}
