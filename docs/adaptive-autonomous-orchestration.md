# Adaptive Autonomous Orchestration

GitSense AI Phase 6 now uses an adaptive LangGraph workflow instead of a fixed sequential chain. The existing Phase 1-5 services remain the source of truth for GitHub intake, dependency intelligence, RAG, rules, and AI review; the orchestration layer decides which parts to run and when to revisit context.

## Updated Architecture

```text
PR event
  -> orchestrator_agent
  -> planner_agent
  -> dependency_agent
  -> routingEngine.decide(afterDependency)
       -> context_agent and rule_engine_agent in parallel when both are useful
       -> review_agent when no analysis branch is needed
  -> review_agent
  -> routingEngine.decide(afterReview)
       -> context_agent in EXPANDED mode when confidence is low
       -> architecture_agent when risk is high
       -> risk_summary_agent when review is sufficient
  -> risk_summary_agent
  -> END
```

The graph remains laptop-testable and production-inspired: no autonomous code writes, no commits, no external worker infrastructure, and no self-improving loop.

## Folder Structure Changes

```text
src/services/orchestration/
  agents/
    architecture.agent.js
    context.agent.js
    dependency.agent.js
    orchestrator.agent.js
    planner.agent.js
    review.agent.js
    risk-summary.agent.js
    rule-engine.agent.js
  graph/
    pr-review.state.js
    pr-review.workflow.js
  routing/
    execution-strategies.js
    routing-engine.js
    routing-policies.js
  utils/
    execution-metadata.util.js
    report-builder.util.js
    routing-profile.util.js
    severity.util.js
```

## Planner Agent

`planner.agent.js` analyzes changed file paths, layers, PR size, frontend/backend/auth/data indicators, and estimated architectural impact. It writes:

```js
{
  riskLevel: 'HIGH',
  riskScore: 78,
  reviewDepth: 'DEEP',
  requiredAgents: [
    'dependencyAgent',
    'contextAgent',
    'ruleAgent',
    'reviewAgent',
    'architectureAgent',
    'riskSummaryAgent',
  ],
}
```

Review depth modes:

- `LIGHT`: frontend-only, style-only, or small UI changes.
- `STANDARD`: services, controllers, general business logic, or mixed normal changes.
- `DEEP`: auth, authorization, middleware, database, broad impact, or high-risk score.

## Routing Engine

Routing logic is centralized in `src/services/orchestration/routing/`.

- `routing-policies.js`: thresholds, risk scoring, confidence policy, context expansion policy, architecture-analysis policy.
- `execution-strategies.js`: builds and refines the execution plan.
- `routing-engine.js`: exposes `routingEngine.decide(state, { stage })`.

The graph only asks the routing engine for the next node. Agents may enrich state, but they do not own workflow routing.

## Architecture Agent

`architecture.agent.js` performs deterministic architectural impact analysis after review when the execution plan or risk score requires it. It inspects:

- affected modules and layers
- dependency propagation chains
- cross-module impact
- auth/API/database/shared-contract exposure
- AI and rule finding signals

Output includes:

```js
{
  architecturalRisk: 'HIGH',
  criticalSystemsAffected: ['Authentication', 'Protected APIs'],
  cascadingFailureRisks: [],
  dependencyPropagation: {},
  recommendations: [],
}
```

## Reflection Loop

After `review_agent`, the routing engine checks confidence:

```js
confidence < 65 && retries.contextExpansion < 2
```

When true, the graph routes back to `context_agent`. The context agent switches to `EXPANDED` retrieval and increments `retries.contextExpansion`. The review then runs again. The retry cap prevents infinite loops.

## Context Expansion

Normal retrieval asks for 5 chunks per changed file. Expanded retrieval asks for 15 chunks per changed file.

```text
NORMAL   -> top 5 chunks per changed file
EXPANDED -> top 15 chunks per changed file
```

The RAG service still defaults to its config when called by older Phase 3/5 code paths. The adaptive graph passes explicit retrieval mode and chunk limits.

## Shared State Additions

The Phase 6 state now carries:

```js
{
  riskScore,
  reviewDepth,
  plannerDecision,
  executionPlan,
  architectureAnalysis,
  retries,
  contextRetrievalMode,
}
```

Existing state fields such as `changedFiles`, `affectedModules`, `dependencyGraph`, `retrievedContext`, `ruleFindings`, `aiReview`, `confidence`, and `executionMetadata` are preserved.

## Migration From Static Phase 6

1. Keep the existing Phase 1-5 service calls unchanged.
2. Add `planner_agent` before `dependency_agent`.
3. Replace hardcoded graph edges after dependency/review with `routingEngine.decide(...)`.
4. Let `dependency_agent` refine the planner execution plan with real dependency impact.
5. Let `context_agent` support `NORMAL` and `EXPANDED` retrieval modes.
6. Let `review_agent` write `confidence` and updated `riskScore`.
7. Add `architecture_agent` before final summary only when risk requires it.
8. Extend reports/logging with `plannerDecision`, `executionPlan`, `architectureAnalysis`, `riskScore`, `reviewDepth`, and retry metadata.

## Testing Strategy

Smoke test without external AI or Chroma:

```bash
node src/scripts/analyze-local-repo-with-langgraph.js . src/server.js --skip-ai --json
```

Test architecture routing with an auth-sensitive path:

```bash
node src/scripts/analyze-local-repo-with-langgraph.js . src/services/auth/auth.service.js --skip-ai --json
```

Test context branch safe behavior when Chroma is not running:

```bash
node src/scripts/analyze-local-repo-with-langgraph.js . src/server.js --with-rag --skip-ai --json
```

Full AI review requires `GEMINI_API_KEY`. Full semantic retrieval requires ChromaDB.

## Example Execution Traces

Frontend PR:

```text
planner_agent -> dependency_agent -> context_agent + rule_engine_agent
  -> review_agent -> risk_summary_agent

reviewDepth: LIGHT or STANDARD
rulePolicy: skip backend rules when dependency impact stays frontend-only
architecture_agent: skipped unless risk becomes high
```

Authentication PR:

```text
planner_agent -> dependency_agent -> context_agent + rule_engine_agent
  -> review_agent -> architecture_agent -> risk_summary_agent

reviewDepth: DEEP
rulePolicy: keep backend/general validation
architecture_agent: required because auth-sensitive systems are exposed
```

Database PR:

```text
planner_agent -> dependency_agent -> rule_engine_agent + optional context_agent
  -> review_agent -> architecture_agent when risk score is high
  -> risk_summary_agent

reviewDepth: DEEP
focus: model/schema/repository impact, data integrity, propagation chains
```
