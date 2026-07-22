export function detectHotspots({ state, prioritizedFiles }) {
  return prioritizedFiles
    .map(file => buildHotspot({ state, file }))
    .filter(result => result.hotspot)
    .sort(
      (left, right) =>
        impactRank(right.impactLevel) - impactRank(left.impactLevel) ||
        right.score - left.score ||
        left.file.localeCompare(right.file)
    );
}

function buildHotspot({ state, file }) {
  const lowerPath = file.file.toLowerCase();
  const dependencyFactor = file.factors?.dependencyCount || {};
  const reasons = [];

  if ((dependencyFactor.directDependents || 0) >= 5) {
    reasons.push('Highly connected module');
  }

  if ((dependencyFactor.affectedModules || 0) >= 10) {
    reasons.push('Large dependency blast radius');
  }

  if (/middleware/.test(lowerPath)) {
    reasons.push('Critical middleware');
  }

  if (/(auth|jwt|session|token|permission|role)/.test(lowerPath)) {
    reasons.push('Authentication or authorization system');
  }

  if (/(config|env|server|app|index|bootstrap|database|db|queue|worker)/.test(lowerPath)) {
    reasons.push('Core infrastructure module');
  }

  for (const system of state.architectureAnalysis?.criticalSystemsAffected || []) {
    if (systemMatchesFile(system, lowerPath)) {
      reasons.push(`Critical system: ${system}`);
    }
  }

  const uniqueReasons = [...new Set(reasons)];

  return {
    file: file.file,
    hotspot: uniqueReasons.length > 0,
    impactLevel: impactLevelFor({ file, reasons: uniqueReasons }),
    score: file.score,
    reasons: uniqueReasons,
  };
}

function impactLevelFor({ file, reasons }) {
  if (file.criticality === 'CRITICAL' || reasons.length >= 3) {
    return 'CRITICAL';
  }

  if (file.criticality === 'HIGH' || reasons.length >= 2) {
    return 'HIGH';
  }

  return 'MEDIUM';
}

function systemMatchesFile(system, lowerPath) {
  const lowerSystem = String(system).toLowerCase();

  if (lowerSystem.includes('auth')) {
    return /(auth|jwt|session|token|permission|role)/.test(lowerPath);
  }

  if (lowerSystem.includes('api')) {
    return /(api|route|controller)/.test(lowerPath);
  }

  if (lowerSystem.includes('persistence') || lowerSystem.includes('data')) {
    return /(model|schema|db|database|repository|mongo|mongoose)/.test(lowerPath);
  }

  if (lowerSystem.includes('middleware')) {
    return /middleware/.test(lowerPath);
  }

  return false;
}

function impactRank(impactLevel) {
  return {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
  }[impactLevel] || 0;
}

