import type {
  ConverterLocale,
  ConverterOptions,
  DictionaryEntry,
  DictionaryGroup,
  LocalePreset,
  OpenCCLocale,
} from './types.js';

interface TrieNode {
  readonly children: Map<number, TrieNode>;
  value?: string;
}

class Trie {
  private readonly root: TrieNode = { children: new Map<number, TrieNode>() };

  addWord(source: string, target: string) {
    if (!source) return;
    let node = this.root;
    for (const codePoint of iterateCodePoints(source)) {
      let next = node.children.get(codePoint);
      if (!next) {
        next = { children: new Map<number, TrieNode>() };
        node.children.set(codePoint, next);
      }
      node = next;
    }
    node.value = target;
  }

  addEntries(entries: readonly DictionaryEntry[]) {
    for (const [source, target] of entries) {
      this.addWord(source, target);
    }
  }

  convert(input: string): string {
    const output: string[] = [];
    let index = 0;

    while (index < input.length) {
      const match = this.findReplacement(input, index);
      if (match) {
        output.push(match.value);
        index += match.length;
        continue;
      }

      const codePoint = input.codePointAt(index)!;
      output.push(String.fromCodePoint(codePoint));
      index += codePoint > 0xffff ? 2 : 1;
    }

    return output.join('');
  }

  private findReplacement(input: string, start: number): { value: string; length: number } | null {
    let node: TrieNode | undefined = this.root;
    let cursor = start;
    let bestValue: string | undefined;
    let bestLength = 0;

    while (cursor < input.length && node) {
      const codePoint = input.codePointAt(cursor)!;
      node = node.children.get(codePoint);
      if (!node) break;
      cursor += codePoint > 0xffff ? 2 : 1;
      if (node.value !== undefined) {
        bestValue = node.value;
        bestLength = cursor - start;
      }
    }

    return bestValue === undefined ? null : { value: bestValue, length: bestLength };
  }
}

function iterateCodePoints(text: string): Iterable<number> {
  return {
    *[Symbol.iterator]() {
      let index = 0;
      while (index < text.length) {
        const codePoint = text.codePointAt(index)!;
        yield codePoint;
        index += codePoint > 0xffff ? 2 : 1;
      }
    },
  };
}

export type ConverterFunction = (text: string) => string;

export function createConverterFactory(groups: readonly DictionaryGroup[]): ConverterFunction {
  const tries = groups.map((entries) => {
    const trie = new Trie();
    trie.addEntries(entries);
    return trie;
  });

  return (input: string) => tries.reduce((text, trie) => trie.convert(text), input);
}

function isConcreteLocale(locale: ConverterLocale): locale is OpenCCLocale {
  return locale !== 't';
}

function assertValidLocale(preset: LocalePreset, type: keyof LocalePreset, locale: OpenCCLocale) {
  if (!(locale in preset[type])) {
    throw new Error(`Unsupported locale "${locale}" for ${type}`);
  }
}

const IDENTITY_CONVERTER: ConverterFunction = (text: string) => text;

export function createConverterBuilder(preset: LocalePreset) {
  return function Converter(options: ConverterOptions) {
    if (!options) {
      throw new Error('Converter options are required');
    }

    const groups: DictionaryGroup[] = [];

    const from = options.from;
    if (from && isConcreteLocale(from)) {
      assertValidLocale(preset, 'from', from);
      groups.push(...preset.from[from]);
    }

    const to = options.to;
    if (to && isConcreteLocale(to)) {
      assertValidLocale(preset, 'to', to);
      groups.push(...preset.to[to]);
    }

    if (groups.length === 0) {
      return IDENTITY_CONVERTER;
    }

    return createConverterFactory(groups);
  };
}

export function createCustomConverter(dict: readonly DictionaryEntry[]): ConverterFunction {
  const trie = new Trie();
  trie.addEntries(dict);
  return (input: string) => trie.convert(input);
}
