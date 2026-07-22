import { contextRetrievalService } from '../../rag/context-retrieval.service.js';
import {
  buildAgentExecutionMetadata,
  serializeError,
} from '../utils/execution-metadata.util.js';
import {
  CONTEXT_RETRIEVAL_MODE,
  getContextRetrievalLimit,
  shouldRequestContextExpansion,
} from '../routing/routing-policies.js';

export async function contextAgent(state) {
  const startedAt = new Date();
  const isExpansion = shouldRequestContextExpansion(state);
  const retrievalMode = isExpansion
    ? CONTEXT_RETRIEVAL_MODE.EXPANDED
    : CONTEXT_RETRIEVAL_MODE.NORMAL;
  const maxPerChangedFile = getContextRetrievalLimit(retrievalMode);
  const contextExpansionRetries = state.retries?.contextExpansion || 0;
  const retries = {
    ...(state.retries || {}),
    contextExpansion: isExpansion
      ? contextExpansionRetries + 1
      : contextExpansionRetries,
  };

  try {
    const context = await contextRetrievalService.retrieveForPullRequest({
      repository: state.repository,
      scanResult: state.scanResult,
      graph: state.graph,
      impact: state.impact,
      changedFiles: state.changedFiles,
      ensureIndexed:
        state.options.ensureContextIndexed &&
        (!isExpansion || !state.context?.repositoryKey),
      resetIndex: !isExpansion,
      retrievalMode,
      maxPerChangedFile,
    });

    return {
      context,
      retrievedContext: flattenRetrievedContext(context),
      contextRetrievalMode: retrievalMode,
      retries,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'context_agent',
        startedAt,
        details: {
          status: 'retrieved',
          retrievalMode,
          maxPerChangedFile,
          contextExpansionRetries: retries.contextExpansion,
          retrievedChunks: context.summary?.retrievedChunks || 0,
          uniqueRetrievedFiles: context.summary?.uniqueRetrievedFiles || 0,
        },
      }),
    };
  } catch (error) {
    if (state.options.failOnContextError) {
      throw error;
    }

    const context = {
      phase: 'phase-3-context-retrieval',
      error: error.message,
      summary: {},
    };

    return {
      context,
      retrievedContext: [],
      contextRetrievalMode: retrievalMode,
      retries,
      executionMetadata: buildAgentExecutionMetadata({
        agentName: 'context_agent',
        startedAt,
        status: 'failed-safe',
        details: {
          status: 'failed-safe',
          retrievalMode,
          contextExpansionRetries: retries.contextExpansion,
        },
        warnings: [
          `Context retrieval failed and was converted into a safe report: ${error.message}`,
        ],
        errors: [serializeError(error)],
      }),
    };
  }
}

function flattenRetrievedContext(context) {
  return (context.changedFiles || []).flatMap(changedFile =>
    (changedFile.retrievedContext || []).map(item => ({
      changedFile: changedFile.filename,
      ...item,
    }))
  );
}
