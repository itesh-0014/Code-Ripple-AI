import { allocateReviewBudget } from './budget/reviewBudgetEngine.js';
import { assignCriticality } from './criticality/criticalityEngine.js';
import { detectHotspots } from './hotspots/hotspotDetector.js';
import { prioritizeFiles } from './prioritization/prioritizationEngine.js';
import { classifyPRSize, selectReviewMode } from './reviewStrategies.js';

export function buildSmartReviewPlan(state) {
  const prSize = classifyPRSize((state.changedFiles || []).length);
  const reviewMode = selectReviewMode(prSize);
  const prioritizedFiles = assignCriticality(prioritizeFiles(state));
  const hotspots = detectHotspots({ state, prioritizedFiles });
  const reviewBudget = allocateReviewBudget({
    prSize,
    reviewMode,
    prioritizedFiles,
  });
  const criticalFiles = prioritizedFiles
    .filter(file => ['CRITICAL', 'HIGH'].includes(file.criticality))
    .map(file => ({
      file: file.file,
      score: file.score,
      criticality: file.criticality,
    }));

  return {
    generatedAt: new Date().toISOString(),
    prSize,
    changedFileCount: prioritizedFiles.length,
    reviewMode,
    prioritizedFiles,
    hotspots,
    reviewBudget,
    criticalFiles,
  };
}

