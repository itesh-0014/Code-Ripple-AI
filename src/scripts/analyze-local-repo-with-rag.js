import { repositoryIntelligenceService } from '../services/repository/repository-intelligence.service.js';
import { logPhase2Report } from '../utils/phase2-report.logger.js';
import { logPhase3Report } from '../utils/phase3-report.logger.js';

async function main() {
  const [repositoryPath, ...changedFilePaths] = process.argv.slice(2);

  if (!repositoryPath || changedFilePaths.length === 0) {
    console.log(
      'Usage: npm run phase3:local -- <repository-path> <changed-file> [more-changed-files]'
    );
    process.exit(1);
  }

  const changedFiles = changedFilePaths.map(filename => ({
    filename,
    status: 'modified',
    additions: 0,
    deletions: 0,
    changes: 0,
    patch: null,
  }));

  const report = await repositoryIntelligenceService.analyzeLocalRepository({
    repositoryPath,
    changedFiles,
    includeSemanticContext: true,
    failOnContextError: true,
  });

  logPhase2Report(report);
  logPhase3Report(report);
}

main().catch(error => {
  console.error('\nPhase 3 local analysis failed');
  console.error(error);
  process.exit(1);
});
