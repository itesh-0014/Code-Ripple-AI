# Phase 8 - Smart Review Mode

## Goal

Phase 8 turns GitSense AI from "review everything equally" into "review what matters most first." It keeps the previous phases intact and adds deterministic review prioritization after risk intelligence has calculated the final risk and confidence signals.

## Workflow

```text
PR Event
  -> Planner Agent
  -> Dependency Agent
  -> Context Agent
  -> Rule Agent
  -> Review Agent
  -> Architecture Agent
  -> Risk Intelligence Agent
  -> Smart Review Agent
  -> Summary Agent
  -> Final Report
```

## Folder Structure

```text
src/services/smart-review/
  smartReviewEngine.js
  reviewPlanner.js
  reviewStrategies.js
  prioritization/
    prioritizationEngine.js
    fileScorer.js
  criticality/
    criticalityEngine.js
  hotspots/
    hotspotDetector.js
  budget/
    reviewBudgetEngine.js

src/services/orchestration/agents/
  smart-review.agent.js
```

## Engines

`smartReviewEngine.js` is the top-level entry point. It builds a complete smart review plan from graph state.

`reviewPlanner.js` coordinates size classification, review mode selection, file prioritization, criticality scoring, hotspot detection, and budget allocation.

`reviewStrategies.js` defines deterministic size bands:

- Small: 1-10 files -> `FULL REVIEW`
- Medium: 11-30 files -> `PRIORITIZED REVIEW`
- Large: 31+ files -> `RISK-FIRST REVIEW`

`prioritization/fileScorer.js` scores every changed file with explainable factors:

- Repository layer
- Dependency count
- Architectural impact
- Rule and AI findings
- Historical criticality from `options.historicalCriticality`

`criticality/criticalityEngine.js` maps scores to `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL`.

`hotspots/hotspotDetector.js` detects highly connected modules, middleware, authentication systems, and core infrastructure modules.

`budget/reviewBudgetEngine.js` allocates review depth:

- Small PR: deep review every file
- Medium PR: deep review high and critical files, standard review the rest
- Large PR: deep review top 20% up to 20 files, standard review next 30% up to 30 files, light review the remainder

## LangGraph State Additions

```js
{
  reviewMode,
  prioritizedFiles,
  hotspots,
  reviewBudget,
  criticalFiles,
  smartReview
}
```

## Example Large PR Execution

For a 100-file PR:

```js
{
  reviewMode: 'RISK-FIRST REVIEW',
  reviewBudget: {
    deepReview: ['top 20 files'],
    standardReview: ['next 30 files'],
    lightReview: ['remaining 50 files']
  }
}
```

Example prioritized files:

```js
[
  {
    file: 'src/auth/jwt.middleware.js',
    score: 90,
    criticality: 'CRITICAL'
  },
  {
    file: 'src/database/user.model.js',
    score: 54,
    criticality: 'MEDIUM'
  },
  {
    file: 'src/components/Navbar.jsx',
    score: 8,
    criticality: 'LOW'
  }
]
```

## Final Report Additions

The final report now includes:

- `reviewMode`
- `prioritizedFiles`
- `criticalFiles`
- `hotspots`
- `reviewBudget`
- `smartReview`

The summary also exposes:

- Deep review files
- Standard review files
- Light review files
- Architectural hotspots

## Testing Strategy

Unit tests cover:

- Small, medium, and large PR mode selection
- Large PR review budget allocation
- Deterministic scoring for identical input
- Traceable factor evidence
- Hotspot detection for authentication and highly connected modules

Run with:

```bash
npm test
```

