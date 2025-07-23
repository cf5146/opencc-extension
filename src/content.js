import { Converter } from "opencc-js";

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
  const iterateTextNodes = (node, callback) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    while ((textNode = walker.nextNode())) {
      callback(textNode);
    }
  };

  let count = 0;
  iterateTextNodes(document.body, (textNode) => {
    const originalText = textNode.nodeValue;
    if (!originalText || originalText.trim().length === 0) return;
    const convertedText = convert(originalText);
    if (convertedText !== originalText) {
      textNode.nodeValue = convertedText;
      count++;
    }
  });

  return count;
}

function convertSelectedTextNodes(origin, target) {
  const convert = getConverter(origin, target);

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);

  const processTextNode = (textNode, startOffset = 0, endOffset = textNode.length) => {
    const originalText = textNode.nodeValue.substring(startOffset, endOffset);
    if (!originalText || originalText.trim().length === 0) return;

    const convertedText = convert(originalText);
    if (convertedText !== originalText) {
      const fullText = textNode.nodeValue;
      textNode.nodeValue = fullText.substring(0, startOffset) + convertedText + fullText.substring(endOffset);
    }
  };

  if (range.startContainer === range.endContainer && range.startContainer.nodeType === 3) {
    processTextNode(range.startContainer, range.startOffset, range.endOffset);
    return;
  }

  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    },
    false,
  );

  let textNode;
  while ((textNode = walker.nextNode())) {
    if (textNode === range.startContainer && textNode === range.endContainer) {
      processTextNode(textNode, range.startOffset, range.endOffset);
    } else if (textNode === range.startContainer) {
      processTextNode(textNode, range.startOffset, textNode.length);
    } else if (textNode === range.endContainer) {
      processTextNode(textNode, 0, range.endOffset);
    } else {
      processTextNode(textNode, 0, textNode.length);
    }
  }
}

/* Mount trigger to auto convert when DOM changes. */
let currentURL = "";
const lang = document.documentElement.lang;
if (!lang || lang.startsWith("zh")) {
  new MutationObserver(async () => {
    const settings = await chrome.storage.local.get(defaultSettings);
    if (!settings.auto || settings.origin === settings.target) return;
    if (matchWhitelist(settings.whitelist, window.location.href)) return;

    if (currentURL !== window.location.href) {
      currentURL = window.location.href;
      convertTitle(settings.origin, settings.target);
    }
    convertAllTextNodes(settings.origin, settings.target);
  }).observe(document.body, {
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
