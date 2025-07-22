import { Converter } from "opencc-js";

const defaultSettings = { origin: "cn", target: "hk", auto: false, once: true, whitelist: [] };
const zeroWidthSpace = String.fromCharCode(8203);

// Utility functions for zero-width space handling
const removeZeroWidthSpaces = (text) => {
  return text.replace(new RegExp(zeroWidthSpace, 'g'), "");
};

const addZeroWidthSpaces = (text) => {
  // Insert zero-width spaces at word boundaries instead of between every character
  // This is more performance-friendly and less intrusive
  return text.replace(/(\S+)/g, `$1${zeroWidthSpace}`);
};

const matchWhitelist = (whitelist, url) => whitelist.map((p) => new RegExp(p)).some((re) => re.test(url));

function convertTitle({ origin, target, once }) {
  const convert = Converter({ from: origin, to: target });
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
  const convert = Converter({ from: origin, to: target });
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
  const convert = Converter({ from: origin, to: target });
  const iterateTextNodes = (nodes, callback) => {
    for (const node of nodes) {
      if (node.nodeType === 3) callback(node);
      else iterateTextNodes(node.childNodes, callback);
    }
  };
  const range = window.getSelection().getRangeAt(0);
  const contents = range.cloneContents();
  iterateTextNodes([contents], (textNode) => {
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
    return true;
  });
  // TODO: Improve handling of selected text spanning multiple containers
  // Currently this may disrupt DOM structure when selection spans multiple elements
  range.deleteContents() || range.insertNode(contents);
}

/* Mount trigger to auto convert when DOM changes. */
let currentURL = "";
const lang = document.documentElement.lang;
if (!lang || lang.startsWith("zh"))
  new MutationObserver(async () => {
    const settings = await chrome.storage.local.get(defaultSettings);
    if (!settings.auto || settings.origin === settings.target) return;
    if (matchWhitelist(settings.whitelist, window.location.href)) return;
    if (currentURL !== window.location.href) {
      currentURL = window.location.href;
      convertTitle(settings);
    }
    convertAllTextNodes(settings);
  }).observe(document.body, { childList: true, subtree: true });

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
