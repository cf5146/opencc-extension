import { convertAllNewTextNodes, convertTitle, resetConversionCache } from "./conversion.js";
import { Converter } from "opencc-js";

const defaultSettings = { origin: "cn", target: "hk", auto: false, whitelist: [] };

const matchWhitelist = (whitelist, url) => whitelist.map((p) => new RegExp(p)).some((re) => re.test(url));

// content.js now delegates conversion logic to conversion.js helpers

function convertSelectedTextNodes(origin, target) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const convert = Converter({ from: origin, to: target });
  const iterateTextNodes = (nodes, callback) => {
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) callback(node);
      else iterateTextNodes(node.childNodes, callback);
    }
  };
  const range = selection.getRangeAt(0);
  const contents = range.cloneContents();
  iterateTextNodes([contents], (textNode) => {
    const originalText = textNode.nodeValue;
    const convertedText = convert(originalText);
    if (convertedText === originalText) return;
    textNode.nodeValue = convertedText;
  });
  // NOTE: If selection spans multiple containers DOM structure may change; acceptable trade-off currently.
  range.deleteContents();
  range.insertNode(contents);
}

/* Mount trigger to auto convert when DOM changes. */
let currentURL = "";
let pendingScan = false;
const lang = document.documentElement.lang;
if (!lang || lang.startsWith("zh")) {
  const observer = new MutationObserver(async () => {
    const settings = await chrome.storage.local.get(defaultSettings);
    if (!settings.auto || settings.origin === settings.target) return;
    if (matchWhitelist(settings.whitelist, window.location.href)) return;
    if (currentURL !== window.location.href) {
      currentURL = window.location.href;
      convertTitle(settings.origin, settings.target);
      // reset processed set on navigation
  resetConversionCache();
    }
    if (!pendingScan) {
      pendingScan = true;
      setTimeout(() => {
        pendingScan = false;
        convertAllNewTextNodes(settings.origin, settings.target);
      }, 120); // debounce to allow phrase contexts to settle
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/* Run convert once DOM ready when in auto mode. */
chrome.storage.local.get(defaultSettings).then((settings) => {
  if (!settings.auto) return;
  if (matchWhitelist(settings.whitelist, window.location.href)) return;
  convertTitle(settings.origin, settings.target);
  convertAllNewTextNodes(settings.origin, settings.target);
});

/* Run convert on all nodes when triggered by button click in popup. */
// NOTE: listener itself cannot be async function, see https://stackoverflow.com/questions/48107746.
chrome.runtime.onMessage.addListener(({ action }, _, sendResponse) => {
  (async () => {
    const settings = await chrome.storage.local.get(defaultSettings);
    if (settings.origin !== settings.target) {
      if (action === "click") {
        const start = Date.now();
        convertTitle(settings.origin, settings.target);
  const count = convertAllNewTextNodes(settings.origin, settings.target);
        sendResponse({ count, time: Date.now() - start });
      } else if (action === "select") convertSelectedTextNodes(settings.origin, settings.target);
    }
  })();
  return true; // eliminate error: 'the message port closed before a response was received'
});
