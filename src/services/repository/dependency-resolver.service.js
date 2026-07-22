import path from 'path';
import { repositoryAnalysisConfig } from '../../config/repository.config.js';
import { normalizeRepoPath } from '../../utils/repository-path.util.js';

class DependencyResolverService {
  resolveImport({ importerPath, importSource, filePathSet }) {
    if (!isLocalImport(importSource)) {
      return {
        type: 'external',
        source: importSource,
        packageName: getPackageName(importSource),
        resolvedPath: null,
      };
    }

    const importerDirectory = path.posix.dirname(normalizeRepoPath(importerPath));
    const importBasePath = importSource.startsWith('/')
      ? normalizeRepoPath(path.posix.normalize(importSource))
      : normalizeRepoPath(
          path.posix.normalize(path.posix.join(importerDirectory, importSource))
        );

    const resolvedPath = this.findMatchingSourceFile(importBasePath, filePathSet);

    if (!resolvedPath) {
      return {
        type: 'unresolved',
        source: importSource,
        resolvedPath: null,
      };
    }

    return {
      type: 'local',
      source: importSource,
      resolvedPath,
    };
  }

  findMatchingSourceFile(importBasePath, filePathSet) {
    if (filePathSet.has(importBasePath)) {
      return importBasePath;
    }

    for (const extension of repositoryAnalysisConfig.sourceFileExtensions) {
      const withExtension = `${importBasePath}${extension}`;

      if (filePathSet.has(withExtension)) {
        return withExtension;
      }
    }

    for (const extension of repositoryAnalysisConfig.sourceFileExtensions) {
      const indexFile = `${importBasePath}/index${extension}`;

      if (filePathSet.has(indexFile)) {
        return indexFile;
      }
    }

    return null;
  }
}

function isLocalImport(importSource) {
  return importSource.startsWith('.') || importSource.startsWith('/');
}

function getPackageName(importSource) {
  if (importSource.startsWith('@')) {
    return importSource.split('/').slice(0, 2).join('/');
  }

  return importSource.split('/')[0];
}

export const dependencyResolverService = new DependencyResolverService();
