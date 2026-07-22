  # Run GitSense AI

  ## Required Environment

  Backend `.env`:

  ```env
  PORT=3000
  MONGODB_URI=<mongodb-atlas-uri>
  MONGODB_DATABASE=gitsense
  GITHUB_OAUTH_CLIENT_ID=<github-oauth-client-id>
  GITHUB_OAUTH_CLIENT_SECRET=<github-oauth-client-secret>
  GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
  FRONTEND_URL=http://localhost:5173
  JWT_SECRET=<long-random-secret>
  JWT_TTL_SECONDS=28800
  DASHBOARD_DEMO_MODE=false
  ```

  Frontend environment is optional because the code defaults to the local backend. If you create `frontend/.env`, use:

  ```env
  VITE_API_URL=http://localhost:3000/api
  ```

  ## GitHub Configuration

  GitHub OAuth App:

  - Homepage URL: `http://localhost:5173`
  - Authorization callback URL: `http://localhost:3000/api/auth/github/callback`

  GitHub App webhooks are separate from OAuth login:

  - Webhook URL: `https://<your-tunnel>/api/webhooks/github`

  ## Start Backend

  From the project root:

  ```powershell
  npm install
  npm start
  ```

  Expected backend logs:

  ```text
  MongoDB connected successfully: gitsense (...)
  GitSense AI Server running on port 3000
  Health Check: http://localhost:3000/health
  ```

  Check health:

  ```powershell
  Invoke-RestMethod http://localhost:3000/health
  ```

  Expected result:

  ```text
  success: true
  database.connected: true
  database.database: gitsense
  ```

  ## Start Frontend

  In a second terminal:

  ```powershell
  npm run frontend:dev
  ```

  Expected frontend URL:

  ```text
  http://localhost:5173
  ```

  ## OAuth Test Procedure

  1. Open `http://localhost:5173/login`.
  2. Click "Continue with GitHub".
  3. Browser should open GitHub authorization.
  4. Authorize the app.
  5. GitHub should redirect to:

  ```text
  http://localhost:3000/api/auth/github/callback?code=...&state=...
  ```

  6. Backend should log:

  ```text
  [OAuth] OAuth started: state created, redirecting to GitHub
  [OAuth] OAuth callback hit
  [OAuth] OAuth state validated; exchanging code for access token
  [OAuth] Access token received
  [OAuth] Fetching GitHub user profile
  [OAuth] GitHub user fetched: <login>
  [OAuth] User saved: <login>
  [OAuth] JWT generated
  [OAuth] Redirecting to frontend: http://localhost:5173/auth/callback#token=<redacted>
  ```

  7. Browser should land on:

  ```text
  http://localhost:5173/
  ```

  8. Dashboard API calls should include:

  ```text
  Authorization: Bearer <jwt>
  ```

  ## Verify Mongo User

  Use MongoDB Atlas Data Explorer or `mongosh`:

  ```javascript
  use gitsense
  db.users.find(
    { provider: "github" },
    { login: 1, githubId: 1, email: 1, lastLoginAt: 1, createdAt: 1 }
  ).sort({ lastLoginAt: -1 }).limit(5)
  ```

  Expected result:

  ```text
  At least one document for the GitHub account used to log in.
  ```

  ## Verify JWT Session

  After login, open browser dev tools:

  1. Go to Application or Storage.
  2. Check Local Storage for `gitsense-auth`.
  3. Confirm it contains a non-empty `token`.
  4. Refresh `http://localhost:5173/`.
  5. Dashboard should stay loaded.

  ## Troubleshooting

  `INVALID_OAUTH_STATE`:

  - Start login again from `http://localhost:5173/login`.
  - Do not restart the backend between the login click and GitHub authorization.
  - Make sure only one backend instance is handling both `/api/auth/github` and `/api/auth/github/callback`.

  `GITHUB_TOKEN_EXCHANGE_FAILED`:

  - Confirm the OAuth App callback URL is exactly `http://localhost:3000/api/auth/github/callback`.
  - Confirm `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` belong to the same OAuth App.
  - GitHub authorization codes are one-time use; start a new login attempt.

  Redirects to login instead of dashboard:

  - Read the `error` and `message` query params on `/login`.
  - Check backend logs for the matching `[OAuth] OAuth failed: ...` line.

  Dashboard redirects back to login:

  - Confirm the frontend callback URL is `/auth/callback#token=...`.
  - Confirm Local Storage contains `gitsense-auth`.
  - Confirm `JWT_SECRET` did not change between token creation and API requests.

  Mongo user missing:

  - Set `DASHBOARD_DEMO_MODE=false`.
  - Confirm `/health` reports `database.connected: true`.
  - Complete a fresh successful OAuth login.
  - Query `db.users.find({ provider: "github" })`.
