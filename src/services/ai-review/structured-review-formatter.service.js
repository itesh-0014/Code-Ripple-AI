const SEVERITY_RANK = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

class StructuredReviewFormatterService {
  format({ rawReview, contextBundle, modelMetadata }) {
    const findings = mergeFindings({
      aiFindings: rawReview.findings || [],
      ruleFindings: contextBundle.ruleEngine.findings || [],
    });
    const riskLevel = chooseHighestSeverity([
      rawReview.riskLevel,
      contextBundle.ruleEngine.summary?.highestSeverity,
      ...((contextBundle.architecturalImpact.riskSignals || []).map(
        signal => signal.level
      )),
      ...findings.map(finding => finding.severity),
    ]);

    return {
      phase: 'phase-5-ai-review',
      status: 'completed',
      generatedAt: new Date().toISOString(),
      model: modelMetadata,
      summary: rawReview.summary || buildFallbackSummary(contextBundle),
      riskLevel,
      confidence: normalizeConfidence(
        rawReview.confidence,
        contextBundle.retrievedContext.available
      ),
      changedFiles: normalizeStringArray(rawReview.changedFiles).length
        ? normalizeStringArray(rawReview.changedFiles)
        : contextBundle.changedFiles.map(file => file.path),
      affectedSystems: normalizeStringArray(rawReview.affectedSystems).length
        ? normalizeStringArray(rawReview.affectedSystems)
        : contextBundle.affectedSystems,
      dependencyImpact: normalizeDependencyImpact(
        rawReview.dependencyImpact,
        contextBundle
      ),
      findings,
      architecturalConcerns: normalizeArchitecturalConcerns(
        rawReview.architecturalConcerns || []
      ),
      suggestedChanges: normalizeSuggestedChanges(
        rawReview.suggestedChanges || []
      ),
      testRecommendations: normalizeTestRecommendations(
        rawReview.testRecommendations || []
      ),
      positiveSignals: normalizeStringArray(rawReview.positiveSignals),
      contextSummary: {
        changedFileCount: contextBundle.reviewScope.changedFileCount,
        affectedModuleCount: contextBundle.reviewScope.affectedModuleCount,
        affectedLayers: contextBundle.reviewScope.affectedLayers,
        retrievedContextAvailable: contextBundle.retrievedContext.available,
        ruleFindings: contextBundle.ruleEngine.summary?.totalFindings || 0,
        riskSignals: contextBundle.architecturalImpact.riskSignals || [],
      },
    };
  }
}

function mergeFindings({ aiFindings, ruleFindings }) {
  const mergedFindings = new Map();

  for (const finding of aiFindings) {
    const normalizedFinding = {
      severity: normalizeSeverity(finding.severity),
      category: finding.category || 'ai-review',
      title: finding.title || 'AI review finding',
      description: finding.description || '',
      filePath: finding.filePath || '',
      line: normalizeLine(finding.line),
      evidence: normalizeStringArray(finding.evidence),
      recommendation: finding.recommendation || '',
      source: 'gemini',
    };

    mergedFindings.set(buildFindingKey(normalizedFinding), normalizedFinding);
  }

  for (const finding of ruleFindings.slice(0, 20)) {
    const normalizedFinding = {
      severity: normalizeSeverity(finding.severity),
      category: finding.category || 'rule-engine',
      title: finding.ruleName || finding.ruleId,
      description: finding.message,
      filePath: finding.filePath,
      line: normalizeLine(finding.line),
      evidence: normalizeStringArray(finding.evidence),
      recommendation: finding.recommendation || '',
      source: 'rule-engine',
      ruleId: finding.ruleId,
    };

    const key = buildFindingKey(normalizedFinding);

    if (!mergedFindings.has(key)) {
      mergedFindings.set(key, normalizedFinding);
    }
  }

  return [...mergedFindings.values()].sort(compareFindings);
}

function normalizeArchitecturalConcerns(concerns) {
  return concerns.map(concern => ({
    severity: normalizeSeverity(concern.severity),
    system: concern.system || 'application',
    concern: concern.concern || '',
    evidence: normalizeStringArray(concern.evidence),
    impact: concern.impact || '',
  }));
}

function normalizeSuggestedChanges(suggestions) {
  return suggestions.map(suggestion => ({
    priority: normalizePriority(suggestion.priority),
    title: suggestion.title || 'Review suggested change',
    rationale: suggestion.rationale || '',
    files: normalizeStringArray(suggestion.files),
    actions: normalizeStringArray(suggestion.actions),
    source: suggestion.source || 'gemini',
  }));
}

function normalizeTestRecommendations(recommendations) {
  return recommendations.map(recommendation => ({
    testType: recommendation.testType || 'integration',
    target: recommendation.target || 'affected workflow',
    reason: recommendation.reason || '',
  }));
}

function normalizeDependencyImpact(dependencyImpact = {}, contextBundle) {
  return {
    blastRadius:
      dependencyImpact.blastRadius ||
      `${contextBundle.reviewScope.affectedModuleCount} affected modules`,
    affectedLayers: normalizeStringArray(dependencyImpact.affectedLayers).length
      ? normalizeStringArray(dependencyImpact.affectedLayers)
      : contextBundle.reviewScope.affectedLayers || [],
    criticalPaths: normalizeStringArray(dependencyImpact.criticalPaths),
  };
}

function buildFallbackSummary(contextBundle) {
  return `Review covers ${contextBundle.reviewScope.changedFileCount} changed files and ${contextBundle.reviewScope.affectedModuleCount} affected modules.`;
}

function chooseHighestSeverity(values) {
  return values
    .map(normalizeSeverity)
    .sort((left, right) => SEVERITY_RANK[right] - SEVERITY_RANK[left])[0];
}

function normalizeSeverity(value) {
  const normalizedValue = String(value || 'info').toUpperCase();

  if (normalizedValue === 'CRITICAL') {
    return 'CRITICAL';
  }

  if (normalizedValue === 'HIGH') {
    return 'HIGH';
  }

  if (normalizedValue === 'MEDIUM') {
    return 'MEDIUM';
  }

  if (normalizedValue === 'LOW') {
    return 'LOW';
  }

  return 'INFO';
}

function normalizePriority(value) {
  const normalizedValue = String(value || '').toLowerCase();

  if (['must-fix', 'should-fix', 'consider'].includes(normalizedValue)) {
    return normalizedValue;
  }

  return 'consider';
}

function normalizeConfidence(value, hasRetrievedContext) {
  const confidence = Number.parseInt(value, 10);
  const normalizedConfidence = Number.isFinite(confidence)
    ? Math.min(100, Math.max(0, confidence))
    : 70;

  if (!hasRetrievedContext && normalizedConfidence > 85) {
    return 85;
  }

  return normalizedConfidence;
}

function normalizeLine(value) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function buildFindingKey(finding) {
  return [
    finding.filePath,
    finding.line,
    finding.title.toLowerCase(),
    finding.description.toLowerCase().slice(0, 80),
  ].join(':');
}

function compareFindings(left, right) {
  return (
    SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
    left.filePath.localeCompare(right.filePath) ||
    left.line - right.line ||
    left.title.localeCompare(right.title)
  );
}

export const structuredReviewFormatterService =
  new StructuredReviewFormatterService();
