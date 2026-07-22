export function logPhase2Report(report) {
  console.log('\n================ PHASE 2 REPOSITORY INTELLIGENCE ================');
  console.log(`Repository source: ${report.repository.source}`);
  console.log(`Scanned source files: ${report.scan.totalSourceFiles}`);
  console.log(`Dependency graph nodes: ${report.graph.summary.totalNodes}`);
  console.log(`Dependency graph edges: ${report.graph.summary.totalEdges}`);
  console.log(`External packages: ${report.graph.summary.totalExternalPackages}`);
  console.log(`Parse errors: ${report.graph.summary.totalParseErrors}`);

  console.log('\nChanged file impact:');

  report.impact.changedFiles.forEach(file => {
    console.log(`- ${file.filename}`);
    console.log(`  Layer: ${file.layer}`);
    console.log(`  In dependency graph: ${file.inDependencyGraph}`);
    console.log(`  Direct dependents: ${file.directDependents.length}`);
    console.log(`  Affected modules: ${file.affectedModules.length}`);
  });

  console.log('\nTop affected modules:');

  if (report.impact.affectedModules.length === 0) {
    console.log('- No dependent source modules detected.');
  } else {
    report.impact.affectedModules.slice(0, 15).forEach(module => {
      console.log(
        `- [depth ${module.distance}] ${module.path} (${module.layer})`
      );
    });
  }

  console.log('\nRisk signals:');

  if (report.impact.riskSignals.length === 0) {
    console.log('- No major dependency risk signals detected.');
  } else {
    report.impact.riskSignals.forEach(signal => {
      console.log(`- [${signal.level}] ${signal.type}: ${signal.message}`);
      console.log(`  Evidence: ${signal.evidence.join(', ')}`);
    });
  }

  console.log('\nPhase 2 complete: dependency-aware impact analysis generated.');
}
