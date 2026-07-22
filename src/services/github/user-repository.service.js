import { githubUserStore } from '../auth/github-user.store.js';

const GITHUB_API_URL = 'https://api.github.com';
const PAGE_SIZE = 100;

export class GitHubUserRepositoryService {
  constructor({ userStore = githubUserStore } = {}) {
    this.userStore = userStore;
  }

  async listRepositoriesForUser(user) {
    const accessToken = await this.userStore.getAccessTokenForUser(user);
    if (!accessToken) return [];

    const repositories = [];
    const installedRepositories = await this.listInstalledRepositoryNames(accessToken);

    for (let page = 1; page <= 10; page += 1) {
      const params = new URLSearchParams({
        affiliation: 'owner,collaborator,organization_member',
        visibility: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: String(PAGE_SIZE),
        page: String(page),
      });
      const response = await fetch(`${GITHUB_API_URL}/user/repos?${params}`, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${accessToken}`,
          'x-github-api-version': '2022-11-28',
        },
      });

      if (!response.ok) {
        throw createRepositoryFetchError(response.status);
      }

      const pageItems = await response.json();
      repositories.push(...pageItems);

      if (pageItems.length < PAGE_SIZE) break;
    }

    return repositories.map(repository => ({
      id: String(repository.id),
      name: repository.full_name,
      connected: true,
      appInstalled: installedRepositories.has(repository.full_name),
      private: Boolean(repository.private),
      reviewCount: 0,
      averageRisk: 0,
      criticalReviews: 0,
      lastReviewAt: repository.updated_at || repository.pushed_at || repository.created_at,
      htmlUrl: repository.html_url,
    }));
  }

  async listInstalledRepositoryNames(accessToken) {
    const installed = new Set();

    try {
      const installationsResponse = await fetch(`${GITHUB_API_URL}/user/installations`, {
        headers: buildHeaders(accessToken),
      });

      if (!installationsResponse.ok) return installed;

      const installations = await installationsResponse.json();

      for (const installation of installations.installations || []) {
        const params = new URLSearchParams({ per_page: String(PAGE_SIZE) });
        const response = await fetch(
          `${GITHUB_API_URL}/user/installations/${installation.id}/repositories?${params}`,
          { headers: buildHeaders(accessToken) }
        );
        if (!response.ok) continue;
        const data = await response.json();
        for (const repository of data.repositories || []) {
          installed.add(repository.full_name);
        }
      }
    } catch (_error) {
      return installed;
    }

    return installed;
  }
}

function createRepositoryFetchError(status) {
  const error = new Error('Unable to fetch GitHub repositories.');
  error.code = status === 401 ? 'GITHUB_AUTH_FAILED' : 'GITHUB_REPOSITORY_FETCH_FAILED';
  error.status = status;
  return error;
}

export const gitHubUserRepositoryService = new GitHubUserRepositoryService();

function buildHeaders(accessToken) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${accessToken}`,
    'x-github-api-version': '2022-11-28',
  };
}
