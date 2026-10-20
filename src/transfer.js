function encodeChunk(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function decodeChunk(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function joinChunks(chunks, expectedLength) {
  const actualLength = chunks.reduce((total, part) => total + part.byteLength, 0);
  if (actualLength !== expectedLength) throw new Error('PDF 传输长度不一致');
  const output = new Uint8Array(actualLength);
  let offset = 0;
  for (const part of chunks) { output.set(part, offset); offset += part.byteLength; }
  return output.buffer;
}

const transferApi = { encodeChunk, decodeChunk, joinChunks };
if (typeof module !== 'undefined') module.exports = transferApi;
if (typeof self !== 'undefined') self.Transfer = transferApi;
