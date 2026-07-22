import { aiReviewEngineService } from '../../ai-review/ai-review-engine.service.js';
import {
  buildAgentExecutionMetadata,
  serializeError,
} from '../utils/execution-metadata.util.js';
import {
  calculateAdaptiveRiskScore,
  riskLevelFromScore,
} from '../routing/routing-policies.js';

export async function reviewAgent(state) {
  const startedAt = new Date();

  if (!state.options.includeAiReview) {
    return {
      aiReview: null,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'review_agent',
        startedAt,
        status: 'skipped',
        details: {
          reason: 'includeAiReview=false',
          reviewMode: state.routeProfile?.reviewMode || 'standard',
        },
      }),
    };
  }

  try {
    const aiReview = await aiReviewEngineService.generatePullRequestReview({
      repository: state.repository,
      scanResult: state.scanResult,
      graph: state.graph,
      impact: state.impact,
      changedFiles: state.changedFiles,
      context: state.context,
      validation: state.validation,
      reviewDepth: state.reviewDepth,
      plannerDecision: state.plannerDecision,
      executionPlan: state.executionPlan,
      architectureAnalysis: state.architectureAnalysis,
    });
    const riskScore = calculateAdaptiveRiskScore({
      baseRiskScore: state.riskScore,
      impact: state.impact,
      routeProfile: state.routeProfile,
      validation: state.validation,
      aiReview,
    });

    return {
      aiReview,
      confidence: aiReview.confidence,
      riskScore,
      routingRiskScore: riskScore,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'review_agent',
        startedAt,
        details: {
          reviewDepth: state.reviewDepth,
          reviewMode: state.routeProfile?.reviewMode || 'standard',
          riskLevel: aiReview.riskLevel,
          adaptiveRiskLevel: riskLevelFromScore(riskScore),
          riskScore,
          confidence: aiReview.confidence,
          findingCount: aiReview.findings?.length || 0,
          contextRetrievalMode: state.contextRetrievalMode,
          contextExpansionRetries: state.retries?.contextExpansion || 0,
        },
      }),
    };
  } catch (error) {
    if (state.options.failOnAiReviewError) {
      throw error;
    }

    const aiReview = aiReviewEngineService.buildFailureReport({
      error,
      repository: state.repository,
    });

    return {
      aiReview,
      confidence: aiReview.confidence || state.confidence,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'review_agent',
        startedAt,
        status: 'failed-safe',
        details: {
          reviewDepth: state.reviewDepth,
          reviewMode: state.routeProfile?.reviewMode || 'standard',
          safeStop: true,
        },
        warnings: [
          `AI review failed and was converted into a safe report: ${error.message}`,
        ],
        errors: [serializeError(error)],
      }),
    };
  }
}
