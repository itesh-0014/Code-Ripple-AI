import { config } from '../config/env.js';
import { githubOAuthService } from '../services/auth/github-oauth.service.js';
import { signSession } from '../services/auth/jwt.service.js';
import { demoUser } from '../services/dashboard/demo-dashboard.data.js';

export function startGitHubOAuth(_req, res, next) {
  try {
    if (!githubOAuthService.isConfigured() && config.dashboard.demoMode) {
      console.log('[OAuth] OAuth started in demo mode');
      const token = signSession({ sub: demoUser.id, user: demoUser });
      console.log(`[OAuth] Demo JWT generated, length=${token.length}`);
      const redirectUrl = buildFrontendCallbackUrl(token);
      console.log(`[OAuth] Redirecting to frontend: ${safeRedirectUrl(redirectUrl)}`);
      return res.redirect(redirectUrl);
    }

    const authorization = githubOAuthService.createAuthorizationUrl();
    return res.redirect(authorization.url);
  } catch (error) {
    return next(error);
  }
}

export async function completeGitHubOAuth(req, res) {
  try {
    const result = await githubOAuthService.completeAuthorization(req.query);
    console.log(`[OAuth] Session JWT received by controller, length=${String(result.token || '').length}`);
    const redirectUrl = buildFrontendCallbackUrl(result.token);
    console.log(`[OAuth] Redirecting to frontend: ${safeRedirectUrl(redirectUrl)}`);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error(`[OAuth] OAuth failed: ${error.code || 'GITHUB_OAUTH_FAILED'} - ${error.message}`);
    const params = new URLSearchParams({
      error: error.code || 'GITHUB_OAUTH_FAILED',
      message: error.message,
    });
    return res.redirect(`${config.dashboard.frontendUrl}/login?${params}`);
  }
}

function buildFrontendCallbackUrl(token) {
  if (!token) {
    throw new Error('OAuth completed, but no session token was generated.');
  }

  const url = new URL('/auth/callback', config.dashboard.frontendUrl);
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

function safeRedirectUrl(url) {
  return url.replace(/token=[^&]*/, 'token=<redacted>');
}
