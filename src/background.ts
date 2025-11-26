// Ensure context menu exists (idempotent) and register click handler at top-level for MV3 service worker.
function createOrUpdateContextMenu() {
  // Remove first (ignore errors if not present), then create fresh to avoid duplicate id warnings.
  try {
    chrome.contextMenus.remove('convert-selection', () => {
      // Touch lastError to clear potential remove warning when item didn't exist.
      if (chrome.runtime.lastError) {/* ignored */}
      chrome.contextMenus.create(
        {
          id: 'convert-selection',
          title: 'Convert Chinese Characters',
          contexts: ['selection'],
        },
        () => {
          // Suppress duplicate warnings (should not happen after remove) but guard anyway.
            const msg = chrome.runtime.lastError?.message;
            if (msg && !/duplicate id/i.test(msg)) {
              console.warn('OpenCC context menu create error:', msg);
            }
        },
      );
    });
  } catch {
    // No-op; MV3 APIs shouldn't throw synchronously for these operations.
  }
}

chrome.runtime.onInstalled.addListener(() => createOrUpdateContextMenu());

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

(async () => { // NOSONAR
  const { auto } = await chrome.storage.local.get({ auto: false });
  chrome.action.setBadgeText({ text: auto ? 'A' : '' });
})();

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

(async () => { // NOSONAR
  await ensureContentScriptRegistered();
})();

// Re-register on extension update / service worker restart signals.
chrome.runtime.onInstalled.addListener(() => ensureContentScriptRegistered());

// React to auto mode toggles: register when enabling, unregister when disabling.
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !('auto' in changes)) return;
  const newVal = changes.auto.newValue as boolean;
  if (!chrome.scripting?.registerContentScripts) return;
  try {
    if (newVal) {
      await ensureContentScriptRegistered();
    } else {
      // Unregister to reduce footprint when auto mode off; manual conversions via popup will trigger on-demand messaging when tab active.
      await chrome.scripting.unregisterContentScripts({ ids: ['opencc-content'] });
    }
  } catch (e) {
    console.warn('OpenCC: content script (un)registration on auto toggle failed', e);
  }
});

// Lightweight message interface for popup to request script presence.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'ensure-script') {
    ensureContentScriptRegistered();
  }
});

// Test hook (only attached during Vitest / test environment)
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__opencc_test__ = { ensureContentScriptRegistered };
} catch {
  // ignore
}
