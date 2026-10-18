import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFileSignature } from '../middlewares/fileSignature.js';

const invoke = file => {
  let status;
  let payload;
  let nextCalled = false;
  const res = { status(value) { status = value; return this; }, json(value) { payload = value; return this; } };
  validateFileSignature({ file }, res, () => { nextCalled = true; });
  return { status, payload, nextCalled };
};

test('accepts a matching PNG signature', () => {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(invoke({ mimetype: 'image/png', buffer }).nextCalled, true);
});

test('rejects content that does not match the MIME type', () => {
  const result = invoke({ mimetype: 'image/png', buffer: Buffer.from('not an image') });
  assert.equal(result.status, 415);
  assert.equal(result.payload.error.code, 'INVALID_FILE_CONTENT');
});

test('requires an uploaded file', () => {
  assert.equal(invoke(undefined).status, 400);
});
