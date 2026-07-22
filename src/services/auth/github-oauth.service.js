import crypto from 'crypto';
import { config } from '../../config/env.js';
import { githubUserStore } from './github-user.store.js';
import { signSession } from './jwt.service.js';

const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;
const GITHUB_REQUEST_TIMEOUT_MS = 15000;

export class GitHubOAuthService {
  isConfigured() {
    return Boolean(config.github.oauthClientId && config.github.oauthClientSecret);
  }

  createAuthorizationUrl() {
    if (!this.isConfigured()) {
      throw oauthError('GitHub OAuth is not configured.', 'GITHUB_OAUTH_NOT_CONFIGURED');
    }

    this.cleanupStates();
    const state = crypto.randomBytes(24).toString('hex');
    pendingStates.set(state, Date.now());
    console.log('[OAuth] OAuth started: state created, redirecting to GitHub');
    const params = new URLSearchParams({
      client_id: config.github.oauthClientId,
      redirect_uri: config.github.oauthCallbackUrl,
      scope: 'read:user user:email repo',
      state,
    });

    return {
      state,
      url: `https://github.com/login/oauth/authorize?${params}`,
    };
  }

  async completeAuthorization({ code, state }) {
    console.log('[OAuth] OAuth callback hit');
    if (!code) {
      throw oauthError('GitHub OAuth callback did not include a code.', 'GITHUB_CODE_MISSING');
    }

    const issuedAt = pendingStates.get(state);
    pendingStates.delete(state);

    if (!issuedAt || Date.now() - issuedAt > STATE_TTL_MS) {
      console.warn('[OAuth] OAuth state validation failed');
      throw oauthError('OAuth state is invalid or expired.', 'INVALID_OAUTH_STATE');
    }

    console.log('[OAuth] OAuth state validated; exchanging code for access token');
    const tokenResponse = await fetchWithTimeout('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.oauthClientId,
        client_secret: config.github.oauthClientSecret,
        code,
        redirect_uri: config.github.oauthCallbackUrl,
      }),
    });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
      throw oauthError(
        tokenData.error_description || 'GitHub OAuth token exchange failed.',
        'GITHUB_TOKEN_EXCHANGE_FAILED'
      );
    }

    console.log('[OAuth] Access token received');
    console.log('[OAuth] Fetching GitHub user profile');
    const userResponse = await fetchWithTimeout('https://api.github.com/user', {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${tokenData.access_token}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    const githubUser = await userResponse.json();

    if (!userResponse.ok) {
      throw oauthError('Failed to load the GitHub profile.', 'GITHUB_PROFILE_FAILED');
    }

    console.log(`[OAuth] GitHub user fetched: ${githubUser.login}`);
    const user = await githubUserStore.upsertFromGitHubProfile(githubUser, {
      accessToken: tokenData.access_token,
    });
    console.log(`[OAuth] User saved: ${user.login}`);

    const token = signSession({
      sub: user.id,
      user,
    });
    console.log('[OAuth] JWT generated');

    return {
      user,
      token,
    };
  }

  cleanupStates() {
    const cutoff = Date.now() - STATE_TTL_MS;
    for (const [state, createdAt] of pendingStates.entries()) {
      if (createdAt < cutoff) pendingStates.delete(state);
    }
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw oauthError('GitHub OAuth request timed out.', 'GITHUB_OAUTH_TIMEOUT');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function oauthError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export const githubOAuthService = new GitHubOAuthService();
