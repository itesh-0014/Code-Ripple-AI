import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';
import {
  analyzeChangedFilesForPlanning,
  calculatePlannerRiskScore,
  chooseReviewDepth,
  riskLevelFromScore,
} from '../routing/routing-policies.js';
import { buildExecutionPlan } from '../routing/execution-strategies.js';

export async function plannerAgent(state) {
  const startedAt = new Date();
  const analysis = analyzeChangedFilesForPlanning(state.changedFiles);
  const riskScore = calculatePlannerRiskScore(analysis);
  const riskLevel = riskLevelFromScore(riskScore);
  const reviewDepth = chooseReviewDepth({ analysis, riskScore });
  const executionPlan = buildExecutionPlan({
    analysis,
    riskScore,
    riskLevel,
    reviewDepth,
    options: state.options,
  });
  const plannerDecision = {
    phase: 'phase-6-planner',
    generatedAt: new Date().toISOString(),
    riskLevel,
    riskScore,
    reviewDepth,
    requiredAgents: executionPlan.requiredAgents,
    skippedAgents: executionPlan.skippedAgents,
    executionStrategy: executionPlan.strategy,
    rulePolicy: executionPlan.rulePolicy,
    architecturalImpact: buildEstimatedArchitecturalImpact(analysis),
    reasons: buildPlannerReasons({ analysis, riskScore, reviewDepth }),
    fileAnalysis: {
      totalFiles: analysis.totalFiles,
      sourceFileCount: analysis.sourceFileCount,
      totalChanges: analysis.totalChanges,
      changedLayers: analysis.changedLayers,
      changedExtensions: analysis.changedExtensions,
      frontendOnly: analysis.frontendOnly,
      authTouched: analysis.authTouched,
      dataTouched: analysis.dataTouched,
      backendTouched: analysis.backendTouched,
    },
  };

  return {
    plannerDecision,
    executionPlan,
    riskScore,
    routingRiskScore: riskScore,
    reviewDepth,
    rulePolicy: executionPlan.rulePolicy,
    executionMetadata: {
      ...buildAgentExecutionMetadata({
        agentName: 'planner_agent',
        startedAt,
        details: {
          riskLevel,
          riskScore,
          reviewDepth,
          requiredAgents: executionPlan.requiredAgents,
          skippedAgents: executionPlan.skippedAgents.map(item => item.agent),
        },
      }),
      routing: {
        planner: {
          riskLevel,
          riskScore,
          reviewDepth,
          requiredAgents: executionPlan.requiredAgents,
          strategy: executionPlan.strategy,
          reasonCodes: executionPlan.reasonCodes,
        },
      },
    },
  };
}

function buildEstimatedArchitecturalImpact(analysis) {
  return {
    changedLayers: analysis.changedLayers,
    crossLayerChangeLikely: analysis.changedLayers.length >= 3,
    criticalPathIndicators: analysis.files
      .filter(file => file.isAuthSensitive || file.isDataLayer || file.isBackend)
      .map(file => file.filename),
    prSize: {
      files: analysis.totalFiles,
      additions: analysis.totalAdditions,
      deletions: analysis.totalDeletions,
      changes: analysis.totalChanges,
    },
  };
}

function buildPlannerReasons({ analysis, riskScore, reviewDepth }) {
  const reasons = [];

  if (analysis.frontendOnly) {
    reasons.push('Changed files appear frontend-focused.');
  }

  if (analysis.authTouched) {
    reasons.push('Authentication, authorization, token, or middleware paths changed.');
  }

  if (analysis.dataTouched) {
    reasons.push('Database, schema, model, or repository paths changed.');
  }

  if (analysis.changedLayers.length >= 3) {
    reasons.push('Changed files span three or more architectural layers.');
  }

  if (analysis.totalChanges >= 500) {
    reasons.push('PR size is large enough to require broader review context.');
  }

  reasons.push(`Planner selected ${reviewDepth} review depth at risk score ${riskScore}.`);

  return reasons;
}
