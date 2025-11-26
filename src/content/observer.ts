import { convertAllNewTextNodes, convertTitle, resetConversionCache, convertTextNode } from '../core/conversion.js';
import { matchesWhitelist } from '../core/whitelist.js';
import type { OpenCCLocale } from '../core/conversion.js';

export interface Settings { origin: OpenCCLocale; target: OpenCCLocale; auto: boolean; whitelist: string[] }

function handleAddedNodes(nodes: NodeList, origin: OpenCCLocale, target: OpenCCLocale) {
  let c = 0;
  for (const n of Array.from(nodes)) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (convertTextNode(origin, target, n as Text)) c++;
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      c += convertAllNewTextNodes(origin, target, n as HTMLElement);
    }
  }
  return c;
}

let pendingScan = false;

function scheduleFallbackScan(origin: OpenCCLocale, target: OpenCCLocale) {
  if (pendingScan) return;
  pendingScan = true;
  setTimeout(() => {
    pendingScan = false;
    convertAllNewTextNodes(origin, target);
  }, 250);
}

let currentURL = '';

async function processMutations(mutations: MutationRecord[], getSettings: () => Promise<Settings>) {
  const settings = await getSettings();
  if (!settings.auto || settings.origin === settings.target) return;
  if (matchesWhitelist(globalThis.location.href, settings.whitelist)) return;
  if (currentURL !== globalThis.location.href) {
    currentURL = globalThis.location.href;
    convertTitle(settings.origin, settings.target);
    resetConversionCache();
  }
  let incremental = 0;
  for (const m of mutations) {
    if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
      if (convertTextNode(settings.origin, settings.target, m.target as Text)) incremental++;
    }
    if (m.addedNodes?.length) incremental += handleAddedNodes(m.addedNodes, settings.origin, settings.target);
  }
  if (incremental === 0) scheduleFallbackScan(settings.origin, settings.target);
}

export function setupAutoObserver(getSettings: () => Promise<Settings>) {
  const lang = document.documentElement.lang;
  if (lang && !lang.startsWith('zh')) return; // bail for non-Chinese pages

  const observer = new MutationObserver((mutations) => { processMutations(mutations, getSettings); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, characterDataOldValue: false });
}
