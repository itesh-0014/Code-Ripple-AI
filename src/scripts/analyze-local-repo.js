import { repositoryIntelligenceService } from '../services/repository/repository-intelligence.service.js';
import { logPhase2Report } from '../utils/phase2-report.logger.js';

async function main() {
  const [repositoryPath, ...changedFilePaths] = process.argv.slice(2);

  if (!repositoryPath || changedFilePaths.length === 0) {
    console.log(
      'Usage: npm run phase2:local -- <repository-path> <changed-file> [more-changed-files]'
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
  });

  logPhase2Report(report);
}

main().catch(error => {
  console.error('\nPhase 2 local analysis failed');
  console.error(error);
  process.exit(1);
});
