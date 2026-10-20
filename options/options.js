const clientIdEl = document.getElementById('clientId');
const apiKeyEl = document.getElementById('apiKey');
const resultEl = document.getElementById('result');
const saveEl = document.getElementById('save');

chrome.storage.local.get(['imaClientId', 'imaApiKey']).then(saved => {
  clientIdEl.value = saved.imaClientId || '';
  apiKeyEl.value = saved.imaApiKey || '';
});

saveEl.addEventListener('click', async () => {
  const imaClientId = clientIdEl.value.trim();
  const imaApiKey = apiKeyEl.value.trim();
  if (!imaClientId || !imaApiKey) { resultEl.textContent = '请填写两项凭证'; return; }
  saveEl.disabled = true;
  resultEl.textContent = '正在测试连接…';
  try {
    await chrome.storage.local.set({ imaClientId, imaApiKey });
    const response = await chrome.runtime.sendMessage({ action: 'listLibraries' });
    if (!response?.ok) throw new Error(response?.error || '连接失败');
    resultEl.textContent = `连接成功，可写入知识库：${response.data.length} 个`;
  } catch (error) {
    resultEl.textContent = `连接失败：${error.message}`;
  } finally {
    saveEl.disabled = false;
  }
});
