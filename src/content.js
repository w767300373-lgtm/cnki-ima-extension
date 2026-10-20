(() => {
  if (window !== window.top || window.__cnkiImaContentLoaded) return;
  window.__cnkiImaContentLoaded = true;

  function inspect() {
    const url = location.href;
    if (!Cnki.isCnkiArticleUrl(url)) throw new Error('请先打开知网单篇文章详情页');
    const links = Array.from(document.querySelectorAll('a[href]'), a => ({
      id: a.id,
      className: typeof a.className === 'string' ? a.className : '',
      text: (a.innerText || a.textContent || '').trim(),
      href: a.getAttribute('href'),
    }));
    const pdfUrl = Cnki.findArticlePdf(url, links);
    if (!pdfUrl) throw new Error('这篇文章未找到可读取的 PDF 下载入口');
    const metaTitle = document.querySelector('meta[name="citation_title"]')?.content;
    const heading = document.querySelector('h1')?.textContent?.trim();
    const title = Cnki.pickArticleTitle(metaTitle, document.title, heading);
    return { url, pdfUrl, title };
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.action !== 'inspectArticle') return;
    try { respond({ ok: true, article: inspect() }); }
    catch (error) { respond({ ok: false, error: error.message }); }
  });

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'cnki-ima-pdf') return;
    port.onMessage.addListener(async message => {
      try { await PageContent.streamPdf(message.url, location.href, port); }
      catch (error) {
        try { port.postMessage({ type: 'error', error: error.message }); } catch { /* Popup or tab closed. */ }
      }
    });
  });
})();
