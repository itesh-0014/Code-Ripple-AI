import { buildConfidenceFactors } from './confidenceFactors.js';

export function calculateConfidence(state) {
  const confidenceFactors = buildConfidenceFactors(state);
  const confidence = Math.min(
    100,
    Math.max(
      0,
      confidenceFactors.reduce((total, factor) => total + factor.score, 0)
    )
  );

  return {
    confidence,
    confidenceFactors,
  };
}
