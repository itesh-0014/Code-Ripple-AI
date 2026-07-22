import { buildSmartReviewIntelligence } from '../../smart-review/smartReviewEngine.js';
import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';

export async function smartReviewAgent(state) {
  const startedAt = new Date();
  const smartReview = buildSmartReviewIntelligence(state);

  return {
    reviewMode: smartReview.reviewMode,
    prioritizedFiles: smartReview.prioritizedFiles,
    hotspots: smartReview.hotspots,
    reviewBudget: smartReview.reviewBudget,
    criticalFiles: smartReview.criticalFiles,
    smartReview,
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'smart_review_agent',
      startedAt,
      details: {
        reviewMode: smartReview.reviewMode,
        prSize: smartReview.prSize,
        changedFileCount: smartReview.changedFileCount,
        criticalFileCount: smartReview.criticalFiles.length,
        hotspotCount: smartReview.hotspots.length,
        deepReviewFileCount: smartReview.reviewBudget.counts.deep,
        standardReviewFileCount: smartReview.reviewBudget.counts.standard,
        lightReviewFileCount: smartReview.reviewBudget.counts.light,
      },
    }),
  };
}

