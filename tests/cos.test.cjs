const test = require('node:test');
const assert = require('node:assert/strict');
const { uploadToCos } = require('../src/cos.js');

test('uploads original bytes only to COS with temporary credentials', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\n%%EOF').buffer;
  const credential = { secret_id: 'sid', secret_key: 'skey', token: 'temp-token', bucket_name: 'bucket', region: 'ap-test', cos_key: 'paper.pdf', start_time: 1000, expired_time: 2000 };
  let request;
  await uploadToCos(bytes, credential, 'application/pdf', async (url, init) => {
    request = { url, init };
    return { ok: true, status: 200 };
  });
  assert.equal(request.url, 'https://bucket.cos.ap-test.myqcloud.com/paper.pdf');
  assert.equal(request.init.method, 'PUT');
  assert.equal(request.init.body, bytes);
  assert.equal(request.init.headers['x-cos-security-token'], 'temp-token');
  assert.match(request.init.headers.Authorization, /q-sign-algorithm=sha1/);
});

test('COS rejection stops upload', async () => {
  const credential = { secret_id: 'sid', secret_key: 'skey', bucket_name: 'bucket', region: 'ap-test', cos_key: 'paper.pdf' };
  await assert.rejects(uploadToCos(new ArrayBuffer(8), credential, 'application/pdf', async () => ({ ok: false, status: 403, text: async () => 'Forbidden' })), /403/);
});
