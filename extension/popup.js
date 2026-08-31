// Material Vault Popup Client Script
const DEFAULT_SERVER_URL = 'http://localhost:3000';

let currentTab = null;
let allTagsList = [];
let closeCountdownTimer = null;
let countdownRemaining = 3;

// DOM Element references
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const btnSettingsToggle = document.getElementById('btn-settings-toggle');
const btnSettingsClose = document.getElementById('btn-settings-close');
const settingsDrawer = document.getElementById('settings-drawer');
const serverUrlInput = document.getElementById('server-url');
const btnSaveSettings = document.getElementById('btn-save-settings');

const domainBadge = document.getElementById('domain-badge');
const urlText = document.getElementById('url-text');
const itemTitleInput = document.getElementById('item-title');
const itemNoteInput = document.getElementById('item-note');

const tagsSection = document.getElementById('tags-section');
const tagsPillsList = document.getElementById('tags-pills-list');
const quickTagSelect = document.getElementById('quick-tag-select');

const btnSave = document.getElementById('btn-save');
const btnSaveIcon = document.getElementById('btn-save-icon');
const btnSaveText = document.getElementById('btn-save-text');
const btnSpinner = document.getElementById('btn-spinner');

const captureView = document.getElementById('capture-view');
const successView = document.getElementById('success-view');
const btnOpenVault = document.getElementById('btn-open-vault');
const btnClosePopup = document.getElementById('btn-close-popup');
const closeCountdownText = document.getElementById('close-countdown-text');

const errorToast = document.getElementById('error-toast');
const errorMsg = document.getElementById('error-msg');

// 1. Initialization on DOM Loaded
document.addEventListener('DOMContentLoaded', async () => {
  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = (config.vaultServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
  serverUrlInput.value = serverUrl;

  await checkServerHealth(serverUrl);
  await loadActiveTabInfo();
  await loadTags(serverUrl);

  // Set up real-time #tag detection listeners
  itemTitleInput.addEventListener('input', updateExtractedTags);
  itemNoteInput.addEventListener('input', updateExtractedTags);
});

// 2. Check Backend Server Health
async function checkServerHealth(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/stats`, { method: 'GET' });
    if (res.ok) {
      statusPill.className = 'status-pill online';
      statusText.textContent = '在线';
      statusPill.title = `已连接至 ${serverUrl}`;
      return true;
    }
  } catch (_) {}

  statusPill.className = 'status-pill offline';
  statusText.textContent = '离线';
  statusPill.title = `无法连接 ${serverUrl}，请启动后端服务 (bun run start)`;
  return false;
}

// 3. Load Active Tab Info & Domain
async function loadActiveTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTab = tab;
    itemTitleInput.value = tab.title || '';
    urlText.textContent = tab.url || '';
    urlText.title = tab.url || '';

    try {
      const parsedUrl = new URL(tab.url);
      domainBadge.textContent = parsedUrl.hostname.replace(/^www\./, '');
    } catch (_) {
      domainBadge.textContent = 'Web';
    }

    updateExtractedTags();
  }
}

// 4. Load Vault Tags from Database
async function loadTags(serverUrl) {
  try {
    const res = await fetch(`${serverUrl}/api/tags`);
    if (res.ok) {
      const data = await res.json();
      allTagsList = data.tags || [];
      populateQuickTagSelect();
    }
  } catch (_) {}
}

function populateQuickTagSelect() {
  quickTagSelect.innerHTML = '<option value="">+ 关联已有标签</option>';
  allTagsList.forEach((tag) => {
    const opt = document.createElement('option');
    opt.value = tag.name;
    opt.textContent = `#${tag.name}`;
    quickTagSelect.appendChild(opt);
  });
}

// 5. Real-time Hashtag Detection & Pill Rendering (matching QuickCapture.tsx)
function extractHashtagsFromText(text) {
  if (!text) return [];
  const matches = text.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu);
  if (!matches) return [];

  const set = new Set();
  for (const m of matches) {
    const clean = m.trim().replace(/^#/, '').trim();
    if (clean.length > 0) set.add(clean);
  }
  return Array.from(set);
}

function updateExtractedTags() {
  const combinedText = `${itemTitleInput.value} ${itemNoteInput.value}`;
  const tags = extractHashtagsFromText(combinedText);

  tagsPillsList.innerHTML = '';

  if (tags.length > 0) {
    tagsSection.classList.remove('hidden');
    tags.forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `
        <span>#${tag}</span>
        <span class="remove-btn" title="移除标签">&times;</span>
      `;

      pill.querySelector('.remove-btn').addEventListener('click', () => {
        removeTagFromInputs(tag);
      });

      tagsPillsList.appendChild(pill);
    });
  } else {
    tagsSection.classList.add('hidden');
  }
}

function removeTagFromInputs(tagName) {
  const regex = new RegExp(`(?:^|\\s)#${tagName}(?=\\s|$)`, 'g');
  itemNoteInput.value = itemNoteInput.value.replace(regex, ' ').trim();
  itemTitleInput.value = itemTitleInput.value.replace(regex, ' ').trim();
  updateExtractedTags();
}

// When user picks a tag from dropdown, insert into note
quickTagSelect.addEventListener('change', (e) => {
  const selectedTag = e.target.value;
  if (selectedTag) {
    const currentNote = itemNoteInput.value;
    if (!currentNote.includes(`#${selectedTag}`)) {
      itemNoteInput.value = currentNote ? `${currentNote.trim()} #${selectedTag} ` : `#${selectedTag} `;
      updateExtractedTags();
    }
    quickTagSelect.value = '';
    itemNoteInput.focus();
  }
});

// 6. Settings Drawer Logic
btnSettingsToggle.addEventListener('click', () => {
  settingsDrawer.classList.toggle('hidden');
});

btnSettingsClose.addEventListener('click', () => {
  settingsDrawer.classList.add('hidden');
});

btnSaveSettings.addEventListener('click', async () => {
  let url = serverUrlInput.value.trim();
  if (!url) url = DEFAULT_SERVER_URL;
  url = url.replace(/\/$/, '');

  await chrome.storage.local.set({ vaultServerUrl: url });
  serverUrlInput.value = url;
  settingsDrawer.classList.add('hidden');

  const isOnline = await checkServerHealth(url);
  if (isOnline) loadTags(url);
});

// 7. Save Submission
btnSave.addEventListener('click', handleSave);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  }
});

async function handleSave() {
  if (!currentTab || !currentTab.url) {
    showError('无法获取当前标签页链接');
    return;
  }

  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = (config.vaultServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');

  const title = itemTitleInput.value.trim() || currentTab.title || currentTab.url;
  const url = currentTab.url;
  const description = itemNoteInput.value.trim();

  setLoading(true);

  try {
    const res = await fetch(`${serverUrl}/api/items/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title,
        description,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '保存失败');
    }

    // Switch to success view
    captureView.classList.add('hidden');
    successView.classList.remove('hidden');

    startCountdown();
  } catch (err) {
    showError(err.message || '连接失败，请确认 Material Vault 本地服务已启动');
  } finally {
    setLoading(false);
  }
}

// 8. Success View Actions & Auto-close Timer
function startCountdown() {
  countdownRemaining = 3;
  closeCountdownText.textContent = `关闭弹窗 (${countdownRemaining}s)`;

  closeCountdownTimer = setInterval(() => {
    countdownRemaining--;
    if (countdownRemaining <= 0) {
      clearInterval(closeCountdownTimer);
      window.close();
    } else {
      closeCountdownText.textContent = `关闭弹窗 (${countdownRemaining}s)`;
    }
  }, 1000);
}

btnOpenVault.addEventListener('click', async () => {
  if (closeCountdownTimer) clearInterval(closeCountdownTimer);
  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = (config.vaultServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
  chrome.tabs.create({ url: `${serverUrl}/` });
  window.close();
});

btnClosePopup.addEventListener('click', () => {
  if (closeCountdownTimer) clearInterval(closeCountdownTimer);
  window.close();
});

// 9. UI Helpers
function setLoading(loading) {
  btnSave.disabled = loading;
  if (loading) {
    btnSaveIcon.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    btnSaveText.textContent = '保存中...';
  } else {
    btnSaveIcon.classList.remove('hidden');
    btnSpinner.classList.add('hidden');
    btnSaveText.textContent = '保存素材';
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorToast.classList.remove('hidden');
  setTimeout(() => {
    errorToast.classList.add('hidden');
  }, 4000);
}
