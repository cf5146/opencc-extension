import { Converter } from "./opencc.min.js";

const defaultSettings = { origin: "cn", target: "hk", auto: false, whitelist: [] };

const converterCache = {};
const getConverter = (origin, target) => {
  const key = `${origin}-${target}`;
  if (!converterCache[key]) {
    converterCache[key] = Converter({ from: origin, to: target });
  }
  return converterCache[key];
};

const matchWhitelist = (whitelist, url) => whitelist.map((p) => new RegExp(p)).some((re) => re.test(url));

function convertTitle(origin, target) {
  const convert = getConverter(origin, target);
  document.title = convert(document.title);
}

function convertAllTextNodes(origin, target) {
  const convert = getConverter(origin, target);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node;
  while ((node = walker.nextNode())) {
    const originalText = node.nodeValue;
    if (originalText && originalText.trim().length > 0) {
      const convertedText = convert(originalText);
      if (convertedText !== originalText) {
        node.nodeValue = convertedText;
        count++;
      }
    }
  }
  return count;
}

function convertSelectedTextNodes(origin, target) {
  const convert = getConverter(origin, target);

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });

  let node;
  while ((node = walker.nextNode())) {
    const startOffset = node === range.startContainer ? range.startOffset : 0;
    const endOffset = node === range.endContainer ? range.endOffset : node.nodeValue.length;
    const originalText = node.nodeValue.substring(startOffset, endOffset);
    if (originalText && originalText.trim().length > 0) {
      const convertedText = convert(originalText);
      if (convertedText !== originalText) {
        const fullText = node.nodeValue;
        node.nodeValue = fullText.substring(0, startOffset) + convertedText + fullText.substring(endOffset);
      }
    }
  }
}

/* Mount trigger to auto convert when DOM changes. */
let currentURL = "";
const lang = document.documentElement.lang;
let mutationDebounceTimer;

const mutationHandler = (mutations) => {
  clearTimeout(mutationDebounceTimer);
  mutationDebounceTimer = setTimeout(async () => {
    const settings = await chrome.storage.local.get(defaultSettings);
    if (!settings.auto || settings.origin === settings.target) return;
    if (matchWhitelist(settings.whitelist, window.location.href)) return;

    if (currentURL !== window.location.href) {
      currentURL = window.location.href;
      convertTitle(settings.origin, settings.target);
    }

    const convert = getConverter(settings.origin, settings.target);
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const originalText = node.nodeValue;
          if (originalText && originalText.trim().length > 0) {
            const convertedText = convert(originalText);
            if (convertedText !== originalText) {
              node.nodeValue = convertedText;
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let textNode;
          while ((textNode = walker.nextNode())) {
            const originalText = textNode.nodeValue;
            if (originalText && originalText.trim().length > 0) {
              const convertedText = convert(originalText);
              if (convertedText !== originalText) {
                textNode.nodeValue = convertedText;
              }
            }
          }
        }
      }
    }
  }, 500);
};

if (!lang || lang.startsWith("zh")) {
  const observer = new MutationObserver(mutationHandler);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/* Run convert once DOM ready when in auto mode. */
chrome.storage.local.get(defaultSettings).then((settings) => {
  if (!settings.auto) return;
  if (matchWhitelist(settings.whitelist, window.location.href)) return;
  convertTitle(settings.origin, settings.target);
  convertAllTextNodes(settings.origin, settings.target);
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
        const count = convertAllTextNodes(settings.origin, settings.target);
        sendResponse({ count, time: Date.now() - start });
      } else if (action === "select") {
        convertSelectedTextNodes(settings.origin, settings.target);
      }
    }
  })();
  return true; // eliminate error: 'the message port closed before a response was received'
});
