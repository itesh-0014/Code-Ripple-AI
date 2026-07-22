export function logPhase3Report(report) {
  if (!report?.context) {
    console.log('\nPhase 3 context retrieval was not requested.');
    return;
  }

  const context = report.context;

  console.log('\n================ PHASE 3 CONTEXT RETRIEVAL ================');

  if (context.error) {
    console.log(`Phase 3 failed: ${context.error}`);
    return;
  }

  console.log(`Repository key: ${context.repositoryKey}`);
  console.log(`Chroma collection: ${context.indexing.collectionName}`);
  console.log(`Embedding provider: ${context.indexing.embeddingProfile.provider}`);
  console.log(`Embedding model: ${context.indexing.embeddingProfile.model}`);
  console.log(`Indexed files: ${context.indexing.filesIndexed || 0}`);
  console.log(`Indexed chunks: ${context.indexing.chunksIndexed || 0}`);
  console.log(`Retrieved chunks: ${context.summary.retrievedChunks}`);
  console.log(`Unique retrieved files: ${context.summary.uniqueRetrievedFiles}`);

  context.changedFiles.forEach(file => {
    console.log(`\nChanged File: ${file.filename}`);

    console.log('Structural context:');
    printList('Direct dependencies', file.structuralContext.directDependencies);
    printList('Direct dependents', file.structuralContext.directDependents);
    printList(
      'Affected modules',
      file.structuralContext.affectedModules.map(
        module => `${module.path} (${module.layer}, depth ${module.distance})`
      )
    );

    console.log('Retrieved Context:');

    if (file.retrievedContext.length === 0) {
      console.log('- No semantic context retrieved.');
      return;
    }

    file.retrievedContext.forEach(item => {
      const symbolText = item.symbols.length
        ? ` symbols: ${item.symbols.join(', ')}`
        : '';
      const reasons = item.reasons.join(', ');
      const score = item.relevanceScore.toFixed(3);

      console.log(
        `- ${item.path}:${item.lineStart}-${item.lineEnd} ` +
          `[${item.chunkType}, ${item.layer}, score ${score}]`
      );
      console.log(`  Reason: ${reasons}${symbolText}`);
    });
  });

  console.log('\nPhase 3 complete: repository-context retrieval generated.');
}

function printList(label, values) {
  if (!values.length) {
    console.log(`- ${label}: none`);
    return;
  }

  console.log(`- ${label}:`);
  values.slice(0, 12).forEach(value => {
    console.log(`  - ${value}`);
  });
}
