import { calculateRiskScore, riskLevelFromFinalScore } from './riskCalculator.js';
import { generateRiskExplanation } from './riskExplanation.js';
import { buildRiskFactors } from './riskFactors.js';

export function calculateRiskIntelligence(state) {
  const factors = buildRiskFactors(state);
  const riskScore = calculateRiskScore(factors);
  const riskLevel = riskLevelFromFinalScore(riskScore);
  const explanation = generateRiskExplanation({ riskScore, riskLevel, factors });

  return {
    riskScore,
    riskLevel,
    riskFactors: factors,
    ...explanation,
  };
}
