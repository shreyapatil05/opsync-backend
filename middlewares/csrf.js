import crypto from 'crypto';
import { csrfCookieOptions } from '../config/cookies.js';

const COOKIE_NAME = 'csrfToken';

export const issueCsrfToken = (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE_NAME, token, csrfCookieOptions);
  res.json({ csrfToken: token });
};

export const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies[COOKIE_NAME];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: { code: 'CSRF_TOKEN_MISSING', message: 'CSRF token is required' } });
  }

  const left = Buffer.from(cookieToken);
  const right = Buffer.from(headerToken);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return res.status(403).json({ error: { code: 'CSRF_TOKEN_INVALID', message: 'Invalid CSRF token' } });
  }
  next();
};
