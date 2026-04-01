import { autoSetting } from '../utils/storage';

export default defineBackground(() => {
  // Context menu for selection conversion
  function createOrUpdateContextMenu() {
    try {
      browser.contextMenus.remove('convert-selection', () => {
        if (browser.runtime.lastError) {
          /* ignored */
        }
        browser.contextMenus.create(
          {
            id: 'convert-selection',
            title: 'Convert Chinese Characters',
            contexts: ['selection'],
          },
          () => {
            const msg = browser.runtime.lastError?.message;
            if (msg && !/duplicate id/i.test(msg)) {
              console.warn('OpenCC context menu create error:', msg);
            }
          },
        );
      });
    } catch {
      // No-op
    }
  }

  browser.runtime.onInstalled.addListener(() => createOrUpdateContextMenu());
  createOrUpdateContextMenu();

  // Handle context menu clicks
  browser.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === 'convert-selection') {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id != null) {
        browser.tabs.sendMessage(tabs[0].id, { action: 'select', text: info.selectionText });
      }
    }
  });

  // Badge
  browser.action.setBadgeBackgroundColor({ color: 'white' });

  (async () => {
    const auto = await autoSetting.getValue();
    browser.action.setBadgeText({ text: auto ? 'A' : '' });
  })();

  // React to auto mode toggles
  autoSetting.watch((newVal) => {
    browser.action.setBadgeText({ text: newVal ? 'A' : '' });
  });

  // Handle popup ensure-script request: try pinging the content script
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.action === 'ensure-script') {
      // Nothing to do — content script is manifest-registered.
      // The popup uses executeScript as a fallback if messaging fails.
      sendResponse({ ok: true });
    }
  });
});
