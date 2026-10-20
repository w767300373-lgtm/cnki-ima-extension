function isCnkiHost(hostname) {
  return hostname === 'cnki.net' || hostname.endsWith('.cnki.net');
}

function isCnkiArticleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && isCnkiHost(url.hostname) &&
      (/\/kcms2?\/article\//i.test(url.pathname) || /\/kcms\/detail\//i.test(url.pathname));
  } catch {
    return false;
  }
}

function findArticlePdf(pageUrl, links) {
  if (!isCnkiArticleUrl(pageUrl)) return null;
  for (const link of links) {
    const marker = `${link.id || ''} ${link.className || ''}`.toLowerCase();
    const label = (link.text || '').toLowerCase();
    if (!(/pdfdown|btn-dlpdf/.test(marker) || /pdf\s*下载|下载\s*pdf/.test(label))) continue;
    if (/caj/.test(label) && !/pdf/.test(label)) continue;
    if (!link.href || /^(?:#|javascript:)/i.test(link.href.trim())) continue;
    try {
      const url = new URL(link.href, pageUrl);
      if (url.protocol !== 'https:' || !isCnkiHost(url.hostname)) continue;
      if (url.href === pageUrl || /\/reader\/flowpdf/i.test(url.pathname)) continue;
      if (url.searchParams.get('scope')?.toLowerCase() === 'trial') continue;
      return url.href;
    } catch { /* Ignore script-only controls. */ }
  }
  return null;
}

function pickArticleTitle(citationTitle, pageTitle, heading) {
  const clean = value => (value || '').replace(/\s+/g, ' ').trim();
  const title = clean(citationTitle) || clean(pageTitle).replace(/\s*[-–—]\s*中国知网\s*$/, '') || clean(heading);
  return title || '知网论文';
}

var cnkiApi = { isCnkiHost, isCnkiArticleUrl, findArticlePdf, pickArticleTitle };
if (typeof module !== 'undefined') module.exports = cnkiApi;
if (typeof self !== 'undefined') self.Cnki = cnkiApi;
