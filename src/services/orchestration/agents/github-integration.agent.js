import { reviewPublisher } from '../../github/reviewPublisher.js';
import { buildAgentExecutionMetadata, serializeError } from '../utils/execution-metadata.util.js';

export async function githubIntegrationAgent(state) {
  const startedAt = new Date();

  if (state.options?.publishGithubReview === false) {
    return buildSkippedResponse({
      startedAt,
      reason: 'GitHub publishing disabled by options.publishGithubReview.',
    });
  }

  try {
    const publication = await reviewPublisher.publish(state);

    if (publication.status === 'skipped') {
      return buildSkippedResponse({
        startedAt,
        reason: publication.reason,
      });
    }

    return {
      reviewComment: publication.reviewComment,
      summaryComment: publication.summaryComment,
      checkRunStatus: publication.checkRunStatus,
      checkRun: publication.checkRun,
      reviewHistoryId: publication.reviewHistoryId,
      githubPublicationStatus: 'published',
      githubPublication: publication,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'github_integration_agent',
        startedAt,
        details: {
          publicationStatus: 'published',
          checkRunStatus: publication.checkRunStatus,
          reviewCommentAction: publication.reviewComment?.action,
          summaryCommentAction: publication.summaryComment?.action,
          reviewHistoryId: publication.reviewHistoryId,
          reviewHistorySkipped: publication.reviewHistorySkipped,
        },
      }),
    };
  } catch (error) {
    const serializedError = serializeError(error);

    return {
      githubPublicationStatus: 'failed',
      githubPublicationError: serializedError,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'github_integration_agent',
        startedAt,
        status: 'failed',
        details: {
          publicationStatus: 'failed',
          errorCode: serializedError.code,
          retryable: serializedError.retryable,
        },
        errors: [serializedError],
      }),
    };
  }
}

function buildSkippedResponse({ startedAt, reason }) {
  return {
    githubPublicationStatus: 'skipped',
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'github_integration_agent',
      startedAt,
      status: 'skipped',
      details: {
        publicationStatus: 'skipped',
        reason,
      },
      warnings: [reason],
    }),
  };
}
