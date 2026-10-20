const test = require('node:test');
const assert = require('node:assert/strict');
const Request = require('../src/cnki-request.js');

test('scopes article referer to an extension PDF request and removes the rule afterwards', async () => {
  const calls = [];
  const dnr = {
    updateSessionRules: async value => { calls.push(value); },
  };
  const extensionId = 'test-extension';
  const article = 'https://kns.cnki.net/kcms2/article/abstract?v=secret';
  const pdf = 'https://download.cnki.net/download/pdf?token=secret';
  const result = await Request.withArticleHeaders(pdf, article, async () => {
    assert.equal(calls.length, 1);
    const rule = calls[0].addRules[0];
    assert.deepEqual(rule.action.requestHeaders, [{ header: 'Referer', operation: 'set', value: 'https://kns.cnki.net/' }]);
    assert.deepEqual(rule.condition.initiatorDomains, [extensionId]);
    assert.equal(rule.condition.urlFilter, '||download.cnki.net^');
    return 'pdf bytes';
  }, dnr, extensionId);
  assert.equal(result, 'pdf bytes');
  assert.deepEqual(calls[1].removeRuleIds, [calls[0].addRules[0].id]);
});

test('removes scoped rule when PDF fetch fails', async () => {
  const calls = [];
  const dnr = { updateSessionRules: async value => { calls.push(value); } };
  await assert.rejects(() => Request.withArticleHeaders(
    'https://kns.cnki.net/download/pdf',
    'https://kns.cnki.net/kcms2/article/abstract',
    async () => { throw new Error('not PDF'); },
    dnr,
    'test-extension',
  ), /not PDF/);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].removeRuleIds, [calls[0].addRules[0].id]);
});

test('rejects non-CNKI download target before modifying headers', async () => {
  let touched = false;
  const dnr = { updateSessionRules: async () => { touched = true; } };
  await assert.rejects(() => Request.withArticleHeaders(
    'https://elsewhere.example/pdf', 'https://kns.cnki.net/kcms2/article/abstract',
    async () => {}, dnr, 'test-extension',
  ), /知网/);
  assert.equal(touched, false);
});

test('appends only partitioned cookies for the PDF host', async () => {
  const calls = [];
  const dnr = { updateSessionRules: async value => { calls.push(value); } };
  const cookies = { getAll: async details => {
    assert.equal(details.url, 'https://download.cnki.net/download/pdf');
    assert.deepEqual(details.partitionKey, {});
    return [
      { name: 'ordinary', value: 'browser-sends-this' },
      { name: 'partitioned', value: 'needed', partitionKey: { topLevelSite: 'https://cnki.net' } },
    ];
  } };
  await Request.withArticleHeaders(
    'https://download.cnki.net/download/pdf',
    'https://kns.cnki.net/kcms2/article/abstract',
    async () => {}, dnr, 'test-extension', cookies,
  );
  assert.deepEqual(calls[0].addRules[0].action.requestHeaders[1], {
    header: 'cookie', operation: 'append', value: 'partitioned=needed',
  });
});
