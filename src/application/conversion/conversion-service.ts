import type { LocaleCode } from '../../domain/conversion/locales.js';
import { createOpenCCFactory } from '../../infrastructure/conversion/opencc-factory.js';
import type { ConverterFactory } from '../../infrastructure/conversion/opencc-factory.js';

const CJK_REGEX = /[\u4e00-\u9fff]/;

interface NodeMeta {
  from: LocaleCode;
  to: LocaleCode;
}

export interface ConversionService {
  convertText(text: string, from: LocaleCode, to: LocaleCode): string;
  convertTextNode(node: Text, from: LocaleCode, to: LocaleCode): boolean;
  convertDocument(from: LocaleCode, to: LocaleCode, root?: Node | null): number;
  convertTitle(from: LocaleCode, to: LocaleCode): void;
  convertSelection(selection: Selection | null, from: LocaleCode, to: LocaleCode): boolean;
  hasConverted(node: Node, from: LocaleCode, to: LocaleCode): boolean;
  resetCaches(): void;
}

export function createConversionService(factory: ConverterFactory = createOpenCCFactory()): ConversionService {
  let nodeMeta = new WeakMap<Text, NodeMeta>();
  const convertedOutputs = new Map<string, Set<string>>();

  const getOutputsSet = (key: string) => {
    let set = convertedOutputs.get(key);
    if (!set) {
      set = new Set<string>();
      convertedOutputs.set(key, set);
    }
    return set;
  };

  const getConverter = (from: LocaleCode, to: LocaleCode) => factory(from, to);

  const convertText = (text: string, from: LocaleCode, to: LocaleCode) => getConverter(from, to)(text);

  const convertNode = (node: Text, from: LocaleCode, to: LocaleCode) => {
    const meta = nodeMeta.get(node);
    if (meta && meta.from === from && meta.to === to) {
      return false;
    }

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
  };

  const convertDocument = (from: LocaleCode, to: LocaleCode, root: Node | null = document.body) => {
    if (!root) return 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let count = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (convertNode(node as Text, from, to)) {
        count += 1;
      }
    }
    return count;
  };

  const convertTitle = (from: LocaleCode, to: LocaleCode) => {
    document.title = convertText(document.title, from, to);
  };

  const convertSelection = (selection: Selection | null, from: LocaleCode, to: LocaleCode) => {
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
    let changed = false;
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const textNode = node as Text;
      if (!textNode.nodeValue) continue;
      if (convertNode(textNode, from, to)) {
        changed = true;
      }
    }

    if (changed) {
      range.deleteContents();
      range.insertNode(fragment);
    }

    return changed;
  };

  const hasConverted = (node: Node, from: LocaleCode, to: LocaleCode) => {
    const meta = nodeMeta.get(node as Text);
    return !!meta && meta.from === from && meta.to === to;
  };

  const resetCaches = () => {
    nodeMeta = new WeakMap<Text, NodeMeta>();
    convertedOutputs.clear();
  };

  return {
    convertText,
    convertTextNode: convertNode,
    convertDocument,
    convertTitle,
    convertSelection,
    hasConverted,
    resetCaches,
  };
}
