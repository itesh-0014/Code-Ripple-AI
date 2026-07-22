import { classifyModuleLayer, normalizeRepoPath } from '../../../utils/repository-path.util.js';

export const LAYER_PRIORITY = Object.freeze({
  authentication: 10,
  authorization: 10,
  database: 9,
  middleware: 8,
  apiContracts: 8,
  services: 6,
  frontendUi: 2,
  sharedUtility: 5,
  configuration: 5,
  application: 3,
});

const SEVERITY_POINTS = Object.freeze({
  CRITICAL: 15,
  HIGH: 10,
  MEDIUM: 6,
  LOW: 2,
  INFO: 1,
});

const ARCHITECTURE_POINTS = Object.freeze({
  CRITICAL: 15,
  HIGH: 11,
  MEDIUM: 7,
  LOW: 3,
  INFO: 1,
  NOT_ANALYZED: 0,
});

export function scoreFile({ file, state }) {
  const filePath = normalizeRepoPath(file.filename || file.path || file);
  const graphNode = findGraphNode(state, filePath);
  const impactEntry = findImpactEntry(state, filePath);
  const ruleFindings = findingsForFile(state.ruleFindings, filePath);
  const aiFindings = findingsForFile(state.aiReview?.findings, filePath);
  const historicalCriticality = findHistoricalCriticality(state, filePath);
  const layerFactor = scoreLayer(filePath, graphNode?.layer || impactEntry?.layer);
  const dependencyFactor = scoreDependencyImpact({
    graphNode,
    impactEntry,
  });
  const architectureFactor = scoreArchitectureImpact({
    state,
    filePath,
    impactEntry,
  });
  const ruleFactor = scoreFindings([...ruleFindings, ...aiFindings]);
  const historicalFactor = Math.min(10, historicalCriticality);
  const rawScore =
    layerFactor.score +
    dependencyFactor.score +
    architectureFactor.score +
    ruleFactor.score +
    historicalFactor;

  return {
    file: filePath,
    score: Math.min(100, Math.round(rawScore)),
    criticality: null,
    factors: {
      repositoryLayer: layerFactor,
      dependencyCount: dependencyFactor,
      architecturalImpact: architectureFactor,
      ruleFindings: ruleFactor,
      historicalCriticality: {
        score: historicalFactor,
        evidence:
          historicalFactor > 0
            ? [`Historical criticality score ${historicalFactor}`]
            : [],
      },
    },
  };
}

function scoreLayer(filePath, knownLayer) {
  const lowerPath = filePath.toLowerCase();
  const layer = knownLayer || classifyModuleLayer(filePath);
  let category = 'application';
  let weight = LAYER_PRIORITY.application;

  if (/(auth|jwt|session|token)/.test(lowerPath)) {
    category = 'authentication';
    weight = LAYER_PRIORITY.authentication;
  } else if (/(permission|role|acl|policy|authorize|authorization)/.test(lowerPath)) {
    category = 'authorization';
    weight = LAYER_PRIORITY.authorization;
  } else if (/(model|schema|repository|db|database|mongoose|mongo)/.test(lowerPath)) {
    category = 'database';
    weight = LAYER_PRIORITY.database;
  } else if (/middleware/.test(lowerPath)) {
    category = 'middleware';
    weight = LAYER_PRIORITY.middleware;
  } else if (/(route|routes|controller|api|contract|dto|schema)/.test(lowerPath)) {
    category = 'apiContracts';
    weight = LAYER_PRIORITY.apiContracts;
  } else if (/(service|services|usecase|usecases)/.test(lowerPath)) {
    category = 'services';
    weight = LAYER_PRIORITY.services;
  } else if (layer === 'frontend-ui') {
    category = 'frontendUi';
    weight = LAYER_PRIORITY.frontendUi;
  } else if (layer === 'shared-utility') {
    category = 'sharedUtility';
    weight = LAYER_PRIORITY.sharedUtility;
  } else if (layer === 'configuration') {
    category = 'configuration';
    weight = LAYER_PRIORITY.configuration;
  }

  return {
    score: weight * 4,
    weight,
    category,
    layer,
    evidence: [`${category} layer weight ${weight}`],
  };
}

function scoreDependencyImpact({ graphNode, impactEntry }) {
  const directDependents = graphNode?.dependents?.length || impactEntry?.directDependents?.length || 0;
  const directDependencies = graphNode?.dependencies?.length || impactEntry?.directDependencies?.length || 0;
  const affectedModules = impactEntry?.affectedModules?.length || 0;
  const score = Math.min(
    20,
    directDependents * 2 + directDependencies + Math.floor(affectedModules / 2)
  );

  return {
    score,
    directDependents,
    directDependencies,
    affectedModules,
    evidence: [
      `${directDependents} direct dependents`,
      `${directDependencies} direct dependencies`,
      `${affectedModules} downstream affected modules`,
    ],
  };
}

function scoreArchitectureImpact({ state, filePath, impactEntry }) {
  const architectureRisk = normalizeSeverity(
    state.architectureAnalysis?.architecturalRisk || 'NOT_ANALYZED'
  );
  const cascadingRisks = (state.architectureAnalysis?.cascadingFailureRisks || [])
    .filter(risk => normalizeRepoPath(risk.changedFile || '') === filePath);
  const criticalSystems = state.architectureAnalysis?.criticalSystemsAffected || [];
  const matchedSystems = criticalSystems.filter(system =>
    systemMatchesFile(system, filePath)
  );
  const hasBroadImpact = (impactEntry?.affectedModules?.length || 0) >= 10;
  const score = Math.min(
    15,
    (ARCHITECTURE_POINTS[architectureRisk] || 0) +
      cascadingRisks.length * 2 +
      matchedSystems.length * 2 +
      (hasBroadImpact ? 3 : 0)
  );

  return {
    score,
    architectureRisk,
    matchedSystems,
    cascadingRiskCount: cascadingRisks.length,
    evidence: [
      `Architecture risk ${architectureRisk}`,
      ...matchedSystems.map(system => `Critical system ${system}`),
      ...cascadingRisks.map(risk => `Cascading risk ${risk.severity}`),
      ...(hasBroadImpact ? ['Broad downstream impact'] : []),
    ],
  };
}

function scoreFindings(findings) {
  const score = Math.min(
    15,
    findings.reduce(
      (total, finding) => total + (SEVERITY_POINTS[normalizeSeverity(finding.severity)] || 0),
      0
    )
  );

  return {
    score,
    count: findings.length,
    evidence: findings.map(finding =>
      `${normalizeSeverity(finding.severity)} finding: ${finding.ruleName || finding.ruleId || finding.title || 'Review finding'}`
    ),
  };
}

function findGraphNode(state, filePath) {
  const nodes = state.dependencyGraph?.nodes;
  if (!nodes) return undefined;
  if (typeof nodes.get === 'function') {
    return nodes.get(filePath);
  }
  if (Array.isArray(nodes)) {
    return nodes.find(node => node.path === filePath);
  }
  return undefined;
}

function findImpactEntry(state, filePath) {
  return (state.impact?.changedFiles || []).find(entry => entry.filename === filePath);
}

function findingsForFile(findings = [], filePath) {
  return findings.filter(finding =>
    normalizeRepoPath(finding.filePath || finding.filename || '') === filePath
  );
}

function findHistoricalCriticality(state, filePath) {
  const historicalCriticality = state.options?.historicalCriticality || {};

  if (Array.isArray(historicalCriticality)) {
    const match = historicalCriticality.find(entry =>
      normalizeRepoPath(entry.file || entry.filePath || '') === filePath
    );
    return Number(match?.score || match?.criticality || 0);
  }

  return Number(historicalCriticality[filePath] || 0);
}

function systemMatchesFile(system, filePath) {
  const lowerSystem = String(system).toLowerCase();
  const lowerPath = filePath.toLowerCase();

  if (lowerSystem.includes('auth')) {
    return /(auth|jwt|session|token|permission|role)/.test(lowerPath);
  }

  if (lowerSystem.includes('api')) {
    return /(api|route|controller)/.test(lowerPath);
  }

  if (lowerSystem.includes('persistence') || lowerSystem.includes('data')) {
    return /(model|schema|db|database|repository|mongo|mongoose)/.test(lowerPath);
  }

  if (lowerSystem.includes('middleware')) {
    return /middleware/.test(lowerPath);
  }

  return lowerSystem
    .split(/\s+/)
    .some(token => token.length > 3 && lowerPath.includes(token));
}

function normalizeSeverity(value) {
  const severity = String(value || 'INFO').toUpperCase();
  return ARCHITECTURE_POINTS[severity] !== undefined || SEVERITY_POINTS[severity] !== undefined
    ? severity
    : 'INFO';
}

