import { config } from '../config/env.js';
import { demoUser } from '../services/dashboard/demo-dashboard.data.js';
import { verifySession } from '../services/auth/jwt.service.js';

export function attachSession(req, _res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (token) {
    try {
      req.user = verifySession(token).user;
    } catch (error) {
      req.sessionError = error;
    }
  } else if (config.dashboard.demoMode) {
    req.user = demoUser;
  }

  next();
}

export function requireSession(req, res, next) {
  if (req.user) return next();

  return res.status(401).json({
    success: false,
    message: req.sessionError?.message || 'Authentication required.',
    code: req.sessionError?.code || 'AUTHENTICATION_REQUIRED',
  });
}
