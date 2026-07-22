class RemediationSuggestionService {
  generate({ contextBundle, structuredReview }) {
    const deterministicSuggestions = [
      ...buildRuleFindingSuggestions(contextBundle),
      ...buildArchitectureSuggestions(contextBundle),
      ...buildContextQualitySuggestions(contextBundle),
    ];

    return mergeSuggestions({
      aiSuggestions: structuredReview.suggestedChanges || [],
      deterministicSuggestions,
    });
  }
}

function buildRuleFindingSuggestions(contextBundle) {
  return (contextBundle.ruleEngine.findings || [])
    .filter(finding =>
      ['critical', 'high', 'medium'].includes(
        String(finding.severity || '').toLowerCase()
      )
    )
    .slice(0, 12)
    .map(finding => {
      const severity = String(finding.severity || '').toLowerCase();

      return {
        priority: severity === 'critical' ? 'must-fix' : 'should-fix',
        title: `Address ${finding.ruleId}`,
        rationale: finding.message,
        files: [finding.filePath].filter(Boolean),
        actions: [
          finding.recommendation ||
            'Fix the deterministic rule finding before merge.',
          finding.line ? `Inspect line ${finding.line}.` : null,
        ].filter(Boolean),
        source: 'rule-engine',
      };
    });
}

function buildArchitectureSuggestions(contextBundle) {
  const suggestions = [];
  const affectedSystems = new Set(contextBundle.affectedSystems || []);
  const riskSignals = contextBundle.architecturalImpact.riskSignals || [];
  const changedFiles = contextBundle.changedFiles || [];

  if (
    affectedSystems.has('authentication middleware') ||
    affectedSystems.has('authentication flow')
  ) {
    suggestions.push({
      priority: 'must-fix',
      title: 'Verify authentication boundary behavior',
      rationale:
        'Authentication-related changes can expose protected APIs if token or middleware behavior regresses.',
      files: changedFiles
        .filter(file => file.layer === 'auth-security')
        .map(file => file.path),
      actions: [
        'Add or run integration tests for valid, expired, malformed, and missing JWT/session tokens.',
        'Verify protected routes still reject unauthenticated requests.',
        'Check middleware order for every affected route.',
      ],
      source: 'architecture-analysis',
    });
  }

  if (riskSignals.some(signal => signal.type === 'large-blast-radius')) {
    suggestions.push({
      priority: 'should-fix',
      title: 'Reduce broad dependency blast radius',
      rationale:
        'A widely reused module changed, so downstream behavior should be validated beyond the edited file.',
      files: changedFiles.map(file => file.path),
      actions: [
        'Run tests for direct dependents and modules in the propagation chain.',
        'Keep exported contracts backward-compatible or document the contract change.',
        'Consider adding characterization tests around shared behavior before refactoring further.',
      ],
      source: 'architecture-analysis',
    });
  }

  if (
    contextBundle.reviewScope.affectedLayers?.includes('data') ||
    affectedSystems.has('MongoDB persistence')
  ) {
    suggestions.push({
      priority: 'should-fix',
      title: 'Validate MongoDB query and schema safety',
      rationale:
        'Data-layer changes can create injection, schema drift, or persistence consistency risks.',
      files: changedFiles
        .filter(file => file.layer === 'data')
        .map(file => file.path),
      actions: [
        'Validate request input before it reaches MongoDB query construction.',
        'Confirm schema changes are backward-compatible with existing documents.',
        'Add tests for empty, malformed, and privilege-sensitive query inputs.',
      ],
      source: 'architecture-analysis',
    });
  }

  return suggestions;
}

function buildContextQualitySuggestions(contextBundle) {
  if (contextBundle.retrievedContext.available) {
    return [];
  }

  return [
    {
      priority: 'consider',
      title: 'Run Phase 5 with semantic repository context',
      rationale:
        'RAG context was unavailable, so the AI review had less repository-specific evidence.',
      files: [],
      actions: [
        'Start ChromaDB and run the Phase 5 command with --with-rag for the richest review.',
        contextBundle.retrievedContext.error
          ? `Fix RAG retrieval error: ${contextBundle.retrievedContext.error}`
          : 'Enable RAG when repository-context review is required.',
      ],
      source: 'context-quality',
    },
  ];
}

function mergeSuggestions({ aiSuggestions, deterministicSuggestions }) {
  const suggestionByKey = new Map();

  for (const suggestion of [...aiSuggestions, ...deterministicSuggestions]) {
    const normalizedSuggestion = {
      priority: suggestion.priority || 'consider',
      title: suggestion.title || 'Review suggested change',
      rationale: suggestion.rationale || '',
      files: suggestion.files || [],
      actions: suggestion.actions || [],
      source: suggestion.source || 'gemini',
    };
    const key = normalizedSuggestion.title.toLowerCase();

    if (!suggestionByKey.has(key)) {
      suggestionByKey.set(key, normalizedSuggestion);
      continue;
    }

    const existing = suggestionByKey.get(key);
    suggestionByKey.set(key, {
      ...existing,
      files: [...new Set([...existing.files, ...normalizedSuggestion.files])],
      actions: [
        ...new Set([...existing.actions, ...normalizedSuggestion.actions]),
      ],
    });
  }

  return [...suggestionByKey.values()].sort(compareSuggestions);
}

function compareSuggestions(left, right) {
  const priorityRank = {
    'must-fix': 3,
    'should-fix': 2,
    consider: 1,
  };

  return (
    (priorityRank[right.priority] || 0) -
      (priorityRank[left.priority] || 0) ||
    left.title.localeCompare(right.title)
  );
}

export const remediationSuggestionService = new RemediationSuggestionService();
