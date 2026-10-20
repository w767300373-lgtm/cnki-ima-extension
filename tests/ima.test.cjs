const test = require('node:test');
const assert = require('node:assert/strict');
const { createImaClient } = require('../src/ima.js');

const credentials = { clientId: 'id', apiKey: 'key' };
const bytes = new TextEncoder().encode('%PDF-1.7\n%%EOF').buffer;

function fakeApi(responses, calls) {
  return async (url, init) => {
    const action = url.split('/').pop();
    calls.push({ action, body: JSON.parse(init.body), headers: init.headers });
    return { ok: true, json: async () => responses[action] };
  };
}

test('lists writable libraries and uploads PDF before registering it', async () => {
  const calls = [];
  const responses = {
    get_addable_knowledge_base_list: { code: 0, data: { addable_knowledge_base_list: [{ id: 'kb1', name: '文献' }], is_end: true } },
    check_repeated_names: { code: 0, data: { results: [{ name: '论文.pdf', is_repeated: false }] } },
    create_media: { code: 0, data: { media_id: 'media1', cos_credential: { cos_key: 'file', bucket_name: 'bucket', region: 'ap-test', secret_id: 'a', secret_key: 'b' } } },
    add_knowledge: { code: 0, data: { media_id: 'media1' } },
  };
  const client = createImaClient(credentials, fakeApi(responses, calls));
  assert.deepEqual(await client.listLibraries(), [{ id: 'kb1', name: '文献' }]);
  const uploads = [];
  const id = await client.uploadPdf({ buffer: bytes, fileName: '论文.pdf', knowledgeBaseId: 'kb1', cosUpload: async (...args) => { uploads.push(args); } });
  assert.equal(id, 'media1');
  assert.equal(uploads.length, 1);
  assert.deepEqual(calls.map(c => c.action), ['get_addable_knowledge_base_list', 'check_repeated_names', 'create_media', 'add_knowledge']);
  assert.equal(calls[3].body.file_info.file_name, '论文.pdf');
  assert.equal(calls[3].body.media_type, 1);
  assert.equal(calls[0].headers['ima-openapi-apikey'], 'key');
});

test('duplicate and failed COS upload never register knowledge', async () => {
  const calls = [];
  const responses = {
    check_repeated_names: { code: 0, data: { results: [{ name: '论文.pdf', is_repeated: true }] } },
    create_media: { code: 0, data: { media_id: 'media1', cos_credential: { cos_key: 'file' } } },
  };
  const client = createImaClient(credentials, fakeApi(responses, calls));
  await assert.rejects(client.uploadPdf({ buffer: bytes, fileName: '论文.pdf', knowledgeBaseId: 'kb1', cosUpload: async () => {} }), /同名/);
  assert.deepEqual(calls.map(c => c.action), ['check_repeated_names']);
  responses.check_repeated_names.data.results[0].is_repeated = false;
  await assert.rejects(client.uploadPdf({ buffer: bytes, fileName: '论文.pdf', knowledgeBaseId: 'kb1', cosUpload: async () => { throw new Error('COS failed'); } }), /COS failed/);
  assert.equal(calls.some(c => c.action === 'add_knowledge'), false);
});

test('missing duplicate-check result cannot proceed to media creation', async () => {
  const calls = [];
  const client = createImaClient(credentials, fakeApi({ check_repeated_names: { code: 0, data: {} } }, calls));
  await assert.rejects(client.uploadPdf({ buffer: bytes, fileName: '论文.pdf', knowledgeBaseId: 'kb1', cosUpload: async () => {} }), /重名检查/);
  assert.deepEqual(calls.map(c => c.action), ['check_repeated_names']);
});

test('lists nested folders from ima knowledge entries', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ action: url.split('/').pop(), body });
    const root = !body.folder_id;
    return { ok: true, json: async () => ({ code: 0, data: {
      knowledge_list: root
        ? [{ media_id: 'f1', title: '参考文献', media_type: 99 }, { media_id: 'pdf1', title: '论文.pdf', media_type: 1 }]
        : body.folder_id === 'f1' ? [{ media_id: 'f2', title: '养老金', media_type: 99 }] : [],
      is_end: true,
    } }) };
  };
  const folders = await createImaClient(credentials, fetchImpl).listFolders('kb1');
  assert.deepEqual(folders, [
    { id: 'f1', name: '参考文献', path: '参考文献' },
    { id: 'f2', name: '养老金', path: '参考文献 / 养老金' },
  ]);
  assert.deepEqual(calls.map(c => c.body.folder_id), [undefined, 'f1', 'f2']);
});

test('checks duplicate and adds PDF within selected folder', async () => {
  const calls = [];
  const responses = {
    check_repeated_names: { code: 0, data: { results: [{ name: '论文.pdf', is_repeated: false }] } },
    create_media: { code: 0, data: { media_id: 'm1', cos_credential: { cos_key: 'file' } } },
    add_knowledge: { code: 0, data: { media_id: 'm1' } },
  };
  await createImaClient(credentials, fakeApi(responses, calls)).uploadPdf({
    buffer: bytes, fileName: '论文.pdf', knowledgeBaseId: 'kb1', folderId: 'f1', cosUpload: async () => {},
  });
  assert.equal(calls[0].body.folder_id, 'f1');
  assert.equal(calls[2].body.folder_id, 'f1');
});
