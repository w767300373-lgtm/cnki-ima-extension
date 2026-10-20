const test = require('node:test');
const assert = require('node:assert/strict');
const { streamPdf } = require('../src/page-content.js');
const { decodeChunk, joinChunks } = require('../src/transfer.js');

const page = 'https://kns.cnki.net/kcms2/article/abstract?v=example';
const url = 'https://kns.cnki.net/download/pdf?token=private';
const bytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');

test('same-origin article session streams validated PDF without saving a file', async () => {
  const messages = [];
  const port = { postMessage: message => messages.push(message) };
  await streamPdf(url, page, port, async (_url, init) => {
    assert.equal(init.credentials, 'include');
    return { ok: true, url, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer };
  });
  assert.equal(messages[0].type, 'begin');
  assert.equal(messages.at(-1).type, 'end');
  const copied = joinChunks(messages.filter(x => x.type === 'chunk').map(x => decodeChunk(x.data)), bytes.length);
  assert.deepEqual(Array.from(new Uint8Array(copied)), Array.from(bytes));
  assert.equal(JSON.stringify(messages).includes('token=private'), false);
});

test('page transfer accepts another CNKI host and rejects external URLs and HTML', async () => {
  const port = { postMessage: () => assert.fail('must not send bytes') };
  const otherCnki = 'https://pdfdownload.cnki.net/file';
  const transferred = [];
  await streamPdf(otherCnki, page, { postMessage: message => transferred.push(message) }, async () => ({
    ok: true, url: otherCnki, headers: { get: () => null }, arrayBuffer: async () => bytes.buffer,
  }));
  assert.equal(transferred.at(-1).type, 'end');
  await assert.rejects(streamPdf('https://evil.example/file', page, port, async () => assert.fail('must not fetch')), /知网/);
  await assert.rejects(streamPdf(url, page, port, async () => ({ ok: true, url, headers: { get: () => null }, arrayBuffer: async () => new TextEncoder().encode('<html>login</html>').buffer })), /不是 PDF/);
});
