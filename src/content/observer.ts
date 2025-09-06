import { convertAllNewTextNodes, convertTitle, resetConversionCache } from '../core/conversion.js';
import { matchesWhitelist } from '../core/whitelist.js';
import type { OpenCCLocale } from '../core/conversion.js';

export interface Settings { origin: OpenCCLocale; target: OpenCCLocale; auto: boolean; whitelist: string[] }

export function setupAutoObserver(getSettings: () => Promise<Settings>) {
  let currentURL = '';
  let pendingScan = false;
  const lang = document.documentElement.lang;
  if (lang && !lang.startsWith('zh')) return; // bail for non-Chinese pages

  const observer = new MutationObserver(async () => {
    const settings = await getSettings();
    if (!settings.auto || settings.origin === settings.target) return;
    if (matchesWhitelist(window.location.href, settings.whitelist)) return;
    if (currentURL !== window.location.href) {
      currentURL = window.location.href;
      convertTitle(settings.origin, settings.target);
      resetConversionCache();
    }
    if (!pendingScan) {
      pendingScan = true;
      setTimeout(() => {
        pendingScan = false;
        convertAllNewTextNodes(settings.origin, settings.target);
      }, 120);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
