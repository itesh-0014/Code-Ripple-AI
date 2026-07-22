# Phase 7 - Risk and Confidence Intelligence Engine

Phase 7 adds a deterministic final intelligence layer to GitSense AI. It does not replace the Phase 1-6 dependency, RAG, rule, AI review, architecture, or adaptive routing behavior.

## Architecture

```text
PR Event
  -> Planner Agent
  -> Dependency Agent
  -> Context Agent + Rule Agent
  -> Review Agent
  -> optional Architecture Agent
  -> Risk Intelligence Agent
  -> Risk Summary Agent
  -> Final Report
```

The Phase 6 adaptive routing score remains a 0-100 value and is retained as `routingRiskScore`. The final Phase 7 `riskScore` is a separate 0-10 explainable score.

## Folder Structure

```text
src/services/risk-intelligence/
  risk/
    riskEngine.js
    riskCalculator.js
    riskFactors.js
    riskExplanation.js
  confidence/
    confidenceEngine.js
    confidenceFactors.js
  severity/
    severityEngine.js
    severityPolicies.js
  risk-intelligence.engine.js

src/services/orchestration/agents/
  risk-intelligence.agent.js
```

## Risk Scoring

The maximum score is 10.0:

| Factor | Maximum |
| --- | ---: |
| Repository layer | 3.0 |
| Affected module count | 1.0 |
| Dependency propagation | 1.0 |
| Rule findings | 3.0 |
| Architecture analysis | 1.0 |
| AI review findings | 1.0 |

Repository layer examples are centralized in `riskFactors.js`: authentication and authorization are 3.0, database is 2.5, middleware is 2.5, API is 2.0, business logic is 1.5, and frontend is 0.5.

Risk levels:

| Score | Risk Level |
| --- | --- |
| 0.0 to less than 2.0 | LOW |
| 2.0 to less than 5.0 | MEDIUM |
| 5.0 to less than 8.0 | HIGH |
| 8.0 to 10.0 | CRITICAL |

Every factor contains `score`, `maxScore`, `evidence`, and `reasons`. The explanation generator uses those reasons only, so explanations are deterministic and traceable.

## Confidence Scoring

Confidence is the sum of six explicit factors:

| Factor | Maximum |
| --- | ---: |
| Context coverage | 20 |
| Dependency coverage | 25 |
| Rule engine agreement | 15 |
| Architecture agreement | 15 |
| Reflection count | 10 |
| AI certainty | 15 |

Parse errors, unresolved imports, review retries, low AI confidence, and uncertainty language reduce confidence. Good context coverage and agreement between deterministic and AI analysis increase it.

## Severity Policy

Severity combines final risk and confidence:

```text
risk >= 8.0 and confidence >= 70 -> CRITICAL
risk >= 5.0 and confidence >= 60 -> HIGH
risk >= 2.0                      -> MEDIUM
otherwise                        -> LOW
```

This prevents a low-confidence review from presenting a critical conclusion as highly certain while preserving the raw `riskLevel`.

## Shared State

Phase 7 adds:

```js
{
  routingRiskScore,
  riskScore,
  riskLevel,
  confidence,
  severity,
  riskExplanation,
  contributingFactors,
  riskFactors,
  confidenceFactors
}
```

## Example Calculation

An authentication middleware PR with 14 affected modules, dependency propagation depth 3, hardcoded secret and missing validation rule findings, high architecture impact, and a critical AI security finding scores:

```text
Repository layer          3.0
Affected modules          0.7
Dependency propagation    0.7
Rule findings             3.0
Architecture analysis     0.8
AI review findings        1.0
Total                     9.2 / 10
Risk level                CRITICAL
```

## Example Report

```json
{
  "riskScore": 9.2,
  "riskLevel": "CRITICAL",
  "confidence": 99,
  "severity": "CRITICAL",
  "riskExplanation": "CRITICAL risk (9.2/10) is driven by authentication layer modified, rule engine detected hardcoded secret, and ai review identified critical security risk.",
  "contributingFactors": [
    "Authentication layer modified",
    "Rule engine detected Hardcoded Secret",
    "AI review identified Critical Security Risk",
    "14 downstream modules affected",
    "Rule engine detected Missing Validation"
  ]
}
```

## Testing Strategy

Run the deterministic unit tests:

```bash
npm test
```

Run the laptop-safe workflow without Gemini or ChromaDB:

```bash
node src/scripts/analyze-local-repo-with-langgraph.js . src/server.js --skip-ai --json
```

Production extensions can move weights into versioned repository policies, persist factor traces for audit history, and calibrate thresholds against reviewed incident data.
