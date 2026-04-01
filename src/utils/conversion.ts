import { Converter } from '../lib/opencc/index.js';
import type { ConverterFunction } from '../lib/opencc/index.js';
import type { LocaleCode } from './storage';

const CJK_REGEX = /[\u4e00-\u9fff]/;

// Memoized converter factory
const converterCache = new Map<string, ConverterFunction>();

function getConverter(from: LocaleCode, to: LocaleCode): ConverterFunction {
  const key = `${from}->${to}`;
  const existing = converterCache.get(key);
  if (existing) return existing;
  const created = Converter({ from, to });
  converterCache.set(key, created);
  return created;
}

// Per-node tracking (WeakMap: auto-GC with DOM nodes)
interface NodeMeta {
  from: LocaleCode;
  to: LocaleCode;
}
let nodeMeta = new WeakMap<Text, NodeMeta>();

// Output dedup: avoid re-converting identical strings
const convertedOutputs = new Map<string, Set<string>>();

function getOutputsSet(key: string): Set<string> {
  let set = convertedOutputs.get(key);
  if (!set) {
    set = new Set<string>();
    convertedOutputs.set(key, set);
  }
  return set;
}

export function convertText(text: string, from: LocaleCode, to: LocaleCode): string {
  return getConverter(from, to)(text);
}

export function convertTextNode(node: Text, from: LocaleCode, to: LocaleCode): boolean {
  const meta = nodeMeta.get(node);
  if (meta && meta.from === from && meta.to === to) return false;

  const original = node.nodeValue ?? '';
  if (!original || !CJK_REGEX.test(original)) {
    nodeMeta.set(node, { from, to });
    return false;
  }

  const key = `${from}->${to}`;
  const outputs = getOutputsSet(key);
  if (outputs.has(original)) {
    nodeMeta.set(node, { from, to });
    return false;
  }

  const converted = convertText(original, from, to);
  if (converted !== original) {
    node.nodeValue = converted;
    outputs.add(converted);
    nodeMeta.set(node, { from, to });
    return true;
  }

  outputs.add(original);
  nodeMeta.set(node, { from, to });
  return false;
}

export function convertAllTextNodes(from: LocaleCode, to: LocaleCode, root: Node | null = document.body): number {
  if (!root) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let count = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (convertTextNode(node as Text, from, to)) count++;
  }
  return count;
}

export function convertTitle(from: LocaleCode, to: LocaleCode): void {
  document.title = convertText(document.title, from, to);
}

export function convertSelection(selection: Selection | null, from: LocaleCode, to: LocaleCode): boolean {
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  let changed = false;
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    const original = textNode.nodeValue ?? '';
    if (!original) continue;
    const converted = convertText(original, from, to);
    if (converted !== original) {
      textNode.nodeValue = converted;
      changed = true;
    }
  }

  if (changed) {
    range.deleteContents();
    range.insertNode(fragment);
  }
  return changed;
}

export function hasConverted(node: Node, from: LocaleCode, to: LocaleCode): boolean {
  const meta = nodeMeta.get(node as Text);
  return !!meta && meta.from === from && meta.to === to;
}

export function resetCaches(): void {
  nodeMeta = new WeakMap<Text, NodeMeta>();
  convertedOutputs.clear();
}
