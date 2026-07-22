export const AI_REVIEW_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    riskLevel: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low', 'info'],
    },
    confidence: { type: 'integer', minimum: 0, maximum: 100 },
    changedFiles: { type: 'array', items: { type: 'string' } },
    affectedSystems: { type: 'array', items: { type: 'string' } },
    dependencyImpact: {
      type: 'object',
      properties: {
        blastRadius: { type: 'string' },
        affectedLayers: { type: 'array', items: { type: 'string' } },
        criticalPaths: { type: 'array', items: { type: 'string' } },
      },
      required: ['blastRadius', 'affectedLayers', 'criticalPaths'],
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'info'],
          },
          category: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          filePath: { type: 'string' },
          line: { type: 'integer' },
          evidence: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' },
        },
        required: [
          'severity',
          'category',
          'title',
          'description',
          'filePath',
          'line',
          'evidence',
          'recommendation',
        ],
      },
    },
    architecturalConcerns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'info'],
          },
          system: { type: 'string' },
          concern: { type: 'string' },
          evidence: { type: 'array', items: { type: 'string' } },
          impact: { type: 'string' },
        },
        required: ['severity', 'system', 'concern', 'evidence', 'impact'],
      },
    },
    suggestedChanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: {
            type: 'string',
            enum: ['must-fix', 'should-fix', 'consider'],
          },
          title: { type: 'string' },
          rationale: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          actions: { type: 'array', items: { type: 'string' } },
        },
        required: ['priority', 'title', 'rationale', 'files', 'actions'],
      },
    },
    testRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          testType: { type: 'string' },
          target: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['testType', 'target', 'reason'],
      },
    },
    positiveSignals: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'summary',
    'riskLevel',
    'confidence',
    'changedFiles',
    'affectedSystems',
    'dependencyImpact',
    'findings',
    'architecturalConcerns',
    'suggestedChanges',
    'testRecommendations',
    'positiveSignals',
  ],
};

class PromptBuilderService {
  buildPrompt(contextBundle) {
    return {
      systemInstruction: buildSystemInstruction(),
      userPrompt: buildUserPrompt(contextBundle),
      responseSchema: AI_REVIEW_RESPONSE_SCHEMA,
      metadata: {
        promptKind: 'mern-architecture-aware-pr-review',
        contextBundlePhase: contextBundle.phase,
      },
    };
  }
}

function buildSystemInstruction() {
  return [
    'You are GitSense AI, a senior MERN architecture PR reviewer.',
    'Your job is to review pull requests using changed files, dependency graph impact, RAG repository context, and deterministic rule findings.',
    'Do not produce generic diff comments. Prioritize affected systems, architectural blast radius, security boundaries, MongoDB/data safety, Express middleware/route behavior, React workflow impact, and maintainability.',
    'Use only the provided context. If evidence is incomplete, say what is uncertain instead of inventing facts.',
    'Treat deterministic rule findings and dependency risk signals as strong evidence.',
    'Return only valid JSON that matches the provided schema.',
  ].join('\n');
}

function buildUserPrompt(contextBundle) {
  return [
    'Review this MERN pull request as an architecture-aware backend reviewer.',
    '',
    'You must identify:',
    '- affected systems and dependency blast radius',
    '- deterministic issues from the rule engine',
    '- architectural concerns caused by changed contracts or shared modules',
    '- remediation steps that are safe for a production MERN codebase',
    '- tests the author should add or run before merge',
    '',
    'Severity guidance:',
    '- critical: likely auth bypass, data corruption, secrets exposure, or production outage',
    '- high: security-sensitive, broad blast radius, unsafe persistence/API behavior, or broken shared contract',
    '- medium: correctness, validation, maintainability, or test coverage risk',
    '- low/info: small cleanup or confidence-building recommendation',
    '',
    'Context bundle JSON:',
    JSON.stringify(contextBundle, null, 2),
  ].join('\n');
}

export const promptBuilderService = new PromptBuilderService();
