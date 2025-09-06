chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'convert-selection',
    title: 'Convert Chinese Characters',
    contexts: ['selection'],
  });
  chrome.contextMenus.onClicked.addListener(async (info) => {
    if (info.menuItemId === 'convert-selection') {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id != null) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'select', text: info.selectionText });
      }
    }
  });
});

chrome.action.setBadgeBackgroundColor({ color: 'white' });

chrome.storage.local.get({ auto: false }).then(({ auto }) => {
  chrome.action.setBadgeText({ text: auto ? 'A' : '' });
});
