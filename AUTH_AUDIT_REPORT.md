# GitSense AI Authentication Audit Report

## Root Cause

The OAuth callback route was registered correctly, but the happy-path callback did not persist the authenticated GitHub user to MongoDB before signing the dashboard session. The backend created an in-memory user object, signed a JWT, and redirected to the frontend. This meant the requested "user stored in MongoDB" part of the flow never happened, and `DASHBOARD_DEMO_MODE=true` in `.env` could mask the problem by allowing dashboard APIs to fall back to demo behavior.

The callback also had very little diagnostic output, so failures during state validation, GitHub token exchange, GitHub profile fetch, JWT creation, or frontend redirect were not visible from the logs.

## Files Inspected

- `src/routes/auth.routes.js`
- `src/controllers/auth.controller.js`
- `src/services/auth/github-oauth.service.js`
- `src/services/auth/jwt.service.js`
- `src/middleware/session.middleware.js`
- `src/server.js`
- `src/config/env.js`
- `src/config/database.js`
- `src/routes/dashboard.routes.js`
- `src/controllers/dashboard.controller.js`
- `src/services/dashboard/dashboard.service.js`
- `frontend/src/api/client.ts`
- `frontend/src/api/auth.ts`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/AuthCallbackPage.tsx`
- `frontend/src/routes/AppRoutes.tsx`
- `.env`
- `.env.example`
- `frontend/.env.example`

## Files Modified

- `src/controllers/auth.controller.js`
- `src/services/auth/github-oauth.service.js`
- `src/services/auth/github-user.store.js`
- `src/server.js`
- `frontend/src/pages/AuthCallbackPage.tsx`
- `AUTH_AUDIT_REPORT.md`
- `RUN_APPLICATION.md`

## Fixes Applied

- Added a Mongo-backed GitHub user store at `src/services/auth/github-user.store.js`.
- Updated the OAuth callback service to upsert the GitHub user into the `users` collection before JWT generation.
- Added OAuth debug logs for:
  - OAuth started
  - OAuth callback hit
  - state validation
  - access token received
  - GitHub user fetched
  - user saved
  - JWT generated
  - redirecting to frontend
- Added timeout handling for GitHub token/profile HTTP calls.
- Added explicit CORS configuration for `FRONTEND_URL`.
- Made the frontend auth callback accept the existing `#token=` contract and also tolerate `?token=`.

## Current Flow

1. User clicks "Continue with GitHub" on `http://localhost:5173/login`.
2. Frontend navigates to `http://localhost:3000/api/auth/github`.
3. Backend creates an OAuth state and redirects to GitHub.
4. GitHub redirects to `http://localhost:3000/api/auth/github/callback?code=...&state=...`.
5. Backend validates state.
6. Backend exchanges the code for a GitHub access token.
7. Backend fetches the GitHub user profile.
8. Backend upserts the user into MongoDB collection `users`.
9. Backend signs a JWT.
10. Backend redirects to `http://localhost:5173/auth/callback#token=...`.
11. Frontend stores the token in Zustand persistent storage.
12. Frontend navigates to `/`, which renders the dashboard.
13. Dashboard API calls send `Authorization: Bearer <jwt>`.

## Environment Findings

- `GITHUB_OAUTH_CLIENT_ID`: configured.
- `GITHUB_OAUTH_CLIENT_SECRET`: configured.
- `GITHUB_OAUTH_CALLBACK_URL`: configured as `http://localhost:3000/api/auth/github/callback`.
- `FRONTEND_URL`: configured as `http://localhost:5173`.
- `JWT_SECRET`: configured.
- `MONGODB_URI`: configured and connects successfully.
- `DASHBOARD_DEMO_MODE`: currently `true`. For real OAuth verification, set this to `false` so demo fallback does not hide authentication or data issues.

GitHub OAuth App settings should match:

- Homepage URL: `http://localhost:5173`
- Authorization callback URL: `http://localhost:3000/api/auth/github/callback`

GitHub App webhook settings are separate from OAuth login. The webhook URL should remain pointed at `/api/webhooks/github` when testing PR review webhooks.

## Verification Results

- Backend tests: PASS (`npm test`)
- Frontend production build/typecheck: PASS (`npm run frontend:build`)
- Backend health endpoint: PASS
- MongoDB connection: PASS
- Frontend dev server: PASS
- OAuth start redirect to GitHub: PASS
- Callback route failure redirect with fake code: PASS
- Real browser GitHub authorization: NOT EXECUTED in shell, because it requires an interactive GitHub browser session and one-time authorization code.
- Mongo user persistence on real successful OAuth: code path implemented; verify after browser login with the MongoDB query in `RUN_APPLICATION.md`.

## Remaining Risks

- OAuth state is still stored in process memory. A backend restart between login start and callback, or multiple backend instances without sticky sessions, will cause `INVALID_OAUTH_STATE`.
- The app currently stores the JWT in browser local storage through Zustand persistence. This matches the existing architecture, but an httpOnly cookie would reduce token exposure to injected scripts.
- `.env` currently has `DASHBOARD_DEMO_MODE=true`; use `false` for real integration testing.
