import { dependencyGraphService } from '../services/repository/dependency-graph.service.js';
import { localRepositoryScanner } from '../services/repository/local-repository-scanner.service.js';
import { repositoryIndexingService } from '../services/rag/repository-indexing.service.js';
import { isSourceFile } from '../utils/repository-path.util.js';

async function main() {
  const [repositoryPath] = process.argv.slice(2);

  if (!repositoryPath) {
    console.log('Usage: npm run phase3:index -- <repository-path>');
    process.exit(1);
  }

  console.log('\nScanning repository for semantic context files...');

  const scanResult = await localRepositoryScanner.scan(repositoryPath, {
    scanMode: 'semantic',
  });
  const sourceFiles = scanResult.files.filter(file => isSourceFile(file.path));
  const graph = dependencyGraphService.buildGraph(sourceFiles);

  console.log(`Source files for graph: ${sourceFiles.length}`);
  console.log(`Semantic files for RAG: ${scanResult.files.length}`);
  console.log('Generating embeddings and storing chunks in ChromaDB...');

  const result = await repositoryIndexingService.indexRepository({
    repository: {
      source: 'local',
      path: scanResult.rootPath,
    },
    scanResult,
    graph,
    reset: true,
  });

  console.log('\nPhase 3 index complete.');
  console.log(`Repository key: ${result.repoKey}`);
  console.log(`Collection: ${result.collectionName}`);
  console.log(`Embedding provider: ${result.embeddingProfile.provider}`);
  console.log(`Embedding model: ${result.embeddingProfile.model}`);
  console.log(`Indexed files: ${result.filesIndexed || 0}`);
  console.log(`Indexed chunks: ${result.chunksIndexed}`);
}

main().catch(error => {
  console.error('\nPhase 3 local indexing failed');
  console.error(error);
  process.exit(1);
});
