export function assignCriticality(prioritizedFiles = []) {
  return prioritizedFiles.map(file => ({
    ...file,
    criticality: criticalityFromScore(file.score),
  }));
}

export function criticalityFromScore(score = 0) {
  if (score >= 80) {
    return 'CRITICAL';
  }

  if (score >= 60) {
    return 'HIGH';
  }

  if (score >= 35) {
    return 'MEDIUM';
  }

  return 'LOW';
}

