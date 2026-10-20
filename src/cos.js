async function hmacSha1(key, value) {
  const encoder = new TextEncoder();
  const imported = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha1(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function authorization(host, path, credential) {
  const now = Math.floor(Date.now() / 1000);
  const start = Number(credential.start_time) || now;
  const end = Number(credential.expired_time) || now + 600;
  const keyTime = `${start};${end}`;
  const signKey = await hmacSha1(credential.secret_key, keyTime);
  const httpString = `put\n${path}\n\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${await sha1(httpString)}\n`;
  const signature = await hmacSha1(signKey, stringToSign);
  return `q-sign-algorithm=sha1&q-ak=${credential.secret_id}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
}

async function uploadToCos(buffer, credential, contentType = 'application/pdf', fetchImpl = fetch) {
  const { bucket_name, region, cos_key, secret_id, secret_key, token } = credential || {};
  if (!bucket_name || !region || !cos_key || !secret_id || !secret_key) throw new Error('COS 临时凭证不完整');
  const host = `${bucket_name}.cos.${region}.myqcloud.com`;
  const path = '/' + cos_key.replace(/^\/+/, '');
  const headers = {
    Authorization: await authorization(host, path, credential),
    'Content-Type': contentType,
  };
  if (token) headers['x-cos-security-token'] = token;
  const response = await fetchImpl(`https://${host}${path}`, { method: 'PUT', headers, body: buffer });
  if (!response.ok) throw new Error(`COS 上传失败：HTTP ${response.status}`);
}
const cosApi = { uploadToCos };
if (typeof module !== 'undefined') module.exports = cosApi;
if (typeof self !== 'undefined') self.Cos = cosApi;
