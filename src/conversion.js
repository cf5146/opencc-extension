import { Converter } from "opencc-js";

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

export function convertAllNewTextNodes(from, to, root = document.body) {
  if (!root) return 0;
  const convert = getConverter(from, to);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let count = 0;
  for (let node; (node = walker.nextNode()); ) {
    const meta = nodeMeta.get(node);
    if (meta && meta.from === from && meta.to === to) continue; // already converted for this mapping
    const original = node.nodeValue;
    if (!original || !/[\u4e00-\u9fff]/.test(original)) { // skip if no CJK
      nodeMeta.set(node, { from, to });
      continue;
    }
    const converted = convert(original);
    if (converted !== original) {
      node.nodeValue = converted;
      count++;
    }
    nodeMeta.set(node, { from, to });
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
