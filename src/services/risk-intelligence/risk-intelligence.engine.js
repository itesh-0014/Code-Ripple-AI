import { calculateConfidence } from './confidence/confidenceEngine.js';
import { calculateRiskIntelligence } from './risk/riskEngine.js';
import { calculateSeverity } from './severity/severityEngine.js';

export function buildFinalRiskIntelligence(state) {
  const risk = calculateRiskIntelligence(state);
  const confidence = calculateConfidence(state);
  const severity = calculateSeverity({
    riskScore: risk.riskScore,
    confidence: confidence.confidence,
  });

  return {
    ...risk,
    ...confidence,
    severity,
  };
}
