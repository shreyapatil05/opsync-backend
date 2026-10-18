import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUsername, publicAccount } from '../services/accountService.js';

test('normalizes usernames to the accepted public format', () => {
  assert.equal(normalizeUsername('  Shreya Kumar!  '), 'shreya_kumar');
  assert.equal(normalizeUsername('A___B'), 'a_b');
});

test('public account never returns password or avatar provider identifiers', () => {
  const account = publicAccount({
    _id: 'user-id', name: 'User', email: 'user@example.com', role: 'Employee',
    password: 'secret', avatarPublicId: 'provider-secret', emailVerified: false,
  });
  assert.equal(account.id, 'user-id');
  assert.equal(account.status, 'active');
  assert.equal('password' in account, false);
  assert.equal('avatarPublicId' in account, false);
});
