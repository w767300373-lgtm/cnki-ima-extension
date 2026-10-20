const articleEl = document.getElementById('article');
const libraryEl = document.getElementById('library');
const folderEl = document.getElementById('folder');
const uploadEl = document.getElementById('upload');
const statusEl = document.getElementById('status');
let tabId;
let articleReady = false;
let folderRequest = 0;

function status(message, kind = '') {
  statusEl.textContent = message;
  statusEl.className = kind;
}

async function call(action, fields = {}) {
  const result = await chrome.runtime.sendMessage({ action, ...fields });
  if (!result?.ok) throw new Error(result?.error || '扩展后台没有响应');
  return result.data;
}

async function loadFolders() {
  const requestId = ++folderRequest;
  const knowledgeBaseId = libraryEl.value;
  folderEl.disabled = true;
  uploadEl.disabled = true;
  folderEl.replaceChildren(new Option('正在加载文件夹…', ''));
  try {
    const folders = await call('listFolders', { knowledgeBaseId });
    if (requestId !== folderRequest) return;
    folderEl.replaceChildren(new Option('根目录', ''));
    for (const folder of folders) folderEl.add(new Option(folder.path, folder.id));
    const saved = await chrome.storage.local.get(['lastKnowledgeBaseId', 'lastFolderId']);
    if (requestId !== folderRequest) return;
    if (saved.lastKnowledgeBaseId === knowledgeBaseId && folders.some(item => item.id === saved.lastFolderId)) {
      folderEl.value = saved.lastFolderId;
    }
    folderEl.disabled = false;
    uploadEl.disabled = !articleReady;
  } catch (error) {
    if (requestId !== folderRequest) return;
    folderEl.replaceChildren(new Option('文件夹不可用', ''));
    status(error.message, 'error');
  }
}

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('没有可用的知网标签页');
    tabId = tab.id;
    const article = await call('inspectArticle', { tabId });
    articleEl.textContent = article.title;
    articleReady = true;
    const { lastUpload } = await chrome.storage.local.get('lastUpload');
    if (lastUpload?.tabId === tabId && (!lastUpload.title || lastUpload.title === article.title) && Date.now() - lastUpload.updatedAt < 24 * 60 * 60 * 1000) {
      status(lastUpload.state === 'running' ? `上次进度：${lastUpload.status}` : lastUpload.status, lastUpload.state === 'running' ? '' : lastUpload.state);
    }
  } catch (error) {
    articleEl.textContent = '未识别到可下载的单篇文章';
    status(error.message, 'error');
  }
  try {
    const libraries = await call('listLibraries');
    libraryEl.replaceChildren();
    for (const library of libraries) {
      const option = document.createElement('option');
      option.value = library.id;
      option.textContent = library.name;
      libraryEl.append(option);
    }
    if (!libraries.length) throw new Error('ima 中没有可写入的知识库');
    const { lastKnowledgeBaseId } = await chrome.storage.local.get('lastKnowledgeBaseId');
    if (libraries.some(item => item.id === lastKnowledgeBaseId)) libraryEl.value = lastKnowledgeBaseId;
    libraryEl.disabled = false;
    await loadFolders();
  } catch (error) {
    libraryEl.replaceChildren(new Option('知识库不可用', ''));
    status(error.message, 'error');
  }
}

chrome.runtime.onMessage.addListener(message => {
  if (message.action === 'progress') status(message.status);
});

libraryEl.addEventListener('change', loadFolders);

uploadEl.addEventListener('click', async () => {
  uploadEl.disabled = true;
  libraryEl.disabled = true;
  folderEl.disabled = true;
  const knowledgeBaseId = libraryEl.value;
  const folderId = folderEl.value || undefined;
  const folderName = folderEl.selectedOptions[0].textContent;
  await chrome.storage.local.set({ lastKnowledgeBaseId: knowledgeBaseId, lastFolderId: folderId || '' });
  status('正在开始下载 PDF…');
  try {
    await call('uploadArticle', { tabId, knowledgeBaseId, folderId });
    status(`已添加到「${libraryEl.selectedOptions[0].textContent} / ${folderName}」`, 'success');
  } catch (error) {
    status(error.message, 'error');
  } finally {
    uploadEl.disabled = false;
    libraryEl.disabled = false;
    folderEl.disabled = false;
  }
});

document.getElementById('settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
init();
