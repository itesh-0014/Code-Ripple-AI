import path from 'path';
import { dependencyGraphService } from '../services/repository/dependency-graph.service.js';
import { localRepositoryScanner } from '../services/repository/local-repository-scanner.service.js';
import { repositoryIndexingService } from '../services/rag/repository-indexing.service.js';
import { semanticRetrievalService } from '../services/rag/semantic-retrieval.service.js';
import { buildRepositoryKey } from '../services/rag/repository-key.util.js';
import { isSourceFile } from '../utils/repository-path.util.js';

export const indexLocalRepository = async (req, res) => {
  try {
    const { repositoryPath } = req.body;

    if (!repositoryPath) {
      return res.status(400).json({
        success: false,
        message: 'repositoryPath is required',
      });
    }

    const result = await buildLocalRepositoryIndex(repositoryPath);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchLocalRepository = async (req, res) => {
  try {
    const { repositoryPath, query, limit = 8, refreshIndex = true } = req.body;

    if (!repositoryPath || !query) {
      return res.status(400).json({
        success: false,
        message: 'repositoryPath and query are required',
      });
    }

    const repository = {
      source: 'local',
      path: path.resolve(repositoryPath),
    };

    let indexing = null;

    if (refreshIndex) {
      indexing = await buildLocalRepositoryIndex(repositoryPath);
      repository.path = indexing.repositoryPath;
    }

    const results = await semanticRetrievalService.searchRepository({
      repoKey: buildRepositoryKey(repository),
      query,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        indexing,
        query,
        results,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

async function buildLocalRepositoryIndex(repositoryPath) {
  const scanResult = await localRepositoryScanner.scan(repositoryPath, {
    scanMode: 'semantic',
  });
  const repository = {
    source: 'local',
    path: scanResult.rootPath,
  };
  const graph = dependencyGraphService.buildGraph(
    scanResult.files.filter(file => isSourceFile(file.path))
  );
  const indexing = await repositoryIndexingService.indexRepository({
    repository,
    scanResult,
    graph,
    reset: true,
  });

  return {
    ...indexing,
    repositoryPath: scanResult.rootPath,
    sourceFiles: scanResult.summary.totalSourceFiles,
    semanticFiles: scanResult.files.length,
  };
}
