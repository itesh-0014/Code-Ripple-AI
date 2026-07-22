class ReviewReportGeneratorService {
  generate({ contextBundle, structuredReview, remediationPlan }) {
    const finalReview = {
      ...structuredReview,
      remediationPlan,
      readableReport: buildReadableReport({
        contextBundle,
        structuredReview,
        remediationPlan,
      }),
    };

    return finalReview;
  }
}

function buildReadableReport({
  contextBundle,
  structuredReview,
  remediationPlan,
}) {
  const lines = [
    `${structuredReview.riskLevel} RISK`,
    '',
    'Summary:',
    structuredReview.summary,
    '',
    'Changed Files:',
    ...formatList(structuredReview.changedFiles),
    '',
    'Affected Systems:',
    ...formatList(structuredReview.affectedSystems),
    '',
    'Dependency Impact:',
    `- Blast radius: ${structuredReview.dependencyImpact.blastRadius}`,
    `- Affected layers: ${
      structuredReview.dependencyImpact.affectedLayers.join(', ') || 'none'
    }`,
    '',
    'Detected Issues:',
    ...formatFindings(structuredReview.findings),
    '',
    'Architectural Concerns:',
    ...formatArchitecturalConcerns(structuredReview.architecturalConcerns),
    '',
    'Suggested Changes:',
    ...formatSuggestions(remediationPlan),
    '',
    'Test Recommendations:',
    ...formatTestRecommendations(structuredReview.testRecommendations),
    '',
    `Confidence: ${structuredReview.confidence}%`,
    `RAG Context: ${
      contextBundle.retrievedContext.available ? 'available' : 'not available'
    }`,
  ];

  return lines.join('\n');
}

function formatList(values) {
  if (!values?.length) {
    return ['- none'];
  }

  return values.slice(0, 20).map(value => `- ${value}`);
}

function formatFindings(findings) {
  if (!findings?.length) {
    return ['- No concrete issues identified from AI or deterministic rules.'];
  }

  return findings.slice(0, 12).map(finding => {
    const location = finding.filePath
      ? ` (${finding.filePath}${finding.line ? `:${finding.line}` : ''})`
      : '';

    return `- [${finding.severity}] ${finding.title}${location}: ${finding.description}`;
  });
}

function formatArchitecturalConcerns(concerns) {
  if (!concerns?.length) {
    return ['- No architectural concerns identified.'];
  }

  return concerns
    .slice(0, 8)
    .map(
      concern =>
        `- [${concern.severity}] ${concern.system}: ${concern.concern} Impact: ${concern.impact}`
    );
}

function formatSuggestions(suggestions) {
  if (!suggestions?.length) {
    return ['- No remediation suggestions generated.'];
  }

  return suggestions.slice(0, 12).map(suggestion => {
    const files = suggestion.files?.length
      ? ` Files: ${suggestion.files.join(', ')}.`
      : '';
    const actions = suggestion.actions?.length
      ? ` Actions: ${suggestion.actions.join(' ')}`
      : '';

    return `- [${suggestion.priority}] ${suggestion.title}.${files}${actions}`;
  });
}

function formatTestRecommendations(recommendations) {
  if (!recommendations?.length) {
    return ['- No specific test recommendations generated.'];
  }

  return recommendations
    .slice(0, 8)
    .map(
      recommendation =>
        `- ${recommendation.testType}: ${recommendation.target} - ${recommendation.reason}`
    );
}

export const reviewReportGeneratorService = new ReviewReportGeneratorService();
