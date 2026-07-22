import { App } from 'octokit';
import { config } from '../../config/env.js';

export class GitHubClient {
  constructor({ appId = config.github.appId, privateKey = config.github.privateKey } = {}) {
    this.app = appId && privateKey ? new App({ appId, privateKey }) : null;
  }

  isConfigured() {
    return Boolean(this.app);
  }

  async getInstallationClient(installationId) {
    if (!this.app) {
      throw createGitHubIntegrationError('GitHub App credentials are not configured.', {
        code: 'GITHUB_APP_NOT_CONFIGURED',
        retryable: false,
      });
    }

    if (!installationId) {
      throw createGitHubIntegrationError('GitHub installation ID is required.', {
        code: 'GITHUB_INSTALLATION_MISSING',
        retryable: false,
      });
    }

    try {
      return await this.app.getInstallationOctokit(installationId);
    } catch (error) {
      throw normalizeGitHubError(error, 'Failed to create installation client.');
    }
  }

  async createOrUpdateIssueComment({
    installationId,
    owner,
    repo,
    issueNumber,
    marker,
    body,
  }) {
    const octokit = await this.getInstallationClient(installationId);

    try {
      const existingComment = await this.findExistingComment({
        octokit,
        owner,
        repo,
        issueNumber,
        marker,
      });

      if (existingComment) {
        const { data } = await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body,
        });

        return {
          action: 'updated',
          id: data.id,
          htmlUrl: data.html_url,
        };
      }

      const { data } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });

      return {
        action: 'created',
        id: data.id,
        htmlUrl: data.html_url,
      };
    } catch (error) {
      throw normalizeGitHubError(error, 'Failed to publish PR comment.');
    }
  }

  async createCheckRun({
    installationId,
    owner,
    repo,
    headSha,
    name,
    conclusion,
    output,
  }) {
    if (!headSha) {
      throw createGitHubIntegrationError('Head SHA is required to create a check run.', {
        code: 'GITHUB_HEAD_SHA_MISSING',
        retryable: false,
      });
    }

    const octokit = await this.getInstallationClient(installationId);

    try {
      const existingCheckRun = await this.findExistingCheckRun({
        octokit,
        owner,
        repo,
        ref: headSha,
        name,
      });

      if (existingCheckRun) {
        const { data } = await octokit.rest.checks.update({
          owner,
          repo,
          check_run_id: existingCheckRun.id,
          name,
          status: 'completed',
          conclusion,
          completed_at: new Date().toISOString(),
          output,
        });

        return {
          action: 'updated',
          id: data.id,
          htmlUrl: data.html_url,
          status: data.status,
          conclusion: data.conclusion,
        };
      }

      const { data } = await octokit.rest.checks.create({
        owner,
        repo,
        name,
        head_sha: headSha,
        status: 'completed',
        conclusion,
        completed_at: new Date().toISOString(),
        output,
      });

      return {
        action: 'created',
        id: data.id,
        htmlUrl: data.html_url,
        status: data.status,
        conclusion: data.conclusion,
      };
    } catch (error) {
      throw normalizeGitHubError(error, 'Failed to create GitHub check run.');
    }
  }

  async findExistingComment({ octokit, owner, repo, issueNumber, marker }) {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    return comments.find(comment => comment.body?.includes(marker));
  }

  async findExistingCheckRun({ octokit, owner, repo, ref, name }) {
    const { data } = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref,
      check_name: name,
      filter: 'latest',
      per_page: 10,
    });

    return data.check_runs?.find(checkRun => checkRun.name === name) || null;
  }
}

export const githubClient = new GitHubClient();

export function normalizeGitHubError(error, fallbackMessage) {
  const status = error.status || error.response?.status || null;
  const code = classifyGitHubError(status, error);

  return createGitHubIntegrationError(error.message || fallbackMessage, {
    code,
    status,
    retryable: [403, 429, 500, 502, 503, 504].includes(status),
    cause: error,
  });
}

function classifyGitHubError(status, error) {
  if (status === 401) return 'GITHUB_AUTH_FAILED';
  if (status === 403 && isRateLimitError(error)) return 'GITHUB_RATE_LIMITED';
  if (status === 403) return 'GITHUB_PERMISSION_DENIED';
  if (status === 404) return 'GITHUB_RESOURCE_NOT_FOUND';
  if (status === 422) return 'GITHUB_VALIDATION_FAILED';
  if (status >= 500) return 'GITHUB_API_UNAVAILABLE';
  return 'GITHUB_API_ERROR';
}

function isRateLimitError(error) {
  const remaining = error.response?.headers?.['x-ratelimit-remaining'];
  return remaining === '0' || /rate limit/i.test(error.message || '');
}

function createGitHubIntegrationError(message, details = {}) {
  const error = new Error(message);
  error.name = 'GitHubIntegrationError';
  error.code = details.code || 'GITHUB_INTEGRATION_ERROR';
  error.status = details.status || null;
  error.retryable = Boolean(details.retryable);
  error.cause = details.cause;
  return error;
}
