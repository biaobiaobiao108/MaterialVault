// Material Vault Background Service Worker (Manifest V3)
const DEFAULT_SERVER_URL = 'http://localhost:3000';

// 1. Register Context Menus on Installation
chrome.runtime.onInstalled.addListener(() => {
  // Save Page
  chrome.contextMenus.create({
    id: 'vault_save_page',
    title: '保存当前网页到 Material Vault',
    contexts: ['page'],
  });

  // Save Selected Text
  chrome.contextMenus.create({
    id: 'vault_save_selection',
    title: '保存选中文本为备忘素材',
    contexts: ['selection'],
  });

  // Save Image
  chrome.contextMenus.create({
    id: 'vault_save_image',
    title: '保存图片到 Material Vault',
    contexts: ['image'],
  });
});

// 2. Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const config = await chrome.storage.local.get(['vaultServerUrl']);
  const serverUrl = (config.vaultServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');

  if (info.menuItemId === 'vault_save_page') {
    if (tab && tab.url) {
      await captureUrl(serverUrl, tab.url, tab.title || tab.url);
    }
  } else if (info.menuItemId === 'vault_save_selection') {
    if (info.selectionText) {
      await captureNote(
        serverUrl,
        info.selectionText,
        tab?.title ? `摘录自：${tab.title}` : '网页文本摘录'
      );
    }
  } else if (info.menuItemId === 'vault_save_image') {
    if (info.srcUrl) {
      await captureUrl(
        serverUrl,
        info.srcUrl,
        tab?.title ? `图片素材（来自 ${tab.title}）` : '网络图片素材'
      );
    }
  }
});

// 3. Handle Keyboard Shortcut Commands (e.g. Alt+S)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save_current_tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const config = await chrome.storage.local.get(['vaultServerUrl']);
      const serverUrl = (config.vaultServerUrl || DEFAULT_SERVER_URL).replace(/\/$/, '');
      await captureUrl(serverUrl, tab.url, tab.title || tab.url);
    }
  }
});

// 4. API Request Helpers
async function captureUrl(serverUrl, url, title) {
  try {
    const res = await fetch(`${serverUrl}/api/items/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存失败');

    notify('Material Vault 保存成功', data.isDuplicate ? '该链接此前已存在素材库中' : '网页链接已加入收件箱，后台正在自动归档证据...');
  } catch (err) {
    notify('Material Vault 保存失败', err.message || '请确认本地服务已启动 (bun run start)');
  }
}

async function captureNote(serverUrl, content, title) {
  try {
    const res = await fetch(`${serverUrl}/api/items/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存失败');

    notify('Material Vault 备忘记录成功', '选中文本已存入收件箱！');
  } catch (err) {
    notify('Material Vault 记录失败', err.message || '请确认本地服务已启动 (bun run start)');
  }
}

// 5. System Notifications Helper
function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 2,
  });
}
