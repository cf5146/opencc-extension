import { convertAllTextNodes, convertTitle, convertTextNode, resetCaches } from './conversion.js';
import { matchesWhitelist } from './whitelist.js';
import { originSetting, targetSetting, autoSetting, whitelistSetting } from './storage.js';
import type { LocaleCode } from './storage.js';

function handleAddedNodes(nodes: NodeList, origin: LocaleCode, target: LocaleCode): number {
  let count = 0;
  for (const n of Array.from(nodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (convertTextNode(n as Text, origin, target)) count++;
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      count += convertAllTextNodes(origin, target, n as HTMLElement);
    }
  }
  return count;
}

let pendingScan = false;

function scheduleFallbackScan(origin: LocaleCode, target: LocaleCode): void {
  if (pendingScan) return;
  pendingScan = true;
  setTimeout(() => {
    pendingScan = false;
    convertAllTextNodes(origin, target);
  }, 250);
}

let currentURL = '';

async function processMutations(mutations: MutationRecord[]): Promise<void> {
  const [origin, target, auto, whitelist] = await Promise.all([
    originSetting.getValue(),
    targetSetting.getValue(),
    autoSetting.getValue(),
    whitelistSetting.getValue(),
  ]);

  if (!auto || origin === target) return;
  if (matchesWhitelist(globalThis.location.href, whitelist)) return;

  if (currentURL !== globalThis.location.href) {
    currentURL = globalThis.location.href;
    convertTitle(origin, target);
    resetCaches();
  }

  let incremental = 0;
  for (const m of mutations) {
    if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
      if (convertTextNode(m.target as Text, origin, target)) incremental++;
    }
    if (m.addedNodes?.length) {
      incremental += handleAddedNodes(m.addedNodes, origin, target);
    }
  }

  if (incremental === 0) scheduleFallbackScan(origin, target);
}

export function setupAutoObserver(): void {
  const lang = document.documentElement.lang;
  if (lang && !lang.startsWith('zh')) return;

  const observer = new MutationObserver((mutations) => {
    processMutations(mutations);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: false,
  });
}
