import { dependencyGraphService } from '../services/repository/dependency-graph.service.js';
import { localRepositoryScanner } from '../services/repository/local-repository-scanner.service.js';
import { repositoryIndexingService } from '../services/rag/repository-indexing.service.js';
import { semanticRetrievalService } from '../services/rag/semantic-retrieval.service.js';
import { buildRepositoryKey } from '../services/rag/repository-key.util.js';
import { isSourceFile } from '../utils/repository-path.util.js';

async function main() {
  const [repositoryPath, ...queryParts] = process.argv.slice(2);
  const query = queryParts.join(' ');

  if (!repositoryPath || !query) {
    console.log('Usage: npm run phase3:search -- <repository-path> "<semantic-query>"');
    process.exit(1);
  }

  const repository = {
    source: 'local',
    path: null,
  };

  console.log('\nScanning and refreshing local RAG index...');

  const scanResult = await localRepositoryScanner.scan(repositoryPath, {
    scanMode: 'semantic',
  });

  repository.path = scanResult.rootPath;

  const graph = dependencyGraphService.buildGraph(
    scanResult.files.filter(file => isSourceFile(file.path))
  );

  await repositoryIndexingService.indexRepository({
    repository,
    scanResult,
    graph,
    reset: true,
  });

  const results = await semanticRetrievalService.searchRepository({
    repoKey: buildRepositoryKey(repository),
    query,
    limit: 10,
  });

  console.log(`\nSemantic Query: ${query}`);
  console.log('Top Results:');

  if (results.length === 0) {
    console.log('- No results found.');
    return;
  }

  results.forEach(result => {
    const symbols = result.symbols.length
      ? ` symbols: ${result.symbols.join(', ')}`
      : '';
    const score = result.similarityScore?.toFixed(3) || 'n/a';

    console.log(
      `- ${result.path}:${result.lineStart}-${result.lineEnd} ` +
        `[${result.chunkType}, ${result.layer}, score ${score}]${symbols}`
    );
  });
}

main().catch(error => {
  console.error('\nPhase 3 semantic search failed');
  console.error(error);
  process.exit(1);
});
