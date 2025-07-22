import { Converter } from "opencc-js";

const defaultSettings = { origin: "cn", target: "hk", auto: false, once: true, whitelist: [] };
const zeroWidthSpace = String.fromCharCode(8203);

// Cached converters to avoid repeated initialization
const converterCache = new Map();

// Pre-compiled regex for better performance
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

// Utility functions for zero-width space handling
const removeZeroWidthSpaces = (text) => {
  return text.replace(zeroWidthSpaceRegex, "");
};

const addZeroWidthSpaces = (text) => {
  // Insert zero-width spaces at word boundaries instead of between every character
  // This is more performance-friendly and less intrusive
  return text.replace(/(\S+)/g, `$1${zeroWidthSpace}`);
};

// Get or create cached converter
const getConverter = (origin, target) => {
  const key = `${origin}-${target}`;
  if (!converterCache.has(key)) {
    converterCache.set(key, Converter({ from: origin, to: target }));
  }
  return converterCache.get(key);
};

const matchWhitelist = (whitelist, url) => whitelist.map((p) => new RegExp(p)).some((re) => re.test(url));

function convertTitle({ origin, target, once }) {
  const convert = getConverter(origin, target);
  // Remove existing zero-width spaces before conversion to avoid interference
  const cleanTitle = once ? removeZeroWidthSpaces(document.title) : document.title;
  let convertedTitle = convert(cleanTitle);

  // Only add zero-width spaces if conversion actually occurred and once mode is enabled
  if (once && convertedTitle !== cleanTitle) {
    convertedTitle = addZeroWidthSpaces(convertedTitle);
  }

  document.title = convertedTitle;
}

function convertAllTextNodes({ origin, target, once }) {
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

    // Skip empty or whitespace-only text nodes
    if (!originalText || originalText.trim().length === 0) return;

    // Remove existing zero-width spaces before conversion to avoid interference
    const cleanText = once ? removeZeroWidthSpaces(originalText) : originalText;
    let convertedText = convert(cleanText);

    // Skip if no conversion occurred
    if (convertedText === cleanText) return;

    // Add zero-width spaces if once mode is enabled and conversion occurred
    if (once) {
      convertedText = addZeroWidthSpaces(convertedText);
    }

    textNode.nodeValue = convertedText;
    count++;
  });
  return count;
}

function convertSelectedTextNodes({ origin, target, once }) {
  const convert = getConverter(origin, target);

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);

  // Improved handling for text spanning multiple containers
  const processTextNode = (textNode, startOffset = 0, endOffset = textNode.length) => {
    const originalText = textNode.nodeValue.substring(startOffset, endOffset);

    // Skip empty or whitespace-only text nodes
    if (!originalText || originalText.trim().length === 0) return false;

    // Remove existing zero-width spaces before conversion to avoid interference
    const cleanText = once ? removeZeroWidthSpaces(originalText) : originalText;
    let convertedText = convert(cleanText);

    // Skip if no conversion occurred
    if (convertedText === cleanText) return false;

    // Add zero-width spaces if once mode is enabled and conversion occurred
    if (once) {
      convertedText = addZeroWidthSpaces(convertedText);
    }

    // Replace the specific portion of the text node
    const fullText = textNode.nodeValue;
    textNode.nodeValue = fullText.substring(0, startOffset) + convertedText + fullText.substring(endOffset);
    return true;
  };

  // Handle single text node selection
  if (range.startContainer === range.endContainer && range.startContainer.nodeType === 3) {
    processTextNode(range.startContainer, range.startOffset, range.endOffset);
    return;
  }

  // Handle multi-node selection by processing each text node within the range
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
      // Single text node case (already handled above, but for completeness)
      processTextNode(textNode, range.startOffset, range.endOffset);
    } else if (textNode === range.startContainer) {
      // First text node in selection
      processTextNode(textNode, range.startOffset, textNode.length);
    } else if (textNode === range.endContainer) {
      // Last text node in selection
      processTextNode(textNode, 0, range.endOffset);
    } else {
      // Middle text nodes - convert entirely
      processTextNode(textNode, 0, textNode.length);
    }
  }
}

/* Mount trigger to auto convert when DOM changes. */
let currentURL = "";
let mutationTimeout = null;

// Debounced function to handle mutations
const debouncedMutationHandler = async () => {
  const settings = await chrome.storage.local.get(defaultSettings);
  if (!settings.auto || settings.origin === settings.target) return;
  if (matchWhitelist(settings.whitelist, window.location.href)) return;

  if (currentURL !== window.location.href) {
    currentURL = window.location.href;
    convertTitle(settings);
  }
  convertAllTextNodes(settings);
};

const lang = document.documentElement.lang;
if (!lang || lang.startsWith("zh")) {
  new MutationObserver(() => {
    // Debounce mutations to avoid excessive conversions
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(debouncedMutationHandler, 100);
  }).observe(document.body, {
    childList: true,
    subtree: true,
    // Only observe text changes, not all attribute changes
    characterData: true,
  });
}

/* Run convert once DOM ready when in auto mode. */
chrome.storage.local.get(defaultSettings).then((settings) => {
  if (!settings.auto) return;
  if (matchWhitelist(settings.whitelist, window.location.href)) return;
  convertTitle(settings);
  convertAllTextNodes(settings);
});

/* Run convert on all nodes when triggered by button click in popup. */
// NOTE: listener itself cannot be async function, see https://stackoverflow.com/questions/48107746.
chrome.runtime.onMessage.addListener(({ action }, _, sendResponse) => {
  (async () => {
    const settings = await chrome.storage.local.get(defaultSettings);
    if (settings.origin !== settings.target) {
      if (action === "click") {
        const start = Date.now();
        convertTitle(settings);
        const count = convertAllTextNodes(settings);
        sendResponse({ count, time: Date.now() - start });
      } else if (action === "select") convertSelectedTextNodes(settings);
    }
  })();
  return true; // eliminate error: 'the message port closed before a response was received'
});
