import fs from 'fs/promises';
import path from 'path';
import { repositoryAnalysisConfig } from '../../config/repository.config.js';
import {
  isSemanticContextFile,
  isSourceFile,
  normalizeRepoPath,
  shouldIgnoreRepoPath,
} from '../../utils/repository-path.util.js';

class LocalRepositoryScanner {
  async scan(repositoryPath, options = {}) {
    const scanMode = options.scanMode || 'source';
    const rootPath = path.resolve(repositoryPath);
    const files = [];

    await this.walkDirectory(rootPath, rootPath, files, scanMode);

    return {
      source: 'local',
      scanMode,
      rootPath,
      files,
      summary: {
        totalSourceFiles: files.filter(file => isSourceFile(file.path)).length,
        totalSemanticContextFiles: files.filter(file =>
          isSemanticContextFile(file.path)
        ).length,
        maxFileSizeBytes:
          scanMode === 'semantic'
            ? repositoryAnalysisConfig.maxSemanticFileSizeBytes
            : repositoryAnalysisConfig.maxFileSizeBytes,
      },
    };
  }

  async walkDirectory(rootPath, currentPath, files, scanMode) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizeRepoPath(path.relative(rootPath, absolutePath));

      if (shouldIgnoreRepoPath(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(rootPath, absolutePath, files, scanMode);
        continue;
      }

      if (!entry.isFile() || !this.matchesScanMode(relativePath, scanMode)) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      const maxFileSizeBytes =
        scanMode === 'semantic'
          ? repositoryAnalysisConfig.maxSemanticFileSizeBytes
          : repositoryAnalysisConfig.maxFileSizeBytes;

      if (stats.size > maxFileSizeBytes) {
        continue;
      }

      const content = await fs.readFile(absolutePath, 'utf8');

      files.push({
        path: relativePath,
        size: stats.size,
        content,
      });
    }
  }

  matchesScanMode(filePath, scanMode) {
    if (scanMode === 'semantic') {
      return isSemanticContextFile(filePath);
    }

    return isSourceFile(filePath);
  }
}

export const localRepositoryScanner = new LocalRepositoryScanner();
