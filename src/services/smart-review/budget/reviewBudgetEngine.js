import {
  PR_SIZE_CLASSIFICATION,
  REVIEW_DEPTH,
  SMART_REVIEW_MODE,
} from '../reviewStrategies.js';

export function allocateReviewBudget({ prSize, reviewMode, prioritizedFiles }) {
  const totalFiles = prioritizedFiles.length;

  if (prSize === PR_SIZE_CLASSIFICATION.SMALL) {
    return buildBudget({
      reviewMode,
      deepFiles: prioritizedFiles,
      standardFiles: [],
      lightFiles: [],
      rationale: 'Small PRs receive full deep review across every changed file.',
    });
  }

  if (prSize === PR_SIZE_CLASSIFICATION.MEDIUM) {
    const deepFiles = prioritizedFiles.filter(file =>
      ['CRITICAL', 'HIGH'].includes(file.criticality)
    );
    const standardFiles = prioritizedFiles.filter(file =>
      !deepFiles.some(deepFile => deepFile.file === file.file)
    );

    return buildBudget({
      reviewMode,
      deepFiles,
      standardFiles,
      lightFiles: [],
      rationale:
        'Medium PRs review every file while promoting high-priority files to deep review.',
    });
  }

  const deepCount = Math.max(1, Math.min(20, Math.ceil(totalFiles * 0.2)));
  const standardCount = Math.max(0, Math.min(30, Math.ceil(totalFiles * 0.3)));
  const deepFiles = prioritizedFiles.slice(0, deepCount);
  const standardFiles = prioritizedFiles.slice(deepCount, deepCount + standardCount);
  const lightFiles = prioritizedFiles.slice(deepCount + standardCount);

  return buildBudget({
    reviewMode: reviewMode || SMART_REVIEW_MODE.RISK_FIRST_REVIEW,
    deepFiles,
    standardFiles,
    lightFiles,
    rationale:
      'Large PRs use risk-first allocation: deepest review on top-ranked files, standard review on the next tier, light review on the remainder.',
  });
}

function buildBudget({ reviewMode, deepFiles, standardFiles, lightFiles, rationale }) {
  return {
    reviewMode,
    rationale,
    deepReview: deepFiles.map(file => toBudgetFile(file, REVIEW_DEPTH.DEEP)),
    standardReview: standardFiles.map(file => toBudgetFile(file, REVIEW_DEPTH.STANDARD)),
    lightReview: lightFiles.map(file => toBudgetFile(file, REVIEW_DEPTH.LIGHT)),
    counts: {
      deep: deepFiles.length,
      standard: standardFiles.length,
      light: lightFiles.length,
      total: deepFiles.length + standardFiles.length + lightFiles.length,
    },
  };
}

function toBudgetFile(file, depth) {
  return {
    file: file.file,
    score: file.score,
    criticality: file.criticality,
    depth,
  };
}
