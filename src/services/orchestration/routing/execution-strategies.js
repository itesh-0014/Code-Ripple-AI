import {
  REVIEW_DEPTH,
  ROUTING_THRESHOLDS,
  chooseReviewDepth,
  riskLevelFromScore,
} from './routing-policies.js';

export const ORCHESTRATION_AGENTS = Object.freeze({
  dependency: 'dependencyAgent',
  context: 'contextAgent',
  rule: 'ruleAgent',
  review: 'reviewAgent',
  architecture: 'architectureAgent',
  riskIntelligence: 'riskIntelligenceAgent',
  smartReview: 'smartReviewAgent',
  summary: 'riskSummaryAgent',
});

export function buildExecutionPlan({
  analysis,
  riskScore,
  riskLevel = riskLevelFromScore(riskScore),
  reviewDepth = chooseReviewDepth({ analysis, riskScore }),
  options = {},
}) {
  const requiredAgents = [
    ORCHESTRATION_AGENTS.dependency,
    ORCHESTRATION_AGENTS.review,
    ORCHESTRATION_AGENTS.riskIntelligence,
    ORCHESTRATION_AGENTS.smartReview,
    ORCHESTRATION_AGENTS.summary,
  ];
  const skippedAgents = [];
  const reasonCodes = [];

  if (options.includeSemanticContext) {
    requiredAgents.splice(1, 0, ORCHESTRATION_AGENTS.context);
  } else {
    skippedAgents.push({
      agent: ORCHESTRATION_AGENTS.context,
      reason: 'semantic context is disabled',
    });
  }

  if (options.includeRuleValidation !== false) {
    insertBefore(requiredAgents, ORCHESTRATION_AGENTS.review, ORCHESTRATION_AGENTS.rule);
  } else {
    skippedAgents.push({
      agent: ORCHESTRATION_AGENTS.rule,
      reason: 'rule validation is disabled',
    });
  }

  if (shouldPlanArchitectureAgent({ analysis, riskScore, reviewDepth })) {
    insertBefore(
      requiredAgents,
      ORCHESTRATION_AGENTS.riskIntelligence,
      ORCHESTRATION_AGENTS.architecture
    );
  }

  if (analysis.frontendOnly) {
    reasonCodes.push('frontend-focused-change');
  }

  if (analysis.authTouched) {
    reasonCodes.push('auth-security-change');
  }

  if (analysis.dataTouched) {
    reasonCodes.push('data-layer-change');
  }

  if (riskScore >= ROUTING_THRESHOLDS.highRiskScore) {
    reasonCodes.push('high-risk-score');
  }

  return {
    generatedAt: new Date().toISOString(),
    strategy: buildStrategyName(reviewDepth),
    riskLevel,
    riskScore,
    reviewDepth,
    requiredAgents: unique(requiredAgents),
    skippedAgents,
    parallelizableBranches: buildParallelBranches({ options }),
    rulePolicy: buildInitialRulePolicy(analysis),
    reflection: {
      confidenceThreshold: ROUTING_THRESHOLDS.minReviewConfidence,
      maxContextExpansionRetries:
        ROUTING_THRESHOLDS.maxContextExpansionRetries,
    },
    contextExpansion: {
      normalChunksPerChangedFile:
        ROUTING_THRESHOLDS.normalContextChunksPerChangedFile,
      expandedChunksPerChangedFile:
        ROUTING_THRESHOLDS.expandedContextChunksPerChangedFile,
    },
    reasonCodes: unique(reasonCodes),
  };
}

export function refineExecutionPlanAfterDependency({
  executionPlan,
  options = {},
  routeProfile,
  riskScore,
  riskLevel = riskLevelFromScore(riskScore),
}) {
  const nextPlan = {
    ...(executionPlan || {}),
    generatedAt: executionPlan?.generatedAt || new Date().toISOString(),
    refinedAt: new Date().toISOString(),
    riskScore,
    riskLevel,
    requiredAgents: [...(executionPlan?.requiredAgents || [])],
    skippedAgents: [...(executionPlan?.skippedAgents || [])],
    reasonCodes: [...(executionPlan?.reasonCodes || [])],
    rulePolicy: routeProfile?.rulePolicy || executionPlan?.rulePolicy || {},
  };

  if (options.includeSemanticContext) {
    addRequiredAgent(nextPlan, ORCHESTRATION_AGENTS.context);
  }

  if (options.includeRuleValidation !== false) {
    addRequiredAgent(nextPlan, ORCHESTRATION_AGENTS.rule);
  }

  if (
    riskScore >= ROUTING_THRESHOLDS.highRiskScore ||
    routeProfile?.conditions?.authenticationFilesChanged ||
    routeProfile?.conditions?.broadImpact
  ) {
    addRequiredAgent(nextPlan, ORCHESTRATION_AGENTS.architecture);
    addReasonCode(nextPlan, 'dependency-risk-requires-architecture-analysis');
    nextPlan.reviewDepth = REVIEW_DEPTH.DEEP;
  }

  if (routeProfile?.conditions?.frontendOnly) {
    addReasonCode(nextPlan, 'dependency-profile-frontend-only');
  }

  if (routeProfile?.conditions?.backendOnly) {
    addReasonCode(nextPlan, 'dependency-profile-backend-only');
  }

  nextPlan.strategy = buildStrategyName(nextPlan.reviewDepth);
  nextPlan.requiredAgents = orderAgents(unique(nextPlan.requiredAgents));
  nextPlan.reasonCodes = unique(nextPlan.reasonCodes);

  return nextPlan;
}

export function shouldRunPlannedAgent(executionPlan, agentName) {
  return (executionPlan?.requiredAgents || []).includes(agentName);
}

function shouldPlanArchitectureAgent({ analysis, riskScore, reviewDepth }) {
  return (
    reviewDepth === REVIEW_DEPTH.DEEP ||
    riskScore >= ROUTING_THRESHOLDS.highRiskScore ||
    analysis.authTouched ||
    analysis.dataTouched
  );
}

function buildInitialRulePolicy(analysis) {
  if (analysis.frontendOnly) {
    return {
      excludedRuleCategories: ['backend'],
      reason:
        'Planner detected frontend-only changes; backend rules can be skipped unless dependency analysis widens the scope.',
    };
  }

  if (analysis.backendTouched && !analysis.frontendOnly) {
    return {
      excludedRuleCategories: ['frontend'],
      reason:
        'Planner detected backend-oriented changes; frontend-specific rules can be skipped unless dependency analysis widens the scope.',
    };
  }

  return {
    excludedRuleCategories: [],
    reason: 'Planner detected mixed or broad changes; all rule categories remain eligible.',
  };
}

function buildParallelBranches({ options }) {
  if (options.includeSemanticContext && options.includeRuleValidation !== false) {
    return [[ORCHESTRATION_AGENTS.context, ORCHESTRATION_AGENTS.rule]];
  }

  return [];
}

function addRequiredAgent(plan, agentName) {
  if (!plan.requiredAgents.includes(agentName)) {
    insertBefore(plan.requiredAgents, ORCHESTRATION_AGENTS.riskIntelligence, agentName);
  }
}

function addReasonCode(plan, reasonCode) {
  if (!plan.reasonCodes.includes(reasonCode)) {
    plan.reasonCodes.push(reasonCode);
  }
}

function buildStrategyName(reviewDepth) {
  return `adaptive-${String(reviewDepth || REVIEW_DEPTH.STANDARD).toLowerCase()}`;
}

function insertBefore(values, beforeValue, value) {
  if (values.includes(value)) {
    return;
  }

  const index = values.indexOf(beforeValue);

  if (index === -1) {
    values.push(value);
    return;
  }

  values.splice(index, 0, value);
}

function orderAgents(agentNames) {
  const order = [
    ORCHESTRATION_AGENTS.dependency,
    ORCHESTRATION_AGENTS.context,
    ORCHESTRATION_AGENTS.rule,
    ORCHESTRATION_AGENTS.review,
    ORCHESTRATION_AGENTS.architecture,
    ORCHESTRATION_AGENTS.riskIntelligence,
    ORCHESTRATION_AGENTS.smartReview,
    ORCHESTRATION_AGENTS.summary,
  ];

  return [...agentNames].sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function unique(values) {
  return [...new Set(values)];
}
