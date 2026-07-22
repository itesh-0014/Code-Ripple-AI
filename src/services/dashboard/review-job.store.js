const MAX_JOBS = 50;
const jobs = new Map();

export function startReviewJob({ owner, repo, pullNumber, title, deliveryId }) {
  const id = buildJobId({ owner, repo, pullNumber });
  const now = new Date().toISOString();
  const job = {
    id,
    repository: `${owner}/${repo}`,
    pullNumber,
    title,
    deliveryId,
    status: 'running',
    stage: 'queued',
    progress: 5,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    reviewHistoryId: null,
    error: null,
  };

  jobs.set(id, job);
  trimJobs();
  return job;
}

export function updateReviewJob(id, patch) {
  const existing = jobs.get(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  jobs.set(id, updated);
  return updated;
}

export function completeReviewJob(id, patch = {}) {
  return updateReviewJob(id, {
    ...patch,
    status: 'completed',
    stage: 'complete',
    progress: 100,
    completedAt: new Date().toISOString(),
  });
}

export function failReviewJob(id, error) {
  return updateReviewJob(id, {
    status: 'failed',
    stage: 'failed',
    progress: 100,
    completedAt: new Date().toISOString(),
    error: {
      message: error.message,
      code: error.code || error.name || 'REVIEW_FAILED',
    },
  });
}

export function listReviewJobs() {
  return [...jobs.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

export function buildJobId({ owner, repo, pullNumber }) {
  return `${owner}/${repo}#${pullNumber}`;
}

function trimJobs() {
  const values = listReviewJobs();
  for (const job of values.slice(MAX_JOBS)) {
    jobs.delete(job.id);
  }
}
