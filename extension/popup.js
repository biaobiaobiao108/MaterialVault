// Material Vault Popup Logic
const DEFAULT_SERVER_URL = 'http://localhost:3000';

let currentTab = null;
let selectedTags = new Set();
let allTagsList = [];

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const settingsDrawer = document.getElementById('settings-drawer');
const serverUrlInput = document.getElementById('server-url');
const btnSaveSettings = document.getElementById('btn-save-settings');

const itemTitleInput = document.getElementById('item-title');
const itemUrlText = document.getElementById('item-url');
const tagInput = document.getElementById('tag-input');
const tagsContainer = document.getElementById('tags-container');
const suggestedTagsWrapper = document.getElementById('suggested-tags-wrapper');
const suggestedTagsContainer = document.getElementById('suggested-tags');
const itemNoteInput = document.getElementById('item-note');

const btnSave = document.getElementById('btn-save');
const btnSaveText = document.getElementById('btn-save-text');
const btnSpinner = document.getElementById('btn-spinner');

const captureView = document.getElementById('capture-view');
const successView = document.getElementById('success-view');
const btnOpenVault = document.getElementById('btn-open-vault');
const btnClose = document.getElementById('btn-close');
const errorToast = document.getElementById('error-toast');
const errorMsg = document.getElementById('error-msg');

// 1. Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = config.vaultServerUrl || DEFAULT_SERVER_URL;
  serverUrlInput.value = serverUrl;

  await checkServerHealth(serverUrl);
  await loadActiveTabInfo();
  await loadTags(serverUrl);
});

// 2. Server Health Check
async function checkServerHealth(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/stats`, { method: 'GET' });
    if (res.ok) {
      statusIndicator.className = 'status-indicator online';
      statusText.textContent = '在线';
      statusIndicator.title = `已连接至 ${serverUrl}`;
      return true;
    }
  } catch (_) {}

  statusIndicator.className = 'status-indicator offline';
  statusText.textContent = '离线';
  statusIndicator.title = `无法连接 ${serverUrl}，请确认后端服务已启动 (bun run start)`;
  return false;
}

// 3. Load Active Tab Info
async function loadActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTab = tab;
    itemTitleInput.value = tab.title || '';
    itemUrlText.textContent = tab.url || '';
    itemUrlText.title = tab.url || '';
  }
}

// 4. Load Vault Tags
async function loadTags(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/tags`);
    if (res.ok) {
      const data = await res.json();
      allTagsList = data.tags || [];
      renderSuggestedTags();
    }
  } catch (_) {}
}

function renderSuggestedTags() {
  suggestedTagsContainer.innerHTML = '';
  const unselectedTags = allTagsList.filter((t) => !selectedTags.has(t.name));

  if (unselectedTags.length > 0) {
    suggestedTagsWrapper.classList.remove('hidden');
    unselectedTags.slice(0, 8).forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggested-tag-btn';
      btn.textContent = `#${tag.name}`;
      btn.addEventListener('click', () => {
        addTag(tag.name);
      });
      suggestedTagsContainer.appendChild(btn);
    });
  } else {
    suggestedTagsWrapper.classList.add('hidden');
  }
}

// 5. Tag Management
function renderTagPills() {
  // Remove existing pills except input
  const existingPills = tagsContainer.querySelectorAll('.tag-pill');
  existingPills.forEach((p) => p.remove());

  selectedTags.forEach((tagName) => {
    const pill = document.createElement('span');
    pill.className = 'tag-pill';
    pill.innerHTML = `
      <span>#${tagName}</span>
      <span class="remove-tag" title="移除">&times;</span>
    `;

    pill.querySelector('.remove-tag').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTag(tagName);
    });

    tagsContainer.insertBefore(pill, tagInput);
  });

  renderSuggestedTags();
}

function addTag(name) {
  const clean = name.trim().replace(/^#/, '').trim();
  if (clean && !selectedTags.has(clean)) {
    selectedTags.add(clean);
    renderTagPills();
  }
  tagInput.value = '';
}

function removeTag(name) {
  selectedTags.delete(name);
  renderTagPills();
}

// Tag input listener
tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
    e.preventDefault();
    if (tagInput.value.trim()) {
      addTag(tagInput.value);
    }
  } else if (e.key === 'Backspace' && !tagInput.value && selectedTags.size > 0) {
    const tagsArr = Array.from(selectedTags);
    removeTag(tagsArr[tagsArr.length - 1]);
  }
});

// 6. Settings Drawer Toggle
btnSettingsToggle.addEventListener('click', () => {
  settingsDrawer.classList.toggle('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
  let url = serverUrlInput.value.trim();
  if (!url) url = DEFAULT_SERVER_URL;
  url = url.replace(/\/$/, ''); // Remove trailing slash

  await chrome.storage.local.set({ vaultServerUrl: url });
  serverUrlInput.value = url;
  settingsDrawer.classList.add('hidden');

  showToast('服务地址已更新');
  const isOnline = await checkServerHealth(url);
  if (isOnline) loadTags(url);
});

// 7. Capture Submit
btnSave.addEventListener('click', handleSave);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  }
});

async function handleSave() {
  if (!currentTab || !currentTab.url) {
    showError('无法获取当前网页链接');
    return;
  }

  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = config.vaultServerUrl || DEFAULT_SERVER_URL;

  const title = itemTitleInput.value.trim() || currentTab.title || currentTab.url;
  const url = currentTab.url;
  const note = itemNoteInput.value.trim();

  // Combine typed tags with note text for hashtag auto-extraction
  const tagNames = Array.from(selectedTags);

  setLoading(true);

  try {
    const res = await fetch(`${serverUrl}/api/items/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title,
        description: note ? `${note} ${tagNames.map((t) => `#${t}`).join(' ')}` : tagNames.map((t) => `#${t}`).join(' '),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '保存失败');
    }

    // Switch to success view
    captureView.classList.add('hidden');
    successView.classList.remove('hidden');
  } catch (err) {
    showError(err.message || '网络连接失败，请确认 Vault 服务已启动');
  } finally {
    setLoading(false);
  }
}

// 8. Success actions
btnOpenVault.addEventListener('click', async () => {
  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = config.vaultServerUrl || DEFAULT_SERVER_URL;
  chrome.tabs.create({ url: `${serverUrl}/` });
  window.close();
});

btnClose.addEventListener('click', () => {
  window.close();
});

// 9. UI Helpers
function setLoading(loading) {
  btnSave.disabled = loading;
  if (loading) {
    btnSaveText.textContent = '保存中...';
    btnSpinner.classList.remove('hidden');
  } else {
    btnSaveText.textContent = '保存到 Inbox';
    btnSpinner.classList.add('hidden');
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => {
    errorToast.classList.add('hidden');
  }, 4000);
}

function showToast(msg) {
  errorToast.style.backgroundColor = '#10b981';
  errorMsg.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => {
    errorToast.classList.add('hidden');
    errorToast.style.backgroundColor = '#ef4444';
  }, 2500);
}
