import { convertAllNewTextNodes, convertSelection, convertTitle } from './core/conversion.js';
import type { OpenCCLocale } from './core/conversion.js';
import { matchesWhitelist } from './core/whitelist.js';
import { setupAutoObserver } from './content/observer.js';

interface Settings { origin: OpenCCLocale; target: OpenCCLocale; auto: boolean; whitelist: string[] }
const defaultSettings: Settings = { origin: 'cn', target: 'hk', auto: false, whitelist: [] };

async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(defaultSettings);
  return raw as Settings; // external API untyped; single cast centralized
}

setupAutoObserver(getSettings);

getSettings().then((settings) => {
  if (!settings.auto) return;
  if (matchesWhitelist(window.location.href, settings.whitelist)) return;
  convertTitle(settings.origin, settings.target);
  convertAllNewTextNodes(settings.origin, settings.target);
});

chrome.runtime.onMessage.addListener(({ action }: { action: 'click' | 'select' }, _sender, sendResponse) => {
  (async () => {
    const settings = await getSettings();
    if (settings.origin !== settings.target) {
      if (action === 'click') {
        const start = Date.now();
        convertTitle(settings.origin, settings.target);
        const count = convertAllNewTextNodes(settings.origin, settings.target);
        sendResponse({ count, time: Date.now() - start });
      } else if (action === 'select') convertSelection(settings.origin, settings.target, window.getSelection());
    }
  })();
  return true; // keep message channel alive
});
