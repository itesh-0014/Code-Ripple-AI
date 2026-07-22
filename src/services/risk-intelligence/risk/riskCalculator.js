export function calculateRiskScore(factors = []) {
  const rawScore = factors.reduce(
    (total, factor) => total + (Number(factor.score) || 0),
    0
  );

  return Math.min(10, Math.max(0, Math.round(rawScore * 10) / 10));
}

export function riskLevelFromFinalScore(score) {
  const normalizedScore = Number(score) || 0;

  if (normalizedScore >= 8) return 'CRITICAL';
  if (normalizedScore >= 5) return 'HIGH';
  if (normalizedScore >= 2) return 'MEDIUM';
  return 'LOW';
}
