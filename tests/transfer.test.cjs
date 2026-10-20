const test = require('node:test');
const assert = require('node:assert/strict');
const { encodeChunk, decodeChunk, joinChunks } = require('../src/transfer.js');

test('transfers binary PDF bytes through JSON-safe chunks without changing them', () => {
  const input = new Uint8Array([0, 1, 2, 127, 128, 255, 37, 80, 68, 70, 45]);
  const chunks = [input.subarray(0, 4), input.subarray(4, 8), input.subarray(8)];
  const decoded = chunks.map(chunk => decodeChunk(encodeChunk(chunk)));
  assert.deepEqual(Array.from(new Uint8Array(joinChunks(decoded, input.length))), Array.from(input));
});

test('rejects mismatched transfer length', () => {
  assert.throws(() => joinChunks([new Uint8Array([1, 2])], 3), /长度/);
});
