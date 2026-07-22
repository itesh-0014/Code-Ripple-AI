import { prReviewOrchestratorService } from '../services/orchestration/pr-review-orchestrator.service.js';
import { logPhase2Report } from '../utils/phase2-report.logger.js';
import { logPhase3Report } from '../utils/phase3-report.logger.js';
import { logPhase4Report } from '../utils/phase4-report.logger.js';
import { logPhase5Report } from '../utils/phase5-report.logger.js';
import { logPhase6Report } from '../utils/phase6-report.logger.js';

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(arg => arg.startsWith('--')));
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  const [repositoryPath, ...changedFilePaths] = positionalArgs;

  if (!repositoryPath || changedFilePaths.length === 0) {
    printUsage();
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

  const report = await prReviewOrchestratorService.reviewLocalRepository({
    repositoryPath,
    changedFiles,
    includeSemanticContext: hasFlag(flags, '--with-rag'),
    failOnContextError: hasFlag(flags, '--fail-on-context-error'),
    includeRuleValidation: !hasFlag(flags, '--skip-rules'),
    includeAiReview: !hasFlag(flags, '--skip-ai'),
    failOnAiReviewError: hasFlag(flags, '--fail-on-ai-error'),
    debug: hasFlag(flags, '--debug'),
  });

  if (hasFlag(flags, '--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  logPhase2Report(report);

  if (hasFlag(flags, '--with-rag')) {
    logPhase3Report(report);
  }

  if (!hasFlag(flags, '--skip-rules')) {
    logPhase4Report(report);
  }

  if (!hasFlag(flags, '--skip-ai')) {
    logPhase5Report(report);
  }

  logPhase6Report(report);
}

function hasFlag(flags, flagName) {
  if (flags.has(flagName)) {
    return true;
  }

  const npmConfigName = `npm_config_${flagName.slice(2).replace(/-/g, '_')}`;

  return process.env[npmConfigName] === 'true';
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  npm run phase6:local -- <repository-path> <changed-file> [more-changed-files] [flags]',
      '',
      'Flags:',
      '  --with-rag                 Run the Context Agent and Chroma-backed retrieval.',
      '  --skip-ai                  Skip Gemini and still produce graph/rule/risk output.',
      '  --skip-rules               Skip deterministic validation.',
      '  --fail-on-context-error    Throw instead of safe-reporting RAG failures.',
      '  --fail-on-ai-error         Throw instead of safe-reporting Gemini failures.',
      '  --json                     Print the final structured Phase 6 report.',
      '  --debug                    Preserve debug metadata in the graph state.',
    ].join('\n')
  );
}

main().catch(error => {
  console.error('\nPhase 6 local LangGraph review failed');
  console.error(error);
  process.exit(1);
});
