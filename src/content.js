import { Converter } from "opencc-js";

const defaultSettings = { origin: "cn", target: "hk", auto: false, once: true, whitelist: [] };
const zeroWidthSpace = String.fromCharCode(8203);

// Cached converters to avoid repeated initialization
const converterCache = new Map();

// Pre-compiled regex for better performance
const zeroWidthSpaceRegex = new RegExp(zeroWidthSpace, "g");

// Utility functions for zero-width space handling with original text preservation
const removeZeroWidthSpaces = (text) => {
  // Remove our marking pattern: converted_text + ZWS + original_text + ZWS
  return text.replace(zeroWidthSpaceRegex, "");
};

const addZeroWidthSpaces = (text, originalText = null) => {
  // If we have the original text, store it as a marker to prevent re-conversion
  // Format: converted_text + ZWS + original_text + ZWS
  if (originalText && originalText !== text) {
    return text + zeroWidthSpace + originalText + zeroWidthSpace;
  }
  // Fallback to simple ZWS at the end if no original text provided
  return text + zeroWidthSpace;
};

// Extract the converted text and original text from marked text
const extractFromMarkedText = (text) => {
  const markerPattern = new RegExp(`(.+)${zeroWidthSpace}(.+)${zeroWidthSpace}$`);
  const match = text.match(markerPattern);
  if (match) {
    return {
      convertedText: match[1],
      originalText: match[2],
      wasConverted: true,
    };
  }
  return {
    convertedText: text,
    originalText: null,
    wasConverted: false,
  };
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

  if (once) {
    // Check if title was already converted
    const { convertedText, wasConverted } = extractFromMarkedText(document.title);
    if (wasConverted) {
      // Title was already converted, just update the display
      document.title = convertedText;
      return;
    }
    // Convert and mark with original
    let convertedTitle = convert(convertedText);
    if (convertedTitle !== convertedText) {
      convertedTitle = addZeroWidthSpaces(convertedTitle, convertedText);
    }
    document.title = convertedTitle;
  } else {
    // Normal conversion without marking
    const cleanTitle = removeZeroWidthSpaces(document.title);
    document.title = convert(cleanTitle);
  }
}

// Track processed nodes to prevent cascading conversions in auto mode
const processedNodes = new WeakSet();

// Helper function to check if conversion seems like cascading
const isCascadingConversion = (original, converted) => {
  if (converted === original) return false;

  // Only check for very obvious cascading patterns
  if (converted.length > original.length) {
    // Pattern 1: Check if the converted text contains the original as a complete substring
    // This catches "演算法" -> "演演算法" but not "算法" -> "演算法"
    if (converted.includes(original) && original.length >= 2) {
      return true;
    }

    // Pattern 2: Check for character repetition patterns at the beginning
    // This catches "演算法" -> "演演算法" pattern
    const firstChar = original.charAt(0);
    const secondChar = original.charAt(1);
    if (firstChar && secondChar && converted.startsWith(firstChar + firstChar + secondChar)) {
      return true;
    }
  }

  // Only block if ratio is extremely high (indicating obvious cascading)
  const lengthRatio = converted.length / original.length;
  return lengthRatio > 2.5; // Allow normal CN->TWP length increases
};

// Helper function to process text node in once mode
const processTextNodeOnceMode = (textNode, originalText, convert) => {
  const { convertedText: existingConverted, wasConverted } = extractFromMarkedText(originalText);

  if (wasConverted) {
    // Already converted, just display the converted text without changing nodeValue
    // to avoid triggering MutationObserver again
    if (textNode.nodeValue !== existingConverted) {
      textNode.nodeValue = existingConverted;
    }
    return false;
  }

  // Check if the text is already a converted result (to prevent cascading)
  const testConversion = convert(existingConverted);
  if (testConversion !== existingConverted && !isCascadingConversion(existingConverted, testConversion)) {
    const newConverted = addZeroWidthSpaces(testConversion, existingConverted);
    textNode.nodeValue = newConverted;
    return true;
  }
  return false;
};

// Helper function to process text node in normal mode
const processTextNodeNormalMode = (textNode, originalText, convert, isAutoMode = false) => {
  // In auto mode, check if we've already processed this node to prevent re-conversion
  if (isAutoMode && processedNodes.has(textNode)) {
    return false;
  }

  const cleanText = removeZeroWidthSpaces(originalText);
  const convertedText = convert(cleanText);

  // For auto mode, rely on node tracking instead of cascading detection
  // For manual mode, still check for cascading to prevent obvious issues
  const shouldBlock = !isAutoMode && isCascadingConversion(cleanText, convertedText);

  if (convertedText !== cleanText && !shouldBlock) {
    textNode.nodeValue = convertedText;

    // Mark node as processed in auto mode
    if (isAutoMode) {
      processedNodes.add(textNode);
    }

    return true;
  }
  return false;
};

function convertAllTextNodes({ origin, target, once }, isAutoMode = false) {
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

    const wasConverted = once
      ? processTextNodeOnceMode(textNode, originalText, convert)
      : processTextNodeNormalMode(textNode, originalText, convert, isAutoMode);

    if (wasConverted) count++;
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

    if (once) {
      // Check if this text was already converted
      const { convertedText: existingConverted, wasConverted } = extractFromMarkedText(originalText);
      if (wasConverted) {
        // Already converted, replace with clean converted text
        const fullText = textNode.nodeValue;
        textNode.nodeValue = fullText.substring(0, startOffset) + existingConverted + fullText.substring(endOffset);
        return true;
      }

      // Convert and mark with original if conversion occurred
      let newConverted = convert(existingConverted);
      if (newConverted !== existingConverted) {
        newConverted = addZeroWidthSpaces(newConverted, existingConverted);
        const fullText = textNode.nodeValue;
        textNode.nodeValue = fullText.substring(0, startOffset) + newConverted + fullText.substring(endOffset);
        return true;
      }
    } else {
      // Normal conversion without marking
      const cleanText = removeZeroWidthSpaces(originalText);
      let convertedText = convert(cleanText);
      if (convertedText !== cleanText) {
        const fullText = textNode.nodeValue;
        textNode.nodeValue = fullText.substring(0, startOffset) + convertedText + fullText.substring(endOffset);
        return true;
      }
    }

    return false;
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
  convertAllTextNodes(settings, true); // Pass true for auto mode
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
  convertAllTextNodes(settings, true); // Pass true for auto mode
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
