import {
  ConverterFactory,
  HTMLConverter,
  type ConverterFunction,
  type DictGroup,
  type HTMLConvertHandler,
} from 'opencc-js/core';
import { from as localeFrom, to as localeTo } from 'opencc-js/preset';

import { VARIANTS, type VariantCode } from './constants';

const IDENTITY_CONVERTER: ConverterFunction = (text) => text;
const CJK_TEXT_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/;
const IGNORED_TEXT_CONTAINER_SELECTOR =
  'script, style, textarea, code, pre, kbd, samp, .ignore-opencc';

function getPresetGroups(
  presets: Record<string, readonly DictGroup[]>,
  variant: Exclude<VariantCode, 't'>,
  direction: 'from' | 'to',
) {
  const groups = presets[variant];
  if (!groups) {
    throw new Error(`Unsupported ${direction} variant "${variant}"`);
  }
  return groups;
}

export function createConverter(from: VariantCode, to: VariantCode): ConverterFunction {
  if (from === to) {
    return IDENTITY_CONVERTER;
  }

  const groups: DictGroup[] = [];
  if (from !== 't') {
    groups.push(...getPresetGroups(localeFrom, from, 'from'));
  }
  if (to !== 't') {
    groups.push(...getPresetGroups(localeTo, to, 'to'));
  }

  return groups.length === 0 ? IDENTITY_CONVERTER : ConverterFactory(...groups);
}

export function createHTMLConverter(
  converter: ConverterFunction,
  rootNode: HTMLElement,
  fromLangTag: string,
  toLangTag: string,
): HTMLConvertHandler {
  const originalLang = rootNode.getAttribute('lang');
  const handler = HTMLConverter(converter, rootNode, fromLangTag, toLangTag);

  return {
    convert() {
      rootNode.lang = fromLangTag;
      handler.convert();
    },
    restore() {
      handler.restore();
      if (originalLang === null) {
        rootNode.removeAttribute('lang');
      } else {
        rootNode.setAttribute('lang', originalLang);
      }
    },
  };
}

export function convertText(text: string, from: VariantCode, to: VariantCode): string {
  return createConverter(from, to)(text);
}

export function canConvertText(text: string): boolean {
  return CJK_TEXT_PATTERN.test(text);
}

export function countConvertibleTextNodes(rootNode: Node, converter: ConverterFunction): number {
  const ownerDocument = rootNode.ownerDocument ?? document;
  const walker = ownerDocument.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let count = 0;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(IGNORED_TEXT_CONTAINER_SELECTOR)) {
      continue;
    }

    const text = node.textContent ?? '';
    if (canConvertText(text) && converter(text) !== text) {
      count += 1;
    }
  }

  return count;
}

export function getLangTag(variant: VariantCode): string {
  return VARIANTS[variant].langTag;
}
