import { createStableHash } from '../../utils/hash.util.js';

export function buildRepositoryKey(repository) {
  if (repository?.source === 'github') {
    const owner = repository.owner || 'unknown-owner';
    const repo = repository.repo || 'unknown-repo';
    const ref = repository.ref || 'unknown-ref';
    return `github:${owner}/${repo}:${createStableHash(ref, 12)}`;
  }

  if (repository?.source === 'local') {
    return `local:${createStableHash(repository.path || 'unknown-local-repo', 16)}`;
  }

  return `repo:${createStableHash(JSON.stringify(repository || {}), 16)}`;
}

export function sanitizeCollectionName(value) {
  const sanitizedValue = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);

  return sanitizedValue.length >= 3 ? sanitizedValue : 'gitsense_repo_context';
}
