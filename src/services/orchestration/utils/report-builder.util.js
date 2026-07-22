export function buildPhase6Report(finalState) {
  const completedAt = new Date().toISOString();
  const startedAt = finalState.executionMetadata?.startedAt;

  return {
    phase: 'phase-6-langgraph-orchestration',
    status: buildStatus(finalState),
    generatedAt: completedAt,
    repository: finalState.repository,
    changedFiles: finalState.changedFiles,
    scan: finalState.scanResult?.summary || {},
    graph: finalState.dependencyGraph || {},
    impact: finalState.impact || {
      changedFiles: [],
      affectedModules: [],
      propagationChains: [],
      riskSignals: [],
      summary: {},
    },
    context: finalState.context,
    validation: finalState.validation,
    aiReview: finalState.aiReview,
    reviewSummary: finalState.reviewSummary,
    severity: finalState.severity,
    confidence: finalState.confidence,
    riskScore: finalState.riskScore,
    routingRiskScore: finalState.routingRiskScore,
    riskLevel: finalState.riskLevel,
    riskExplanation: finalState.riskExplanation,
    contributingFactors: finalState.contributingFactors,
    riskFactors: finalState.riskFactors,
    confidenceFactors: finalState.confidenceFactors,
    reviewMode: finalState.reviewMode,
    prioritizedFiles: finalState.prioritizedFiles,
    hotspots: finalState.hotspots,
    reviewBudget: finalState.reviewBudget,
    criticalFiles: finalState.criticalFiles,
    smartReview: finalState.smartReview,
    reviewComment: finalState.reviewComment,
    summaryComment: finalState.summaryComment,
    checkRunStatus: finalState.checkRunStatus,
    checkRun: finalState.checkRun,
    reviewHistoryId: finalState.reviewHistoryId,
    githubPublicationStatus: finalState.githubPublicationStatus,
    githubPublication: finalState.githubPublication,
    githubPublicationError: finalState.githubPublicationError,
    notificationStatus: finalState.notificationStatus,
    notifiedChannels: finalState.notifiedChannels,
    notificationPayloads: finalState.notificationPayloads,
    notificationDecision: finalState.notificationDecision,
    affectedSystems: finalState.reviewSummary?.affectedSystems || [],
    architectureImpact:
      finalState.reviewSummary?.architectureImpact || 'NOT_ANALYZED',
    suggestedChanges: finalState.reviewSummary?.suggestedChanges || [],
    finalIntelligence: {
      riskScore: finalState.riskScore,
      riskLevel: finalState.riskLevel,
      confidence: finalState.confidence,
      severity: finalState.severity,
      riskExplanation: finalState.riskExplanation,
      contributingFactors: finalState.contributingFactors,
      riskFactors: finalState.riskFactors,
      confidenceFactors: finalState.confidenceFactors,
      reviewMode: finalState.reviewMode,
      criticalFiles: finalState.criticalFiles,
      hotspots: finalState.hotspots,
      reviewBudget: finalState.reviewBudget,
      reviewComment: finalState.reviewComment,
      summaryComment: finalState.summaryComment,
      checkRunStatus: finalState.checkRunStatus,
      reviewHistoryId: finalState.reviewHistoryId,
      githubPublicationStatus: finalState.githubPublicationStatus,
      notificationStatus: finalState.notificationStatus,
      notifiedChannels: finalState.notifiedChannels,
      affectedSystems: finalState.reviewSummary?.affectedSystems || [],
      architectureImpact:
        finalState.reviewSummary?.architectureImpact || 'NOT_ANALYZED',
      suggestedChanges: finalState.reviewSummary?.suggestedChanges || [],
    },
    reviewDepth: finalState.reviewDepth,
    plannerDecision: finalState.plannerDecision,
    executionPlan: finalState.executionPlan,
    architectureAnalysis: finalState.architectureAnalysis,
    retries: finalState.retries,
    executionMetadata: {
      ...(finalState.executionMetadata || {}),
      completedAt,
      totalDurationMs: startedAt
        ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
        : null,
      routeProfile: finalState.routeProfile,
      plannerDecision: finalState.plannerDecision,
      executionPlan: finalState.executionPlan,
      retries: finalState.retries,
    },
  };
}

function buildStatus(finalState) {
  if (finalState.aiReview?.status === 'failed') {
    return 'completed-with-ai-review-failure';
  }

  if (finalState.executionMetadata?.errors?.length) {
    return 'completed-with-errors';
  }

  return 'completed';
}
