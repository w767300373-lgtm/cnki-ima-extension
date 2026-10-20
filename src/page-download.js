const pageTransfer = typeof module !== 'undefined' ? require('./transfer.js') : self.Transfer;

function downloadFromTab(tabId, url, options = {}) {
  const connect = options.connect || ((id, settings) => chrome.tabs.connect(id, settings));
  const validatePdf = options.validatePdf || (buffer => self.Pdf.validatePdf(buffer));
  return new Promise((resolve, reject) => {
    const port = connect(tabId, { name: 'cnki-ima-pdf' });
    let expected = null;
    let total = 0;
    let settled = false;
    const chunks = [];
    const timer = setTimeout(() => finish(new Error('页面内 PDF 读取超时')), 300000);
    function finish(error, buffer) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { port.disconnect(); } catch { /* Already disconnected. */ }
      if (error) reject(error); else resolve(buffer);
    }
    port.onDisconnect.addListener(() => finish(new Error('知网页面连接已断开')));
    port.onMessage.addListener(message => {
      if (settled) return;
      try {
        if (message.type === 'begin') {
          if (expected !== null || !Number.isSafeInteger(message.length) || message.length <= 0 || message.length > 200 * 1024 * 1024) {
            throw new Error('页面内 PDF 大小无效或超过 200 MB');
          }
          expected = message.length;
        } else if (message.type === 'chunk') {
          if (expected === null) throw new Error('页面内 PDF 传输顺序无效');
          const bytes = pageTransfer.decodeChunk(message.data);
          total += bytes.byteLength;
          if (total > expected) throw new Error('页面内 PDF 传输长度异常');
          chunks.push(bytes);
        } else if (message.type === 'end') {
          if (expected === null) throw new Error('页面内 PDF 传输不完整');
          finish(null, validatePdf(pageTransfer.joinChunks(chunks, expected)));
        } else if (message.type === 'error') {
          throw new Error(String(message.error || '页面内 PDF 请求失败').slice(0, 200));
        }
      } catch (error) { finish(error); }
    });
    port.postMessage({ url });
  });
}

const pageDownloadApi = { downloadFromTab };
if (typeof module !== 'undefined') module.exports = pageDownloadApi;
if (typeof self !== 'undefined') self.PageDownload = pageDownloadApi;
