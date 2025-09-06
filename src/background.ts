// Ensure context menu exists (idempotent) and register click handler at top-level for MV3 service worker.
function createOrUpdateContextMenu() {
  try {
    chrome.contextMenus.create({
      id: 'convert-selection',
      title: 'Convert Chinese Characters',
      contexts: ['selection'],
    });
  } catch (e) {
    // Ignore only duplicate ID errors; rethrow others for visibility.
    const msg = (e as Error).message || '';
    if (!/duplicate id/i.test(msg)) throw e;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  createOrUpdateContextMenu();
});

// In case service worker restarted (not re-installed), recreate menu.
createOrUpdateContextMenu();

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'convert-selection') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id != null) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'select', text: info.selectionText });
    }
  }
});

chrome.action.setBadgeBackgroundColor({ color: 'white' });

chrome.storage.local.get({ auto: false }).then(({ auto }) => {
  chrome.action.setBadgeText({ text: auto ? 'A' : '' });
});

// Dynamically register content script (Chromium MV3). Firefox still uses static manifest for now.
async function ensureContentScriptRegistered() {
  if (!chrome.scripting?.registerContentScripts) return;
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ['opencc-content'] });
  if (existing?.length) return;
  } catch {
    // proceed to register
  }
  try {
    await chrome.scripting.registerContentScripts([
      {
        id: 'opencc-content',
        js: ['content.js'],
        matches: ['http://*/*', 'https://*/*'],
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch (e) {
    console.warn('OpenCC: dynamic content script registration failed', e);
  }
}

ensureContentScriptRegistered();

// Re-register on extension update / service worker restart signals.
chrome.runtime.onInstalled.addListener(() => ensureContentScriptRegistered());
