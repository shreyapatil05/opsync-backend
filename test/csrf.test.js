import test from 'node:test';
import assert from 'node:assert/strict';
import { csrfProtection } from '../middlewares/csrf.js';

const run = ({ method = 'POST', cookieToken, headerToken }) => {
  let status;
  let payload;
  let nextCalled = false;
  const req = {
    method,
    cookies: { csrfToken: cookieToken },
    get: name => name === 'x-csrf-token' ? headerToken : undefined,
  };
  const res = {
    status: code => { status = code; return res; },
    json: body => { payload = body; return res; },
  };
  csrfProtection(req, res, () => { nextCalled = true; });
  return { status, payload, nextCalled };
};

test('allows safe HTTP methods without a token', () => {
  assert.equal(run({ method: 'GET' }).nextCalled, true);
});

test('allows a state-changing request with matching tokens', () => {
  assert.equal(run({ cookieToken: 'a'.repeat(64), headerToken: 'a'.repeat(64) }).nextCalled, true);
});

test('rejects a state-changing request with missing or mismatched tokens', () => {
  assert.equal(run({}).status, 403);
  assert.equal(run({ cookieToken: 'a'.repeat(64), headerToken: 'b'.repeat(64) }).status, 403);
});
