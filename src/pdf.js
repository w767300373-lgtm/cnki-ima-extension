const MAX_PDF_BYTES = 200 * 1024 * 1024;

function cnkiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'cnki.net' || url.hostname.endsWith('.cnki.net'));
  } catch { return false; }
}

function validatePdf(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('PDF 超过 ima 200 MB 上限');
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, 5));
  if (head !== '%PDF-') throw new Error('下载结果不是 PDF，可能是知网登录页或错误页');
  const tail = new TextDecoder('ascii').decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
  if (!tail.includes('%%EOF')) throw new Error('PDF 不完整，缺少结束标记');
  return buffer;
}

function diagnosticRoute(value) {
  const path = new URL(value).pathname.toLowerCase();
  if (path.startsWith('/download/pdf')) return '/download/pdf';
  if (path.startsWith('/login')) return '/login';
  if (path.startsWith('/verify')) return '/verify';
  if (path.startsWith('/reader/flowpdf')) return '/reader/flowpdf';
  if (path.startsWith('/kcms2/article')) return '/kcms2/article';
  return '[知网其他路径]';
}

async function downloadPdf(url, fetchImpl = fetch) {
  if (!cnkiUrl(url)) throw new Error('PDF 地址不在知网域名内');
  if (new URL(url).searchParams.get('scope')?.toLowerCase() === 'trial') throw new Error('知网只提供试读，未发现可下载的完整 PDF');
  const response = await fetchImpl(url, { credentials: 'include', redirect: 'follow', cache: 'no-store' });
  if (!response.ok) throw new Error(`知网下载失败：HTTP ${response.status}`);
  if (!cnkiUrl(response.url)) throw new Error('下载重定向到了非知网域名');
  if (new URL(response.url).searchParams.get('scope')?.toLowerCase() === 'trial') throw new Error('知网返回了试读内容，已停止上传');
  const length = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(length) && length > MAX_PDF_BYTES) throw new Error('PDF 超过 ima 200 MB 上限');
  const buffer = await response.arrayBuffer();
  try { return validatePdf(buffer); }
  catch (error) {
    if (!error.message.includes('不是 PDF')) throw error;
    const rawType = response.headers.get('Content-Type') || '';
    const type = rawType.match(/^[a-z0-9.+-]+\/[a-z0-9.+-]+/i)?.[0] || '未知';
    throw new Error(`知网返回的不是 PDF：入口 ${diagnosticRoute(url)}，响应 ${diagnosticRoute(response.url)}，类型 ${type}`);
  }
}
const pdfApi = { validatePdf, downloadPdf, MAX_PDF_BYTES };
if (typeof module !== 'undefined') module.exports = pdfApi;
if (typeof self !== 'undefined') self.Pdf = pdfApi;
