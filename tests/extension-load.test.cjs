const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('MV3 service worker loads all scripts in the declared order', () => {
  const root = path.resolve(__dirname, '..');
  const listeners = [];
  const context = vm.createContext({
    URL, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, crypto: globalThis.crypto,
    setTimeout, clearTimeout, btoa, atob,
    chrome: { runtime: { onMessage: { addListener: listener => listeners.push(listener) } } },
  });
  context.self = context;
  context.importScripts = (...scripts) => {
    for (const script of scripts) {
      vm.runInContext(fs.readFileSync(path.join(root, 'src', script), 'utf8'), context, { filename: script });
    }
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'src', 'background.js'), 'utf8'), context, { filename: 'background.js' });
  assert.equal(listeners.length, 1);
  assert.equal(typeof context.Cnki.findArticlePdf, 'function');
  assert.equal(typeof context.Pdf.downloadPdf, 'function');
  assert.equal(typeof context.CnkiRequest.withArticleHeaders, 'function');
  assert.equal(typeof context.Transfer.decodeChunk, 'function');
  assert.equal(typeof context.PageDownload.downloadFromTab, 'function');
  assert.equal(typeof context.Ima.createImaClient, 'function');
  assert.equal(typeof context.Cos.uploadToCos, 'function');
});

test('CNKI helper can be injected again on an already open article tab', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'cnki.js'), 'utf8');
  const context = vm.createContext({ URL });
  context.self = context;
  assert.doesNotThrow(() => {
    vm.runInContext(source, context);
    vm.runInContext(source, context);
  });
});
