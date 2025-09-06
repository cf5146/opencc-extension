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

// Track strings that are already in target form (outputs we produced) per mapping.
const convertedOutputs = new Map<string, Set<string>>(); // key: from->to
function getConvertedOutputsSet(key: string) {
  let set = convertedOutputs.get(key);
  if (!set) { set = new Set(); convertedOutputs.set(key, set); }
  return set;
}

export function resetConversionCache() {
  nodeMeta = new WeakMap();
}

export function convertTextNode(from: OpenCCLocale, to: OpenCCLocale, textNode: Text): boolean {
  const meta = nodeMeta.get(textNode);
  if (meta && meta.from === from && meta.to === to) return false; // already converted
  const original = textNode.nodeValue;
  if (!original || !/[\u4e00-\u9fff]/.test(original)) { nodeMeta.set(textNode, { from, to }); return false; }
  const key = `${from}->${to}`;
  const outputs = getConvertedOutputsSet(key);
  // If we've previously produced this exact string as an output for this mapping, treat as already-converted.
  if (outputs.has(original)) { nodeMeta.set(textNode, { from, to }); return false; }
  const convert = getConverter(from, to);
  const converted = convert(original);
  if (converted !== original) {
    textNode.nodeValue = converted;
    outputs.add(converted);
    nodeMeta.set(textNode, { from, to });
    return true;
  }
  // original unchanged: could still be target form; mark output cache so future identical nodes skip quickly.
  outputs.add(original);
  nodeMeta.set(textNode, { from, to });
  return false;
}

export function convertAllNewTextNodes(from: OpenCCLocale, to: OpenCCLocale, root: HTMLElement | DocumentFragment | null = document.body) {
  if (!root) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let count = 0; let node: Node | null;
  while ((node = walker.nextNode())) {
    if (convertTextNode(from, to, node as Text)) count++;
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
