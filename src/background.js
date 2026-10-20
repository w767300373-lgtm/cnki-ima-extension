importScripts('cnki.js', 'pdf.js', 'cnki-request.js', 'transfer.js', 'page-download.js', 'ima.js', 'cos.js');
const activeUploads = new Set();

async function credentials() {
  const saved = await chrome.storage.local.get(['imaClientId', 'imaApiKey']);
  if (!saved.imaClientId || !saved.imaApiKey) throw new Error('请先在扩展设置中配置 ima Client ID 和 API Key');
  return { clientId: saved.imaClientId.trim(), apiKey: saved.imaApiKey.trim() };
}

async function inspectArticle(tabId) {
  let result;
  try { result = await chrome.tabs.sendMessage(tabId, { action: 'inspectArticle' }); }
  catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/cnki.js', 'src/transfer.js', 'src/page-content.js', 'src/content.js'] });
    result = await chrome.tabs.sendMessage(tabId, { action: 'inspectArticle' });
  }
  if (!result?.ok) throw new Error(result?.error || '无法识别知网文章');
  return result.article;
}

function fileNameFor(title) {
  const safe = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 160);
  return `${safe || '知网论文'}.pdf`;
}

function progress(status, tabId, title, state = 'running') {
  if (tabId) {
    chrome.storage.local.set({ lastUpload: { tabId, title, status, state, updatedAt: Date.now() } }).catch(() => {});
    chrome.action.setBadgeText({ tabId, text: state === 'success' ? '✓' : state === 'error' ? '!' : '…' }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color: state === 'success' ? '#188038' : state === 'error' ? '#c5221f' : '#1765ad' }).catch(() => {});
  }
  chrome.runtime.sendMessage({ action: 'progress', status, tabId }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'progress') {
    if (message.title && message.tabId) progress(message.status, message.tabId, message.title);
    return false;
  }
  let jobTitle = '';
  (async () => {
    if (message.action === 'inspectArticle') return await inspectArticle(message.tabId);
    if (message.action === 'listLibraries') return await Ima.createImaClient(await credentials()).listLibraries();
    if (message.action === 'listFolders') return await Ima.createImaClient(await credentials()).listFolders(message.knowledgeBaseId);
    if (message.action === 'uploadArticle') {
      if (activeUploads.has(message.tabId)) throw new Error('这篇文章正在上传，请等待完成');
      activeUploads.add(message.tabId);
      try {
        const article = await inspectArticle(message.tabId);
        jobTitle = article.title;
        progress('正在通过知网授权会话获取 PDF', message.tabId, jobTitle);
        let buffer;
        try {
          buffer = await CnkiRequest.withArticleHeaders(article.pdfUrl, article.url,
            () => Pdf.downloadPdf(article.pdfUrl));
        } catch (backgroundError) {
          progress('后台未取得 PDF，尝试知网页面会话', message.tabId, jobTitle);
          try { buffer = await PageDownload.downloadFromTab(message.tabId, article.pdfUrl); }
          catch (pageError) {
            throw new Error(`知网 PDF 请求失败；后台：${backgroundError.message}；页面：${pageError.message}。未启动 Edge 下载，也未上传到 ima`);
          }
        }
        const client = Ima.createImaClient(await credentials());
        const mediaId = await client.uploadPdf({
          buffer,
          fileName: fileNameFor(article.title),
          knowledgeBaseId: message.knowledgeBaseId,
          folderId: message.folderId,
          cosUpload: Cos.uploadToCos,
          onStatus: status => progress(status, message.tabId, jobTitle),
        });
        return { mediaId, title: article.title };
      } finally {
        activeUploads.delete(message.tabId);
      }
    }
    throw new Error('未知操作');
  })().then(data => {
    if (message.action === 'uploadArticle') progress('PDF 已成功加入 ima 知识库', message.tabId, jobTitle, 'success');
    sendResponse({ ok: true, data });
  }, error => {
    if (message.action === 'uploadArticle') progress(error.message, message.tabId, jobTitle, 'error');
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});
