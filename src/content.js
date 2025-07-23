import { getConverter, defaultSettings, isEmptyText, isSameConversion } from "./shared/utils.js";

// Cache compiled regexes for whitelist matching with improved memory management
const whitelistRegexCache = new Map();
const MAX_REGEX_CACHE_SIZE = 50; // Limit cache size

const matchWhitelist = (whitelist, url) => {
  if (!Array.isArray(whitelist) || whitelist.length === 0) return false;
  return whitelist.some((pattern) => {
    if (!whitelistRegexCache.has(pattern)) {
      // Clean cache if it gets too large
      if (whitelistRegexCache.size >= MAX_REGEX_CACHE_SIZE) {
        const firstKey = whitelistRegexCache.keys().next().value;
        whitelistRegexCache.delete(firstKey);
      }

      try {
        whitelistRegexCache.set(pattern, new RegExp(pattern));
      } catch {
        // Invalid regex pattern, skip it and cache null to avoid retrying
        whitelistRegexCache.set(pattern, null);
        return false;
      }
    }
    const regex = whitelistRegexCache.get(pattern);
    return regex?.test(url) ?? false;
  });
};

function convertTitle({ origin, target }) {
  const convert = getConverter(origin, target);
  document.title = convert(document.title);
}

// Track processed nodes to prevent cascading conversions in auto mode
const processedNodes = new WeakSet();
const MAX_PROCESSED_NODES = 10000; // Limit to prevent memory issues
let processedNodeCount = 0;

// Helper function to check if conversion seems like cascading (optimized)
const isCascadingConversion = (original, converted) => {
  if (converted === original) return false;

  // Fast path - check length first
  const lengthDiff = converted.length - original.length;
  if (lengthDiff <= 0) return false;

  // Only check for very obvious cascading patterns
  if (lengthDiff > original.length * 1.5) {
    // More than 150% increase
    // Pattern 1: Check if the converted text contains the original as a complete substring
    if (converted.includes(original) && original.length >= 2) {
      return true;
    }

    // Pattern 2: Check for character repetition patterns at the beginning
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

// Helper function to process text node with memory management
const processTextNode = (textNode, originalText, convert, isAutoMode = false) => {
  // In auto mode, check if we've already processed this node to prevent re-conversion
  if (isAutoMode && processedNodes.has(textNode)) {
    return false;
  }

  const convertedText = convert(originalText);

  // For auto mode, rely on node tracking instead of cascading detection
  // For manual mode, still check for cascading to prevent obvious issues
  const shouldBlock = !isAutoMode && isCascadingConversion(originalText, convertedText);

  if (convertedText !== originalText && !shouldBlock) {
    textNode.nodeValue = convertedText;

    // Mark node as processed in auto mode with memory management
    if (isAutoMode) {
      processedNodes.add(textNode);
      processedNodeCount++;

      // Clean up memory if we have too many processed nodes
      if (processedNodeCount > MAX_PROCESSED_NODES) {
        // Note: WeakSet doesn't allow iteration, so we reset the counter
        // The WeakSet will automatically clean up when nodes are garbage collected
        processedNodeCount = Math.floor(MAX_PROCESSED_NODES * 0.5);
      }
    }

    return true;
  }
  return false;
};

function convertAllTextNodes({ origin, target }, isAutoMode = false) {
  if (isSameConversion(origin, target)) return 0;

  const convert = getConverter(origin, target);
  let count = 0;

  // Use faster NodeIterator instead of TreeWalker for better performance
  const nodeIterator = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Early filtering to skip empty nodes
      return isEmptyText(node.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodesToProcess = [];
  let textNode;

  // Collect nodes first to avoid live NodeList issues
  while ((textNode = nodeIterator.nextNode())) {
    nodesToProcess.push(textNode);
  }

  // Process collected nodes
  for (const node of nodesToProcess) {
    const originalText = node.nodeValue;
    const wasConverted = processTextNode(node, originalText, convert, isAutoMode);
    if (wasConverted) count++;
  }

  return count;
}

function convertSelectedTextNodes({ origin, target }) {
  if (isSameConversion(origin, target)) return;

  const convert = getConverter(origin, target);

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);

  // Improved handling for text spanning multiple containers
  const processTextNode = (textNode, startOffset = 0, endOffset = textNode.length) => {
    const originalText = textNode.nodeValue.substring(startOffset, endOffset);

    // Skip empty or whitespace-only text nodes
    if (isEmptyText(originalText)) return false;

    const convertedText = convert(originalText);
    if (convertedText !== originalText) {
      const fullText = textNode.nodeValue;
      textNode.nodeValue = fullText.substring(0, startOffset) + convertedText + fullText.substring(endOffset);
      return true;
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
let cachedSettings = null;
let settingsExpiry = 0;
let isProcessing = false;
let observerActive = true;

// Cache settings for a short time to reduce storage calls
const getCachedSettings = async () => {
  if (cachedSettings && Date.now() < settingsExpiry) {
    return cachedSettings;
  }
  const storedSettings = await chrome.storage.local.get(defaultSettings);
  // Ensure all required properties exist and are of correct type
  cachedSettings = {
    ...defaultSettings,
    ...storedSettings,
    whitelist: Array.isArray(storedSettings.whitelist) ? storedSettings.whitelist : defaultSettings.whitelist,
  };
  settingsExpiry = Date.now() + 5000; // Cache for 5 seconds
  return cachedSettings;
};

// Optimized debounced function to handle mutations with processing lock
const debouncedMutationHandler = async () => {
  if (isProcessing || !observerActive) return; // Prevent overlapping processing

  try {
    const settings = await getCachedSettings();
    if (!settings.auto || isSameConversion(settings.origin, settings.target)) return;
    if (matchWhitelist(settings.whitelist, window.location.href)) return;

    isProcessing = true;

    try {
      if (currentURL !== window.location.href) {
        currentURL = window.location.href;
        convertTitle(settings);
      }
      convertAllTextNodes(settings, true); // Pass true for auto mode
    } finally {
      isProcessing = false;
    }
  } catch (error) {
    console.error("OpenCC Extension: Error in mutation handler:", error);
    isProcessing = false; // Ensure processing flag is reset
  }
};

// Optimized observer with better performance
const lang = document.documentElement.lang;
if (!lang || lang.startsWith("zh")) {
  const observer = new MutationObserver((mutations) => {
    // Filter mutations to only relevant ones
    const hasRelevantMutations = mutations.some(
      (mutation) =>
        (mutation.type === "childList" && mutation.addedNodes.length > 0) || mutation.type === "characterData",
    );

    if (!hasRelevantMutations) return;

    // Debounce mutations to avoid excessive conversions
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(debouncedMutationHandler, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    // Only observe text changes, not all attribute changes
    characterData: true,
    // Don't observe attributes to reduce overhead
    attributes: false,
  });

  // Cleanup observer when page is about to unload
  window.addEventListener("beforeunload", () => {
    observerActive = false;
    observer.disconnect();
    if (mutationTimeout) clearTimeout(mutationTimeout);
  });
}

/* Run convert once DOM ready when in auto mode. */
getCachedSettings()
  .then((settings) => {
    try {
      if (!settings.auto) return;
      if (matchWhitelist(settings.whitelist, window.location.href)) return;
      convertTitle(settings);
      convertAllTextNodes(settings, true); // Pass true for auto mode
    } catch (error) {
      console.error("OpenCC Extension: Error during initial conversion:", error);
    }
  })
  .catch((error) => {
    console.error("OpenCC Extension: Error loading settings:", error);
  });

/* Run convert on all nodes when triggered by button click in popup. */
// NOTE: listener itself cannot be async function, see https://stackoverflow.com/questions/48107746.
chrome.runtime.onMessage.addListener(({ action }, _, sendResponse) => {
  (async () => {
    const storedSettings = await chrome.storage.local.get(defaultSettings);
    // Ensure all required properties exist and are of correct type
    const settings = {
      ...defaultSettings,
      ...storedSettings,
      whitelist: Array.isArray(storedSettings.whitelist) ? storedSettings.whitelist : defaultSettings.whitelist,
    };
    if (!isSameConversion(settings.origin, settings.target)) {
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
