import { normalizeSeverity } from '../../orchestration/utils/severity.util.js';

export const RISK_FACTOR_WEIGHTS = Object.freeze({
  repositoryLayer: 3,
  affectedModules: 1,
  dependencyPropagation: 1,
  ruleFindings: 3,
  architectureAnalysis: 1,
  aiReviewFindings: 1,
});

export const REPOSITORY_LAYER_WEIGHTS = Object.freeze({
  'auth-security': 3,
  authorization: 3,
  data: 2.5,
  middleware: 2.5,
  api: 2,
  'business-logic': 1.5,
  'frontend-ui': 0.5,
  configuration: 1,
  'shared-utility': 1.5,
  application: 1,
});

const RULE_NAME_WEIGHTS = Object.freeze([
  { pattern: /(hardcoded|secret|credential|api key|token)/i, score: 3 },
  { pattern: /(unsafe|sql|query|injection)/i, score: 2 },
  { pattern: /(validation|sanitize|sanitise)/i, score: 1 },
  { pattern: /(console|debug)/i, score: 0.2 },
]);

const SEVERITY_SCORES = Object.freeze({
  CRITICAL: 2,
  HIGH: 1,
  MEDIUM: 0.5,
  LOW: 0.2,
  INFO: 0.05,
});

export function buildRiskFactors(state) {
  return [
    buildRepositoryLayerFactor(state),
    buildAffectedModuleFactor(state),
    buildDependencyPropagationFactor(state),
    buildRuleFindingFactor(state),
    buildArchitectureFactor(state),
    buildAiReviewFactor(state),
  ];
}

function buildRepositoryLayerFactor(state) {
  const layerCandidates = [
    ...(state.impact?.changedFiles || []).map(file => file.layer),
    ...(state.changedFiles || []).map(file => inferLayerFromPath(file.filename)),
  ].filter(Boolean);
  const uniqueLayers = [...new Set(layerCandidates)];
  const scoredLayers = uniqueLayers
    .map(layer => ({
      layer,
      score: REPOSITORY_LAYER_WEIGHTS[layer] || REPOSITORY_LAYER_WEIGHTS.application,
    }))
    .sort((left, right) => right.score - left.score);
  const highest = scoredLayers[0] || { layer: 'application', score: 0 };

  return factor({
    id: 'repository-layer',
    label: 'Repository layer',
    score: highest.score,
    maxScore: RISK_FACTOR_WEIGHTS.repositoryLayer,
    evidence: scoredLayers,
    reasons: highest.score > 0 ? [`${formatLayer(highest.layer)} layer modified`] : [],
  });
}

function buildAffectedModuleFactor(state) {
  const count =
    state.affectedModules?.length ||
    state.impact?.summary?.affectedModuleCount ||
    0;
  const score = count >= 20 ? 1 : count >= 10 ? 0.7 : count >= 4 ? 0.4 : count > 0 ? 0.2 : 0;

  return factor({
    id: 'affected-modules',
    label: 'Affected module count',
    score,
    maxScore: RISK_FACTOR_WEIGHTS.affectedModules,
    evidence: { affectedModuleCount: count },
    reasons: count > 0 ? [`${count} downstream module${count === 1 ? '' : 's'} affected`] : [],
  });
}

function buildDependencyPropagationFactor(state) {
  const chains = state.impact?.propagationChains || [];
  const maxDepth = state.impact?.summary?.maxPropagationDepth || 0;
  const score =
    chains.length >= 20 || maxDepth >= 4
      ? 1
      : chains.length >= 10 || maxDepth >= 3
        ? 0.7
        : chains.length > 0 || maxDepth > 0
          ? 0.3
          : 0;

  return factor({
    id: 'dependency-propagation',
    label: 'Dependency propagation',
    score,
    maxScore: RISK_FACTOR_WEIGHTS.dependencyPropagation,
    evidence: { propagationChainCount: chains.length, maxPropagationDepth: maxDepth },
    reasons:
      chains.length > 0
        ? [`Dependency changes propagate through ${chains.length} known chain${chains.length === 1 ? '' : 's'}`]
        : [],
  });
}

function buildRuleFindingFactor(state) {
  const findings = state.ruleFindings || [];
  const scoredFindings = findings.map(finding => {
    const text = `${finding.ruleName || ''} ${finding.ruleId || ''} ${finding.message || ''}`;
    const namedWeight = RULE_NAME_WEIGHTS.find(item => item.pattern.test(text))?.score;

    return {
      ruleId: finding.ruleId || null,
      title: finding.ruleName || finding.ruleId || 'Rule finding',
      severity: normalizeSeverity(finding.severity),
      score: namedWeight ?? SEVERITY_SCORES[normalizeSeverity(finding.severity)],
    };
  });
  const score = Math.min(
    RISK_FACTOR_WEIGHTS.ruleFindings,
    scoredFindings.reduce((total, finding) => total + finding.score, 0)
  );
  const ruleReasons = [...scoredFindings]
    .sort((left, right) => right.score - left.score)
    .map(finding => `Rule engine detected ${finding.title}`)
    .filter(unique)
    .slice(0, 3);

  return factor({
    id: 'rule-findings',
    label: 'Rule findings',
    score,
    maxScore: RISK_FACTOR_WEIGHTS.ruleFindings,
    evidence: scoredFindings,
    reasons: ruleReasons,
  });
}

function buildArchitectureFactor(state) {
  const architecturalRisk = normalizeSeverity(
    state.architectureAnalysis?.architecturalRisk
  );
  const scoreMap = { CRITICAL: 1, HIGH: 0.8, MEDIUM: 0.45, LOW: 0.1, INFO: 0 };
  const criticalSystems = state.architectureAnalysis?.criticalSystemsAffected || [];
  const reasons = [];

  if (architecturalRisk !== 'INFO') {
    reasons.push(`Architecture analysis reports ${architecturalRisk} impact`);
  }

  if (criticalSystems.length > 0) {
    reasons.push(`${criticalSystems.slice(0, 3).join(', ')} affected`);
  }

  return factor({
    id: 'architecture-analysis',
    label: 'Architecture analysis',
    score: scoreMap[architecturalRisk],
    maxScore: RISK_FACTOR_WEIGHTS.architectureAnalysis,
    evidence: { architecturalRisk, criticalSystemsAffected: criticalSystems },
    reasons,
  });
}

function buildAiReviewFactor(state) {
  if (!state.aiReview) {
    return factor({
      id: 'ai-review-findings',
      label: 'AI review findings',
      score: 0,
      maxScore: RISK_FACTOR_WEIGHTS.aiReviewFindings,
      evidence: {
        available: false,
        riskLevel: null,
        findingCount: 0,
        topFinding: null,
      },
      reasons: [],
    });
  }

  const findings = state.aiReview?.findings || [];
  const riskLevel = normalizeSeverity(state.aiReview?.riskLevel);
  const findingScore = findings.reduce(
    (total, finding) => total + SEVERITY_SCORES[normalizeSeverity(finding.severity)],
    0
  );
  const riskLevelScore = SEVERITY_SCORES[riskLevel] || 0;
  const score = Math.min(
    RISK_FACTOR_WEIGHTS.aiReviewFindings,
    Math.max(findingScore, riskLevelScore)
  );
  const topFinding = [...findings].sort(
    (left, right) =>
      SEVERITY_SCORES[normalizeSeverity(right.severity)] -
      SEVERITY_SCORES[normalizeSeverity(left.severity)]
  )[0];

  return factor({
    id: 'ai-review-findings',
    label: 'AI review findings',
    score,
    maxScore: RISK_FACTOR_WEIGHTS.aiReviewFindings,
    evidence: {
      available: true,
      riskLevel,
      findingCount: findings.length,
      topFinding: topFinding?.title || null,
    },
    reasons: topFinding ? [`AI review identified ${topFinding.title}`] : [],
  });
}

function factor({ id, label, score, maxScore, evidence, reasons }) {
  return {
    id,
    label,
    score: round(score),
    maxScore,
    evidence,
    reasons,
  };
}

function inferLayerFromPath(filePath = '') {
  const path = String(filePath).toLowerCase();

  if (/(auth|jwt|session|token|permission|role)/.test(path)) return 'auth-security';
  if (/middleware/.test(path)) return 'middleware';
  if (/(model|schema|db|database|migration|repository)/.test(path)) return 'data';
  if (/(route|controller|api)/.test(path)) return 'api';
  if (/(service|use-case|domain)/.test(path)) return 'business-logic';
  if (/(component|page|view|frontend|client)/.test(path)) return 'frontend-ui';
  if (/(config|env)/.test(path)) return 'configuration';
  if (/(util|helper|shared)/.test(path)) return 'shared-utility';

  return 'application';
}

function formatLayer(layer) {
  const labels = {
    'auth-security': 'Authentication',
    authorization: 'Authorization',
    data: 'Database',
    middleware: 'Middleware',
    api: 'API',
    'business-logic': 'Business logic',
    'frontend-ui': 'Frontend',
    configuration: 'Configuration',
    'shared-utility': 'Shared utility',
    application: 'Application',
  };

  return labels[layer] || layer;
}

function round(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function unique(value, index, values) {
  return values.indexOf(value) === index;
}
