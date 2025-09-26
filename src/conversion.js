import { Converter } from "./lib/opencc/index.js";

// Cache converters by from->to key to avoid recreating
const converterCache = new Map();
const getConverter = (from, to) => {
  const key = `${from}->${to}`;
  if (!converterCache.has(key)) converterCache.set(key, Converter({ from, to }));
  return converterCache.get(key);
};

// Track which nodes have already been converted for a specific from->to pair
let nodeMeta = new WeakMap(); // node -> { from, to }

export function resetConversionCache() {
  nodeMeta = new WeakMap();
}

function isConversionNeeded(node, from, to) {
  const meta = nodeMeta.get(node);
  return !meta || meta.from !== from || meta.to !== to;
}

function shouldConvertText(text) {
  return text && /[\u4e00-\u9fff]/.test(text);
}

function updateNodeMeta(node, from, to) {
  nodeMeta.set(node, { from, to });
}

function processTextNode(node, from, to, convert) {
  if (isConversionNeeded(node, from, to)) {
    const original = node.nodeValue;
    if (shouldConvertText(original)) {
      const converted = convert(original);
      if (converted !== original) {
        node.nodeValue = converted;
        updateNodeMeta(node, from, to);
        return true;
      }
      updateNodeMeta(node, from, to);
    } else {
      updateNodeMeta(node, from, to);
    }
  }
  return false;
}

export function convertAllNewTextNodes(from, to, root = document.body) {
  if (!root) return 0;
  const convert = getConverter(from, to);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let count = 0;
  for (let node; (node = walker.nextNode()); ) {
    if (processTextNode(node, from, to, convert)) {
      count++;
    }
  }
  return count;
}

export function convertTitle(from, to) {
  const convert = getConverter(from, to);
  document.title = convert(document.title);
}

export function hasConverted(node, from, to) {
  const meta = nodeMeta.get(node);
  return !!meta && meta.from === from && meta.to === to;
}
