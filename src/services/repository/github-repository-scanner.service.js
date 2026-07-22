import { repositoryAnalysisConfig } from '../../config/repository.config.js';
import { githubService } from '../github.service.js';
import { mapWithConcurrency } from '../../utils/async.util.js';
import {
  isSemanticContextFile,
  isSourceFile,
  normalizeRepoPath,
  shouldIgnoreRepoPath,
} from '../../utils/repository-path.util.js';

class GithubRepositoryScanner {
  async scan({ installationId, owner, repo, ref, scanMode = 'source' }) {
    const octokit = await githubService.getOctokit(installationId);

    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: ref,
      recursive: '1',
    });

    const matchingSourceFileEntries = data.tree
      .filter(item => item.type === 'blob')
      .map(item => ({
        path: normalizeRepoPath(item.path),
        sha: item.sha,
        size: item.size || 0,
      }))
      .filter(item => this.matchesScanMode(item.path, scanMode))
      .filter(item => !shouldIgnoreRepoPath(item.path))
      .filter(item => item.size <= this.getMaxFileSize(scanMode));

    const sourceFileEntries = matchingSourceFileEntries.slice(
      0,
      this.getMaxGithubFiles(scanMode)
    );

    const files = await mapWithConcurrency(
      sourceFileEntries,
      repositoryAnalysisConfig.githubBlobConcurrency,
      async fileEntry => {
        const { data: blob } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: fileEntry.sha,
        });

        const content = Buffer.from(blob.content, blob.encoding).toString('utf8');

        return {
          path: fileEntry.path,
          size: fileEntry.size,
          sha: fileEntry.sha,
          content,
        };
      }
    );

    return {
      source: 'github',
      scanMode,
      owner,
      repo,
      ref,
      files,
      summary: {
        totalRepositoryFiles: data.tree.length,
        totalSourceFiles: files.filter(file => isSourceFile(file.path)).length,
        totalSemanticContextFiles: files.filter(file =>
          isSemanticContextFile(file.path)
        ).length,
        truncated:
          matchingSourceFileEntries.length >
          this.getMaxGithubFiles(scanMode),
        maxGithubSourceFiles: repositoryAnalysisConfig.maxGithubSourceFiles,
        maxGithubSemanticFiles: repositoryAnalysisConfig.maxGithubSemanticFiles,
      },
    };
  }

  matchesScanMode(filePath, scanMode) {
    if (scanMode === 'semantic') {
      return isSemanticContextFile(filePath);
    }

    return isSourceFile(filePath);
  }

  getMaxFileSize(scanMode) {
    return scanMode === 'semantic'
      ? repositoryAnalysisConfig.maxSemanticFileSizeBytes
      : repositoryAnalysisConfig.maxFileSizeBytes;
  }

  getMaxGithubFiles(scanMode) {
    return scanMode === 'semantic'
      ? repositoryAnalysisConfig.maxGithubSemanticFiles
      : repositoryAnalysisConfig.maxGithubSourceFiles;
  }
}

export const githubRepositoryScanner = new GithubRepositoryScanner();
