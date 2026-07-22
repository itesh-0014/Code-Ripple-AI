# Phase 6 - Adaptive LangGraph Multi-Agent Orchestration

GitSense AI Phase 6 converts the existing PR review pipeline into an adaptive LangGraph `StateGraph` without replacing the Phase 1-5 services. The graph coordinates specialized agents, shares state across nodes, supports conditional routing, lets Context and Rule Engine execution run in parallel after dependency analysis, and can rerun review with expanded context when confidence is low.

See `docs/adaptive-autonomous-orchestration.md` for the planner, routing engine, architecture agent, reflection loop, migration steps, and example execution traces.

## Folder Structure

```text
src/services/orchestration/
  agents/
    architecture.agent.js
    orchestrator.agent.js
    planner.agent.js
    dependency.agent.js
    context.agent.js
    rule-engine.agent.js
    review.agent.js
    risk-summary.agent.js
  graph/
    pr-review.state.js
    pr-review.workflow.js
  routing/
    routing-engine.js
    routing-policies.js
    execution-strategies.js
  utils/
    execution-metadata.util.js
    report-builder.util.js
    routing-profile.util.js
    severity.util.js
  pr-review-orchestrator.service.js

src/scripts/analyze-local-repo-with-langgraph.js
src/utils/phase6-report.logger.js
```

## Shared State Design

The public state required by Phase 6 is preserved:

```js
{
  changedFiles: [],
  affectedModules: [],
  dependencyGraph: {},
  retrievedContext: [],
  ruleFindings: [],
  aiReview: null,
  reviewSummary: null,
  severity: null,
  confidence: null,
  riskScore: 0,
  reviewDepth: null,
  plannerDecision: null,
  executionPlan: null,
  architectureAnalysis: null,
  retries: {},
  executionMetadata: {}
}
```

The graph also carries internal fields needed to reuse existing services: `repository`, `options`, `scanResult`, `graph`, `impact`, `context`, `validation`, `routeProfile`, and `rulePolicy`.

## Workflow Design

```text
START
  -> orchestrator_agent
  -> planner_agent
  -> dependency_agent
  -> routingEngine.decide(afterDependency)
       context_agent      rule_engine_agent
              \            /
               review_agent
                    |
             routingEngine.decide(afterReview)
              /       |        \
     context_agent architecture_agent risk_summary_agent
              \        |        /
               review_agent    /
                    \          /
                  risk_summary_agent
                         |
                        END
```

## Step 1 - Design Phase 6 Architecture

Architecture Explanation: Phase 6 adds a graph layer around the existing repository, RAG, rule, and Gemini services.

Real-World Importance: This separates orchestration concerns from domain logic, which makes the pipeline easier to debug and extend.

LangGraph Workflow Design: `StateGraph` nodes are agents; edges define execution order; conditional edges decide whether to run context and rules.

Folder Structure: All new orchestration code lives under `src/services/orchestration`.

Shared State Design: Required public fields remain stable, with internal service inputs added beside them.

Agent Responsibilities: Each agent wraps one phase and returns a partial state update.

Step-by-Step Implementation: Add state, agents, workflow, service facade, CLI, webhook integration, and logger.

Production-Quality Code: Existing Phase 1-5 modules are reused rather than duplicated.

Testing Instructions: Run `node src/scripts/analyze-local-repo-with-langgraph.js . src/server.js --skip-ai`.

Common Errors + Fixes: If Gemini fails locally, use `--skip-ai` or add `GEMINI_API_KEY`.

Scalability Notes: New agents can be added as nodes without changing Phase 1-5 internals.

## Step 2 - Setup LangGraph.js and Shared State

Architecture Explanation: `pr-review.state.js` defines the graph contract using `Annotation.Root`.

Real-World Importance: Typed-like shared state keeps node handoffs explicit and predictable.

LangGraph Workflow Design: Most fields use replace semantics; `executionMetadata` uses a reducer for concurrent writes.

Folder Structure: State is isolated in `src/services/orchestration/graph`.

Shared State Design: The state includes repository inputs, review outputs, and execution metadata.

Agent Responsibilities: Agents read only what they need and return partial updates.

Step-by-Step Implementation: Install `@langchain/langgraph`, define defaults, define reducers, initialize input.

Production-Quality Code: Metadata reducer prevents parallel Context and Rule nodes from clobbering each other.

Testing Instructions: Run `node --check src/services/orchestration/graph/pr-review.state.js`.

Common Errors + Fixes: If concurrent update errors appear, add reducers for keys written by parallel nodes.

Scalability Notes: More parallel branches can safely report timings through the metadata reducer.

## Step 3 - Build Orchestrator Agent

Architecture Explanation: The Orchestrator Agent validates inputs and prepares execution metadata.

Real-World Importance: Bad webhook or local inputs fail early before scanning or AI calls.

LangGraph Workflow Design: This is the first graph node after `START`.

Folder Structure: `agents/orchestrator.agent.js`.

Shared State Design: Reads `repository`, `changedFiles`, and `options`; writes `executionMetadata`.

Agent Responsibilities: Validate source, changed files, and Gemini configuration when strict mode is enabled.

Step-by-Step Implementation: Check local/GitHub inputs and record options.

Production-Quality Code: Preserves safe AI failure behavior when `failOnAiReviewError` is false.

Testing Instructions: Run Phase 6 with `--skip-ai` to avoid credential dependency.

Common Errors + Fixes: Missing `repository.path` for local runs throws a clear Phase 6 error.

Scalability Notes: Future global policy checks belong here.

## Step 4 - Convert Phase 2 into Dependency Agent

Architecture Explanation: The Dependency Agent wraps scanning, dependency graph generation, and impact analysis.

Real-World Importance: Dependency impact determines review scope and blast radius.

LangGraph Workflow Design: Runs after the Orchestrator Agent and before all other analysis agents.

Folder Structure: `agents/dependency.agent.js`.

Shared State Design: Writes `scanResult`, internal `graph`, serializable `dependencyGraph`, `impact`, `affectedModules`, `routeProfile`, and `rulePolicy`.

Agent Responsibilities: Scan local/GitHub repos, build graph, detect affected modules, classify routing conditions.

Step-by-Step Implementation: Reuse scanners, `dependencyGraphService`, and `impactAnalysisService`.

Production-Quality Code: Keeps a serializable graph for reports and an internal Map-based graph for existing services.

Testing Instructions: Run `npm run phase6:local -- . src/server.js --skip-ai`.

Common Errors + Fixes: Missing GitHub installation input is rejected before API calls.

Scalability Notes: This node is the correct place to add dependency-cruiser or Tree-sitter replacement internals later.

## Step 5 - Convert Phase 3 into Context Agent

Architecture Explanation: The Context Agent wraps Chroma-backed semantic retrieval.

Real-World Importance: Review quality improves when AI sees nearby architectural context.

LangGraph Workflow Design: Runs conditionally when semantic context is enabled.

Folder Structure: `agents/context.agent.js`.

Shared State Design: Writes `context` and flattened `retrievedContext`.

Agent Responsibilities: Ensure repository indexing, retrieve semantic chunks, and safe-report Chroma errors.

Step-by-Step Implementation: Call `contextRetrievalService.retrieveForPullRequest`.

Production-Quality Code: Supports `failOnContextError` for CI strictness and safe local runs.

Testing Instructions: Run with `--with-rag --skip-ai`; start Chroma first for successful retrieval.

Common Errors + Fixes: If Chroma is not running, start `npm run chroma` or omit `--with-rag`.

Scalability Notes: Retrieval can later split into indexing and search nodes if needed.

## Step 6 - Convert Phase 4 into Rule Engine Agent

Architecture Explanation: The Rule Engine Agent wraps deterministic validation.

Real-World Importance: Rules catch repeatable problems cheaply before AI reasoning.

LangGraph Workflow Design: Runs in parallel with Context Agent after dependency analysis.

Folder Structure: `agents/rule-engine.agent.js`.

Shared State Design: Writes `validation` and `ruleFindings`.

Agent Responsibilities: Run rule validation with optional route-aware filters.

Step-by-Step Implementation: Extend `ruleEngineService.validatePullRequest` with optional rule category/id filters.

Production-Quality Code: Default Phase 4 behavior is unchanged when filters are not supplied.

Testing Instructions: Run with `--skip-ai` and confirm Phase 4 output still appears.

Common Errors + Fixes: If expected rules are missing, inspect `reviewSummary.routing.rulePolicy`.

Scalability Notes: Rule packs can be routed by category, id, layer, or risk profile.

## Step 7 - Convert Phase 5 into Review Agent

Architecture Explanation: The Review Agent wraps Gemini review generation.

Real-World Importance: AI review should consume dependency, context, and rule findings as inputs, not replace them.

LangGraph Workflow Design: Runs after Context and Rule Engine branches converge.

Folder Structure: `agents/review.agent.js`.

Shared State Design: Reads `context` and `validation`; writes `aiReview`.

Agent Responsibilities: Generate architecture-aware review or produce a safe failure report.

Step-by-Step Implementation: Call `aiReviewEngineService.generatePullRequestReview`.

Production-Quality Code: Maintains existing `failOnAiReviewError` behavior.

Testing Instructions: Use `--skip-ai` for offline runs or configure `GEMINI_API_KEY` for full runs.

Common Errors + Fixes: Missing Gemini key produces a safe failure report unless strict mode is enabled.

Scalability Notes: Additional model providers can be added inside the existing AI review service.

## Step 8 - Build Risk/Summary Agent

Architecture Explanation: The Risk/Summary Agent aggregates deterministic and AI review output.

Real-World Importance: Consumers need one final severity, confidence score, and action summary.

LangGraph Workflow Design: Runs after the Review Agent and before `END`.

Folder Structure: `agents/risk-summary.agent.js`.

Shared State Design: Writes `reviewSummary`, `severity`, and `confidence`.

Agent Responsibilities: Aggregate severities, compute confidence, summarize routing and findings.

Step-by-Step Implementation: Combine AI risk, rule severity, and dependency risk signals.

Production-Quality Code: Works with or without AI and RAG.

Testing Instructions: Confirm Phase 6 logger prints final severity and agent timings.

Common Errors + Fixes: If severity looks too low, inspect rule findings and risk signals in the JSON report.

Scalability Notes: Confidence scoring can evolve into a weighted policy module.

## Step 9 - Add Conditional Routing

Architecture Explanation: Routing profile detects frontend-only, backend-only, auth-sensitive, and broad-impact changes.

Real-World Importance: Routing reduces noisy checks and highlights high-risk security review paths.

LangGraph Workflow Design: Conditional edges decide whether Context and Rule nodes run; rule policy controls category execution.

Folder Structure: `utils/routing-profile.util.js`.

Shared State Design: Writes `routeProfile` and `rulePolicy`.

Agent Responsibilities: Dependency Agent computes route profile; Rule and Review agents consume it.

Step-by-Step Implementation: Classify changed files and build rule exclusions.

Production-Quality Code: Frontend-only PRs skip backend rule category; auth-sensitive PRs add a high-risk security signal.

Testing Instructions: Run with different changed file paths and inspect `reviewSummary.routing`.

Common Errors + Fixes: Misclassified files usually need path convention updates in routing profile helpers.

Scalability Notes: Route policies can grow into config-driven review profiles.

## Step 10 - Add Parallel Execution Optimization

Architecture Explanation: Context and Rule Engine branches run after dependency analysis without waiting on each other.

Real-World Importance: RAG retrieval can be slow; rules can finish independently.

LangGraph Workflow Design: Dependency Agent conditionally fans out to both nodes; both edges converge at Review Agent.

Folder Structure: Parallel behavior is declared in `graph/pr-review.workflow.js`.

Shared State Design: Parallel nodes write different output fields and merge metadata with a reducer.

Agent Responsibilities: Context writes retrieval state; Rule Engine writes validation state.

Step-by-Step Implementation: Add two outgoing conditional targets from dependency and converge on review.

Production-Quality Code: `executionMetadata` reducer avoids concurrent write conflicts.

Testing Instructions: Run `npm run phase6:local -- . src/server.js --with-rag --skip-ai`.

Common Errors + Fixes: Concurrent state key conflicts mean a reducer is missing.

Scalability Notes: More independent analysis nodes can join the same fan-out pattern.

## Step 11 - Build Final Orchestration Workflow

Architecture Explanation: `pr-review-orchestrator.service.js` exposes local and GitHub entry points.

Real-World Importance: Webhooks and CLI tests use the same production graph.

LangGraph Workflow Design: The compiled graph is invoked through one service facade.

Folder Structure: Service lives at `src/services/orchestration/pr-review-orchestrator.service.js`.

Shared State Design: Initial state is normalized once, then final state becomes a structured report.

Agent Responsibilities: Service does not perform phase logic; it invokes the graph.

Step-by-Step Implementation: Add `reviewPullRequest`, `reviewLocalRepository`, and `invoke`.

Production-Quality Code: Final report preserves `graph`, `impact`, `context`, `validation`, and `aiReview` fields used by old loggers.

Testing Instructions: Webhook path now calls the Phase 6 orchestrator.

Common Errors + Fixes: If old loggers fail, confirm final report still exposes Phase 2-5 fields.

Scalability Notes: API controllers can later return or persist the Phase 6 report directly.

## Step 12 - Add Testing and Debugging Support

Architecture Explanation: The local script and Phase 6 logger make graph execution visible.

Real-World Importance: Students and interviewers can run the system on a laptop without a webhook.

LangGraph Workflow Design: The same compiled graph powers local and webhook workflows.

Folder Structure: CLI script is `src/scripts/analyze-local-repo-with-langgraph.js`.

Shared State Design: Use `--json` to inspect the full final state-derived report.

Agent Responsibilities: Each agent records timing and status in `executionMetadata`.

Step-by-Step Implementation: Add `phase6:local` script, Phase 6 logger, and JSON output.

Production-Quality Code: Safe modes allow testing without Chroma or Gemini.

Testing Instructions: `node src/scripts/analyze-local-repo-with-langgraph.js . src/server.js --skip-ai --json`.

Common Errors + Fixes: NPM may warn about unknown flags; direct `node` invocation avoids that warning.

Scalability Notes: Metadata can be persisted later for observability, audit trails, and review analytics.
