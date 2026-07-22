import { App } from 'octokit';
import { config } from '../config/env.js';

class GitHubService {
  constructor() {
    this.app = null;

    try {
      if (config.github.appId && config.github.privateKey) {
        this.app = new App({
          appId: config.github.appId,
          privateKey: config.github.privateKey,
        });

        console.log('✅ GitHub App initialized successfully');
      } else {
        console.warn(
          '⚠️ GitHub App credentials missing. Service not initialized.'
        );
      }
    } catch (error) {
      console.error('❌ Failed to initialize GitHub App');
      console.error(error);
    }
  }

  async getOctokit(installationId) {
    try {
      if (!this.app) {
        throw new Error('GitHub App is not initialized properly');
      }

      console.log(`🔑 Creating installation client for ID: ${installationId}`);

      return await this.app.getInstallationOctokit(installationId);
    } catch (error) {
      console.error('❌ Failed to create installation Octokit');
      throw error;
    }
  }

  async getPRFiles(installationId, owner, repo, pullNumber) {
    try {
      console.log(
        `📥 Fetching PR files for ${owner}/${repo}#${pullNumber}`
      );

      const octokit = await this.getOctokit(installationId);

      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });

      console.log(`✅ Successfully fetched ${files.length} files`);

      return files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch || null,
      }));
    } catch (error) {
      console.error(
        `❌ Error fetching PR files for ${owner}/${repo}#${pullNumber}`
      );

      console.error(error.message);

      throw error;
    }
  }
}

export const githubService = new GitHubService();