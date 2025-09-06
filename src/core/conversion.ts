import { Converter } from 'opencc-js';

// Supported locale codes for opencc-js in this extension
// Keep only locales actually supported by opencc-js (exclude unsupported like 'sg' if not present)
export type OpenCCLocale = 'cn' | 'hk' | 'twp' | 'tw' | 'jp';

// Cache converters by from->to key to avoid recreating
const converterCache = new Map<string, ReturnType<typeof Converter>>();
const getConverter = (from: OpenCCLocale, to: OpenCCLocale) => {
  const key = `${from}->${to}`;
  if (!converterCache.has(key)) converterCache.set(key, Converter({ from: from as any, to: to as any }));
  return converterCache.get(key)!;
};

// Track which nodes have already been converted for a specific from->to pair
interface NodeMeta { from: OpenCCLocale; to: OpenCCLocale }
let nodeMeta: WeakMap<Node, NodeMeta> = new WeakMap(); // node -> { from, to }

export function resetConversionCache() {
  nodeMeta = new WeakMap();
}

export function convertAllNewTextNodes(from: OpenCCLocale, to: OpenCCLocale, root: HTMLElement | DocumentFragment | null = document.body) {
  if (!root) return 0;
  const convert = getConverter(from, to);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const meta = nodeMeta.get(node);
    if (meta && meta.from === from && meta.to === to) continue; // already converted for this mapping
    const original = (node as Text).nodeValue;
    if (!original || !/[\u4e00-\u9fff]/.test(original)) { // skip if no CJK
      nodeMeta.set(node, { from, to });
      continue;
    }
    const converted = convert(original);
    if (converted !== original) {
      (node as Text).nodeValue = converted;
      count++;
    }
    nodeMeta.set(node, { from, to });
  }
  return count;
}

export function convertTitle(from: OpenCCLocale, to: OpenCCLocale) {
  const convert = getConverter(from, to);
  document.title = convert(document.title);
}

export function hasConverted(node: Node, from: OpenCCLocale, to: OpenCCLocale) {
  const meta = nodeMeta.get(node);
  return !!meta && meta.from === from && meta.to === to;
}
