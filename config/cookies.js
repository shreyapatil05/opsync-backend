const secureCookies = process.env.COOKIE_SECURE === 'true';

export const authCookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: secureCookies ? 'none' : 'lax',
  path: '/',
};

export const csrfCookieOptions = {
  ...authCookieOptions,
  maxAge: 2 * 60 * 60 * 1000,
};

export const accessCookieOptions = {
  ...authCookieOptions,
  maxAge: 15 * 60 * 1000,
};

export const refreshCookieOptions = {
  ...authCookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
