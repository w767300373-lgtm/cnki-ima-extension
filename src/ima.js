const API_BASE = 'https://ima.qq.com/openapi/wiki/v1/';

function createImaClient(credentials, fetchImpl = fetch) {
  if (!credentials?.clientId || !credentials?.apiKey) throw new Error('请先配置 ima Client ID 和 API Key');

  async function request(action, body) {
    const response = await fetchImpl(API_BASE + action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'ima-openapi-clientid': credentials.clientId,
        'ima-openapi-apikey': credentials.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`ima ${action} 请求失败：HTTP ${response.status}`);
    const result = await response.json();
    if (result.code !== 0) throw new Error(result.msg || `ima ${action} 错误：${result.code}`);
    return result.data || {};
  }

  async function listLibraries() {
    const libraries = [];
    let cursor = '';
    for (let page = 0; page < 20; page++) {
      const data = await request('get_addable_knowledge_base_list', { cursor, limit: 50 });
      libraries.push(...(data.addable_knowledge_base_list || []));
      if (data.is_end || !data.next_cursor || data.next_cursor === cursor) break;
      cursor = data.next_cursor;
    }
    return libraries;
  }

  async function listFolders(knowledgeBaseId) {
    if (!knowledgeBaseId) throw new Error('没有选择目标知识库');
    const folders = [];
    const queue = [{ id: '', path: '' }];
    let requests = 0;
    for (let index = 0; index < queue.length; index++) {
      const parent = queue[index];
      let cursor = '';
      do {
        if (++requests > 1000) throw new Error('知识库文件夹数量过多，无法完整列出');
        const body = { knowledge_base_id: knowledgeBaseId, cursor, limit: 50 };
        if (parent.id) body.folder_id = parent.id;
        const data = await request('get_knowledge_list', body);
        for (const item of data.knowledge_list || []) {
          if (item.media_type !== 99 || !item.media_id || !item.title) continue;
          const path = parent.path ? `${parent.path} / ${item.title}` : item.title;
          folders.push({ id: item.media_id, name: item.title, path });
          queue.push({ id: item.media_id, path });
        }
        if (folders.length > 500) throw new Error('知识库文件夹数量过多，无法完整列出');
        if (data.is_end) break;
        if (!data.next_cursor || data.next_cursor === cursor) throw new Error('ima 文件夹分页数据不完整');
        cursor = data.next_cursor;
      } while (true);
    }
    return folders;
  }

  async function uploadPdf({ buffer, fileName, knowledgeBaseId, folderId, cosUpload, onStatus = () => {} }) {
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength) throw new Error('PDF 内容为空');
    if (!fileName?.toLowerCase().endsWith('.pdf')) throw new Error('PDF 文件名无效');
    if (!knowledgeBaseId) throw new Error('没有选择目标知识库');
    onStatus('正在检查知识库中是否已有同名文件');
    const repeated = await request('check_repeated_names', {
      params: [{ name: fileName, media_type: 1 }], knowledge_base_id: knowledgeBaseId,
      ...(folderId ? { folder_id: folderId } : {}),
    });
    if (!Array.isArray(repeated.results) || repeated.results.length !== 1 || repeated.results[0].name !== fileName) {
      throw new Error('ima 未返回可靠的重名检查结果，已停止上传');
    }
    if (repeated.results?.some(item => item.is_repeated)) throw new Error('目标知识库已有同名 PDF，未重复上传');

    onStatus('正在创建 ima 文件');
    const created = await request('create_media', {
      file_name: fileName,
      file_size: buffer.byteLength,
      content_type: 'application/pdf',
      knowledge_base_id: knowledgeBaseId,
      file_ext: 'pdf',
    });
    if (!created.media_id || !created.cos_credential?.cos_key) throw new Error('ima 未返回媒体 ID 或 COS 凭证');

    onStatus('正在上传 PDF 到腾讯云');
    await cosUpload(buffer, created.cos_credential, 'application/pdf');
    onStatus('正在加入 ima 知识库');
    await request('add_knowledge', {
      media_type: 1,
      media_id: created.media_id,
      title: fileName,
      knowledge_base_id: knowledgeBaseId,
      ...(folderId ? { folder_id: folderId } : {}),
      file_info: {
        cos_key: created.cos_credential.cos_key,
        file_size: buffer.byteLength,
        file_name: fileName,
      },
    });
    return created.media_id;
  }

  return { request, listLibraries, listFolders, uploadPdf };
}
const imaApi = { createImaClient };
if (typeof module !== 'undefined') module.exports = imaApi;
if (typeof self !== 'undefined') self.Ima = imaApi;
