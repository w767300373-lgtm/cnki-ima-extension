function isCnkiHttps(url) {
  return url.protocol === 'https:' && (url.hostname === 'cnki.net' || url.hostname.endsWith('.cnki.net'));
}

async function withArticleHeaders(pdfValue, articleValue, request, dnr = globalThis.chrome?.declarativeNetRequest, extensionId = globalThis.chrome?.runtime.id, cookies = globalThis.chrome?.cookies) {
  const pdf = new URL(pdfValue);
  const article = new URL(articleValue);
  if (!isCnkiHttps(pdf) || !isCnkiHttps(article)) throw new Error('PDF 或文章地址不在知网 HTTPS 站点内');
  const referer = pdf.origin === article.origin ? article.href : `${article.origin}/`;
  const requestHeaders = [{ header: 'Referer', operation: 'set', value: referer }];
  if (cookies?.getAll) {
    try {
      const found = await cookies.getAll({ url: pdf.href, partitionKey: {} });
      const partitioned = found.filter(cookie => cookie.partitionKey);
      if (partitioned.length) requestHeaders.push({
        header: 'cookie', operation: 'append',
        value: partitioned.map(cookie => `${cookie.name}=${cookie.value}`).join('; '),
      });
    } catch { /* Normal browser cookies still accompany credentials: include. */ }
  }
  const id = Math.floor(Math.random() * 100000000) + 100000;
  const rule = {
    id,
    action: { type: 'modifyHeaders', requestHeaders },
    condition: {
      resourceTypes: ['xmlhttprequest'],
      initiatorDomains: [extensionId],
      urlFilter: `||${pdf.hostname}^`,
    },
  };
  await dnr.updateSessionRules({ addRules: [rule] });
  const cleanup = () => dnr.updateSessionRules({ removeRuleIds: [id] });
  const timer = setTimeout(() => { void cleanup().catch(() => {}); }, 60000);
  try { return await request(); }
  finally {
    clearTimeout(timer);
    await cleanup();
  }
}

const requestApi = { withArticleHeaders };
if (typeof module !== 'undefined') module.exports = requestApi;
if (typeof self !== 'undefined') self.CnkiRequest = requestApi;
