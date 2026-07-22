# Phase 9 - GitHub Review Integration Layer

## Architecture Design

Phase 9 adds a final GitHub Integration Agent to the existing LangGraph review workflow. The review pipeline still owns analysis, risk scoring, confidence, and smart review planning; the new layer only formats, publishes, and persists the final state.

Workflow:

PR Event -> Planner Agent -> Dependency Agent -> Context Agent -> Rule Agent -> Review Agent -> Architecture Agent -> Risk Intelligence Agent -> Smart Review Agent -> Risk Summary Agent -> GitHub Integration Agent -> Publish Review -> Store History -> Completed

## Folder Structure

- `src/services/github/githubClient.js`: GitHub App installation client, PR comments, check runs.
- `src/services/github/reviewPublisher.js`: end-to-end publishing coordinator.
- `src/services/github/commentFormatter.js`: markdown review comments, summary comments, risk/confidence badges, check payloads.
- `src/services/summary/summaryGenerator.js`: executive PR summary generation.
- `src/services/history/reviewHistoryService.js`: MongoDB persistence for `review_history`.
- `src/services/orchestration/agents/github-integration.agent.js`: LangGraph integration agent.

## GitHub App Setup

Use a GitHub App, not a personal access token.

Required env:

- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY_PATH` or `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `MONGODB_URI`
- `MONGODB_DATABASE`

Required GitHub App permissions:

- Pull requests: read
- Contents: read
- Issues: write
- Checks: write
- Metadata: read

Subscribe to:

- `pull_request`
- `installation`
- `installation_repositories`

## GitHub Client Layer

`GitHubClient` creates installation-scoped Octokit clients via `App.getInstallationOctokit`. It supports:

- Updating or creating marker-based PR comments.
- Creating completed check runs for the PR head SHA.
- Classifying invalid installation, missing permission, validation, rate-limit, and API failures.

## Review Publisher

`ReviewPublisher` receives final graph state and publishes:

- Main review comment.
- Executive summary comment.
- GitHub check run.
- MongoDB review history record.

Hidden markdown markers prevent duplicate comments. New analyses update the existing GitSense comments.

## Check Runs Integration

Risk mapping:

- `LOW` -> `PASSED` / `success`
- `MEDIUM` -> `WARNING` / `neutral`
- `HIGH` -> `FAILED` / `failure`
- `CRITICAL` -> `CRITICAL` / `failure`

## MongoDB Schema

Collection: `review_history`

```json
{
  "prNumber": 42,
  "repository": "owner/repo",
  "riskScore": 8.9,
  "confidence": 92,
  "severity": "CRITICAL",
  "summary": {},
  "createdAt": "2026-06-05T00:00:00.000Z"
}
```

## LangGraph State Updates

The graph now carries:

- `reviewComment`
- `summaryComment`
- `checkRunStatus`
- `checkRun`
- `reviewHistoryId`
- `githubPublicationStatus`
- `githubPublication`
- `githubPublicationError`

## Testing Strategy

- Unit-test formatter output and check-run risk mapping.
- Unit-test publisher behavior with fake GitHub and history clients.
- Run `npm test` for existing risk and smart-review coverage.
- For GitHub App integration, test against a sandbox repository with a real installation ID and webhook delivery.
