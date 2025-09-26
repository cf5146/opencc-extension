import { convertAllNewTextNodes, convertTitle } from './core/conversion.js';
import type { OpenCCLocale } from './core/conversion.js';
import { Converter } from './lib/opencc/index.js';
import { matchesWhitelist } from './core/whitelist.js';
import { setupAutoObserver } from './content/observer.js';

interface Settings { origin: OpenCCLocale; target: OpenCCLocale; auto: boolean; whitelist: string[] }
const defaultSettings: Settings = { origin: 'cn', target: 'hk', auto: false, whitelist: [] };

async function getSettings(): Promise<Settings> {
  const raw = await chrome.storage.local.get(defaultSettings);
  return raw as Settings; // external API untyped; single cast centralized
}

// legacy inline whitelist matcher replaced by cached utility

function convertSelectedTextNodes(origin: OpenCCLocale, target: OpenCCLocale) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const convert = Converter({ from: origin, to: target });
  const iterateTextNodes = (nodes: Iterable<Node>, callback: (n: Text) => void) => {
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) callback(node as Text);
      else iterateTextNodes(node.childNodes as any, callback);
    }
  };
  const range = selection.getRangeAt(0);
  const contents = range.cloneContents();
  iterateTextNodes([contents], (textNode) => {
    const originalText = textNode.nodeValue;
    if (!originalText) return;
    const convertedText = convert(originalText);
    if (convertedText === originalText) return;
    textNode.nodeValue = convertedText;
  });
  range.deleteContents();
  range.insertNode(contents);
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
      } else if (action === 'select') convertSelectedTextNodes(settings.origin, settings.target);
    }
  })();
  return true; // keep message channel alive
});
