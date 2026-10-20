const test = require('node:test');
const assert = require('node:assert/strict');
const { downloadFromTab } = require('../src/page-download.js');
const { encodeChunk } = require('../src/transfer.js');
const { validatePdf } = require('../src/pdf.js');

test('receives and validates PDF bytes from the article tab', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const listeners = [];
  const disconnectListeners = [];
  const port = {
    onMessage: { addListener: fn => listeners.push(fn) },
    onDisconnect: { addListener: fn => disconnectListeners.push(fn) },
    disconnect() {},
    postMessage(message) {
      assert.equal(message.url, 'https://kns.cnki.net/download/pdf');
      queueMicrotask(() => {
        for (const listener of listeners) listener({ type: 'begin', length: bytes.length });
        for (const listener of listeners) listener({ type: 'chunk', data: encodeChunk(bytes) });
        for (const listener of listeners) listener({ type: 'end' });
      });
    },
  };
  const buffer = await downloadFromTab(42, 'https://kns.cnki.net/download/pdf', {
    connect: (id, options) => { assert.equal(id, 42); assert.equal(options.name, 'cnki-ima-pdf'); return port; },
    validatePdf,
  });
  assert.deepEqual(Array.from(new Uint8Array(buffer)), Array.from(bytes));
});

test('rejects a tab transfer that reports an error', async () => {
  let receive;
  const port = {
    onMessage: { addListener: fn => { receive = fn; } },
    onDisconnect: { addListener() {} },
    disconnect() {},
    postMessage() { queueMicrotask(() => receive({ type: 'error', error: '页面内请求不是 PDF' })); },
  };
  await assert.rejects(downloadFromTab(42, 'https://kns.cnki.net/download/pdf', { connect: () => port, validatePdf }), /不是 PDF/);
});
