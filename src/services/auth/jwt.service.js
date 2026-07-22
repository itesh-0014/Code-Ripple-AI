import crypto from 'crypto';
import { config } from '../../config/env.js';

export function signSession(payload, {
  secret = config.dashboard.jwtSecret,
  ttlSeconds = config.dashboard.sessionTtlSeconds,
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode({
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  });
  const signature = sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifySession(token, { secret = config.dashboard.jwtSecret } = {}) {
  const [header, body, signature] = String(token || '').split('.');

  if (!header || !body || !signature) {
    throw sessionError('Invalid session token.', 'INVALID_SESSION');
  }

  const expected = sign(`${header}.${body}`, secret);
  const valid =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!valid) {
    throw sessionError('Invalid session signature.', 'INVALID_SESSION');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw sessionError('Session has expired.', 'SESSION_EXPIRED');
  }

  return payload;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function sessionError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
