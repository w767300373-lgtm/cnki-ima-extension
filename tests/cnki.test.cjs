const test = require('node:test');
const assert = require('node:assert/strict');
const { isCnkiArticleUrl, findArticlePdf, pickArticleTitle } = require('../src/cnki.js');

test('accepts one CNKI article and rejects a results page', () => {
  assert.equal(isCnkiArticleUrl('https://kns.cnki.net/kcms2/article/abstract?v=abc'), true);
  assert.equal(isCnkiArticleUrl('https://kns.cnki.net/kns8s/defaultresult/index?kw=test'), false);
  assert.equal(isCnkiArticleUrl('https://evil.example/kcms2/article/abstract'), false);
});

test('uses the article page title instead of an unrelated login heading', () => {
  assert.equal(pickArticleTitle('', '养老金代际流动性：特征事实、传导机制与政策优化 - 中国知网', '自动登录'), '养老金代际流动性：特征事实、传导机制与政策优化');
});

test('selects the explicit PDF download control over other links', () => {
  const pageUrl = 'https://kns.cnki.net/kcms2/article/abstract?v=abc';
  const links = [
    { id: 'cajDown', className: '', text: 'CAJ下载', href: '/download?format=caj' },
    { id: 'pdfDown', className: '', text: 'PDF下载', href: '/download?format=pdf' },
  ];
  assert.equal(findArticlePdf(pageUrl, links), 'https://kns.cnki.net/download?format=pdf');
});

test('accepts thesis PDF link but rejects script and external URLs', () => {
  const pageUrl = 'https://kns.cnki.net/kcms2/article/abstract?v=abc';
  assert.equal(findArticlePdf(pageUrl, [{ id: '', className: 'btn-dlpdf', text: 'PDF下载', href: '/download?file=1' }]), 'https://kns.cnki.net/download?file=1');
  assert.equal(findArticlePdf(pageUrl, [{ id: 'pdfDown', className: '', text: 'PDF下载', href: 'javascript:download()' }]), null);
  assert.equal(findArticlePdf(pageUrl, [{ id: 'pdfDown', className: '', text: 'PDF下载', href: 'https://example.com/file.pdf' }]), null);
  assert.equal(findArticlePdf(pageUrl, [{ id: 'pdfDown', text: 'PDF下载', href: '#' }]), null);
  assert.equal(findArticlePdf(pageUrl, [{ id: 'pdfDown', text: 'PDF下载', href: '/reader/flowpdf?scope=trial' }]), null);
});
