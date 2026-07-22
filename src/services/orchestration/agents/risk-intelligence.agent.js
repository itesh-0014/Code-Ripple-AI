import { buildFinalRiskIntelligence } from '../../risk-intelligence/risk-intelligence.engine.js';
import { buildAgentExecutionMetadata } from '../utils/execution-metadata.util.js';

export async function riskIntelligenceAgent(state) {
  const startedAt = new Date();
  const intelligence = buildFinalRiskIntelligence(state);

  return {
    riskScore: intelligence.riskScore,
    riskLevel: intelligence.riskLevel,
    confidence: intelligence.confidence,
    severity: intelligence.severity,
    riskExplanation: intelligence.riskExplanation,
    contributingFactors: intelligence.contributingFactors,
    riskFactors: intelligence.riskFactors,
    confidenceFactors: intelligence.confidenceFactors,
    executionMetadata: buildAgentExecutionMetadata({
      agentName: 'risk_intelligence_agent',
      startedAt,
      details: {
        riskScore: intelligence.riskScore,
        riskLevel: intelligence.riskLevel,
        confidence: intelligence.confidence,
        severity: intelligence.severity,
        contributingFactorCount: intelligence.contributingFactors.length,
      },
    }),
  };
}
