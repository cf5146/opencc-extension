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

function processTextNode(node, from, to, convert) {
  const meta = nodeMeta.get(node);
  if (!meta || meta.from !== from || meta.to !== to) {
    const original = node.nodeValue;
    if (original && /[\u4e00-\u9fff]/.test(original)) {
      const converted = convert(original);
      if (converted !== original) {
        node.nodeValue = converted;
        nodeMeta.set(node, { from, to });
        return true;
      }
      nodeMeta.set(node, { from, to });
    } else {
      nodeMeta.set(node, { from, to });
    }
  }
  return false;
}

export function convertAllNewTextNodes(from, to, root = document.body) {
  if (!root) return 0;
  const convert = getConverter(from, to);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let count = 0;
  let node = walker.nextNode();

  while (node) {
    if (processTextNode(node, from, to, convert)) {
      count++;
    }
    node = walker.nextNode();
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
