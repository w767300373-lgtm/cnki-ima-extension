const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePdf, downloadPdf } = require('../src/pdf.js');

const goodPdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

test('accepts PDF bytes and rejects HTML or truncated data', () => {
  assert.doesNotThrow(() => validatePdf(goodPdf.buffer));
  assert.throws(() => validatePdf(new TextEncoder().encode('<html>login</html>').buffer), /PDF/);
  assert.throws(() => validatePdf(new TextEncoder().encode('%PDF-1.7\n1 0 obj').buffer), /完整/);
});

test('downloads with browser credentials and validates the response', async () => {
  let options;
  const fetchImpl = async (_url, init) => {
    options = init;
    return { ok: true, url: 'https://kns.cnki.net/download/pdf', headers: { get: () => 'application/pdf' }, arrayBuffer: async () => goodPdf.buffer };
  };
  const result = await downloadPdf('https://kns.cnki.net/download/pdf', fetchImpl);
  assert.equal(options.credentials, 'include');
  assert.equal(result.byteLength, goodPdf.byteLength);
});

test('refuses external redirects and HTML even with an HTTP 200', async () => {
  const fake = async () => ({ ok: true, url: 'https://evil.example/file.pdf', headers: { get: () => 'application/pdf' }, arrayBuffer: async () => goodPdf.buffer });
  await assert.rejects(downloadPdf('https://kns.cnki.net/download/pdf', fake), /知网域名/);
  const html = async () => ({ ok: true, url: 'https://kns.cnki.net/login', headers: { get: () => 'text/html' }, arrayBuffer: async () => new TextEncoder().encode('<html>login</html>').buffer });
  await assert.rejects(downloadPdf('https://kns.cnki.net/download/pdf', html), /PDF/);
});

test('refuses CNKI trial reader even if it returns PDF bytes', async () => {
  const trial = async () => ({ ok: true, url: 'https://kns.cnki.net/reader/flowpdf?scope=trial', headers: { get: () => 'application/pdf' }, arrayBuffer: async () => goodPdf.buffer });
  await assert.rejects(downloadPdf('https://kns.cnki.net/download/pdf', trial), /试读/);
});

test('reports safe response diagnostics for a non-PDF CNKI download', async () => {
  const html = async () => ({
    ok: true,
    url: 'https://kns.cnki.net/login?ticket=secret',
    headers: { get: name => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null },
    arrayBuffer: async () => new TextEncoder().encode('<html>login</html>').buffer,
  });
  await assert.rejects(
    downloadPdf('https://kns.cnki.net/download/pdf?token=secret', html),
    error => /\/download\/pdf/.test(error.message) && /\/login/.test(error.message) && /text\/html/.test(error.message) && !/secret/.test(error.message),
  );
});
