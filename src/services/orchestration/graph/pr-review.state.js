import { Annotation } from '@langchain/langgraph';
import { ragConfig } from '../../../config/rag.config.js';

function replaceValue(_currentValue, nextValue) {
  return nextValue;
}

function replaceWithDefault(defaultValueFactory) {
  return Annotation({
    reducer: replaceValue,
    default: defaultValueFactory,
  });
}

function mergeExecutionMetadata(currentValue = {}, nextValue = {}) {
  return {
    ...currentValue,
    ...nextValue,
    agents: {
      ...(currentValue.agents || {}),
      ...(nextValue.agents || {}),
    },
    timingsMs: {
      ...(currentValue.timingsMs || {}),
      ...(nextValue.timingsMs || {}),
    },
    routing: {
      ...(currentValue.routing || {}),
      ...(nextValue.routing || {}),
    },
    warnings: [
      ...(currentValue.warnings || []),
      ...(nextValue.warnings || []),
    ],
    errors: [
      ...(currentValue.errors || []),
      ...(nextValue.errors || []),
    ],
    agentRuns: [
      ...(currentValue.agentRuns || []),
      ...(nextValue.agentRuns || []),
    ],
  };
}

export const DEFAULT_PR_REVIEW_OPTIONS = {
  includeSemanticContext: ragConfig.enabled,
  failOnContextError: false,
  includeRuleValidation: true,
  includeAiReview: true,
  failOnAiReviewError: true,
  ensureContextIndexed: true,
  publishGithubReview: true,
  publishNotifications: true,
  debug: false,
};

export const PRReviewGraphState = Annotation.Root({
  repository: replaceWithDefault(() => null),
  options: replaceWithDefault(() => ({ ...DEFAULT_PR_REVIEW_OPTIONS })),

  changedFiles: replaceWithDefault(() => []),
  affectedModules: replaceWithDefault(() => []),
  dependencyGraph: replaceWithDefault(() => ({})),
  retrievedContext: replaceWithDefault(() => []),
  ruleFindings: replaceWithDefault(() => []),
  aiReview: replaceWithDefault(() => null),
  reviewSummary: replaceWithDefault(() => null),
  severity: replaceWithDefault(() => null),
  confidence: replaceWithDefault(() => null),
  riskScore: replaceWithDefault(() => 0),
  routingRiskScore: replaceWithDefault(() => 0),
  riskLevel: replaceWithDefault(() => null),
  riskExplanation: replaceWithDefault(() => null),
  contributingFactors: replaceWithDefault(() => []),
  riskFactors: replaceWithDefault(() => []),
  confidenceFactors: replaceWithDefault(() => []),
  reviewMode: replaceWithDefault(() => null),
  prioritizedFiles: replaceWithDefault(() => []),
  hotspots: replaceWithDefault(() => []),
  reviewBudget: replaceWithDefault(() => null),
  criticalFiles: replaceWithDefault(() => []),
  smartReview: replaceWithDefault(() => null),
  reviewComment: replaceWithDefault(() => null),
  summaryComment: replaceWithDefault(() => null),
  checkRunStatus: replaceWithDefault(() => null),
  checkRun: replaceWithDefault(() => null),
  reviewHistoryId: replaceWithDefault(() => null),
  githubPublicationStatus: replaceWithDefault(() => null),
  githubPublication: replaceWithDefault(() => null),
  githubPublicationError: replaceWithDefault(() => null),
  notificationStatus: replaceWithDefault(() => null),
  notifiedChannels: replaceWithDefault(() => []),
  notificationPayloads: replaceWithDefault(() => []),
  notificationDecision: replaceWithDefault(() => null),
  reviewDepth: replaceWithDefault(() => null),
  plannerDecision: replaceWithDefault(() => null),
  executionPlan: replaceWithDefault(() => null),
  architectureAnalysis: replaceWithDefault(() => null),
  retries: replaceWithDefault(() => ({
    contextExpansion: 0,
  })),
  contextRetrievalMode: replaceWithDefault(() => null),

  executionMetadata: Annotation({
    reducer: mergeExecutionMetadata,
    default: () => ({
      phase: 'phase-6-langgraph-orchestration',
      startedAt: null,
      completedAt: null,
      agents: {},
      timingsMs: {},
      routing: {},
      warnings: [],
      errors: [],
      agentRuns: [],
    }),
  }),

  scanResult: replaceWithDefault(() => null),
  graph: replaceWithDefault(() => null),
  impact: replaceWithDefault(() => null),
  context: replaceWithDefault(() => null),
  validation: replaceWithDefault(() => null),
  routeProfile: replaceWithDefault(() => null),
  rulePolicy: replaceWithDefault(() => null),
});

export function buildInitialPRReviewState({
  repository,
  changedFiles,
  options = {},
}) {
  const startedAt = new Date().toISOString();

  return {
    repository,
    changedFiles: normalizeChangedFiles(changedFiles),
    affectedModules: [],
    dependencyGraph: {},
    retrievedContext: [],
    ruleFindings: [],
    aiReview: null,
    reviewSummary: null,
    severity: null,
    confidence: null,
    riskScore: 0,
    routingRiskScore: 0,
    riskLevel: null,
    riskExplanation: null,
    contributingFactors: [],
    riskFactors: [],
    confidenceFactors: [],
    reviewMode: null,
    prioritizedFiles: [],
    hotspots: [],
    reviewBudget: null,
    criticalFiles: [],
    smartReview: null,
    reviewComment: null,
    summaryComment: null,
    checkRunStatus: null,
    checkRun: null,
    reviewHistoryId: null,
    githubPublicationStatus: null,
    githubPublication: null,
    githubPublicationError: null,
    notificationStatus: null,
    notifiedChannels: [],
    notificationPayloads: [],
    notificationDecision: null,
    reviewDepth: null,
    plannerDecision: null,
    executionPlan: null,
    architectureAnalysis: null,
    retries: {
      contextExpansion: 0,
    },
    contextRetrievalMode: null,
    options: {
      ...DEFAULT_PR_REVIEW_OPTIONS,
      ...options,
    },
    executionMetadata: {
      startedAt,
      phase: 'phase-6-langgraph-orchestration',
      warnings: [],
      errors: [],
      agentRuns: [],
      agents: {},
      timingsMs: {},
      routing: {},
    },
  };
}

function normalizeChangedFiles(changedFiles = []) {
  return changedFiles.map(file => ({
    filename: file.filename,
    status: file.status || 'modified',
    additions: file.additions || 0,
    deletions: file.deletions || 0,
    changes: file.changes || 0,
    patch: file.patch || null,
  }));
}
