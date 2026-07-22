export function buildAgentExecutionMetadata({
  agentName,
  startedAt,
  status = 'completed',
  details = {},
  warnings = [],
  errors = [],
}) {
  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  return {
    agents: {
      [agentName]: {
        status,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        ...details,
      },
    },
    agentRuns: [
      {
        agentName,
        status,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        ...details,
      },
    ],
    timingsMs: {
      [agentName]: durationMs,
    },
    warnings,
    errors,
  };
}

export function serializeError(error) {
  return {
    name: error.name || 'Error',
    code: error.code || null,
    message: error.message || 'Unknown error',
    retryable: Boolean(error.retryable),
  };
}
