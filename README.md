# Code Ripple AI

Code Ripplee AI is a Node.js service for analyzing repositories and pull requests. It combines repository scanning, dependency graphing, rule-based validation, semantic retrieval with ChromaDB, and Gemini-powered AI review.

## Features

- GitHub webhook server for pull request events.
- Local repository analysis from the command line.
- Dependency graph and impact analysis for changed files.
- Rule engine checks for backend, frontend, and general code quality patterns.
- RAG indexing and semantic search over repository files.
- Gemini-based AI review summaries and remediation suggestions.
- Adaptive LangGraph-based Phase 6 orchestration with planner, routing, reflection, and specialized review agents.
- React SaaS dashboard with review history, analytics, architecture insights, and dependency visualization.

## Tech Stack

- Node.js with Express
- ES modules
- GitHub App integration via Octokit
- ChromaDB for vector storage
- Gemini and OpenAI-compatible embedding configuration

## Prerequisites

- Node.js 18 or newer
- npm
- Python 3.10 or newer, only if running ChromaDB locally
- A GitHub App, only if using webhook-based PR analysis
- A Gemini API key, only if using Phase 5 AI review

## Setup

Install Node dependencies:

```bash
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

If you plan to run ChromaDB locally, install the Python dependency:

```bash
pip install -r requirements.txt
```

## Environment

The main environment variables are listed in `.env.example`.

Required for the server:

```env
PORT=3000
```

Required for GitHub webhook processing:

```env
GITHUB_APP_ID=
GITHUB_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=
```

Required for Gemini AI review:

```env
GEMINI_API_KEY=
GEMINI_REVIEW_MODEL=gemini-3.5-flash
```

Optional for RAG embeddings:

```env
RAG_ENABLED=false
RAG_EMBEDDING_PROVIDER=local
OPENAI_API_KEY=
GEMINI_API_KEY=
```

## Run The Server

Start the development server:

```bash
npm run dev
```

Start the production-style server:

```bash
npm start
```

Start the Phase 11 dashboard:

```bash
npm run frontend:dev
```

The frontend runs at `http://localhost:5173`. Set `DASHBOARD_DEMO_MODE=true` for
an immediately usable local workspace without MongoDB or GitHub OAuth.

Health check:

```text
GET http://localhost:3000/health
```

## API Routes

Webhook test:

```text
GET /api/webhooks/test
```

GitHub webhook receiver:

```text
POST /api/webhooks/github
```

Index a local repository for semantic search:

```text
POST /api/rag/local/index
```

Request body:

```json
{
  "repositoryPath": "C:/path/to/repository"
}
```

Search a local repository:

```text
POST /api/rag/local/search
```

Request body:

```json
{
  "repositoryPath": "C:/path/to/repository",
  "query": "Where is authentication handled?",
  "limit": 8,
  "refreshIndex": true
}
```

## Local Analysis Commands

Phase 2 repository intelligence:

```bash
npm run phase2:local -- <repository-path> <changed-file> [more-changed-files]
```

Phase 3 RAG analysis:

```bash
npm run phase3:local -- <repository-path> <changed-file> [more-changed-files]
```

Phase 4 rule validation:

```bash
npm run phase4:local -- <repository-path> <changed-file> [more-changed-files] [--with-rag]
```

Phase 5 AI review:

```bash
npm run phase5:local -- <repository-path> <changed-file> [more-changed-files] [--with-rag]
```

Phase 6 LangGraph orchestration:

```bash
npm run phase6:local -- <repository-path> <changed-file> [more-changed-files] [--with-rag] [--skip-ai] [--json]
```

Direct Node invocation avoids npm flag warnings:

```bash
node src/scripts/analyze-local-repo-with-langgraph.js <repository-path> <changed-file> [--skip-ai] [--json]
```

See `docs/phase6-langgraph-orchestration.md` and `docs/adaptive-autonomous-orchestration.md` for the full architecture walkthrough.
See `docs/phase11-dashboard-saas-experience.md` for dashboard architecture,
authentication flow, API routes, and frontend setup.

## RAG And ChromaDB

Start ChromaDB locally:

```bash
npm run chroma
```

If the Python CLI is not available, try the Node script:

```bash
npm run chroma:node
```

Index a repository:

```bash
npm run phase3:index -- <repository-path>
```

Run semantic search:

```bash
npm run phase3:search -- <repository-path> "Where is request validation done?"
```

## GitHub App Webhook Flow

1. Configure a GitHub App with pull request webhooks.
2. Set `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET`, and either `GITHUB_PRIVATE_KEY_PATH` or `GITHUB_PRIVATE_KEY`.
3. Expose the local server with a tunnel such as ngrok.
4. Point the GitHub webhook URL to:

```text
https://<your-tunnel-url>/api/webhooks/github
```

The server handles `ping`, `installation`, `installation_repositories`, and `pull_request` events. Pull request events trigger the Phase 6 LangGraph orchestrator, which coordinates dependency analysis, optional semantic context, rule validation, AI review, and risk summary generation.

## Notes

- Secrets, private keys, local vector data, virtual environments, and `node_modules` are intentionally ignored by git.
- The current `npm test` script is a placeholder and does not run an automated test suite yet.
