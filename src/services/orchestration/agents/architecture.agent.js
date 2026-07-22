import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';
import {
  calculateAdaptiveRiskScore,
  riskLevelFromScore,
} from '../routing/routing-policies.js';
import { chooseHighestSeverity, normalizeSeverity } from '../utils/severity.util.js';

export async function architectureAgent(state) {
  const startedAt = new Date();
  const architecturalRisk = aggregateArchitecturalRisk(state);
  const criticalSystemsAffected = inferCriticalSystems(state);
  const cascadingFailureRisks = buildCascadingFailureRisks(state);
  const crossModuleImpact = buildCrossModuleImpact(state);
  const dependencyPropagation = buildDependencyPropagation(state);
  const criticalSystemExposure = buildCriticalSystemExposure({
    state,
    criticalSystemsAffected,
  });
  const architectureAnalysis = {
    phase: 'phase-6-architecture-analysis',
    generatedAt: new Date().toISOString(),
    architecturalRisk,
    criticalSystemsAffected,
    crossModuleImpact,
    dependencyPropagation,
    cascadingFailureRisks,
    criticalSystemExposure,
    reviewFindingSignals: summarizeReviewFindings(state),
    recommendations: buildRecommendations({
      state,
      architecturalRisk,
      criticalSystemsAffected,
      cascadingFailureRisks,
    }),
  };
  const riskScore = calculateAdaptiveRiskScore({
    baseRiskScore: state.riskScore,
    impact: state.impact,
    routeProfile: state.routeProfile,
    validation: state.validation,
    aiReview: state.aiReview,
    architectureAnalysis,
  });

  return {
    architectureAnalysis,
    riskScore,
    routingRiskScore: riskScore,
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'architecture_agent',
      startedAt,
      details: {
        architecturalRisk,
        riskScore,
        criticalSystemsAffected,
        cascadingFailureRiskCount: cascadingFailureRisks.length,
      },
    }),
  };
}

function aggregateArchitecturalRisk(state) {
  const affectedModuleCount = state.impact?.summary?.affectedModuleCount || 0;
  const affectedLayerCount = state.impact?.summary?.affectedLayers?.length || 0;
  const maxPropagationDepth = state.impact?.summary?.maxPropagationDepth || 0;
  const riskScoreLevel = riskLevelFromScore(state.riskScore || 0);
  const riskSignalLevels = (state.impact?.riskSignals || []).map(signal => signal.level);
  const reviewFindingLevels = [
    ...(state.aiReview?.findings || []).map(finding => finding.severity),
    ...(state.aiReview?.architecturalConcerns || []).map(concern => concern.severity),
    ...(state.ruleFindings || []).map(finding => finding.severity),
  ];

  return chooseHighestSeverity([
    riskScoreLevel,
    affectedModuleCount >= 20 ? 'HIGH' : null,
    affectedLayerCount >= 3 ? 'MEDIUM' : null,
    maxPropagationDepth >= 3 ? 'MEDIUM' : null,
    state.routeProfile?.conditions?.authenticationFilesChanged ? 'HIGH' : null,
    ...riskSignalLevels,
    ...reviewFindingLevels,
  ]);
}

function inferCriticalSystems(state) {
  const systems = new Set();
  const candidates = [
    ...(state.impact?.changedFiles || []).map(file => ({
      path: file.filename,
      layer: file.layer,
    })),
    ...(state.affectedModules || []).map(module => ({
      path: module.path,
      layer: module.layer,
    })),
  ];

  for (const item of candidates) {
    for (const system of systemsForLayer(item.layer)) {
      systems.add(system);
    }

    for (const system of systemsForPath(item.path)) {
      systems.add(system);
    }
  }

  for (const signal of state.impact?.riskSignals || []) {
    if (signal.type === 'security-sensitive-change') {
      systems.add('Authentication');
      systems.add('Protected APIs');
    }

    if (signal.type === 'large-blast-radius') {
      systems.add('Shared application contracts');
    }
  }

  for (const system of state.aiReview?.affectedSystems || []) {
    systems.add(system);
  }

  return [...systems].sort();
}

function buildCascadingFailureRisks(state) {
  const risks = [];
  const propagationChains = state.impact?.propagationChains || [];
  const longestChains = [...propagationChains]
    .sort((left, right) => right.distance - left.distance)
    .slice(0, 5);

  for (const chain of longestChains) {
    if (chain.distance < 2) {
      continue;
    }

    risks.push({
      severity: chain.distance >= 3 ? 'HIGH' : 'MEDIUM',
      changedFile: chain.changedFile,
      affectedFile: chain.affectedFile,
      distance: chain.distance,
      chain: chain.chain,
      concern:
        'Dependency propagation may hide behavior changes outside the edited file.',
    });
  }

  if (state.routeProfile?.conditions?.authenticationFilesChanged) {
    risks.push({
      severity: 'HIGH',
      changedFile: null,
      affectedFile: null,
      distance: 0,
      chain: [],
      concern:
        'Auth-sensitive changes can cascade through protected routes and middleware order.',
    });
  }

  return risks;
}

function buildCrossModuleImpact(state) {
  const affectedLayers = state.impact?.summary?.affectedLayers || [];
  const affectedModules = state.affectedModules || [];

  return {
    affectedModuleCount: affectedModules.length,
    affectedLayers,
    broadImpact: Boolean(state.routeProfile?.conditions?.broadImpact),
    modulesByLayer: affectedModules.reduce((accumulator, module) => {
      const layer = module.layer || 'application';
      accumulator[layer] = accumulator[layer] || [];
      accumulator[layer].push(module.path);
      return accumulator;
    }, {}),
  };
}

function buildDependencyPropagation(state) {
  const chains = (state.impact?.propagationChains || [])
    .slice(0, 10)
    .map(chain => ({
      changedFile: chain.changedFile,
      affectedFile: chain.affectedFile,
      distance: chain.distance,
      chain: chain.chain,
    }));

  return {
    maxPropagationDepth: state.impact?.summary?.maxPropagationDepth || 0,
    totalChains: state.impact?.propagationChains?.length || 0,
    sampleChains: chains,
  };
}

function buildCriticalSystemExposure({ state, criticalSystemsAffected }) {
  return criticalSystemsAffected.map(system => ({
    system,
    exposureLevel: exposureLevelForSystem({ state, system }),
    evidence: evidenceForSystem({ state, system }),
  }));
}

function summarizeReviewFindings(state) {
  const findings = [
    ...(state.ruleFindings || []).map(finding => ({
      severity: finding.severity,
      title: finding.ruleName || finding.ruleId,
      source: 'rule-engine',
      filePath: finding.filePath,
    })),
    ...(state.aiReview?.findings || []).map(finding => ({
      severity: finding.severity,
      title: finding.title,
      source: finding.source || 'ai-review',
      filePath: finding.filePath,
    })),
  ];

  return {
    total: findings.length,
    highestSeverity: chooseHighestSeverity(findings.map(finding => finding.severity)),
    topSignals: findings
      .sort(
        (left, right) =>
          severityRank(right.severity) - severityRank(left.severity)
      )
      .slice(0, 8),
  };
}

function buildRecommendations({
  state,
  architecturalRisk,
  criticalSystemsAffected,
  cascadingFailureRisks,
}) {
  const recommendations = [];

  if (['CRITICAL', 'HIGH'].includes(normalizeSeverity(architecturalRisk))) {
    recommendations.push(
      'Require maintainer review for the affected architectural boundary before merge.'
    );
  }

  if (criticalSystemsAffected.includes('Authentication')) {
    recommendations.push(
      'Run authentication, authorization, token, and protected-route regression tests.'
    );
  }

  if (criticalSystemsAffected.includes('MongoDB persistence')) {
    recommendations.push(
      'Validate data migrations, model changes, and persistence error paths.'
    );
  }

  if (cascadingFailureRisks.length > 0) {
    recommendations.push(
      'Inspect downstream dependents in the propagation chains, not only edited files.'
    );
  }

  if (state.context?.summary?.retrievedChunks === 0) {
    recommendations.push(
      'Add or refresh semantic context before relying on AI-only conclusions.'
    );
  }

  return [...new Set(recommendations)];
}

function systemsForLayer(layer) {
  const layerMap = {
    'auth-security': ['Authentication', 'Authorization', 'Protected APIs'],
    api: ['HTTP API boundary', 'Controller workflow'],
    data: ['MongoDB persistence', 'Data integrity'],
    'business-logic': ['Service layer workflow'],
    'frontend-ui': ['React UI flow'],
    configuration: ['Runtime configuration'],
    'shared-utility': ['Shared application contracts'],
  };

  return layerMap[layer] || ['Application module'];
}

function systemsForPath(filePath = '') {
  const lowerPath = String(filePath).toLowerCase();
  const systems = [];

  if (/(auth|jwt|session|token|permission|role)/.test(lowerPath)) {
    systems.push('Authentication');
    systems.push('Authorization');
  }

  if (/middleware/.test(lowerPath)) {
    systems.push('Middleware chain');
  }

  if (/(route|routes|controller|api)/.test(lowerPath)) {
    systems.push('Protected APIs');
  }

  if (/(model|schema|db|database|mongoose|mongo)/.test(lowerPath)) {
    systems.push('MongoDB persistence');
  }

  return systems;
}

function exposureLevelForSystem({ state, system }) {
  if (
    ['Authentication', 'Authorization', 'Protected APIs'].includes(system) &&
    state.routeProfile?.conditions?.authenticationFilesChanged
  ) {
    return 'HIGH';
  }

  if (state.routeProfile?.conditions?.broadImpact) {
    return 'HIGH';
  }

  return ['CRITICAL', 'HIGH'].includes(normalizeSeverity(state.aiReview?.riskLevel))
    ? 'MEDIUM'
    : 'LOW';
}

function evidenceForSystem({ state, system }) {
  const lowerSystem = system.toLowerCase();
  const files = [
    ...(state.impact?.changedFiles || []).map(file => file.filename),
    ...(state.affectedModules || []).map(module => module.path),
  ];

  return files
    .filter(filePath =>
      lowerSystem
        .split(/\s+/)
        .some(token => token.length > 3 && String(filePath).toLowerCase().includes(token))
    )
    .slice(0, 8);
}

function severityRank(value) {
  const severity = normalizeSeverity(value);
  const rank = {
    INFO: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  return rank[severity] || 0;
}
