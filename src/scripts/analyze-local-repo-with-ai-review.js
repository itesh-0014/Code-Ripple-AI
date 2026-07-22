import { repositoryIntelligenceService } from '../services/repository/repository-intelligence.service.js';
import { logPhase2Report } from '../utils/phase2-report.logger.js';
import { logPhase3Report } from '../utils/phase3-report.logger.js';
import { logPhase4Report } from '../utils/phase4-report.logger.js';
import { logPhase5Report } from '../utils/phase5-report.logger.js';

async function main() {
  const [repositoryPath, ...args] = process.argv.slice(2);
  const includeSemanticContext = args.includes('--with-rag');
  const changedFilePaths = args.filter(arg => arg !== '--with-rag');

  if (!repositoryPath || changedFilePaths.length === 0) {
    console.log(
      'Usage: npm run phase5:local -- <repository-path> <changed-file> [more-changed-files] [--with-rag]'
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
    includeSemanticContext,
    failOnContextError: includeSemanticContext,
    includeRuleValidation: true,
    includeAiReview: true,
    failOnAiReviewError: true,
  });

  logPhase2Report(report);

  if (includeSemanticContext) {
    logPhase3Report(report);
  }

  logPhase4Report(report);
  logPhase5Report(report);
}

main().catch(error => {
  if (error.code === 'GEMINI_API_KEY_MISSING') {
    console.error(error.message);
    process.exit(1);
  }

  console.error('\nPhase 5 local AI review failed');
  console.error(error);
  process.exit(1);
});
